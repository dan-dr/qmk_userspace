# Dan's QMK Userspace

External QMK userspace for Dan's keyboards.

## Keymaps

- `sofle/rev1:danr`
- `bastardkb/charybdis/4x6/splinktegrated_rev1:ddyo`

## Charybdis changes

The `ddyo` keymap adapts an older Elite-C Charybdis shield and its bodged wiring
to a Sea-Picro/Splinky RP2040 controller:

- Custom left/right matrix maps use the bottom GP12-GP16 pins, freeing GP26 for the optional FSR and GP21 for trackball CS.
- The adapter provides handedness on GP27 and USB VBUS detection on GP19.
- The optional GP26 FSR has configurable thresholds, scan timing, and console diagnostics.
- Elite-C pin names map to the RP2040 controller so the old shield wiring still works.

## Modules

Pinned as Git submodules:

- [`bastardkb/argos`](https://github.com/dan-dr/qmk_modules/tree/main/argos), using Dan's fork until its changes are upstream
- [`srwi/keypeek_layer_notify`](https://github.com/srwi/qmk-modules/tree/master/keypeek_layer_notify)

## Flash

```nu
git submodule update --init --recursive
qmk flash -kb sofle/rev1 -km danr
qmk flash -kb bastardkb/charybdis/4x6/splinktegrated_rev1 -km ddyo
```

Run the Charybdis command once per half.
