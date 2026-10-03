import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { appIsListening, SOUNDFONT_URLS, watchConsole } from './support';

/*
 * Slice 5b end to end, in real Chromium IndexedDB: the unit tests prove the
 * transaction against `fake-indexeddb`, this proves the backup a user makes is
 * one the app takes back. Answer → export → reset → import, with a full reload
 * between every write and the read that checks it — only IndexedDB survives a
 * reload, so each `No attempts yet.` (or its absence) is a statement about
 * storage, never about the in-memory store.
 *
 * Every wait is a signal the app gives (CLAUDE.md): the `Ready?` prompt on the
 * client-rendered runner, `appIsListening()` on the prerendered `/settings`
 * and `/progress`, and the Data section's inline `✓` line, which it writes only
 * after the export, the reset's transaction or the import's `replaceAll()` has
 * resolved.
 */

test.beforeEach(async ({ page }) => {
  await page.route(SOUNDFONT_URLS, (route) => route.abort());
});

const EMPTY = 'No attempts yet.';

test('a practice export survives a reset and comes back on import', async ({
  page,
}, testInfo) => {
  const consoleErrors = watchConsole(page);

  // One graded attempt. `A` is C4 — right or wrong, it is logged.
  await page.goto('/practice/find-the-note/');
  const prompt = page.getByTestId('prompt');
  await expect(prompt).toHaveText('Ready?');
  await page.keyboard.press('Space');
  await expect(prompt).toHaveText('Which note?');
  await expect(page.getByTestId('replay')).toBeEnabled();
  await page.keyboard.press('a');
  await expect(page.getByTestId('answered')).toContainText('/1');

  // Leave through the nav: the root layout's `onNavigate` awaits
  // `practice.flush()`, so the attempt is on disk before `/settings` renders.
  await page.getByRole('link', { name: /^settings$/i }).click();
  await expect(page).toHaveURL(/\/settings\/$/);
  await appIsListening(page);

  // Export, and keep the file the browser was handed.
  const result = page.locator('#data [role="status"]');
  const downloading = page.waitForEvent('download');
  await page.getByTestId('export-json').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(
    /^piano-trainer-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const file = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  await expect(result).toContainText('✓');
  await expect(result).toContainText('Exported 1 attempt and 1 skill.');
  const payload = JSON.parse(await readFile(file, 'utf8'));
  expect(payload.attempts).toHaveLength(1);
  expect(payload.attempts[0].skillId).toMatch(/^find-the-note:/);

  // Reset, through the inline confirmation (never a dialog).
  await page.getByTestId('reset-data').click();
  await page.getByTestId('reset-word').fill('RESET');
  await page.getByTestId('reset-confirm').click();
  await expect(result).toContainText('Reset 1 attempt and 1 skill.');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // The log is empty in storage, not just on screen.
  await page.goto('/progress/');
  await appIsListening(page);
  await expect(page.getByText(EMPTY)).toBeVisible();

  // Import the file the export wrote.
  await page.goto('/settings/');
  await appIsListening(page);
  await page.getByTestId('import-file').setInputFiles(file);
  await expect(result).toContainText('✓');
  await expect(result).toContainText('Imported 1 attempt, 1 skill.');

  // A full reload of `/progress`: the attempt is back from IndexedDB. The
  // prerendered document carries neither panel (both sit behind
  // `practice.hydrated`), so `appIsListening()` comes before the negative
  // assertion, or the HTML alone could satisfy it.
  await page.goto('/progress/');
  await appIsListening(page);
  await expect(page.getByRole('heading', { name: /^today$/i })).toBeVisible();
  await expect(page.getByText(EMPTY)).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: /^find the note$/i }),
  ).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
