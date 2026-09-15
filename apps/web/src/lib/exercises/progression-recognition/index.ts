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
  midiToName,
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
  type NoteName,
  type PitchClass,
  type ProgressionType,
} from '$lib/theory';
import { randomInt } from '../rng';
import type {
  Answer,
  ExerciseDefinition,
  GenerateContext,
  Grade,
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

const PITCH_CLASSES: readonly PitchClass[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
];

/** How hard we try to avoid asking the same cadence in the same key twice. */
const MAX_REDRAWS = 4;

/** How long each chord rings, and how far apart the chords start. */
const CHORD_MS = 1150;
const CHORD_STEP_MS = 1250;
/**
 * Deliberately below slice 7's 88: four voices already peak near full scale
 * with no per-voice scaling in `playChord` (a known engine issue, product's
 * list), and this drill plays three such chords in a row.
 */
const CHORD_VELOCITY = 80;

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
const COMFORT_LOW: Midi = MIDDLE_C - 17;
const COMFORT_HIGH: Midi = MIDDLE_C - 5;

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
  const prefix = `${PROGRESSION_RECOGNITION_ID}:`;
  if (!skillId.startsWith(prefix)) return skillId;
  const rest = skillId.slice(prefix.length);
  const split = rest.lastIndexOf(':');
  if (split < 0) return skillId;
  const type = rest.slice(0, split);
  const tonicPc = Number(rest.slice(split + 1));
  if (!isProgressionType(type)) return skillId;
  if (!Number.isInteger(tonicPc) || tonicPc < 0 || tonicPc > 11) return skillId;
  return `${pitchClassName(tonicPc, 'flat')} ${progressionShortName(type)}`;
}

/** Flats, like every other spelling in the app (find-the-note's rule). */
function spell(midi: Midi): NoteName {
  return midiToName(midi, 'flat');
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

/** The cadences of this set that fit inside `span` semitones. */
function playableTypes(
  settings: ProgressionSettings,
  span: number,
): readonly ProgressionType[] {
  const playable = settings.types.filter((type) => {
    const reach = progressionSpan(type);
    return progressionSteps(type) !== null && reach.high - reach.low <= span;
  });
  // A range under an octave and a half is not a piano (the settings store
  // guards an octave), so this only ever falls back on a hand-built test range.
  return playable.length > 0 ? playable : [PROGRESSION_TYPES[0]];
}

/** The octaves of `pc` between `from` and `to`, low to high. */
function octavesOf(pc: PitchClass, from: Midi, to: Midi): Midi[] {
  const notes: Midi[] = [];
  for (let midi = from + ((pc - pcOf(from) + 12) % 12); midi <= to; midi += 12)
    notes.push(midi);
  return notes;
}

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

  const comfortable = octavesOf(
    tonicPc,
    Math.max(floor, COMFORT_LOW),
    Math.min(ceiling, COMFORT_HIGH),
  );
  const anywhere =
    comfortable.length > 0 ? comfortable : octavesOf(tonicPc, floor, ceiling);
  if (anywhere.length > 0)
    return anywhere[randomInt(rng, 0, anywhere.length - 1)];

  // A range under an octave and a half has no octave of *this* tonic that the
  // cadence fits inside (the settings store only guards an octave). Something
  // has to poke out; pick the octave that pokes out least, and deterministically
  // — a question that cannot be voiced properly should at least be the same one
  // every time its seed comes round.
  const overflow = (tonic: Midi): number =>
    Math.max(0, low - (tonic + reach.low)) +
    Math.max(0, tonic + reach.high - high);
  return octavesOf(tonicPc, 0, 127).reduce((best, tonic) =>
    overflow(tonic) < overflow(best) ? tonic : best,
  );
}

function generate(
  ctx: GenerateContext<ProgressionSettings>,
): Question<ProgressionPayload> {
  const { low, high } = ctx.range;
  const choices = playableTypes(ctx.settings, high - low);
  const recent = ctx.history.recentSkillIds;

  let type = choices[randomInt(ctx.rng, 0, choices.length - 1)];
  let tonicPc = PITCH_CLASSES[randomInt(ctx.rng, 0, PITCH_CLASSES.length - 1)];
  // Redraw a few times rather than looping until different: the same cadence
  // in the same key twice running is dull, but forcing a change would bias the
  // draw (and could not terminate at all on a one-key set).
  for (
    let redraw = 0;
    redraw < MAX_REDRAWS && recent[0] === skillIdFor(type, tonicPc);
    redraw += 1
  ) {
    type = choices[randomInt(ctx.rng, 0, choices.length - 1)];
    tonicPc = PITCH_CLASSES[randomInt(ctx.rng, 0, PITCH_CLASSES.length - 1)];
  }

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
    spellings: new Map(notes.map((midi) => [midi, spell(midi)])),
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
  skillsCovered: (settings) =>
    settings.types
      // A type the theory module cannot build has nothing to ask, so it puts
      // no unanswerable cell on `/progress`.
      .filter((type) => progressionSteps(type) !== null)
      .flatMap((type) =>
        PITCH_CLASSES.map((tonicPc) => skillIdFor(type, tonicPc)),
      ),
  skillLabel: (skillId) => progressionSkillLabel(skillId),
  generate,
  grade,
};
