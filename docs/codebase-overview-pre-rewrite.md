# piano-trainer codebase overview (pre-rewrite)

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

- **No tests.** Jest/ts-jest are in `devDependencies` and `tsconfig` includes `__tests__/**/*`,
  but no config and no test files exist.
- **No CI** — nothing under `.github/` at any conventional path. Releases were built by hand.
- **No `CLAUDE.md`, no `docs/decisions/`.** This file is the first doc.

## Reuse vs replace

**Reuse (small but real)**

- `src/utils/notes.ts` — pure random-note helpers; port as-is.
- The tonal.js dependency and its usage patterns (`Note.midi`, `Note.fromMidi`,
  `Note.sortedNames`, `Chord.detect`). Keep tonal; it is current and does the theory work.
- `soundfont-player` as the playback approach (browser-native already).
- `@types/react-piano/index.d.ts` as a spec of the keyboard component's API surface.
- The EarTraining drill *flow* as a behavioural reference for drill #1.

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
