# piano-trainer — conventions for agents

A local-first web app that trains jazz-piano **ear** skills at a MIDI digital piano. No accounts, no
backend, static hosting. Desktop browser first.

**Read first**: [`docs/decisions/0001-target-architecture-and-stack.md`](docs/decisions/0001-target-architecture-and-stack.md)
— it fixes the stack, the internal music vocabulary, the exercise contract and the slice order.
Anything below is the short version; the ADR wins on detail.

**Before building any UI**: [`docs/design/core-practice-ux.md`](docs/design/core-practice-ux.md) —
routes, app shell, exercise-runner states and timing, piano-keyboard spec, tokens, a11y rules and the
copy deck. It is authoritative for layout, states, copy and visuals; do not invent UX.

## Repository layout

| Path | What |
| --- | --- |
| `apps/web/` | The SvelteKit app (the rewrite). All new work goes here. |
| `apps/web/src/lib/{theory,audio,midi,exercises,practice,storage,components}` | Domain modules — see the layering rule below. |
| `legacy/electron-app/` | The frozen 2022 React/Electron app. Reference only; excluded from CI. Do not modify; it is deleted in its own ticket once the web app reaches parity. |
| `docs/decisions/` | ADRs. |
| `docs/design/` | UX specs. |

Slice 1 has landed: the workspace root holds `package.json` (all scripts), `pnpm-workspace.yaml`
(`apps/*` only — the legacy app is not a workspace member), `eslint.config.js`, `.prettierrc`,
`.nvmrc` (Node 22), commitlint + husky hooks, and the CI/Pages workflows, now active in
`.github/workflows/` (`ci.yml` on every pull request **and every push to `master`**, `deploy.yml`
publishing `master` to Pages). The required status check is the job name
`lint · check · test · build · e2e` (U+00B7 middots — copy it verbatim); the `WIP` check on pull
requests comes from a third-party marketplace app and must never be a required check.

**Pages' source is set by hand and stays that way.** `configure-pages@v5`'s `enablement: true` cannot
create the site — that needs repo admin, which neither `GITHUB_TOKEN` nor an app token has, so the
first deploy died on `Create Pages site failed. Error: Resource not accessible by integration`. A repo
admin must therefore set *Settings → Pages → Build and deployment → Source: `GitHub Actions`* once.
**Owner action, pending as of 2026-09-13**: until it is done, `deploy.yml` fails at `configure-pages`
and https://alexeychikk.github.io/piano-trainer/ stays a 404 — a red deploy run on `master` means
this, not a workflow bug. Once it is set, no code change is needed; re-run the deploy workflow. Never
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

Everything runs from the root and is filtered into `apps/web`; never run a package manager inside
`legacy/`. CI runs exactly this list: `lint` → `check` → `test:unit` → `build` → `test:e2e`, in one
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
  Four documented extensions to the ADR's types (all display concerns, all generic): `Question.range`
  (keys the question is answered on — everything else dims), `Question.spellings` (feeds the
  keyboard's `labelStyle: 'context'`), `GenerateContext.range` (the user's instrument range, so
  `generate()` never reads storage) and a `label` on `ExpectedAnswer` (the reveal is named in text as
  well as shown, a11y §8.6).
- **The runner** is `$lib/exercises/runner.svelte.ts` (state machine, score, streak) plus
  `$lib/components/exercise/ExerciseRunner.svelte` (the §4 frame). **Every drill-rhythm constant
  lives in the runner module** — `FEEDBACK_CORRECT_MS`, `FEEDBACK_STREAK_MS`, `REVEAL_DELAY_MS`,
  `IDLE_PAUSE_MS`, `ADVANCE_LOCKOUT_MS` — never in a component. Audio reaches it through the
  injectable `PlaybackApi` (`playback.ts`, `createAudioPlayback()`), which is also how the state
  machine is tested with fake timers and no Web Audio. Answers arrive as `midiInput` events, so the
  runner cannot tell a MIDI piano from the computer keys. Copy is in `feedback.ts`; keyboard
  highlights are mapped by the pure `components/exercise/highlights.ts`. `f` (focus mode) is
  deliberately **not** a shortcut: `F` is a note key and §4.6 keeps that mapping live — the `⤢`
  button is the keyboard path. The runner sizes itself to the space the shell leaves (`.app` is a
  full-height flex column in `+layout.svelte`) and clips: it must never scroll.
- **Settings** are `localStorage` via the `settings` store (`$lib/storage/settings.svelte.ts`) and
  are read only in `hydrate()`, called from the root layout after mount — module init must not touch
  storage or prerendered HTML and the first client render disagree. Slice 4 added `keyboardLow`/
  `keyboardHigh` (one instrument range, taught by the range wizard in `$lib/midi/range.ts` — a pure
  reducer — and used by every note exercise), `countIn` and `focusMode`. A stored range that is
  inverted or under an octave is not a piano: it falls back to the default.
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
- **UI**: all colours, sizes, spacing and durations come from `$lib/styles/tokens.css` (copied from
  [`docs/design/tokens.css`](docs/design/tokens.css)) — **no raw hex or magic px outside that file**.
  Dark-first. Correct/wrong/target states always pair colour with a glyph (never colour alone), and
  **no modal dialogs while an exercise is running** — use the banner/strip patterns in the UX spec.
  *One exemption*: hairlines, press offsets, insets and one-off keyframe distances that the UX spec
  fixes literally (the piano key's 3 px black-key radius, 2 px press offset, 4 px edge bar, …) stay
  literal in the component that draws them — tokenising a single-use 2 px only hides where it came
  from. Cite the spec section in a comment; everything reusable still becomes a token.
- Prettier: single quotes, width 80, trailing commas, LF, 2 spaces. Commits follow **Conventional
  Commits** (`feat:`, `fix:`, `docs:`, `chore:`) — enforced by commitlint.
- Tests: pure logic (theory, grading, scheduler, MIDI parsing) always gets a Vitest test; glue and
  markup usually do not — components may be mounted with `@testing-library/svelte` when the markup
  carries a rule (a11y, highlight states), which is why `vite.config.ts` resolves the `browser`
  condition under Vitest and `vitest-setup.ts` stubs `ResizeObserver`. Playwright covers a thin smoke path per exercise. Unit tests sit next to
  the module (`nav.ts` → `nav.test.ts`); e2e specs live in `apps/web/e2e/`.
- `apps/web/src/lib/styles/tokens.css` is a byte-for-byte copy of `docs/design/tokens.css` — change
  the spec first, then re-copy. Both files, and everything under `docs/`, are Prettier-ignored so
  they do not drift.

## Working agreements

- Ship **vertical slices**: every slice after the scaffold must leave an exercise that is usable
  end-to-end, with the on-screen keyboard when no MIDI device is connected.
- Feature branches + pull requests, squash merge into `master`; CI must be green.
- Record new conventions here and notable technical decisions as an ADR in `docs/decisions/`.
