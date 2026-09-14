/**
 * Voicing vocabulary (ADR 0001 §4) — from slice 8 the app knows one voicing
 * family: the **shell**.
 *
 * A shell is the smallest voicing that still names a seventh chord: the
 * **root, the 3rd and the 7th**, with the 5th thrown away. The 5th is the one
 * chord tone that carries no colour, so dropping it costs nothing and leaves a
 * shape one hand can play in every key — which is why it is the first voicing
 * a jazz pianist learns.
 *
 * It lives here and not in the exercise for the same reason interval and chord
 * names do (`intervals.ts`, `chords.ts`): it is vocabulary the whole app
 * shares, and an exercise must never spell a chord itself.
 *
 * **A shell is a pitch-class set with the root at the bottom, not a fixed
 * shape.** The two shells every method teaches — the A form `1-7-3` (the 3rd
 * an octave up) and the B form `1-3-7` — are the same three pitch classes over
 * the same root, so `spellsShell()` accepts both by construction, along with
 * every other register and spacing.
 */

import { chordIntervals } from './chords';
import { pcOf } from './notes';
import type { ChordQuality, Midi, PitchClass, Semitones } from './types';

/** A 3rd is major or minor; nothing else is a 3rd. */
const THIRDS: readonly Semitones[] = [3, 4];
/** A 7th is minor or major. A *diminished* 7th (9) is not one — see below. */
const SEVENTHS: readonly Semitones[] = [10, 11];

/**
 * The semitones above the root of this quality's shell — `[0, 3rd, 7th]` — or
 * `null` when the quality has no shell at all.
 *
 * `null` is the honest answer for three groups: triads and sus chords (no 7th
 * to keep), 6th chords (a 6th is not a 7th), and **`dim7`** — its "7th" is a
 * diminished 7th, nine semitones up, so `[0, 3, 9]` is not a 3rd-and-7th pair
 * at all but a fragment that spells a minor 6th chord just as well. A
 * diminished 7th chord is voiced whole, never shelled. `dom7alt` has no
 * interval set to start from, so it has no shell either.
 */
export function shellIntervals(
  quality: ChordQuality,
): readonly Semitones[] | null {
  const intervals = chordIntervals(quality);
  if (intervals === null) return null;
  const third = intervals.find((semitones) => THIRDS.includes(semitones));
  const seventh = intervals.find((semitones) => SEVENTHS.includes(semitones));
  if (third === undefined || seventh === undefined) return null;
  return [0, third, seventh];
}

/** Has this quality a shell voicing at all? */
export function hasShell(quality: ChordQuality): boolean {
  return shellIntervals(quality) !== null;
}

/**
 * The qualities whose shell is **theirs alone**, plainest first. A shell drops
 * the 5th and every extension, so several qualities collapse onto one shape
 * and only the first of each group is listed:
 *
 * - `min7b5` shells to `[0, 3, 10]` — the same as `min7`, because the flat 5th
 *   is exactly the note a shell leaves out. A half-diminished chord cannot be
 *   drilled as a shell; it needs its 5th.
 * - the 9ths and altered 9ths (`maj9`, `dom9`, `min9`, `dom7b9`, `dom7sharp9`)
 *   shell onto their plain seventh chord.
 *
 * Order is what `qualityOfShellIntervals()` resolves a collision to, so the
 * plain seventh chord always wins over its extended relatives.
 */
export const SHELL_QUALITIES: readonly ChordQuality[] = [
  'maj7',
  'dom7',
  'min7',
  'minMaj7',
];

/** Unique semitones, folded into one octave and sorted — a shell's identity. */
function normalise(values: readonly number[]): Semitones[] {
  const folded = values.map((value) => ((Math.round(value) % 12) + 12) % 12);
  return [...new Set(folded)].sort((a, b) => a - b);
}

function key(values: readonly number[]): string {
  return normalise(values).join(',');
}

const QUALITY_BY_SHELL = new Map<string, ChordQuality>();
for (const quality of SHELL_QUALITIES) {
  const intervals = shellIntervals(quality);
  if (intervals === null) continue;
  const shape = key(intervals);
  // First one wins: the list is ordered so the plain quality owns the shape.
  if (!QUALITY_BY_SHELL.has(shape)) QUALITY_BY_SHELL.set(shape, quality);
}

/**
 * Which quality these semitones above a root shell, or `null`. Octave
 * displacement and doubling do not change the answer; a missing or an extra
 * note does — a shell is exactly three notes.
 */
export function qualityOfShellIntervals(
  intervals: readonly Semitones[],
): ChordQuality | null {
  return QUALITY_BY_SHELL.get(key(intervals)) ?? null;
}

/** The shell in close position from `root`, low to high, or `null`. */
export function shellNotes(root: Midi, quality: ChordQuality): Midi[] | null {
  const intervals = shellIntervals(quality);
  return intervals === null
    ? null
    : intervals.map((semitones) => Math.round(root) + semitones);
}

/** How far the top of a close-position shell sits above its root. */
export function shellSpan(quality: ChordQuality): Semitones {
  const intervals = shellIntervals(quality);
  return intervals === null ? 0 : Math.max(...intervals);
}

/** The three pitch classes of this shell, sorted, or `null`. */
export function shellPitchClasses(
  rootPc: PitchClass,
  quality: ChordQuality,
): PitchClass[] | null {
  const intervals = shellIntervals(quality);
  return intervals === null
    ? null
    : normalise(intervals.map((semitones) => rootPc + semitones));
}

/**
 * Do these notes play the shell of `quality` rooted on `rootPc`?
 *
 * The rule, stated once (slice 8): the **pitch classes played must be exactly
 * the shell's three**, and the **lowest note played must be the root**.
 * Register, octave, spacing and order are free — so the A form (`1-7-3`) and
 * the B form (`1-3-7`) both pass, and so does the same shape two octaves down.
 * Enharmonics compare equal for free: this is integer arithmetic on MIDI
 * numbers, never on spellings (ADR §4). A doubled note is not an extra pitch
 * class, but it costs one of the three notes the answer has, so a doubling
 * always leaves a pitch class missing and fails.
 */
export function spellsShell(
  notes: readonly Midi[],
  rootPc: PitchClass,
  quality: ChordQuality,
): boolean {
  const wanted = shellPitchClasses(rootPc, quality);
  if (wanted === null || notes.length === 0) return false;
  const bass = Math.min(...notes.map((midi) => Math.round(midi)));
  if (pcOf(bass) !== normalise([rootPc])[0]) return false;
  return key(notes.map((midi) => pcOf(midi))) === wanted.join(',');
}

/**
 * Are these the shell's notes over the wrong one — i.e. the right three pitch
 * classes, inverted? "Right notes, wrong bass" is a different mistake from
 * "wrong notes" and deserves different words (the `spellsQualityInAnyInversion`
 * rule, one voicing down).
 */
export function spellsShellInAnyInversion(
  notes: readonly Midi[],
  rootPc: PitchClass,
  quality: ChordQuality,
): boolean {
  const wanted = shellPitchClasses(rootPc, quality);
  if (wanted === null || notes.length === 0) return false;
  return key(notes.map((midi) => pcOf(midi))) === wanted.join(',');
}
