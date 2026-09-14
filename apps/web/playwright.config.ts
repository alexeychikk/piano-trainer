import { defineConfig } from '@playwright/test';

const ci = !!process.env.CI;

export default defineConfig({
  // No stray `test.only` in CI, and tolerate a flake before failing the run.
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  testDir: 'e2e',
  webServer: {
    // A plain static file server, not `vite preview`: the deploy target is
    // GitHub Pages, where an unknown path is answered with `404.html` — the
    // SPA fallback that `/practice/<id>/` depends on. Only a dumb server
    // exercises that. CI builds in its own step; locally `pnpm test:e2e`
    // still builds first, so it works on its own.
    command: ci
      ? 'node e2e/static-server.mjs 4173'
      : 'pnpm build && node e2e/static-server.mjs 4173',
    port: 4173,
    reuseExistingServer: !ci,
  },
  use: { baseURL: 'http://localhost:4173' },
});
