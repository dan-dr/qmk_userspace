// Copyright 2026 ddyo
// SPDX-License-Identifier: GPL-2.0-or-later

#include "fsr_layer.h"

#include "quantum.h"

ASSERT_COMMUNITY_MODULES_MIN_API_VERSION(1, 0, 0);

#ifdef FSR_ENABLE
#    include "analog.h"
#    include "debug.h"

typedef enum {
    FSR_CAL_NONE = 0,
    FSR_CAL_BOOT_IDLE,
    FSR_CAL_MANUAL_IDLE,
} fsr_cal_mode_t;

static bool           fsr_pressed         = false;
static bool           fsr_layer_on        = false;
static bool           fsr_rising_on_press = true;
static bool           fsr_has_idle        = false;
static bool           fsr_has_touch       = false;
static bool           fsr_active          = true;
static uint16_t       fsr_scan_timer      = 0;
static uint16_t       fsr_debug_timer     = 0;
static uint16_t       fsr_release_timer   = 0;
static int16_t        fsr_max_reading     = 0;
static int16_t        fsr_press_thr       = FSR_THRESHOLD;
static int16_t        fsr_release_thr     = FSR_RELEASE_THRESHOLD;
static int16_t        fsr_idle_avg        = 0;
static int16_t        fsr_touch_avg       = 0;
static fsr_cal_mode_t fsr_cal_mode        = FSR_CAL_NONE;
static uint16_t       fsr_cal_timer       = 0;
static uint32_t       fsr_cal_sum         = 0;
static uint16_t       fsr_cal_count       = 0;

static bool fsr_is_sensor_side(void) {
#    ifdef SPLIT_KEYBOARD
    return is_keyboard_left() == (FSR_ON_LEFT_SIDE != 0);
#    else
    return true;
#    endif
}

static int16_t fsr_clamp_adc(int32_t value) {
    if (value < 0) {
        return 0;
    }
    if (value > 4095) {
        return 4095;
    }
    return (int16_t)value;
}

static void fsr_log_calibration(const char *reason) {
    int16_t span = 0;
    if (fsr_has_idle && fsr_has_touch) {
        span = (int16_t)(fsr_touch_avg - fsr_idle_avg);
        if (span < 0) {
            span = (int16_t)(-span);
        }
    }

    dprintf("FSR cal [%s]\n", reason);
    dprintf("  cfg margin:%d hyst:%d hold_ms:%d boot_ms:%d idle_ms:%d layer:%d\n", FSR_CAL_MARGIN, FSR_CAL_HYSTERESIS, FSR_RELEASE_HOLD_MS, FSR_BOOT_CALIBRATE_MS, FSR_IDLE_CALIBRATE_MS, FSR_LAYER);
    dprintf("  idle:%s avg:%d  touch:%s avg:%d  span:%d\n", fsr_has_idle ? "yes" : "no", fsr_idle_avg, fsr_has_touch ? "yes" : "no", fsr_touch_avg, span);
    dprintf("  polarity:%s  press_thr:%d  release_thr:%d  gap:%d\n", fsr_rising_on_press ? "rising" : "falling", fsr_press_thr, fsr_release_thr, fsr_rising_on_press ? (fsr_press_thr - fsr_release_thr) : (fsr_release_thr - fsr_press_thr));
    if (fsr_has_idle && !fsr_has_touch) {
        dprintf("  mode:idle-only  press=idle%c%d  release=press%c%d\n", fsr_rising_on_press ? '+' : '-', FSR_CAL_MARGIN, fsr_rising_on_press ? '-' : '+', FSR_CAL_HYSTERESIS);
    } else if (fsr_has_idle && fsr_has_touch) {
        dprintf("  mode:idle+touch  press=idle+40%%*delta  release=press%c%d\n", fsr_rising_on_press ? '-' : '+', FSR_CAL_HYSTERESIS);
    } else {
        dprintf("  mode:defaults  press:%d release:%d\n", FSR_THRESHOLD, FSR_RELEASE_THRESHOLD);
    }
}

static void fsr_apply_thresholds_from_idle_only(void) {
    /* Idle-only cannot learn polarity; default rising (V rises under load).
     * Touch calibration overrides this if touch < idle. */
    fsr_rising_on_press = true;
    fsr_press_thr       = fsr_clamp_adc((int32_t)fsr_idle_avg + FSR_CAL_MARGIN);
    fsr_release_thr     = fsr_clamp_adc((int32_t)fsr_press_thr - FSR_CAL_HYSTERESIS);
    if (fsr_release_thr >= fsr_press_thr) {
        fsr_release_thr = fsr_press_thr > 0 ? (int16_t)(fsr_press_thr - 1) : 0;
    }
}

static void fsr_apply_thresholds_from_idle_and_touch(void) {
    int32_t idle  = fsr_idle_avg;
    int32_t touch = fsr_touch_avg;
    int32_t span  = touch - idle;
    if (span < 0) {
        span = -span;
    }
    if (span < 2) {
        /* Touch ≈ idle: fall back to margin from idle. */
        fsr_apply_thresholds_from_idle_only();
        return;
    }

    fsr_rising_on_press = touch > idle;
    /* Trip at 40% of the way from idle toward touch. */
    int32_t press = idle + ((touch - idle) * 2) / 5;
    fsr_press_thr = fsr_clamp_adc(press);

    if (fsr_rising_on_press) {
        fsr_release_thr = fsr_clamp_adc((int32_t)fsr_press_thr - FSR_CAL_HYSTERESIS);
        if (fsr_release_thr >= fsr_press_thr) {
            fsr_release_thr = fsr_press_thr > 0 ? (int16_t)(fsr_press_thr - 1) : 0;
        }
    } else {
        fsr_release_thr = fsr_clamp_adc((int32_t)fsr_press_thr + FSR_CAL_HYSTERESIS);
        if (fsr_release_thr <= fsr_press_thr) {
            fsr_release_thr = fsr_press_thr < 4095 ? (int16_t)(fsr_press_thr + 1) : 4095;
        }
    }
}

static void fsr_finish_idle_calibration(void) {
    if (fsr_cal_count == 0) {
        fsr_cal_mode = FSR_CAL_NONE;
        dprintln("FSR cal idle: no samples");
        return;
    }

    fsr_idle_avg = (int16_t)(fsr_cal_sum / fsr_cal_count);
    fsr_has_idle = true;
    fsr_cal_mode = FSR_CAL_NONE;

    if (fsr_has_touch) {
        fsr_apply_thresholds_from_idle_and_touch();
    } else {
        fsr_apply_thresholds_from_idle_only();
    }

    dprintf("FSR cal idle done samples:%u\n", fsr_cal_count);
    fsr_log_calibration(fsr_has_touch ? "idle+touch" : "idle-only");
}

static void fsr_start_idle_calibration(fsr_cal_mode_t mode) {
    fsr_cal_mode  = mode;
    fsr_cal_timer = timer_read();
    fsr_cal_sum   = 0;
    fsr_cal_count = 0;
    if (fsr_pressed || fsr_layer_on || fsr_release_timer != 0) {
        fsr_pressed       = false;
        fsr_release_timer = 0;
        if (fsr_layer_on) {
            fsr_layer_on = false;
            layer_off(FSR_LAYER);
        }
    }
    dprintf("FSR cal idle start (%s, %dms) margin:%d hyst:%d\n", mode == FSR_CAL_BOOT_IDLE ? "boot" : "manual", mode == FSR_CAL_BOOT_IDLE ? FSR_BOOT_CALIBRATE_MS : FSR_IDLE_CALIBRATE_MS, FSR_CAL_MARGIN, FSR_CAL_HYSTERESIS);
}

static void fsr_release_layer_now(void) {
    fsr_pressed       = false;
    fsr_release_timer = 0;
    if (fsr_layer_on) {
        fsr_layer_on = false;
        layer_off(FSR_LAYER);
    }
}

static void fsr_calibrate_touch_now(int16_t reading) {
    fsr_touch_avg = reading;
    fsr_has_touch = true;

    if (!fsr_has_idle) {
        /* No idle yet — treat current reading as touch only; keep compile-time defaults until idle. */
        fsr_log_calibration("touch-only (need idle)");
        return;
    }

    fsr_apply_thresholds_from_idle_and_touch();
    fsr_log_calibration("touch");
}

static bool fsr_is_press(int16_t reading) {
    return fsr_rising_on_press ? (reading > fsr_press_thr) : (reading < fsr_press_thr);
}

static bool fsr_is_release(int16_t reading) {
    return fsr_rising_on_press ? (reading < fsr_release_thr) : (reading > fsr_release_thr);
}

static void fsr_debug_log(int16_t reading, bool state_changed) {
    if (state_changed) {
        if (fsr_pressed) {
            dprintf("FSR PRESS val:%d thr:%d/%d gap:%d pol:%s hold_ms:%d layer:%d\n", reading, fsr_press_thr, fsr_release_thr, fsr_rising_on_press ? (fsr_press_thr - fsr_release_thr) : (fsr_release_thr - fsr_press_thr), fsr_rising_on_press ? "rise" : "fall", FSR_RELEASE_HOLD_MS, FSR_LAYER);
        } else if (fsr_release_timer != 0) {
            dprintf("FSR RELEASE start hold:%dms val:%d thr:%d/%d layer:%d\n", FSR_RELEASE_HOLD_MS, reading, fsr_press_thr, fsr_release_thr, FSR_LAYER);
        } else {
            dprintf("FSR RELEASE done val:%d thr:%d/%d layer:%d\n", reading, fsr_press_thr, fsr_release_thr, FSR_LAYER);
        }
    } else if (fsr_cal_mode != FSR_CAL_NONE) {
        uint16_t cal_ms  = (fsr_cal_mode == FSR_CAL_BOOT_IDLE) ? FSR_BOOT_CALIBRATE_MS : FSR_IDLE_CALIBRATE_MS;
        uint16_t elapsed = timer_elapsed(fsr_cal_timer);
        int16_t  running = fsr_cal_count ? (int16_t)(fsr_cal_sum / fsr_cal_count) : reading;
        dprintf("FSR cal %s val:%d avg:%d n:%u t:%u/%ums\n", fsr_cal_mode == FSR_CAL_BOOT_IDLE ? "boot" : "idle", reading, running, fsr_cal_count, elapsed, cal_ms);
    } else {
        dprintf("FSR val:%d max:%d thr:%d/%d pressed:%d layer_on:%d hold:%d active:%d idle:%d touch:%d pol:%s\n", reading, fsr_max_reading, fsr_press_thr, fsr_release_thr, fsr_pressed, fsr_layer_on, fsr_release_timer != 0 ? (int)timer_elapsed(fsr_release_timer) : -1, fsr_active, fsr_has_idle ? fsr_idle_avg : -1, fsr_has_touch ? fsr_touch_avg : -1, fsr_rising_on_press ? "rise" : "fall");
    }
}

void keyboard_post_init_fsr_layer(void) {
    fsr_press_thr   = FSR_THRESHOLD;
    fsr_release_thr = FSR_RELEASE_THRESHOLD;
    dprintf("FSR enabled pin:%d layer:%d side:%s\n", FSR_PIN, FSR_LAYER, FSR_ON_LEFT_SIDE ? "left" : "right");
    fsr_log_calibration("boot defaults");
#    ifdef FSR_AUTO_CALIBRATE
    fsr_start_idle_calibration(FSR_CAL_BOOT_IDLE);
#    endif
}

#endif // FSR_ENABLE

bool process_record_fsr_layer(uint16_t keycode, keyrecord_t *record) {
#ifdef FSR_ENABLE
    if (!fsr_is_sensor_side()) {
        return true;
    }
    switch (keycode) {
        case FSR_CAL_IDLE:
            if (record->event.pressed) {
                fsr_start_idle_calibration(FSR_CAL_MANUAL_IDLE);
            }
            return false;
        case FSR_CAL_TOUCH:
            if (record->event.pressed) {
                fsr_calibrate_touch_now(analogReadPin(FSR_PIN));
            }
            return false;
        case FSR_TOG:
            if (record->event.pressed) {
                fsr_active   = !fsr_active;
                fsr_cal_mode = FSR_CAL_NONE;
                /* Always drop the pedal layer on toggle so a press+disable
                 * cannot leave FSR_LAYER stuck after switching elsewhere. */
                fsr_release_layer_now();
                dprintf("FSR %s\n", fsr_active ? "enabled" : "disabled");
            }
            return false;
    }
#else
    (void)keycode;
    (void)record;
#endif // FSR_ENABLE
    return true;
}

void housekeeping_task_fsr_layer(void) {
#ifdef FSR_ENABLE
    if (!fsr_is_sensor_side()) {
        return;
    }
    if (!fsr_active) {
        /* Safety net: if scanning is off, never keep FSR_LAYER latched. */
        fsr_release_layer_now();
        return;
    }

    if (fsr_scan_timer != 0 && timer_elapsed(fsr_scan_timer) < FSR_SCAN_INTERVAL_MS) {
        return;
    }
    fsr_scan_timer = timer_read();

    int16_t reading = analogReadPin(FSR_PIN);
    if (reading > fsr_max_reading) {
        fsr_max_reading = reading;
    }

    if (fsr_cal_mode != FSR_CAL_NONE) {
        fsr_cal_sum += (uint16_t)reading;
        fsr_cal_count++;

        uint16_t cal_ms = (fsr_cal_mode == FSR_CAL_BOOT_IDLE) ? FSR_BOOT_CALIBRATE_MS : FSR_IDLE_CALIBRATE_MS;
        if (timer_elapsed(fsr_cal_timer) >= cal_ms) {
            fsr_finish_idle_calibration();
        }

        if (fsr_debug_timer == 0 || timer_elapsed(fsr_debug_timer) >= FSR_DEBUG_INTERVAL_MS) {
            fsr_debug_timer = timer_read();
            fsr_debug_log(reading, false);
        }
        return;
    }

    bool fsr_state_changed = false;
    if (!fsr_pressed && fsr_is_press(reading)) {
        fsr_pressed       = true;
        fsr_release_timer = 0;
        fsr_state_changed = true;
        if (!fsr_layer_on) {
            fsr_layer_on = true;
            layer_on(FSR_LAYER);
        }
    } else if (fsr_pressed && fsr_is_release(reading)) {
        fsr_pressed       = false;
        fsr_state_changed = true;
#    if FSR_RELEASE_HOLD_MS > 0
        fsr_release_timer = timer_read() | 1; /* non-zero sentinel */
#    else
        fsr_release_timer = 0;
        if (fsr_layer_on) {
            fsr_layer_on = false;
            layer_off(FSR_LAYER);
        }
#    endif
    } else if (!fsr_pressed && fsr_release_timer != 0 && timer_elapsed(fsr_release_timer) >= FSR_RELEASE_HOLD_MS) {
        fsr_release_timer = 0;
        fsr_state_changed = true;
        if (fsr_layer_on) {
            fsr_layer_on = false;
            layer_off(FSR_LAYER);
        }
    }

    if (fsr_state_changed || fsr_debug_timer == 0 || timer_elapsed(fsr_debug_timer) >= FSR_DEBUG_INTERVAL_MS) {
        fsr_debug_timer = timer_read();
        fsr_debug_log(reading, fsr_state_changed);
    }
#else
    /* Module linked but inactive until FSR_ENABLE + FSR_LAYER are set. */
#endif // FSR_ENABLE
}
