import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXERCISES } from '$lib/exercises/registry';
import { ExerciseRunner } from '$lib/exercises/runner.svelte';
import type { AttemptResult } from '$lib/exercises/types';
import { buildPlan } from './planner';
import { summariseSession } from './session';
import { SessionRun } from './session.svelte';

/** The engine is never touched here: the runner takes a stub `PlaybackApi`. */
vi.mock('smplr', () => ({ Soundfont: () => ({ ready: Promise.resolve() }) }));

const REGISTRY = EXERCISES.map((exercise) => ({
  id: exercise.id,
  skillIds: exercise.skillsCovered(exercise.defaultSettings),
}));

function freshRun(lengthMin: number, clock: () => number) {
  return new SessionRun({
    exercises: EXERCISES,
    plan: buildPlan(REGISTRY, new Map(), 0),
    lengthMin,
    now: clock,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SessionRun · the clock', () => {
  it('starts at the first question, not at the screen', () => {
    let clock = 1000;
    const run = freshRun(10, () => clock);
    expect(run.startedAt).toBeNull();
    expect(run.timeReadout).toBe('10:00');
    expect(run.shouldContinue()).toBe(true);

    run.pickExercise();
    clock += 61_000;
    run.tick();
    expect(run.timeReadout).toBe('8:59');
    expect(run.timeValue).toBeCloseTo(61 / 600);
  });

  it('is over when the length has run out, and stays over', () => {
    let clock = 0;
    const run = freshRun(5, () => clock);
    run.pickExercise();
    clock += 5 * 60_000;
    expect(run.shouldContinue()).toBe(false);
    run.end();
    expect(run.ended).toBe(true);
    // The clock stops at the end: a summary left open does not keep counting.
    clock += 60_000;
    run.tick();
    expect(run.timeReadout).toBe('0:00');
    expect(run.tally().elapsedMs).toBe(5 * 60_000);
  });
});

describe('SessionRun · through the real runner', () => {
  /**
   * The acceptance path, without a browser: the real exercises, the real
   * runner, a stub playback and a fake clock — so "mixed questions from more
   * than one exercise, every attempt logged" is a test and not a screenshot.
   */
  function drill(lengthMin: number) {
    let clock = 0;
    const run = freshRun(lengthMin, () => clock);
    const attempts: AttemptResult[] = [];
    const runner = new ExerciseRunner(run.first!, {
      playback: {
        play: () => 0,
        stop: () => {},
        ensureStarted: () => Promise.resolve(),
      },
      now: () => clock,
      range: () => ({ low: 36, high: 96 }),
      pickExercise: () => run.pickExercise(),
      shouldContinue: () => run.shouldContinue(),
      targetSkills: () => run.targetSkills(),
      onEnd: () => run.end(),
      onAttempt: (attempt) => {
        attempts.push(attempt);
        run.record(attempt, null, 0.3, runner.streak);
      },
    });
    return {
      run,
      runner,
      attempts,
      /** Answer whatever is on screen — six notes closes any answer mode. */
      answer(afterMs: number) {
        for (let note = 0; note < 6; note += 1) {
          runner.noteOn(60 + note, 'onscreen');
        }
        vi.advanceTimersByTime(2000);
        clock += afterMs;
        if (runner.phase === 'feedback') runner.advance();
        vi.advanceTimersByTime(0);
      },
    };
  }

  it('mixes every registered exercise and logs each answer against its own', async () => {
    const drilled = drill(5);
    await drilled.runner.start();
    vi.advanceTimersByTime(0);

    const seen: string[] = [];
    for (let i = 0; i < 8 && drilled.runner.phase !== 'summary'; i += 1) {
      seen.push(drilled.runner.definition.id);
      drilled.answer(1000);
    }

    // Round-robin: the four exercises, in registry order, one question each.
    expect(seen.slice(0, EXERCISES.length)).toEqual(
      EXERCISES.map((exercise) => exercise.id),
    );
    expect(drilled.attempts).toHaveLength(seen.length);
    for (const [index, attempt] of drilled.attempts.entries()) {
      expect(attempt.exerciseId).toBe(seen[index]);
      expect(attempt.skillId.startsWith(`${seen[index]}:`)).toBe(true);
    }
  });

  it('ends on the clock, between questions, and the summary counts what happened', async () => {
    const drilled = drill(5);
    await drilled.runner.start();
    vi.advanceTimersByTime(0);

    // Half a minute a question: the fifth answer runs the five minutes out.
    for (let i = 0; i < 12 && drilled.runner.phase !== 'summary'; i += 1) {
      drilled.answer(60_000);
    }

    expect(drilled.runner.phase).toBe('summary');
    expect(drilled.run.ended).toBe(true);
    const summary = summariseSession(drilled.run.tally(), {
      skillLabel: (skillId) => skillId,
      exerciseTitle: (exerciseId) => exerciseId,
    });
    expect(summary.answers).toBe(drilled.attempts.length);
    expect(summary.correct).toBe(
      drilled.attempts.filter((attempt) => attempt.correct).length,
    );
    expect(summary.rows.length).toBeGreaterThan(0);
    // A question in progress is never cut off, so the clock ends at or past
    // the length — `Session complete · 10:04` is the spec's own example.
    expect(summary.elapsedMs).toBeGreaterThanOrEqual(5 * 60_000);
    expect(summary.weakest).not.toBeNull();
  });
});
