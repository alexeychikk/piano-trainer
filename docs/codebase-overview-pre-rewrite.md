# piano-trainer codebase overview (pre-rewrite)

> **Status / canonicality.** Ticket c6e743a3 asked for this content as a knowledge-base entry
> titled *"piano-trainer codebase overview (pre-rewrite)"*. `upsert_knowledge` is exposed only to
> the **product** role — architect, reviewer and QA all confirmed they cannot call it — so the
> content lives here instead.
>
> **Product: upsert everything below the horizontal rule verbatim as that entry.** Once it exists,
> the KB entry is canonical and this file should be cut down to a one-line pointer to it (reviewer's
> and QA's agreed option (a)). Until then **this file is canonical** — it is the only copy, so do
> not delete it before the KB entry lands.
>
> Downstream tickets that say "read the knowledge entry" should read this file until that swap
> happens.

---

Survey of `alexeychikk/piano-trainer` @ `master` as it stands before the Svelte rewrite.
Ticket c6e743a3 — a map, not an inventory.

## Headline: it is not a web app

The existing app is an **Electron desktop app** (Windows-first, NSIS/dmg/AppImage releases),
not a browser app. MIDI is read in the **Node main process** via `easymidi` and pushed to the
React renderer over a custom typed IPC layer. Nothing about the current MIDI path survives a
move to the browser — that becomes Web MIDI API.

## What it does today

Two screens only:

- **Chords** (`/`) — live display of the notes and detected chord names you are holding down.
- **Ear training** (`/ear-training`) — single-note recognition: plays a random note inside a
  user-chosen range, you find it on the keyboard, spacebar replays / advances. This is roughly
  curriculum item #1 and nothing beyond it.
  **Note the input ergonomics** (`EarTraining.tsx` L79–88): once you have answered correctly, you
  advance to the next question by *playing either boundary note of the range on the piano* — not by
  clicking. Hands never leave the keys. That is already an instance of the product's
  "hands-on-keys / minimal mouse" non-negotiable and is the single best behavioural reference in
  this repo for the drill-engine design.

Plus: MIDI device picker, a two-keypress "wizard" to learn your keyboard's note range,
selectable soundfont instrument, volume, note-label toggle.

## Stack (all 2021-era, unmaintained since)

Electron 12 · React 17 · TypeScript 4.3 · Material-UI v4 · react-router-dom v5 ·
unstated-next (state) · `@tonaljs/tonal` 4.6 (music theory) · `soundfont-player` 0.12 (audio) ·
`react-piano` 3.1 (keyboard UI) · `easymidi` (MIDI) · `electron-store` (persistence).
Build: `electron-esbuild` — esbuild for main (`esbuild.main.config.js`),
Vite 2 for renderer (`vite.config.js`). Lint: ESLint + Prettier + husky + commitlint.

## Layout

```
src/main/main.ts              Electron entry, BrowserWindow, ServiceRegistry
src/services/                 Ipc/ Midi/ Settings/ — each split main.ts | render.ts | shared.ts
src/renderer/                 index.tsx, App.tsx
src/routes/                   IndexRoute (shell) → Chords, EarTraining
src/components/music/         Piano, MidiPiano, MidiDevices, MidiWizard, InstrumentSelect, ...
src/components/providers/     MidiProvider (unstated-next container)
src/hooks/                    useActiveNotes, useActiveChords, usePianoPlayer, useMidiWizard, ...
src/utils/notes.ts            random-note helpers
@types/react-piano/           hand-written ambient typings
```

## MIDI, audio, state, persistence

- **MIDI**: `easymidi` in main → `noteon`/`noteoff` → IPC events → `MidiProvider` keeps a
  `midiNotes: number[]` array. A neat `compileSchema()` helper generates typed
  `ipcMain.handle` / `webContents.send` pairs from a declarative schema — nice idea, useless
  in-browser.
- **Audio**: one module-level `AudioContext` + `soundfont-player` with a small instrument cache.
  Samples are fetched from a CDN at runtime — **no sound assets in the repo**.
- **State**: `unstated-next` + `react-use` async hooks. One global container, no store beyond it.
- **Persistence**: `electron-store` JSON on disk, MIDI device settings only
  (`lastConnectedInput`, per-input range/instrument/volume/labels). **No attempt history,
  no scores, no progress data of any kind.**

## Tests, CI, docs

- **No tests, and the project was never wired to run any.** Jest/ts-jest are in `devDependencies`
  and `tsconfig` includes `__tests__/**/*` (plus a `@tests/*` path alias), but there is no jest
  config, no test files, and — decisively — **no `test` script in `package.json`**; `scripts` has
  only `start`/`build`/`package`/`make`/`lint:*`. Nothing ever invoked jest.
- **No CI** — nothing under `.github/` at any conventional path. Releases were built by hand
  (`"publish": null` in the `build` block).
- **No `CLAUDE.md` and no `docs/decisions/` existed in the surveyed repo.** This file was the first
  doc; a root `CLAUDE.md` pointing at it was added alongside. `docs/decisions/` is still empty —
  the first architecture ticket creates it.

> **How this was verified.** This sandbox has no working shell (`Bash` → "No suitable shell found")
> and no `Glob`/`Grep`, so the survey was done by traversing the import graph with `Read` from the
> two entry points. Every *positive* finding above is read directly from source. The three
> *absence* claims — no tests, no CI, no `CLAUDE.md` — are **probe-based** (conventional paths
> checked and found missing), not directory-listing-exhaustive. Treat them as high-confidence but
> not proven; a single `git ls-files` in any sandbox that has a shell would settle them.

## Reuse vs replace

**Reuse (small but real)**

- `src/utils/notes.ts` — pure random-note helpers; port as-is.
- The tonal.js dependency and its usage patterns (`Note.midi`, `Note.fromMidi`,
  `Note.sortedNames`, `Chord.detect`). Keep tonal; it is current and does the theory work.
- `soundfont-player` as the playback approach (browser-native already).
- `@types/react-piano/index.d.ts` as a spec of the keyboard component's API surface.
- The EarTraining drill *flow* as a behavioural reference for drill #1 — specifically its
  answer-and-advance loop driven entirely from the keys (see above). Port the *interaction*, not
  the code.

**Replace (everything else)**

- Electron shell, main process, `electron-builder`/`electron-store`/`electron-util`,
  `easymidi` → browser + Web MIDI + IndexedDB/localStorage.
- The whole IPC layer (`src/services/Ipc/`) — no process boundary to bridge.
- React 17 + MUI v4 + react-router v5 + unstated-next + `react-piano` → Svelte stack.
- `electron-esbuild` toolchain → Vite/SvelteKit.

## Consequences for rewrite planning

1. There is **no drill engine and no drill content** to port — one hardcoded exercise, inline
   in a component. The drill abstraction is greenfield.
2. There is **no attempt history schema**, so the progress layer has zero prior art here.
3. Persistence must be redesigned from scratch; only device settings exist today and those are
   Electron-specific.
4. The salvageable surface is roughly one utils file plus dependency choices. Budget the rewrite
   as new work, not a port.
