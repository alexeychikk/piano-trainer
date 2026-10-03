/**
 * The RNG-consumption guard. Question ids and seeds are logged with every
 * attempt, so a question must stay reproducible from `(exerciseId, seed,
 * settings, range, history, target)` across refactors: the same seed has to
 * draw the same question, byte for byte.
 *
 * This snapshot records, for every registered exercise on several keyboards,
 * fifty questions generated the way the runner generates them — fixed seeds,
 * the previous questions as history (so the redraw-avoiding-repeat loop
 * runs), and now and then a planner target, an unbuildable target and a
 * foreign one (so `buildableTarget` runs). Each line is `id skillId`; each
 * block ends with a digest of the full questions (prompt, playback, reveal,
 * expected answer, spellings), so a change to anything a user would see or
 * hear fails it too.
 *
 * **Never update this snapshot to make a refactor pass.** A diff here means
 * the refactor changed which question a logged seed draws. Only a deliberate
 * change to an exercise's questions — called out in its pull request — may
 * re-record it.
 */

import { describe, expect, it } from 'vitest';
import { coveredSkills } from './coverage';
import { EXERCISES } from './registry';
import { mulberry32 } from './rng';
import type { AnyExercise, KeyRange, Question, SkillId } from './types';

const QUESTIONS = 50;
/** The runner's own history depth (`HISTORY_LENGTH` in `runner.svelte.ts`). */
const HISTORY = 8;

/** The default instrument, a two-octave keyboard and two narrow ones. */
const RANGES: readonly KeyRange[] = [
  { low: 36, high: 96 },
  { low: 48, high: 72 },
  { low: 60, high: 79 },
  { low: 60, high: 72 },
];

/**
 * `cyrb53` — a 53-bit string hash, enough to notice that a question changed.
 * Not `node:crypto`: Vitest resolves the `browser` condition here.
 */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function serialise(question: Question): string {
  return JSON.stringify(question, (_key, value: unknown) =>
    value instanceof Map ? [...value.entries()] : value,
  );
}

function run(exercise: AnyExercise, range: KeyRange): string[] {
  const seeds = mulberry32(0x5eed);
  const covered = coveredSkills(exercise, range);
  const recent: SkillId[] = [];
  const lines: string[] = [];
  const questions: string[] = [];

  for (let i = 0; i < QUESTIONS; i += 1) {
    const seed = Math.floor(seeds() * 0x100000000) >>> 0;
    let targetSkillId: SkillId | undefined;
    if (i % 5 === 4 && covered.length > 0)
      targetSkillId = covered[(i * 7) % covered.length];
    else if (i % 11 === 10) targetSkillId = 'find-the-note:pc:3';
    else if (i % 13 === 12) targetSkillId = `${exercise.id}:constructor:0`;

    let question: Question;
    try {
      question = exercise.generate({
        settings: exercise.defaultSettings,
        rng: mulberry32(seed),
        seed,
        range,
        targetSkillId,
        history: { recentSkillIds: [...recent] },
      });
    } catch (error) {
      lines.push(`${seed} throws ${(error as Error).name}`);
      continue;
    }
    lines.push(`${question.id} ${question.skillId}`);
    questions.push(serialise(question));
    recent.unshift(question.skillId);
    recent.length = Math.min(recent.length, HISTORY);
  }
  lines.push(`digest ${hash(questions.join('\n'))}`);
  return lines;
}

describe('seeded questions are reproducible', () => {
  for (const exercise of EXERCISES) {
    for (const range of RANGES) {
      it(`${exercise.id} on ${range.low}–${range.high}`, () => {
        expect(run(exercise, range)).toMatchSnapshot();
      });
    }
  }
});
