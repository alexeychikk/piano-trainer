import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { appIsListening, SOUNDFONT_URLS, watchConsole } from './support';

/*
 * The iPad shell's Web MIDI shim (ADR 0005 §4.1, §9 ticket 2), driven through
 * the real app in real Chromium. Nobody on the team has an iPad, so this is
 * the proof that the whole web side works over CoreMIDI: the *built* shim
 * (`apps/ios/dist/web-midi-shim.js`, `@capacitor/core` bundled in) is injected
 * at document start, exactly as `AppViewController` will add it, on top of a
 * fake of Capacitor's **native** side — the `window.webkit` bridge that makes
 * the platform `ios`, the `PluginHeaders` that make `CoreMidi` available, and
 * `nativePromise`/`nativeCallback`, which is all `registerPlugin()` calls.
 * Chromium's own Web MIDI is removed first, as WebKit has none.
 *
 * `apps/web` is not told any of this: it sees `navigator.requestMIDIAccess`.
 */

const SHIM = fileURLToPath(
  new URL('../../ios/dist/web-midi-shim.js', import.meta.url),
);

const PIANO = { id: '1001', name: 'Test Piano', manufacturer: 'Acme' };
const CONNECTED = `MIDI: connected to ${PIANO.name}`;
const LOST = `${PIANO.name} disconnected — switched to the on-screen keyboard.`;

/** What the shim hands the `FileShare` plugin (`apps/ios/src/file-share.ts`). */
interface SharedFile {
  filename: string;
  text: string;
  mimeType: string;
  anchor?: { x: number; y: number; width: number; height: number };
}

interface FakeCoreMidi {
  calls: string[];
  plug(sources: (typeof PIANO)[]): void;
  send(id: string, data: number[][]): void;
}

/** The native half of Capacitor, as far as `@capacitor/core` can tell. */
async function insideTheShell(page: Page): Promise<void> {
  await page.addInitScript((piano) => {
    delete (Navigator.prototype as { requestMIDIAccess?: unknown })
      .requestMIDIAccess;

    type Callback = (data: unknown) => void;
    const listeners: Record<string, Map<string, Callback>> = {
      sourcesChanged: new Map(),
      messages: new Map(),
    };
    let sources = [piano];
    let nextCallbackId = 1;
    const calls: string[] = [];
    const shared: SharedFile[] = [];

    const win = window as unknown as Record<string, unknown>;
    // `getPlatform()` is `ios` when this handler exists.
    win.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
    win.Capacitor = {
      PluginHeaders: [
        {
          name: 'CoreMidi',
          methods: [
            { name: 'start', rtype: 'promise' },
            { name: 'addListener', rtype: 'callback' },
            { name: 'removeListener', rtype: 'promise' },
            { name: 'removeAllListeners', rtype: 'promise' },
          ],
        },
        { name: 'FileShare', methods: [{ name: 'share', rtype: 'promise' }] },
      ],
      nativePromise(plugin: string, method: string, options: unknown) {
        calls.push(`${plugin}.${method}`);
        if (plugin === 'CoreMidi' && method === 'start') {
          return Promise.resolve({ sources });
        }
        if (plugin === 'FileShare' && method === 'share') {
          shared.push(options as SharedFile);
          return Promise.resolve({ completed: true });
        }
        if (plugin === 'CoreMidi' && method === 'removeListener') {
          const { eventName, callbackId } = options as Record<string, string>;
          listeners[eventName]?.delete(callbackId);
          return Promise.resolve();
        }
        return Promise.reject(new Error(`${plugin}.${method} is not faked`));
      },
      nativeCallback(
        plugin: string,
        method: string,
        options: { eventName: string },
        callback: Callback,
      ) {
        calls.push(`${plugin}.${method}:${options.eventName}`);
        const callbackId = String(nextCallbackId++);
        listeners[options.eventName]?.set(callbackId, callback);
        return callbackId;
      },
    };
    const fake: FakeCoreMidi = {
      calls,
      plug(next) {
        sources = next;
        for (const callback of listeners.sourcesChanged.values()) {
          callback({ sources });
        }
      },
      send(id, data) {
        for (const callback of listeners.messages.values()) {
          callback({ id, data });
        }
      },
    };
    win.__coreMidi = fake;
    win.__fileShare = { shared };
  }, PIANO);
  await page.addInitScript({ path: SHIM });
}

function send(page: Page, data: number[][]): Promise<void> {
  return page.evaluate(
    ({ id, data }) =>
      (window as unknown as { __coreMidi: FakeCoreMidi }).__coreMidi.send(
        id,
        data,
      ),
    { id: PIANO.id, data },
  );
}

function plug(page: Page, sources: (typeof PIANO)[]): Promise<void> {
  return page.evaluate(
    (sources) =>
      (window as unknown as { __coreMidi: FakeCoreMidi }).__coreMidi.plug(
        sources,
      ),
    sources,
  );
}

const on = (...notes: number[]) => notes.map((n) => [0x90, n, 100]);
const off = (...notes: number[]) => notes.map((n) => [0x80, n, 0]);

test.beforeAll(() => {
  if (!existsSync(SHIM)) {
    throw new Error(
      `${SHIM} is missing: run \`pnpm --filter ios build:shim\` (the root \`pnpm test:e2e\` does).`,
    );
  }
});

test.beforeEach(async ({ page }) => {
  await page.route(SOUNDFONT_URLS, (route) => route.abort());
});

test('the piano connects on launch with no tap, and Free Play hears it', async ({
  page,
}) => {
  const consoleErrors = watchConsole(page);
  await insideTheShell(page);

  await page.goto('/play/');
  await appIsListening(page);
  // `autoConnect()` asked the permission, got `granted` from the shim and
  // connected on its own; the only input was remembered for next time.
  await expect(page.getByLabel(CONNECTED)).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __coreMidi: FakeCoreMidi }).__coreMidi.calls,
    ),
  ).toEqual([
    'CoreMidi.addListener:sourcesChanged',
    'CoreMidi.addListener:messages',
    'CoreMidi.start',
  ]);

  await send(page, on(60, 64, 67));
  await expect(page.getByTestId('chord')).toHaveText('CM');
  await expect(page.getByTestId('held-notes')).toContainText('C4 · E4 · G4');
  await expect(page.getByRole('button', { name: 'E 4' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await send(page, off(60, 64, 67));
  await expect(page.getByTestId('chord')).toHaveText('Play a chord');

  expect(consoleErrors).toEqual([]);
});

test('a chord drill grades a chord played on the piano (ADR 0004 capture)', async ({
  page,
}) => {
  const consoleErrors = watchConsole(page);
  await insideTheShell(page);

  await page.goto('/practice/chord-quality/');
  const prompt = page.getByTestId('prompt');
  await expect(prompt).toHaveText('Ready?');
  await expect(page.getByLabel(CONNECTED)).toBeVisible();

  await page.keyboard.press('Space');
  await expect(prompt).toHaveText('Which chord did you hear?');
  await expect(page.getByTestId('replay')).toBeEnabled();
  // With a MIDI device the bar says how a chord answer closes.
  await expect(page.getByTestId('shortcuts')).toContainText(
    'release to answer',
  );

  // One struck chord, held, then released: a MIDI answer closes on release.
  await send(page, on(60, 64, 67, 70));
  await expect(page.getByRole('button', { name: 'C 4' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('answered')).toContainText('0/0');
  await send(page, off(60, 64, 67, 70));

  await expect(page.getByTestId('answered')).toContainText('/1');
  await expect(page.getByTestId('feedback')).toContainText(/✓|✗/);

  expect(consoleErrors).toEqual([]);
});

test('a correct answer waits; the piano C1 moves on and is never graded', async ({
  page,
}) => {
  const consoleErrors = watchConsole(page);
  await insideTheShell(page);

  await page.goto('/practice/find-the-note/');
  const prompt = page.getByTestId('prompt');
  const feedback = page.getByTestId('feedback');
  const answered = page.getByTestId('answered');
  await expect(prompt).toHaveText('Ready?');
  await expect(page.getByLabel(CONNECTED)).toBeVisible();
  await page.keyboard.press('Space');
  await expect(prompt).toHaveText('Which note?');
  await expect(page.getByTestId('replay')).toBeEnabled();

  // C1 while a question is open is consumed: the C4 after it is the answer
  // (a miss names C4, never C1). C4 is right 1 time in 61 — then C1 moves on
  // and the next question is tried.
  let missLine = '';
  for (let tries = 0; tries < 4 && !missLine; tries += 1) {
    await expect(feedback).toBeEmpty();
    await send(page, [...on(24), ...off(24), ...on(60), ...off(60)]);
    await expect(feedback).toContainText(/try again|correct/i);
    const text = (await feedback.textContent()) ?? '';
    if (/try again/i.test(text)) missLine = text;
    else await send(page, [...on(24), ...off(24)]);
  }
  expect(missLine).toContain('You played C4');
  const [, distance, unit, direction] =
    /You played C4 — (?:the right note, )?(\d+) (semitone|octave)s? too (high|low)/.exec(
      missLine,
    ) ?? [];
  const step = (unit === 'octave' ? 12 : 1) * Number(distance);
  const expected = 60 + (direction === 'high' ? -step : step);
  const before = (await answered.textContent()) ?? '';

  // The right note: the success state stays, with the hint, on the piano too.
  await send(page, [...on(expected), ...off(expected)]);
  await expect(feedback).toContainText(/correct/i);
  await expect(feedback).toContainText('Press C1 or Enter for next');
  await expect(page.getByTestId('shortcuts')).toContainText(
    'Press C1 or Enter for next',
  );

  // Free play: lit and heard, never graded.
  await send(page, on(expected + 1));
  await expect(
    page.locator('[data-piano-keyboard] button[aria-pressed="true"]'),
  ).toHaveCount(1);
  await send(page, off(expected + 1));
  await expect(feedback).toContainText(/correct/i);
  await expect(answered).toHaveText(before);

  // C1 moves on, and is not an answer to the next question either.
  await send(page, [...on(24), ...off(24)]);
  await expect(feedback).toBeEmpty();
  await expect(prompt).toHaveText('Which note?');
  await expect(answered).toHaveText(before);

  expect(consoleErrors).toEqual([]);
});

test('unplugging says so, and the same piano comes back on replug', async ({
  page,
}) => {
  await insideTheShell(page);

  await page.goto('/play/');
  await appIsListening(page);
  await expect(page.getByLabel(CONNECTED)).toBeVisible();

  await plug(page, []);
  await expect(page.getByText(LOST)).toBeVisible();
  await expect(page.getByLabel(CONNECTED)).toHaveCount(0);
  // A disconnected port delivers nothing, even if the bridge says otherwise.
  await send(page, on(62));
  await expect(page.getByTestId('chord')).toHaveText('Play a chord');

  await plug(page, [PIANO]);
  await expect(page.getByLabel(CONNECTED)).toBeVisible();
  await send(page, on(62));
  await expect(page.getByTestId('held-notes')).toContainText('D4');
});

test('outside the shell the shim stands down', async ({ page }) => {
  // No fake bridge: Chromium's platform is `web`, so its own Web MIDI stays.
  await page.addInitScript({ path: SHIM });
  await page.goto('/play/');
  await appIsListening(page);
  const native = await page.evaluate(() =>
    Function.prototype.toString
      .call(navigator.requestMIDIAccess)
      .includes('[native code]'),
  );
  expect(native).toBe(true);
});

/*
 * In-app export (ADR 0005 §6, §9 ticket 5). WKWebView drops a `blob:`
 * download, so in the shell the shim takes the click over and hands the file
 * to the `FileShare` plugin, which presents the share sheet. The round trip is
 * the same as `data-round-trip.spec.ts`'s: the file the share sheet was given
 * is the file the import's picker takes back.
 */
test('Export hands the backup to the share sheet, and that file imports', async ({
  page,
}) => {
  const consoleErrors = watchConsole(page);
  const downloads: string[] = [];
  page.on('download', (download) =>
    downloads.push(download.suggestedFilename()),
  );
  await insideTheShell(page);

  // One graded attempt from the piano. C4 — right or wrong, it is logged.
  await page.goto('/practice/find-the-note/');
  const prompt = page.getByTestId('prompt');
  await expect(prompt).toHaveText('Ready?');
  await expect(page.getByLabel(CONNECTED)).toBeVisible();
  await page.keyboard.press('Space');
  await expect(prompt).toHaveText('Which note?');
  await expect(page.getByTestId('replay')).toBeEnabled();
  await send(page, on(60));
  await expect(page.getByTestId('answered')).toContainText('/1');
  await send(page, off(60));

  await page.getByRole('link', { name: /^settings$/i }).click();
  await expect(page).toHaveURL(/\/settings\/$/);
  await appIsListening(page);

  const result = page.locator('#data [role="status"]');
  await page.getByTestId('export-json').click();
  await expect(result).toContainText('Exported 1 attempt and 1 skill.');
  const shared = await page.evaluate(
    () =>
      (window as unknown as { __fileShare: { shared: SharedFile[] } })
        .__fileShare.shared,
  );
  expect(shared).toHaveLength(1);
  const [file] = shared;
  expect(file.filename).toMatch(/^piano-trainer-\d{4}-\d{2}-\d{2}\.json$/);
  expect(file.mimeType).toBe('application/json');
  // The popover points at the button that was pressed.
  expect(file.anchor?.width).toBeGreaterThan(0);
  const payload = JSON.parse(file.text);
  expect(payload.attempts).toHaveLength(1);
  expect(payload.attempts[0].skillId).toMatch(/^find-the-note:/);
  // WebKit never saw the download.
  expect(downloads).toEqual([]);

  await page.getByTestId('reset-data').click();
  await page.getByTestId('reset-word').fill('RESET');
  await page.getByTestId('reset-confirm').click();
  await expect(result).toContainText('Reset 1 attempt and 1 skill.');

  // Import goes through `<input type="file">`, which WKWebView turns into
  // the document picker on its own; the shell adds nothing there.
  await page.getByTestId('import-file').setInputFiles({
    name: file.filename,
    mimeType: file.mimeType,
    buffer: Buffer.from(file.text),
  });
  await expect(result).toContainText('Imported 1 attempt, 1 skill.');

  await page.goto('/progress/');
  await appIsListening(page);
  await expect(
    page.getByRole('heading', { name: /^find the note$/i }),
  ).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test('outside the shell Export is an ordinary download', async ({ page }) => {
  // No fake bridge: the shim is present but stands down, so the browser's
  // own download path is untouched.
  await page.addInitScript({ path: SHIM });
  await page.goto('/settings/');
  await appIsListening(page);
  const downloading = page.waitForEvent('download');
  await page.getByTestId('export-json').click();
  expect((await downloading).suggestedFilename()).toMatch(
    /^piano-trainer-\d{4}-\d{2}-\d{2}\.json$/,
  );
});
