// Copyright 2026 ddyo
// SPDX-License-Identifier: GPL-2.0-or-later

#include "hebrew.h"

#include "timer.h"

/*
 * EVYA27 (sfb1_direct27_s3106) — all finals are direct; HE_FINALIZE kept as an
 * optional prefix for כ/פ/צ → ך/ף/ץ if preferred over the direct final keys.
 */
#ifndef HE_FINALIZE_TIMEOUT
#    define HE_FINALIZE_TIMEOUT 500
#endif

typedef struct {
    uint16_t medial;
    uint16_t final_form;
} he_finalize_pair_t;

static const he_finalize_pair_t he_finalize_pairs[] = {
    {KC_C, KC_I},    // כ → ך
    {KC_Z, KC_J},    // פ → ף
    {KC_U, KC_Y},    // צ → ץ
};

static bool     he_finalize_armed = false;
static uint16_t he_finalize_timer = 0;

static void he_finalize_arm(void) {
    he_finalize_armed = true;
    he_finalize_timer = timer_read();
}

static void he_finalize_disarm(void) {
    he_finalize_armed = false;
}

static bool he_finalize_is_armed(void) {
    if (!he_finalize_armed) {
        return false;
    }
    if (timer_elapsed(he_finalize_timer) > HE_FINALIZE_TIMEOUT) {
        he_finalize_disarm();
        return false;
    }
    return true;
}

/* If keycode is a finalizable medial, emit its final form and consume the key. */
static bool he_try_emit_final(uint16_t keycode) {
    if (IS_QK_MODS(keycode)) {
        keycode = QK_MODS_GET_BASIC_KEYCODE(keycode);
    }
    for (uint8_t i = 0; i < sizeof(he_finalize_pairs) / sizeof(he_finalize_pairs[0]); i++) {
        if (keycode != he_finalize_pairs[i].medial) {
            continue;
        }
        tap_code(he_finalize_pairs[i].final_form);
        return true;
    }
    return false;
}

bool process_record_hebrew(uint16_t keycode, keyrecord_t *record) {
    if (!record->event.pressed) {
        return true;
    }

    if (keycode == HE_FINALIZE) {
        he_finalize_arm();
        return false;
    }

    if (!he_finalize_is_armed()) {
        return true;
    }

    /* Armed: finalizable letter → final form; anything else → disarm, pass through. */
    he_finalize_disarm();
    if (he_try_emit_final(keycode)) {
        return false;
    }
    return true;
}
