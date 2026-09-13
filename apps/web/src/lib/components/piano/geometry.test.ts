import { describe, expect, it } from 'vitest';
import {
  BLACK_KEY_W_RATIO,
  LAYOUT_RANGES,
  WHITE_KEY_MAX_W,
  WHITE_KEY_MIN_W,
  clampRangeToWhiteKeys,
  keyboardMetrics,
  layoutKeys,
  resolveRange,
  whiteKeyCount,
  whiteKeyWidth,
} from './geometry';

describe('layout presets', () => {
  it('has the key counts the spec names', () => {
    const keyCount = (layout: 49 | 61 | 76 | 88) =>
      LAYOUT_RANGES[layout].high - LAYOUT_RANGES[layout].low + 1;
    expect(keyCount(49)).toBe(49);
    expect(keyCount(61)).toBe(61);
    expect(keyCount(76)).toBe(76);
    expect(keyCount(88)).toBe(88);
  });

  it('has the white-key counts the spec names', () => {
    expect(whiteKeyCount(LAYOUT_RANGES[49])).toBe(29);
    expect(whiteKeyCount(LAYOUT_RANGES[61])).toBe(36);
    expect(whiteKeyCount(LAYOUT_RANGES[76])).toBe(45);
    expect(whiteKeyCount(LAYOUT_RANGES[88])).toBe(52);
  });

  it('uses the explicit range only for the "range" layout', () => {
    expect(resolveRange(61, { low: 60, high: 64 })).toEqual(LAYOUT_RANGES[61]);
    expect(resolveRange('range', { low: 60, high: 64 })).toEqual({
      low: 60,
      high: 64,
    });
  });
});

describe('clampRangeToWhiteKeys', () => {
  it('extends outwards from black keys', () => {
    expect(clampRangeToWhiteKeys({ low: 61, high: 66 })).toEqual({
      low: 60,
      high: 67,
    });
  });

  it('leaves a white-keyed range alone', () => {
    expect(clampRangeToWhiteKeys({ low: 60, high: 72 })).toEqual({
      low: 60,
      high: 72,
    });
  });

  it('sorts a reversed range', () => {
    expect(clampRangeToWhiteKeys({ low: 72, high: 60 })).toEqual({
      low: 60,
      high: 72,
    });
  });
});

describe('layoutKeys', () => {
  const keys = layoutKeys({ low: 60, high: 72 });
  const byMidi = new Map(keys.map((key) => [key.midi, key]));

  it('tiles the white keys one width apart', () => {
    expect(byMidi.get(60)).toMatchObject({ left: 0, width: 1, black: false });
    expect(byMidi.get(62)?.left).toBe(1);
    expect(byMidi.get(72)?.left).toBe(7);
  });

  it('centres black keys on the boundary, then nudges them', () => {
    const cSharp = byMidi.get(61);
    expect(cSharp?.black).toBe(true);
    expect(cSharp?.width).toBe(BLACK_KEY_W_RATIO);
    // boundary at 1W, centred (−0.30W) and nudged by −0.12W.
    expect(cSharp?.left).toBeCloseTo(1 - 0.3 - 0.12);
    expect(byMidi.get(63)?.left).toBeCloseTo(2 - 0.3 + 0.12);
    expect(byMidi.get(68)?.left).toBeCloseTo(5 - 0.3);
  });

  it('draws white keys before black keys', () => {
    const firstBlack = keys.findIndex((key) => key.black);
    expect(keys.slice(0, firstBlack).every((key) => !key.black)).toBe(true);
    expect(keys.slice(firstBlack).every((key) => key.black)).toBe(true);
  });

  it('covers every note of the range exactly once', () => {
    expect(keys).toHaveLength(13);
    expect(new Set(keys.map((key) => key.midi)).size).toBe(13);
  });
});

describe('metrics', () => {
  it('clamps the white key width to a readable size', () => {
    expect(whiteKeyWidth(10, 36)).toBe(WHITE_KEY_MIN_W);
    expect(whiteKeyWidth(100_000, 36)).toBe(WHITE_KEY_MAX_W);
    expect(whiteKeyWidth(1440, 36)).toBe(40); // spec: 61 keys at 1440px
  });

  it('derives the key sizes from the container width', () => {
    const metrics = keyboardMetrics(1440, LAYOUT_RANGES[61]);
    expect(metrics.whiteWidth).toBe(40);
    expect(metrics.whiteHeight).toBe(248);
    expect(metrics.blackWidth).toBeCloseTo(24);
    expect(metrics.blackHeight).toBeCloseTo(153.76);
    expect(metrics.width).toBe(1440);
  });

  it('caps the height at maxHeightPx', () => {
    expect(keyboardMetrics(4000, LAYOUT_RANGES[61], 120).whiteHeight).toBe(120);
  });
});
