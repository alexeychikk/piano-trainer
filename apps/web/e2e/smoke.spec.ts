import { expect, test, type Page } from '@playwright/test';

/**
 * The sample CDN is out of scope for a smoke test: every spec blocks it, so
 * audio deterministically takes ADR §2's built-in-synth fallback instead of
 * depending on the network. Chromium logs the blocked request as a console
 * error, which is therefore the one error the smoke path tolerates.
 */
const SOUNDFONT_URLS = '**/midi-js-soundfonts/**';

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const from = `${message.text()} ${message.location().url}`;
    if (from.includes('midi-js-soundfonts')) return;
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

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  // The runner route is client-rendered through the SPA fallback.
  await page.goto('/practice/find-the-note/');
  await expect(
    page.getByRole('heading', { name: 'Exercise: find-the-note' }),
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

  await page.getByTestId('enable-sound').click();

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
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const settingsToggle = page.getByTestId('metronome-toggle');
  await expect(settingsToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('metronome-tempo')).toHaveValue('120');

  await settingsToggle.click();
  await expect(settingsToggle).toHaveAttribute('aria-pressed', 'false');

  expect(consoleErrors).toEqual([]);
});
