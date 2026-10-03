/**
 * Is this an iPhone or iPad? Pure, so it is tested without a browser.
 *
 * It matters for one sentence only: on iOS and iPadOS every browser is WebKit
 * (App Store rule 2.5.6), and WebKit has no Web MIDI, so telling an iPad user
 * to "use Chrome" sends them to the same engine (ADR 0005). Nothing else in
 * the app may branch on it — `$lib/midi` sees Web MIDI or no Web MIDI.
 */

export interface PlatformHints {
  userAgent: string;
  /** `navigator.platform` — deprecated, still what Safari reports. */
  platform?: string;
  maxTouchPoints?: number;
}

/**
 * iPhone, iPod or iPad — including **iPadOS 13+, which reports itself as a
 * Mac** (`MacIntel`, a `Macintosh` user agent). No Mac has a touch screen,
 * so a "Mac" with more than one touch point is an iPad.
 */
export function isAppleMobile({
  userAgent,
  platform = '',
  maxTouchPoints = 0,
}: PlatformHints): boolean {
  if (/iPhone|iPad|iPod/.test(platform) || /iPhone|iPad|iPod/.test(userAgent)) {
    return true;
  }
  const looksLikeMac = /^Mac/.test(platform) || /Macintosh/.test(userAgent);
  return looksLikeMac && maxTouchPoints > 1;
}

/** The hints of the running browser; `null` outside one (prerendering). */
export function currentPlatformHints(): PlatformHints | null {
  if (typeof navigator === 'undefined') return null;
  return {
    userAgent: navigator.userAgent ?? '',
    platform: navigator.platform ?? '',
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  };
}
