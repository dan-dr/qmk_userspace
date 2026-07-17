# Dan's QMK Userspace

External QMK userspace for Dan's keyboards.

## Keymaps

- `sofle/rev1:ddyo`
- `bastardkb/charybdis/4x6/splinktegrated_rev1:ddyo`

## Charybdis changes

The `ddyo` keymap adapts an older Elite-C Charybdis shield to a Sea-Picro/Splinky RP2040 controller:

- Custom left/right matrix maps use the bottom GP12-GP16 pins, freeing GP26 for the optional FSR and GP21 for trackball CS.
- Handedness on GP27 and USB VBUS detection on GP19.
- The optional GP26 FSR has configurable thresholds, scan timing, and console diagnostics.
- Elite-C pin names map to the RP2040 controller so the old shield wiring still works.

## Modules

Pinned as Git submodules:

- [`bastardkb/argos`](https://github.com/dan-dr/qmk_modules/tree/main/argos), using Dan's fork until its changes are upstream
- [`srwi/keypeek_layer_notify`](https://github.com/srwi/qmk-modules/tree/master/keypeek_layer_notify)

## Flash

```nu
git submodule update --init --recursive
qmk flash -kb sofle/rev1 -km ddyo
qmk flash # guarded Charybdis backup + both halves + restore
```

The Charybdis flash task waits for the normal right/trackball half, saves an
Argos-compatible JSON backup, flashes the right half and then the left half,
then waits for the right half again to restore and verify Argos. A failed backup
aborts before QMK runs, and the task does not finish until restoration succeeds.

```nu
qmk flash            # backup, flash both halves, restore, verify
mise run flash       # alias: mise run qf
mise run flash-right # alias: mise run qfr
mise run flash-left  # alias: mise run qfl
mise run backup      # alias: mise run qb
```

The current backup is kept at `backups/argos/charybdis.json`. Commit it normally;
later backups replace the same file so Git records and merges the changes. Close
Argos and KeyPeek if another app consumes the Raw HID replies during backup.
Use `./bin/flash-charybdis --no-backup` only as an explicit emergency bypass.

Mise prepends a repository guard for `qmk`. In this userspace, `qmk flash` and an
explicit Charybdis `qmk flash -kb ... -km ddyo` both route to the backup-first
wrapper. Normal QMK commands and flashes for other keyboards pass through. The
wrapper applies a scoped bypass only after the Argos export succeeds. It starts
each compile without an input prompt and checks USB/HID state while waiting for
the required half.
