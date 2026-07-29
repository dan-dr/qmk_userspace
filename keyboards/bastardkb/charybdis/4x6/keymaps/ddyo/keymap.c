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

#include "argos.h"
#include "custom.h"
#include "hebrew.h"
#include "keypeek_layer_notify.h"
#include "layers.h"
#include "via.h"

#define NUM MO(LAYER_NUM)
#define NAV_SPC LT(LAYER_NAV, KC_SPC)
#define SY_SCLN LT(LAYER_SYMBOL, KC_SCLN)
#define SY_QUOT LT(LAYER_SYMBOL, KC_QUOT)
#define DF_BASE DF(LAYER_BASE)
#define DF_ANYM DF(LAYER_ANYMAK)
#define DF_HEBR DF(LAYER_HEBREW)

#ifdef POINTING_DEVICE_AUTO_MOUSE_ENABLE
bool is_mouse_record_user(uint16_t keycode, keyrecord_t *record) {
    (void)record;
    switch (keycode) {
        case MS_BTN1:
        case MS_BTN2:
        case MS_BTN3:
        case SNIPING:
        case SNP_TOG:
        case DRGSCRL:
        case DRG_TOG:
            return true;
        default:
            return false;
    }
}
#endif // POINTING_DEVICE_AUTO_MOUSE_ENABLE

bool get_speculative_hold(uint16_t keycode, keyrecord_t *record) {
    (void)record;
    // RGUI speculative hold falsely triggers OS shortcuts (e.g. Start menu).
    return IS_QK_MOD_TAP(keycode) && QK_MOD_TAP_GET_MODS(keycode) != MOD_RGUI;
}

bool process_record_user(uint16_t keycode, keyrecord_t *record) {
    if (!process_record_hebrew(keycode, record)) {
        return false;
    }
    return true;
}

// clang-format off
const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
  /* 0: base — Argos-synced QWERTY
   *  `  1  2  3  4  5  |  6  7  8  9  0  -
   * Esc Q  W  E  R  T  |  Y  U  I  O  P  \
   * Tab A  S  D  F  G  |  H  J  K  L  ;' Sym
   * Sft Z  X  C  V  B  |  N  M  ,  .  /  Sft
   *      Gui SpcFN Alt | RGui/RAlt Ent
   *          Num  Ctl  | Bksp
   */
  [LAYER_BASE] = LAYOUT(
  // ╭──────────────────────────────────────────────────────╮ ╭──────────────────────────────────────────────────────╮
        KC_GRV,    KC_1,    KC_2,    KC_3,    KC_4,    KC_5,       KC_6,    KC_7,    KC_8,    KC_9,    KC_0, KC_MINS,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
        KC_ESC,    KC_Q,    KC_W,    KC_E,    KC_R,    KC_T,       KC_Y,    KC_U,    KC_I,    KC_O,    KC_P, KC_BSLS,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
        KC_TAB,    KC_A,    KC_S,    KC_D,    KC_F,    KC_G,       KC_H,    KC_J,    KC_K,    KC_L, SY_SCLN, SY_QUOT,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       KC_LSFT,    KC_Z,    KC_X,    KC_C,    KC_V,    KC_B,       KC_N,    KC_M, KC_COMM,  KC_DOT, KC_SLSH, KC_RSFT,
  // ╰──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────╯
                                   KC_LGUI, NAV_SPC, KC_LALT, TD(TD_RGUI_RALT), KC_ENT,
                                      NUM, KC_LCTL,     KC_BSPC
  //                            ╰───────────────────────────╯ ╰──────────────────╯
  ),

  /* 1: num — F-row + numpad + media
   * F12 F1 F2 F3 F4 F5 | F6 F7 F8 F9 F10 F11
   *  ·  ·  ·  ·  ·  ·  |  ·  7  8  9  +  ·
   *  · Vol- Mut Vol+ · · |  ·  4  5  6  *  ·
   *  · Prv Play Nxt · · |  ·  0  1  2  3  /
   *                     |  -  =
   */
  [LAYER_NUM] = LAYOUT(
  // ╭──────────────────────────────────────────────────────╮ ╭──────────────────────────────────────────────────────╮
        KC_F12,   KC_F1,   KC_F2,   KC_F3,   KC_F4,   KC_F5,      KC_F6,   KC_F7,   KC_F8,   KC_F9,  KC_F10,  KC_F11,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       _______, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX, XXXXXXX,    XXXXXXX,   KC_P7,   KC_P8,   KC_P9, KC_PPLS, XXXXXXX,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       _______, KC_VOLD, KC_MUTE, KC_VOLU, XXXXXXX, XXXXXXX,    XXXXXXX,   KC_P4,   KC_P5,   KC_P6, KC_PAST, XXXXXXX,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       _______, KC_MPRV, KC_MPLY, KC_MNXT, XXXXXXX, XXXXXXX,    XXXXXXX,   KC_P0,   KC_P1,   KC_P2,   KC_P3, KC_PSLS,
  // ╰──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────╯
                                  _______, _______, _______,    KC_PMNS, KC_PEQL,
                                           _______, _______,    KC_PDOT
  //                            ╰───────────────────────────╯ ╰──────────────────╯
  ),

  /* 2: symbol — Anymak/Spacemak-style (hold ; or ')
   *  ·  ·  ·  ·  ·  ·  |  ·  ·  ·  ·  ·  ·
   *  ·  `  <  >  -  |  |  ^  {  }  $  →  ·
   *  ·  !  *  /  =  &  |  #  (  )  ;  "  ·
   *  ·  ~  +  [  ]  %  |  @  :  ,  .  '  ·
   */
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
  //                            ╰───────────────────────────╯ ╰──────────────────╯
  ),

  /* 3: pointer — Argos-inspired; combos L+M=DRG_TOG, M+R=SNP_TOG
   *                     |              Boot
   *                     |  ·  ·  ·  ·  ·  ·
   *                     |  · B4 · B5 Drag ·
   *                     |  · B1 B3 B2 Snip ·
   */
  [LAYER_POINTER] = LAYOUT(
  // ╭──────────────────────────────────────────────────────╮ ╭──────────────────────────────────────────────────────╮
       _______, _______, _______, _______, _______, _______,    _______, _______, _______, _______, _______, QK_BOOT,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       _______, _______, _______, _______, _______, _______,    _______, _______, _______, _______, _______, _______,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       _______, _______, _______, _______, _______, _______,    _______, MS_BTN4, _______, MS_BTN5, DRG_TOG, _______,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       _______, _______, _______, _______, _______, _______,    _______, MS_BTN1, MS_BTN3, MS_BTN2, SNP_TOG, _______,
  // ╰──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────╯
                                  _______, MS_BTN1, MS_BTN3,    MS_BTN3, MS_BTN1,
                                           _______, MS_BTN2,    MS_BTN2
  //                            ╰───────────────────────────╯ ╰──────────────────╯
  ),

  /* 4: nav — SpaceFN (Getreuer-inspired)
   * Idle Touch Ref CPg↑ CPg↓ · | · · Home ↑ End Find
   * Dbug Alt Ctl Sft Line · |Pg↑ Pg↓ ← ↓ → Bksp
   *  · Gui Pg↑ Pg↓ ·  · |Undo W← W→ App · ·
   *  ·  ·  ·  ·  ·  ·    | ·  ·  · D(EN) A(Any) H(Heb)   ← mode switch (corner)
   *     www← CycloTab   | Lock ·
   */
  [LAYER_NAV] = LAYOUT(
  // ╭──────────────────────────────────────────────────────╮ ╭──────────────────────────────────────────────────────╮
    FSR_CAL_IDLE, FSR_CAL_TOUCH, G(KC_R), C(KC_PGUP), C(KC_PGDN), _______, _______, _______, KC_HOME,   KC_UP,  KC_END, G(KC_F),
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
        DB_TOGG, KC_LALT, KC_LCTL, KC_LSFT, SELLINE, _______,    KC_PGUP, KC_PGDN, KC_LEFT, KC_DOWN, KC_RGHT, KC_BSPC,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       _______, KC_LGUI, KC_PGUP, KC_PGDN, _______, _______,    G(KC_Z), SELWBAK, SELWORD,  KC_APP, _______, _______,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       _______, _______, _______, _______, _______, _______,    _______, _______, _______, DF_BASE, DF_ANYM, DF_HEBR,
  // ╰──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────╯
                                  _______, _______, G(KC_LBRC), G(KC_TAB), QK_LLCK,
                                           _______, _______,    _______
  //                            ╰───────────────────────────╯ ╰──────────────────╯
  ),

  /* 5: anymak — Anymak:END alphas (DF from NAV)
   * Esc Q K O U Y | V D C L F J
   * Tab H A E I , | T R N S ;'
   * Sft Z X C G · | B P M W / Sft
   */
  [LAYER_ANYMAK] = LAYOUT(
  // ╭──────────────────────────────────────────────────────╮ ╭──────────────────────────────────────────────────────╮
        KC_GRV,    KC_1,    KC_2,    KC_3,    KC_4,    KC_5,       KC_6,    KC_7,    KC_8,    KC_9,    KC_0, KC_MINS,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
        KC_ESC,    KC_Q,    KC_K,    KC_O,    KC_U,    KC_Y,       KC_V,    KC_D,    KC_C,    KC_L,    KC_F,    KC_J,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
        KC_TAB,    KC_H,    KC_A,    KC_E,    KC_I, KC_COMM,       KC_T,    KC_R,    KC_N,    KC_S, SY_SCLN, SY_QUOT,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       KC_LSFT,    KC_Z,    KC_X,    KC_C,    KC_G, XXXXXXX,       KC_B,    KC_P,    KC_M,    KC_W, KC_SLSH, KC_RSFT,
  // ╰──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────╯
                                   KC_LGUI, NAV_SPC, KC_LALT, TD(TD_RGUI_RALT), KC_ENT,
                                      NUM, KC_LCTL,     KC_BSPC
  //                            ╰───────────────────────────╯ ╰──────────────────╯
  ),

  /* 6: hebrew — EVYA27 (sfb1_direct27_s3106), all finals direct
   * ד ם ר ש ן | כ ע ך ף ח
   * ב מ ל ת צ | ג א ו י ה
   * ט פ נ ס ז | ץ ק , . /
   * Physical QWERTY positions; host must be macOS "Hebrew - PC".
   * HE_FINALIZE kept on both near-space thumbs as optional prefix.
   */
  [LAYER_HEBREW] = LAYOUT(
  // ╭──────────────────────────────────────────────────────╮ ╭──────────────────────────────────────────────────────╮
        KC_GRV,    KC_1,    KC_2,    KC_3,    KC_4,    KC_5,       KC_6,    KC_7,    KC_8,    KC_9,    KC_0, KC_MINS,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
        KC_ESC,    KC_D,    KC_O,    KC_R,    KC_A,    KC_N,       KC_C,    KC_G,    KC_I,    KC_J,    KC_H, XXXXXXX,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
        KC_TAB,    KC_B,    KC_M,    KC_L,    KC_T,    KC_U,       KC_G,    KC_A,    KC_W,    KC_Y,    KC_H, XXXXXXX,
  // ├──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────┤
       KC_LSFT,    KC_Q,    KC_Z,    KC_X,    KC_S,    KC_V,       KC_Y,    KC_P, KC_COMM,  KC_DOT, KC_SLSH, KC_RSFT,
  // ╰──────────────────────────────────────────────────────┤ ├──────────────────────────────────────────────────────╯
                                   KC_LGUI, NAV_SPC, HE_FINALIZE, HE_FINALIZE, KC_ENT,
                                      NUM, KC_LCTL,     KC_BSPC
  //                            ╰───────────────────────────╯ ╰──────────────────╯
  ),
};
// clang-format on

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
