#!/usr/bin/env bash
# The unsigned IPA the owner sideloads with a free Apple ID (ADR 0006).
#
# Builds the `App` scheme for a real device in Release with code signing
# switched off, checks that the bundle asks for nothing a free Apple ID cannot
# provision, and packages `Payload/App.app` as `piano-trainer.ipa`. Sideloadly
# or AltStore signs it on the owner's machine; nothing here needs a secret.
#
# usage: build-ipa.sh <build-number> <marketing-version|""> <out-dir>
#   build-number       CFBundleVersion — CI passes `github.run_number`.
#   marketing-version  CFBundleShortVersionString (`1.2.3`); empty keeps the
#                      project's MARKETING_VERSION.
#
# Expects `pnpm build` and `pnpm --filter ios sync` to have run (the web
# build and the shim are copied into the bundle by Xcode's resource phase).
# Runs on macOS with Xcode only.
set -euo pipefail

BUILD_NUMBER="${1:?build number required}"
MARKETING_VERSION="${2:-}"
OUT_DIR="${3:?output directory required}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$HERE/../ios/App"
PROJECT="$APP_DIR/App.xcodeproj"
DERIVED="${DERIVED_DATA:-${RUNNER_TEMP:-/tmp}/DerivedData-ipa}"

fail() {
  echo "build-ipa: $*" >&2
  exit 1
}

[[ "$BUILD_NUMBER" =~ ^[1-9][0-9]*$ ]] ||
  fail "build number must be a positive integer, got '$BUILD_NUMBER'"
if [[ -n "$MARKETING_VERSION" && ! "$MARKETING_VERSION" =~ ^[0-9]+(\.[0-9]+){0,2}$ ]]; then
  fail "marketing version must be 1–3 dot-separated integers, got '$MARKETING_VERSION'"
fi

# A free Apple ID provisions only the basic App ID: no push, iCloud, app
# groups, associated domains, … (ADR 0006 §2). The app declares no
# entitlements at all, and this keeps it that way.
if grep -q 'CODE_SIGN_ENTITLEMENTS' "$PROJECT/project.pbxproj"; then
  fail "the App target declares CODE_SIGN_ENTITLEMENTS — a free Apple ID may not be able to sign it (ADR 0006 §2)"
fi
if find "$APP_DIR/App" -name '*.entitlements' | grep -q .; then
  fail "an .entitlements file exists under App/ — see ADR 0006 §2"
fi
[[ -d "$APP_DIR/App/public" ]] ||
  fail "App/App/public is missing — run 'pnpm build && pnpm --filter ios sync' first"

VERSION_ARGS=(CURRENT_PROJECT_VERSION="$BUILD_NUMBER")
if [[ -n "$MARKETING_VERSION" ]]; then
  VERSION_ARGS+=(MARKETING_VERSION="$MARKETING_VERSION")
fi

xcodebuild build \
  -project "$PROJECT" \
  -scheme App \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$DERIVED" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY= \
  "${VERSION_ARGS[@]}"

APP="$DERIVED/Build/Products/Release-iphoneos/App.app"
[[ -d "$APP" ]] || fail "no App.app at $APP"

# Every app extension costs the owner one more App ID out of the free
# account's 10 a week (and would need its own provisioning) — there are none.
if [[ -d "$APP/PlugIns" || -d "$APP/Extensions" || -d "$APP/Watch" ]]; then
  fail "App.app contains extensions — a free Apple ID would need an App ID for each (ADR 0006 §2)"
fi
for f in web-midi-shim.js public/index.html; do
  [[ -f "$APP/$f" ]] || fail "App.app is missing $f"
done

PLIST="$APP/Info.plist"
GOT_BUILD=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$PLIST")
GOT_VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PLIST")
BUNDLE_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PLIST")
[[ "$GOT_BUILD" == "$BUILD_NUMBER" ]] ||
  fail "CFBundleVersion is '$GOT_BUILD', expected '$BUILD_NUMBER'"
if [[ -n "$MARKETING_VERSION" && "$GOT_VERSION" != "$MARKETING_VERSION" ]]; then
  fail "CFBundleShortVersionString is '$GOT_VERSION', expected '$MARKETING_VERSION'"
fi

mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
STAGE="$(mktemp -d)"
mkdir "$STAGE/Payload"
# ditto keeps the bundle's symlinks and permissions, which `cp -R` may not.
ditto "$APP" "$STAGE/Payload/App.app"
rm -f "$OUT_DIR/piano-trainer.ipa"
(cd "$STAGE" && zip -qry "$OUT_DIR/piano-trainer.ipa" Payload)
rm -rf "$STAGE"

echo "piano-trainer.ipa: $BUNDLE_ID $GOT_VERSION ($GOT_BUILD)"
shasum -a 256 "$OUT_DIR/piano-trainer.ipa"
ls -lh "$OUT_DIR/piano-trainer.ipa"
