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

import {
  MIDDLE_C,
  midiToName,
  pcOf,
  type Midi,
  type PitchClass,
} from '$lib/theory';
import {
  NothingToAskError,
  buildableTarget,
  pitchClassesIn,
} from '../coverage';
import { randomInt } from '../rng';
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

/**
 * The name of the pitch class behind a skill id (`find-the-note:pc:3` → `Eb`),
 * for the progress grid — octave-less, because the skill is the pitch class in
 * any octave. An id this exercise does not recognise comes back unchanged.
 */
export function pitchClassName(skillId: string): string {
  const pc = parseSkillId(skillId);
  if (pc === null) return skillId;
  // Spelled from C4 and stripped of the octave: one spelling per pitch, the
  // same flats the prompt and the keyboard labels use.
  return spell(MIDDLE_C + pc).replace(/-?\d+$/, '');
}

/**
 * The pitch class a skill id names, or `null` for anything else — an id read
 * back is untrusted input.
 */
export function parseSkillId(skillId: SkillId): PitchClass | null {
  const segments = skillIdSegments(skillId, FIND_THE_NOTE_ID, 2);
  if (segments === null || segments[0] !== 'pc') return null;
  return pitchClassSegment(segments[1]);
}

/** The keys of `pc` on `range`, low to high. */
function occurrences(pc: PitchClass, range: KeyRange): Midi[] {
  const notes: Midi[] = [];
  for (
    let midi = range.low + ((pc - pcOf(range.low) + 12) % 12);
    midi <= range.high;
    midi += 12
  )
    notes.push(midi);
  return notes;
}

function generate(
  ctx: GenerateContext<FindTheNoteSettings>,
): Question<FindTheNotePayload> {
  const { low, high } = ctx.range;
  if (high < low) throw new NothingToAskError(FIND_THE_NOTE_ID);
  const recent = ctx.history.recentSkillIds;
  // The planner's target, asked exactly when the keyboard has that note: one
  // of its octaves, drawn like any other note.
  const target = buildableTarget(ctx.targetSkillId, parseSkillId, (pc) =>
    pitchClassesIn(low, high).includes(pc),
  );
  const targetNotes = target === null ? [] : occurrences(target, ctx.range);
  let midi =
    target === null
      ? randomInt(ctx.rng, low, high)
      : targetNotes[randomInt(ctx.rng, 0, targetNotes.length - 1)];
  // Redraw a few times rather than looping until different: asking the same
  // note twice in a row is dull, but forcing a change would bias the draw on a
  // narrow range (and could not terminate at all on a one-note one). A target
  // is never redrawn — the planner asked for it.
  for (
    let redraw = 0;
    target === null &&
    redraw < MAX_REDRAWS &&
    high > low &&
    recent[0] === skillIdFor(midi);
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
  // Every pitch class the keyboard has — all twelve on anything an octave wide.
  skillsCovered: (_settings, range) =>
    pitchClassesIn(range.low, range.high).map(
      (pc) => `${FIND_THE_NOTE_ID}:pc:${pc}`,
    ),
  skillLabel: (skillId) => pitchClassName(skillId),
  generate,
  grade,
};
