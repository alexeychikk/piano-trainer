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
- **Settings** are `localStorage` via the `settings` store (`$lib/storage/settings.svelte.ts`) and
  are read only in `hydrate()`, called from the root layout after mount — module init must not touch
  storage or prerendered HTML and the first client render disagree.
- `PianoKeyboard` (`$lib/components/piano/`) is the one keyboard, for input *and* exercise display:
  props `range/layout/highlights/labels/labelStyle/interactive/maxHeightPx`, `onNoteOn/onNoteOff`
  callbacks out. Parents pass a `Map<Midi, KeyHighlight>` (`played` included) — the component holds
  no exercise state and plays no audio. Its pixel maths lives in `geometry.ts`, whose constants
  mirror the keyboard tokens because layout maths cannot read CSS variables.
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
