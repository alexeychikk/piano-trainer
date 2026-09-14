/**
 * The keyboard-range wizard (UX spec §6.3; the old Electron app's
 * `useMidiWizard`): press the lowest key on your piano, then the highest, and
 * the app knows what instrument it is talking to. Exercises generate inside
 * that range and the runner renders it.
 *
 * Pure reducer — no DOM, no storage — so every branch is unit-tested and the
 * component only renders the state it is handed.
 */

import { MIN_RANGE_SEMITONES } from '$lib/storage/settings.svelte';
import { midiToName, type Midi } from '$lib/theory';

export type WizardStep = 'idle' | 'low' | 'high' | 'done';

export interface WizardState {
  step: WizardStep;
  low: Midi | null;
  high: Midi | null;
  /** Why the last press was not accepted; cleared by the next one. */
  problem: string | null;
}

export const IDLE_WIZARD: WizardState = {
  step: 'idle',
  low: null,
  high: null,
  problem: null,
};

export function startWizard(): WizardState {
  return { step: 'low', low: null, high: null, problem: null };
}

/**
 * Feed the wizard a played note. Any source counts (UX §4.6: the app is
 * usable without hardware), so the on-screen keys teach the range too.
 */
export function pressKey(state: WizardState, midi: Midi): WizardState {
  if (state.step === 'low') {
    return { step: 'high', low: midi, high: null, problem: null };
  }
  if (state.step !== 'high' || state.low === null) return state;

  const low = Math.min(state.low, midi);
  const high = Math.max(state.low, midi);
  if (high - low < MIN_RANGE_SEMITONES) {
    return {
      ...state,
      problem: `${midiToName(midi)} is less than an octave from ${midiToName(
        state.low,
      )} — press the other end of your keyboard.`,
    };
  }
  return { step: 'done', low, high, problem: null };
}

/** What the wizard asks for right now (its own copy, like every other state). */
export function wizardPrompt(state: WizardState): string {
  switch (state.step) {
    case 'low':
      return 'Press the lowest key on your piano.';
    case 'high':
      return 'Now press the highest key.';
    case 'done':
      return state.low !== null && state.high !== null
        ? `Range set: ${midiToName(state.low)} to ${midiToName(state.high)}.`
        : '';
    default:
      return '';
  }
}
