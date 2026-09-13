import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:4173' },
});
