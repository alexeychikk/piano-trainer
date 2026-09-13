/**
 * Key highlight states and their precedence (UX spec §5.1/§5.3). Pure, so the
 * precedence rule is tested once and the component only renders a class.
 *
 * Every graded state carries a glyph — colour is never the only signal (§8).
 */

import type { Midi } from '$lib/theory';

export type KeyHighlight =
  /** The user is pressing it now. */
  | 'played'
  /** Graded right. */
  | 'correct'
  /** Graded wrong. */
  | 'wrong'
  /** The expected answer, revealed. */
  | 'target'
  /** A hint / given root / reference note. */
  | 'ghost'
  /** Outside the exercise's range; not pressable. */
  | 'dim';

/** Strongest first (UX spec §5.1). */
export const HIGHLIGHT_PRECEDENCE: readonly KeyHighlight[] = [
  'wrong',
  'correct',
  'target',
  'played',
  'ghost',
  'dim',
];

/** The non-colour cue drawn on the key. */
export const HIGHLIGHT_GLYPHS: Readonly<Partial<Record<KeyHighlight, string>>> =
  {
    correct: '✓',
    wrong: '✗',
    target: '◆',
    ghost: '◇',
  };

/** The state that wins when several apply. */
export function strongestHighlight(
  ...states: (KeyHighlight | null | undefined)[]
): KeyHighlight | null {
  let best: KeyHighlight | null = null;
  let bestRank = HIGHLIGHT_PRECEDENCE.length;
  for (const state of states) {
    if (!state) continue;
    const rank = HIGHLIGHT_PRECEDENCE.indexOf(state);
    if (rank === -1) continue;
    if (rank < bestRank) {
      bestRank = rank;
      best = state;
    }
  }
  return best;
}

/** Merge highlight maps, strongest state per key. */
export function mergeHighlights(
  ...maps: (ReadonlyMap<Midi, KeyHighlight> | null | undefined)[]
): Map<Midi, KeyHighlight> {
  const merged = new Map<Midi, KeyHighlight>();
  for (const map of maps) {
    if (!map) continue;
    for (const [midi, state] of map) {
      const winner = strongestHighlight(merged.get(midi), state);
      if (winner) merged.set(midi, winner);
    }
  }
  return merged;
}

/** `dim` keys are display only and must not take pointer or keyboard input. */
export function isPressable(state: KeyHighlight | null): boolean {
  return state !== 'dim';
}

/**
 * The next key roving focus may land on, searching from `from` towards `step`
 * (+1 up, -1 down) and skipping keys that cannot take focus — `dim` keys are
 * rendered `disabled`, so focusing one is a no-op and arrow navigation would
 * dead-end on it (UX §5.5: the group is one tab stop, arrows walk the keys).
 *
 * `from` is clamped into `bounds` first. Returns `null` when there is nothing
 * focusable in that direction, which means "stay where you are".
 */
export function nextFocusableMidi(
  from: Midi,
  step: 1 | -1,
  bounds: { low: Midi; high: Midi },
  focusable: (midi: Midi) => boolean,
): Midi | null {
  let midi = Math.min(Math.max(from, bounds.low), bounds.high);
  while (midi >= bounds.low && midi <= bounds.high) {
    if (focusable(midi)) return midi;
    midi += step;
  }
  return null;
}
