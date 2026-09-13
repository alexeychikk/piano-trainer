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

test('free play shows what is held, from the computer keys and the mouse', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

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
