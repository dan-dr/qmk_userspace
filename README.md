# Dan's QMK Userspace

External QMK userspace for Dan's keyboards.

## Keymaps

- `sofle/rev1:danr`
- `bastardkb/charybdis/4x6/splinktegrated_rev1:ddyo`

## Local setup

Clone the module pins, then use the adjacent BastardKB QMK checkout for the
Charybdis definition. The userspace is currently verified against
`bastardkb-qmk` commit `a02692a7887df12ad026b3e1085c1b890a3902ef`.

```nu
git submodule update --init --recursive
$env.QMK_HOME = (realpath ../bastardkb-qmk)
$env.QMK_USERSPACE = (pwd)
qmk userspace-list
qmk compile -kb bastardkb/charybdis/4x6/splinktegrated_rev1 -km ddyo
```

If the adjacent firmware checkout is missing:

```nu
git clone --recurse-submodules https://github.com/Bastardkb/bastardkb-qmk.git ../bastardkb-qmk
git -C ../bastardkb-qmk checkout a02692a7887df12ad026b3e1085c1b890a3902ef
git -C ../bastardkb-qmk submodule update --init --recursive
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

The community modules are pinned as Git submodules:

- `modules/bastardkb`: Dan's `dan-dr/qmk_modules` fork at `f1e65393e9`. Its
  Argos module can disable its built-in `via_command_kb`, allowing the keymap
  to dispatch VIA commands to both Argos and KeyPeek.
- `modules/srwi`: upstream `srwi/qmk-modules` at `8f120e29fe`, unchanged.
  KeyPeek therefore stays directly pinned to upstream.

## KeyPeek

Both keymaps load `srwi/keypeek_layer_notify`. Their generated QMK metadata
files provide KeyPeek with physical layout, matrix dimensions, and USB identity:

- `keyboards/sofle/keymaps/danr/keyboard_info.json`
- `keyboards/bastardkb/charybdis/4x6/keymaps/ddyo/keyboard_info.json`

Regenerate the Sofle metadata after changing the keyboard definition:

```nu
mise exec -- qmk info -kb sofle/rev1 -m -f json
```

KeyPeek still reads the layer count and keycodes from the connected keyboard.

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
