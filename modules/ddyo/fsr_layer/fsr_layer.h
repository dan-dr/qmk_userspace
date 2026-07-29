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
 *     #define FSR_AUTO_CALIBRATE   // optional: average idle for 10s on boot
 *
 * The FSR sensor is wired to the right half; the module scans and logs only
 * when is_keyboard_left() is false. Set FSR_ON_LEFT_SIDE to 1 if the sensor
 * moves to the left half.
 *
 * Keycodes (always available when the module is linked):
 *     FSR_CAL_IDLE  / FSRCIDL — average idle for FSR_IDLE_CALIBRATE_MS
 *     FSR_CAL_TOUCH / FSRCTCH — sample current reading as touch, set thresholds
 *
 * Logs follow QMK console debug via dprintf (toggle with DB_TOGG).
 *
 * Optional overrides (defaults below):
 *     FSR_PIN, FSR_THRESHOLD, FSR_RELEASE_THRESHOLD, FSR_SCAN_INTERVAL_MS,
 *     FSR_RELEASE_HOLD_MS, FSR_BOOT_CALIBRATE_MS, FSR_IDLE_CALIBRATE_MS,
 *     FSR_CAL_MARGIN, FSR_CAL_HYSTERESIS, FSR_DEBUG_INTERVAL_MS, FSR_ON_LEFT_SIDE
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

/* Keep FSR_LAYER on this long after the sensor crosses release. */
#ifndef FSR_RELEASE_HOLD_MS
#    define FSR_RELEASE_HOLD_MS 200
#endif

#ifndef FSR_DEBUG_INTERVAL_MS
#    define FSR_DEBUG_INTERVAL_MS 100
#endif

#ifndef FSR_BOOT_CALIBRATE_MS
#    define FSR_BOOT_CALIBRATE_MS 10000
#endif

#ifndef FSR_IDLE_CALIBRATE_MS
#    define FSR_IDLE_CALIBRATE_MS 3000
#endif

/* Used when only idle is known (boot auto-cal): press = idle + margin. */
#ifndef FSR_CAL_MARGIN
#    define FSR_CAL_MARGIN 200
#endif

/* Gap between press and release thresholds after touch calibration. */
#ifndef FSR_CAL_HYSTERESIS
#    define FSR_CAL_HYSTERESIS 100
#endif

/* Which physical half the FSR is soldered to. */
#ifndef FSR_ON_LEFT_SIDE
#    define FSR_ON_LEFT_SIDE 0
#endif

#if defined(FSR_ENABLE) && !defined(FSR_LAYER)
#    error "FSR_ENABLE requires FSR_LAYER (e.g. #define FSR_LAYER LAYER_POINTER)"
#endif
