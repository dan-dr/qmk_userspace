# Dan's QMK Userspace

External QMK userspace for Dan's keyboards.

## Keymaps

- `sofle/rev1:danr`
- `bastardkb/charybdis/4x6/splinktegrated_rev1:ddyo`

The Charybdis keymap and legacy ChibiOS converter retain their history from
[`bkb-master-ddyo`](https://github.com/dan-dr/qmk_firmware/tree/bkb-master-ddyo).

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
