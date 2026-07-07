# Dan's QMK Userspace

External QMK userspace for Dan's Sofle keymap.

## Keymaps

- `sofle/rev1:danr`

## Local setup

Use an upstream QMK firmware checkout with External Userspace support.

```nu
$env.QMK_HOME = (realpath ../qmk_firmware)
$env.QMK_USERSPACE = (pwd)
qmk userspace-list
qmk compile -kb sofle/rev1 -km danr
```

## Source

Extracted from Dan's old `dan-dr/master` QMK fork:

- `b892b28efb add my version`
- `34a980d396 fix mouse wheel in encoder revert swapping of meta/ctrl key`
- `5859a65535 add old keymap`
- `bd1fa5dce5 fix my keymap`
- `c3ee4d08bc add home end to adjust layer`
- `d40d7cff4f some more changes`
- `a7f91eaba7 add marks`
