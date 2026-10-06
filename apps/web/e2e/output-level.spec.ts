import { expect, test, type Page } from '@playwright/test';
import { appIsListening, SOUNDFONT_URLS } from './support';

/*
 * Output level in a real browser (bug 94e41524). Chromium's own
 * `OfflineAudioContext` stands in for the `AudioContext` the engine creates, so
 * the real graph — synth voices, master volume, the `DynamicsCompressorNode`
 * limiter and its make-up trim — renders to a buffer whose peak we can read.
 * The sample CDN is blocked as everywhere else, so this is the synth path; the
 * soundfont's calibration is the unit test's (`src/lib/audio/level.test.ts`).
 */

declare global {
  interface Window {
    __offline?: OfflineAudioContext;
  }
}

const SETTINGS_KEY = 'piano-trainer:settings';

async function openAtFullVolume(page: Page): Promise<void> {
  await page.route(SOUNDFONT_URLS, (route) => route.abort());
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ volume: 1 }));
    // A one-second offline render, behind the constructor the engine calls.
    // `resume()` has nothing to do before rendering starts.
    class OfflineAsRealtime extends OfflineAudioContext {
      constructor() {
        super({ numberOfChannels: 2, length: 48_000, sampleRate: 48_000 });
        window.__offline = this;
      }
      resume(): Promise<void> {
        return Promise.resolve();
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext =
      OfflineAsRealtime;
  }, SETTINGS_KEY);
  await page.goto('/play/');
  await appIsListening(page);
}

/** Render what the engine scheduled and return the peak in dBFS. */
async function renderedPeakDb(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const buffer = await window.__offline!.startRendering();
    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      for (const sample of buffer.getChannelData(channel)) {
        peak = Math.max(peak, Math.abs(sample));
      }
    }
    return 20 * Math.log10(peak);
  });
}

test('one note at 100 % volume peaks around −3 dBFS', async ({ page }) => {
  await openAtFullVolume(page);

  // A = C4, held: the computer keys play at the app's own velocity.
  await page.keyboard.down('a');
  await expect(page.getByRole('button', { name: 'C 4' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const peakDb = await renderedPeakDb(page);
  expect(peakDb).toBeGreaterThan(-3.6);
  expect(peakDb).toBeLessThan(-2.4);
});

test('four held notes at 100 % volume never clip', async ({ page }) => {
  await openAtFullVolume(page);

  // C4 E4 G4 B4 as four separate note-ons — a chord from a piano, which no
  // headroom budget sees: the limiter alone keeps it under full scale.
  for (const key of ['a', 'd', 'g', 'j']) await page.keyboard.down(key);
  await expect(page.getByTestId('held-notes')).toContainText(
    'C4 · E4 · G4 · B4',
  );

  const peakDb = await renderedPeakDb(page);
  expect(peakDb).toBeLessThan(0);
  // Louder than one note, or the limiter is doing more than limiting.
  expect(peakDb).toBeGreaterThan(-3);
});
