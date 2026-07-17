#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="Argos Desktop"
BUNDLE_ID="com.ddyo.argos-desktop"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_BUNDLE="$ROOT_DIR/dist/mac-arm64/$APP_NAME.app"
INSTALLED_APP="/Applications/$APP_NAME.app"
APP_BINARY="$APP_BUNDLE/Contents/MacOS/$APP_NAME"

case "$MODE" in
  run|--debug|debug|--logs|logs|--telemetry|telemetry|--verify|verify) ;;
  *)
    echo "usage: $0 [run|--debug|--logs|--telemetry|--verify]" >&2
    exit 2
    ;;
esac

stop_app() {
  /usr/bin/osascript -e "tell application id \"$BUNDLE_ID\" to quit" >/dev/null 2>&1 || true
  for _ in {1..20}; do
    if ! /usr/bin/pgrep -x "$APP_NAME" >/dev/null; then
      return
    fi
    /bin/sleep 0.1
  done
  /usr/bin/pkill -x "$APP_NAME" >/dev/null 2>&1 || true
}

install_app() {
  if [[ -L "$INSTALLED_APP" ]]; then
    echo "$INSTALLED_APP is still a symlink. Move it to Trash before refreshing." >&2
    exit 1
  fi
  /usr/bin/ditto "$APP_BUNDLE" "$INSTALLED_APP"
  "$LSREGISTER" -f "$INSTALLED_APP"
  /usr/bin/mdimport "$INSTALLED_APP" >/dev/null 2>&1 || true
}

open_app() {
  env -u ELECTRON_RUN_AS_NODE /usr/bin/open "$INSTALLED_APP"
}

verify_app() {
  for _ in {1..20}; do
    if /usr/bin/pgrep -x "$APP_NAME" >/dev/null; then
      return
    fi
    /bin/sleep 0.25
  done
  echo "$APP_NAME did not start" >&2
  exit 1
}

stop_app
(
  cd "$ROOT_DIR"
  pnpm run pack
)
install_app

case "$MODE" in
  run)
    open_app
    ;;
  --debug|debug)
    lldb -- "$APP_BINARY"
    ;;
  --logs|logs|--telemetry|telemetry)
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == '$APP_NAME'"
    ;;
  --verify|verify)
    open_app
    verify_app
    ;;
esac
