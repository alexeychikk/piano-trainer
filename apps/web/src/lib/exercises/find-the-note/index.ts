/**
 * Exercise #1 — "Find the note" (ADR §10, slice 4): a random note inside the
 * user's instrument range is played; the user finds it on the piano. Parity
 * with the old Electron app's ear training, and the skill everything else
 * builds on — knowing where a pitch lives under your hands.
 *
 * `generate()` and `grade()` are pure and take the seeded `rng`, so a question
 * is reproducible from `(exerciseId, seed, range)` and both are unit-tested
 * without a browser (ADR §5).
 */

import { midiToName, pcOf, type Midi } from '$lib/theory';
import { randomInt } from '../rng';
import type {
  Answer,
  ExerciseDefinition,
  GenerateContext,
  Grade,
  Question,
} from '../types';

export const FIND_THE_NOTE_ID = 'find-the-note';

export interface FindTheNotePayload {
  midi: Midi;
}

/** No per-exercise settings yet: the instrument range is all it needs. */
export type FindTheNoteSettings = Record<string, never>;

/** How hard we try to avoid asking the same pitch class twice in a row. */
const MAX_REDRAWS = 4;

/** How long the question note rings, in milliseconds. */
const NOTE_MS = 1200;
const NOTE_VELOCITY = 90;

/** The mastery unit is the pitch class — where a note lives, in any octave. */
export function skillIdFor(midi: Midi): string {
  return `${FIND_THE_NOTE_ID}:pc:${pcOf(midi)}`;
}

/**
 * Black keys are spelled with flats: that is how a jazz chart names them, and
 * one spelling per pitch keeps the reveal, the prompt and the keyboard label
 * (`labelStyle: 'context'`) saying the same thing.
 */
export function spell(midi: Midi): string {
  return midiToName(midi, 'flat');
}

function generate(
  ctx: GenerateContext<FindTheNoteSettings>,
): Question<FindTheNotePayload> {
  const { low, high } = ctx.range;
  const recent = ctx.history.recentSkillIds;
  let midi = randomInt(ctx.rng, low, high);
  // Redraw a few times rather than looping until different: asking the same
  // note twice in a row is dull, but forcing a change would bias the draw on a
  // narrow range (and could not terminate at all on a one-note one).
  for (
    let redraw = 0;
    redraw < MAX_REDRAWS && high > low && recent[0] === skillIdFor(midi);
    redraw += 1
  ) {
    midi = randomInt(ctx.rng, low, high);
  }

  const name = spell(midi);
  return {
    // Derived from the seed, not `crypto.randomUUID()`: `generate()` is pure,
    // and the seed is what makes a logged attempt reproducible.
    id: `${FIND_THE_NOTE_ID}:${ctx.seed}:${midi}`,
    seed: ctx.seed,
    skillId: skillIdFor(midi),
    payload: { midi },
    prompt: {
      title: 'Which note?',
      subtitle: 'Play it back on your keyboard',
      showKeyboard: true,
    },
    playback: {
      events: [
        {
          atMs: 0,
          notes: [midi],
          durationMs: NOTE_MS,
          velocity: NOTE_VELOCITY,
        },
      ],
    },
    answerMode: 'single-note',
    expected: { kind: 'notes', notes: [midi], label: name },
    range: { low, high },
    spellings: new Map([[midi, name]]),
  };
}

/** How a miss is explained — one short line, a teacher's tone (UX §9). */
export function missDetail(expected: Midi, played: Midi): string {
  const name = spell(played);
  const distance = played - expected;
  const direction = distance > 0 ? 'high' : 'low';
  if (pcOf(expected) === pcOf(played)) {
    const octaves = Math.abs(distance) / 12;
    const plural = octaves === 1 ? 'octave' : 'octaves';
    return `You played ${name} — the right note, ${octaves} ${plural} too ${direction}`;
  }
  const semitones = Math.abs(distance);
  const plural = semitones === 1 ? 'semitone' : 'semitones';
  return `You played ${name} — ${semitones} ${plural} too ${direction}`;
}

function grade(question: Question<FindTheNotePayload>, answer: Answer): Grade {
  const expected = question.payload.midi;
  if (answer.kind !== 'notes' || answer.order.length === 0) {
    return { correct: false, score: 0, revealed: { notes: [expected] } };
  }
  const played = answer.order[0];
  if (played === expected) {
    return { correct: true, score: 1 };
  }
  return {
    correct: false,
    // Partial credit for the right pitch class: hearing the note but missing
    // the octave is a different mistake, and mastery (slice 5) should say so.
    score: pcOf(played) === pcOf(expected) ? 0.5 : 0,
    feedback: missDetail(expected, played),
    revealed: { notes: [expected], label: spell(expected) },
  };
}

export const findTheNote: ExerciseDefinition<
  FindTheNotePayload,
  FindTheNoteSettings
> = {
  id: FIND_THE_NOTE_ID,
  title: 'Find the note',
  description:
    'A single note sounds somewhere on your piano. Play it back to say where it lives.',
  defaultSettings: {},
  requiresMidi: false,
  skillsCovered: () =>
    Array.from({ length: 12 }, (_, pc) => `${FIND_THE_NOTE_ID}:pc:${pc}`),
  generate,
  grade,
};
