# ADR 0005 — MIDI on iPad: a Capacitor shell with a CoreMIDI-backed Web MIDI shim

- **Status**: Accepted (ticket `60ec9cd2`, 2026-10-03). §9 tickets 1–4 implemented; 5–7 open.
- **Date**: 2026-10-03
- **Context**: owner report, 2026-10-03: MIDI does not work in Chrome on their iPad Pro. Adds a
  second deployment target beside GitHub Pages (ADR 0001 §1). It amends nothing in ADR 0001–0004:
  the website, `$lib/midi`, the exercise contract, storage and the schema version are all
  unchanged.

## Problem

On iOS and iPadOS, **every browser is WebKit**. Chrome, Edge and Firefox there are Safari's engine
in a different frame (App Store rule 2.5.6), and WebKit does not implement Web MIDI. Apple lists it
among the device APIs it declines over fingerprinting, and in October 2026 it has no roadmap entry
(Safari 26.x and the Safari 27 beta do not mention it). So on an iPad,
`'requestMIDIAccess' in navigator` is `false`, `midiInput.status` is `unsupported`, and the app
falls back to the on-screen keyboard. Our own copy then gets it wrong as well:
`MIDI_COPY.unsupported` advises Chrome, which on an iPad is the same WebKit.

The EU's alternative-engine rules (BrowserEngineKit) do not help. No Blink-based Chrome has shipped
on iOS, they apply only in the EU, and we cannot plan around one owner's region.

**What does work on an iPad is CoreMIDI.** A native app gets USB-C class-compliant pianos with no
permission prompt, plus Bluetooth MIDI. The question is how to get those notes into our web code
while reusing it.

## 1. Options considered

| Option | Reuses `apps/web` | Native code we own | Cost to owner | Verdict |
| --- | --- | --- | --- | --- |
| **A. Capacitor shell + our own CoreMIDI plugin + a Web MIDI shim** | All of it, unchanged | ~300 lines Swift + ~200 lines TS | $99/yr Apple Developer, ~1 h setup | **Chosen** |
| B. Third-party "Web MIDI browser" apps | All of it, unchanged | none | none | **Do it today**, as a stop-gap (§2) |
| C. Hand-written WKWebView shell, no Capacitor | All of it | + scheme handler, MIME types, process-crash reload, safe areas | same as A | Rejected: Capacitor already maintains this |
| D. Existing Capacitor/Cordova MIDI plugins | All of it | adapter only | same as A | Rejected (§3.2) |
| E. Tauri v2 mobile | All of it | Rust toolchain + still a Swift plugin for CoreMIDI | same as A | Rejected: same WKWebView, more toolchain |
| F. React Native + `react-native-webview` | All of it, in a WebView | RN app + native MIDI module | same as A | Rejected: a second JS app to host the first |
| G. Rewrite natively (Swift/Flutter/RN UI) | none | everything | same as A | Rejected: throws away the product |
| H. PWA / "Add to Home Screen" | All of it | none | none | Does not work: still WebKit, still no Web MIDI |
| I. "Electron for iOS" | — | — | — | Does not exist. On iOS, Capacitor fills Electron's role, with WebKit instead of Chromium. |

## 2. Today's stop-gap: Web MIDI Browser (zero code)

**Web MIDI Browser** (Takashi Mizuhiki, free, App Store id 953846217, last update 1.0.6 in Feb
2024) is a WKWebView with a document-start `WKUserScript` that defines `navigator.requestMIDIAccess`
over CoreMIDI. It is open source as `mizuhiki/WebMIDIAPIShimForiOS` (Apache-2.0; the repo's last
commit is 2018). We read its shim against `input.svelte.ts`, and **our code should work there as it
is**:

- **Feature detection**: `supported` is a getter evaluated at call time, and the shim is installed
  at document start, so it is `true`.
- **`requestMIDIAccess({ sysex: false })`** returns the shim's own thenable, not a real `Promise`.
  `await` accepts a thenable. We never ask for sysex.
- **The members we use all exist**: `access.inputs.forEach`, `access.onstatechange`,
  `port.state` / `.name` / `.manufacturer` / `.id`, and an `onmidimessage` setter.
  `event.data` is a plain number array, which `parseMidiMessage` accepts
  (`Uint8Array | readonly number[]`).
- **Secure context**: the site is served over `https` from GitHub Pages.
- **`autoConnect()` does not reconnect**: WebKit's `navigator.permissions.query({ name: 'midi' })`
  rejects, so the store stays `idle`. The user taps **Connect MIDI** once per launch, which is
  exactly the "no definite grant" branch.
- **Storage**: progress there lives in that app's own WebKit store. It is not Safari's or Chrome's.

Caveats, stated honestly. The app is unmaintained. Forum reports call it flaky with some devices,
and nobody on the team can run it (we have no iPad). The owner's test is the verification. A newer
alternative, **MIDIWeb Browser** (id 6757226617), was mentioned in 2026 and is untested. Either way,
these are a workaround for this week, not the plan. We cannot fix bugs in someone else's app, and it
gives none of §5's audio fixes.

## 3. The decision: Capacitor 8 shell in `apps/ios`

### 3.1 Shape

```
apps/ios/                      new pnpm workspace package "ios" (apps/* already globbed)
  package.json                 @capacitor/core, @capacitor/ios, @capacitor/cli; scripts: build:shim, test, sync
  capacitor.config.ts          appId, appName "Piano Trainer", webDir: "../web/build"
  src/web-midi-shim.ts         the shim (§4), bundled to one IIFE: dist/web-midi-shim.js
  src/web-midi-shim.test.ts    Vitest against a fake plugin, no device
  ios/App/                     generated by `cap add ios` (Swift Package Manager template, no CocoaPods), committed
    App/AppViewController.swift   CAPBridgeViewController subclass (§3.3)
    App/CoreMidiPlugin.swift      the local plugin (§4.2)
    App/AppDelegate.swift         AVAudioSession .playback (§5)
```

- **One web build for both targets.** The default `pnpm build` (no `BASE_PATH`) is what the shell
  ships, and Pages keeps its own `BASE_PATH` build. **`apps/web` never imports `@capacitor/*` and
  never asks whether it is in the app**: it sees Web MIDI or no Web MIDI, as in any browser.
- **The plugin is local** (a class in the app target, registered with
  `bridge?.registerPluginInstance` in `capacitorDidLoad()`), not an npm package. That sidesteps
  Capacitor's package-scanning trap: an npm plugin missing from the app's own dependencies builds
  fine and is silently absent at runtime.

### 3.2 Why our own plugin rather than an existing one

We checked in October 2026:

- `@midiative/capacitor-midi-device` (successor of the archived `capacitor-midi`) has its own API
  and delivers messages with no source port id.
- `capacitor-musetrainer-midi` 0.2.3 has had no release for about three years.
- `capacitor-midi` 0.0.12 is archived and says "no iOS support".
- `recifra/cordova-plugin-webmidi` is a Cordova port of Mizuhiki's 2018 shim.

None is a maintained Web MIDI polyfill, and each would still need an adapter to look like Web MIDI.
The CoreMIDI surface we need is small: list the sources, watch for hot-plug, receive channel-voice
bytes. Owning ~300 lines of Swift is cheaper than depending on an abandoned package that sits
between the user's piano and every grade.

### 3.3 `AppViewController` (CAPBridgeViewController subclass)

1. **`capacitorDidLoad()`**: register `CoreMidiPlugin`. Then add `dist/web-midi-shim.js`, copied
   into the bundle, as a `WKUserScript` at `.atDocumentStart`, main frame only. It is added after
   Capacitor's own bridge scripts, so `window.Capacitor` already exists when it runs.
2. **`router()`** returns a **`StaticSiteRouter`**. This is needed, not polish. Capacitor's default
   `CapacitorRouter` maps every path without an extension to the root `/index.html`. Our routes are
   prerendered as `/practice/foo/index.html` (`trailingSlash: 'always'`). In-app navigation is
   client-side and never asks the scheme handler. But when iOS kills the WebContent process
   (memory pressure, long backgrounding), Capacitor calls `webView.reload()` on the current URL, and
   the user would then get **home's HTML hydrated at `/practice/foo/`**. The router must mirror
   Pages instead:
   - `/x/y/` maps to `/x/y/index.html` if that file exists;
   - a path with an extension is served as is;
   - anything else falls back to `/404.html`, our SPA fallback.

   The router is pure path logic, so it gets an XCTest.
3. The origin stays Capacitor's default `capacitor://localhost`. It is a secure context, and it
   must **never change after the first TestFlight build**: the origin is the storage key (§6).

## 4. The Web MIDI shim: CoreMIDI behind `navigator.requestMIDIAccess`

**`$lib/midi` does not change by a line.** Native MIDI reaches the app only as Web MIDI, so the
input store, device memory (`${manufacturer}:${name}`), chord capture (ADR 0004) and every test
stay valid. Their behaviour is Chrome's, and the shim copies Chrome's behaviour.

### 4.1 JS side: `apps/ios/src/web-midi-shim.ts`

The shim installs only if all three hold: `window.Capacitor?.isNativePlatform?.()` is true, the
plugin is registered, and `!('requestMIDIAccess' in navigator)`. Otherwise it does nothing, so a
future WebKit with real Web MIDI wins automatically. It talks to the plugin through
`registerPlugin('CoreMidi')` from `@capacitor/core`, bundled into the IIFE.

- **`navigator.requestMIDIAccess(options?)`** returns a real `Promise<MIDIAccess>`. It is a
  singleton: the second call returns the same access.
  - `sysex: true` rejects with a `DOMException` named `NotSupportedError`. We never need sysex.
  - It needs no user gesture: CoreMIDI asks for no permission.
- **`MIDIAccess`** extends `EventTarget`:
  - `inputs` is a live `Map<string, MIDIInput>`, mutated in place.
  - `outputs` is an empty `Map`.
  - `sysexEnabled` is `false`.
  - `onstatechange` is settable and also fires through `addEventListener('statechange')`.
- **`MIDIInput`** extends `EventTarget`:
  - fields: `id` (CoreMIDI `kMIDIPropertyUniqueID`, as a string), `name`
    (`kMIDIPropertyDisplayName`), `manufacturer` (empty string when CoreMIDI has none), `type:
    'input'`, `version: ''`, `state`, `connection`;
  - an `onmidimessage` setter;
  - it dispatches an `Event('midimessage')` carrying `data: Uint8Array` (exactly one message) and
    `timeStamp`.
- **A removed source stays in `inputs` with `state: 'disconnected'`**, which is Chrome's behaviour
  and the branch `#refreshDevices()` already handles. When the same unique id returns, the same
  object goes back to `connected`.
- **`navigator.permissions.query`** is wrapped so that `{ name: 'midi' }` resolves
  `{ state: 'granted' }`. Every other name goes to the original. This is honest, since CoreMIDI has
  no permission, and it lets `autoConnect()` reconnect the piano on launch with no tap. That is the
  one behaviour the app gets that Web MIDI Browser cannot give.

### 4.2 Native side: `CoreMidiPlugin.swift`

| Call / event | Contract |
| --- | --- |
| `start()` → `{ sources: Source[] }` | Creates one `MIDIClient` and one input port. Uses `MIDIInputPortCreateWithProtocol(._1_0)`, not the deprecated packet-list API. Connects every source with its unique id as `srcConnRefCon`, so each message knows its port. Idempotent. |
| `Source` | `{ id: string, name: string, manufacturer: string }` |
| event `sourcesChanged` → `{ sources: Source[] }` | From the client's notify block (`msgObjectAdded`/`msgObjectRemoved`/`msgSetupChanged`). Connects new sources. |
| event `messages` → `{ id: string, data: number[][] }` | One bridge call per event list, not per message. Only **channel-voice** messages are bridged (UMP type 0x2, as 2–3 MIDI 1.0 bytes). System realtime (`0xF8` clock, `0xFE` active sensing — many digital pianos send it every 300 ms) and sysex are dropped natively, so the bridge stays quiet while nobody plays. |

**Timing**: `$lib/midi` stamps a note with `performance.now()` when JS receives it, as it does in
Chrome. The bridge adds a few milliseconds, which is fine for ear training and for chord capture's
90 ms settle window.

**Bluetooth MIDI**: a BLE piano already connected (for example from GarageBand) is just another
source and works. A pairing button (`CABTMIDICentralViewController` +
`NSBluetoothAlwaysUsageDescription`) is UI, so it waits for a design ticket (§9, ticket 7). USB-C is
the iPad Pro's natural cable anyway.

## 5. Audio inside WKWebView

The engine needs no rewrite. These are the facts and their fixes:

- **The `AudioContext` starts on a gesture**, as in Safari. Our capture-phase starter in
  `+layout.svelte` already handles it. Capacitor sets `mediaTypesRequiringUserActionForPlayback =
  []`, which only makes the gesture rule easier.
- **Silent Mode mutes Web Audio.** By default, WebKit plays Web Audio in an ambient-like session.
  iPadOS's Control Center *Silent Mode* (iPhones: the ring switch) mutes it. An ear trainer that goes
  silent is broken, not quiet.
  - **App**: `AppDelegate` sets `AVAudioSession.sharedInstance().setCategory(.playback)` at launch.
  - **Website**: `navigator.audioSession.type = 'playback'` (Safari/iPadOS 17+) is set where it
    exists, in `ensureStarted()`. It is the same fix for Safari users, needs no native code, and is
    harmless elsewhere.
- **`interrupted` is a WebKit `AudioContext` state** (a call, Siri, backgrounding). The engine
  resumes only `suspended` today. It must treat `interrupted` the same way and retry `resume()` on
  `visibilitychange → visible` and on the next gesture. Otherwise the app comes back mute after a
  FaceTime call.
- **Samples come from the network.** `smplr` fetches MusyngKite from GitHub Pages, which answers
  `Access-Control-Allow-Origin: *`, so the `capacitor://localhost` origin can fetch them. Offline,
  the synth fallback plays, exactly as on the web.
  - **App code and assets** are bundled and load offline. Only the samples need a network.
  - Bundling the default piano's samples is optional and possible later. It is not part of this ADR.
- **Latency** is WebKit's, the same as Safari's. The user's own piano sounds through its speaker
  anyway; ours plays the prompts.

## 6. Saved progress: the app is a different origin

- The app's IndexedDB and `localStorage` belong to `capacitor://localhost` inside the app's
  container. They are **not** the website's (`https://alexeychikk.github.io`), not Safari's, and not
  Web MIDI Browser's. **Nothing syncs, by design**: there is no backend (ADR 0001).
- **The bridge is slice 5b's backup file**, unchanged: Export on one, Import on the other. Import
  replaces in one transaction and refuses newer schemas, so the file format is already the contract.
- The data survives app updates and is deleted with the app. WebKit can still evict website data
  under storage pressure, and nothing in WKWebView promises permanence. So the existing
  `lastExportAt` nudge is the backup story there too. We add no native storage layer.
- **Export must be verified in the shell.** `download.ts` clicks a `Blob` anchor. WKWebView ignores
  download navigations unless the host implements `WKDownloadDelegate`, and Capacitor 8 does not.
  The fix belongs to the shell, not to `apps/web`: `AppViewController` handles `blob:` downloads by
  writing the file to a temporary URL and presenting the share sheet (Save to Files, AirDrop).
  Import uses `<input type="file">`, which WKWebView already turns into the document picker.
  - *Amended by §9 ticket 5 (as built):* the handover happens **in the shim, not in a native
    download delegate**. `apps/ios/src/file-share.ts` (in the same injected bundle as the Web MIDI
    shim) wraps `URL.createObjectURL` to remember each blob, cancels any `<a download>` click on a
    `blob:`/`data:` URL in a window capture listener, and passes `{ filename, text, mimeType,
    anchor }` to a local `FileShare` plugin (`FileSharePlugin.swift`), which writes
    `tmp/share-<uuid>/<name>` and presents `UIActivityViewController` (popover anchored on the
    focused Export button on iPad). Why: Capacitor's bridge owns the navigation delegate, and a
    `blob:` URL is revoked right after the click, so a native download path would be fragile and
    testable only on a device; the shim path is tested through the fake bridge (Vitest + e2e),
    keeps native code to glue (CLAUDE.md), and `apps/web` is unchanged. The simulator smoke
    presses Export on `/settings/` and checks the sheet is up with a parseable backup.

## 7. What it costs, honestly

- **A Mac is needed to build, but the owner does not need one.** Our sandboxes are Linux, so **no
  agent can compile Swift or run Xcode locally**: every native compile is a CI round-trip. CI runs
  on GitHub's macOS runners, which are **free for public repositories** (this one is public).
  - `ios.yml` builds the app for the simulator, unsigned, on pull requests that touch `apps/ios/**`.
    It is **not** a required check, because a path-filtered required check blocks every PR that
    skips it.
  - On `workflow_dispatch` and on pushes to `master` that touch `apps/web/**` or `apps/ios/**`, it
    archives, signs and uploads to TestFlight. Signing is cloud-managed, through an App Store
    Connect API key: `xcodebuild -allowProvisioningUpdates -authenticationKey*`, with
    `ExportOptions.plist` `method: app-store-connect`, `destination: upload`. No fastlane, and no
    certificate files in the repository.
  - The build number is `github.run_number`. `ITSAppUsesNonExemptEncryption = NO` goes in
    `Info.plist`, so uploads need no compliance answer.
- **The Apple Developer Program costs $99/yr**, in the owner's name. Nobody else can hold it.
  - **TestFlight internal testing is the distribution channel**: up to 100 people on the owner's
    team, with **no App Review** for internal builds.
  - Each build expires after **90 days**. CI uploads a fresh one whenever the app changes, and a
    manual dispatch renews it.
  - **The public App Store is out of scope.** Guideline 4.2 (minimum functionality) is a real
    rejection risk for a wrapped website, even with native MIDI. If the owner wants a store listing
    later, it gets its own ticket.
- **Free fallback, if the owner has a Mac**: Xcode with a free Apple ID can install the app directly
  on the iPad. The install expires after 7 days and must be redone from the Mac. That is fine for a
  test, not for daily practice.
- **Nobody on the team can test on a device.** Our tests are:
  - the shim against a fake plugin (Vitest);
  - the web app driven through the shim by a fake `window.Capacitor` (Playwright, real Chromium,
    §9 ticket 2), which proves the whole web side;
  - the router and the CoreMIDI parsing (XCTest on the simulator in CI).

  The last step, a piano on an iPad, is the owner's.

## 8. Owner-only steps

1. **Today, free**: install *Web MIDI Browser* on the iPad, open
   `https://alexeychikk.github.io/piano-trainer/`, tap **Connect MIDI** and report whether notes
   arrive. Try *MIDIWeb Browser* too if the first fails.
2. Enroll in the **Apple Developer Program** (individual, $99/yr, an Apple ID with 2FA). Approval can
   take up to 48 h.
3. Create the app's record. App Store Connect's API cannot create apps, so the owner does it by hand:
   - in Certificates, Identifiers & Profiles, register the bundle id
     `io.github.alexeychikk.pianotrainer` (or another, but tell the team before the first build;
     it never changes afterwards);
   - in App Store Connect, add the app (name, that bundle id, any SKU).
4. In App Store Connect, under Users and Access → Integrations, create a **Team API key with the
   Admin role**. Cloud-managed distribution signing needs Admin. Download the `.p8` (it can only be
   downloaded once).
5. Add four repository secrets yourself (GitHub → Settings → Secrets and variables → Actions):
   - `ASC_KEY_ID`
   - `ASC_ISSUER_ID`
   - `ASC_KEY_P8_BASE64` (`base64 -i AuthKey_XXXX.p8`)
   - `APPLE_TEAM_ID`

   **Never paste them into a ticket or chat.**
6. Install **TestFlight** on the iPad, add yourself to an internal testing group, and install each
   build. Report what the piano does. Export progress from the website and import it in the app if
   you want your history there.
7. Renew the membership yearly. If it lapses, TestFlight builds stop working.

## 9. Build order (developer tickets)

Every ticket is one run. Tickets 1 and 2 need no Apple account and no Mac. Tickets 3–5 need macOS
CI only. Ticket 6 is blocked on §8 steps 2–5.

1. **Web: iPad hardening, no native code.**
   - `ensureStarted()` sets `navigator.audioSession.type = 'playback'` where it exists.
   - The engine resumes an `interrupted` context, as it does a `suspended` one, on
     `visibilitychange → visible` and on the next gesture.
   - Fix `MIDI_COPY.unsupported`: it must not send iPad users to Chrome. The new wording goes in
     `midi/status.ts` and needs Product's OK. Suggested: "This browser has no Web MIDI. On iPad, no
     browser has it — use the Piano Trainer app, or play on-screen."
   - Unit tests with the fake context.
2. **`apps/ios` package + the Web MIDI shim (§4.1), TS only.**
   - Workspace package, Vitest suite against a fake plugin, `build:shim` to an IIFE.
   - Root `test`/`lint` cover the package.
   - A Playwright spec in `apps/web/e2e/` injects the built shim plus a fake `window.Capacitor`
     bridge with `addInitScript`, and proves: `autoConnect()` connects with no tap, notes reach
     Free Play's readout, a chord drill grades a MIDI chord (ADR 0004 path), and hot-unplug shows
     the device-lost banner.
3. **Capacitor iOS shell + simulator CI.**
   - `cap add ios` (SPM) and `capacitor.config.ts`.
   - `AppViewController` with `StaticSiteRouter` (+ XCTest) and the shim injected (§3.3).
   - `AVAudioSession .playback`, iPad orientations, `ITSAppUsesNonExemptEncryption = NO`.
   - `ios.yml`: web build, `cap sync`, unsigned simulator build and tests on `macos-latest`.
   - With no plugin yet, the shim stays out of the way and the app shows the on-screen fallback.
4. **CoreMIDI plugin (§4.2).** *Landed.*
   - Sources, hot-plug, channel-voice-only batched messages.
   - XCTest for UMP→bytes conversion and realtime filtering, in CI.
   - As built: `App/CoreMidiPlugin.swift` is glue; the pure parts are in ShellKit and run under
     `swift test` — `UniversalPackets` (UMP words → MIDI 1.0 bytes; a multi-word packet is
     skipped whole by its declared size, so sysex payload is never misread as a note),
     `SourceConnections` (which endpoints to connect on a setup change: a source that left is
     forgotten, so the same piano plugged back in is connected again) and `BridgedMidiSource`
     (the shim's `{ id, name, manufacturer }`). All plugin state and every `notifyListeners`
     run on the main queue; `sourcesChanged` fires only when the list actually changed.
     Offline endpoints are not listed. The simulator smoke's `midi` step calls
     `requestMIDIAccess()` in the real shell, so CI proves the plugin is registered, the shim
     installed and `start()` round-trips — everything but a piano (§10).
5. **In-app export (§6).** Handle `blob:` downloads in `AppViewController` with the share sheet, and
   verify that import's file picker works.
6. **Signed TestFlight pipeline (§7).** The archive/export/upload job. Blocked on the owner's
   secrets. The ticket closes when a build appears in TestFlight.
7. *(Later, design first)* Bluetooth MIDI pairing button. Optionally, bundle the default piano's
   samples for offline sound.

## 10. Verifying on a device (owner)

CI cannot plug a piano into a simulator, so this checklist is the acceptance test for §9 ticket 4.
Use a TestFlight build (§8), or run the `App` scheme from Xcode on a Mac with the iPad attached
(free Apple ID, §7). A USB-C class-compliant piano needs no driver; a USB-B piano needs a
USB-C-to-USB-B cable or Apple's camera adapter.

1. **Launch with the piano plugged in.** The top-bar MIDI chip shows the piano's name **with no
   tap** (`autoConnect()`: the shim reports the `midi` permission as `granted`).
2. **Notes arrive.** On *Free Play*, a key lights the on-screen keyboard and the readout names it;
   three keys held name a chord. The sustain pedal and pitch bend change nothing visible, which is
   correct — they are delivered and ignored.
3. **A chord drill grades a chord.** In *Chord quality*, play the chord back as one chord and lift:
   it is graded on release (ADR 0004).
4. **Hot-unplug.** On *Free Play*, pull the cable: the banner reads
   `<piano> disconnected — switched to the on-screen keyboard.` and the chip changes.
5. **Hot-plug.** Plug it back in with the app open: the chip shows the piano again and notes arrive
   **without restarting the app** or tapping Connect.
6. **Background and return.** Switch to another app for a minute, come back, play: notes still
   arrive and the prompts still sound.
7. **Quiet bridge.** Leave the piano idle on a screen for a minute (many pianos send active
   sensing every 300 ms): nothing flickers, and the app stays responsive.

Report what failed and on which screen. With the iPad on a Mac, Console.app (filter on the process
`App`) shows Capacitor's `⚡️` lines, including `CoreMIDI could not connect source …` if a connect
was refused.

## Consequences

- Two deployment targets from one web build. The website is unchanged and remains the primary
  product.
- `$lib/midi` keeps one input API (Web MIDI). Native MIDI is an implementation detail of the shell.
  If WebKit ever ships Web MIDI, the shim stands down by itself.
- Agents can author Swift but compile it only in CI, and only the owner can test on a device. Keep
  the native code small, and push logic into the TS shim, where it is testable.
- An Apple account and its yearly fee become part of running the project, owned by the owner.
