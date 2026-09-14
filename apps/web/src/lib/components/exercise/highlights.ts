/**
 * Runner state → keyboard highlights (UX spec §5.1 precedence, §5.3 states).
 * Pure and tested here, in the component layer: `KeyHighlight` is a display
 * concept, and `$lib/exercises` must not reach into components (ADR §9).
 */

import type { Outcome } from '$lib/exercises/feedback';
import type { KeyRange } from '$lib/exercises/types';
import type { Midi } from '$lib/theory';
import { mergeHighlights, type KeyHighlight } from '../piano/highlights';

export interface RunnerHighlightInput {
  /** The rendered keyboard. */
  keyboard: KeyRange;
  /** The keys this question is answered on; the rest dim (§5.2). */
  questionRange?: KeyRange;
  /** Notes held right now, from any source. */
  held: readonly Midi[];
  /** What the user answered with, once graded. */
  answered: readonly Midi[];
  outcome: Outcome | null;
  /** The expected notes, revealed after a miss or a skip. */
  revealed: readonly Midi[];
}

export function runnerHighlights({
  keyboard,
  questionRange,
  held,
  answered,
  outcome,
  revealed,
}: RunnerHighlightInput): Map<Midi, KeyHighlight> {
  const dim = new Map<Midi, KeyHighlight>();
  if (questionRange) {
    for (let midi = keyboard.low; midi <= keyboard.high; midi += 1) {
      if (midi < questionRange.low || midi > questionRange.high) {
        dim.set(midi, 'dim');
      }
    }
  }

  const playedMap = new Map<Midi, KeyHighlight>(
    held.map((midi) => [midi, 'played' as KeyHighlight]),
  );
  const targetMap = new Map<Midi, KeyHighlight>(
    revealed.map((midi) => [midi, 'target' as KeyHighlight]),
  );
  const gradedState: KeyHighlight | null =
    outcome === 'correct' ? 'correct' : outcome === 'wrong' ? 'wrong' : null;
  const gradedMap = gradedState
    ? new Map<Midi, KeyHighlight>(
        answered.map((midi) => [midi, gradedState] as const),
      )
    : null;

  // `mergeHighlights` applies the precedence rule, so the order here is only
  // about which maps take part, never about which state wins.
  return mergeHighlights(dim, playedMap, targetMap, gradedMap);
}
