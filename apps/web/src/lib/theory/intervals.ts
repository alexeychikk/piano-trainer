/**
 * Intervals (ADR 0001 §4). Pure TypeScript, MIDI integers in, display strings
 * out — the same rule as the rest of `$lib/theory`: an interval is a **signed
 * number of semitones**, never a spelling, so enharmonics compare equal for
 * free (`Eb−C` and `D#−C` are both 3).
 *
 * Naming is display-only and lives here rather than in the exercise, because
 * it is vocabulary the whole app shares (the copy deck spells musical terms
 * out in feedback, `minor 6th`, and abbreviates them in dense grids, `m6`).
 */

import type { Midi, Semitones } from './types';

/** Signed distance from `from` to `to`, in semitones (up is positive). */
export function intervalBetween(from: Midi, to: Midi): Semitones {
  return Math.round(to) - Math.round(from);
}

/** Semitones in an octave; the unit every compound interval folds by. */
export const OCTAVE: Semitones = 12;

/** The simple intervals, 0–12 semitones, spelled out (copy deck §9). */
const SIMPLE_NAMES: readonly string[] = [
  'Unison',
  'Minor 2nd',
  'Major 2nd',
  'Minor 3rd',
  'Major 3rd',
  'Perfect 4th',
  'Tritone',
  'Perfect 5th',
  'Minor 6th',
  'Major 6th',
  'Minor 7th',
  'Major 7th',
  'Octave',
];

/** The same intervals abbreviated, for dense grids (copy deck §9). */
const SIMPLE_SHORT: readonly string[] = [
  'U',
  'm2',
  'M2',
  'm3',
  'M3',
  'P4',
  'TT',
  'P5',
  'm6',
  'M6',
  'm7',
  'M7',
  'P8',
];

/** Is this a simple interval — an octave or less? */
export function isSimpleInterval(semitones: Semitones): boolean {
  return Math.abs(Math.round(semitones)) <= OCTAVE;
}

/**
 * The spelled-out name of an interval, e.g. `Perfect 5th`. Direction is not
 * part of the name (a descending fifth is still a fifth); a caller that cares
 * says so in its own copy.
 *
 * Compound intervals are named by their simple part plus the octaves — `Major
 * 3rd + 1 octave` rather than `Major 10th`. A beginner hears "a third, an
 * octave up"; the arithmetic spelling (a 10th) is a notation concept this app
 * has no use for yet.
 */
export function intervalName(semitones: Semitones): string {
  const size = Math.abs(Math.round(semitones));
  if (size <= OCTAVE) return SIMPLE_NAMES[size];
  const octaves = Math.floor(size / OCTAVE);
  const rest = size % OCTAVE;
  const plural = octaves === 1 ? 'octave' : 'octaves';
  if (rest === 0) return `${octaves} ${plural}`;
  return `${SIMPLE_NAMES[rest]} + ${octaves} ${plural}`;
}

/** The abbreviated name, e.g. `P5` — dense grids only, never feedback. */
export function intervalShortName(semitones: Semitones): string {
  const size = Math.abs(Math.round(semitones));
  if (size <= OCTAVE) return SIMPLE_SHORT[size];
  const octaves = Math.floor(size / OCTAVE);
  const rest = size % OCTAVE;
  return rest === 0
    ? `${octaves}×P8`
    : `${SIMPLE_SHORT[rest]}+${octaves === 1 ? 'P8' : `${octaves}×P8`}`;
}

/**
 * The interval named the way the copy deck's feedback line says it — `a
 * perfect 5th`, `an octave` — so a sentence can be built without a component
 * lower-casing a name itself.
 */
export function spokenInterval(semitones: Semitones): string {
  const name = intervalName(semitones).toLowerCase();
  // `2 octaves` is already plural: an article in front of it is not English.
  if (/^\d/.test(name)) return name;
  const article = /^[aeio]/.test(name) ? 'an' : 'a';
  return `${article} ${name}`;
}
