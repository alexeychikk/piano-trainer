/**
 * In-app export (ADR 0005 §6, §9 ticket 5): a `blob:` download, handed to
 * the iOS share sheet.
 *
 * `apps/web` saves its backup the way every browser takes it — a `Blob`, an
 * object URL, and a click on an `<a download>` (`$lib/practice/download.ts`).
 * WKWebView does nothing with that click unless the host implements
 * `WKDownloadDelegate`, and Capacitor's bridge owns the navigation delegate. So
 * the shell catches the click instead, before WebKit sees it: a capture-phase
 * listener on `window` cancels it, reads the blob, and passes the text to the
 * local `FileShare` plugin, which writes it to a temporary file and presents
 * the share sheet (Save to Files, AirDrop, …). The app never learns any of
 * this; outside the shell the shim is not installed and the browser downloads.
 *
 * Why read the blob here and not by URL later: `downloadText()` revokes its
 * URL right after the click, so the shim remembers which `Blob` each object
 * URL names (`trackObjectUrls`) and reads that. Plain DOM and an injected
 * plugin, tested in Vitest; `entry.ts` is the only file that touches
 * Capacitor.
 */

/** The local plugin's name, as `AppViewController` registers it. */
export const FILE_SHARE_PLUGIN = 'FileShare';

/** What a download hands the share sheet. */
export interface SharedFile {
  /** The anchor's `download` name; the native side sanitises it. */
  filename: string;
  /**
   * The file's contents. Text, because the one download the app makes is a
   * JSON backup and text crosses the bridge as itself; a binary download
   * would need base64 first.
   */
  text: string;
  mimeType: string;
  /**
   * Where the share sheet's popover points on iPad, in web-view points: the
   * control last clicked (the Export button). Absent → the
   * native side centres it.
   */
  anchor?: ShareAnchor;
}

export interface ShareAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShareResult {
  /** `false` when the user closed the sheet without choosing anything. */
  completed: boolean;
  activityType?: string;
}

/** What the shim needs from the native side. */
export interface FileSharePlugin {
  share(file: SharedFile): Promise<ShareResult>;
}

export interface FileShareEnvironment {
  isNativePlatform: boolean;
  pluginAvailable: boolean;
}

/** Install only inside the shell, and only over a registered plugin. */
export function shouldInstallFileShare(env: FileShareEnvironment): boolean {
  return env.isNativePlatform && env.pluginAvailable;
}

type ObjectUrlApi = Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;

/**
 * How many live object URLs are remembered. The app revokes its own; a URL
 * someone forgets to revoke must not pin its blob forever, so the oldest is
 * dropped past this.
 */
export const TRACKED_URL_LIMIT = 32;

/**
 * Wrap `createObjectURL`/`revokeObjectURL` so a URL can be read back as the
 * `Blob` it named — including during the click that a revoke follows. Only
 * blobs are remembered (a `MediaSource` URL is never a download).
 */
export function trackObjectUrls(api: ObjectUrlApi): {
  blobOf: (url: string) => Blob | undefined;
  /** Puts the original functions back. */
  restore: () => void;
} {
  const blobs = new Map<string, Blob>();
  const create = api.createObjectURL;
  const revoke = api.revokeObjectURL;
  api.createObjectURL = (object: Blob | MediaSource): string => {
    const url = create.call(api, object);
    if (typeof Blob !== 'undefined' && object instanceof Blob) {
      blobs.set(url, object);
      if (blobs.size > TRACKED_URL_LIMIT) {
        blobs.delete(blobs.keys().next().value as string);
      }
    }
    return url;
  };
  api.revokeObjectURL = (url: string): void => {
    blobs.delete(url);
    revoke.call(api, url);
  };
  return {
    blobOf: (url) => blobs.get(url),
    restore: () => {
      api.createObjectURL = create;
      api.revokeObjectURL = revoke;
      blobs.clear();
    },
  };
}

/** A click that would start a download the shell has to take over. */
export interface DownloadRequest {
  href: string;
  filename: string;
}

/** The fallback name for `<a download>` with no value (the native side's too). */
export const DEFAULT_DOWNLOAD_NAME = 'download';

/**
 * The download a click asks for, or `null` for any other click: an
 * `<a download>` (the click's target or an ancestor of it) whose URL is a
 * `blob:` or a `data:` URL. Anything already cancelled is left alone, and so
 * is a link to a real URL — the shell serves no files to download.
 */
export function downloadOf(event: Event): DownloadRequest | null {
  if (event.defaultPrevented) return null;
  const target = event.target as Element | null;
  const link = target?.closest?.('a[download]') as HTMLAnchorElement | null;
  if (!link) return null;
  const href = link.href;
  if (!href.startsWith('blob:') && !href.startsWith('data:')) return null;
  return {
    href,
    filename: link.getAttribute('download') || DEFAULT_DOWNLOAD_NAME,
  };
}

/** The control a click landed in: what a popover should point at. */
const CONTROL = 'button, a, input, select, [role="button"]';

/**
 * Where the popover should point: the control last clicked, else the focused
 * element — whichever is still in the page with a box. The control comes
 * first because the app disables Export while it runs, and a disabled button
 * has already given its focus back to `<body>` by the time the file exists.
 */
export function anchorOf(
  doc: Document,
  lastClicked: Element | null = null,
): ShareAnchor | undefined {
  for (const candidate of [lastClicked, doc.activeElement]) {
    if (!candidate || candidate === doc.body || !candidate.isConnected) {
      continue;
    }
    const rect = candidate.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }
  }
  return undefined;
}

export interface FileShareDeps {
  /** Reads a URL `trackObjectUrls` did not see (a `data:` URL). */
  fetch: (url: string) => Promise<{ blob(): Promise<Blob> }>;
  /** Where a failed share is reported; the app has no channel for it. */
  report: (error: unknown) => void;
}

/**
 * Take every download over: cancel the click, read the blob, share it. The
 * listener is on `window` in the capture phase, so it runs before any
 * handler in the page and before WebKit acts on the click. Returns the
 * uninstall (the shell never calls it; tests do).
 */
export function installFileShare(
  win: Window & typeof globalThis,
  plugin: FileSharePlugin,
  deps: FileShareDeps = {
    fetch: (url) => win.fetch(url),
    report: (error) => console.error('[FileShare]', error),
  },
): () => void {
  const { blobOf, restore } = trackObjectUrls(win.URL);
  let lastClicked: Element | null = null;
  const onClick = (event: Event): void => {
    const download = downloadOf(event);
    if (!download) {
      const target = event.target as Element | null;
      lastClicked = target?.closest?.(CONTROL) ?? target ?? null;
      return;
    }
    event.preventDefault();
    // Read now, synchronously: the URL may be revoked before a microtask.
    const tracked = blobOf(download.href);
    const anchor = anchorOf(win.document, lastClicked);
    const reading = tracked
      ? Promise.resolve(tracked)
      : deps.fetch(download.href).then((response) => response.blob());
    void reading
      .then(async (blob) =>
        plugin.share({
          filename: download.filename,
          text: await blob.text(),
          mimeType: blob.type || 'application/octet-stream',
          ...(anchor ? { anchor } : {}),
        }),
      )
      .catch(deps.report);
  };
  win.addEventListener('click', onClick, true);
  return () => {
    win.removeEventListener('click', onClick, true);
    restore();
  };
}
