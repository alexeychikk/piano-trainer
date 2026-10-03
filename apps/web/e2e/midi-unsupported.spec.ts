import { expect, test, type Page } from '@playwright/test';
import { appIsListening, SOUNDFONT_URLS, watchConsole } from './support';

/*
 * A browser with no Web MIDI says so, and says the right thing on an iPad
 * (ADR 0005): every iOS browser is WebKit, so "use Chrome" would be wrong
 * advice there. Chromium has Web MIDI, so it is taken away before the app
 * loads; iPadOS 13+ is faked the way it really reports itself — as a Mac
 * with a touch screen.
 */

const IPAD_LINE = /on iPad and iPhone no browser has Web MIDI/;
const GENERIC_LINE = /This browser has no Web MIDI\. Chrome, Edge and Opera do/;

async function withoutWebMidi(page: Page, { iPad }: { iPad: boolean }) {
  await page.addInitScript((fakeIPad) => {
    delete (Navigator.prototype as { requestMIDIAccess?: unknown })
      .requestMIDIAccess;
    if (fakeIPad) {
      Object.defineProperty(Navigator.prototype, 'platform', {
        configurable: true,
        get: () => 'MacIntel',
      });
      Object.defineProperty(Navigator.prototype, 'maxTouchPoints', {
        configurable: true,
        get: () => 5,
      });
    }
  }, iPad);
}

test.beforeEach(async ({ page }) => {
  await page.route(SOUNDFONT_URLS, (route) => route.abort());
});

test('an iPad (reporting as a Mac) is pointed at a Web MIDI browser app, not Chrome', async ({
  page,
}) => {
  const consoleErrors = watchConsole(page);
  await withoutWebMidi(page, { iPad: true });

  // Free Play's strip.
  await page.goto('/play/');
  await appIsListening(page);
  const strip = page.getByText(IPAD_LINE);
  await expect(strip).toBeVisible();
  await expect(strip).toContainText('Web MIDI Browser');
  await expect(strip).not.toContainText('Chrome');
  // Not colour alone: the chip names the state in words as well.
  await expect(page.getByText('MIDI unsupported').first()).toBeVisible();

  // Settings' MIDI section, where the device list would be.
  await page.goto('/settings/');
  await appIsListening(page);
  await expect(page.getByText(IPAD_LINE)).toBeVisible();
  await expect(page.getByTestId('midi-device')).toBeDisabled();

  // The runner's strip.
  await page.goto('/practice/find-the-note/');
  await expect(page.getByTestId('prompt')).toHaveText('Ready?');
  await expect(page.getByText(IPAD_LINE)).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test('another browser without Web MIDI keeps the generic wording', async ({
  page,
}) => {
  await withoutWebMidi(page, { iPad: false });
  await page.goto('/play/');
  await appIsListening(page);
  await expect(page.getByText(GENERIC_LINE)).toBeVisible();
  await expect(page.getByText(IPAD_LINE)).toHaveCount(0);
});

test('nothing changes when Web MIDI exists', async ({ page }) => {
  await page.goto('/play/');
  await appIsListening(page);
  await expect(page.getByText(/No MIDI keyboard/)).toBeVisible();
  await expect(page.getByText(IPAD_LINE)).toHaveCount(0);
  await expect(page.getByText(GENERIC_LINE)).toHaveCount(0);
});
