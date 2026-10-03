/**
 * Exercise #5 — "ii-V-I progression" (ADR §10, slice 10, the last exercise of
 * the plan): a three-chord cadence sounds, chord by chord, and the user plays
 * it back. The third ear-training drill, and the first where what is heard is
 * a *sentence* rather than a word — the ii-V-I is the unit jazz tunes are
 * actually built from.
 *
 * **The graded quantity is the progression in a key** (slice 8's rule, one
 * level up): the answer is cut into chords by count and in played order, and
 * each chord must spell its degree's quality **over its own root**
 * (`spellsProgression` in `$lib/theory/progressions.ts`). So:
 *
 * - **key** — the one you heard. `Dm7 · G7 · Cmaj7` and `Ebm7 · Ab7 · Dbmaj7`
 *   are the same cadence and two different shapes under the hand, which is
 *   what makes all 12 keys worth drilling.
 * - **order** — the cadence's. ii, then V, then I; playing them in another
 *   order is a named miss, never a silent one.
 * - **octave / register / spacing** — free, per chord and for the whole
 *   progression: only the pitch classes above each chord's bass are compared,
 *   so a wide left-hand chord and a close right-hand one grade the same.
 * - **doubling** — fails, exactly as it does in slice 8: the answer is twelve
 *   notes and a chord is four, so a doubled note always costs a chord tone and
 *   leaves its chunk a pitch class short.
 * - **inversion** — root position, chord by chord. A pitch-class set alone
 *   does not name one quality (slice 7's reasoning: Cm7 and Eb6 are the same
 *   four notes), so the lowest note of each chord is read as its root.
 * - **enharmonics** — equal for free: integer arithmetic on MIDI numbers.
 *
 * **Chords are separated by count, not by time.** Each chord is exactly four
 * notes, so the answer is chunked 4–4–4 in played order. Nothing downstream
 * *can* separate them by timing — an `Answer` carries notes, order and a
 * source, and no timestamps (ADR §5) — and a time-based rule would grade a
 * beginner on how long they hunt for the next chord. Slice 7's unimplemented
 * `CHORD_SETTLE_MS` note is therefore **still unimplemented and no longer
 * needed here**; slice 2's `detectChords()` deviation is untouched.
 *
 * **The chords are whole four-note sevenths, not shells.** The minor cadence's
 * ii is a `min7b5`, whose shell *is* `min7`'s (the b5 is exactly the note a
 * shell drops — slice 8 dropped the quality for that reason), so a shelled
 * minor ii-V-i would be indistinguishable from the major ii's colour. Whole
 * chords also keep the drill inside slice 7's vocabulary, which is what the
 * ear has already been trained on, and the prompt copy says so.
 *
 * Scoring is **binary** (ADR §10): a cadence with one wrong chord is not the
 * cadence, and partial credit would report a key as half-learned to the
 * mastery EWMA.
 *
 * `generate()` and `grade()` are pure and take the seeded `rng`, so a question
 * is reproducible from `(exerciseId, seed, settings, range)` and both are
 * unit-tested without a browser (ADR §5).
 */

import {
  MIDDLE_C,
  chordIntervals,
  chordSymbolText,
  chunkIntoChords,
  intervalsAboveBass,
  isProgressionType,
  pcOf,
  pitchClassName,
  progressionChordSizes,
  progressionChords,
  progressionName,
  progressionNoteCount,
  progressionNotes,
  progressionShortName,
  progressionSpan,
  progressionSteps,
  progressionText,
  qualityOfIntervals,
  spellsProgression,
  spellsQualityFromRoot,
  spellsQualityInAnyInversion,
  PROGRESSION_TYPES,
  type Midi,
  type PitchClass,
  type ProgressionType,
} from '$lib/theory';
import { NothingToAskError, pitchClassesIn } from '../coverage';
import { drawKey, occurrences, pickOccurrence, spellings } from '../draw';
import { pitchClassSegment, skillIdSegments } from '../skill-id';
import type {
  Answer,
  ExerciseDefinition,
  GenerateContext,
  Grade,
  KeyRange,
  Question,
  SkillId,
} from '../types';

export const PROGRESSION_RECOGNITION_ID = 'progression-recognition';

export interface ProgressionPayload {
  /** The key the cadence resolves to. */
  tonicPc: PitchClass;
  /** Where the tonic was voiced — the register the question sounded in. */
  tonicMidi: Midi;
  type: ProgressionType;
}

/**
 * A **type alias**, not an `interface`: the registry's erased `AnyExercise`
 * types settings as `Record<string, unknown>`, and only an alias gets the
 * implicit index signature that makes it assignable (`types.ts`).
 */
export type ProgressionSettings = {
  /** The cadences in play, in no particular order. */
  types: readonly ProgressionType[];
};

/**
 * The starter set: both ii-V-Is the theory module knows. Turnarounds
 * (I-VI-ii-V), backdoor cadences and longer forms are a later ticket — two
 * cadences in 12 keys is already 24 skills, and they are the two a jazz
 * beginner meets on the first page of every tune.
 */
export const STARTER_TYPES: readonly ProgressionType[] = PROGRESSION_TYPES;

/** How long each chord rings, and how far apart the chords start. */
const CHORD_MS = 1150;
const CHORD_STEP_MS = 1250;
/**
 * Slice 7's chord velocity, shared again: the engine now applies summed-gain
 * headroom to every chord it starts (`headroomScale`), so this drill's three
 * chords in a row need no velocity of their own. The stop-gap 80 that stood
 * here while `playChord` had no per-voice scaling is gone with it.
 */
const CHORD_VELOCITY = 88;

/**
 * How long the answer may go silent before it closes itself
 * (`Question.answerGapMs`). Twelve notes in three chords is a long answer, and
 * the runner's default 1200 ms is the window for a two-note interval: a
 * beginner hunting for the next chord would have the answer taken away
 * mid-cadence. The idle pause (90 s) is still what ends an abandoned drill.
 */
const ANSWER_GAP_MS = 3000;

/**
 * Where the tonic is voiced when the user's range allows it: around the octave
 * below middle C, where three root-position seventh chords sit comfortably
 * under one hand. A narrower instrument range wins over this (it is the real
 * one).
 */
const COMFORT = { low: MIDDLE_C - 17, high: MIDDLE_C - 5 };

/**
 * The mastery unit is **the cadence in a key**, like slice 8's chord and for
 * the same reason: what is weak in a progression drill is a key. Averaging
 * `Bbm7-Eb7-Abmaj7` with `Dm7-G7-Cmaj7` would hide exactly the keys the drill
 * exists to expose (and, since slice 9a, to schedule).
 */
export function skillIdFor(
  type: ProgressionType,
  tonicPc: PitchClass,
): SkillId {
  return `${PROGRESSION_RECOGNITION_ID}:${type}:${tonicPc}`;
}

/**
 * What a skill id is called in the `/progress` grid — `C ii-V-I`: the key plus
 * the abbreviated cadence name, which is how a chart's key signature and a
 * teacher's shorthand read. The major and the minor cadence are told apart by
 * the numeral's case (`I` / `i`), which is the standard notation and is text,
 * never colour. An id this exercise does not recognise comes back unchanged.
 */
export function progressionSkillLabel(skillId: SkillId): string {
  const skill = parseSkillId(skillId);
  if (skill === null) return skillId;
  return `${pitchClassName(skill.tonicPc, 'flat')} ${progressionShortName(skill.type)}`;
}

/**
 * The cadence and key a skill id names, or `null` for anything else — an id
 * read back is untrusted input.
 */
export function parseSkillId(
  skillId: SkillId,
): { type: ProgressionType; tonicPc: PitchClass } | null {
  const segments = skillIdSegments(skillId, PROGRESSION_RECOGNITION_ID, 2);
  if (segments === null) return null;
  const [type, tonic] = segments;
  const tonicPc = pitchClassSegment(tonic);
  if (tonicPc === null || !isProgressionType(type)) return null;
  return { type, tonicPc };
}

/** The notes of a question, chord by chord. */
function chordsOf(payload: ProgressionPayload): Midi[][] {
  return (
    progressionNotes(payload.tonicMidi, payload.type) ?? [[payload.tonicMidi]]
  );
}

/** Every note of a question, in the order it is played and answered. */
function notesOf(payload: ProgressionPayload): Midi[] {
  return chordsOf(payload).flat();
}

/**
 * The keys a `type` cadence can be asked in on `range`: those with an octave
 * of the tonic far enough above the bottom for the V's root and far enough
 * below the top for the ii's 7th (`pickTonicMidi`'s window). All twelve on a
 * keyboard of the cadence's reach plus an octave; none on one narrower than
 * the reach itself (an octave and a half), or for a type the theory module
 * cannot build.
 */
function buildableTonics(type: ProgressionType, range: KeyRange): PitchClass[] {
  if (progressionSteps(type) === null) return [];
  const reach = progressionSpan(type);
  return pitchClassesIn(range.low - reach.low, range.high - reach.high);
}

/**
 * The cadences of this set that `generate()` can ask on `range`, in at least
 * one key. No fallback: an empty set — a keyboard under an octave and a half,
 * which the settings store allows (it only guards an octave) — means nothing
 * to ask (`coverage.ts`).
 */
export function buildableTypes(
  settings: ProgressionSettings,
  range: KeyRange,
): ProgressionType[] {
  return settings.types.filter(
    (type) => buildableTonics(type, range).length > 0,
  );
}

/** The octaves of `pc` between `from` and `to`, low to high. */
/**
 * Where to voice the tonic: an octave of `tonicPc` that keeps the whole
 * cadence — the V's root below it and the ii's 7th above it — inside the
 * instrument, preferring the left hand's register.
 */
function pickTonicMidi(
  rng: () => number,
  low: Midi,
  high: Midi,
  tonicPc: PitchClass,
  type: ProgressionType,
): Midi {
  const reach = progressionSpan(type);
  // The tonic's own window: far enough above the bottom for the V's root, far
  // enough below the top for the ii's 7th.
  const floor = low - reach.low;
  const ceiling = Math.max(floor, high - reach.high);

  const tonic = pickOccurrence(
    rng,
    tonicPc,
    { low: floor, high: ceiling },
    COMFORT,
  );
  if (tonic !== null) return tonic;

  // Defensive only: `generate()` asks a tonic from `buildableTonics()`, which
  // always has an octave that fits. Should one ever not, pick the octave that
  // pokes out least, deterministically, rather than throw mid-drill.
  const overflow = (tonic: Midi): number =>
    Math.max(0, low - (tonic + reach.low)) +
    Math.max(0, tonic + reach.high - high);
  return occurrences(tonicPc, 0, 127).reduce((best, tonic) =>
    overflow(tonic) < overflow(best) ? tonic : best,
  );
}

function generate(
  ctx: GenerateContext<ProgressionSettings>,
): Question<ProgressionPayload> {
  const { low, high } = ctx.range;
  const choices = buildableTypes(ctx.settings, ctx.range);
  if (choices.length === 0)
    throw new NothingToAskError(PROGRESSION_RECOGNITION_ID);

  // The planner's target, asked exactly when this drill can build it; else a
  // cadence, then a key it fits in, not the last one asked (`draw.ts`).
  const { quality: type, rootPc: tonicPc } = drawKey({
    rng: ctx.rng,
    targetSkillId: ctx.targetSkillId,
    recentSkillIds: ctx.history.recentSkillIds,
    choices,
    rootsOf: (type) => buildableTonics(type, ctx.range),
    parseSkillId: (skillId) => {
      const skill = parseSkillId(skillId);
      return skill && { quality: skill.type, rootPc: skill.tonicPc };
    },
    skillIdFor,
  });

  const tonicMidi = pickTonicMidi(ctx.rng, low, high, tonicPc, type);
  const payload: ProgressionPayload = { tonicPc, tonicMidi, type };
  const chords = chordsOf(payload);
  const notes = chords.flat();

  return {
    // Derived from the seed, not `crypto.randomUUID()`: `generate()` is pure,
    // and the seed is what makes a logged attempt reproducible.
    id: `${PROGRESSION_RECOGNITION_ID}:${ctx.seed}:${tonicMidi}:${type}`,
    seed: ctx.seed,
    skillId: skillIdFor(type, tonicPc),
    payload,
    prompt: {
      // `cadence`, not `progression`: the prompt is `--fs-prompt` (56 px,
      // uppercase, tracked), and `WHICH PROGRESSION DID YOU HEAR?` (31
      // characters) wraps onto a second line at 1280 px — which costs the
      // answer area a line and pushes the runner into a scroll, which §4.1
      // forbids (CI caught it). The longest title that is known to fit is the
      // interval drill's 28 characters; this one is 27. The word
      // `progression` is the rail's job anyway — it says `ii-V-I
      // progressions` — so nothing is lost. Never lengthen either line
      // without re-running the no-scroll guard.
      title: 'Which cadence did you hear?',
      subtitle: 'Play the chords back in order, in root position',
      showKeyboard: true,
    },
    playback: {
      // One block chord per step, a beat and a bit apart: a cadence is heard
      // as movement, so the chords have to arrive in time, not together.
      events: chords.map((chordNotes, index) => ({
        atMs: index * CHORD_STEP_MS,
        notes: chordNotes,
        durationMs: CHORD_MS,
        velocity: CHORD_VELOCITY,
      })),
    },
    answerMode: 'note-sequence',
    // A twelve-note answer needs a longer silence window than a two-note
    // interval — see `ANSWER_GAP_MS`.
    answerGapMs: ANSWER_GAP_MS,
    expected: {
      kind: 'notes',
      notes,
      label: progressionText(tonicPc, type),
    },
    // No `range`: the cadence may be played in any register, so nothing dims.
    spellings: spellings(notes),
  };
}

/** How a miss is explained — one short line, a teacher's tone (UX §9). */
export function missDetail(
  tonicPc: PitchClass,
  type: ProgressionType,
  played: readonly Midi[],
): string | undefined {
  const chords = progressionChords(tonicPc, type);
  const steps = progressionSteps(type);
  if (chords === null || steps === null) return undefined;
  if (spellsProgression(played, tonicPc, type)) return undefined;

  const sizes = progressionChordSizes(type);
  const chunks = chunkIntoChords(played, type);
  const whole = chunks.filter((chunk, index) => chunk.length === sizes[index]);

  // The right three chords in the wrong order: a different mistake from
  // playing the wrong chords, and the one worth naming first.
  if (whole.length === chords.length) {
    const asked = chords.map((chord) => `${chord.rootPc}:${chord.quality}`);
    const playedChords = whole.map((chunk) => {
      const bassPc = pcOf(Math.min(...chunk.map((midi) => Math.round(midi))));
      const quality = qualityOfIntervals(intervalsAboveBass(chunk));
      return quality === null ? null : `${bassPc}:${quality}`;
    });
    const sameChords =
      playedChords.every((chord) => chord !== null) &&
      [...asked].sort().join('|') === [...playedChords].sort().join('|');
    if (sameChords)
      return `Right chords — the order is ${progressionText(tonicPc, type)}`;
  }

  // Otherwise: the first chord that was not the asked one, named.
  for (const [index, chord] of chords.entries()) {
    const chunk = chunks[index];
    if (chunk === undefined || chunk.length !== sizes[index]) break;
    if (spellsQualityFromRoot(chunk, chord.rootPc, chord.quality)) continue;

    const numeral = steps[index].numeral;
    const symbol = chordSymbolText(chord.rootPc, chord.quality);
    // "Right notes, wrong one at the bottom" is only that when the notes
    // really are the asked chord's. The quality alone is not enough: the same
    // quality a semitone away (`Ebm7` for `Dm7`) inverts onto itself, and
    // calling that an inversion would send the user looking for the wrong
    // mistake — it is the wrong key, which the naming branch below says.
    const wantedPcs = (chordIntervals(chord.quality) ?? [])
      .map((semitones) => (chord.rootPc + semitones) % 12)
      .sort((a, b) => a - b)
      .join(',');
    const playedPcs = [...new Set(chunk.map((midi) => pcOf(midi)))]
      .sort((a, b) => a - b)
      .join(',');
    if (
      playedPcs === wantedPcs &&
      spellsQualityInAnyInversion(chunk, chord.quality)
    )
      return `The ${numeral} is ${symbol} — the root belongs at the bottom`;

    const bassPc = pcOf(Math.min(...chunk.map((midi) => Math.round(midi))));
    const quality = qualityOfIntervals(intervalsAboveBass(chunk));
    return quality === null
      ? `The ${numeral} is ${symbol}`
      : `The ${numeral} is ${symbol} — you played ${chordSymbolText(bassPc, quality)}`;
  }

  // Nothing whole to name: a short answer, or one that ran past the cadence.
  return played.length < progressionNoteCount(type)
    ? `${progressionName(type)} — three chords of four notes`
    : undefined;
}

function grade(question: Question<ProgressionPayload>, answer: Answer): Grade {
  const { tonicPc, type } = question.payload;
  const notes = notesOf(question.payload);
  const reveal = { notes, label: progressionText(tonicPc, type) };

  // Fewer than two notes is not a chord, let alone a cadence — a
  // closed-but-short sequence (the silence window ran out) is a miss, like any
  // other wrong answer.
  if (answer.kind !== 'notes' || answer.notes.length < 2) {
    return { correct: false, score: 0, revealed: reveal };
  }

  // Graded on played order, not on the sorted set: the order of the chords is
  // half of what a cadence *is*.
  if (spellsProgression(answer.order, tonicPc, type))
    return { correct: true, score: 1 };

  return {
    // Binary, per ADR §10.
    correct: false,
    score: 0,
    feedback: missDetail(tonicPc, type, answer.order),
    revealed: reveal,
  };
}

export const progressionRecognition: ExerciseDefinition<
  ProgressionPayload,
  ProgressionSettings
> = {
  id: PROGRESSION_RECOGNITION_ID,
  title: 'ii-V-I progressions',
  description:
    'A three-chord cadence sounds. Play it back in order, in root position.',
  defaultSettings: {
    types: STARTER_TYPES,
  },
  requiresMidi: false,
  // A type the theory module cannot build, or a key whose cadence does not
  // fit the keyboard, has nothing to ask, so it puts no unanswerable cell on
  // `/progress`.
  skillsCovered: (settings, range) =>
    buildableTypes(settings, range).flatMap((type) =>
      buildableTonics(type, range).map((tonicPc) => skillIdFor(type, tonicPc)),
    ),
  skillLabel: (skillId) => progressionSkillLabel(skillId),
  generate,
  grade,
};
