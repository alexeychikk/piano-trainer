/**
 * Piano keyboard geometry (UX spec §5.2). Pure: given a range it returns where
 * every key sits, in units of the white-key width `W`, so the component only
 * has to multiply by the measured `W`.
 *
 * The numeric constants mirror the keyboard tokens in `tokens.css`
 * (`--key-white-w-min/max`, `--key-white-ratio`, `--key-black-w-ratio`,
 * `--key-black-h-ratio`) — layout maths cannot read CSS variables, so this is
 * the one place they are repeated. Change the spec, then both.
 */

import { isBlackKey, pcOf, type Midi } from '$lib/theory';

export type KeyboardLayout = 49 | 61 | 76 | 88 | 'range';

export interface KeyRange {
  low: Midi;
  high: Midi;
}

/** Preset keyboards, by key count (UX spec §5.2). */
export const LAYOUT_RANGES: Readonly<Record<49 | 61 | 76 | 88, KeyRange>> = {
  49: { low: 36, high: 84 }, // C2–C6
  61: { low: 36, high: 96 }, // C2–C7
  76: { low: 28, high: 103 }, // E1–G7
  88: { low: 21, high: 108 }, // A0–C8
};

export const WHITE_KEY_MIN_W = 18;
export const WHITE_KEY_MAX_W = 48;
export const WHITE_KEY_RATIO = 6.2;
export const BLACK_KEY_W_RATIO = 0.6;
export const BLACK_KEY_H_RATIO = 0.62;
export const DEFAULT_MAX_HEIGHT = 280;

/** Nudge off the white-key boundary, in units of `W` (UX spec §5.2). */
const BLACK_KEY_NUDGE: Readonly<Record<number, number>> = {
  1: -0.12, // C#
  3: 0.12, // D#
  6: -0.15, // F#
  8: 0, // G#
  10: 0.15, // A#
};

export interface LaidOutKey {
  midi: Midi;
  black: boolean;
  /** Left edge, in units of `W`, from the left edge of the keyboard. */
  left: number;
  /** Width, in units of `W`. */
  width: number;
}

/** A range must start and end on a white key; extend outwards if it does not. */
export function clampRangeToWhiteKeys(range: KeyRange): KeyRange {
  let { low, high } = range;
  if (high < low) [low, high] = [high, low];
  while (isBlackKey(low) && low > 0) low -= 1;
  while (isBlackKey(high) && high < 127) high += 1;
  return { low, high };
}

/** The range a `layout` prop means. `'range'` uses the explicit range. */
export function resolveRange(
  layout: KeyboardLayout,
  range: KeyRange,
): KeyRange {
  const preset = layout === 'range' ? range : LAYOUT_RANGES[layout];
  return clampRangeToWhiteKeys(preset);
}

/** How many white keys the range spans. */
export function whiteKeyCount(range: KeyRange): number {
  let count = 0;
  for (let midi = range.low; midi <= range.high; midi += 1) {
    if (!isBlackKey(midi)) count += 1;
  }
  return count;
}

/**
 * Every key of the range with its position. White keys tile the row; black
 * keys are centred on the boundary between their neighbours, then nudged.
 */
export function layoutKeys(range: KeyRange): LaidOutKey[] {
  const keys: LaidOutKey[] = [];
  let whiteIndex = 0;
  for (let midi = range.low; midi <= range.high; midi += 1) {
    if (isBlackKey(midi)) {
      const nudge = BLACK_KEY_NUDGE[pcOf(midi)] ?? 0;
      keys.push({
        midi,
        black: true,
        left: whiteIndex - BLACK_KEY_W_RATIO / 2 + nudge,
        width: BLACK_KEY_W_RATIO,
      });
    } else {
      keys.push({ midi, black: false, left: whiteIndex, width: 1 });
      whiteIndex += 1;
    }
  }
  // White keys are drawn first so black keys stack above them without z-index
  // gymnastics.
  return keys.sort((a, b) => Number(a.black) - Number(b.black));
}

export interface KeyboardMetrics {
  whiteWidth: number;
  whiteHeight: number;
  blackWidth: number;
  blackHeight: number;
  /** Total drawn width — the keyboard stays centred when it is narrower. */
  width: number;
}

/** White-key width for a container, clamped to the readable range. */
export function whiteKeyWidth(
  containerWidth: number,
  whiteKeys: number,
): number {
  if (whiteKeys <= 0) return WHITE_KEY_MIN_W;
  const fitted = Math.floor(containerWidth / whiteKeys);
  return Math.min(WHITE_KEY_MAX_W, Math.max(WHITE_KEY_MIN_W, fitted));
}

/** All the pixel sizes the component needs, from one container width. */
export function keyboardMetrics(
  containerWidth: number,
  range: KeyRange,
  maxHeightPx: number = DEFAULT_MAX_HEIGHT,
): KeyboardMetrics {
  const whiteKeys = whiteKeyCount(range);
  const whiteWidth = whiteKeyWidth(containerWidth, whiteKeys);
  const whiteHeight = Math.min(WHITE_KEY_RATIO * whiteWidth, maxHeightPx);
  return {
    whiteWidth,
    whiteHeight,
    blackWidth: whiteWidth * BLACK_KEY_W_RATIO,
    blackHeight: whiteHeight * BLACK_KEY_H_RATIO,
    width: whiteWidth * whiteKeys,
  };
}
