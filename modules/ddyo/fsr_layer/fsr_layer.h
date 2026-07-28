// Copyright 2026 ddyo
// SPDX-License-Identifier: GPL-2.0-or-later

#pragma once

/**
 * Force-sensitive resistor as a momentary layer pedal.
 *
 * In keymap.json:
 *     "ddyo/fsr_layer"
 *
 * In config.h:
 *     #define FSR_ENABLE
 *     #define FSR_LAYER LAYER_POINTER
 *
 * Optional overrides (defaults below):
 *     FSR_PIN, FSR_THRESHOLD, FSR_RELEASE_THRESHOLD, FSR_SCAN_INTERVAL_MS
 */

#ifndef FSR_PIN
#    define FSR_PIN GP26
#endif

#ifndef FSR_THRESHOLD
#    define FSR_THRESHOLD 150
#endif

#ifndef FSR_RELEASE_THRESHOLD
#    define FSR_RELEASE_THRESHOLD 80
#endif

#ifndef FSR_SCAN_INTERVAL_MS
#    define FSR_SCAN_INTERVAL_MS 20
#endif

#ifndef FSR_DEBUG_INTERVAL_MS
#    define FSR_DEBUG_INTERVAL_MS 100
#endif

#ifndef FSR_DEBUG_ADC_MAX
#    define FSR_DEBUG_ADC_MAX 4095
#endif

#ifndef FSR_DEBUG_BAR_MIN_RANGE
#    define FSR_DEBUG_BAR_MIN_RANGE 50
#endif

#ifndef FSR_DEBUG_BAR_STEP
#    define FSR_DEBUG_BAR_STEP 50
#endif

#ifndef FSR_DEBUG_BAR_WIDTH
#    define FSR_DEBUG_BAR_WIDTH 40
#endif

#define FSR_IS_PRESS(reading) ((reading) > (FSR_THRESHOLD))
#define FSR_IS_RELEASE(reading) ((reading) < (FSR_RELEASE_THRESHOLD))

#if defined(FSR_ENABLE) && !defined(FSR_LAYER)
#    error "FSR_ENABLE requires FSR_LAYER (e.g. #define FSR_LAYER LAYER_POINTER)"
#endif
