/**
 * Chord detection (ADR 0001 §4): tonal's `Chord.detect`, normalised to our
 * types. Input is always `Midi[]` — never strings — and the result carries a
 * display name plus, when we recognise the quality, a `ChordSymbol`.
 *
 * Qualities outside the v1 vocabulary (ADR §4) keep their display name with
 * `symbol: null`, so Free Play can show `Em#5/C` without us pretending it maps
 * onto an exercise-grade chord.
 *
 * From slice 7 this module also owns the **chord-quality vocabulary** — the
 * intervals a quality is built from and the three ways the app names one — for
 * the same reason `intervals.ts` owns interval names: it is vocabulary the
 * whole app shares, so an exercise never spells a chord itself.
 */

import { Chord } from 'tonal';
import { midiToName, nameToMidi, pcOf, pitchClassName } from './notes';
import type {
  ChordQuality,
  ChordSymbol,
  Midi,
  PitchClass,
  Semitones,
} from './types';

export interface DetectedChord {
  /** Tonal's symbol, e.g. `Cmaj7` or `Em#5/C`. Display only. */
  name: string;
  /** Present when the quality is part of the v1 vocabulary. */
  symbol: ChordSymbol | null;
}

/** tonal chord `type` → our `ChordQuality`. */
const QUALITY_BY_TYPE: Record<string, ChordQuality> = {
  major: 'maj',
  minor: 'min',
  diminished: 'dim',
  augmented: 'aug',
  'suspended fourth': 'sus4',
  'major seventh': 'maj7',
  'dominant seventh': 'dom7',
  'minor seventh': 'min7',
  'half-diminished': 'min7b5',
  'diminished seventh': 'dim7',
  'minor/major seventh': 'minMaj7',
  sixth: 'maj6',
  'sixth added ninth': 'maj6',
  'minor sixth': 'min6',
  'dominant ninth': 'dom9',
  'major ninth': 'maj9',
  'minor ninth': 'min9',
  'dominant flat ninth': 'dom7b9',
  'dominant sharp ninth': 'dom7sharp9',
  'altered dominant': 'dom7alt',
};

/**
 * Chords that the held notes could spell, best match first. Notes are deduped
 * but their octaves matter: the lowest note is taken as the bass, so
 * inversions are reported as slash chords.
 */
export function detectChords(notes: Midi[]): DetectedChord[] {
  if (notes.length < 2) return [];
  const sorted = [...new Set(notes)].sort((a, b) => a - b);
  const names = Chord.detect(sorted.map((midi) => midiToName(midi, 'sharp')));
  return names.map((name) => ({ name, symbol: toChordSymbol(name) }));
}

/** Parse a chord symbol string into our vocabulary, or `null`. */
export function toChordSymbol(name: string): ChordSymbol | null {
  const chord = Chord.get(name);
  if (chord.empty || !chord.tonic) return null;
  const quality = QUALITY_BY_TYPE[chord.type];
  if (!quality) return null;
  const rootPc = pitchClassOf(chord.tonic);
  if (rootPc === null) return null;
  const bassPc = chord.bass ? pitchClassOf(chord.bass) : null;
  const symbol: ChordSymbol = { rootPc, quality };
  if (bassPc !== null && bassPc !== rootPc) symbol.bassPc = bassPc;
  return symbol;
}

/** Pitch class of a bare note name (`Eb`, `F#`), or `null`. */
function pitchClassOf(name: string): PitchClass | null {
  // A bare pitch class has no octave; spell it into octave 4 and take the pc.
  const midi = nameToMidi(`${name}4`);
  return midi === null ? null : pcOf(midi);
}

// ---- chord-quality vocabulary (slice 7) ---------------------------------

/**
 * The semitones above the root each quality is built from — the structure that
 * makes a chord that quality, in any key. `dom7alt` is deliberately absent: an
 * altered dominant is a family of voicings, not one interval set, so it has no
 * honest entry and `chordIntervals()` says `null` rather than inventing one.
 */
const INTERVALS_BY_QUALITY: Partial<
  Record<ChordQuality, readonly Semitones[]>
> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus4: [0, 5, 7],
  maj6: [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
  maj7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  min7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  minMaj7: [0, 3, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  dom9: [0, 4, 7, 10, 14],
  min9: [0, 3, 7, 10, 14],
  dom7b9: [0, 4, 7, 10, 13],
  dom7sharp9: [0, 4, 7, 10, 15],
};

/** Spelled out, for feedback (copy deck §9). The noun is part of the name:
 * `Major 7th` alone is an interval, `Major 7th chord` can only be a chord. */
const NAME_BY_QUALITY: Record<ChordQuality, string> = {
  maj: 'Major triad',
  min: 'Minor triad',
  dim: 'Diminished triad',
  aug: 'Augmented triad',
  sus4: 'Suspended 4th chord',
  maj6: 'Major 6th chord',
  min6: 'Minor 6th chord',
  maj7: 'Major 7th chord',
  dom7: 'Dominant 7th chord',
  min7: 'Minor 7th chord',
  min7b5: 'Half-diminished 7th chord',
  dim7: 'Diminished 7th chord',
  minMaj7: 'Minor/major 7th chord',
  maj9: 'Major 9th chord',
  dom9: 'Dominant 9th chord',
  min9: 'Minor 9th chord',
  dom7b9: 'Dominant 7th b9 chord',
  dom7sharp9: 'Dominant 7th #9 chord',
  dom7alt: 'Altered dominant chord',
};

/** The jazz chord-symbol suffix, for dense grids (copy deck §9): the symbol a
 * chart would print after the root, which for a major triad is nothing. */
const SHORT_BY_QUALITY: Record<ChordQuality, string> = {
  maj: 'maj',
  min: 'm',
  dim: 'dim',
  aug: 'aug',
  sus4: 'sus4',
  maj6: '6',
  min6: 'm6',
  maj7: 'maj7',
  dom7: '7',
  min7: 'm7',
  min7b5: 'm7b5',
  dim7: 'dim7',
  minMaj7: 'mMaj7',
  maj9: 'maj9',
  dom9: '9',
  min9: 'm9',
  dom7b9: '7b9',
  dom7sharp9: '7#9',
  dom7alt: '7alt',
};

/**
 * Is this a quality the app has a name for — the own-key check that `value in
 * NAME_BY_QUALITY` is not. `NAME_BY_QUALITY` is exhaustive, so its own keys
 * *are* the union; `'constructor'`, `'toString'` and friends are not in it,
 * which is the whole point (a skill id is user-editable input, and casting one
 * of those to `ChordQuality` used to walk into the tables below).
 */
export function isChordQuality(value: string): value is ChordQuality {
  return Object.hasOwn(NAME_BY_QUALITY, value);
}

/** Semitones above the root, or `null` for a quality with no fixed structure. */
export function chordIntervals(
  quality: ChordQuality,
): readonly Semitones[] | null {
  // Own keys only: an inherited one answers with a function, which every
  // caller here would then treat as an interval array.
  return Object.hasOwn(INTERVALS_BY_QUALITY, quality)
    ? (INTERVALS_BY_QUALITY[quality] ?? null)
    : null;
}

/** Is this a quality the app can build and grade — i.e. has it intervals? */
export function isBuildableQuality(quality: ChordQuality): boolean {
  return chordIntervals(quality) !== null;
}

/** The chord in root position, close voicing, from `root`. */
export function chordNotes(root: Midi, quality: ChordQuality): Midi[] | null {
  const intervals = chordIntervals(quality);
  return intervals === null
    ? null
    : intervals.map((semitones) => Math.round(root) + semitones);
}

/** The spelled-out name, e.g. `Dominant 7th chord` (feedback, reveals). */
export function chordQualityName(quality: ChordQuality): string {
  // A quality the tables do not own comes back unchanged rather than as
  // whatever `Object.prototype` holds under that key (`isChordQuality`).
  return isChordQuality(quality) ? NAME_BY_QUALITY[quality] : quality;
}

/** The abbreviated name, e.g. `m7b5` — dense grids only, never feedback. */
export function chordQualityShortName(quality: ChordQuality): string {
  return isChordQuality(quality) ? SHORT_BY_QUALITY[quality] : quality;
}

/**
 * The chart's suffix, where it is not the grid's short name. A major triad is
 * written `C`: the grid needs the word `maj` to tell that column from `m`, a
 * chord symbol never prints it. Every other quality's short name *is* its
 * suffix, so this table stays a list of exceptions.
 */
const SYMBOL_SUFFIX_BY_QUALITY: Partial<Record<ChordQuality, string>> = {
  maj: '',
};

/**
 * The chord symbol a chart would print — `Cmaj7`, `Db7`, `Bbm7`, `C`: the
 * root's spelling plus the quality's suffix. Flats by default, like every other
 * spelling in the app. Display only; a chord is never *graded* on its name.
 */
export function chordSymbolText(
  rootPc: PitchClass,
  quality: ChordQuality,
  style: 'sharp' | 'flat' = 'flat',
): string {
  const suffix = Object.hasOwn(SYMBOL_SUFFIX_BY_QUALITY, quality)
    ? (SYMBOL_SUFFIX_BY_QUALITY[quality] ?? '')
    : chordQualityShortName(quality);
  return `${pitchClassName(rootPc, style)}${suffix}`;
}

/**
 * The quality named the way the copy deck's feedback line says it — `a
 * dominant 7th chord` — so a sentence can be built without a component
 * lower-casing a name itself (the interval module's `spokenInterval` rule).
 */
export function spokenChordQuality(quality: ChordQuality): string {
  const name = chordQualityName(quality).toLowerCase();
  const article = /^[aeio]/.test(name) ? 'an' : 'a';
  return `${article} ${name}`;
}

/** Unique semitone offsets, folded into one octave and sorted. */
function normaliseIntervals(intervals: readonly Semitones[]): Semitones[] {
  const folded = intervals.map(
    (semitones) => (((Math.round(semitones) % 12) + 12) % 12) as Semitones,
  );
  return [...new Set(folded)].sort((a, b) => a - b);
}

/**
 * What each note is above the lowest note played, folded into one octave and
 * deduped: the structure of a voicing with its register and its doublings
 * thrown away, which is what identifies a quality (in root position, the
 * lowest note is the root).
 */
export function intervalsAboveBass(notes: readonly Midi[]): Semitones[] {
  if (notes.length === 0) return [];
  const bass = Math.min(...notes.map((midi) => Math.round(midi)));
  return normaliseIntervals(notes.map((midi) => Math.round(midi) - bass));
}

const QUALITY_BY_INTERVALS = new Map<string, ChordQuality>(
  Object.entries(INTERVALS_BY_QUALITY).map(([quality, intervals]) => [
    normaliseIntervals(intervals).join(','),
    quality as ChordQuality,
  ]),
);

/**
 * The quality built from these semitones above a root, or `null` when nothing
 * in the vocabulary is spelled that way. Octave displacement and doubling do
 * not change the answer; a missing or an extra note does.
 */
export function qualityOfIntervals(
  intervals: readonly Semitones[],
): ChordQuality | null {
  return (
    QUALITY_BY_INTERVALS.get(normaliseIntervals(intervals).join(',')) ?? null
  );
}

/**
 * Do these notes spell `quality` with the **lowest note as the root** — any
 * key, any octave, any spacing, any doubling, but root position?
 */
export function spellsQuality(
  notes: readonly Midi[],
  quality: ChordQuality,
): boolean {
  const intervals = chordIntervals(quality);
  if (intervals === null || notes.length === 0) return false;
  return (
    intervalsAboveBass(notes).join(',') ===
    normaliseIntervals(intervals).join(',')
  );
}

/**
 * Do these notes spell `quality` **rooted on `rootPc`** — root position, and
 * in the asked key? `spellsQuality` grades a colour from any root (slice 7,
 * where the key was deliberately free); this is the same rule with the key
 * pinned, which is what a drill needs the moment the key is half of the answer
 * (`spellsShell`'s rule, one voicing up: slices 8 and 10).
 */
export function spellsQualityFromRoot(
  notes: readonly Midi[],
  rootPc: PitchClass,
  quality: ChordQuality,
): boolean {
  if (notes.length === 0) return false;
  const bass = Math.min(...notes.map((midi) => Math.round(midi)));
  if (pcOf(bass) !== ((Math.round(rootPc) % 12) + 12) % 12) return false;
  return spellsQuality(notes, quality);
}

/**
 * Do these notes spell `quality` from *some* root — i.e. is this the chord,
 * possibly inverted? Used to tell "wrong chord" from "right chord, wrong note
 * at the bottom", which are different mistakes and deserve different words.
 */
export function spellsQualityInAnyInversion(
  notes: readonly Midi[],
  quality: ChordQuality,
): boolean {
  const intervals = chordIntervals(quality);
  if (intervals === null || notes.length === 0) return false;
  const wanted = normaliseIntervals(intervals);
  const played = normaliseIntervals(notes.map((midi) => pcOf(midi)));
  if (played.length !== wanted.length) return false;
  // Rotate the played set so each of its notes takes a turn as the root.
  return played.some((root) =>
    normaliseIntervals(played.map((pc) => pc - root)).every(
      (semitones, index) => semitones === wanted[index],
    ),
  );
}
