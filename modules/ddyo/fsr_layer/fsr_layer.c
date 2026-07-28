// Copyright 2026 ddyo
// SPDX-License-Identifier: GPL-2.0-or-later

#include "fsr_layer.h"

#include "quantum.h"

#ifdef FSR_ENABLE
#    include "analog.h"
#    include "debug.h"

static bool     fsr_pressed     = false;
static uint16_t fsr_scan_timer  = 0;
static uint16_t fsr_debug_timer = 0;
static int16_t  fsr_max_reading = 0;

static void fsr_debug_log(int16_t reading, bool state_changed) {
    int16_t range = fsr_max_reading;
    if (range < FSR_DEBUG_BAR_MIN_RANGE) {
        range = FSR_DEBUG_BAR_MIN_RANGE;
    }
    range = ((range + FSR_DEBUG_BAR_STEP - 1) / FSR_DEBUG_BAR_STEP) * FSR_DEBUG_BAR_STEP;
    if (range > FSR_DEBUG_ADC_MAX) {
        range = FSR_DEBUG_ADC_MAX;
    }

    int16_t clipped = reading;
    if (clipped < 0) {
        clipped = 0;
    } else if (clipped > range) {
        clipped = range;
    }

    uint8_t filled = ((uint32_t)clipped * FSR_DEBUG_BAR_WIDTH) / range;

    dprint("\rFSR 0|");
    for (uint8_t i = 0; i < FSR_DEBUG_BAR_WIDTH; i++) {
        dprint(i < filled ? "#" : ".");
    }
    dprintf("|range:%4d val:%4d max:%4d adc:%4d pressed:%d    ", range, reading, fsr_max_reading, FSR_DEBUG_ADC_MAX, fsr_pressed);
    if (state_changed) {
        dprint("\n");
    }
}
#endif // FSR_ENABLE

void housekeeping_task_fsr_layer(void) {
#ifdef FSR_ENABLE
    if (fsr_scan_timer != 0 && timer_elapsed(fsr_scan_timer) < FSR_SCAN_INTERVAL_MS) {
        return;
    }
    fsr_scan_timer = timer_read();

    int16_t reading           = analogReadPin(FSR_PIN);
    bool    fsr_state_changed = false;

    if (reading > fsr_max_reading) {
        fsr_max_reading = reading;
    }

    if (!fsr_pressed && FSR_IS_PRESS(reading)) {
        fsr_pressed       = true;
        fsr_state_changed = true;
        layer_on(FSR_LAYER);
    } else if (fsr_pressed && FSR_IS_RELEASE(reading)) {
        fsr_pressed       = false;
        fsr_state_changed = true;
        layer_off(FSR_LAYER);
    }

    if (debug_enable && (fsr_state_changed || fsr_debug_timer == 0 || timer_elapsed(fsr_debug_timer) >= FSR_DEBUG_INTERVAL_MS)) {
        fsr_debug_timer = timer_read();
        fsr_debug_log(reading, fsr_state_changed);
    }
#else
    /* Module linked but inactive until FSR_ENABLE + FSR_LAYER are set. */
#endif // FSR_ENABLE
}
