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
`.nvmrc` (Node 22), commitlint + husky hooks, and the CI/Pages workflows (currently parked in
`.github/workflows-pending/`, see that README).

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
`legacy/`. CI runs exactly this list: `lint` → `check` → `test:unit` → `build` → `test:e2e`.

## Code conventions

- **Runes only** for reactivity (`$state`, `$derived`, `$effect`, `$props`). Shared reactive state is
  a class instance exported from a `*.svelte.ts` module (e.g. `$lib/midi/input.svelte.ts`); do **not**
  use `svelte/store` writables.
- **Layering** — `theory` imports nothing local (pure TS, no DOM, no randomness beyond an injected
  RNG); `audio`/`midi` may import `theory`; `exercises` may import `theory`/`audio`/`midi`;
  `components` may import all of them; **non-UI modules never import Svelte components**.
- **Pitches are MIDI integers** (`Midi`, C4 = 60) at runtime; note names are display-only, enharmonics
  compare equal. Never grade on strings.
- Exercises are drop-in: a folder under `$lib/exercises/<id>/` implementing `ExerciseDefinition` plus
  an entry in `registry.ts`. `generate()` and `grade()` must be **pure** and take a seeded `rng` —
  never `Math.random()`.
- Audio is scheduled on `AudioContext.currentTime` through the shared lookahead scheduler, never with
  `setTimeout`. The `AudioContext` starts on a user gesture.
- Links and assets go through `base` from `$app/paths` (GitHub Pages serves under `/piano-trainer/`).
  Routes are prerendered (`+layout.ts`, `trailingSlash: 'always'`); a route whose params are only
  known at runtime opts out with `export const prerender = false` and is served by the SPA fallback
  — which on Pages is **`404.html`**, not the ADR's `200.html` (Pages serves `404.html` for unknown
  paths).
- App shell: `$lib/components/shell/` — `TopBar` (nav model and active-route rule in the pure
  `nav.ts`), `StatusChip` (top-bar status, never colour alone), `BannerStack`
  (`banners.svelte.ts`: non-blocking one-liners, max two, oldest wins) and `Placeholder` (skeleton
  screens). New global messages go through `banners.show(...)`, never through a dialog.
- **UI**: all colours, sizes, spacing and durations come from `$lib/styles/tokens.css` (copied from
  [`docs/design/tokens.css`](docs/design/tokens.css)) — **no raw hex or magic px outside that file**.
  Dark-first. Correct/wrong/target states always pair colour with a glyph (never colour alone), and
  **no modal dialogs while an exercise is running** — use the banner/strip patterns in the UX spec.
- Prettier: single quotes, width 80, trailing commas, LF, 2 spaces. Commits follow **Conventional
  Commits** (`feat:`, `fix:`, `docs:`, `chore:`) — enforced by commitlint.
- Tests: pure logic (theory, grading, scheduler, MIDI parsing) always gets a Vitest test; glue and
  markup usually do not. Playwright covers a thin smoke path per exercise. Unit tests sit next to
  the module (`nav.ts` → `nav.test.ts`); e2e specs live in `apps/web/e2e/`.
- `apps/web/src/lib/styles/tokens.css` is a byte-for-byte copy of `docs/design/tokens.css` — change
  the spec first, then re-copy. Both files, and everything under `docs/`, are Prettier-ignored so
  they do not drift.

## Working agreements

- Ship **vertical slices**: every slice after the scaffold must leave an exercise that is usable
  end-to-end, with the on-screen keyboard when no MIDI device is connected.
- Feature branches + pull requests, squash merge into `master`; CI must be green.
- Record new conventions here and notable technical decisions as an ADR in `docs/decisions/`.
