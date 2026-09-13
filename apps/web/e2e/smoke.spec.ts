import { expect, test } from '@playwright/test';

test('the shell renders and the nav reaches every v1 screen', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

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
