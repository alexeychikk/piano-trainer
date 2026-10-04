#!/usr/bin/env bash
# The shell's simulator smoke (ADR 0005 §9 ticket 3): install a Debug build of
# the app on an iPad simulator and, for each deep route, launch it with
# `-smokeRoute <route>` — `ShellSmoke` (App/ShellSmoke.swift) then loads the
# route, reloads it, and reports each step on stderr as a `SMOKE …` line.
#
# usage: simulator-smoke.sh <path/to/App.app> [screenshot-dir]
# Runs on macOS with Xcode only. A Mac owner can run it locally as it is.
set -euo pipefail

APP="$1"
SHOTS="${2:-}"
BUNDLE_ID=io.github.alexeychikk.pianotrainer
ROUTES=(/settings/ /progress/ /practice/chord-quality/)
# Each step has 30 s inside the app; three steps plus a cold launch.
WAIT_S=150

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

status=0
for route in "${ROUTES[@]}"; do
  log=$(mktemp -t shell-smoke)
  echo "::group::$route"
  xcrun simctl launch --terminate-running-process --stderr="$log" \
    "$UDID" "$BUNDLE_ID" -smokeRoute "$route"

  deadline=$((SECONDS + WAIT_S))
  until grep -qE '^SMOKE (DONE|FAIL)' "$log" || ((SECONDS >= deadline)); do
    sleep 1
  done
  grep '^SMOKE' "$log" || true
  echo "::endgroup::"

  if [[ -n "$SHOTS" ]]; then
    mkdir -p "$SHOTS"
    name=$(echo "$route" | tr '/' '_')
    xcrun simctl io "$UDID" screenshot "$SHOTS/route${name%_}.png" >/dev/null || true
  fi

  if ! grep -q '^SMOKE DONE' "$log"; then
    echo "::error::$route did not load and reload in the shell"
    echo "--- app stderr ---"
    cat "$log"
    status=1
  fi
done

xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
exit $status
