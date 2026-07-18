# Argos Desktop

The live [Argos](https://argos.bastardkb.com/) configurator in Electron, plus a local append-only history. The Argos session has Chromium's HTTP cache disabled, sends `no-store` on every live-site request, and clears Cache Storage plus service workers on launch. No copy of the Argos frontend is bundled and there is no offline fallback.

When a supported BastardKB keyboard is available, the desktop bridge reuses the
app's narrowly scoped WebHID permission and triggers the live site's own Connect
flow. It also reconnects after unplugging and replugging the keyboard. The live
Connect button remains available if automatic connection cannot complete.

Successful Argos changes are batched, then the same in-memory configuration used
by Argos Export is serialized into history. History sends no additional HID
requests and never blocks interactive keyboard changes. New content is saved as:

- An immutable, Argos-compatible JSON snapshot
- An exact JSON Pointer diff from the prior snapshot
- One append-only `audit.jsonl` record
- `latest.json` for scripts and quick extraction

Open history from the in-app **History** pill or `Cmd+Shift+H`. Any snapshot can be inspected and exported without connecting the keyboard.

## Run

```nu
cd tools/argos-desktop
pnpm install --frozen-lockfile
pnpm start
```

## Verify and package

```nu
pnpm check
pnpm test
pnpm run pack
```

## Install and run on macOS

`/Applications/Argos Desktop.app` is a normal application bundle so Finder,
LaunchServices, Spotlight, and app launchers such as Raycast can discover it.

```nu
pnpm run refresh
```

The refresh command quits the running app, rebuilds `dist/mac-arm64`, syncs the
fresh bundle into Applications, registers it with macOS, and launches it.
`pnpm start` remains the fast source-mode development loop when an Applications
bundle is not needed.

The installed app keeps its local history under Electron's `userData/audit`
directory. **Show files** reveals the exact location.

The current bridge supports Charybdis, Charybdis Nano, and Dilemma v3 3x5. Protocol 3+ snapshots include every per-key and underglow RGB state. Keymaps, combos, tap dances, pointer settings, timing settings, and the optional global VIA RGB values are also captured. Firmware that does not expose the optional global RGB values gets Argos-compatible defaults plus an explicit snapshot warning.
