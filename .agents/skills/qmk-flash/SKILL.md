---
name: qmk-flash
description: Flash QMK firmware from this userspace repository. Use whenever the user asks to flash, reflash, install, or deploy firmware to a keyboard or either half of a split keyboard. Infer the keyboard, keymap, and half scope from recent context before asking, use the structured question tool for unresolved choices when available, flash the master half first or the right half when the master cannot be determined, announce bootloader waits, and remain attached until every required half succeeds or fails.
---

# QMK Flash

Flash a selected userspace target while keeping the user informed during physical reset and bootloader steps.

## Guardrails

- Treat a flash request as explicit authorization to build and flash only the selected keyboard and keymap.
- Do not flash from an existing firmware artifact unless the user explicitly requests that artifact.
- Run from the repository root.
- Use the repository environment through `mise exec --` so `QMK_HOME` and `QMK_USERSPACE` match `mise.toml`.
- Before flashing, report the resolved keyboard, keymap, bootloader, and whether it is split.
- Keep the flash process attached. Do not claim success from compilation alone.

## Infer the target and scope

1. Read `qmk.json` and run `mise exec -- qmk userspace-list` to discover configured keyboard and keymap pairs.
2. Inspect the current request and recent conversation before asking anything. Resolve from the strongest available context, in this order:
   - An explicit keyboard, keymap, or half in the current request
   - The keyboard and keymap currently being edited, debugged, built, or discussed
   - The most recent successful build or flash target in the active task
   - An unambiguous configured target or firmware artifact name
3. Match friendly names and unambiguous suffixes to the canonical keyboard path.
4. Collect all available keymaps for the inferred keyboard:

   ```sh
   mise exec -- qmk list-keymaps -kb <keyboard>
   ```

   Use `qmk.json` as a fallback and to identify which choices are configured userspace targets.
5. Infer the keymap from context even when multiple keymaps exist. If context does not identify one, select it automatically only when exactly one keymap exists.
6. Resolve split scope from context:
   - Flash one named half when the user says left, right, this half, one side, or otherwise clearly narrows scope.
   - Interpret `the other half` relative to the most recently flashed half.
   - Flash both halves for a general flash request when the selected keyboard is split and context does not narrow scope.
7. Determine split flash order from the effective keyboard and keymap configuration:
   - Inspect the selected keymap config first, then its keyboard and parent configs. Honor `#undef` overrides instead of trusting the first definition found.
   - Treat an effective `MASTER_RIGHT` or explicit repository documentation naming the right side as master as right-first.
   - Treat an effective `MASTER_LEFT` or explicit repository documentation naming the left side as master as left-first.
   - Do not treat `SPLIT_HAND_PIN`, `SPLIT_HAND_MATRIX_GRID`, `EE_HANDS`, or `SPLIT_USB_DETECT` alone as proof of a fixed master. They can determine handedness or USB presence without selecting a permanent master half.
   - If no fixed master can be determined confidently, flash the right half first.
8. Ask only for unresolved or genuinely ambiguous fields. Prefer the `request_user_input` question tool when it is available:
   - Ask up to three compact questions for keyboard, keymap, and half scope.
   - Show discovered choices and put the strongest contextual inference first as the recommended option.
   - If the question tool is unavailable, ask the same concise question directly.
   - Do not ask the user to reconfirm a confident contextual inference.
9. Inspect current metadata:

   ```sh
   mise exec -- qmk info -kb <keyboard> -f json
   ```

   Read `.bootloader` and `.split.enabled`. Treat the keyboard as split only when `.split.enabled` is `true`. Confirm the canonical keyboard, keymap, bootloader, split status, inferred half scope, first half, and why that half has priority in the preflight report.

## Flash interactively

Run the exact target in a PTY:

```sh
mise exec -- qmk flash -kb <keyboard> -km <keymap>
```

Use a short initial yield. Stream or poll the same process frequently enough to recognize the bootloader wait. Do not start a replacement command while the original is waiting.

When output says it is waiting for a reset, bootloader, serial port, drive, or device:

1. Immediately tell the user that compilation finished and QMK is waiting for the keyboard bootloader.
2. Include the current half for split keyboards.
3. Give only bootloader instructions supported by repository docs or the detected bootloader. Prefer repository-specific instructions over generic advice.
4. Continue polling the same process while the user performs the physical action. An unchanged wait is normal, not a blocker.
5. Report success only after the flash command exits successfully. On failure, quote the decisive error and stop before flashing another half unless retrying the same safe step is clearly appropriate.

## Split keyboards

Flash split keyboards twice because each half has its own controller.

1. Ask the user to connect the determined master half directly over USB. If no master was determined, ask for the right half. Start the first `qmk flash` command.
2. Announce that half's bootloader wait and remain attached until the command succeeds.
3. Tell the user the first half succeeded and ask them to connect the remaining half directly over USB.
4. Start a new, identical `qmk flash` command for the remaining half.
5. Announce the remaining half's bootloader wait and remain attached until it succeeds.
6. Report separate outcomes for both halves in the order flashed.

If context resolves to one half, flash only that half and state the scope. Never run the two commands concurrently.

## Repository-specific reset guidance

- `rp2040`: use `QK_BOOT`, hold BOOTSEL while connecting USB, or use the documented double-tap reset method.
- `caterina`: press reset when QMK begins waiting for the bootloader serial port.

Do not tell the user to reset early. Wait until the running command is ready unless its output explicitly instructs otherwise.

## Completion report

Report:

- Canonical keyboard and keymap
- One outcome per flashed half
- Flash command exit status
- Any half not flashed or any remaining physical action
