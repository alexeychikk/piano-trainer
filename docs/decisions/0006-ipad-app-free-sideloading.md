# ADR 0006 — The iPad app is installed free: an unsigned IPA from CI, sideloaded with a free Apple ID

- **Status**: Accepted (ticket `f1c56406`, 2026-10-05). Supersedes ADR 0005 §7's TestFlight bullets,
  §8 steps 2–7 and §9 ticket 6 (the signed TestFlight pipeline, ticket `537e78fd`, rejected).
- **Date**: 2026-10-05
- **Context**: the owner will not pay $99/yr for the Apple Developer Program ("the app is only for
  me") and has no Mac — they use Windows. ADR 0005 put the iPad app on TestFlight, which needs the
  paid program. Everything else in ADR 0005 (the Capacitor shell, the shim, the CoreMIDI plugin, the
  origin, in-app export) is unchanged.

## 1. Decision

CI builds an **unsigned** Release IPA on GitHub's macOS runners. The owner signs and installs it on
their own iPad from Windows with a **free Apple ID**, using **Sideloadly** (primary) or
**AltStore / SideStore** (alternative). Signing happens on the owner's machine, so the repository
needs no certificate, no profile and no secret.

Costs, accepted by the owner:

- The install **expires after 7 days** (a free account's provisioning profile) and must be refreshed
  from the PC — re-running Sideloadly over the same app keeps its data.
- A free Apple ID may have **3 sideloaded apps** active on a device at once and register **10 App
  IDs per 7 days**.
- The iPad needs **Developer Mode** on (iPadOS 16+), and the developer profile trusted once.
- Sideloadly and AltStore are third-party tools that sign in to Apple with the owner's Apple ID.
  A separate free Apple ID is a reasonable precaution; the guide says so.

The free fallback that needs no install stays ADR 0005 §2: *Web MIDI Browser* on the live site.

## 2. Entitlements: the app needs none a free account cannot sign

Audited 2026-10-05 against `apps/ios/ios/App`:

| What the app does | What it needs | Free Apple ID? |
| --- | --- | --- |
| CoreMIDI (USB class-compliant pianos, `CoreMidiPlugin`) | nothing — CoreMIDI has no entitlement | yes |
| Sound with the mute switch on (`AVAudioSession .playback`) | nothing — no `UIBackgroundModes` | yes |
| WKWebView, the `capacitor://` scheme, the injected shim | nothing | yes |
| Export through the share sheet (`FileSharePlugin`) | nothing | yes |
| Import through `<input type="file">` (the document picker) | nothing — iCloud Drive is reached through the system picker, not an iCloud capability | yes |

There is **no `.entitlements` file**, no `CODE_SIGN_ENTITLEMENTS` build setting and no app extension,
so the signed app carries only what every free profile grants (`application-identifier`,
`team-identifier`, `get-task-allow`, `keychain-access-groups`). Capacitor's only packages are `Capacitor`
and `Cordova`; no push, iCloud, app groups, associated domains or keychain sharing.

`apps/ios/scripts/build-ipa.sh` **fails the build** if any of that changes: an entitlements file,
`CODE_SIGN_ENTITLEMENTS`, or a `PlugIns`/`Extensions`/`Watch` folder in the bundle (each extension
would also cost one of the 10 weekly App IDs). A future feature that needs a capability must amend
this ADR first. Known future work stays free: Bluetooth MIDI pairing (ADR 0005 §9 ticket 7) needs only
an `NSBluetoothAlwaysUsageDescription` string in `Info.plist`, and bundled samples need nothing.

## 3. The pipeline: `.github/workflows/ios-ipa.yml`

- **Triggers**: `workflow_dispatch` (the IPA is a 30-day workflow artifact), a tag `ios-v*` (the
  same, plus the IPA attached to a GitHub Release of that tag, marked latest), and pull requests
  that touch the native project (build only), so a broken device build is caught before a tag.
- **Steps**: `pnpm build` → `pnpm --filter ios sync` → `build-ipa.sh`, which runs `xcodebuild build`
  for `generic/platform=iOS`, Release, `CODE_SIGNING_ALLOWED=NO`, checks §2 and the bundle's contents,
  and zips `Payload/App.app` as `piano-trainer.ipa` (`ditto` + `zip -y`, so the frameworks' symlinks
  survive).
- **Versions**: `CFBundleVersion` = `github.run_number` (always increases). `CFBundleShortVersionString`
  = the tag's number (`ios-v1.2.0` → `1.2.0`, 1–3 integers, anything else fails), or the project's
  `MARKETING_VERSION` (1.0) on a dispatch. Neither is written back to the project.
- **Secrets**: none. The build job is `contents: read`; only the release job, on a tag, gets
  `contents: write`. Not a required check, for ADR 0005 §7's reason.
- `ios.yml` (simulator build, `swift test`, smoke) is unchanged.

## 4. The app's data and the bundle id

WKWebView storage lives in the app's container, which iOS keys by **bundle id**. So:

- Refreshing (re-installing the same IPA, same tool, same Apple ID) keeps the practice data.
- Deleting the app, or letting a different tool install it, starts empty: **AltStore appends the
  team id to the bundle id**, so an AltStore install is a different app from a Sideloadly install.
- An expired app does not open, but its data stays until it is refreshed.

The guide tells the owner to stay with one tool and to export a backup (Settings → Data → Export JSON) before
switching. `appId` `io.github.alexeychikk.pianotrainer` still never changes (ADR 0005 §3.3).

## 5. Owner steps

All in [`docs/ios-install.md`](../ios-install.md), written for Windows and no Mac: download the IPA
from Releases, install iTunes and iCloud (the apple.com versions, not the Microsoft Store ones) and
Sideloadly, sign in with a free Apple ID, install over USB, turn on Developer Mode, trust the
developer profile, refresh weekly. ADR 0005 §10 is still the on-device checklist — with a sideloaded
build in place of a TestFlight one.

## Consequences

- No yearly fee, no App Store Connect, no secrets in CI.
- The owner refreshes the app every 7 days from the PC (or lets Sideloadly's auto-refresh do it over
  Wi-Fi). TestFlight's 90-day builds are gone.
- Agents cut a build by pushing an `ios-v*` tag (CLAUDE.md). Nobody but the owner can verify the
  install or a piano on a device.
- If the owner ever joins the paid program, ADR 0005 §7's TestFlight plan can come back as a new ADR;
  the IPA job stays useful either way.
