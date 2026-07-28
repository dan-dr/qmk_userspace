// Copyright 2026 ddyo
// SPDX-License-Identifier: GPL-2.0-or-later

#include QMK_KEYBOARD_H

#include "custom.h"
#include "introspection.h" /* bk_pointing_device: DRG_TOG, SNP_TOG */

/* ---- Combos ---- */

/* Pointer: L+M = drag-scroll toggle, M+R = precision toggle. */
const uint16_t PROGMEM drag_toggle_combo[] = {MS_BTN1, MS_BTN3, COMBO_END};
const uint16_t PROGMEM snip_toggle_combo[] = {MS_BTN3, MS_BTN2, COMBO_END};

/*
 * Argos assumes a fixed 16-entry key_combos (ARGOS_COMBO_ENTRIES) and reads all
 * 16 on boot. Defining fewer makes it dereference past the array and hard-fault
 * before enumeration. Pad to 16 with empty entries.
 */
combo_t key_combos[] = {
    COMBO(drag_toggle_combo, DRG_TOG),
    COMBO(snip_toggle_combo, SNP_TOG),
    [2 ... 15] = {0},
};

_Static_assert(sizeof(key_combos) / sizeof(key_combos[0]) == 16, "Argos requires exactly 16 key_combos entries");

/* ---- Tap dances ---- */

typedef enum {
    TD_NONE,
    TD_UNKNOWN,
    TD_SINGLE_TAP,
    TD_SINGLE_HOLD,
} td_state_t;

static td_state_t td_rgui_ralt_state = TD_NONE;

static td_state_t cur_dance(tap_dance_state_t *state) {
    if (state->count == 1) {
        if (state->interrupted || !state->pressed) {
            return TD_SINGLE_TAP;
        }
        return TD_SINGLE_HOLD;
    }
    return TD_UNKNOWN;
}

static void td_rgui_ralt_finished(tap_dance_state_t *state, void *user_data) {
    (void)user_data;
    td_rgui_ralt_state = cur_dance(state);
    switch (td_rgui_ralt_state) {
        case TD_SINGLE_TAP:
            register_code(KC_RGUI);
            break;
        case TD_SINGLE_HOLD:
            register_code(KC_RALT);
            break;
        default:
            break;
    }
}

static void td_rgui_ralt_reset(tap_dance_state_t *state, void *user_data) {
    (void)state;
    (void)user_data;
    switch (td_rgui_ralt_state) {
        case TD_SINGLE_TAP:
            unregister_code(KC_RGUI);
            break;
        case TD_SINGLE_HOLD:
            unregister_code(KC_RALT);
            break;
        default:
            break;
    }
    td_rgui_ralt_state = TD_NONE;
}

tap_dance_action_t tap_dance_actions[] = {
    [TD_RGUI_RALT] = ACTION_TAP_DANCE_FN_ADVANCED(NULL, td_rgui_ralt_finished, td_rgui_ralt_reset),
};
