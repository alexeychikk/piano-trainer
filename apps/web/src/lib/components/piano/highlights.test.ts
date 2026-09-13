import { describe, expect, it } from 'vitest';
import {
  HIGHLIGHT_GLYPHS,
  isPressable,
  mergeHighlights,
  nextFocusableMidi,
  strongestHighlight,
  type KeyHighlight,
} from './highlights';

describe('strongestHighlight', () => {
  it('follows the precedence wrong > correct > target > played > ghost > dim', () => {
    expect(strongestHighlight('dim', 'ghost')).toBe('ghost');
    expect(strongestHighlight('ghost', 'played')).toBe('played');
    expect(strongestHighlight('played', 'target')).toBe('target');
    expect(strongestHighlight('target', 'correct')).toBe('correct');
    expect(strongestHighlight('correct', 'wrong')).toBe('wrong');
  });

  it('does not depend on the argument order', () => {
    expect(strongestHighlight('wrong', 'played', 'dim')).toBe('wrong');
    expect(strongestHighlight('dim', 'played', 'wrong')).toBe('wrong');
  });

  it('ignores empty and unknown states', () => {
    expect(strongestHighlight(null, undefined)).toBeNull();
    expect(strongestHighlight(null, 'played')).toBe('played');
    expect(strongestHighlight('nope' as KeyHighlight, 'ghost')).toBe('ghost');
  });
});

describe('mergeHighlights', () => {
  it('keeps the strongest state per key', () => {
    const merged = mergeHighlights(
      new Map<number, KeyHighlight>([
        [60, 'target'],
        [64, 'ghost'],
      ]),
      new Map<number, KeyHighlight>([
        [60, 'played'],
        [67, 'played'],
      ]),
    );
    expect(merged.get(60)).toBe('target');
    expect(merged.get(64)).toBe('ghost');
    expect(merged.get(67)).toBe('played');
  });

  it('tolerates missing maps', () => {
    expect(mergeHighlights(null, undefined).size).toBe(0);
  });
});

describe('cues', () => {
  it('gives every graded state a glyph, so colour is never alone', () => {
    for (const state of ['correct', 'wrong', 'target', 'ghost'] as const) {
      expect(HIGHLIGHT_GLYPHS[state]).toBeTruthy();
    }
  });

  it('makes dimmed keys unpressable', () => {
    expect(isPressable('dim')).toBe(false);
    expect(isPressable(null)).toBe(true);
    expect(isPressable('played')).toBe(true);
  });
});

describe('nextFocusableMidi', () => {
  const bounds = { low: 60, high: 72 };
  /** 62-64 dimmed, as an exercise range would dim them. */
  const focusable = (midi: number) => midi < 62 || midi > 64;

  it('returns the key itself when it can take focus', () => {
    expect(nextFocusableMidi(67, 1, bounds, focusable)).toBe(67);
  });

  it('skips dimmed keys in the direction of travel', () => {
    expect(nextFocusableMidi(62, 1, bounds, focusable)).toBe(65);
    expect(nextFocusableMidi(64, -1, bounds, focusable)).toBe(61);
  });

  it('clamps into range, so Home/End land on a pressable key', () => {
    expect(nextFocusableMidi(0, 1, bounds, focusable)).toBe(60);
    expect(nextFocusableMidi(127, -1, bounds, focusable)).toBe(72);
    expect(nextFocusableMidi(1, 1, { low: 62, high: 72 }, focusable)).toBe(65);
  });

  it('stays put when nothing in that direction can take focus', () => {
    expect(nextFocusableMidi(73, 1, bounds, () => false)).toBeNull();
    expect(
      nextFocusableMidi(64, 1, { low: 60, high: 64 }, focusable),
    ).toBeNull();
  });
});
