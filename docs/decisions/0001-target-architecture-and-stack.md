# ADR 0001 — Target architecture and stack for the Svelte rewrite

- **Status**: Accepted
- **Date**: 2026-09-13
- **Context**: knowledge entries *Product vision: piano-trainer* (product constraints, given) and
  *Codebase overview: piano-trainer* (survey of the existing Electron app).
- **Supersedes**: nothing. The existing React/Electron app is reference material, not a base.

## Context in one paragraph

The repo currently holds a stale (2022) Electron + React 17 + MUI v4 desktop app with two screens
(chord display, single-note ear training). Product wants a full rewrite as a **local-first web app**
for jazz ear training, played at a **MIDI digital piano**, no accounts, no backend, desktop browser
first, shipped as thin vertical slices. This ADR fixes the stack, the internal vocabulary and the
contracts, so that every following ticket is implementation.

---

## 1. App framework — SvelteKit 2 + Svelte 5 (runes) + TypeScript + Vite, static adapter

**Confirmed**, no reason to overrule. Nothing in the old codebase constrains the choice: the only
reusable parts are `@tonaljs/tonal` (framework-agnostic) and the soundfont/Web Audio approach.

- `@sveltejs/adapter-static` with `prerender = true` in the root layout and `fallback: '200.html'`
  — the app is a static bundle with no server, deployable to GitHub Pages.
- `paths.base` comes from `process.env.BASE_PATH` (`/piano-trainer` in CI, empty locally). **Never
  hardcode absolute URLs**; use `base` from `$app/paths` for links and asset URLs.
- TypeScript `strict: true` everywhere (the old app was strict; keep it).
- **Svelte 5 runes only** (`$state`, `$derived`, `$effect`, `$props`). Shared reactive state lives in
  `*.svelte.ts` modules exporting a class instance (a "store object"), not in `svelte/store`
  writables. Exception: nothing. Consistency matters more than taste here.
- No SSR, no server routes, no `+page.server.ts`. If a feature ever needs a server, it gets its own
  ADR.

## 2. Audio — Web Audio directly, sampled piano, lookahead scheduler. No Tone.js.

- **Sample playback**: [`smplr`](https://github.com/danigb/smplr) (`Soundfont` / `SplendidGrandPiano`),
  by the author of `soundfont-player` and `tonal`: maintained, TypeScript, same CDN-hosted
  MIDI-js soundfonts the old app already used. This keeps the survey's "reuse the soundfont
  approach" without inheriting an unmaintained wrapper.
- **No Tone.js**: we need note-on/note-off, a click and short scheduled sequences — not a DAW.
  Tone.js is ~200 kB of transport/DSP we would fight for scheduling determinism.
- **One `AudioEngine`** (`$lib/audio/engine.svelte.ts`) owns the single `AudioContext`
  (`latencyHint: 'interactive'`), a master `GainNode` (volume setting), instrument loading and an
  in-memory instrument cache. It is **created lazily on the first user gesture** (autoplay policy)
  and exposes: `ensureStarted()`, `noteOn/noteOff(midi, velocity)`, `playNotes(notes, opts)`,
  `schedule(plan: PlaybackPlan)`, `stopAll()`.
- **Timing**: everything audible is scheduled against `ctx.currentTime`, never `setTimeout`. Use the
  two-clock pattern (Chris Wilson): a 25 ms `setInterval` tick schedules every event falling inside a
  100 ms lookahead window. The metronome and all exercise playback (arpeggios, progressions, backing
  clicks) use this one scheduler. UI highlight follows via `requestAnimationFrame` comparing
  `ctx.currentTime` — UI may lag, audio must not.
- **Fallback**: if samples fail to load (offline, CDN down) fall back to a built-in
  oscillator+envelope synth so exercises still run; surface a non-blocking banner.
- **Latency budget**: key-press → sound < 30 ms. Do not put note triggering behind Svelte effects or
  awaits; call the engine straight from the MIDI/UI event handler.

## 3. MIDI input — one `MidiInput` store, source-agnostic note events

- Access via `navigator.requestMIDIAccess({ sysex: false })`, requested **on user action** (a
  "Connect MIDI" button / entering Settings), never on page load. Handle the three states explicitly:
  `unsupported` (no Web MIDI), `denied`, `granted`. `statechange` keeps the device list live.
- **Device selection & persistence**: persist `${manufacturer}:${name}` (port `id`s are not stable
  across sessions/browsers), plus per-device settings, in the settings store (§6). On startup,
  auto-select the remembered device if present, else the single available input, else none.
- **Note events**: parse status bytes; `note-on` with velocity 0 counts as `note-off`. Every input
  source emits the same event into the same store:
  ```ts
  type NoteSource = 'midi' | 'onscreen' | 'computer-keyboard';
  type NoteEvent =
    | { type: 'on'; midi: number; velocity: number; at: number; source: NoteSource }
    | { type: 'off'; midi: number; at: number; source: NoteSource };
  ```
  `at` is `performance.now()`. The store holds `heldNotes: Map<number, {velocity, at}>` (a rune-backed
  `$state`) plus a subscribe API for consumers that need the event stream (the exercise runner).
  **Exercises never know which source produced a note** — this is what makes the on-screen keyboard a
  true fallback and keeps grading testable without hardware.
- **Held-chord detection (settling window)**: a chord answer is emitted when the held set is
  non-empty and **no note-on/off has occurred for `CHORD_SETTLE_MS = 90 ms`** (configurable
  50–200 ms in settings; covers rolled chords and imperfect simultaneity). Two capture modes, chosen
  by the exercise's `answerMode`:
  - `chord-sustained` — grade the settled held set while it is still held (used for "play this
    voicing").
  - `chord-released` — grade the union of notes sounded between the first note-on and the moment the
    last key is released (forgiving; good for beginners).
  - `note-sequence` — notes appended in played order; the answer closes after `SEQUENCE_GAP_MS = 1200`
    of silence or when the expected length is reached (melodic dictation, intervals played
    melodically).
  - `single-note` — first note-on wins.
  - `choice` — no MIDI; buttons/keyboard shortcuts (also reachable by number keys 1-9).
- **On-screen keyboard**: `PianoKeyboard.svelte` is a pure presentational component (props: range,
  highlight map, labels on/off) that emits the same `NoteEvent`s on pointer/keyboard interaction.
  It is also the exercise display surface (target notes, correct/wrong highlighting) — one component,
  two jobs, no duplicate key-drawing code. A computer-keyboard mapping (`a w s e d …` = white/black
  keys from a movable octave) is the third source, so the app is fully usable on a laptop.
- Keep the old app's good idea: a **range wizard** ("press your lowest key, now your highest") to
  learn the connected keyboard's range, stored per device.

## 4. Music theory core — tonal, behind our own thin facade; MIDI numbers are the identity

**Use `tonal` (v6, scoped `@tonaljs/*` packages), wrapped in `$lib/theory`.** Writing our own
interval/chord tables is a solved problem and the old app already proved tonal fits. But no exercise
or component imports tonal directly — they import `$lib/theory`, so the dependency stays swappable
and our vocabulary stays small and stable.

Canonical representation — **the integer MIDI note number is the runtime identity of a pitch**;
spelling exists only for display:

```ts
export type Midi = number;          // 0..127, C4 = 60 (middle C)
export type PitchClass = number;    // 0..11, C = 0
export type Semitones = number;     // signed interval size
export type NoteName = string;      // tonal spelling for display only, e.g. 'Eb4'

export type ChordQuality =
  | 'maj' | 'min' | 'dim' | 'aug' | 'sus4'
  | 'maj7' | 'dom7' | 'min7' | 'min7b5' | 'dim7' | 'minMaj7' | 'maj6' | 'min6'
  | 'dom9' | 'maj9' | 'min9' | 'dom7b9' | 'dom7sharp9' | 'dom7alt';

export interface ChordSymbol {
  rootPc: PitchClass;
  quality: ChordQuality;
  bassPc?: PitchClass;             // slash chords / inversions
}

export type VoicingKind =
  | 'close' | 'shell' | 'rootlessA' | 'rootlessB' | 'guideTones' | 'drop2' | 'spread';

export interface Voicing {
  kind: VoicingKind;
  /** semitone offsets from the chord root, may exceed 12; root itself is 0 and may be absent */
  offsets: Semitones[];
}

export interface VoicedChord {
  symbol: ChordSymbol;
  voicing: Voicing;
  notes: Midi[];                   // absolute, sorted ascending
}

export interface ProgressionStep { chord: ChordSymbol; beats: number }
export interface Progression { key: PitchClass; name: string; steps: ProgressionStep[] }
```

Rules of the vocabulary:

- **Comparison and grading happen on `Midi[]` or on pitch-class sets** (`Set<PitchClass>`), never on
  strings. Enharmonics are equal by default (`Eb` === `D#`); an exercise may opt into spelling-aware
  grading later, but v1 does not.
- Helpers live in `$lib/theory`: `midiToName`, `nameToMidi`, `pcOf`, `intervalBetween`,
  `transpose`, `detectChords(notes): ChordSymbol[]` (tonal's `Chord.detect` normalised to our
  types), `voice(symbol, kind, options): VoicedChord`, `randomChord(seed, constraints)`.
- `$lib/theory` is **pure TypeScript**: no DOM, no Svelte, no audio, no randomness other than an
  injected seeded RNG. This is what makes it exhaustively unit-testable and, later, cheap to extract
  into `packages/theory`.

## 5. Exercise engine contract

One interface; the runner and the progress system know nothing else. Adding an exercise = adding a
folder under `$lib/exercises/<id>/` with a definition and an optional answer component, and
registering it in `$lib/exercises/registry.ts`.

```ts
export type ExerciseId = string;                 // 'interval-recognition'
export type SkillId = string;                    // 'interval:P5:asc'  — the SR/mastery unit

export interface Question<P = unknown> {
  id: string;                                    // uuid for the attempt log
  seed: number;                                  // question is reproducible from (exerciseId, seed, settings)
  skillId: SkillId;
  payload: P;                                    // exercise-specific (e.g. { rootMidi, semitones })
  prompt: Prompt;                                // what the user sees before answering
  playback: PlaybackPlan;                        // what the user hears (replayable, space bar)
  answerMode: AnswerMode;
  choices?: Choice[];                            // for answerMode 'choice'
  expected: ExpectedAnswer;                      // used by grade() and by "reveal"
}

export type AnswerMode =
  | 'single-note' | 'note-sequence' | 'chord-sustained' | 'chord-released' | 'choice';

export interface PlaybackPlan {
  /** events are relative to plan start, in ms; the AudioEngine schedules them on the audio clock */
  events: Array<{ atMs: number; notes: Midi[]; durationMs: number; velocity?: number }>;
  tempoBpm?: number;
  countIn?: boolean;
}

export interface Prompt { title: string; subtitle?: string; showKeyboard?: boolean }

export type Answer =
  | { kind: 'notes'; notes: Midi[]; order: Midi[]; source: NoteSource }
  | { kind: 'choice'; choiceId: string };

export interface Grade {
  correct: boolean;
  /** 0..1 — partial credit (e.g. 3 of 4 chord tones) drives mastery, not just pass/fail */
  score: number;
  feedback?: string;                             // one short line, e.g. 'That was a minor 6th'
  revealed?: { notes?: Midi[]; label?: string }; // what to show on the keyboard after a miss
}

export interface GenerateContext<S> {
  settings: S;
  rng: () => number;                             // seeded; never Math.random inside an exercise
  seed: number;
  /** SR-selected target, if the session planner picked a specific due skill */
  targetSkillId?: SkillId;
  history: { recentSkillIds: SkillId[] };        // to avoid immediate repeats
}

export interface ExerciseDefinition<P = unknown, S = Record<string, never>> {
  id: ExerciseId;
  title: string;
  description: string;
  skillsCovered: (settings: S) => SkillId[];     // enumerable, for the progress screen
  defaultSettings: S;
  settingsFields?: SettingsField[];              // declarative; the runner renders the settings UI
  requiresMidi: boolean;                         // false => fully playable with mouse/keyboard
  generate(ctx: GenerateContext<S>): Question<P>;
  grade(question: Question<P>, answer: Answer): Grade;
  AnswerComponent?: Component;                   // optional custom answer UI; default = keyboard/choices
}

export interface AttemptResult {
  id: string; ts: number;
  exerciseId: ExerciseId; skillId: SkillId;
  seed: number; correct: boolean; score: number;
  responseMs: number; replays: number; answerSource: NoteSource | 'choice';
}
```

- **`generate` and `grade` are pure** (given `rng`), which is the whole point: every exercise is
  unit-testable with Vitest and no browser.
- The **runner** (`$lib/exercises/runner.svelte.ts` + `ExerciseRunner.svelte`) owns the state machine
  `idle → presenting → awaiting → grading → feedback → next` (see the UX spec ticket for the visual
  states), captures the answer per `answerMode` from the MIDI store (§3), calls `grade`, emits an
  `AttemptResult` and advances. Feedback on a correct answer auto-advances; a wrong answer reveals and
  waits for space.
- Emitting an `AttemptResult` is the **only** coupling between exercises and progress/persistence.

## 6. Progress & persistence — IndexedDB via `idb`, settings in localStorage

- **Settings** (small, needed synchronously at boot, no privacy weight): `localStorage`, one JSON doc
  under `piano-trainer:settings:v1`, validated on read, defaults merged. Shape carries over the old
  app's per-device model: `{ selectedDeviceKey, devices: Record<key, { midiRange, noteLabelsVisible }>,
  instrument, volume, chordSettleMs, theme, exerciseSettings: Record<ExerciseId, unknown> }`.
- **Practice data**: IndexedDB via **`idb`** (≈1 kB, promise wrapper, typed) — not Dexie (more API
  than we need), not localStorage (attempt log grows unbounded, and writes are synchronous).
  Database `piano-trainer`, `schemaVersion` in `meta`, upgrade callbacks per version:
  - `attempts` — append-only `AttemptResult`, key `id`, index `by-ts`, index `by-skill`.
  - `skills` — one record per `SkillId`, the SR + mastery state.
  - `meta` — schema version, created/updated timestamps.
  ```ts
  interface SkillState {
    skillId: SkillId; exerciseId: ExerciseId;
    reps: number; lapses: number;
    easiness: number;        // SM-2 EF, starts 2.5
    intervalDays: number;
    dueAt: number;           // epoch ms
    mastery: number;         // 0..1, EWMA of recent scores — what the progress screen shows
    lastSeenAt: number;
  }
  ```
- **Spaced repetition lives in `$lib/practice/scheduler.ts`** as a pure function
  `review(state: SkillState, grade: Grade, now: number): SkillState` — an **SM-2 variant** with
  sub-day intervals for same-session drilling (a miss reschedules the item ~60 s later, inside the
  session). `$lib/practice/planner.ts` picks the next exercise+skill: due items first (oldest due),
  then weakest mastery, then unseen, with a cap on consecutive repeats of the same skill. Both are
  pure and unit-tested; the UI just asks the planner "what next?".
- **Export / import**: Settings screen offers a single JSON file
  `{ schemaVersion, exportedAt, settings, skills, attempts }` (download via Blob; import validates
  `schemaVersion`, then replaces or merges by `id`). This is the only backup — the product is
  account-less, so **export must exist from the slice that introduces persistence**, not later.
- Assume storage can vanish (private mode, quota): all writes are best-effort; a failed write logs
  and shows a one-line warning, it never breaks a practice session.

## 7. Notation rendering — none in v1

**Decision: keyboard-first visuals + chord symbols as text; no staff notation.** The user answers by
playing keys, and every v1 exercise (intervals, chord quality, voicings, ii-V-I) is expressible as
keyboard highlights plus a chord symbol. VexFlow/abcjs would be a rendering dependency with zero
ear-training value now.

Revisit when **melodic dictation** or repertoire lands: then prefer **VexFlow** (accurate,
actively maintained, renders to SVG) loaded via dynamic `import()` in a single
`Notation.svelte` component, so it never enters the main bundle. Until then, "write it down" is
expressed on the piano keyboard.

## 8. Quality gates & hosting

- **Package manager: pnpm** (workspaces, fast, strict). `packageManager` field pinned; Node 22 LTS
  (`.nvmrc`). The legacy app keeps its own untouched `package-lock.json` and is not a workspace member.
- **Tests**: **Vitest** for units (theory, exercise `generate`/`grade`, scheduler, MIDI parsing —
  these are the parts where bugs are silent) and component tests via
  `@testing-library/svelte` + jsdom where it pays. **Playwright** for a small smoke suite (app loads,
  navigate to an exercise, answer with the on-screen keyboard, score updates) — added in slice 1 with
  one spec, grown as exercises land. No coverage threshold theatre; the rule is: **pure logic gets a
  test, glue does not**.
- **Lint/format**: ESLint 9 flat config + `typescript-eslint` + `eslint-plugin-svelte`, Prettier with
  `prettier-plugin-svelte`, keeping the existing `.prettierrc` (single quotes, width 80, trailing
  commas, LF). `svelte-check` for typechecking. Keep husky + lint-staged + commitlint
  (**Conventional Commits** — the repo's existing convention).
- **CI** (`.github/workflows/ci.yml`, on `pull_request` and `push: master`): pnpm install (cached) →
  `lint` → `check` → `test:unit` → `build` → `test:e2e`. One job, Ubuntu, Node 22. `legacy/` is
  excluded from every script.
- **Hosting**: **GitHub Pages** via `.github/workflows/deploy.yml` on push to `master`: build with
  `BASE_PATH=/piano-trainer`, `actions/upload-pages-artifact`, `actions/deploy-pages`, permissions
  `pages: write`, `id-token: write`. Add `.nojekyll`. URL:
  `https://alexeychikk.github.io/piano-trainer/`. Web MIDI requires a **secure context** — Pages is
  HTTPS, so this works; `localhost` is also secure for development.
- **Branching**: feature branches + pull requests, squash merge. Enable "require CI to pass" on
  `master` once the CI workflow exists and is green (slice 1); design-docs commits by the architect go
  straight to `master`.

## 9. Directory layout, and what happens to the old app

```
/                         pnpm workspace root: package.json, pnpm-workspace.yaml, CLAUDE.md, .nvmrc
apps/web/                 the rewrite (SvelteKit)
  src/routes/             / (practice home), /practice/[exerciseId], /progress, /settings
  src/lib/theory/         pure music theory facade over tonal        (no DOM, no Svelte)
  src/lib/audio/          AudioEngine, scheduler, metronome
  src/lib/midi/           Web MIDI access, note event bus, chord settling
  src/lib/exercises/      registry.ts, runner.svelte.ts, <exercise-id>/{definition.ts,Answer.svelte}
  src/lib/practice/       scheduler.ts (SR), planner.ts, session.svelte.ts
  src/lib/storage/        settings.svelte.ts (localStorage), db.ts (idb), export.ts
  src/lib/components/     PianoKeyboard.svelte, ExerciseRunner.svelte, shell/…
  src/lib/styles/         tokens.css (design tokens from the UX spec)
  e2e/                    Playwright specs
legacy/electron-app/      the old React/Electron app, frozen, excluded from CI and workspace
docs/decisions/           ADRs (this file)
docs/design/              UX specs
```

- **Layering rule (enforced by review, and by an ESLint `no-restricted-imports` rule):**
  `theory` imports nothing local; `audio`/`midi` may import `theory`; `exercises` may import
  `theory`/`audio`/`midi`; `components` may import all of the above; **nothing in `lib/*` non-UI
  modules imports a Svelte component**.
- `packages/*` deliberately **does not exist yet**. Everything starts in `apps/web/src/lib`; a module
  is promoted to a workspace package only when a second consumer appears. The workspace is set up so
  the promotion is a `git mv` plus a `package.json`.
- **The old app**: moved verbatim (`git mv`, no edits) into `legacy/electron-app/` in slice 1, along
  with its `package.json`, lockfile, configs and `@types/`. It stays buildable-on-paper as reference
  and as the source of the current GitHub Releases. It is removed in its own ticket **once the web
  app reaches parity** (chord display + note-finding ear training), as product's standing rules say.
  `README.md` at the root describes the web app and links to `legacy/electron-app/` for the old one.

## 10. Implementation slices

Ordered. Slice 1 gives a running deployed app; every slice from 4 on ends with something the owner
can actually practise with. Each is one developer ticket.

**Slice 1 — Scaffold the SvelteKit skeleton, tooling, CI and Pages deploy** *(already ticketed)*
Deliverable: `apps/web` SvelteKit + TS + static adapter app with the dark app shell and placeholder
routes `/`, `/practice/[exerciseId]`, `/progress`, `/settings`; pnpm workspace root; ESLint/Prettier/
svelte-check/Vitest/Playwright wired; CI workflow on PRs; Pages deploy workflow on `master`; old app
moved to `legacy/electron-app/`; root `CLAUDE.md` and README updated.
*Acceptance*: `pnpm install && pnpm build` and `lint`/`check`/`test` pass locally and in CI; all four
routes render with no console errors; the Pages URL serves the shell with the correct base path; no
exercise, MIDI or audio code.

**Slice 2 — MIDI input + piano keyboard component ("Free Play" screen)**
Deliverable: `$lib/midi` (permission states, device list, selection persisted per device, note-on/off
parsing, `heldNotes`, settling-window chord emitter), `PianoKeyboard.svelte` (49/61/88 layouts,
highlight states, note labels, pointer + computer-keyboard input), route `/play` showing held notes
and `detectChords()` output live, device picker + range wizard in `/settings`, and the minimal
`$lib/theory` needed (`midiToName`, `pcOf`, `detectChords`).
*Acceptance*: with a MIDI keyboard connected, played notes highlight within a frame and the detected
chord symbol matches for at least triads and 7th chords; with no device, the on-screen keyboard and
computer keys do the same; the selected device survives a reload; `unsupported`/`denied` states show
an explanatory panel; unit tests for MIDI message parsing and chord settling. **Silent — no audio.**
*Skill*: recognising what you are holding under your hands.

**Slice 3 — Audio engine: sampled piano, volume/instrument settings, metronome**
Deliverable: `$lib/audio` `AudioEngine` (lazy `AudioContext` on first gesture, `smplr` soundfont with
cache, master gain, oscillator fallback), lookahead scheduler + `PlaybackPlan` execution, metronome
with tempo control; Free Play now sounds; instrument + volume + metronome tempo in `/settings`.
*Acceptance*: pressing a key sounds within ~30 ms with no clicks/pops; sustain and release behave with
polyphony ≥ 10; changing instrument/volume takes effect without reload; metronome stays in time for
2 minutes (no drift vs. the audio clock); sample-load failure falls back to the synth with a banner;
unit test for the scheduler's window logic with a mocked clock.
*Skill*: you can hear yourself; prerequisite for every ear exercise.

**Slice 4 — Exercise engine + runner + Exercise #1 "Find the note"**
Deliverable: the §5 types, `$lib/exercises/registry.ts`, `runner.svelte.ts` state machine,
`ExerciseRunner.svelte` (prompt, replay on space, answer capture, correct/wrong feedback, reveal,
score + streak in memory), and the first exercise: a random note in the configured range is played,
the user finds it on the piano (`single-note`), parity with the old app's ear training.
*Acceptance*: `/practice/find-the-note` is playable end-to-end with MIDI **and** with the on-screen
keyboard; space replays, enter skips/reveals; correct auto-advances, wrong reveals the note on the
keyboard; range and octave settings honoured; `generate`/`grade` unit-tested with a seeded RNG; one
Playwright smoke spec answers a question with the on-screen keyboard.
*Skill*: pitch location on the instrument.

**Slice 5 — Persistence & progress: attempt log, mastery, export/import**
Deliverable: `$lib/storage/db.ts` (`idb`, `attempts`/`skills`/`meta` stores, schema versioning),
`AttemptResult` written by the runner, mastery EWMA update, `/progress` screen (per-skill mastery,
attempts today, streak, accuracy trend), JSON export/import in `/settings`.
*Acceptance*: attempts survive reload; `/progress` reflects a just-finished session; export produces a
file that a fresh profile can import to restore skills + attempts; import rejects a wrong
`schemaVersion` with a clear message; storage failures degrade to in-memory without breaking practice;
unit tests for the mastery update and export/import round-trip.
*Skill*: the loop that makes practice stick.

**Slice 6 — Interval recognition (answered on the piano)**
Deliverable: exercise `interval-recognition`: a root plus a second note played melodically
(asc/desc) or harmonically; the user answers by **playing the interval** from a given root
(`note-sequence` / `chord-released`) or by choosing a name (`choice`) when no MIDI is present.
Settings: interval set, direction, harmonic/melodic, root range, fixed vs. random root.
`SkillId = 'interval:<semitones>:<direction>'`.
*Acceptance*: all 13 intervals within an octave selectable; answers graded by pitch-class/semitone
distance (octave-insensitive option); partial credit not applicable — binary; feedback names the
interval actually played on a miss; attempts feed `/progress`; generate/grade unit-tested per interval.
*Skill*: product pillar 1, step 1.

**Slice 7 — Chord-quality recognition**
Deliverable: exercise `chord-quality`: a chord is played (block or arpeggiated) in a random inversion
and register; the user answers with a quality from a configurable set (maj7, dom7, min7, min7b5,
dim7, and later 9ths/altered) via `choice` buttons **and** via number-key shortcuts.
`SkillId = 'chord-quality:<quality>'`.
*Acceptance*: configurable quality set with at least the five core jazz qualities; inversion/voicing
randomisation does not change the expected answer; wrong answers reveal the chord on the keyboard and
replay it; per-quality mastery visible in `/progress`; grading unit-tested across inversions.
*Skill*: product pillar 1, step 2.

**Slice 8 — Play-the-voicing drill (shells, rootless A/B, guide tones)**
Deliverable: `$lib/theory` voicing generators (`voice(symbol, kind)`), exercise `play-the-voicing`:
a chord symbol is shown (optionally sounded), the user plays the requested voicing type;
`chord-sustained` grading with per-note partial credit and a keyboard reveal of the target.
Settings: voicing kinds, key set (all 12), root-position/left-hand register.
*Acceptance*: correct shells/rootless A/B/guide-tone note sets for all 12 roots and the core
qualities (table-driven unit tests); partial score reported ("3 of 4 tones — missing the 7th");
rolled chords accepted via the settling window; works with MIDI only (falls back to on-screen
keyboard, documented as awkward by design).
*Skill*: product pillar 2 — hands, not just ears.

**Slice 9 — Spaced repetition scheduler + "Practice now" session**
Deliverable: `$lib/practice/scheduler.ts` (SM-2 variant with sub-day intervals) and `planner.ts`
(due-first, weakest-next, no immediate repeats), home screen "Practice now" that runs a mixed session
across all registered exercises for a chosen length (5/10/20 min), session summary screen.
*Acceptance*: a missed item reappears within the same session; due counts shown per skill on
`/progress`; a session of N minutes ends with a summary of accuracy per skill; scheduler unit-tested
against a simulated review history (no clock dependence — `now` is injected).
*Skill*: product pillar 3 — the app decides what to practise.

**Slice 10 — ii-V-I progression recognition in 12 keys**
Deliverable: `$lib/theory` progression model + generator (ii-V-I major/minor, I-VI-ii-V, turnarounds),
exercise `progression-recognition`: a progression is played with voicings over a click; the user names
the progression (`choice`) or plays the roots (`note-sequence`); key randomised over all 12.
*Acceptance*: at least four progression templates in all 12 keys; playback uses the slice-3 scheduler
and stays in time; answers graded transposition-invariantly (degrees, not absolute pitches); mastery
tracked per progression template; generator unit-tested for correct degrees in every key.
*Skill*: product pillar 1, step 3.

*(Beyond slice 10 — melodic dictation, notation, repertoire/backing tracks — is out of scope here and
needs its own ADR revision, at minimum for §7.)*

---

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Web MIDI is unavailable or blocked (Safari flag, permission denied, no hardware) | Every exercise except slice 8 must be playable with the on-screen/computer keyboard (`requiresMidi: false`); explicit `unsupported`/`denied` UI states from slice 2. |
| Soundfont CDN unavailable / slow first note | Oscillator-synth fallback + preload on app start after first gesture; instrument cache. |
| GitHub Pages base path breaks assets/routes | `BASE_PATH` env in the deploy workflow, `base` from `$app/paths` everywhere, e2e smoke test runs against `pnpm preview` with the base path set. |
| Browser storage cleared (private mode, quota) | Best-effort writes, in-memory degradation, JSON export shipped in the same slice as persistence. |
| Input latency ruins the feel | Direct call path from event handler to `AudioEngine`, `latencyHint: 'interactive'`, no awaits or effects in the trigger path. |
| Exercise contract turns out too narrow | It is deliberately minimal (`generate`/`grade` + `PlaybackPlan`); widening it is a one-file change plus a migration of the ≤4 exercises that exist by then. Revise this ADR when it happens. |
| Svelte 5 runes + class-based stores are new ground | One documented pattern in `CLAUDE.md`, applied from slice 1; no mixing with legacy `svelte/store`. |
