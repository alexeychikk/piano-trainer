import { expect, test, type Page } from '@playwright/test';
import { appIsListening, SOUNDFONT_URLS } from './support';

/*
 * The top bar stays on one line at every desktop and tablet width (bug
 * ac6327a3: at iPad portrait, 1032 px, it wrapped "PIANO-/TRAINER" and
 * "FREE/PLAY" and cut the sound chip off). It compacts instead — tighter
 * spacing below 1366 px, the wordmark's mark alone below 1280 px, glyph-only
 * status chips at ≤ 1100 px — and never breaks a label mid-word.
 *
 * Fonts matter here: Chakra Petch is not self-hosted, so the runner's
 * fallback face is what this measures, as on most real machines.
 */

const WIDTHS = [768, 1032, 1100, 1280, 1366, 1440];

/** How the bar lays out, read from the live DOM. */
function measureBar(page: Page) {
  return page.evaluate(() => {
    /** Distinct line boxes a visible element's text occupies. */
    const lines = (element: Element): number => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const tops = new Set(
        [...range.getClientRects()]
          .filter((rect) => rect.width > 0)
          .map((rect) => Math.round(rect.top)),
      );
      return tops.size;
    };
    const visible = (element: Element) =>
      element.getBoundingClientRect().width > 1;

    const bar = document.querySelector('.topbar')!;
    const labels = [
      ...document.querySelectorAll('.topbar .word, .topbar nav a'),
    ].filter(visible);
    const chips = [...document.querySelectorAll('.topbar .chip')].map(
      (chip) => {
        const rect = chip.getBoundingClientRect();
        const label = chip.querySelector('.label')!;
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          labelShown: visible(label),
          labelClipped: label.scrollWidth > label.clientWidth,
        };
      },
    );
    return {
      height: bar.getBoundingClientRect().height,
      overflow: bar.scrollWidth - bar.clientWidth,
      wrapped: labels
        .filter((label) => lines(label) !== 1)
        .map((label) => label.textContent),
      chips,
      viewport: window.innerWidth,
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.route(SOUNDFONT_URLS, (route) => route.abort());
});

for (const width of WIDTHS) {
  test(`the top bar stays on one line at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await appIsListening(page);

    const bar = await measureBar(page);
    expect(bar.height).toBe(56);
    expect(bar.overflow).toBe(0);
    expect(bar.wrapped).toEqual([]);
    expect(bar.chips).toHaveLength(2);
    for (const chip of bar.chips) {
      expect(chip.left).toBeGreaterThanOrEqual(0);
      expect(chip.right).toBeLessThanOrEqual(bar.viewport);
      expect(chip.top).toBeGreaterThanOrEqual(0);
      expect(chip.bottom).toBeLessThanOrEqual(56);
      // A label is either whole or (≤ 1100 px) gone — never ellipsised.
      expect(chip.labelShown).toBe(width > 1100);
      if (chip.labelShown) expect(chip.labelClipped).toBe(false);
    }

    // Collapsed or not, the names are still spelled out.
    await expect(
      page.getByRole('link', { name: /^piano-trainer$/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /^MIDI:/ })).toBeVisible();
  });
}
