/**
 * Exercise #2 — "Interval recognition" (ADR §10, slice 6): two notes sound in
 * sequence and the user plays the same interval back. The first true
 * ear-training drill and the first step of product pillar 1.
 *
 * **The graded quantity is the interval, not the pitches.** A question is
 * asked from a random root, but the answer is `played[1] − played[0]` compared
 * to the asked semitones, exactly and with direction: the skill being trained
 * is relative pitch (absolute pitch is what "Find the note" drills). So the
 * interval may be played from any root, an octave displacement is a *different*
 * interval (a twelfth is not a fifth), and enharmonics compare equal for free
 * because the comparison is integer arithmetic (ADR §4).
 *
 * `generate()` and `grade()` are pure and take the seeded `rng`, so a question
 * is reproducible from `(exerciseId, seed, settings, range)` and both are
 * unit-tested without a browser (ADR §5).
 */

import {
  MIDDLE_C,
  intervalBetween,
  intervalName,
  intervalShortName,
  midiToName,
  spokenInterval,
  type Midi,
  type NoteName,
  type Semitones,
} from '$lib/theory';
import { randomInt } from '../rng';
import {
  MAX_SEMITONE_SEGMENT,
  integerSegment,
  skillIdSegments,
} from '../skill-id';
import type {
  Answer,
  ExerciseDefinition,
  GenerateContext,
  Grade,
  Question,
  SkillId,
} from '../types';

export const INTERVAL_RECOGNITION_ID = 'interval-recognition';

/** v1 asks ascending intervals only; `SkillId` carries the direction anyway. */
export type IntervalDirection = 'asc' | 'desc';

export interface IntervalPayload {
  /** The note the question was played from. Not part of the answer. */
  rootMidi: Midi;
  /** Signed: positive is ascending. */
  semitones: Semitones;
  direction: IntervalDirection;
}

/**
 * A **type alias**, not an `interface`: the registry's erased `AnyExercise`
 * types settings as `Record<string, unknown>`, and only an alias gets the
 * implicit index signature that makes it assignable (see `types.ts`).
 */
export type IntervalSettings = {
  /**
   * The interval set in play, in semitones. The starting set is the one a
   * beginner can actually tell apart — seconds, thirds, the perfect
   * fourth/fifth and the octave. The tritone, sixths and sevenths join it when
   * the runner can render `settingsFields` (ADR §10 wants all 13 selectable).
   */
  semitones: readonly Semitones[];
  direction: IntervalDirection;
};

/** Minor 2nd, Major 2nd, Minor 3rd, Major 3rd, Perfect 4th, Perfect 5th, Octave. */
export const STARTER_INTERVALS: readonly Semitones[] = [1, 2, 3, 4, 5, 7, 12];

/** How hard we try to avoid asking the same interval twice in a row. */
const MAX_REDRAWS = 4;

/** How long each note of the question rings, in milliseconds. */
const NOTE_MS = 750;
/** Melodic, so the second note starts when the first stops (ADR §10). */
const GAP_MS = 0;
const NOTE_VELOCITY = 90;

/**
 * Where a root is drawn from when the user's range allows it: the two octaves
 * around middle C, where a digital piano's notes are easiest to hear and to
 * play back. A narrower instrument range wins over this (it is the real one).
 */
const COMFORT_LOW: Midi = MIDDLE_C - 12;
const COMFORT_HIGH: Midi = MIDDLE_C + 12;

/** The mastery unit is the interval and its direction (ADR §10). */
export function skillIdFor(
  semitones: Semitones,
  direction: IntervalDirection,
): SkillId {
  return `${INTERVAL_RECOGNITION_ID}:${Math.abs(semitones)}:${direction}`;
}

/**
 * What a skill id is called in the `/progress` grid — `m3 ↑`: the copy deck
 * abbreviates musical terms in dense grids and spells them out in feedback.
 * The arrow is the direction, so ascending and descending never look alike.
 * An id this exercise does not recognise comes back unchanged.
 */
export function intervalSkillLabel(skillId: SkillId): string {
  const segments = skillIdSegments(skillId, INTERVAL_RECOGNITION_ID, 2);
  if (segments === null) return skillId;
  const [size, direction] = segments;
  const semitones = integerSegment(size, MAX_SEMITONE_SEGMENT);
  if (semitones === null) return skillId;
  if (direction !== 'asc' && direction !== 'desc') return skillId;
  return `${intervalShortName(semitones)} ${direction === 'desc' ? '↓' : '↑'}`;
}

/** Flats, like every other spelling in the app (find-the-note's rule). */
function spell(midi: Midi): NoteName {
  return midiToName(midi, 'flat');
}

/** The two notes of a question, low index first in playing order. */
function notesOf(payload: IntervalPayload): [Midi, Midi] {
  return [payload.rootMidi, payload.rootMidi + payload.semitones];
}

function pickRoot(
  rng: () => number,
  low: Midi,
  high: Midi,
  semitones: Semitones,
): Midi {
  // The root must leave room for the second note at either end, whichever way
  // the interval goes — that is what keeps a question inside the instrument.
  const floor = Math.max(low, low - Math.min(0, semitones));
  const ceiling = Math.min(high, high - Math.max(0, semitones));
  if (ceiling < floor) return floor;
  // Prefer the comfortable middle, but never leave the real range to get it.
  const comfortLow = Math.max(floor, COMFORT_LOW);
  const comfortHigh = Math.min(ceiling, COMFORT_HIGH);
  return comfortHigh >= comfortLow
    ? randomInt(rng, comfortLow, comfortHigh)
    : randomInt(rng, floor, ceiling);
}

/** The intervals this question set can actually ask inside `range`. */
function playableIntervals(
  settings: IntervalSettings,
  span: number,
): readonly Semitones[] {
  const playable = settings.semitones.filter(
    (semitones) => Math.abs(semitones) <= span,
  );
  // A range under an octave is not a piano (the settings store guards that),
  // so this only ever falls back on a hand-built test range.
  return playable.length > 0 ? playable : [Math.min(span, 1)];
}

function generate(
  ctx: GenerateContext<IntervalSettings>,
): Question<IntervalPayload> {
  const { low, high } = ctx.range;
  const direction = ctx.settings.direction;
  const sign = direction === 'desc' ? -1 : 1;
  const choices = playableIntervals(ctx.settings, high - low);
  const recent = ctx.history.recentSkillIds;

  let size = choices[randomInt(ctx.rng, 0, choices.length - 1)];
  // Redraw a few times rather than looping until different: asking the same
  // interval twice in a row is dull, but forcing a change would bias the draw
  // (and could not terminate at all on a one-interval set).
  for (
    let redraw = 0;
    redraw < MAX_REDRAWS &&
    choices.length > 1 &&
    recent[0] === skillIdFor(size, direction);
    redraw += 1
  ) {
    size = choices[randomInt(ctx.rng, 0, choices.length - 1)];
  }

  const semitones = sign * Math.abs(size);
  const rootMidi = pickRoot(ctx.rng, low, high, semitones);
  const payload: IntervalPayload = { rootMidi, semitones, direction };
  const [first, second] = notesOf(payload);
  const label = intervalName(semitones);

  return {
    // Derived from the seed, not `crypto.randomUUID()`: `generate()` is pure,
    // and the seed is what makes a logged attempt reproducible.
    id: `${INTERVAL_RECOGNITION_ID}:${ctx.seed}:${rootMidi}:${semitones}`,
    seed: ctx.seed,
    skillId: skillIdFor(semitones, direction),
    payload,
    prompt: {
      title: 'Which interval did you hear?',
      subtitle: 'Play the two notes back, from any key',
      showKeyboard: true,
    },
    playback: {
      events: [
        {
          atMs: 0,
          notes: [first],
          durationMs: NOTE_MS,
          velocity: NOTE_VELOCITY,
        },
        {
          atMs: NOTE_MS + GAP_MS,
          notes: [second],
          durationMs: NOTE_MS,
          velocity: NOTE_VELOCITY,
        },
      ],
    },
    answerMode: 'note-sequence',
    expected: { kind: 'notes', notes: [first, second], label },
    // No `range`: the answer may be played from any key, so nothing dims.
    spellings: new Map([
      [first, spell(first)],
      [second, spell(second)],
    ]),
  };
}

/** How a miss is explained — one short line, a teacher's tone (UX §9). */
export function missDetail(
  expected: Semitones,
  played: Semitones,
): string | undefined {
  if (played === expected) return undefined;
  if (Math.abs(played) === Math.abs(expected)) {
    // Right size, wrong way round: the most useful thing we can say.
    return played > 0
      ? 'You played it upwards'
      : 'You played it the other way — downwards';
  }
  return `You played ${spokenInterval(played)}`;
}

function grade(question: Question<IntervalPayload>, answer: Answer): Grade {
  const { semitones } = question.payload;
  const [first, second] = notesOf(question.payload);
  const reveal = { notes: [first, second], label: intervalName(semitones) };

  // Fewer than two notes is not an interval — a closed-but-empty sequence
  // (the answer window ran out) is a miss, like any other wrong answer.
  if (answer.kind !== 'notes' || answer.order.length < 2) {
    return { correct: false, score: 0, revealed: reveal };
  }

  const played = intervalBetween(answer.order[0], answer.order[1]);
  if (played === semitones) return { correct: true, score: 1 };
  return {
    // Binary, per ADR §10: an interval is either the one you heard or it is
    // not. Mastery (slice 5a) reads this score, so half credit here would
    // quietly report a skill as half-learned.
    correct: false,
    score: 0,
    feedback: missDetail(semitones, played),
    revealed: reveal,
  };
}

export const intervalRecognition: ExerciseDefinition<
  IntervalPayload,
  IntervalSettings
> = {
  id: INTERVAL_RECOGNITION_ID,
  title: 'Interval recognition',
  description:
    'Two notes sound one after the other. Play the same distance back, from any key.',
  defaultSettings: {
    semitones: STARTER_INTERVALS,
    direction: 'asc',
  },
  requiresMidi: false,
  skillsCovered: (settings) =>
    settings.semitones.map((semitones) =>
      skillIdFor(semitones, settings.direction),
    ),
  skillLabel: (skillId) => intervalSkillLabel(skillId),
  generate,
  grade,
};
