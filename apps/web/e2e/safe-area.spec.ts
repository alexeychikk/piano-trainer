import { expect, test, type Page } from '@playwright/test';
import { SOUNDFONT_URLS } from './support';

/*
 * Safe areas (the iOS shell, iPhone/iPad Safari): `viewport-fit=cover` lets
 * the page run under the status bar and the home indicator, and the shell
 * clears them itself — the top bar owns the top and side insets, `.app` the
 * bottom one, and the top one too while focus mode hides the top bar.
 *
 * Chromium reports no insets on a desktop, so the inset case drives CDP's
 * `Emulation.setSafeAreaInsetsOverride` — the same `env(safe-area-inset-*)`
 * values WebKit hands the page inside the Capacitor shell.
 */

const INSETS = { top: 24, right: 44, bottom: 20, left: 44 };

async function overrideInsets(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  // Not in Playwright's bundled protocol typings yet; Chromium has it.
  await cdp.send(
    'Emulation.setSafeAreaInsetsOverride' as never,
    {
      insets: INSETS,
    } as never,
  );
}

function shellBox(page: Page) {
  return page.evaluate(() => {
    const px = (v: string) => parseFloat(v);
    const app = getComputedStyle(document.querySelector('.app')!);
    const bar = document.querySelector('.topbar');
    const mark = document.querySelector('.wordmark')?.getBoundingClientRect();
    return {
      appTop: px(app.paddingTop),
      appBottom: px(app.paddingBottom),
      barHeight: bar?.getBoundingClientRect().height ?? null,
      markTop: mark?.top ?? null,
      markLeft: mark?.left ?? null,
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.route(SOUNDFONT_URLS, (route) => route.abort());
});

test('without insets the shell is exactly as before', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.topbar')).toBeVisible();
  const box = await shellBox(page);
  expect(box.appTop).toBe(0);
  expect(box.appBottom).toBe(0);
  // --topbar-h, nothing added.
  expect(box.barHeight).toBe(56);
});

test('the top bar and the page clear the safe-area insets', async ({
  page,
}) => {
  await overrideInsets(page);
  await page.goto('/');
  await expect(page.locator('.topbar')).toBeVisible();
  const box = await shellBox(page);
  // The bar's face runs under the status bar; its content starts below it.
  expect(box.barHeight).toBe(56 + INSETS.top);
  expect(box.markTop).toBeGreaterThanOrEqual(INSETS.top);
  expect(box.markLeft).toBeGreaterThanOrEqual(INSETS.left);
  expect(box.appTop).toBe(0);
  expect(box.appBottom).toBe(INSETS.bottom);
});

test('focus mode hands the top inset to the page', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'piano-trainer:settings',
      JSON.stringify({ focusMode: true }),
    );
  });
  await overrideInsets(page);
  await page.goto('/practice/find-the-note/');
  await expect(page.getByTestId('prompt')).toBeVisible();
  await expect(page.locator('.topbar')).toHaveCount(0);
  const box = await shellBox(page);
  expect(box.appTop).toBe(INSETS.top);
  expect(box.appBottom).toBe(INSETS.bottom);
});
