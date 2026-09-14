import { describe, expect, it } from 'vitest';
import type { SkillState } from '$lib/storage/db';
import { initialSkill } from './mastery';
import { buildPlan, type PlannerExercise } from './planner';
import { DAY_MS } from './scheduler';
import {
  buildSessionQueue,
  isSessionLength,
  SessionCursor,
  sessionTargets,
  summariseSession,
  SUMMARY_MAX_ROWS,
  type SessionLabels,
  type SessionTally,
} from './session';

const NOW = Date.UTC(2026, 8, 14, 12, 0, 0);

const EXERCISES: PlannerExercise[] = [
  { id: 'notes', skillIds: ['notes:a', 'notes:b'] },
  { id: 'intervals', skillIds: ['intervals:a', 'intervals:b'] },
  { id: 'chords', skillIds: ['chords:a'] },
];

function skill(over: Partial<SkillState> & { skillId: string }): SkillState {
  return {
    ...initialSkill(over.skillId, over.exerciseId ?? 'notes'),
    reps: 3,
    mastery: 0.8,
    ...over,
  };
}

function map(...skills: SkillState[]): Map<string, SkillState> {
  return new Map(skills.map((item) => [item.skillId, item]));
}

describe('buildSessionQueue', () => {
  it('opens on the planner’s own first pick', () => {
    const plan = buildPlan(
      EXERCISES,
      map(
        skill({
          skillId: 'intervals:b',
          exerciseId: 'intervals',
          dueAt: NOW - DAY_MS,
        }),
      ),
      NOW,
    );
    const queue = buildSessionQueue(plan);
    expect(plan.pick?.skillId).toBe('intervals:b');
    expect(queue[0]).toEqual({
      exerciseId: 'intervals',
      skillId: 'intervals:b',
      reason: 'overdue',
    });
  });

  it('mixes the exercises and never asks the same one twice in a row', () => {
    const queue = buildSessionQueue(buildPlan(EXERCISES, new Map(), NOW));
    // Every skill of every exercise is in the session, exactly once.
    expect(queue).toHaveLength(5);
    expect(new Set(queue.map((item) => item.skillId)).size).toBe(5);
    expect(new Set(queue.map((item) => item.exerciseId)).size).toBe(3);
    // The one rule: never the same exercise twice running, while another one
    // still has something to offer. Here `chords` runs out first, so the tail
    // is the two that are left — alternating.
    for (const [index, item] of queue.entries()) {
      if (index === 0) continue;
      expect(item.exerciseId).not.toBe(queue[index - 1]!.exerciseId);
    }
  });

  it('keeps the planner’s tiers inside an exercise', () => {
    const plan = buildPlan(
      EXERCISES,
      map(
        skill({ skillId: 'notes:b', dueAt: NOW - DAY_MS }),
        skill({ skillId: 'notes:a', mastery: 0.1, dueAt: NOW + DAY_MS }),
      ),
      NOW,
    );
    const ours = buildSessionQueue(plan)
      .filter((item) => item.exerciseId === 'notes')
      .map((item) => item.skillId);
    // Overdue before weak before new — the order `buildPlan` decided.
    expect(ours).toEqual(['notes:b', 'notes:a']);
  });

  it('is a one-exercise session when only one exercise owes anything', () => {
    const queue = buildSessionQueue(buildPlan([EXERCISES[0]!], new Map(), NOW));
    expect(queue.map((item) => item.skillId)).toEqual(['notes:a', 'notes:b']);
  });

  it('is empty when there is nothing to practise at all', () => {
    expect(buildSessionQueue(buildPlan([], new Map(), NOW))).toEqual([]);
  });
});

describe('SessionCursor', () => {
  it('cycles, so a short queue still fills a long session', () => {
    const cursor = new SessionCursor([
      { exerciseId: 'notes', skillId: 'notes:a', reason: 'new' },
      { exerciseId: 'intervals', skillId: 'intervals:a', reason: 'new' },
    ]);
    expect(cursor.peek()?.skillId).toBe('notes:a');
    expect(cursor.next()?.skillId).toBe('notes:a');
    expect(cursor.next()?.skillId).toBe('intervals:a');
    expect(cursor.next()?.skillId).toBe('notes:a');
    expect(cursor.length).toBe(2);
  });

  it('has nothing to give when the plan was empty', () => {
    const cursor = new SessionCursor([]);
    expect(cursor.peek()).toBeNull();
    expect(cursor.next()).toBeNull();
  });
});

describe('sessionTargets', () => {
  it('puts the item’s own skill first, then the rest its exercise owes', () => {
    const plan = buildPlan(
      EXERCISES,
      map(
        skill({ skillId: 'notes:a', dueAt: NOW - DAY_MS }),
        skill({ skillId: 'notes:b', mastery: 0.05, dueAt: NOW + DAY_MS }),
      ),
      NOW,
    );
    expect(
      sessionTargets(plan, {
        exerciseId: 'notes',
        skillId: 'notes:b',
        reason: 'weak',
      }),
    ).toEqual(['notes:b', 'notes:a']);
  });

  it('falls back to the exercise’s own skills when nothing is owed', () => {
    const plan = buildPlan(EXERCISES, new Map(), NOW);
    expect(
      sessionTargets(plan, {
        exerciseId: 'chords',
        skillId: 'chords:a',
        reason: 'new',
      }),
    ).toEqual(['chords:a']);
  });
});

describe('isSessionLength', () => {
  it('accepts only the three the spec offers', () => {
    expect(isSessionLength(10)).toBe(true);
    expect(isSessionLength(7)).toBe(false);
    expect(isSessionLength('10')).toBe(false);
  });
});

const LABELS: SessionLabels = {
  skillLabel: (skillId) => skillId.split(':').pop() ?? skillId,
  exerciseTitle: (exerciseId) => exerciseId.toUpperCase(),
};

function tally(over: Partial<SessionTally> = {}): SessionTally {
  return {
    elapsedMs: 604_000,
    answers: 0,
    correct: 0,
    bestStreak: 0,
    skills: [],
    ...over,
  };
}

describe('summariseSession', () => {
  it('reports the session’s own numbers', () => {
    const summary = summariseSession(
      tally({ answers: 9, correct: 6, bestStreak: 4 }),
      LABELS,
    );
    expect(summary.answers).toBe(9);
    expect(summary.correct).toBe(6);
    expect(summary.accuracy).toBeCloseTo(6 / 9);
    expect(summary.bestStreak).toBe(4);
    expect(summary.elapsedMs).toBe(604_000);
  });

  it('answers nothing without dividing by zero', () => {
    const summary = summariseSession(tally(), LABELS);
    expect(summary.accuracy).toBe(0);
    expect(summary.rows).toEqual([]);
    expect(summary.weakest).toBeNull();
  });

  it('sorts rows by |delta| and names them through the exercise', () => {
    const summary = summariseSession(
      tally({
        answers: 4,
        correct: 2,
        skills: [
          {
            skillId: 'notes:a',
            exerciseId: 'notes',
            attempts: 2,
            correct: 2,
            masteryBefore: 0.5,
            masteryAfter: 0.56,
          },
          {
            skillId: 'intervals:a',
            exerciseId: 'intervals',
            attempts: 2,
            correct: 0,
            masteryBefore: 0.6,
            masteryAfter: 0.29,
          },
        ],
      }),
      LABELS,
    );
    expect(summary.rows.map((row) => row.skillId)).toEqual([
      'intervals:a',
      'notes:a',
    ]);
    expect(summary.rows[0]).toMatchObject({
      label: 'a',
      exerciseTitle: 'INTERVALS',
      deltaPercent: -31,
      direction: 'down',
    });
    expect(summary.rows[1]).toMatchObject({ deltaPercent: 6, direction: 'up' });
  });

  it('reads a first-ever attempt as a rise from zero, not as no change', () => {
    const summary = summariseSession(
      tally({
        answers: 1,
        correct: 1,
        skills: [
          {
            skillId: 'chords:a',
            exerciseId: 'chords',
            attempts: 1,
            correct: 1,
            masteryBefore: null,
            masteryAfter: 0.3,
          },
        ],
      }),
      LABELS,
    );
    expect(summary.rows[0]).toMatchObject({
      deltaPercent: 30,
      direction: 'up',
    });
  });

  it('shows at most six rows', () => {
    const summary = summariseSession(
      tally({
        skills: Array.from({ length: 9 }, (_, index) => ({
          skillId: `notes:${index}`,
          exerciseId: 'notes',
          attempts: 1,
          correct: 1,
          masteryBefore: 0,
          masteryAfter: (index + 1) / 100,
        })),
      }),
      LABELS,
    );
    expect(summary.rows).toHaveLength(SUMMARY_MAX_ROWS);
    // The six that moved most, biggest first.
    expect(summary.rows.map((row) => row.deltaPercent)).toEqual([
      9, 8, 7, 6, 5, 4,
    ]);
  });

  it('names the weakest skill of the session, with its score', () => {
    const summary = summariseSession(
      tally({
        answers: 12,
        correct: 7,
        skills: [
          {
            skillId: 'notes:a',
            exerciseId: 'notes',
            attempts: 3,
            correct: 3,
            masteryBefore: 0.4,
            masteryAfter: 0.6,
          },
          {
            skillId: 'intervals:a',
            exerciseId: 'intervals',
            attempts: 9,
            correct: 4,
            masteryBefore: 0.5,
            masteryAfter: 0.4,
          },
        ],
      }),
      LABELS,
    );
    expect(summary.weakest).toEqual({
      label: 'a',
      correct: 4,
      attempts: 9,
    });
  });

  it('breaks a tie on the weakest towards the one asked most', () => {
    const summary = summariseSession(
      tally({
        skills: [
          {
            skillId: 'notes:a',
            exerciseId: 'notes',
            attempts: 2,
            correct: 1,
            masteryBefore: 0,
            masteryAfter: 0.3,
          },
          {
            skillId: 'intervals:a',
            exerciseId: 'intervals',
            attempts: 6,
            correct: 3,
            masteryBefore: 0,
            masteryAfter: 0.3,
          },
        ],
      }),
      LABELS,
    );
    expect(summary.weakest?.attempts).toBe(6);
  });
});
