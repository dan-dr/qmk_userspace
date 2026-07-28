// Copyright 2026 ddyo
// SPDX-License-Identifier: GPL-2.0-or-later

#pragma once

/*
 * config.h includes this, and config.h is also included from ChibiOS startup
 * assembly. Under __ASSEMBLER__ we emit plain #defines; under C, the enum.
 * Both produce the same LAYER_* names, so by-name references work everywhere.
 */

#define LAYER_BASE    0
#define LAYER_NUM     1
#define LAYER_SYMBOL  2
#define LAYER_POINTER 3
#define LAYER_NAV     4
#define LAYER_ANYMAK  5
#define LAYER_HEBREW  6

#ifndef __ASSEMBLER__
_Static_assert(LAYER_POINTER == 3, "AUTO_MOUSE/FSR assume pointer == 3");
#endif
