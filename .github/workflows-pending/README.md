# Pending workflows — one manual step

`ci.yml` and `deploy.yml` are finished and ready to run, but they are parked here instead of in
`.github/workflows/` because the bot account that opened this pull request is a GitHub App without
the `workflows` permission: any push that touches `.github/workflows/**` is rejected by GitHub with

```
refusing to allow a GitHub App to create or update workflow `.github/workflows/ci.yml`
without `workflows` permission
```

## To activate them (a human with write access, one command)

```bash
git mv .github/workflows-pending/ci.yml     .github/workflows/ci.yml
git mv .github/workflows-pending/deploy.yml .github/workflows/deploy.yml
git rm .github/workflows-pending/README.md
git commit -m "ci: activate CI and Pages deploy workflows"
```

Alternatively, grant the app `workflows: write` and a later agent run can move them.

Nothing else is needed: `deploy.yml` enables Pages itself on its first run
(`actions/configure-pages` with `enablement: true`) and publishes to
<https://alexeychikk.github.io/piano-trainer/>.

## What they do

- **`ci.yml`** — on pull requests and pushes to `master`: `pnpm install --frozen-lockfile` →
  `lint` → `check` → `test:unit` → `build` → `test:e2e` (Playwright, chromium), uploading the
  Playwright report when it fails.
- **`deploy.yml`** — on pushes to `master`: builds with `BASE_PATH=/piano-trainer` and publishes
  `apps/web/build` to GitHub Pages via `upload-pages-artifact` + `deploy-pages`.

Until they are activated, run the same gate locally: `pnpm lint && pnpm check && pnpm test && pnpm build`.
