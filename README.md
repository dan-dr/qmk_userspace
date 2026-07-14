# Dan's QMK Userspace

External QMK userspace for Dan's keyboards.

## Keymaps

- `sofle/rev1:danr`
- `bastardkb/charybdis/4x6/splinktegrated_rev1:ddyo`

## Local setup

Use the adjacent BastardKB QMK checkout for the Charybdis definition.

```nu
$env.QMK_HOME = (realpath ../bastardkb-qmk)
$env.QMK_USERSPACE = (pwd)
qmk userspace-list
qmk compile -kb bastardkb/charybdis/4x6/splinktegrated_rev1 -km ddyo
```

## Flash Charybdis

From this userspace repository:

```nu
$env.QMK_HOME = (realpath ../bastardkb-qmk)
$env.QMK_USERSPACE = (pwd)
qmk flash -kb bastardkb/charybdis/4x6/splinktegrated_rev1 -km ddyo
```

For each half:

1. Connect that half directly over USB.
2. Run the command above.
3. Enter the RP2040 bootloader when prompted using `QK_BOOT`, BOOTSEL, or a
   double-tap of reset.
4. Repeat for the other half.

Both halves use the same firmware. The handedness pin identifies the side.
QMK builds the external `ddyo` keymap against the keyboard definition in
`bastardkb-qmk`, then copies the UF2 to the RP2040 bootloader.

The historical `platforms/chibios/converters/elite_c_to_elite_pi` files are
preserved here from `bkb-master-ddyo`. Current QMK redirects that converter to
`elite_c_to_rp2040_ce`, so these copies are retained for history and are not
part of the userspace build.

The BastardKB and KeyPeek community module sources are vendored under
`modules/`. This preserves the exact Argos integration used by the `ddyo`
keymap without depending on an unpublished module commit.

## Source

Extracted from Dan's old `dan-dr/master` QMK fork:

- `b892b28efb add my version`
- `34a980d396 fix mouse wheel in encoder revert swapping of meta/ctrl key`
- `5859a65535 add old keymap`
- `bd1fa5dce5 fix my keymap`
- `c3ee4d08bc add home end to adjust layer`
- `d40d7cff4f some more changes`
- `a7f91eaba7 add marks`

The Charybdis keymap was extracted from `bkb-master-ddyo`:

- `17ecfcbaca merge commit: FSR support, old shield elite-c to sea-picro pin changes`
- `3c6bbc0861 Update custom matrix wiring documentation in config.h for Charybdis keymap`
