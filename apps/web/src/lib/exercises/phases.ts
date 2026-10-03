/**
 * The prompt well's phase micro-label (sci-fi-screens.md §5.3, §10.1). Pure
 * and tested, because it is *wording*: the runner's component renders what
 * this returns and never invents a label of its own — the same rule that keeps
 * the copy deck in `feedback.ts` and the MIDI copy in `$lib/midi/status.ts`.
 *
 * These are labels, not copy-deck sentences: they are set with
 * `text-transform: uppercase`, so the DOM text (and the accessible name) keeps
 * the casing below (part 1 §9.3).
 */

import type { RunnerPhase } from './runner.svelte';

export interface PhaseLabel {
  label: string;
  /** Hot = cyan + glow: something is live right now (part 1 §4.3). */
  hot: boolean;
}

const PHASE_LABELS: Readonly<Record<RunnerPhase, PhaseLabel>> = {
  idle: { label: 'Ready', hot: false },
  // The question is sounding: the user is listening to it.
  presenting: { label: 'Listen', hot: true },
  // The drill is waiting for an answer — the only other live moment.
  awaiting: { label: 'Answer', hot: true },
  feedback: { label: 'Result', hot: false },
  paused: { label: 'Paused', hot: false },
  // The run is over (slice 9b). The summary replaces the frame, so this label
  // is only ever seen for the frame the state machine leaves behind.
  summary: { label: 'Complete', hot: false },
};

export function phaseLabel(phase: RunnerPhase): PhaseLabel {
  return PHASE_LABELS[phase];
}

/**
 * Not a phase of the machine: the frame of a drill that has nothing it can
 * ask on this keyboard (`NOTHING_TO_ASK` in `feedback.ts`). It replaces
 * `Ready` / `Complete`, either of which would promise a drill that will not
 * come. A word, never only a colour (part 1 §4.3) — and not hot.
 */
export const UNAVAILABLE_PHASE: PhaseLabel = {
  label: 'Unavailable',
  hot: false,
};
