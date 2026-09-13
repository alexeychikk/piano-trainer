import { defineConfig } from '@playwright/test';

const ci = !!process.env.CI;

export default defineConfig({
  // No stray `test.only` in CI, and tolerate a flake before failing the run.
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  testDir: 'e2e',
  webServer: {
    // CI builds in its own step, so preview the existing build there; locally
    // `pnpm test:e2e` still builds so it works on its own.
    command: ci
      ? 'pnpm preview --port 4173'
      : 'pnpm build && pnpm preview --port 4173',
    port: 4173,
    reuseExistingServer: !ci,
  },
  use: { baseURL: 'http://localhost:4173' },
});
