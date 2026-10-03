import { describe, expect, it } from 'vitest';
import { isAppleMobile } from './platform';

const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const IPHONE_CHROME_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1';
const IPAD_MOBILE_UA =
  'Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1';
const MAC_SAFARI_UA = IPAD_DESKTOP_UA;
const WINDOWS_FIREFOX_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';

describe('isAppleMobile', () => {
  it('recognises an iPhone, Chrome included (it is WebKit there too)', () => {
    expect(
      isAppleMobile({
        userAgent: IPHONE_CHROME_UA,
        platform: 'iPhone',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it('recognises a pre-13 iPad by its user agent alone', () => {
    expect(isAppleMobile({ userAgent: IPAD_MOBILE_UA })).toBe(true);
  });

  it('recognises iPadOS reporting itself as a Mac, by its touch points', () => {
    expect(
      isAppleMobile({
        userAgent: IPAD_DESKTOP_UA,
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it('still recognises it when the platform string is missing', () => {
    expect(
      isAppleMobile({ userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 5 }),
    ).toBe(true);
  });

  it('leaves a real Mac alone (no touch screen)', () => {
    expect(
      isAppleMobile({
        userAgent: MAC_SAFARI_UA,
        platform: 'MacIntel',
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });

  it('leaves other browsers alone, touch screens included', () => {
    expect(
      isAppleMobile({
        userAgent: WINDOWS_FIREFOX_UA,
        platform: 'Win32',
        maxTouchPoints: 10,
      }),
    ).toBe(false);
    expect(
      isAppleMobile({
        userAgent: ANDROID_UA,
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
      }),
    ).toBe(false);
  });
});
