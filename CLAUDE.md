# piano-trainer — conventions for agents

A local-first web app that trains jazz-piano **ear** skills at a MIDI digital piano. No accounts, no
backend, static hosting. Desktop browser first.

**Read first**: [`docs/decisions/0001-target-architecture-and-stack.md`](docs/decisions/0001-target-architecture-and-stack.md)
— it fixes the stack, the internal music vocabulary, the exercise contract and the slice order.
Anything below is the short version; the ADR wins on detail.

**Before building any UI**, read these, in this order:

1. [`docs/design/core-practice-ux.md`](docs/design/core-practice-ux.md) — routes, app shell,
   exercise-runner states and timing, piano-keyboard spec, a11y rules and the copy deck. Authoritative
   for **behaviour, layout, states and copy**; do not invent UX. Its §7 (visual values) is superseded.
2. [`docs/design/sci-fi-visual-language.md`](docs/design/sci-fi-visual-language.md) — the sci-fi/HUD
   re-skin (owner request, 2026-09-14). Authoritative for **visuals**: palette, the chamfer/glow panel
   anatomy, background texture, typography and tracking, iconography, component skins, the motion
   budget, and the shell + home treatment. It is a re-skin, not a re-plan: it moves no region, adds no
   screen and changes no word of copy.
3. [`docs/design/sci-fi-screens.md`](docs/design/sci-fi-screens.md) — **part 2** of the same re-skin
   (2026-09-14): the exercise runner, `PianoKeyboard`, Free Play, Progress, Settings, `/session` and
   its summary. Also owns the fixes pass 2 must land — the piano-key focus ring (`--focus` is
   invisible on a white key), the `ProgressBar` ramp, the dropped light theme, 16 px key glyphs, no
   emoji — and closes the four Settings §6.3 gaps. It amends `core-practice-ux.md` §6.3 and §11 and
   corrects two numbers in part 1's §9 contrast table.
4. [`docs/design/refinement-pass.md`](docs/design/refinement-pass.md) — the post-slice-12 audit
   (2026-10-02), R1–R10 in priority order. It owns the **home-card decision**: a panel repeated
   once per exercise (home cards, `/progress` groups) wears **no glow at rest**, only when hot — so
   the ≤ 12 glow budget no longer scales with the registry. Land R1 before the next exercise slice.

## Repository layout

| Path | What |
| --- | --- |
| `apps/web/` | The SvelteKit app (the rewrite). All new work goes here. |
| `apps/ios/` | The iPadOS Capacitor shell (ADR 0005): the TS Web MIDI shim (`src/`), the Xcode project (`ios/App/`) and its testable Swift (`ios/App/ShellKit/`). |
| `apps/web/src/lib/{theory,audio,midi,exercises,practice,storage,components}` | Domain modules — see the layering rule below. |
| `docs/decisions/` | ADRs. |
| `docs/design/` | UX specs. |

Slice 1 has landed: the workspace root holds `package.json` (all scripts), `pnpm-workspace.yaml`
(`apps/*` only), `eslint.config.js`, `.prettierrc`,
`.nvmrc` (Node 22), commitlint + husky hooks, and the CI/Pages workflows, now active in
`.github/workflows/` (`ci.yml` on every pull request **and every push to `master`**, `deploy.yml`
publishing `master` to Pages). The required status check is the job name
`lint · check · test · build · e2e` (U+00B7 middots — copy it verbatim); the `WIP` check on pull
requests comes from a third-party marketplace app and must never be a required check.

**Pages' source is set by hand and stays that way.** `configure-pages@v5`'s `enablement: true` cannot
create the site — that needs repo admin, which neither `GITHUB_TOKEN` nor an app token has, so the
first deploy died on `Create Pages site failed. Error: Resource not accessible by integration`. A repo
admin must therefore set *Settings → Pages → Build and deployment → Source: `GitHub Actions`* once.
**Done — the owner set it on 2026-09-14**: `GET /repos/alexeychikk/piano-trainer/pages` returns
`build_type: "workflow"`, every push to `master` deploys, and the site is live at
https://alexeychikk.github.io/piano-trainer/ . No code change was needed. So a red
`Deploy to GitHub Pages` run on `master` is now a **real failure** to investigate, not this. Never
"fix" a Pages problem with the platform's `enable_pages` tool: it sets a **branch** source, which is
the wrong source for an Actions deploy.

## Stack (decided — do not re-litigate, amend the ADR instead)

SvelteKit 2 + **Svelte 5 runes** + TypeScript (strict) + Vite, `adapter-static`; pnpm workspaces;
Web Audio directly with `smplr` soundfonts (no Tone.js); Web MIDI; `tonal` behind `$lib/theory`;
`idb` (IndexedDB) for practice data, `localStorage` for settings; Vitest + Playwright; ESLint +
Prettier + svelte-check; GitHub Actions → GitHub Pages.

## Commands (from slice 1 onward, run at the repo root)

```
pnpm install
pnpm dev          # apps/web dev server
pnpm build        # static build
pnpm preview
pnpm lint         # eslint + prettier check
pnpm format       # prettier --write
pnpm check        # svelte-check / tsc
pnpm test         # vitest run (alias: pnpm test:unit)
pnpm test:e2e     # playwright — needs `pnpm --filter web exec playwright install chromium` once
```

Everything runs from the root and is filtered into `apps/web`. CI runs exactly this list: `lint` → `check` → `test:unit` → `build` → `test:e2e`, in one
job named `lint · check · test · build · e2e`. Under `CI=true` Playwright reuses that `build` (it
only previews) and sets `forbidOnly` + 2 retries; locally `pnpm test:e2e` still builds first.

## Code conventions

- **Runes only** for reactivity (`$state`, `$derived`, `$effect`, `$props`). Shared reactive state is
  a class instance exported from a `*.svelte.ts` module (e.g. `$lib/midi/input.svelte.ts`); do **not**
  use `svelte/store` writables.
- **Layering** — `theory` imports nothing local (pure TS, no DOM, no randomness beyond an injected
  RNG); `storage` is a base layer too; `audio`/`midi` may import `theory` and `storage`; `exercises`
  may import `theory`/`audio`/`midi`; `components` may import all of them; **non-UI modules never
  import Svelte components**. Both halves are enforced in `eslint.config.js`; a `*.svelte.ts` runes
  module is *not* a component (the guard only rejects PascalCase `.svelte` imports).
- **Pitches are MIDI integers** (`Midi`, C4 = 60) at runtime; note names are display-only, enharmonics
  compare equal. Never grade on strings.
- Exercises are drop-in: a folder under `$lib/exercises/<id>/` implementing `ExerciseDefinition` plus
  an entry in `registry.ts`. `generate()` and `grade()` must be **pure** and take a seeded `rng` —
  never `Math.random()`.
- Audio is scheduled on `AudioContext.currentTime` through the shared lookahead scheduler, never with
  `setTimeout`. The `AudioContext` starts on a user gesture.
- **iPad / iOS ([ADR 0005](docs/decisions/0005-midi-on-ipados-capacitor-shell.md), tickets 1–2 built)**:
  WebKit has no Web MIDI, so iPadOS gets a **Capacitor shell in `apps/ios`** that ships the ordinary
  `pnpm build` output and reaches CoreMIDI through a local Swift plugin exposed as a
  **`navigator.requestMIDIAccess` shim** (a document-start `WKUserScript`). Rules: **`apps/web` never
  imports `@capacitor/*` and never asks whether it is in the app** — it sees Web MIDI or no Web MIDI,
  like any browser; `$lib/midi` is Web-MIDI-only and the shim copies **Chrome's** semantics (live
  `inputs` map, removed ports stay as `disconnected`, `permissions.query({name:'midi'})` →
  `granted`); native code stays small and logic goes in the TS shim, because agents compile Swift
  only on macOS CI and only the owner can test on a device. The app is a separate origin
  (`capacitor://localhost`, never changed after the first build) — the backup JSON is the only bridge.
  **ADR 0005 §9 ticket 3 has landed (the shell)**: `apps/ios/ios/App` is Capacitor 8's SPM
  template (no CocoaPods), committed; `capacitor.config.ts` (`appId`
  `io.github.alexeychikk.pianotrainer`, `webDir: '../web/build'`). `pnpm --filter ios sync` = shim
  build + `cap sync ios` + copy `dist/web-midi-shim.js` into `App/App/` — run it after `pnpm build`;
  `public/`, `capacitor.config.json`, `config.xml` and the shim copy are generated and git-ignored.
  `cap sync` rewrites `CapApp-SPM/Package.swift` (hands off) but leaves `project.pbxproj` alone, so
  files added to the app target are hand-edited into it (`A1F7C0DE…` ids). **Native logic that can
  be pure goes in the local package `ios/App/ShellKit`** (Foundation only, builds for macOS too), so
  it is tested with plain `swift test` — on macOS CI, or on a Linux sandbox with a swift.org
  toolchain; the app target is glue. Today: `StaticSiteRoutes` (the Pages-shaped path logic behind
  `StaticSiteRouter`), plus `BuiltSiteTests`, which runs it against the real build when
  `STATIC_SITE_ROOT` is set. `AppViewController` swaps in the router and injects the shim; the
  Debug-only `ShellSmoke` (`-smokeRoute <path>`) loads a route, reloads it and waits for
  `#svelte-announcer` each time, driven by `scripts/simulator-smoke.sh`; it reports through
  `Library/Caches/shell-smoke.log` in the app's data container (`simctl get_app_container`),
  because `simctl launch --stderr` never carried the app's stderr on CI. CI is
  `.github/workflows/ios.yml` on `macos-26` (Capacitor 8 needs Xcode 26): `swift test`, an unsigned
  simulator build, then that smoke on an iPad simulator — **not** a required check (path-filtered).
  `apps/ios` is workspace package `ios`.
  **ADR 0005 §9 ticket 4 has landed (the CoreMIDI plugin)**: `App/CoreMidiPlugin.swift`
  (`jsName` `CoreMidi`, a `CAPBridgedPlugin`) is registered with `bridge?.registerPluginInstance`
  in `capacitorDidLoad()` **before** the shim is injected, so its header script runs first. It is
  glue over three ShellKit types, which is where native logic goes and what `swift test` covers:
  `UniversalPackets` (UMP → MIDI 1.0 bytes, channel voice only, multi-word packets skipped whole),
  `SourceConnections` (hot-plug: a source that left is forgotten so its return is reconnected) and
  `BridgedMidiSource`. Plugin state and every `notifyListeners` live on the **main queue**; the
  connection's `refCon` is the source's unique id, so CoreMIDI's thread never looks anything up.
  The smoke's `midi` step calls `requestMIDIAccess()` in the shell (plugin + shim + bridge, no
  piano). Its probe catches in the page and logs the stage that threw plus the error's name,
  message, `code`, `data` and stack (WebKit alone says only "A JavaScript exception occurred"; a
  failure that escapes the page is logged with WebKit's `userInfo`). It **retries only the
  plugin's `CoreMIDI could not start` rejection**, at most twice, 2 s apart, each retry logged as
  `SMOKE midi retry n/2 after …`: a simulator app relaunched with `--terminate-running-process` can
  be refused a MIDI client for a moment, and the shim does not cache a failed start, so a retry is
  a second `Connect MIDI` tap. Any other `midi` failure, and every other step, fails at once. **A piano on an iPad is the owner's test**: ADR 0005 §10 is the checklist. No Swift
  toolchain is declared for the sandbox; ShellKit's pure files compile with a swift.org Linux
  tarball (`swiftc`, no SwiftPM needed) if one is wanted locally.
  `src/web-midi-shim.ts` is plain DOM behind an injected `CoreMidiPlugin` interface (ADR §4.2's
  `start`/`sourcesChanged`/`messages`) and is what Vitest tests (Node environment, fake plugin);
  `src/entry.ts` is the **only** file that touches Capacitor (`shouldInstall` → `registerPlugin`).
  `pnpm --filter ios build:shim` bundles it with esbuild to one IIFE, `apps/ios/dist/web-midi-shim.js`
  (git-ignored); root `build` and `test:e2e` run it, and root `check`/`test`/`test:unit` cover the
  package. The shim also drops anything that is not a 2–3 byte channel-voice message in JS, so "no
  sysex" holds whatever the native side sends. **`e2e/web-midi-shim.spec.ts` injects the *built*
  IIFE over a fake of Capacitor's native side** — `window.webkit.messageHandlers.bridge` (platform
  `ios`), `Capacitor.PluginHeaders` and `nativePromise`/`nativeCallback`, which is all
  `registerPlugin()` calls — with Chromium's own `requestMIDIAccess` deleted, and drives the fake
  through `window.__coreMidi.{send,plug,calls}`. A native change to the plugin's contract changes
  that fake and the Vitest fake together.
  **ADR 0005 §9 ticket 5 has landed (in-app export)**: WKWebView drops `downloadText()`'s `blob:`
  download, so the injected bundle also carries `src/file-share.ts`: it wraps
  `URL.createObjectURL`/`revokeObjectURL` to remember blobs (capped at 32), cancels any
  `<a download>` click on a `blob:`/`data:` URL from a **window capture-phase** listener and hands
  `{ filename, text, mimeType, anchor }` to the local **`FileShare`** plugin
  (`App/FileSharePlugin.swift`, registered beside `CoreMidi`), which writes a temp file and presents
  the share sheet; name sanitising and the iPad popover anchor are ShellKit's `SharedFile`/
  `ShareAnchor`. `apps/web` is untouched and still downloads in every browser. The e2e fake bridge
  carries `FileShare.share` (`window.__fileShare.shared`), and the simulator smoke's `share` step
  presses Export on `/settings/`. Import needs nothing: `<input type="file">` is WKWebView's
  document picker.
  **Distribution is free sideloading ([ADR 0006](docs/decisions/0006-ipad-app-free-sideloading.md)),
  not TestFlight** — the owner has no paid Apple account and no Mac. `.github/workflows/ios-ipa.yml`
  builds an **unsigned** Release IPA (`apps/ios/scripts/build-ipa.sh`: `xcodebuild build`
  `-sdk iphoneos` `CODE_SIGNING_ALLOWED=NO`, `Payload/App.app` → `piano-trainer.ipa`); the owner signs
  and installs it from Windows with a free Apple ID via Sideloadly, following `docs/ios-install.md`.
  **To cut an iOS build**: on `master`, `git tag ios-v<x.y.z> && git push origin ios-v<x.y.z>` —
  the tag's number becomes `CFBundleShortVersionString` (1–3 integers, else the build fails),
  `CFBundleVersion` is the workflow's `run_number`, and the IPA lands on a GitHub Release of that tag
  (marked latest, which is the link the guide gives the owner). `Run workflow` (dispatch) builds the
  same IPA as a 30-day artifact only, and pull requests touching `apps/ios/ios/**` build it without
  publishing. No secrets, not a required check. Bump the tag's version when the app changes, never
  re-push a tag. **The app must stay signable by a free Apple ID**: no `.entitlements`, no
  `CODE_SIGN_ENTITLEMENTS`, no app extensions — `build-ipa.sh` fails on any of them; a capability
  needs an ADR first. Never change the bundle id: WKWebView data is keyed by it, and a sideloaded
  app with a new id is a new, empty app.
  **Safe areas**: the shell keeps `contentInset: 'never'` and the page owns its insets —
  `viewport-fit=cover` in `app.html`, `--safe-top/right/bottom/left` (`env(safe-area-inset-*)`, 0
  outside iOS) on `:root` in `app.css`. The top bar runs its face under the status bar and owns the
  top + side insets, `.app` the bottom one (and the top one while focus mode hides the bar), banners
  and `main` the sides; anything `sticky` under the bar adds `--safe-top`. `e2e/safe-area.spec.ts`
  drives the insets through CDP's `Emulation.setSafeAreaInsetsOverride`.
  **ADR 0005 §9 ticket 1 has landed (web-side iPad hardening)**: `isAppleMobile()`
  (`$lib/midi/platform.ts`, pure; iPadOS-as-Mac = `Mac` platform + `maxTouchPoints > 1`) changes
  **one sentence only** — `MIDI_COPY.unsupportedAppleMobile` (Web MIDI Browser app, never "use
  Chrome") — read once when `requestMIDIAccess` turns out missing; nothing may branch on it for
  behaviour. The engine resumes `suspended` **and** WebKit's `interrupted` state (`needsResume`,
  `audio.resume()` on `visibilitychange → visible`, `ensureStarted()` on the next gesture) and sets
  `navigator.audioSession.type = 'playback'` where it exists, so Silent Mode cannot mute it.
- **Audio (slice 3)**: one engine — `$lib/audio/engine.svelte.ts`, singleton `audio` — owns the
  `AudioContext`, the master gain, instrument loading and the instrument cache, and is the only thing
  that makes a sound. It is created in `ensureStarted()` only, wired once in `+layout.svelte`
  together with the first-`pointerdown`/`keydown` start, the `m` mute shortcut and the single
  `midiInput.subscribe` that routes every note to the engine — **screens never play what the user
  played**, they only read state. `noteOn` never awaits: while samples load (or after they fail) the
  oscillator synth in `synth.ts` plays instead, so a dead CDN is a thinner sound and a banner
  (`onFallback`), never silence or an error. `smplr` is imported lazily inside the engine and is the
  only place soundfonts are touched. Everything timed goes through `PulseScheduler`
  (`scheduler.ts`, 25 ms tick / 100 ms window); the metronome (`metronome.svelte.ts`, singleton
  `metronome`) is module-level so the click survives navigation, and its visible beat follows in
  `requestAnimationFrame` — the light may lag, the click may not. All audio wording lives in
  `$lib/audio/status.ts`. `audio` and `midi` are sibling layers: neither imports the other (which is
  why the played-back `DEFAULT_VELOCITY` is deliberately restated in `audio/gain.ts`).
- **Level policy lives in `$lib/audio/gain.ts`, never in an exercise** ([ADR 0007](docs/decisions/0007-output-level-and-master-limiter.md)).
  **`NOTE_PEAK_TARGET` (−3 dBFS) is the one constant to tweak** if the owner's listen-through says
  the app is too loud or too quiet: one voice at `DEFAULT_VELOCITY` (80) peaks there at 100 % volume
  on **both** paths. The synth curve is anchored on it (`velocityGain` = target × (v/80)^1.5), and so
  is the soundfont: the MusyngKite samples are mastered quietly (per-sample peaks 0.024–0.096,
  grand median `SOUNDFONT_TYPICAL_PEAK` 0.064, measured 2026-10-06), so the engine hands
  `Soundfont()` a derived `extraGain` (`SOUNDFONT_OUTPUT_GAIN` ≈ 45; `smplr`'s default 5 left a note
  at −22 dBFS, 16 dB under the synth). Two stages keep that from clipping:
  - **Groups**: voices mix by addition, so **every group the engine starts in one call shares a
    summed peak budget** — `headroomScale(voiceGains)` scales them to at most `SUMMED_PEAK_CEILING`
    (0.95, before the master gain, which maxes at 1). A single note under it is untouched; above
    ~velocity 92 even a group of one is scaled, so the top of the velocity range is flat — the cost
    of a loud default, and the limiter would flatten it anyway. `1 / sqrt(n)` was rejected because
    it still clips. The sampled budget uses the *typical* sample: the loudest ones sit up to 3.5 dB
    above, and that residue is the limiter's.
  - **The master limiter** (`createOutputChain` in the engine: volume → `DynamicsCompressorNode` →
    trim → destination; values in `LIMITER`): hard knee at −2 dBFS, 20:1, 1 ms attack, for what no
    budget sees — **held keys** (a chord from a MIDI piano is four `noteOn`s, ~+9 dBFS at the
    target). A compressor applies spec-defined make-up gain to *everything*; `LIMITER_TRIM` cancels
    it (`compressorMakeupGain`), so below the threshold the chain is unity. Every voice, sample and
    click connects to `audio.destination` (the volume gain), so nothing bypasses it — **except
    the first `LIMITER_SETTLE_S` (250 ms)**: a fresh compressor's detector starts at zero and ducks
    what it hears first (−16 dB over 10 ms, measured in Chromium), which is exactly where the note
    whose key press created the context sits. A parallel bypass carries the master until then and
    crossfades onto the limiter over 50 ms.
  - Measured, not assumed: `level.test.ts` renders the scheduled voices sample by sample (no
    `OfflineAudioContext` in jsdom) and `e2e/output-level.spec.ts` swaps Chromium's real
    `OfflineAudioContext` in for the engine's `AudioContext` on `/play` and reads the rendered peak.
  - **A group is one call at one time** — `playChord` (a `PlaybackPlan` event), or `playNote`/
    `noteOn` as the group of one. Held keys are *not* a group: they arrive one `noteOn` at a time and
    a sounding voice cannot be turned down without a shared node that would duck it audibly. Each
    step of `playSequence` is its own group, because a line is not a chord.
  - The two paths price a voice differently, and `NoteSourceApi.voiceGain(velocity)` is how the
    engine budgets without learning which source it has: the synth is `velocityGain` (`^1.5`), the
    sampled path `sampledVoiceGain` (`smplr`'s `midiVelToGain`, `^2`). `smplr`'s `NoteEvent` carries
    no gain, so headroom reaches it as a **lowered velocity** (`sampledVelocity`, rounded *down* —
    rounding to nearest would put the sum back over the ceiling). The synth takes `NotePlan.gainScale`
    straight onto its envelope peak.
  - Consequence: **an exercise never sets a velocity for headroom reasons** — a velocity is a
    musical choice (play-the-voicing's root reference sits under its shell on purpose) and nothing
    else. Slice 10's velocity-80 stop-gap is gone: both chord drills are on slice 7's 88 again.
  - Still outside the group budget, deliberately: the metronome click (`scheduleClick`, peak 0.5,
    ~50 ms, −6 dBFS — 3 dB under a note now, where it used to be 16 dB over the soundfont) goes to
    the master like everything else, so the limiter catches a click landing on a chord attack. It is
    a single short voice and lowering it would defeat "audible under playing".
- **Echo of played notes (`$lib/midi/echo.ts`)**: the layout's one subscription is
  `createNoteEcho(audio, () => settings.value.playMidiNotes)`. With `playMidiNotes` off (Settings →
  Sound, owner request 2026-10-06) a **MIDI port's** note-ons — and the offs of those swallowed
  pitches — never reach the engine, so the user hears only their piano; on-screen and computer keys
  always sound, and prompts/replays/the metronome never pass through it. It is the **only** place
  downstream of `midiInput` that branches on `source`, and it decides sound only — highlights and
  grading read the same events. `playMidiNotes` has no engine owner, so it is a plain
  `settings.patch` (and import restores it the same way). Settings only: the top bar has no room.
- **Sound settings** (`instrument`, `volume`, `soundEnabled`, `tempoBpm`, `beatsPerBar`) live in the
  same `settings` store, but UI changes them through `audio.setVolume/setMuted/setInstrument` and
  `metronome.setTempo/setBeatsPerBar` — never by patching `settings` directly, because the engine
  owns the master gain and the running scheduler. Web Audio is never required in tests: use the fake
  context in `$lib/audio/testing.ts` and mock `smplr`; the Playwright specs block the sample CDN so
  e2e always exercises the synth fallback. The fake's params keep a timeline: `param.value` reports
  the automation **at `currentTime`** only (as the real one does) and `param.valueAt(t)` reads a
  scheduled point — assert with `valueAt` for anything scheduled ahead.
- **Never anchor future automation on `AudioParam.value`.** The getter is the value *now*, so a
  release computed at schedule time (a note with a `duration`) would ramp from whatever the node
  happens to hold rather than from where the envelope will be. Compute it instead —
  `envelopeGainAt()` in `audio/synth.ts` is the closed form of the synth envelope — and keep a
  scheduled voice releasable early (`stopAll` mid-playback must cut it), re-anchoring on the earlier
  of the two times.
- Links and assets go through `base` from `$app/paths` (GitHub Pages serves under `/piano-trainer/`).
  Routes are prerendered (`+layout.ts`, `trailingSlash: 'always'`); a route whose params are only
  known at runtime opts out with `export const prerender = false` and is served by the SPA fallback
  — which on Pages is **`404.html`**, not the ADR's `200.html` (Pages serves `404.html` for unknown
  paths).
- **Note input (slice 2)**: every source — MIDI port, on-screen keyboard, computer keys — emits the
  same `NoteEvent` into the single `midiInput` store (`$lib/midi/input.svelte.ts`). Screens read
  `midiInput.held` / `.chip` / `.explanation` and call `midiInput.noteOn/noteOff(midi, source)`;
  nothing downstream may ask where a note came from. Web MIDI access is requested from a user
  gesture (`connect()`), or silently on load only when the permission is already granted
  (`autoConnect()`, wired once in `+layout.svelte` together with `computerKeyboard.attach(window)`).
  Devices are remembered as `${manufacturer}:${name}`, never by port id. All MIDI wording lives in
  `$lib/midi/status.ts` — add copy there, not in a component.
- **Exercises (slice 4)**: the ADR §5 contract lives in `$lib/exercises/types.ts`; an exercise is a
  folder `$lib/exercises/<id>/` exporting an `ExerciseDefinition` plus one line in `registry.ts`, and
  **nothing else in the app may learn its name** — the runner renders `Question.prompt`,
  `Question.playback`, `Question.expected` and the `Grade` it gets back, and that is all it knows.
  `generate()`/`grade()` are pure, take the seeded `rng` (`rng.ts`, `mulberry32`) and derive
  `Question.id` from the seed, so a question is reproducible and both are tested without a browser.
  Five documented extensions to the ADR's types (all display concerns, all generic): `Question.range`
  (keys the question is answered on — everything else dims), `Question.spellings` (feeds the
  keyboard's `labelStyle: 'context'`), `GenerateContext.range` (the user's instrument range, so
  `generate()` never reads storage), a `label` on `ExpectedAnswer` (the reveal is named in text as
  well as shown, a11y §8.6) and `ExerciseDefinition.skillLabel` (slice 5a — how an exercise names its
  own skills for `/progress`).
- **A skill id read back is untrusted input** — it comes from IndexedDB or a 5b import file, both
  hand-editable, so decoding one gets the storage layer's rule: validate, and on anything unexpected
  **return the raw id**, never throw and never invent a label. Two traps, both closed centrally:
  - **`value in TABLE` is never a membership test.** It is `true` for `constructor`, `toString`,
    `__proto__`, `valueOf`, … so a crafted id used to reach the vocabulary tables and come back as a
    function — which `shellIntervals()` then called `.find()` on, throwing and taking `/progress`
    down. Every lookup keyed by a union is `Object.hasOwn()`, and the predicates are
    `isChordQuality()` (`theory/chords.ts`) and `isProgressionType()` (`theory/progressions.ts`).
    A name register asked about a key it does not own returns the key unchanged.
  - **`Number()` is never a parser** for a segment: `Number('')` is `0` and `Number(' 3 ')` is `3`.
    Numeric segments go through `$lib/exercises/skill-id.ts` (`skillIdSegments` — prefix plus an
    exact segment count; `integerSegment`/`pitchClassSegment` — canonical decimal, bounded), which
    is what every exercise's `skillLabel()` is built from. New exercises reuse it; `registry.test.ts`
    asserts the rule for whatever is registered.
- **The runner** is `$lib/exercises/runner.svelte.ts` (state machine, score, streak) plus
  `$lib/components/exercise/ExerciseRunner.svelte` (the §4 frame). **Every drill-rhythm constant
  lives in the runner module** — `REVEAL_DELAY_MS`, `IDLE_PAUSE_MS`, `CHORD_SETTLE_MS`,
  `CHORD_RELEASE_MS`, `SEQUENCE_GAP_MS` — never in a component. Audio reaches it through the
  injectable `PlaybackApi` (`playback.ts`, `createAudioPlayback()`), which is also how the state
  machine is tested with fake timers and no Web Audio. Answers arrive as `midiInput` events, so the
  runner cannot tell a MIDI piano from the computer keys. Copy is in `feedback.ts`; keyboard
  highlights are mapped by the pure `components/exercise/highlights.ts`. `f` (focus mode) is
  deliberately **not** a shortcut: `F` is a note key and §4.6 keeps that mapping live — the `⤢`
  button is the keyboard path. The runner sizes itself to the space the shell leaves (`.app` is a
  full-height flex column in `+layout.svelte`) and clips: it must never scroll.
  **Retry until correct (owner request, 2026-10-06)**: a wrong answer **keeps the question**.
  `#finish('wrong')` goes straight back to `awaiting` on the same `Question` (no `feedback` phase,
  no timer, unlimited tries); the ✗ line (`✗ Try again` / `… · Enter to reveal`, `feedback.ts`)
  and the ✗ keys stay up until the next try's first note-on clears them (`#clearMiss`). **A miss
  reveals nothing** — no `revealNotes`, no reveal audio, and the announcement does not speak the
  answer — or the retry would be copying; `Enter` (skip & reveal) is the way out, and is the only
  path to `feedback:reveal`. `Grade.revealed` is therefore unread (kept as ADR §5's contract).
  **Multi-step answers restart from step 1**: grading is whole-answer, so the runner cannot know
  which chord of a ii-V-I or which note of a sequence failed; a miss resets the capture and the
  next try is the whole answer again. **Only the first answer to a question is the attempt**
  (`#attempted`, reset per question): it alone is emitted through `onAttempt`, and it alone moves
  `answered`/`correctCount`/`streak` — a right answer after a miss is not a correct one, a skip
  after a miss logs nothing, so mastery and the SRS schedule see exactly one miss. No
  `PRACTICE_SCHEMA_VERSION` change. The UX source is core-practice-ux.md §4.2/§4.3.
  **No auto-advance (owner request, 2026-10-06)**: a closed question — correct, or revealed by a
  skip — **stays in `feedback`** until the user asks; there is no feedback timer and no advance
  lockout any more (`FEEDBACK_CORRECT_MS`/`FEEDBACK_STREAK_MS`/`ADVANCE_LOCKOUT_MS` are gone). In
  `feedback` every note is **free play**: it sounds and lights the keyboard, and is never graded,
  captured or logged (it only re-arms the idle timer, so a drill being played on is not paused).
  The way on is `runner.advance()`, reached by `Enter` (`runner.enter()`: skip & reveal while
  open, next once closed), `Space`, the strip's `Next` button and **the piano's C1**.
  `NEXT_QUESTION_MIDI_NOTE = 24` (C1, the lowest C of an 88-key piano) is the **one constant** for
  it, in `$lib/midi/next-key.ts` with its copy (`NEXT_QUESTION_HINT` `Press C1 or Enter for next`,
  key name derived with `midiToName`). It is a **control, MIDI-port only** (`isNextQuestionNote`;
  an on-screen or computer-key C1 is an ordinary note): in every phase the runner routes it before
  grading — `idle` starts, `paused` resumes, `feedback` advances, anything else **consumes** it —
  so it never joins an answer, and `answerableRange()` clamps `GenerateContext.range` above it so
  no question can need it. It also never **sounds**: the frame `reserveNextQuestionNote()`s while
  mounted and the layout's echo takes `isReservedNextQuestionNote` as `createNoteEcho`'s third
  argument (`isControl`; a swallowed on swallows its off), so Free Play still plays a low C.
  `/session` is the same frame and inherits all of it; `Esc` still ends a session into its summary.
  **The shortcut bar is the manual (§5.7) and carries the *whole* computer mapping when no MIDI
  device is connected** — `A W S E D F T G Y H U J K` **and** the `Z` / `X` octave shift (§4.6;
  with the root at the bottom of a voicing most answers need the shift between notes). Its wording
  lives in `$lib/midi/keymap.ts`, and the keycaps (`OCTAVE_DOWN_HINT` / `OCTAVE_UP_HINT`) are
  derived from the codes the handler listens to, so the manual cannot drift from the behaviour.
  **Chord capture ([ADR 0004](docs/decisions/0004-midi-chord-answers-close-on-release.md), part a
  landed)**: a `chord-released` question picks its path **per answer, from the first note-on's
  source** — `midi` opens chord capture (`runner.capture === 'chord'`), anything else is plain
  `note-sequence`, so the mouse and the computer keys behave exactly as before; once capture is
  `chord`, non-MIDI notes are ignored. `runner.noteOff()` is fed every `off` event by the frame and
  only chord capture reads it (a key held before the answer opened is not in `held`, so its release
  is ignored). Rules, all timed in the runner module: a **moment** is what is held when
  `CHORD_SETTLE_MS` (90 ms) of note-on silence passes, so a rolled chord or a left hand lifted early
  still counts; a key grazed down *and* up inside that window is a **stray** and dropped; a **stab**
  (every key up before the settle fires, ≥ 2 pitches) is one moment; the answer **closes** once every
  key has been up for `CHORD_RELEASE_MS` (250 ms) and `Question.answerChords` (default 1 — the
  **eighth** generic extension) chords are captured, otherwise the silence window
  (`answerGapMs ?? SEQUENCE_GAP_MS`) closes it. A new chord starts at a moment after any key went up,
  if one is already captured. The graded `Answer` carries `chords` (each ascending, deduped) beside
  `notes` (their union), so single-chord `grade()`s read `notes` unchanged. The frame shows one slot
  per chord (named by its lowest note), keeps captured notes lit, hides `⌫` while capturing and adds
  `release to answer` (`RELEASE_TO_ANSWER_HINT`) to the bar when a MIDI device is connected. Part (b)
  has landed too: the ii-V-I is on `chord-released` with `answerChords: 3` (slice 10 below).
- **Interval recognition + `note-sequence` (slice 6)** — `$lib/exercises/interval-recognition/`, the
  second exercise and the first ear-training drill:
  - **The graded quantity is the interval, not the pitches**: a question is asked from a random root,
    but `grade()` compares `played[1] − played[0]` to the asked semitones, exactly and with
    direction. So the answer may be played from **any** key (the prompt says so, and `Question.range`
    is left off, so nothing dims), an octave displacement is a *different* interval (a 12th is not a
    5th), and enharmonics compare equal for free because it is integer arithmetic. Absolute pitch is
    what "Find the note" drills; this one drills relative pitch. Scoring is **binary** (ADR §10) —
    half credit here would report a skill as half-learned to the mastery EWMA.
  - Interval **vocabulary lives in `$lib/theory/intervals.ts`**, never in the exercise:
    `intervalBetween`, `intervalName` (`Perfect 5th`, spelled out for feedback), `intervalShortName`
    (`P5`, for dense grids) and `spokenInterval` (`a perfect 5th`, the copy deck's miss line). A
    compound interval is named by its simple part plus the octaves (`Major 3rd + 1 octave`), not as a
    10th — a beginner hears the octave, and notation spelling is not a concept this app has.
  - `SkillId` is `interval-recognition:<semitones>:<asc|desc>` — the exercise-id prefix slice 4
    established, not ADR §10's bare `interval:7:asc`. `skillLabel()` renders it `m3 ↑`.
  - The **runner now implements `note-sequence`** (UX §4.4): notes append in played order, the answer
    closes at the expected length (`expectedLength(Question.expected)`) or after `SEQUENCE_GAP_MS`
    (1200 ms) of silence, `Backspace` takes the last note back and the answer **survives a replay** —
    which is why the gap has its own timer, not the `#timer` a replay reschedules. The answer's
    `answerSource` is its last note's source, since one attempt stores one source.
  - The `◻ ◻` note slots are generic runner chrome: the count comes from `Question.expected`, the
    spelling from `Question.spellings`, so the runner still learns nothing about intervals. They are
    drawn **inside the reserved 88 px feedback slot**, not in a row of their own above the keys
    (§4.4's sketch): that slot is empty for exactly as long as an answer is open, so they cost no
    height — and the runner still fits a keyboard at a 720 px viewport with the no-MIDI strip
    showing. A row of its own pushed it into a scroll, which §4.1 forbids.
  - `AnyExercise` erases settings as `Record<string, unknown>`, so **an exercise's settings type must
    be a type alias, not an `interface`** (only an alias gets the implicit index signature).
- **Chord quality (slice 7)** — `$lib/exercises/chord-quality/`, the third exercise and the second
  ear-training drill: one block chord sounds, the user plays it back.
  - **The graded quantity is the quality, not the pitches** (slice 6's rule, one dimension up):
    `grade()` compares `intervalsAboveBass(played)` — the semitones above the **lowest note played**,
    folded into one octave and deduped — to the asked quality's interval set. So the chord may be
    played back from **any root** (no `Question.range`, nothing dims), in **any octave and spacing**,
    with **enharmonics equal for free** (integer arithmetic), but **in root position**:
    a pitch-class set alone does not name one quality (Cm7 and Eb6 are the same four notes, and
    slice 8's 6th chords make that ambiguity real), so the lowest note played is read as the root.
    A right chord over the wrong bass is a *named* miss, never a silent one
    (`spellsQualityInAnyInversion`). Scoring is **binary** (ADR §10).
    **Doublings are free**: grading is pitch-class set plus lowest note. On the `note-sequence` path
    (mouse, computer keys) a doubled note still uses up one of the answer's N notes, because that
    path closes at the expected length (ADR 0004 §3).
  - The **answer mode is `chord-released`**, which the runner captures as a chord from a MIDI port
    and as a `note-sequence` from every other source (ADR 0004 §1): a mouse on the on-screen
    keyboard cannot hold a chord at all (one pointer, one key), and every drill must stay playable
    with no MIDI device. Grading is **order-insensitive** either way, so notes struck together
    arriving in note-on order (QA's slice-6 observation) cannot reach it. Slices 8, 10, 11 and 12
    use the same mode.
  - Chord **vocabulary lives in `$lib/theory/chords.ts`**, never in the exercise — the
    `intervals.ts` rule: `chordIntervals`/`chordNotes` (build), `intervalsAboveBass`/
    `qualityOfIntervals`/`spellsQuality`/`spellsQualityInAnyInversion` (read) and the three names
    (`chordQualityName` `Dominant 7th chord` for feedback, `chordQualityShortName` `7` for the
    grid, `spokenChordQuality` `a dominant 7th chord` for a sentence). **A quality's name carries
    the noun** (`Major 7th chord`), because `Major 7th` alone is an interval. `dom7alt` has **no**
    interval set — an altered dominant is a family of voicings, so `chordIntervals()` returns
    `null` and `generate()` skips any quality it cannot build.
  - `SkillId` is `chord-quality:<quality>` (one skill per colour); `skillLabel()` renders the
    chord-symbol suffix (`maj7`, `7`, `m7`, `m7b5`, `dim7`). The starter set is those five
    four-note sevenths — all the same size, so the drill is about colour and not about counting
    notes; triads and 6ths join when the runner can render `settingsFields`.
- **Play the voicing (slice 8)** — `$lib/exercises/play-the-voicing/`, the fourth exercise and the
  **first playing drill**: a chord symbol appears, the root sounds as a reference, the user plays
  the shell.
  - **The voicing set is the shell**: root + 3rd + 7th, one hand. Vocabulary lives in
    `$lib/theory/voicings.ts` (the `intervals.ts`/`chords.ts` rule): `shellIntervals`/`hasShell`/
    `shellNotes`/`shellSpan`/`shellPitchClasses` (build), `qualityOfShellIntervals`/`spellsShell`/
    `spellsShellInAnyInversion` (read), plus `SHELL_QUALITIES` — the qualities whose shell is
    **theirs alone**. `chordSymbolText(rootPc, quality)` (`chords.ts`, with `pitchClassName` in
    `notes.ts`) is the fourth name register: `Cmaj7`, what a chart prints.
  - **The starter set is `maj7 · 7 · m7`** — slice 7's five minus the two that have no shell of
    their own: `m7b5` shells to `[0,3,10]`, which *is* `m7`'s (the b5 is exactly the note a shell
    drops), and `dim7`'s "7th" is a diminished 7th, so `C-Eb-A` spells `Ebm6` just as well. A
    quality is asked only if `hasShell()`; `skillsCovered()` filters the same way.
  - **The graded quantity is the voicing in the asked key** — the first drill where the key
    matters, because `Dbmaj7` and `Cmaj7` are one colour and two different shapes. `grade()` is
    `spellsShell()`: the **pitch classes played must be exactly the shell's three** and the
    **lowest note played must be the asked root**. Register, octave, spacing and order are free, so
    the A form (`1-7-3`) and the B form (`1-3-7`) pass by construction; the triad, the whole chord
    and a rootless or inverted shell are misses; enharmonics are equal for free. Binary scoring
    (ADR §10). **Doublings are free**: grading is pitch-class set plus lowest note. On the `note-sequence` path
    (mouse, computer keys) a doubled note still uses up one of the answer's N notes, because that
    path closes at the expected length (ADR 0004 §3). **Hands
    are not a concept** — a `NoteEvent` carries a source, never a hand — so this drill is
    one-handed and the deferred **two-hand voicing colours roll on to the rootless-voicings
    ticket**.
  - `SkillId` is `play-the-voicing:<quality>:<rootPc>` — **one skill per chord, not per colour**:
    what is weak in a playing drill is a key, and a per-quality average would hide exactly the keys
    the drill exists to expose (36 cells on `/progress`, labelled `Cmaj7`).
  - **A sixth generic extension to ADR §5: `Question.revealPlayback`.** A question that is *read*
    plays a reference (here the root alone, so `Replay` is worth pressing and the answer is not
    given away) and owes the reveal a different sound (the shell). The runner plays `playback` in
    `#present()` and `revealPlayback ?? playback` in `#replayReveal()`; without one nothing changes.
  - Answer mode is **`note-sequence`** again (slice 7's reasoning: one mouse pointer cannot hold a
    chord, and every drill must be playable with no MIDI device), so the runner needed no change
    beyond the reveal plan.
- **ii-V-I progressions (slice 10)** — `$lib/exercises/progression-recognition/`, the fifth
  exercise and the last of ADR §10's plan: a three-chord cadence sounds, chord by chord, and the
  user plays it back.
  - **The vocabulary is two cadences**, in `$lib/theory/progressions.ts` (the
    `intervals.ts`/`chords.ts`/`voicings.ts` rule): `major-ii-V-I` (`m7 · 7 · maj7`) and
    `minor-ii-V-i` (`m7b5 · 7 · m7` — the minor tonic is a `m7`, which keeps the family inside the
    seventh-chord vocabulary slices 7–8 already drill). **A progression is degrees, not chords**:
    semitone offsets from the tonic plus a quality, so all 12 keys are one table and transposition
    is arithmetic. `progressionSteps`/`progressionChords`/`progressionNotes`/`progressionSpan`/
    `chunkIntoChords` (build), `spellsProgression` (read) and the three name registers
    (`progressionName` `Major ii-V-I`, `progressionShortName` `ii-V-I`, `spokenProgression`
    `a major ii-V-I` — which lower-cases **only the first word**, because the numerals' case *is*
    the cadence).
  - **The graded quantity is the progression in a key** (slice 8's rule, one level up):
    `spellsProgressionChords(chords, tonicPc, type)` requires exactly one chord per degree, in
    order, each spelling its degree's quality over **its own root** (`spellsQualityFromRoot`, new in
    `chords.ts` — `spellsQuality` with the key pinned). Free: register, octave, spacing and note
    order *inside* a chord, enharmonics, and **doublings** (grading is pitch-class set plus lowest
    note — a chord's size is never counted). Rejected: another key, another quality, the chords in
    another order, an inverted chord, a shell, an extra pitch class, the wrong number of chords.
    Binary scoring (ADR §10). `spellsProgression(notes, …)` is the sequence path's wrapper:
    exactly twelve notes, `chunkIntoChords`, then `spellsProgressionChords` — so on the
    `note-sequence` path (mouse, computer keys) a doubled note still uses up one of the answer's
    twelve notes, because that path closes at the expected length (ADR 0004 §3).
  - **How chords are separated depends on the path** (ADR 0004 §1, part b). The answer mode is
    `chord-released` with `answerChords: 3`. **From MIDI, by hand shape**: chord capture starts a new
    chord at a settled moment after any key went up, so voice-leading that **holds common tones**
    (Dm7 → G7 with F held) is three chords, and `grade()` reads `Answer.chords` directly. Chords run
    together (keys only added) are one; a wrong count is the named miss `Heard 2 chords — a ii-V-I
    is three`, asked first in `missDetail` (which takes the chunks plus `{ captured }`). **From the
    mouse and the computer keys, by count** — four notes a chord, chunked 4–4–4 in played order,
    byte-identical to slice 10; a sequence answer has no timestamps to separate by.
  - **Whole four-note chords, not shells**: the minor ii is a `m7b5`, whose shell *is* `m7`'s, so a
    shelled minor cadence could not be told from the major one.
  - `SkillId` is `progression-recognition:<type>:<tonicPc>` (the exercise-id prefix rule, not the
    ticket's suggested bare `progression:`) — 24 skills; `skillLabel()` renders `C ii-V-I`.
  - **A seventh generic extension to ADR §5: `Question.answerGapMs`.** A twelve-note answer may not
    be closed by the runner's 1200 ms window while the user hunts for the next chord, so a question
    may say how long its own silence window is (3 s here). The default still lives in
    `runner.svelte.ts`; this is the same per-question override `PlaybackPlan.tempoBpm`/`countIn`
    already are. The idle pause (90 s) still ends an abandoned drill.
  - The runner's answer slots now **wrap** (`.slots`): twelve slots are wider than the frame on a
    narrow desktop window, and two rows still fit the reserved 88 px, so §4.1's no-scroll rule holds
    in both directions.
- **Rootless A/B voicings (slice 11)** — `$lib/exercises/rootless-voicing/`, the sixth exercise and
  the second playing drill: a chord symbol and a form are read, the root sounds underneath, the user
  plays the voicing.
  - **The vocabulary is the rootless pair**, in `$lib/theory/voicings.ts` beside the shell (the
    `intervals.ts`/`chords.ts` rule): `A` = 3-5-7-9, `B` = 7-9-3-5, measured in semitones **above
    the root the voicing never plays**, so all 12 keys are one piece of arithmetic.
    `rootlessIntervals`/`hasRootless`/`rootlessNotesFromBass`/`rootlessBassOffset`/`rootlessSpan`/
    `rootlessPitchClasses` (build), `rootlessOfIntervalsAboveBass`/`spellsRootless`/
    `spellsRootlessInAnyInversion` (read), the `isRootlessForm` guard and two name registers
    (`rootlessBassDegree` `3rd`, `rootlessDegrees` `3rd, 5th, 7th, 9th`).
  - **A and B are the same four pitch classes; the form is which one is underneath.** So
    `rootlessPitchClasses()` deliberately takes **no form** — only the bass can tell them apart —
    and `spellsRootless()` is "exactly these four pitch classes, with the form's own degree lowest"
    (slice 8's rule with the bass moved off the root). Free: register, octave, spacing, order,
    enharmonics. Rejected: the other form, another key, another quality and **any answer containing
    the root** — that is what rootless means (a left-hand root under the voicing included, ADR 0004
    §6), and it is a *named* near-miss, never a bare ✗. Binary scoring (ADR §10). **Doublings are free**: grading is pitch-class set plus lowest note. On the `note-sequence` path
    (mouse, computer keys) a doubled note still uses up one of the answer's N notes, because that
    path closes at the expected length (ADR 0004 §3).
  - **An A form is also a seventh chord, and that ambiguity is the music's**: `Cm7`'s A form is
    `Eb-G-Bb-D`, spelled exactly like `Ebmaj7` (`Cmaj7`'s is `Em7`, `C7`'s is `Em7b5`). No B form is
    anything else. Both readings are honest, so `rootlessOfIntervalsAboveBass()` names a played
    shape as a *voicing* and `missDetail` asks it before `qualityOfIntervals()` — a drill about
    voicings names things in its own vocabulary. The commonest case never reaches either: the whole
    chord in the *asked* key contains the root, so the root line wins first.
  - **Only qualities with a 3rd, a perfect 5th and a 7th have a rootless voicing** — `maj7`, `dom7`,
    `min7`, `minMaj7` (`ROOTLESS_QUALITIES`); the starter set is the ii-V-I's three, as slice 8.
    `min7b5`'s flat 5th and `dim7`'s diminished 7th make a different shape with a different 9th, so
    they get `null` rather than a plausible transposition of the wrong thing.
  - `SkillId` is `rootless-voicing:<quality>:<rootPc>:<form>` — **one skill per chord *and* form**,
    72 cells. Slice 8 split by key because a colour is not a shape; the form splits it again for the
    same reason, and averaging the form you reach for with the form you avoid would hide exactly
    what the drill exists to expose. `skillLabel()` renders `Cmaj7 A`.
  - **Placement is anchored on the voicing's bass note, not on the root** (which is not played):
    anchoring on the root would push a B form — whose top is 19 semitones above it — out of a small
    keyboard for a note nobody plays. The **reference root sounds as the bass**, the highest root
    below the voicing, and it cannot give the answer away because it is the one note the answer must
    not contain. `answerGapMs` is 2.5 s: this is a *construction* drill (slice 7's chord is an echo),
    and the runner's 1200 ms default closes an answer the user is still working out.
- **Guide tones (slice 12)** — `$lib/exercises/guide-tones/`, the seventh exercise and the third
  playing drill, closing pillar 2's ladder (shells → rootless → guide tones): a chord symbol is
  read, the root sounds underneath, the user plays the **3rd and the 7th**.
  - **The vocabulary is the pair**, in `$lib/theory/voicings.ts` beside the shell and the rootless
    forms (the `intervals.ts`/`chords.ts` rule): `guideToneIntervals` is **the shell with the root
    taken away** — derived from `shellIntervals()`, so "a 3rd" and "a 7th" are defined once —
    returned **3rd first, 7th second, unsorted**, because which is which is the whole vocabulary.
    Plus `hasGuideTones`/`guideToneNotes`/`guideToneSpan`/`guideTonePitchClasses` (build),
    `spellsGuideTones`/`guideToneReadings`/`guideToneDegree` (read, and its degree is the typed
    union `GuideToneDegree`, so a half named in a miss cannot drift into a string the drill does not
    use), `GUIDE_TONE_QUALITIES` (the same four as `SHELL_QUALITIES` — **over one fixed root** each
    of their pairs is theirs alone; across roots a pair still reads as two chords, which is exactly
    what `guideToneReadings()` returns a *list* for) and the copy constant `GUIDE_TONE_DEGREES`.
  - **The graded quantity is the pair in the asked key**, and this drill's one difference from
    slices 8 and 11 is that **the bass is free too**: `spellsGuideTones()` is "exactly these two
    pitch classes", nothing more. A shell has the root underneath and a rootless form *is* its bass
    note, but `3-7` and `7-3` are both the pair every method teaches — which one a hand reaches for
    is voice leading, not correctness. Free: register, octave, spacing, order, which tone is lowest,
    enharmonics. Rejected: the root (that is the shell — slice 8's answer and the habit this drill
    breaks), the 5th/9th (that is slice 11's), another key, the other colour and half the pair.
    Binary scoring (ADR §10). **Doublings are free**: grading is pitch-class set plus lowest note. On the `note-sequence` path
    (mouse, computer keys) a doubled note still uses up one of the answer's N notes, because that
    path closes at the expected length (ADR 0004 §3).
  - **A dominant and its tritone substitute share their pair** (`C7` and `Gb7` are both `E`+`Bb`), so
    playing one for the other is *correct* — the ambiguity is the music's and grading may not call
    it a miss. `guideToneReadings()` therefore returns a **list**, and `missDetail` picks the reading
    in the **asked key** first (asked `Am7`, played `C#`+`G#` → "the Amaj7 guide tones": both notes
    raised), then the asked quality (a transposition), then the first.
  - **`missDetail` starts at one note**, not two as slices 8/11 do: half of a two-note answer is the
    commonest miss here, so it is named (`That is the 3rd — the 7th is the other guide tone`). And
    the root line requires the asked pair to be **present as well as** the root — another chord's
    pair often contains the asked root by coincidence, and "you played the root" would be false for
    it. **A guide tone beside the 5th** (`E G` for `Cmaj7` — the triad player's reflex) is named too,
    from `chordFifth()` in `theory/chords.ts` (the 5th of *this* quality, perfect/diminished/
    augmented — slice 8 could inline `+7` because a shell only ever drops a perfect one). The branch
    is narrow, slice 8's way: **exactly two pitch classes**, one the asked chord's guide tone and the
    other its own 5th, so the shell/rootless/whole-chord/other-key lines all keep their answers. It
    sits *ahead* of `guideToneReadings()` because such a pair is 3–4 semitones wide and only
    `minMaj7`'s pair spans that — i.e. the only reading it can pre-empt is a chord the drill never
    asks for, while both notes are the chord on screen. It can never take the **asked key's** reading,
    since a chord's own pair is its 3rd and 7th, never its 5th.
  - `SkillId` is `guide-tones:<quality>:<rootPc>` — slice 8's shape and slice 8's reason (what is
    weak in a playing drill is a *key*); there is no second dimension to split on, so `/progress`
    gains one group of 36 cells labelled `Cmaj7`. The label repeats the shell drill's; the group
    title is what tells them apart.
  - The starter set is `maj7 · 7 · m7`. `min7b5` is out because its pair *is* `m7`'s (the flat 5th
    is not a guide tone) and `dim7` because it has no 3rd-and-7th pair at all.
  - `registry.test.ts`'s `craftedIds()` net now also builds **three-segment** ids, so it reaches
    slice 11's shape as well as this one's — it grows with the longest id any exercise registers.
- **How a question is drawn (`$lib/exercises/draw.ts`)** — the scaffolding every `generate()` is
  built from, so a new drill composes it instead of copying a neighbour's:
  - `spell`/`spellings` (flats, the one spelling for `Question.spellings`), `occurrences`/`lowestFrom`
    (the octaves of a pitch class), `choose` (one item, uniformly).
  - `drawAvoidingRepeat(draw, skillIdOf, recent, canVary)`: the `MAX_REDRAWS = 4` loop. A planner
    target never goes through it.
  - `drawKeyed`/`drawKey`: a keyed drill's quality → buildable root → `buildableTarget` draw. The
    progression drill reuses it through a `{ type, tonicPc }` adapter. Rootless voicings keep their
    own target check, because a form is a third dimension, but draw through `drawKeyed` and
    `drawAvoidingRepeat`.
  - `pickInWindow` (a root in a window, comfortable part first) and `pickOccurrence` (the same for a
    pitch class whose key is decided; `null` when it does not fit, so the caller places the overflow).
  - `referenceThenReveal(root, answer)`: a *read* drill's playback. The root sounds 900 ms at
    velocity 80, and the reveal is the answer for 1600 ms at velocity 84.
  - **RNG consumption is the contract.** Each helper draws exactly as the inline code it replaced did,
    and `randomInt` over a span of 0 or 1 consumes nothing. `seed-snapshot.test.ts` records 50
    question ids plus a digest of the full questions, per exercise, on four ranges, at fixed seeds.
    Any change in which question a logged seed draws fails it. **Never re-record it to make a
    refactor pass.** Only a deliberate change to an exercise's questions may re-record it, and it is
    called out in that PR. Snapshots need `CI` unset to be *written*.
- **What an exercise can ask (`$lib/exercises/coverage.ts`)** — `skillsCovered(settings, range)`
  returns **only skills `generate()` can build** under those settings on that range (theory can
  build it *and* it fits the keyboard), and `generate()` draws from the same set, so `/progress`,
  home and the planner never show a skill the drill will not ask. **No fallback**: nothing
  buildable is `[]` plus `generate()` throwing `NothingToAskError` (the old `['maj']` fallback drilled
  a chord nobody enabled). `/session` mixes only `askableExercises(EXERCISES, range)`. A plain drill
  with nothing to ask **says so before `Start`**: the frame derives `unavailable` from the
  exercise's own `coveredSkills()` (plus the runner's `nothingToAsk` flag, set when `#next()` catches
  `NothingToAskError` and ends in `summary`), swaps the prompt for `NOTHING_TO_ASK` (`feedback.ts`),
  the phase label for `UNAVAILABLE_PHASE` (`phases.ts`), and `Start` for an `Open Settings` link to
  `/settings#practice` (the range wizard); `Space`/`Enter` do nothing. Generic — no exercise is named.
  Reachable today only for the ii-V-I on a 12–16 semitone keyboard; home's card still opens to the
  message rather than being marked. Screens go through
  `coveredSkills`/`planInputs`, never call `skillsCovered` without a range.
  - **`targetSkillId` is honoured exactly** when buildable: every exercise exports a validating
    `parseSkillId()` (also what its `skillLabel` decodes with) and uses
    `buildableTarget(target, parseSkillId, isBuildable)`; a target it cannot build (foreign,
    crafted, off the keyboard) is a normal draw. A target is never redrawn for variety. The runner
    rotates through the planner's targets across its `TARGET_SAMPLE_TRIES` draws.
  - Keyed drills draw quality, then a root from that quality's buildable roots (`pitchClassesIn`),
    so a full range consumes the rng exactly as before. `registry.test.ts` asserts both halves for
    every registered exercise on several ranges.
- **Settings** are `localStorage` via the `settings` store (`$lib/storage/settings.svelte.ts`) and
  are read only in `hydrate()`, called from the root layout after mount — module init must not touch
  storage or prerendered HTML and the first client render disagree. Slice 4 added `keyboardLow`/
  `keyboardHigh` (one instrument range, taught by the range wizard in `$lib/midi/range.ts` — a pure
  reducer — and used by every note exercise), `countIn` and `focusMode`. A stored range that is
  inverted or under an octave is not a piano: it falls back to the default.
- **Practice data (slice 5a)** — see [`docs/decisions/0002-practice-persistence-and-mastery.md`](docs/decisions/0002-practice-persistence-and-mastery.md):
  attempts and per-skill mastery live in **IndexedDB** (`$lib/storage/db.ts`, `idb`, stores
  `attempts`/`skills`/`meta`), never in `localStorage`. `PRACTICE_SCHEMA_VERSION` is both the
  payload version and the database version; a missing, blocked or **newer** database resolves to
  `null` and the session runs in memory — `openPracticeStorage()` never throws, and every record is
  validated on read (`parseAttempt`/`parseSkill`) because storage is user-editable and, from 5b,
  user-imported.
  - `$lib/practice/store.svelte.ts` (singleton `practice`) is the only writer: `record()` updates
    state **synchronously** and queues the write behind it, so persistence never sits in the
    runner's callback while audio is being scheduled. `hydrate()` is the one-shot mount path
    (wired in `+layout.svelte` beside `settings.hydrate()`) and **merges by `attemptId`**, so an
    answer given while the read was in flight survives; `reload()` **replaces**, which is what
    slice 5b's import needs after it swaps the log out. A failed write sets `degraded` and reports
    the copy deck's line once through `onError` → a banner.
  - **The queue is drained on the leave paths, and only there**: `practice.flush()` waits for the
    queued writes (looping until the queue's tail stops moving, so a write queued *while* it waited
    is not left behind), and `$lib/practice/leave.ts` attaches it to `visibilitychange` → `hidden`
    and `pagehide` while the root layout's `onNavigate` **awaits** it — SvelteKit holds the
    navigation until the hook resolves, and that is the one moment waiting for a write is correct
    (no question is on screen). Nothing is ever awaited during a drill. `flush()` is a no-op on an
    empty queue — one microtask, no waiting (it is `async`, so never literally *synchronous*), so a
    leave path may fire it every time — never throws and reports nothing of its own — a failed write
    already said its sentence once, through `onError`. It gives
    up after `FLUSH_DEADLINE_MS` (2 s), because `openPracticeStorage()` may legitimately wait
    forever (another tab holding an older database version open) and a navigation may not: a missed
    write is a failure we already survive, a hung app is not. `sync()` is `flush(0)` + `reload()`.
  - **The store memoises the *promise* of `openPracticeStorage()`, never a "have I opened yet" flag**
    — every caller awaits the same open. A flag hands the second caller a still-`null` storage, which
    the write path cannot tell from *no* storage: it would degrade the session and drop the attempt,
    in exactly the window `hydrate()` merges for. So `degraded` means storage is genuinely
    unavailable, and a queued write just waits for the open (`openDB` can wait indefinitely while
    another tab holds an older connection open).
  - **An attempt is keyed by the attempt, not the question**: `attemptId` = `${ts}:${questionId}`,
    stamped by `record()` (`attemptKey()` in `db.ts`), never by a caller. A question id repeats — a
    seed collision, or a 5b import from another device — and keying on it would silently overwrite a
    row in an append-only log. The runner emits a `NewAttempt` (no key); an imported record without
    one is keyed on read, not dropped.
  - **The attempt log is the source of truth**: `skills` is a cache of `deriveSkills()` over the
    log, so a lost or half-written skill record heals on the next load.
  - **Mastery is an EWMA, α = 0.3, over the grade's `score`** (`$lib/practice/mastery.ts`); weak =
    `mastery < 0.3` **and** ≥ 3 attempts (`!`, in `--warn`). Unseen is `null` (`new`), never 0.
  - **Scheduling is slice 9a's** — see the `Spaced repetition` section below; slice 5a's "written at
    their defaults and read by nobody" no longer holds.
  - Layering: `practice` may import `storage` and `exercises` types and **nothing imports it back**
    — the runner takes an `onAttempt` callback (`ExerciseRunner.svelte` passes `practice.record`) and
    stays testable without a database. **All practice wording is in `$lib/practice/copy.ts`** —
    including the templates (`timeAgo`, `skillDetail`), so `progress.ts` computes numbers and never
    spells a sentence. An unpractised skill has **no** detail line: the pips already say `new`, and
    the copy deck has no sentence for it.
  - `/progress` numbers all come from the pure `$lib/practice/progress.ts` (totals, 28-day strip,
    7-day accuracy, per-skill cells and detail lines); the screen is markup over HUD primitives.
    Its detail line is rendered inline for practised skills instead of on hover/focus — the space is
    reserved either way and hover-only information is unreachable by keyboard and touch.
  - A fifth generic extension to ADR §5: `ExerciseDefinition.skillLabel(skillId, settings)` names an
    exercise's own skills for the grid (fallback: the id's last segment). The screen never decodes an
    id.
  - Tests: `idb` needs the whole IDB global family, so a spec that touches storage imports
    `fake-indexeddb/auto` and installs a fresh `IDBFactory` per test; nothing else in the suite has
    IndexedDB, which is exactly how a degraded browser behaves.
- **Spaced repetition (slice 9a)** — see [`docs/decisions/0003-spaced-repetition-scheduling.md`](docs/decisions/0003-spaced-repetition-scheduling.md),
  which supersedes ADR 0002 §3:
  - **`$lib/practice/scheduler.ts` is SM-2-lite and takes its clock as an argument.**
    `review(state, { correct, at })` → `{ easiness, intervalDays, dueAt }`. Pass: easiness `+0.1`
    (cap `2.8`), interval `0 → 10 min → 1 day → × easiness` (cap `180 d`). Miss: easiness `−0.2`
    (floor `1.3`), interval `0`, **`dueAt = at`** (due now, so a fumble comes back in the same
    session). **`score` never enters the schedule** — it drives mastery; for recall a half-right
    answer is a miss. The ten-minute first rung is deliberate (one right answer is not learning).
  - **The schedule is replayed from the log, never trusted from the record**: `applyAttempt` folds
    `review()` in inside `$lib/practice/mastery.ts` (at the attempt's own `ts`), so `deriveSkills()`
    reproduces it and a reload cannot wipe it
    (ADR 0002 §3's trap). Consequently **no `PRACTICE_SCHEMA_VERSION` bump** — the three fields were
    already in the record and the export payload, and only their meaning narrowed.
  - **`new` is not `due`**: `isDue` needs `reps > 0`, so an unpractised skill is `new` (UX §6.2) and
    `N due` counts **overdue + weak** only. A card, a panel band and the `DUE NOW` counter all read
    the same number from the planner — never their own count.
  - **`$lib/practice/planner.ts` is the pure selector**: `buildPlan(exercises, skills, now)` → the
    ordered items, `dueCount`, `byExercise` and the first `pick`. Order: **overdue** (longest wait)
    → **weak** (weakest) → **new** (the exercise's own order), ties on `skillId`. A skill that is
    practised, not weak and not yet due is **absent** — padding the plan would make `N due`
    meaningless. Home's `Practice now` opens `plan.pick`'s exercise; `/progress`'s `Drill these`
    opens its own.
  - **A targeted run is a bias, not a restriction** (`?due=1`): the runner draws up to
    `TARGET_SAMPLE_TRIES` (16) seeds and keeps the first question whose `skillId` the planner asked
    for, passing `targetSkillId` into `generate()` for the day an exercise honours it. No draw
    lands ⇒ an ordinary question, never a hang. The runner still compares ids and nothing else, so
    it learns nothing about any exercise. **The target set is `targetSkillsFor()`'s overdue/weak
    items only** — it falls back to the `new` ones just for an exercise that owes nothing. A bias's
    strength is what it excludes: including 31 unseen skills of 36 accepted the first draw ~89 % of
    the time and made `?due=1` indistinguishable from an ordinary drill.
  - The schedule's wording is in `copy.ts` like everything else: `dueNow` (`12 due`), `dueBadge`
    (`Due 4`), `skillsDueToday`, `timeUntil` (`in 3 h` / `now`), and `skillDetail` now carries
    UX §6.2's `due …` clause. The word `due` is always in the text — `--warn` only carries it.
  - **An abandoned reveal now pauses** (fixed here, broken since slice 4): `#finish()` re-arms the
    idle timer, and `resume()` returns to the *reveal* (replaying the answer) instead of re-asking a
    question that is already graded and logged.

- **The mixed session (slice 9b)** — `/session` is the ordinary runner with three things supplied
  from outside; **no exercise is special-cased anywhere**:
  - **Three new runner options, all generic**: `pickExercise()` (which exercise the next question
    comes from — `definition` is now `$state`, so the rail's title follows the *question*, not the
    route), `shouldContinue()` (checked in `#next()` **between questions only**, so a session that
    runs out of time never cuts an answer or a reveal in half) and `onEnd()`. `RunnerPhase` gained
    `summary` (UX §4.2 always listed it) and `runner.end()` is what `Esc` calls in a session; a
    plain `/practice/<id>` passes none of them and behaves exactly as before.
  - **Pure composition in `$lib/practice/session.ts`**, reactive half in `session.svelte.ts`
    (`SessionRun`, one per session, never a singleton) — the same split as `runner.svelte.ts` /
    `playback.ts`. `buildSessionQueue(plan)` is a **round-robin over the exercises**, plan order
    inside each one, so the session opens on `plan.pick` and every exercise is in it. Dealing
    globally by urgency ("the most urgent skill that is not the last exercise asked") *looks*
    right and is wrong: with 12/7/5/36 skills it alternates between the two lowest-ranked
    exercises and never reaches the other two. The queue is the **whole** plan and `SessionCursor`
    **cycles** it, because a session is timed, not counted.
  - **An empty plan still mixes.** A user with every skill practised, none overdue and none weak
    gets `items: []` (a practised-not-due skill is deliberately absent from the plan), so the queue
    is empty — and that is the *well-practised* user, exactly the one who earned a mixed session.
    `SessionRun` then round-robins the **registry** (`#nextFallback()`), never `#order[0]`
    repeated, and `targetSkills()` stays `[]`, so the questions are ordinary ones. Same shape as
    `targetSkillsFor()`'s "an exercise that owes nothing falls back to its whole list".
  - **A session is a length, not a question count**: 5 / 10 / 20 min (`sessionLengthMin` in
    `settings`, default 10, home's segmented control), the rail's `ProgressBar` is `label="Time"`
    counting **down**, and the clock starts at the **first question** (`pickExercise()`), not at
    mount — a screen nobody has started has spent no time. `mm:ss` is `clockTime()` in `copy.ts`;
    the summary's `10:04` is deliberately a little *over* the length.
  - Targeting reuses slice 9a's bias unchanged: `sessionTargets()` = the item's own skill first,
    then the rest its exercise owes, handed to the runner's rejection sampling. A bias, not a
    filter.
  - **The summary is a full screen that replaces the runner**
    (`$lib/components/session/SessionSummary.svelte`), never a modal: `Ring` + three readouts,
    `SKILLS TOUCHED` `ListRow`s (max 6, |delta| descending, ▲ / ▼ / ● **and** a signed number —
    never colour alone; `flat` is a real third state, a wrong answer at mastery 0 moves nothing,
    so it takes `●` + `neutral` rather than a green ▲ over `±0%`), the weakest line in a well, `Space` = practice again, `Esc` = done. Numbers
    from the pure `summariseSession()`; wording from `copy.ts` (`sessionComplete`,
    `sessionWeakest`, `masteryDelta`). Mastery deltas are read **from the practice store** either
    side of `record()` — the store is the one authority on mastery — and an unpractised skill's
    first session is a rise from zero, not "no change". A session nobody answered navigates home
    instead of showing three zeros.
  - `ListRow` gained an optional `trailing` snippet (the row's mastery pips) — an extension, like
    `Button`'s `testId`/`ariaPressed`, never a fork.
  - **Home is the session's front door** (UX §3): the hero opens `/session`, `Space` **or any MIDI
    note-on** anywhere on `/` starts it (the computer keys are note-ons too, by design), the length
    control sits under the hero, and the `TODAY` card (attempts · accuracy · day streak + the
    7-day `Meter`) replaces the "How this works" well once there is a history.

- **Export / import (slice 5b)** — the payload is
  `{ schemaVersion, exportedAt, settings, skills, attempts }`, epoch ms throughout, file
  `piano-trainer-YYYY-MM-DD.json`. Split in two, the same way the runner splits state from audio:
  - `$lib/practice/transfer.ts` is **pure** — build, serialise, `parsePracticeFile()` — and
    `$lib/practice/download.ts` is the browser half (`Blob` + anchor click; nothing leaves the
    machine, there is no endpoint) plus the one shared `exportPracticeData()` that `/settings` →
    Data and `/progress`'s `Export JSON` both run. UI is `$lib/components/settings/DataSection.svelte`.
  - **Import replaces, in one transaction**: `practice.replaceAll()` → `PracticeStorage.replace()`
    clears and rewrites `attempts`/`skills`/`meta` inside a single `tx`, so a refused or interrupted
    import changes nothing at all. It runs **on the write queue**, so an attempt recorded a moment
    earlier cannot land on top of the imported log, and it ends in `reload()` (replace), never
    `hydrate()` (merge). Without storage the import applies in memory and sets `degraded` **without**
    `onError` — the storage banner's sentence is about a lost attempt; the import has its own line.
  - A stranger's file gets the storage layer's own rule: every record through
    `parseAttempt`/`parseSkill`, unknown records dropped, an unkeyed attempt keyed on read — but a
    file that *offers* records of which **none** parse is refused, because importing it as nothing
    would quietly empty a real log. A higher `schemaVersion` is refused with the copy deck's line; a
    lower one is still read.
  - **"The file carries no settings" is its own case**, not the defaults: `PracticeFile.settings` is
    `AppSettings | null` and the import skips `applySettings` for `null`. `parseSettingsValue()` is
    lenient on purpose (a half-written `localStorage` must still boot, so every missing field comes
    back as its default), so collapsing a missing/corrupt/empty block into it would let an
    attempts-only file from another device silently reset the taught keyboard range, the remembered
    piano, the instrument and the tempo — while the banner only mentions attempts and skills. A block
    with at least one key is ours (our export always writes them all) and still fills its gaps from
    the defaults.
  - **Anything that reads storage re-reads it**: `settings.hydrate()` is one-shot, so export uses
    `settings.read()` (parses `localStorage` fresh) and `practice.sync()` (drains the write queue,
    then re-reads). Never export the hydrated snapshot. A field that a *reader* stamps afterwards is
    written with `settings.patchStored()` (re-read, then merge), not `patch()`, which would write
    this tab's whole stale snapshot back over another tab's edits to record one field —
    `lastExportAt` is the only such field today.
  - **The volume slider is the one continuously-changing control**: `audio.setVolume` moves the gain
    now and persists through `settings.patchSoon()` (250 ms trailing debounce); `settings.flush()`
    commits it early (the slider's `change`) and `read()` flushes first. Everything else still uses
    `patch()`.
  - `lastExportAt` is a **setting**, not practice data — it describes this browser, so an import
    applies every other field and leaves it alone. Import restores settings through their owners
    (`audio.setVolume/setMuted/setInstrument`, `metronome.setTempo/setBeatsPerBar`,
    `midiInput.select`), never by patching `settings` behind the engine's back.
  - Export/import wording lives in `$lib/practice/copy.ts` (`exportDone`, `importDone`,
    `importWrongVersion`, `dataStats`), with the results shown **both** as a banner (the spec's
    channel) and as an inline `✓`/`✗` line in the section (the banner stack is capped at two).
  - A remembered MIDI device that is switched off has no `<option>`, and a `<select>` whose value
    matches none renders **blank** instead of its placeholder: what it displays comes from the pure
    `deviceValue(key, devices)` in `$lib/midi/status.ts`. The key itself stays remembered.
  - **The same blank-`<select>` rule binds the instrument**, which has no placeholder to fall back
    to: `audio.setInstrument()` validates the id **before it persists it** (`isInstrumentId` →
    `DEFAULT_INSTRUMENT`), not only before it loads it, so a junk id from an **imported file** can
    never leave `/settings` showing nothing while the default plays. The guard lives in the engine
    because `storage` may not import `$lib/audio/instruments` — and it therefore covers the import
    path only: a junk id hand-edited into `localStorage` is read by `settings.hydrate()`, which
    never goes through the engine, and still renders the `<select>` blank at boot.
- **Destroying practice data asks first** (Settings → Data, sci-fi-screens.md §8.5): the reset is
  `practice.resetAll()` — a `replaceAll` with nothing, so it is the same single transaction on the
  same write queue, and an attempt recorded a moment earlier cannot survive it. Settings are not
  practice data and are never touched. The affordance is the pure reducer
  `$lib/practice/reset.ts` (`confirmReducer`/`canConfirm`/`matchesConfirmWord`), **never
  `confirm()` and never a dialog**: re-asking always reopens with an empty field, a cancel changes
  nothing at all, and `working` ignores a cancel because the transaction is already queued. The
  same confirmation guards an import that would **empty** the log (`ConfirmTarget`
  `empty-import`): `parsePracticeFile()` cannot refuse an honest export of an empty log, so the
  question is asked in the UI instead — `offered > 0 && parsed === 0` stays the parser's only
  guard.
- **The `AudioContext` starts on a capture-phase listener** in `+layout.svelte`. A piano key's own
  `pointerdown` runs at the target first, so a bubble-phase start was always one press too late and
  the first click was silent.
- `PianoKeyboard` (`$lib/components/piano/`) is the one keyboard, for input *and* exercise display:
  props `range/layout/highlights/labels/labelStyle/spellings/interactive/maxHeightPx`,
  `onNoteOn/onNoteOff`
  callbacks out. Parents pass a `Map<Midi, KeyHighlight>` (`played` included) — the component holds
  no exercise state and plays no audio. Its pixel maths lives in `geometry.ts`, whose constants
  mirror the keyboard tokens because layout maths cannot read CSS variables. It keeps roving focus
  alive when a key it owns goes `dim` (a disabled element drops focus to `<body>`), and marks itself
  `data-piano-keyboard` so a screen can tell a key press apart from a shell shortcut.
- App shell: `$lib/components/shell/` — `TopBar` (nav model and active-route rule in the pure
  `nav.ts`), `StatusChip` (top-bar status, never colour alone), `BannerStack`
  (`banners.svelte.ts`: non-blocking one-liners, max two, oldest wins) and `Placeholder` (skeleton
  screens). New global messages go through `banners.show(...)`, never through a dialog.
  **The top bar never wraps** (bug ac6327a3): Chakra Petch is not self-hosted, so with a fallback
  face its natural width is ~1340 px. Brand and nav are `nowrap` + `flex-shrink: 0`, and the bar
  compacts in three literal-px steps instead — tighter spacing below 1366, the wordmark's mark alone
  below 1280 (the word visually hidden, so the link keeps its name), glyph-only `StatusChip`s at
  ≤ 1100 (the state stays in `aria-label` + `title`). The status column is the only part that may
  shrink, as a last resort (labels ellipsise). `e2e/top-bar.spec.ts` measures 768–1440 px; a new nav
  item or a longer chip label re-checks it. Below 768 px (phones, a non-goal) it is not guaranteed.
- **UI**: all colours, sizes, spacing and durations come from `$lib/styles/tokens.css` (copied from
  [`docs/design/tokens.css`](docs/design/tokens.css)) — **no raw hex or magic px outside that file**.
  Dark-first. Correct/wrong/target states always pair colour with a glyph (never colour alone), and
  **no modal dialogs while an exercise is running** — use the banner/strip patterns in the UX spec.
  *One exemption*: hairlines, press offsets, insets and one-off keyframe distances that the UX spec
  fixes literally (the piano key's 3 px black-key radius, 2 px press offset, 4 px edge bar, …) stay
  literal in the component that draws them — tokenising a single-use 2 px only hides where it came
  from. Cite the spec section in a comment; everything reusable still becomes a token.
  Shared HUD primitives from the sci-fi language (`HudPanel`, `MicroLabel`, `Chip`/`Badge`/
  `GlyphBadge`, `Button`, `ProgressBar`, `MasteryPips`, `Ring`, `Meter`, `ListRow`) live in
  `$lib/components/hud/` and may import nothing but tokens and icons; icons are inline SVG Svelte
  components in `$lib/components/icons/` — **no icon font, no icon package**. They landed with
  redesign pass 1 and every screen from pass 2 on **reuses them instead of re-styling a panel,
  a button or a pip row**.
- **The HUD skin, in practice (redesign pass 1)** — the sci-fi values are live; the old dark
  palette notes above them are superseded:
  - **Chamfer + glow are two classes, not a copy-paste**: `.hud-cut` (+ `-lg`/`-sm`) and `.hud-glow`
    (+ `-hot`/`-accent`/`-success`) in `$lib/styles/hud.css`, imported once in the root layout.
    The markup is always **glow → edge → face**: `clip-path` is applied *after* `filter`, so a
    chamfered element cannot wear its own glow, and the 1 px luminous edge is a background with the
    face inset 1 px (a real border would be clipped away). The edge is `display: flex` and the face
    `flex: 1`, so the inset holds at any height.
  - **A panel repeated once per exercise glows only when hot** (refinement-pass.md §1, R1): home's
    exercise cards and `/progress`'s groups pass `HudPanel glow="hot-only"` — full anatomy, no
    filter at rest; a link card takes the hot glow on `:hover`/`:focus-visible`, a non-link group on
    `:focus-within` (never hover). The recipe is `.hud-glow-hot-only` in `hud.css`. So home's page costs
    hero + Today + ≤ 1 hot card at any registry size (plus the shell's constant three: wordmark and
    the two top-bar status chips — the spec's "≤ 4" tally missed the chips; 5 at rest) — **every new per-exercise panel
    uses it**. `filter` is never transitioned (the swap is discrete); the e2e
    `repeated panels glow only when hot` counts the layers.
  - Glows are **static** `drop-shadow`s, ≤ 10 px blur, ≤ 12 on a screen. `drop-shadow()` takes no
    spread, so the `--glow-*` box-shadow tokens cannot be reused there: `hud.css` mixes the same
    tokens into `--hud-glow-*` colours with `color-mix`. That is the *only* place a colour is
    derived, and it still starts from a token.
  - **`--on-accent` is white, and it is only valid over `--grad-primary` / `--accent-deep`.** It
    clears AA on the gradient's stops (4.65 / 8.62) but measures **2.77 on flat `--accent`** — so a
    *filled* accent surface is the gradient (pressed toggles, the active beat pip, a played key),
    while flat `--accent` stays a border, glyph, link and text colour. The other `--on-*` roles all
    resolve to `--bg-0` and are unaffected; this one role sign-changed in the re-skin, so a
    pre-re-skin `background: var(--accent); color: var(--on-accent)` pair is always a contrast bug.
  - **A key face is not a panel.** Piano-key labels (and the `◇` ghost glyph) take **`--key-ink` on
    white keys** and **`--text-2` on black keys** — the two ink roles the spec's §9 pairs with the
    key tokens (15.57 / 10.87). `--text-3` is panel text: on `--key-white` it measures 2.61 (2.26 on
    hover), and `--key-ink` on `--key-black` is 1.02, so neither role survives being used on the
    other face.
  - **Focus on a chamfered element** drops `outline` (it follows the unclipped rectangle) and turns
    the edge layer into the ring: edge → `--focus`, face margin → 3 px.
  - **Focus on a piano key is its own rule.** `--focus` measures **1.19 on `--key-white`**, and the
    global ring's `outline-offset: 2px` lands on the white *neighbours*, so a key wears a dual-tone
    ring drawn inside its face: `outline: 3px solid var(--focus); outline-offset: -5px` plus
    `inset 0 0 0 2px var(--bg-0)` (sci-fi-screens.md §2.1). Never reuse the global ring on a key.
  - Headings, buttons, labels, numerals use `--font-display`; **body copy stays `--font-sans` and
    uppercase stops at 20 px**. Uppercase is always `text-transform`, never in the DOM text — but
    note that **Chromium folds `text-transform` into the accessible name**, so a Playwright
    `getByRole(..., { name })` on uppercased text needs a case-insensitive regex.
  - The page texture (grid + scanline + vignette) lives on `<body>` in `app.css` only; panels are
    opaque so it never crosses text, and the scanline is dropped under `prefers-reduced-motion`.
  - Mastery is **always** `MasteryPips` + the percentage, quantised by the pure
    `hud/mastery.ts` (7 pips, `round(mastery * 7)`, `null` = never practised = the word `new`).
  - **Dark-only is a decision, not a default** (redesign pass 2a): `tokens.css` was re-copied from
    the spec — it added `--grad-key-white`/`--grad-key-black` and dropped the dormant
    `[data-theme='light']` block, and the `hud.css` light branch went with it. `app.html` keeps
    `data-theme="dark"` as a marker of intent. A light theme is its own ticket with its own contrast
    pass; never re-add a light override.
  - **Developer pass 2b has landed — the redesign is closed.** Free Play, Settings and the four
    §6.3 gaps are in the part-2 language (`docs/design/sci-fi-screens.md` §6, §8). `/progress` and
    `/session` land with slices 5 and 9, in this language; they are the only screens still wearing
    the new tokens with an older treatment.
- **The runner and the keyboard in the part-2 language (redesign pass 2a)**:
  - `PianoKeyboard` draws a **bed**: `--key-bed` face, 1 px `--border` edge, one `--chamfer-lg` clip
    for the whole component, and a 6 px apron with a `--grad-rule` hairline and a `--cyan` tick per C
    (dropped on a compressed bed — `showsApron()` in `geometry.ts`). **Keys are never chamfered and
    a lit key glows with `box-shadow`, never `filter: drop-shadow`**, so a ten-note chord costs no
    composited layer and stays out of the ≤ 12 filter budget. The two shadow slots compose:
    `--key-press` (press / ghost inset) then `--key-glow` (state glow), with the focus keyline
    appended last — no state restates another's shadow.
  - **A piano key's focus ring is its own rule** (never the global one): `outline: 3px solid
    var(--focus); outline-offset: -5px` plus `inset 0 0 0 2px var(--bg-0)`, drawn inside the face.
  - Key glyphs are 16 px (`--fs-body`), labels 12 px (`--fs-micro`, 10 px below `W` = 32 px — the one
    place the label floor bends, UX §5.3).
  - The bed's chrome is part of the component's height: a parent that budgets the keyboard subtracts
    `BED_CHROME_H` from the space it passes as `maxHeightPx` (the runner does).
  - The runner's phase micro-label (`READY` · `LISTEN` · `ANSWER` · `RESULT` · `PAUSED`) comes from
    the pure `$lib/exercises/phases.ts` — labels live in a tested module, never in a component, the
    same rule as `feedback.ts` and `midi/status.ts`. **No emoji anywhere**: the streak is a HUD
    readout, and `✓ ✗ ◆ ◇ ⤳ ▶ ■ ⤢ !` are copy and stay.
  - `ProgressBar` paints `--grad-data` on a **full-track layer** and reveals it with `clip-path`
    (`--ramp-scale` is gone): the colour at any x is fixed by position *during* the transition too.
  - Primitive extensions this pass made, instead of forking a primitive: `Tone` gained `hint`
    (the reveal state), `hud.css` gained `.hud-glow-danger`/`.hud-glow-hint`, and `Button` gained
    `testId` so e2e can assert on the real control rather than a wrapper.
- **Free Play and Settings in the part-2 language (redesign pass 2b — closes the redesign)**:
  - **A form field is `hud-field hud-cut hud-cut-sm`**, the §5.11 recipe shared from
    `$lib/styles/hud.css` for the same reason the chamfer is: Settings and the metronome panel both
    dress native `<input>`/`<select>`s, and a copy-pasted recipe is how two screens drift. A clipped
    field cannot wear the global ring (`outline` follows the unclipped rectangle and is cut away), so
    its **own border becomes the ring** and an inset keyline carries `--focus` inside the clip.
  - **The tempo field displays the *committed* value** (§8.4). Commit on `change` and blur — never on
    `input`, which would rewrite `1` to the minimum before the `20` of `120` arrives — then write
    `metronome.bpm` back into the field, so it and the engine can never disagree. `Escape` reverts the
    field and leaves the tempo alone. The pure half is `$lib/audio/tempo-field.ts`
    (`readTempoField`, `TEMPO_RANGE_HINT`); out of range is `--warn` + the hint, never `--danger`
    (danger means *wrong* in the answer path). **The hint's numbers come from the scheduler's
    constants** (`MIN_BPM`–`MAX_BPM` = 40–240), not from the spec's illustrative `30–300`.
  - **What the device `<select>` says is a function of `MidiStatus`**, not of `devices.length`:
    `deviceSelect()` / `deviceAction()` in `$lib/midi/status.ts`, unit-tested. Saying "No device
    found" before `requestMIDIAccess` has ever run is a lie — we have not looked. A disabled select
    still shows its current option, so the state is never blank, and `denied`/`unsupported` get no
    request button because asking again would change nothing.
  - The Settings **preview keyboard is 72 px** (§8.3 amends UX §6.3's 48: at 49 keys that left ~7 px
    of key face), and the **sticky section rail** (`$lib/components/settings/SectionRail.svelte`) is
    rendered only at ≥ 1100 px. Its links are plain anchors so deep links and the keyboard work with
    the `IntersectionObserver` switched off — the observer only *decorates* the active item. The rail
    is a panel (glow → edge → face) and the active item's `--glow-accent` belongs to its 2 px
    `--accent` bar, drawn as a `::before`, not to the whole link rectangle.
  - Settings' inline state beside each select is the top-bar pill's smaller sibling, so it wears the
    pill's label treatment — **not** `MicroLabel`: `midiChip().label` *is* the device name once
    connected, and a proper noun is not shouted (the same deviation `StatusChip` already ships).
  - Free Play's readout is **the same sunken well as the runner's prompt**, so the two screens feel
    like one instrument: hot micro-label (`CURRENT NOTE` at 0–1 notes, `CURRENT CHORD` at 2+), the
    value in `--font-display` with `--glow-text`, held notes in `--cyan`. **No input/level meter** —
    we have pitches, not a level (deviation 18).
  - `Button` gained `ariaPressed` (the metronome's Start/Stop) rather than being forked, the same
    move pass 2a made with `testId`.
  - **A re-skin restyles the document outline, it never deletes it.** Where a `HudPanel`'s header
    band replaces what was a heading, it *is* the heading: `HudPanel` takes `headerAs="h2"` +
    `headerId` (forwarded to `MicroLabel`'s `as`/`id`), and the `<section>` around it is
    `aria-labelledby` that id. Settings' four sections and the metronome panel are built that way,
    so `/settings` and `/play` keep their `<h2>`s and their named regions. Uppercasing is still
    `text-transform`, so the accessible name keeps its casing — a Playwright `getByRole('heading')`
    on one needs a case-insensitive regex.
  - **Anything focusable is either the `Button` primitive or clips its inner `edge`/`face` spans,
    never itself.** The global ring paints outside the border box, so `clip-path` on a focusable
    element erases it — that is why the metronome's `−`/`+` nudges are `Button`s with `ariaLabel`
    (§6 asks for secondary buttons anyway) and not native buttons wearing `hud-cut`.
  - `Chip variant="key"` renders a **`<kbd>`**: it is the shortcut hint the copy deck spells out, and
    the re-skin changed its skin, not its semantics.
  - **The sound chip's `🔇`/`🔈`/`🔊` stay.** §2.7 retires emoji from the HUD but exempts these:
    they are *copy* (`SoundChip.glyph` in `$lib/audio/status.ts`), so they are out of the re-skin's
    reach and recorded as a known inconsistency — do not "fix" them without a copy change.
- Prettier: single quotes, width 80, trailing commas, LF, 2 spaces. Commits follow **Conventional
  Commits** (`feat:`, `fix:`, `docs:`, `chore:`) — enforced by commitlint.
- Tests: pure logic (theory, grading, scheduler, MIDI parsing) always gets a Vitest test; glue and
  markup usually do not — components may be mounted with `@testing-library/svelte` when the markup
  carries a rule (a11y, highlight states), which is why `vite.config.ts` resolves the `browser`
  condition under Vitest and `vitest-setup.ts` stubs `ResizeObserver`. Playwright covers a thin smoke path per exercise. Unit tests sit next to
  the module (`nav.ts` → `nav.test.ts`); e2e specs live in `apps/web/e2e/`.
- **An e2e spec waits on a signal the app gives, never on a sleep** — no `waitForTimeout`, no bumped
  timeout, no `test.slow()`, no retry bump. Which signal depends on the screen: `/practice/<id>` and
  `/session` are client-rendered, so the `Ready?` prompt (and the `replay` control re-enabling, once
  a question is playing) already proves the client is there; `/progress` renders both its panels
  behind `practice.hydrated`. **`/play`, `/settings` and `/progress` are prerendered**, so their
  buttons, fields and piano keys are on screen with no handlers on them and a press in that window is
  lost — those specs call `appIsListening(page)` (`e2e/support.ts`), which waits for SvelteKit's
  `#svelte-announcer`: it is client-only and rendered from the *root* component's `onMount`, which
  runs **after** `+layout.svelte`'s (a parent mounts after its children), i.e. after
  `computerKeyboard.attach(window)`, the capture-phase audio starter and `settings`/`practice`
  hydration. The same wait is what makes a *negative* assertion on a prerendered screen mean
  anything.
- **Shared e2e helpers live in `apps/web/e2e/support.ts`** (`SOUNDFONT_URLS`, `watchConsole`,
  `appIsListening`) — a new spec imports them, never copies them. Beside `smoke.spec.ts`:
  `data-round-trip.spec.ts` (answer → export → reset → import in real Chromium IndexedDB, a reload
  before every read) and `a11y.spec.ts` (`@axe-core/playwright` on every v1 route, fails on any
  `serious`/`critical` violation). An axe exemption goes in its `EXEMPT_RULES` **with a cited
  reason**, never as a blanket tag filter. axe reports `color-contrast` as *incomplete* on every
  route (gradients and the body texture), so contrast stays owned by the specs' hand-measured §9
  tables — the axe spec does not check it.
- **A unit test waits the same way: on a signal, never on a number of ticks.** For anything queued
  behind the practice write queue that is `await store.flush()` (it loops until the queue's tail
  stops moving), per store — a case with two stores flushes the one whose write it is about. A
  fixed drain (`for (…20…) await Promise.resolve()` + one `setTimeout(0)`) is a guess: a write that
  queues behind `openPracticeStorage()` can need far more turns on a loaded runner, which is what
  made `store.svelte.test.ts` flake `master` red on `5836f1a`, and `DataSection.test.ts` under
  full-suite load after it. There is **no drain left**: where the wait spans a component's own
  `await`s (the file picker, the parse, the re-render) as well as the queue, wait with
  `vi.waitFor` on the **last thing that path does** — `DataSection`'s `✓`/`✗` result line (written
  after `replaceAll()` resolves) or the focus it moves — and after a synchronous state change use
  `await tick()`, Svelte's own "applied" signal, never `await Promise.resolve()`.
- **The runner's no-scroll guard (§4.1) is measured in the tallest state**: 1280×720 (the config's
  default viewport, spelled out where it is the point) with the **no-MIDI strip showing** — `Got it`
  is the stable handle on that strip, since its sentence depends on what the browser says about Web
  MIDI — and, in a `note-sequence` drill, with the widest shortcut bar (`⌫ clear last` on top of the
  whole computer mapping and `Z` / `X`). `/session` carries the same guard as the four drills: it is
  the same frame.
- `apps/web/src/lib/styles/tokens.css` is a byte-for-byte copy of `docs/design/tokens.css` — change
  the spec first, then re-copy. Both files, and everything under `docs/`, are Prettier-ignored so
  they do not drift.

## Working agreements

- Ship **vertical slices**: every slice after the scaffold must leave an exercise that is usable
  end-to-end, with the on-screen keyboard when no MIDI device is connected.
- Feature branches + pull requests, squash merge into `master`; CI must be green.
- Record new conventions here and notable technical decisions as an ADR in `docs/decisions/`.
