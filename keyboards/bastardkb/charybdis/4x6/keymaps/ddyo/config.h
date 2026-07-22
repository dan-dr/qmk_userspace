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
#pragma once

#ifdef VIA_ENABLE
/* VIA configuration. */
#define DYNAMIC_KEYMAP_LAYER_COUNT 5
#endif // VIA_ENABLE

/* Let the keymap share via_command_kb between Argos and KeyPeek. */
#define KEYPEEK_DISABLE_RAW_HID_HANDLER
#define ARGOS_DISABLE_VIA_COMMAND_KB

/* Tap-hold behavior. */
#define SPECULATIVE_HOLD
#define FLOW_TAP_TERM 150

/* Charybdis-specific features. */

/*
 * Custom matrix wiring (Sea-Picro / Splinky bottom pins GP12–GP16).
 *
 * Stock Charybdis pins used the ADC GPIOs:
 *   rows { GP29, GP26, GP5, GP4, GP9 }
 *   cols { GP27, GP28, GP21, GP6, GP7, GP8 }
 * Those were moved onto GP12–GP16 so GP26 is free for the FSR, and so
 * GP21 can be used as the trackball CS (stock CS was GP16).
 *
 * Left and right maps differ: the trackball half (right) keeps CS on GP21,
 * so col2 lands on GP12 there while the left uses GP16 for col2.
 *
 */
#undef MATRIX_ROW_PINS
#define MATRIX_ROW_PINS \
  {GP15, GP12, GP5, GP4, GP9}

#undef MATRIX_COL_PINS
#define MATRIX_COL_PINS \
  {GP13, GP14, GP16, GP6, GP7, GP8}

#define MATRIX_ROW_PINS_RIGHT \
  {GP13, GP16, GP5, GP4, GP9}

#define MATRIX_COL_PINS_RIGHT \
  {GP15, GP14, GP12, GP6, GP7, GP8}

/* Use the adapter's handedness pin instead of a fixed master side. */
#undef MASTER_RIGHT
#undef SPLIT_HAND_PIN
#define SPLIT_HAND_PIN GP27
#define SPLIT_HAND_PIN_LOW_IS_LEFT

#undef POINTING_DEVICE_CS_PIN
#define POINTING_DEVICE_CS_PIN GP21

/* The pointing-device module owns Auto Mouse state and persistence. */
#ifdef AUTO_MOUSE_DEFAULT_LAYER
#    undef AUTO_MOUSE_DEFAULT_LAYER
#endif
#define AUTO_MOUSE_DEFAULT_LAYER 3
#define AUTO_MOUSE_TIME 1700
#define AUTO_MOUSE_THRESHOLD 10

#undef USB_VBUS_PIN
#define USB_VBUS_PIN GP19

#undef RP2040_BOOTLOADER_DOUBLE_TAP_RESET_TIMEOUT
#define RP2040_BOOTLOADER_DOUBLE_TAP_RESET_TIMEOUT 1000U

// #define EE_HANDS // not working well, also not recommended to connect the non trackball half

#define BOTH_SHIFTS_TURNS_ON_CAPS_WORD
#define DOUBLE_TAP_SHIFT_TURNS_ON_CAPS_WORD

#undef ROTATIONAL_TRANSFORM_ANGLE
#define ROTATIONAL_TRANSFORM_ANGLE -85

// #define FSR_ENABLE
#define FSR_PIN GP26
#define FSR_THRESHOLD 150
#define FSR_RELEASE_THRESHOLD 80
#define FSR_SCAN_INTERVAL_MS 20
#define FSR_DEBUG_INTERVAL_MS 100
#define FSR_DEBUG_ADC_MAX 4095
#define FSR_DEBUG_BAR_MIN_RANGE 50
#define FSR_DEBUG_BAR_STEP 50
#define FSR_DEBUG_BAR_WIDTH 40

#undef ADC_RESOLUTION
#define ADC_RESOLUTION ADC_CFGR1_RES_12BIT

#undef SPLIT_MAX_CONNECTION_ERRORS
#define SPLIT_MAX_CONNECTION_ERRORS 0
