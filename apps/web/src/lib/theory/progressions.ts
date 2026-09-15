/**
 * Progression vocabulary (ADR 0001 §4) — from slice 10 the app knows one
 * progression family: the **ii-V-I**, major and minor.
 *
 * It lives here and not in the exercise for the same reason interval, chord
 * and voicing names do (`intervals.ts`, `chords.ts`, `voicings.ts`): it is
 * vocabulary the whole app shares, and an exercise must never spell a chord
 * — let alone a cadence — itself.
 *
 * **A progression is degrees, not chords.** It is stored as semitone offsets
 * from the key's tonic plus a quality per degree, so one table covers all 12
 * keys and transposition is integer arithmetic (ADR §4). The chords only
 * become pitches when a key and a register are supplied
 * (`progressionChords`, `progressionNotes`).
 *
 * The minor cadence's **i is a `min7`**, not a `minMaj7` or a triad: it keeps
 * the whole family inside the seventh-chord vocabulary slices 7 and 8 already
 * drill, and `Cm7` is what a jazz chart most often prints for a minor tonic
 * anyway.
 */

import {
  chordIntervals,
  chordNotes,
  chordSymbolText,
  spellsQualityFromRoot,
} from './chords';
import type {
  ChordQuality,
  ChordSymbol,
  Midi,
  PitchClass,
  Semitones,
} from './types';

export type ProgressionType = 'major-ii-V-I' | 'minor-ii-V-i';

export interface ProgressionStep {
  /** The chord's root, in semitones above the key's tonic. */
  degree: Semitones;
  quality: ChordQuality;
  /** The roman numeral a chart would print: `ii`, `V`, `I`. */
  numeral: string;
}

/**
 * The cadences, in the order they are offered. Both are three chords; both
 * move ii → V → I, and the two differ only in the quality of the ii and of
 * the tonic — which is exactly the pair of colours the drill trains.
 */
const STEPS_BY_TYPE: Record<ProgressionType, readonly ProgressionStep[]> = {
  'major-ii-V-I': [
    { degree: 2, quality: 'min7', numeral: 'ii' },
    { degree: 7, quality: 'dom7', numeral: 'V' },
    { degree: 0, quality: 'maj7', numeral: 'I' },
  ],
  'minor-ii-V-i': [
    { degree: 2, quality: 'min7b5', numeral: 'ii' },
    { degree: 7, quality: 'dom7', numeral: 'V' },
    { degree: 0, quality: 'min7', numeral: 'i' },
  ],
};

/** Spelled out, for feedback and reveals (the `chordQualityName` register). */
const NAME_BY_TYPE: Record<ProgressionType, string> = {
  'major-ii-V-I': 'Major ii-V-I',
  'minor-ii-V-i': 'Minor ii-V-i',
};

/** For dense grids (the `chordQualityShortName` register). */
const SHORT_BY_TYPE: Record<ProgressionType, string> = {
  'major-ii-V-I': 'ii-V-I',
  'minor-ii-V-i': 'ii-V-i',
};

export const PROGRESSION_TYPES: readonly ProgressionType[] = [
  'major-ii-V-I',
  'minor-ii-V-i',
];

/**
 * Where each chord's root is placed relative to the tonic's octave, so the
 * cadence sounds like one: the ii sits a tone above the tonic, the V drops a
 * fifth from it (root motion down a fifth, the sound of a cadence — not up a
 * fourth into the next octave) and the I lands back on the tonic. Every
 * progression the app knows moves this way, so it is one table, not one per
 * type.
 */
const ROOT_OFFSETS: readonly Semitones[] = [2, -5, 0];

/** How many chords a progression has, or `0` for an unknown type. */
export function progressionLength(type: ProgressionType): number {
  return progressionSteps(type)?.length ?? 0;
}

/** The degrees and qualities of this progression, or `null`. */
export function progressionSteps(
  type: ProgressionType,
): readonly ProgressionStep[] | null {
  return isProgressionType(type) ? STEPS_BY_TYPE[type] : null;
}

/**
 * Is this a progression the app can build and grade? **Own keys only**:
 * `value in STEPS_BY_TYPE` is also true of `constructor` and `toString`, and a
 * type comes from a skill id, which the user can hand-edit or import.
 */
export function isProgressionType(value: string): value is ProgressionType {
  return Object.hasOwn(STEPS_BY_TYPE, value);
}

/** The spelled-out name, e.g. `Major ii-V-I` (feedback, reveals). */
export function progressionName(type: ProgressionType): string {
  // A type the tables do not own comes back unchanged rather than as whatever
  // `Object.prototype` holds under that key.
  return isProgressionType(type) ? NAME_BY_TYPE[type] : type;
}

/** The abbreviated name, e.g. `ii-V-i` — dense grids only, never feedback. */
export function progressionShortName(type: ProgressionType): string {
  return isProgressionType(type) ? SHORT_BY_TYPE[type] : type;
}

/**
 * The progression named the way a sentence needs it — `a major ii-V-I` — so
 * no component ever lower-cases a name itself (the `spokenInterval` rule).
 */
export function spokenProgression(type: ProgressionType): string {
  // Only the first word is lower-cased: the roman numerals carry their case
  // (`ii-V-I` is major, `ii-V-i` is minor), so lower-casing the whole name
  // would quietly turn one cadence into the other.
  return `a ${progressionName(type).replace(/^\S+/, (word) => word.toLowerCase())}`;
}

/** The roman numerals, in order: `ii · V · I`. */
export function progressionNumerals(type: ProgressionType): string[] {
  return (progressionSteps(type) ?? []).map((step) => step.numeral);
}

/** The chords of this progression in `tonicPc`, in order, or `null`. */
export function progressionChords(
  tonicPc: PitchClass,
  type: ProgressionType,
): ChordSymbol[] | null {
  const steps = progressionSteps(type);
  return (
    steps?.map((step) => ({
      rootPc: (((tonicPc + step.degree) % 12) + 12) % 12,
      quality: step.quality,
    })) ?? null
  );
}

/**
 * The chord symbols a chart would print, e.g. `Dm7 · G7 · Cmaj7` — the
 * `chordSymbolText` register, one chord at a time, joined by the middot the
 * copy deck uses between parts of a line.
 */
export function progressionText(
  tonicPc: PitchClass,
  type: ProgressionType,
): string {
  const chords = progressionChords(tonicPc, type);
  return chords === null
    ? ''
    : chords
        .map((chord) => chordSymbolText(chord.rootPc, chord.quality))
        .join(' · ');
}

/**
 * The progression voiced from `tonicMidi`: one root-position, close-voiced
 * chord per step, low to high inside each chord. `null` when the type is
 * unknown or a quality has no interval set to build from.
 */
export function progressionNotes(
  tonicMidi: Midi,
  type: ProgressionType,
): Midi[][] | null {
  const steps = progressionSteps(type);
  if (steps === null) return null;
  const chords: Midi[][] = [];
  for (const [index, step] of steps.entries()) {
    const root = Math.round(tonicMidi) + (ROOT_OFFSETS[index] ?? 0);
    const notes = chordNotes(root, step.quality);
    if (notes === null) return null;
    chords.push(notes);
  }
  return chords;
}

/**
 * How far this progression reaches below and above the tonic it is voiced
 * from — what a caller needs to keep the whole cadence inside an instrument.
 */
export function progressionSpan(type: ProgressionType): {
  low: Semitones;
  high: Semitones;
} {
  const steps = progressionSteps(type);
  if (steps === null) return { low: 0, high: 0 };
  let low = 0;
  let high = 0;
  for (const [index, step] of steps.entries()) {
    const root = ROOT_OFFSETS[index] ?? 0;
    const intervals = chordIntervals(step.quality) ?? [0];
    low = Math.min(low, root);
    high = Math.max(high, root + Math.max(...intervals));
  }
  return { low, high };
}

/** How many notes each chord of this progression is played with, in order. */
export function progressionChordSizes(type: ProgressionType): number[] {
  const steps = progressionSteps(type);
  return (
    steps?.map((step) => (chordIntervals(step.quality) ?? [0]).length) ?? []
  );
}

/** How many notes the whole progression is — the length of an answer. */
export function progressionNoteCount(type: ProgressionType): number {
  return progressionChordSizes(type).reduce((total, size) => total + size, 0);
}

/**
 * Cut a played answer into one group per chord, **by count and in played
 * order** — a progression's chords are separated by how many notes each takes
 * (four, here), never by how long the user waited between them.
 *
 * That is the only separation rule available and the right one: an `Answer`
 * carries the notes and their order and no timestamps at all (ADR §5), so
 * nothing downstream *can* see a gap — and making a gap meaningful would grade
 * a beginner on their tempo while they are hunting for the next chord.
 *
 * Trailing notes that do not fill a whole chord are returned as a short last
 * group, so a half-played answer can still be described in feedback.
 */
export function chunkIntoChords(
  notes: readonly Midi[],
  type: ProgressionType,
): Midi[][] {
  const sizes = progressionChordSizes(type);
  const chunks: Midi[][] = [];
  let at = 0;
  for (const size of sizes) {
    if (at >= notes.length) break;
    chunks.push(notes.slice(at, at + size));
    at += size;
  }
  // Anything beyond the last chord belongs to no chord; the caller is grading
  // a wrong-length answer either way.
  if (at < notes.length) chunks.push(notes.slice(at));
  return chunks;
}

/**
 * Does this answer play the progression in `tonicPc`?
 *
 * The rule, stated once (slice 10): the answer is cut into chords by count and
 * in played order, and **every chord must spell its degree's quality over its
 * own root** (`spellsQualityFromRoot`). So register, octave, spacing and the
 * order of the notes *inside* a chord are all free, enharmonics compare equal
 * for free, and what is graded is the cadence in the key: the order of the
 * chords, each chord's quality and each chord's root.
 *
 * A **doubling is a miss**, for slice 8's reason: the answer is exactly twelve
 * notes and a chord is exactly four, so a doubled note always costs a chord
 * tone and leaves its chunk a pitch class short (`intervalsAboveBass` dedupes).
 * The note itself is not rejected — the missing one is.
 */
export function spellsProgression(
  notes: readonly Midi[],
  tonicPc: PitchClass,
  type: ProgressionType,
): boolean {
  const chords = progressionChords(tonicPc, type);
  if (chords === null) return false;
  if (notes.length !== progressionNoteCount(type)) return false;
  const chunks = chunkIntoChords(notes, type);
  if (chunks.length !== chords.length) return false;
  return chords.every((chord, index) =>
    spellsQualityFromRoot(chunks[index], chord.rootPc, chord.quality),
  );
}
