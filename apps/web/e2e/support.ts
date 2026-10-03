import { expect, type Page } from '@playwright/test';

/*
 * What every e2e spec shares: the blocked sample CDN, the console watch and
 * the "the app is listening" wait. One copy, so a new spec cannot drift from
 * the smoke path's rules (CLAUDE.md: an e2e spec waits on a signal the app
 * gives, never on a sleep).
 */

/**
 * The sample CDN is out of scope for a smoke test: every spec blocks it, so
 * audio deterministically takes ADR §2's built-in-synth fallback instead of
 * depending on the network. Chromium logs the blocked request as a console
 * error, which is therefore the one error the smoke path tolerates.
 */
export const SOUNDFONT_URLS = '**/midi-js-soundfonts/**';

/**
 * The runner's routes are not prerendered, so a static host answers them with
 * the SPA fallback — `404.html`, with a real 404 status, exactly as GitHub
 * Pages does (and as `e2e/static-server.mjs` reproduces). Chromium may log
 * that status for the document; the app itself boots and hydrates from it, so
 * it is expected, not a failure.
 */
function isSpaFallbackNotice(text: string, url: string): boolean {
  return text.includes('status of 404') && url.includes('/practice/');
}

/**
 * "The app is listening" — the wait every key press on a *prerendered* screen
 * needs before it is pressed.
 *
 * `/practice/<id>` and `/session` are client-rendered (the runner is not in
 * the HTML at all), so their first `Ready?` prompt is already proof that the
 * client has taken over. `/play`, `/settings` and `/progress` are prerendered:
 * their markup — buttons, piano keys, fields and all — is on screen before a
 * line of JavaScript has run, so a `press`/`click` in that window reaches a
 * DOM with no handlers on it and is simply lost. That is the flake this
 * removes, and the only honest fix is to wait for the client, never to sleep.
 *
 * `#svelte-announcer` is SvelteKit's own route announcer: it exists in the
 * client bundle only and is rendered from the *root* component's `onMount`. A
 * parent's `onMount` runs after its children's, so once it is attached,
 * `+layout.svelte`'s `onMount` has already run — `computerKeyboard.attach(
 * window)`, the capture-phase audio starter, `settings.hydrate()` and
 * `practice.hydrate()` — and the screen's own handlers were attached earlier
 * still, during hydration of that subtree. It is a DOM state the app itself
 * puts there, asserted with Playwright's ordinary auto-retry: no
 * `waitForTimeout`, no bumped timeout, no retry.
 */
export async function appIsListening(page: Page): Promise<void> {
  await expect(page.locator('#svelte-announcer')).toBeAttached();
}

export function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const url = message.location().url;
    const from = `${message.text()} ${url}`;
    if (from.includes('midi-js-soundfonts')) return;
    if (isSpaFallbackNotice(message.text(), url)) return;
    errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
