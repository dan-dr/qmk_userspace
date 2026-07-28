// Copyright 2026 ddyo
// SPDX-License-Identifier: GPL-2.0-or-later

#pragma once

#include <stdbool.h>
#include <stdint.h>

#include QMK_KEYBOARD_H

enum ddyo_hebrew_keycodes {
    HE_FINALIZE = SAFE_RANGE,
};

/* Prefix finalize: HE_FINALIZE then a finalizable letter → final form (with timeout). */
bool process_record_hebrew(uint16_t keycode, keyrecord_t *record);
