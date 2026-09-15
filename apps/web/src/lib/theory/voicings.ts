/**
 * Voicing vocabulary (ADR 0001 §4) — three families, smallest last: the
 * **shell** (slice 8), the **rootless A/B pair** (slice 11) and the **guide
 * tones** (slice 12).
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

// ---- rootless A/B voicings (slice 11) ------------------------------------

/**
 * The two left-hand rootless voicings every method teaches, named after the
 * chord tone at the **bottom**:
 *
 * - **A** — `3-5-7-9`, the 3rd in the bass.
 * - **B** — `7-9-3-5`, the 7th in the bass.
 *
 * They are the same four chord tones; the form is *which one is underneath*.
 * That is the whole point of the pair: one voicing lies low under a melody and
 * the other high, and a ii-V-I moves between them with the smallest possible
 * motion.
 */
export type RootlessForm = 'A' | 'B';

/** The forms, in the order they are taught and drilled. */
export const ROOTLESS_FORMS: readonly RootlessForm[] = ['A', 'B'];

/** What the chord tone at the bottom of each form is called (feedback copy). */
const BASS_DEGREE_BY_FORM: Record<RootlessForm, string> = {
  A: '3rd',
  B: '7th',
};

/** The tones of each form, bottom to top, spelled out for the prompt. */
const DEGREES_BY_FORM: Record<RootlessForm, string> = {
  A: '3rd, 5th, 7th, 9th',
  B: '7th, 9th, 3rd, 5th',
};

/**
 * Is this one of the two forms — the own-key check that `value in TABLE` is
 * not (`skill-id.ts`: a skill id read back is untrusted input).
 */
export function isRootlessForm(value: string): value is RootlessForm {
  return Object.hasOwn(BASS_DEGREE_BY_FORM, value);
}

/** The chord tone this form puts in the bass, e.g. `3rd`. */
export function rootlessBassDegree(form: RootlessForm): string {
  return isRootlessForm(form) ? BASS_DEGREE_BY_FORM[form] : form;
}

/** This form's tones bottom to top, e.g. `7th, 9th, 3rd, 5th`. */
export function rootlessDegrees(form: RootlessForm): string {
  return isRootlessForm(form) ? DEGREES_BY_FORM[form] : form;
}

/** A 9th is a major 9th: the one extension both A and B forms are built on. */
const NINTH: Semitones = 14;
/** A rootless voicing needs a *perfect* 5th — see `ROOTLESS_QUALITIES`. */
const PERFECT_FIFTH: Semitones = 7;

/**
 * The semitones above the **root** of this quality's rootless voicing, bottom
 * to top in close position — or `null` when the quality has no rootless
 * voicing of this kind.
 *
 * The root is the note the voicing is *named* from and the one note it never
 * plays; measuring from it is what makes every key one piece of arithmetic
 * (the `progressions.ts` rule: degrees, not chords). So the A form of a `maj7`
 * is `[4, 7, 11, 14]` and its B form is `[11, 14, 16, 19]` — the same four
 * pitch classes, the 3rd and the 5th moved an octave up.
 *
 * `null` is the honest answer for everything that is not a plain seventh chord
 * with a perfect 5th: a triad or a 6th chord has no 7th to voice, `min7b5`'s
 * flat 5th and `dim7`'s diminished 7th make a different shape with a different
 * 9th (the half-diminished's is usually flat), and `dom7alt` is a family of
 * voicings rather than one interval set. Those are their own drill, not a
 * quality this one can transpose.
 */
export function rootlessIntervals(
  quality: ChordQuality,
  form: RootlessForm,
): readonly Semitones[] | null {
  if (!isRootlessForm(form)) return null;
  const intervals = chordIntervals(quality);
  if (intervals === null) return null;
  const third = intervals.find((semitones) => THIRDS.includes(semitones));
  const seventh = intervals.find((semitones) => SEVENTHS.includes(semitones));
  if (third === undefined || seventh === undefined) return null;
  if (!intervals.includes(PERFECT_FIFTH)) return null;
  return form === 'A'
    ? [third, PERFECT_FIFTH, seventh, NINTH]
    : [seventh, NINTH, third + 12, PERFECT_FIFTH + 12];
}

/** Has this quality a rootless A/B voicing at all? */
export function hasRootless(quality: ChordQuality): boolean {
  return rootlessIntervals(quality, 'A') !== null;
}

/**
 * The qualities whose rootless voicing is **theirs alone**, plainest first —
 * the `SHELL_QUALITIES` rule. Unlike a shell, a rootless voicing keeps the 5th
 * *and* adds the 9th, so it separates far more than the shell does: all four
 * of these have a different pitch-class set over the same root, and all eight
 * (quality × form) have a different shape above their own bass, which is what
 * `rootlessOfIntervalsAboveBass()` resolves a played answer with.
 */
export const ROOTLESS_QUALITIES: readonly ChordQuality[] = [
  'maj7',
  'dom7',
  'min7',
  'minMaj7',
];

/** Where each (quality, form) sits above its own **bass** note. */
const ROOTLESS_BY_SHAPE = new Map<
  string,
  { quality: ChordQuality; form: RootlessForm }
>();
for (const quality of ROOTLESS_QUALITIES) {
  for (const form of ROOTLESS_FORMS) {
    const intervals = rootlessIntervals(quality, form);
    if (intervals === null) continue;
    const shape = key(intervals.map((semitones) => semitones - intervals[0]));
    // First one wins: the list is ordered so the plainest quality owns a shape.
    if (!ROOTLESS_BY_SHAPE.has(shape))
      ROOTLESS_BY_SHAPE.set(shape, { quality, form });
  }
}

/**
 * Which rootless voicing these semitones **above the bass** are, or `null`.
 * The eight shapes are all distinct, so the bass note plus the shape name the
 * quality, the form *and* — by subtracting the form's bass degree — the key,
 * which is how a wrong answer gets named instead of being called noise.
 *
 * An **A form is also a seventh chord**, and that ambiguity is the music's,
 * not a defect here: `Cm7`'s A form is `Eb-G-Bb-D`, spelled exactly like
 * `Ebmaj7` (and `Cmaj7`'s A form is `Em7`, `C7`'s is `Em7b5`). No B form is
 * anything else. A caller that wants the other reading has
 * `qualityOfIntervals()`; a drill about voicings asks this one first.
 */
export function rootlessOfIntervalsAboveBass(
  intervals: readonly Semitones[],
): { quality: ChordQuality; form: RootlessForm } | null {
  return ROOTLESS_BY_SHAPE.get(key(intervals)) ?? null;
}

/**
 * The voicing in close position, low to high, from a **bass note** — the note
 * the form puts underneath, not the root, because the root is never played.
 */
export function rootlessNotesFromBass(
  bass: Midi,
  quality: ChordQuality,
  form: RootlessForm,
): Midi[] | null {
  const intervals = rootlessIntervals(quality, form);
  return intervals === null
    ? null
    : intervals.map((semitones) => Math.round(bass) + semitones - intervals[0]);
}

/** How far this form's bass sits above the root it is named from. */
export function rootlessBassOffset(
  quality: ChordQuality,
  form: RootlessForm,
): Semitones | null {
  const intervals = rootlessIntervals(quality, form);
  return intervals === null ? null : intervals[0];
}

/** How far the top of this form sits above its own bass — the hand's span. */
export function rootlessSpan(
  quality: ChordQuality,
  form: RootlessForm,
): Semitones {
  const intervals = rootlessIntervals(quality, form);
  return intervals === null
    ? 0
    : intervals[intervals.length - 1] - intervals[0];
}

/**
 * The four pitch classes of this chord's rootless voicing, sorted, or `null`.
 *
 * It takes **no form**, and that is the point: A and B are the same four
 * tones, so the set cannot tell them apart and only the bass note can
 * (`spellsRootless`).
 */
export function rootlessPitchClasses(
  rootPc: PitchClass,
  quality: ChordQuality,
): PitchClass[] | null {
  const intervals = rootlessIntervals(quality, 'A');
  return intervals === null
    ? null
    : normalise(intervals.map((semitones) => rootPc + semitones));
}

/**
 * Do these notes play the `form` rootless voicing of `quality` on `rootPc`?
 *
 * The rule (slice 11, slice 8's one voicing on): the **pitch classes played
 * must be exactly the voicing's four**, and the **lowest note played must be
 * the form's own bass degree** — the 3rd for A, the 7th for B. Register,
 * octave, spacing and order are free; enharmonics compare equal for free
 * (integer arithmetic, ADR §4); a doubling costs one of the four notes the
 * answer has, so it always leaves a pitch class missing and fails.
 *
 * The **root is not one of the four**, so playing it fails — that is what
 * "rootless" means, and the miss is named rather than left bare.
 */
export function spellsRootless(
  notes: readonly Midi[],
  rootPc: PitchClass,
  quality: ChordQuality,
  form: RootlessForm,
): boolean {
  if (!spellsRootlessInAnyInversion(notes, rootPc, quality)) return false;
  const offset = rootlessBassOffset(quality, form);
  if (offset === null) return false;
  const bass = Math.min(...notes.map((midi) => Math.round(midi)));
  return pcOf(bass) === normalise([rootPc + offset])[0];
}

/**
 * Are these the voicing's four pitch classes over some other one — the right
 * notes with the wrong tone underneath? Since A and B share their four tones,
 * this is true for *both* forms, which is exactly what lets a miss say "that
 * is the other form" instead of "wrong" (`spellsShellInAnyInversion`'s rule).
 */
export function spellsRootlessInAnyInversion(
  notes: readonly Midi[],
  rootPc: PitchClass,
  quality: ChordQuality,
): boolean {
  const wanted = rootlessPitchClasses(rootPc, quality);
  if (wanted === null || notes.length === 0) return false;
  return key(notes.map((midi) => pcOf(midi))) === wanted.join(',');
}

// ---- guide tones (slice 12) ----------------------------------------------

/**
 * The **guide tones**: the 3rd and the 7th, and nothing else — the smallest
 * thing that still says what a chord is. A shell is these two with the root
 * under them; a rootless voicing is these two with the 5th and the 9th around
 * them. Take both away and what is left is the pair that carries the colour
 * and moves by a semitone through a ii-V-I, which is why every method drills
 * them on their own before it drills anything larger.
 *
 * The two tones **in the order the chord names them, 3rd then 7th** — not
 * sorted, because which one is which is the whole vocabulary here. `null` for
 * anything with no 3rd-and-7th pair to take, exactly as `shellIntervals()`: a
 * triad, a sus chord and a 6th chord have no 7th, `dim7`'s "7th" is a
 * diminished 7th (9 semitones — `C-Eb-A` is as much an `Ebm6` fragment), and
 * `dom7alt` has no interval set to start from.
 */
export function guideToneIntervals(
  quality: ChordQuality,
): readonly Semitones[] | null {
  const shell = shellIntervals(quality);
  // A shell is `[0, 3rd, 7th]` by construction, so the guide tones are what is
  // left when the root goes. Deriving them keeps one definition of "a 3rd" and
  // "a 7th" in this module instead of two that can drift.
  return shell === null ? null : [shell[1], shell[2]];
}

/** Has this quality a 3rd-and-7th pair at all? */
export function hasGuideTones(quality: ChordQuality): boolean {
  return guideToneIntervals(quality) !== null;
}

/**
 * The qualities whose guide-tone pair is **theirs alone**, plainest first —
 * the `SHELL_QUALITIES` rule, and in fact the same four. A guide-tone pair
 * drops even more than a shell does, so it merges at least as much: `min7b5`
 * is `[3, 10]`, which *is* `min7`'s (the flat 5th is not a guide tone), and
 * every 9th and altered 9th collapses onto its plain seventh chord.
 *
 * Order is what `guideToneReadings()` lists a collision in, so the plain
 * seventh chord always comes before its extended relatives.
 */
export const GUIDE_TONE_QUALITIES: readonly ChordQuality[] = SHELL_QUALITIES;

/** What the guide tones are called, for a prompt or a miss (`3rd and 7th`). */
export const GUIDE_TONE_DEGREES = '3rd and 7th';

/**
 * The two degrees a guide tone can be, as a type: a caller that names one (or
 * flips to the other half of the pair) is then checked by the compiler instead
 * of by a test, since a mistyped `'3d'` is not assignable.
 */
export type GuideToneDegree = '3rd' | '7th';

/**
 * Which guide tone this pitch class is for this chord — `3rd`, `7th`, or
 * `null` when it is neither. One short word, so a miss can name the half that
 * was played instead of the half that was not.
 */
export function guideToneDegree(
  rootPc: PitchClass,
  quality: ChordQuality,
  pc: PitchClass,
): GuideToneDegree | null {
  const intervals = guideToneIntervals(quality);
  if (intervals === null) return null;
  const wanted = normalise([pc])[0];
  if (normalise([rootPc + intervals[0]])[0] === wanted) return '3rd';
  if (normalise([rootPc + intervals[1]])[0] === wanted) return '7th';
  return null;
}

/**
 * The pair in close position **above a root**, 3rd then 7th, or `null`. The
 * root itself is not in the result: it is the note the pair is named from and
 * the one this voicing never plays (the `rootlessNotesFromBass()` rule, with
 * the two other tones gone as well).
 */
export function guideToneNotes(
  root: Midi,
  quality: ChordQuality,
): Midi[] | null {
  const intervals = guideToneIntervals(quality);
  return intervals === null
    ? null
    : intervals.map((semitones) => Math.round(root) + semitones);
}

/** How far the 7th sits above the root the pair is named from. */
export function guideToneSpan(quality: ChordQuality): Semitones {
  const intervals = guideToneIntervals(quality);
  return intervals === null ? 0 : Math.max(...intervals);
}

/** The two pitch classes of this chord's guide tones, sorted, or `null`. */
export function guideTonePitchClasses(
  rootPc: PitchClass,
  quality: ChordQuality,
): PitchClass[] | null {
  const intervals = guideToneIntervals(quality);
  return intervals === null
    ? null
    : normalise(intervals.map((semitones) => rootPc + semitones));
}

/**
 * Do these notes play the guide tones of `quality` on `rootPc`?
 *
 * The rule (slice 12, slices 8 and 11 with the bass freed): the **pitch
 * classes played must be exactly the pair's two**, and that is all. Register,
 * octave, spacing and order are free, and so is **which of the two is
 * underneath** — unlike a shell (root at the bottom) or a rootless form (the
 * form *is* its bass note), a guide-tone pair has no bass rule to break: both
 * `3-7` and `7-3` are the pair every method teaches, and which one a hand
 * reaches for is voice leading, not correctness.
 *
 * The **root is not one of the two**, so playing it fails — a root, a 3rd and
 * a 7th is the shell, which is slice 8's drill and a *named* miss here.
 * Enharmonics compare equal for free (integer arithmetic, ADR §4); a doubling
 * costs one of the two notes the answer has, so it always leaves a pitch class
 * missing and fails.
 */
export function spellsGuideTones(
  notes: readonly Midi[],
  rootPc: PitchClass,
  quality: ChordQuality,
): boolean {
  const wanted = guideTonePitchClasses(rootPc, quality);
  if (wanted === null || notes.length === 0) return false;
  return key(notes.map((midi) => pcOf(midi))) === wanted.join(',');
}

/**
 * Every chord whose guide tones these pitch classes are, plainest quality
 * first, then by root — so a wrong pair can be *named* instead of called
 * noise.
 *
 * It returns a **list**, and the ambiguity is the music's, not a defect (the
 * `rootlessOfIntervalsAboveBass()` note, one size down): two notes a tritone
 * apart are the guide tones of *two* dominants a tritone apart — that is what
 * makes tritone substitution work — and a 3rd-and-7th pair a fifth apart reads
 * as a `maj7` and as a `min7` a semitone above it (`E` + `B` is `Cmaj7` and
 * `C#m7`). A caller that asked about a particular chord should prefer the
 * reading in its own quality; the order here only settles the rest.
 */
export function guideToneReadings(
  pcs: readonly PitchClass[],
): { rootPc: PitchClass; quality: ChordQuality }[] {
  const played = key(pcs);
  const readings: { rootPc: PitchClass; quality: ChordQuality }[] = [];
  for (const quality of GUIDE_TONE_QUALITIES) {
    for (let rootPc = 0; rootPc < 12; rootPc += 1) {
      const wanted = guideTonePitchClasses(rootPc as PitchClass, quality);
      if (wanted !== null && wanted.join(',') === played)
        readings.push({ rootPc: rootPc as PitchClass, quality });
    }
  }
  return readings;
}
