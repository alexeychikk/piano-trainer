import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The iPadOS shell (ADR 0005 §3). It ships the ordinary `pnpm build` output
 * of `apps/web` — no `BASE_PATH`, so the app is served from the root of
 * `capacitor://localhost`.
 *
 * `appId` and the origin are the storage key of everything the user
 * practises in the app (ADR §6): neither may change after the first
 * TestFlight build.
 */
const config: CapacitorConfig = {
  appId: 'io.github.alexeychikk.pianotrainer',
  appName: 'Piano Trainer',
  webDir: '../web/build',
  ios: {
    // The page fills the screen; the web app owns its own safe areas.
    contentInset: 'never',
  },
};

export default config;
