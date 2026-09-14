import { expect, test, type Page } from '@playwright/test';

/**
 * The sample CDN is out of scope for a smoke test: every spec blocks it, so
 * audio deterministically takes ADR §2's built-in-synth fallback instead of
 * depending on the network. Chromium logs the blocked request as a console
 * error, which is therefore the one error the smoke path tolerates.
 */
const SOUNDFONT_URLS = '**/midi-js-soundfonts/**';

/**
 * The nav is uppercased with `text-transform` (sci-fi visual language §6) and
 * Chromium folds CSS text transformation into the accessible name, so an
 * exact 'Settings' string no longer matches what the browser computes. The
 * regex keeps the match exact — only the *casing* is left to CSS, which is
 * the same reason the DOM text stays sentence case for screen readers (§9.3).
 */
const SETTINGS_LINK = /^settings$/i;

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

function watchConsole(page: Page): string[] {
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

test.beforeEach(async ({ page }) => {
  await page.route(SOUNDFONT_URLS, (route) => route.abort());
});

test('the shell renders and the nav reaches every v1 screen', async ({
  page,
}) => {
  const consoleErrors = watchConsole(page);

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Ready to practise' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();

  await page.getByRole('link', { name: 'Free play' }).click();
  await expect(page.getByRole('heading', { name: 'Free play' })).toBeVisible();

  await page.getByRole('link', { name: SETTINGS_LINK }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  // The runner route is client-rendered through the SPA fallback (`404.html`,
  // which is what the static server the suite runs against really returns).
  await page.goto('/practice/find-the-note/');
  await expect(
    page.getByRole('heading', { name: 'Find the note' }),
  ).toBeVisible();

  // An unknown id is a normal screen, not a crash.
  await page.goto('/practice/nope/');
  await expect(
    page.getByRole('heading', { name: 'No such exercise' }),
  ).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test('free play shows what is held, from the computer keys and the mouse', async ({
  page,
}) => {
  const consoleErrors = watchConsole(page);

  await page.goto('/play/');
  await expect(page.getByRole('heading', { name: 'Free play' })).toBeVisible();

  // A / D / G on the computer keyboard = C4 E4 G4 — a C major triad.
  await page.keyboard.down('a');
  await page.keyboard.down('d');
  await page.keyboard.down('g');

  await expect(page.getByTestId('chord')).toHaveText('CM');
  await expect(page.getByTestId('held-notes')).toContainText('C4 · E4 · G4');
  // Screen readers hear one settled summary, never a note-by-note flood
  // (UX spec §5.5): the visible readout is not a live region.
  await expect(page.getByTestId('spoken')).toContainText('CM — C 4, E 4, G 4');
  await expect(page.getByRole('button', { name: 'C 4' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  for (const key of ['a', 'd', 'g']) await page.keyboard.up(key);
  await expect(page.getByTestId('chord')).toHaveText('Play a chord');
  await expect(page.getByRole('button', { name: 'C 4' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  // The on-screen keyboard is the same note source.
  const fSharp = page.getByRole('button', { name: 'F sharp 4' });
  await fSharp.hover();
  await page.mouse.down();
  await expect(fSharp).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('held-notes')).toContainText('F#4');
  await page.mouse.up();
  await expect(fSharp).toHaveAttribute('aria-pressed', 'false');

  expect(consoleErrors).toEqual([]);
});

test('sound waits for a gesture, then degrades to the synth (ADR §2)', async ({
  page,
}) => {
  const consoleErrors = watchConsole(page);

  await page.goto('/play/');
  // Nothing has been touched yet: no context, and the state says so.
  await expect(page.getByLabel(/^Sound: not started/)).toBeVisible();
  await expect(page.getByTestId('sound-strip')).toContainText(
    'Click or press a key to enable sound',
  );

  // The gesture is a keyboard one on purpose. A click needs a hit test at
  // coordinates, and this button sits under two strips whose height settles
  // asynchronously (`NoMidiStrip` appears/disappears with `autoConnect()`), so
  // the point Playwright picked could resolve to `<html>` — and the stray
  // `pointerdown` was still enough for the capture-phase audio starter in
  // `+layout.svelte` to start the context, which removes the button before the
  // retry. Focus + Enter is the same user gesture through the same
  // `ensureStarted()` path with no coordinates and nothing to settle (the
  // metronome test reaches its toggle the same way).
  const enableSound = page.getByTestId('enable-sound');
  await enableSound.focus();
  await expect(enableSound).toBeFocused();
  await page.keyboard.press('Enter');

  // The blocked CDN takes the fallback path — a banner, never a dialog, and
  // the strip does not repeat it.
  await expect(page.getByLabel(/^Sound: soundfont unavailable/)).toBeVisible();
  await expect(
    page
      .getByRole('status')
      .getByText('Soundfont unavailable — using the built-in synth.'),
  ).toBeVisible();
  await expect(page.getByTestId('sound-strip')).toHaveCount(0);
  // …and Free Play keeps working.
  await page.keyboard.down('a');
  await expect(page.getByTestId('held-notes')).toContainText('C4');
  await page.keyboard.up('a');

  // `m` mutes and unmutes anywhere (UX spec §4.5).
  await page.keyboard.press('m');
  await expect(page.getByLabel(/^Sound: muted/)).toBeVisible();
  await page.keyboard.press('m');
  await expect(page.getByLabel(/^Sound: muted/)).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
});

test('the metronome toggles from the keyboard and keeps running across routes', async ({
  page,
}) => {
  const consoleErrors = watchConsole(page);

  await page.goto('/play/');
  const toggle = page.getByTestId('metronome-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  // Reachable without the mouse: focus it and press Enter.
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('metronome-tempo').fill('120');
  await expect(page.getByTestId('metronome-tempo')).toHaveValue('120');

  // The click survives navigation — Settings shows the same running state.
  await page.getByRole('link', { name: SETTINGS_LINK }).click();
  const settingsToggle = page.getByTestId('metronome-toggle');
  await expect(settingsToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('metronome-tempo')).toHaveValue('120');

  await settingsToggle.click();
  await expect(settingsToggle).toHaveAttribute('aria-pressed', 'false');

  expect(consoleErrors).toEqual([]);
});

test('the find-the-note drill is playable with the computer keys alone', async ({
  page,
}) => {
  const consoleErrors = watchConsole(page);

  await page.goto('/practice/find-the-note/');
  const prompt = page.getByTestId('prompt');
  const replay = page.getByTestId('replay');
  await expect(prompt).toHaveText('Ready?');

  // Space starts the drill; the question plays, then the answer is accepted.
  await page.keyboard.press('Space');
  await expect(prompt).toHaveText('Which note?');
  await expect(replay).toBeEnabled();

  // Enter skips and reveals: the answer is named *and* shown on the keyboard,
  // so the drill is usable with the sound off (a11y §8.6).
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('feedback')).toContainText(
    'Skipped · Space to continue',
  );
  await expect(
    page.locator('[data-piano-keyboard] button', { hasText: '◆' }),
  ).toHaveCount(1);
  await expect(page.getByTestId('answered')).toContainText('0/1');

  // A miss never blocks: no dialog, and the drill waits for the user.
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.keyboard.press('Space');
  await expect(page.getByTestId('feedback')).not.toContainText('Skipped');
  await expect(replay).toBeEnabled();

  // `A` on the computer keyboard is C4 — right or wrong, it is an answer.
  await page.keyboard.press('a');
  await expect(page.getByTestId('answered')).toContainText('/2');

  // The runner never scrolls at a normal desktop viewport (§4.1).
  const scrolls = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
  expect(scrolls).toBe(false);

  expect(consoleErrors).toEqual([]);
});

test('the range wizard learns the keyboard from two presses', async ({
  page,
}) => {
  const consoleErrors = watchConsole(page);

  await page.goto('/settings/');
  await expect(page.getByTestId('range-value')).toHaveText('C2 to C7');

  await page.getByTestId('range-start').click();
  await expect(page.getByTestId('range-prompt')).toHaveText(
    'Press the lowest key on your piano.',
  );
  // Z drops the computer-key octave; A is then C3, K is C4 an octave up.
  await page.keyboard.press('z');
  await page.keyboard.press('a');
  await expect(page.getByTestId('range-prompt')).toHaveText(
    'Now press the highest key.',
  );
  await page.keyboard.press('k');
  await expect(page.getByTestId('range-value')).toHaveText('C3 to C4');

  // It is settings, so it survives a reload.
  await page.reload();
  await expect(page.getByTestId('range-value')).toHaveText('C3 to C4');

  expect(consoleErrors).toEqual([]);
});
