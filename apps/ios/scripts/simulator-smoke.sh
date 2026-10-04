#!/usr/bin/env bash
# The shell's simulator smoke (ADR 0005 §9 ticket 3): install a Debug build of
# the app on an iPad simulator and, for each deep route, launch it with
# `-smokeRoute <route>` — `ShellSmoke` (App/ShellSmoke.swift) then loads the
# route, reloads it, and reports each step as a `SMOKE …` line in
# `Library/Caches/shell-smoke.log` inside the app's data container.
#
# usage: simulator-smoke.sh <path/to/App.app> [screenshot-dir]
# Runs on macOS with Xcode only. A Mac owner can run it locally as it is.
set -euo pipefail

APP="$1"
SHOTS="${2:-}"
BUNDLE_ID=io.github.alexeychikk.pianotrainer
ROUTES=(/settings/ /progress/ /practice/chord-quality/)
# Inside the app: 90 s for the first page of a cold launch, 30 s per step.
WAIT_S=180
# The app writes `SMOKE start` as soon as Capacitor has loaded; no line by
# then means the smoke never ran, and waiting the full budget proves nothing.
START_S=60

UDID=$(xcrun simctl list devices available -j |
  jq -r '[.devices | to_entries[] | select(.key | test("iOS")) | .value[]
          | select(.name | startswith("iPad"))][0].udid // empty')
if [[ -z "$UDID" ]]; then
  echo "No iPad simulator available" >&2
  xcrun simctl list devices available >&2
  exit 1
fi
echo "Simulator: $(xcrun simctl list devices -j | jq -r --arg u "$UDID" \
  '.devices[][] | select(.udid == $u) | .name') ($UDID)"

xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl install "$UDID" "$APP"
DATA=$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)
SMOKE_LOG="$DATA/Library/Caches/shell-smoke.log"

status=0
for route in "${ROUTES[@]}"; do
  stderr_log=$(mktemp -t shell-smoke)
  rm -f "$SMOKE_LOG"
  echo "::group::$route"
  xcrun simctl launch --terminate-running-process --stderr="$stderr_log" \
    "$UDID" "$BUNDLE_ID" -smokeRoute "$route"

  started=$((SECONDS + START_S))
  deadline=$((SECONDS + WAIT_S))
  until grep -qsE '^SMOKE (DONE|FAIL)' "$SMOKE_LOG" || ((SECONDS >= deadline)); do
    if ((SECONDS >= started)) && ! grep -qs '^SMOKE start' "$SMOKE_LOG"; then
      echo "No SMOKE start after ${START_S} s"
      break
    fi
    sleep 1
  done
  grep -s '^SMOKE' "$SMOKE_LOG" || true
  echo "::endgroup::"

  if [[ -n "$SHOTS" ]]; then
    mkdir -p "$SHOTS"
    name=$(echo "$route" | tr '/' '_')
    xcrun simctl io "$UDID" screenshot "$SHOTS/route${name%_}.png" >/dev/null || true
  fi

  if ! grep -qs '^SMOKE DONE' "$SMOKE_LOG"; then
    echo "::error::$route did not load and reload in the shell"
    echo "--- app stderr ---"
    cat "$stderr_log"
    status=1
  fi
done

xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
exit $status
