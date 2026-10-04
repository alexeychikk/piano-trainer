// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TRACKED_URL_LIMIT,
  anchorOf,
  downloadOf,
  installFileShare,
  shouldInstallFileShare,
  trackObjectUrls,
  type FileSharePlugin,
  type SharedFile,
} from './file-share';

// jsdom's `Blob` has no `text()`; WebKit's has (Safari 14+).
if (!('text' in Blob.prototype)) {
  Object.defineProperty(Blob.prototype, 'text', {
    value(this: Blob) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    },
  });
}

/** `URL`'s object-URL half, as jsdom has none. */
function fakeUrlApi() {
  let next = 0;
  const live = new Set<string>();
  return {
    live,
    createObjectURL: vi.fn((object: Blob | MediaSource) => {
      void object;
      const url = `blob:capacitor://localhost/${++next}`;
      live.add(url);
      return url;
    }),
    revokeObjectURL: vi.fn((url: string) => void live.delete(url)),
  };
}

/** The native side, as far as the shim can tell. */
function fakePlugin() {
  const shared: SharedFile[] = [];
  const plugin: FileSharePlugin = {
    share: vi.fn(async (file: SharedFile) => {
      shared.push(file);
      return { completed: true, activityType: 'save-to-files' };
    }),
  };
  return { plugin, shared };
}

/**
 * A window with the fake object-URL API, the shim installed over it, and
 * `apps/web`'s own `downloadText()` reproduced line for line.
 */
function shell() {
  const urls = fakeUrlApi();
  Object.assign(window.URL, {
    createObjectURL: urls.createObjectURL,
    revokeObjectURL: urls.revokeObjectURL,
  });
  const { plugin, shared } = fakePlugin();
  const report = vi.fn();
  const fetch = vi.fn(async (url: string) => ({
    blob: async () => new Blob([`fetched ${url}`], { type: 'text/plain' }),
  }));
  uninstall.push(installFileShare(window, plugin, { fetch, report }));

  function downloadText(filename: string, text: string): boolean {
    const url = URL.createObjectURL(
      new Blob([text], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    const notCancelled = link.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    link.remove();
    URL.revokeObjectURL(url);
    return notCancelled;
  }

  return { urls, plugin, shared, report, fetch, downloadText };
}

const until = (check: () => void) => vi.waitFor(check);
const uninstall: (() => void)[] = [];

afterEach(() => {
  for (const undo of uninstall.splice(0)) undo();
  document.body.innerHTML = '';
});

describe('shouldInstallFileShare', () => {
  it('installs only in the native shell over a registered plugin', () => {
    expect(
      shouldInstallFileShare({ isNativePlatform: true, pluginAvailable: true }),
    ).toBe(true);
    expect(
      shouldInstallFileShare({
        isNativePlatform: false,
        pluginAvailable: true,
      }),
    ).toBe(false);
    expect(
      shouldInstallFileShare({
        isNativePlatform: true,
        pluginAvailable: false,
      }),
    ).toBe(false);
  });
});

describe('trackObjectUrls', () => {
  it('reads a blob back by its URL until the URL is revoked', () => {
    const api = fakeUrlApi();
    const { blobOf } = trackObjectUrls(api);
    const blob = new Blob(['{}']);
    const url = api.createObjectURL(blob);
    expect(blobOf(url)).toBe(blob);
    api.revokeObjectURL(url);
    expect(blobOf(url)).toBeUndefined();
    // The real API still did its job both times.
    expect(api.live.size).toBe(0);
  });

  it('forgets the oldest URL past the limit, so a leak cannot grow', () => {
    const api = fakeUrlApi();
    const { blobOf } = trackObjectUrls(api);
    const urls = Array.from({ length: TRACKED_URL_LIMIT + 1 }, () =>
      api.createObjectURL(new Blob(['x'])),
    );
    expect(blobOf(urls[0])).toBeUndefined();
    expect(blobOf(urls[1])).toBeDefined();
    expect(blobOf(urls[TRACKED_URL_LIMIT])).toBeDefined();
  });

  it('does not remember what is not a blob', () => {
    const api = fakeUrlApi();
    const { blobOf } = trackObjectUrls(api);
    const url = api.createObjectURL({} as MediaSource);
    expect(blobOf(url)).toBeUndefined();
  });
});

describe('downloadOf', () => {
  function clickOn(target: Element, init: { cancelled?: boolean } = {}) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: target });
    if (init.cancelled) event.preventDefault();
    return event;
  }

  it('reads a blob download and its name', () => {
    const link = document.createElement('a');
    link.href = 'blob:capacitor://localhost/1';
    link.download = 'piano-trainer-2026-10-04.json';
    expect(downloadOf(clickOn(link))).toEqual({
      href: 'blob:capacitor://localhost/1',
      filename: 'piano-trainer-2026-10-04.json',
    });
  });

  it('finds the link from a click on something inside it', () => {
    const link = document.createElement('a');
    link.href = 'data:application/json,%7B%7D';
    link.setAttribute('download', '');
    const label = document.createElement('span');
    link.append(label);
    expect(downloadOf(clickOn(label))).toEqual({
      href: 'data:application/json,%7B%7D',
      filename: 'download',
    });
  });

  it('leaves every other click alone', () => {
    const plain = document.createElement('a');
    plain.href = 'blob:capacitor://localhost/1';
    expect(downloadOf(clickOn(plain))).toBeNull();

    const remote = document.createElement('a');
    remote.href = 'https://example.com/file.json';
    remote.download = 'file.json';
    expect(downloadOf(clickOn(remote))).toBeNull();

    const cancelled = document.createElement('a');
    cancelled.href = 'blob:capacitor://localhost/2';
    cancelled.download = 'x.json';
    expect(downloadOf(clickOn(cancelled, { cancelled: true }))).toBeNull();

    expect(downloadOf(clickOn(document.createElement('button')))).toBeNull();
  });
});

describe('anchorOf', () => {
  const box = (x: number, y: number, width: number, height: number) => () =>
    ({ x, y, width, height }) as DOMRect;

  it('points at the focused control, and at nothing without one', () => {
    expect(anchorOf(document)).toBeUndefined();
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    // jsdom lays nothing out: a zero box is no anchor.
    expect(anchorOf(document)).toBeUndefined();
    button.getBoundingClientRect = box(10, 20, 120, 40);
    expect(anchorOf(document)).toEqual({
      x: 10,
      y: 20,
      width: 120,
      height: 40,
    });
  });

  it('prefers the control last clicked, while it is still in the page', () => {
    const clicked = document.createElement('button');
    clicked.getBoundingClientRect = box(1, 2, 3, 4);
    const focused = document.createElement('input');
    focused.getBoundingClientRect = box(5, 6, 7, 8);
    document.body.append(clicked, focused);
    focused.focus();
    expect(anchorOf(document, clicked)).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });
    clicked.remove();
    expect(anchorOf(document, clicked)).toEqual({
      x: 5,
      y: 6,
      width: 7,
      height: 8,
    });
  });
});

describe('installFileShare', () => {
  it("shares apps/web's backup download instead of letting WebKit drop it", async () => {
    const { shared, report, fetch, downloadText } = shell();
    const json = JSON.stringify({ schemaVersion: 2, attempts: [] });

    // The page's own click is cancelled before WebKit can act on it.
    expect(downloadText('piano-trainer-2026-10-04.json', json)).toBe(false);

    await until(() => expect(shared).toHaveLength(1));
    expect(shared[0]).toEqual({
      filename: 'piano-trainer-2026-10-04.json',
      text: json,
      mimeType: 'application/json',
    });
    // Read from the remembered blob, after `downloadText()` revoked its URL.
    expect(fetch).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it('anchors the popover on the button that was pressed, even once disabled', async () => {
    const { shared, downloadText } = shell();
    const button = document.createElement('button');
    const label = document.createElement('span');
    button.append(label);
    document.body.append(button);
    button.getBoundingClientRect = () =>
      ({ x: 40, y: 300, width: 160, height: 44 }) as DOMRect;
    // The app's Export: a click, then the button disables itself (and
    // drops focus) while the payload is built, then the download.
    label.click();
    button.disabled = true;
    button.blur();

    downloadText('backup.json', '{}');
    await until(() => expect(shared).toHaveLength(1));
    expect(shared[0].anchor).toEqual({ x: 40, y: 300, width: 160, height: 44 });
  });

  it('reads a URL it did not create by fetching it', async () => {
    const { shared, fetch } = shell();
    const link = document.createElement('a');
    link.href = 'data:text/plain,hello';
    link.download = 'hello.txt';
    document.body.append(link);
    link.click();

    await until(() => expect(shared).toHaveLength(1));
    expect(fetch).toHaveBeenCalledWith('data:text/plain,hello');
    expect(shared[0]).toMatchObject({
      filename: 'hello.txt',
      text: 'fetched data:text/plain,hello',
      mimeType: 'text/plain',
    });
  });

  it('reports a share that failed, and never throws into the page', async () => {
    const { plugin, report, downloadText } = shell();
    vi.mocked(plugin.share).mockRejectedValueOnce(new Error('no view'));
    expect(() => downloadText('backup.json', '{}')).not.toThrow();
    await until(() => expect(report).toHaveBeenCalledOnce());
    expect(String(report.mock.calls[0][0])).toContain('no view');
  });

  it('lets an ordinary link click through', () => {
    const { shared } = shell();
    const link = document.createElement('a');
    link.href = '#data';
    document.body.append(link);
    const notCancelled = link.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    expect(notCancelled).toBe(true);
    expect(shared).toHaveLength(0);
  });
});
