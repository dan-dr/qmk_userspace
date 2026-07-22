/**
 * Copyright 2021 Charly Delay <charly@codesink.dev> (@0xcharly)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
#include QMK_KEYBOARD_H
#include "analog.h"
#include "argos.h"
#include "keypeek_layer_notify.h"
#include "via.h"

#ifdef FSR_ENABLE
#    include "timer.h"
#endif // FSR_ENABLE

enum charybdis_keymap_layers {
    LAYER_BASE = 0,
    LAYER_LOWER,
    LAYER_RAISE,
    LAYER_POINTER,
    LAYER_SYMBOL,
};

#ifdef POINTING_DEVICE_AUTO_MOUSE_ENABLE
bool is_mouse_record_user(uint16_t keycode, keyrecord_t *record) {
    (void)record;
    // Track physical pointer-layer actions. Tracking Tap Dance's synthesized
    // drag-scroll hold action can leave Auto Mouse's key counter stuck.
    return keycode == TD(2) || keycode == SNIPING;
}
#endif // POINTING_DEVICE_AUTO_MOUSE_ENABLE

#ifdef FSR_ENABLE
static bool     fsr_pressed    = false;
static uint16_t fsr_scan_timer = 0;
static uint16_t fsr_debug_timer = 0;
static int16_t  fsr_max_reading = 0;

static int16_t fsr_debug_range(void) {
    int16_t range = fsr_max_reading;
    if (range < FSR_DEBUG_BAR_MIN_RANGE) {
        range = FSR_DEBUG_BAR_MIN_RANGE;
    }
    range = ((range + FSR_DEBUG_BAR_STEP - 1) / FSR_DEBUG_BAR_STEP) * FSR_DEBUG_BAR_STEP;
    if (range > FSR_DEBUG_ADC_MAX) {
        range = FSR_DEBUG_ADC_MAX;
    }
    return range;
}

static void fsr_debug_log(int16_t reading, bool state_changed) {
    int16_t range   = fsr_debug_range();
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
static void fsr_scan(void) {
    if (fsr_scan_timer != 0 && timer_elapsed(fsr_scan_timer) < FSR_SCAN_INTERVAL_MS) {
        return;
    }
    fsr_scan_timer = timer_read();

    int16_t reading = analogReadPin(FSR_PIN);
    bool fsr_state_changed = false;

    if (reading > fsr_max_reading) {
        fsr_max_reading = reading;
    }

    if (!fsr_pressed && reading > FSR_THRESHOLD) {
        fsr_pressed = true;
        fsr_state_changed = true;
        // register_code16(KC_BTN1);
    } else if (fsr_pressed && reading < FSR_RELEASE_THRESHOLD) {
        fsr_pressed = false;
        fsr_state_changed = true;
        // unregister_code16(KC_BTN1);
    }

    if (debug_enable && (fsr_state_changed || fsr_debug_timer == 0 || timer_elapsed(fsr_debug_timer) >= FSR_DEBUG_INTERVAL_MS)) {
        fsr_debug_timer = timer_read();
        fsr_debug_log(reading, fsr_state_changed);
    }
}
#endif // FSR_ENABLE

#define LOWER MO(LAYER_LOWER)
#define RAISE MO(LAYER_RAISE)
#define PT_Z LT(LAYER_POINTER, KC_Z)
#define PT_SLSH LT(LAYER_POINTER, KC_SLSH)
#define PT_COMM LT(LAYER_POINTER, KC_COMM)

bool get_speculative_hold(uint16_t keycode, keyrecord_t *record) {
    (void)record;
    // RGUI speculative hold falsely triggers OS shortcuts (e.g. Start menu).
    return IS_QK_MOD_TAP(keycode) && QK_MOD_TAP_GET_MODS(keycode) != MOD_RGUI;
}

// clang-format off
const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
  [LAYER_BASE] = LAYOUT(
  // ╭──────────────────────────────────────────────────────╮ ╭──────────────────────────────────────────────────────╮
        KC_GRV,    KC_1,    KC_2,    KC_3,    KC_4,    KC_5,       KC_6,    KC_7,    KC_8,    KC_9,    KC_0, KC_MINS,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
        KC_ESC,    KC_Q,    KC_W,    KC_E,    KC_R,    KC_T,       KC_Y,    KC_U,    KC_I,    KC_O,    KC_P, KC_BSLS,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       KC_LSFT,    KC_A,    KC_S,    KC_D,    KC_F,    KC_G,       KC_H,    KC_J,    KC_K,    KC_L, KC_SCLN, KC_QUOT,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       KC_LSFT,    PT_Z,    KC_X,    KC_C,    KC_V,    KC_B,       KC_N,    KC_M, PT_COMM,  KC_DOT, KC_SLSH, KC_RSFT,
  // ╰──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────╯
                                   KC_LGUI, KC_SPC,   LOWER,      RAISE,  KC_ENT,
                                           KC_LALT, KC_BSPC,     KC_DEL
  //                            ╰───────────────────────────╯ ╰──────────────────╯
  ),

  [LAYER_LOWER] = LAYOUT(
  // ╭──────────────────────────────────────────────────────╮ ╭──────────────────────────────────────────────────────╮
       KC_TILD, KC_EXLM,   KC_AT, KC_HASH,  KC_DLR, KC_PERC,    KC_CIRC, KC_AMPR, KC_ASTR, KC_LPRN, KC_RPRN, KC_UNDS,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       RM_NEXT, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX,    KC_LBRC,   KC_P7,   KC_P8,   KC_P9, KC_RBRC, XXXXXXX,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       RM_TOGG, KC_LGUI, KC_LALT, KC_LCTL, KC_LSFT, XXXXXXX,    KC_PPLS,   KC_P4,   KC_P5,   KC_P6, KC_PMNS, KC_PEQL,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       RM_PREV, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX,    KC_PAST,   KC_P1,   KC_P2,   KC_P3, KC_PSLS, KC_PDOT,
  // ╰──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────╯
                                  XXXXXXX, XXXXXXX, _______,    XXXXXXX, _______,
                                           XXXXXXX, XXXXXXX,      KC_P0
  //                            ╰───────────────────────────╯ ╰──────────────────╯
  ),

  [LAYER_RAISE] = LAYOUT(
  // ╭──────────────────────────────────────────────────────╮ ╭──────────────────────────────────────────────────────╮
        KC_F12,   KC_F1,   KC_F2,   KC_F3,   KC_F4,   KC_F5,      KC_F6,   KC_F7,   KC_F8,   KC_F9,  KC_F10,  KC_F11,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       KC_MNXT, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX,    XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, KC_VOLU,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       KC_MPLY, KC_LEFT,   KC_UP, KC_DOWN, KC_RGHT, XXXXXXX,    XXXXXXX, KC_RSFT, KC_RCTL, KC_RALT, KC_RGUI, KC_MUTE,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       KC_MPRV, KC_HOME, KC_PGUP, KC_PGDN,  KC_END, XXXXXXX,    XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, KC_VOLD,
  // ╰──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────╯
                                  _______, _______, XXXXXXX,    _______, XXXXXXX,
                                           _______, _______,    XXXXXXX
  //                            ╰───────────────────────────╯ ╰──────────────────╯
  ),

  [LAYER_POINTER] = LAYOUT(
  // ╭──────────────────────────────────────────────────────╮ ╭──────────────────────────────────────────────────────╮
       XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX,    XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, DPI_MOD, S_D_MOD,    S_D_MOD, DPI_MOD, QK_BOOT, EE_CLR, XXXXXXX, XXXXXXX,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       XXXXXXX, KC_LGUI, KC_LALT, KC_LCTL, KC_LSFT, EE_CLR,    DB_TOGG, KC_RSFT, KC_RCTL, KC_RALT, KC_RGUI, XXXXXXX,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       XXXXXXX, _______, DRGSCRL, SNIPING,  EE_CLR, QK_BOOT,   XXXXXXX, MS_BTN1, _______, MS_BTN2, DRGSCRL, XXXXXXX,
  // ╰──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────╯
                                  MS_BTN2, MS_BTN1, MS_BTN3,    MS_BTN3, MS_BTN1,
                                           XXXXXXX, MS_BTN2,    MS_BTN2
  //                            ╰───────────────────────────╯ ╰──────────────────╯
  ),

  [LAYER_SYMBOL] = LAYOUT(
  // ╭──────────────────────────────────────────────────────╮ ╭──────────────────────────────────────────────────────╮
      _______, _______, _______, _______, _______, _______,   _______, _______, _______, _______, _______, _______,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
      _______,  KC_GRV,   KC_LT,   KC_GT, KC_MINS, KC_PIPE,    KC_CIRC, KC_LCBR, KC_RCBR,  KC_DLR, KC_RGHT, _______,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
      _______, KC_EXLM, KC_ASTR, KC_SLSH,  KC_EQL, KC_AMPR,    KC_HASH, KC_LPRN, KC_RPRN, KC_SCLN, KC_DQUO, _______,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
      _______, KC_TILD, KC_PLUS, KC_LBRC, KC_RBRC, KC_PERC,      KC_AT, KC_COLN, KC_COMM,  KC_DOT, KC_QUOT, _______,
  // ╰──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────╯
                                  _______, _______, _______,    _______, _______,
                                           _______, _______,    _______
  ),
};
// clang-format on

void matrix_scan_user(void) {
#ifdef FSR_ENABLE
    fsr_scan();
#endif // FSR_ENABLE
}

#ifdef RGB_MATRIX_ENABLE
// Forward-declare this helper function since it is defined in rgb_matrix.c.
void rgb_matrix_update_pwm_buffers(void);
#endif

bool shutdown_user(bool jump_to_bootloader) {
    (void)jump_to_bootloader;
#ifdef RGBLIGHT_ENABLE
    rgblight_enable_noeeprom();
    rgblight_mode_noeeprom(1);
    rgblight_setrgb(RGB_RED);
#endif // RGBLIGHT_ENABLE
#ifdef RGB_MATRIX_ENABLE
    rgb_matrix_set_color_all(RGB_RED);
    rgb_matrix_update_pwm_buffers();
#endif // RGB_MATRIX_ENABLE
    return true;
}

enum ddyo_via_value_id {
    id_ddyo_is_right_half = 0xDD,
};

/* Expose the physical right-half check through QMK/VIA's custom-value hook. */
void via_custom_value_command_kb(uint8_t *data, uint8_t length) {
    if (length < 4) {
        if (length > 0) {
            data[0] = id_unhandled;
        }
        return;
    }

    if (data[0] == id_custom_get_value && data[1] == id_custom_channel && data[2] == id_ddyo_is_right_half) {
        data[3] = is_keyboard_left() ? 0 : 1;
        return;
    }

    data[0] = id_unhandled;
}

/* Both Argos and KeyPeek want via_command_kb; share one handler. */
bool via_command_kb(uint8_t *data, uint8_t length) {
    if (keypeek_handle_command(data, length)) {
        return true;
    }
    return argos_handle_command(data, length);
}
