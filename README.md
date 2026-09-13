# piano-trainer

Ear training for jazz piano, played at your MIDI keyboard.

A local-first web app: no accounts, no backend, no installs. Practice data stays in the browser and
is exportable. Desktop browser first — Web MIDI needs Chrome, Edge or Opera; everything is also
playable with the on-screen keyboard.

Live at <https://alexeychikk.github.io/piano-trainer/>, published from `master` by the Pages deploy
workflow.

## Run it locally

Requires Node 22 (see `.nvmrc`) and [pnpm](https://pnpm.io) 9 (`corepack enable pnpm`).

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

Other scripts, all from the repository root:

| Command         | What                                                                                |
| --------------- | ----------------------------------------------------------------------------------- |
| `pnpm build`    | Static production build into `apps/web/build`                                       |
| `pnpm preview`  | Serve that build locally                                                            |
| `pnpm lint`     | ESLint + Prettier check                                                             |
| `pnpm format`   | Prettier write                                                                      |
| `pnpm check`    | `svelte-check` (TypeScript)                                                         |
| `pnpm test`     | Vitest unit tests                                                                   |
| `pnpm test:e2e` | Playwright smoke tests (`pnpm --filter web exec playwright install chromium` first) |

Web MIDI needs a secure context: `localhost` and the deployed HTTPS site both qualify.

## Layout

| Path                   | What                                                       |
| ---------------------- | ---------------------------------------------------------- |
| `apps/web/`            | The SvelteKit app — all new work goes here                 |
| `docs/decisions/`      | ADRs (start with `0001-target-architecture-and-stack.md`)  |
| `docs/design/`         | UX specs and design tokens                                 |
| `legacy/electron-app/` | The frozen 2022 React/Electron desktop app, reference only |

The desktop app that used to live at the repository root is unchanged in
[`legacy/electron-app/`](legacy/electron-app/), including its own README and release instructions.
It is removed once the web app reaches parity.

## CI and deployment

Pull requests and pushes to `master` run [`ci.yml`](.github/workflows/ci.yml): lint, typecheck,
unit tests, build and the Playwright smoke suite. Every push to `master` also runs
[`deploy.yml`](.github/workflows/deploy.yml), which publishes the static build to GitHub Pages with
`BASE_PATH=/piano-trainer`.

Conventions for contributors (and agents) are in [`CLAUDE.md`](CLAUDE.md).
