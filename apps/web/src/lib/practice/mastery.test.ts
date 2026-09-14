import { describe, expect, it } from 'vitest';
import type { StoredAttempt } from '$lib/storage/db';
import {
  applyAttempt,
  deriveSkills,
  exerciseMastery,
  initialSkill,
  isWeak,
  MASTERY_ALPHA,
  WEAK_MIN_ATTEMPTS,
} from './mastery';
import { FIRST_INTERVAL_DAYS } from './scheduler';

const DAY = 24 * 60 * 60 * 1000;

function attempt(overrides: Partial<StoredAttempt> = {}): StoredAttempt {
  return {
    attemptId: '1700000000000:q1',
    questionId: 'q1',
    ts: 1_700_000_000_000,
    exerciseId: 'find-the-note',
    skillId: 'find-the-note:pc:0',
    seed: 1,
    correct: true,
    score: 1,
    responseMs: 800,
    replays: 0,
    answerSource: 'onscreen',
    ...overrides,
  };
}

describe('applyAttempt', () => {
  it('creates the skill on its first attempt', () => {
    const state = applyAttempt(null, attempt());
    expect(state.skillId).toBe('find-the-note:pc:0');
    expect(state.exerciseId).toBe('find-the-note');
    expect(state.reps).toBe(1);
    expect(state.lapses).toBe(0);
    expect(state.mastery).toBeCloseTo(MASTERY_ALPHA);
    expect(state.lastSeenAt).toBe(attempt().ts);
  });

  it('is an EWMA — one lucky answer is not mastery', () => {
    let state = applyAttempt(null, attempt());
    for (let i = 0; i < 4; i += 1) state = applyAttempt(state, attempt());
    // 1 - 0.7^5
    expect(state.mastery).toBeCloseTo(0.832, 3);
    expect(state.reps).toBe(5);
  });

  it('moves down on a miss and counts the lapse', () => {
    const solid = { ...initialSkill('s', 'e'), mastery: 0.8, reps: 9 };
    const state = applyAttempt(solid, attempt({ correct: false, score: 0 }));
    expect(state.mastery).toBeCloseTo(0.56);
    expect(state.lapses).toBe(1);
    expect(state.reps).toBe(10);
  });

  it('gives partial credit its weight (the right note, wrong octave)', () => {
    const state = applyAttempt(null, attempt({ correct: false, score: 0.5 }));
    expect(state.mastery).toBeCloseTo(0.15);
  });

  it('schedules the skill as it folds the attempt in (slice 9a)', () => {
    const state = applyAttempt(null, attempt());
    expect(state.easiness).toBeCloseTo(2.6, 10);
    expect(state.intervalDays).toBe(FIRST_INTERVAL_DAYS);
    // Scheduled from the attempt's own timestamp, so a replay of the log
    // reproduces it (ADR 0002 §3's trap).
    expect(state.dueAt).toBe(state.lastSeenAt + 10 * 60_000);
  });

  it('a miss makes the skill due immediately and costs easiness', () => {
    const solid = {
      ...initialSkill('s', 'e'),
      reps: 4,
      easiness: 2.6,
      intervalDays: 12,
      dueAt: 1,
    };
    const state = applyAttempt(
      solid,
      attempt({ correct: false, score: 0, ts: 5_000 }),
    );
    expect(state.intervalDays).toBe(0);
    expect(state.dueAt).toBe(5_000);
    expect(state.easiness).toBeCloseTo(2.4, 10);
  });

  it('replaying the log twice gives the same schedule', () => {
    const log = [
      attempt({ questionId: 'a', ts: 1_000 }),
      attempt({ questionId: 'b', ts: 2_000, correct: false, score: 0 }),
      attempt({ questionId: 'c', ts: 3_000 }),
    ];
    const once = deriveSkills(log).get('find-the-note:pc:0');
    const twice = deriveSkills([...log].reverse()).get('find-the-note:pc:0');
    expect(twice).toEqual(once);
    expect(once?.dueAt).toBe(3_000 + 10 * 60_000);
  });
});

describe('deriveSkills', () => {
  it('rebuilds every skill from the log, oldest attempt first', () => {
    const skills = deriveSkills([
      attempt({ questionId: 'b', ts: 2_000, score: 0, correct: false }),
      attempt({ questionId: 'a', ts: 1_000 }),
      attempt({ questionId: 'c', ts: 3_000, skillId: 'find-the-note:pc:5' }),
    ]);
    expect(skills.get('find-the-note:pc:0')?.reps).toBe(2);
    // Correct then wrong: 0.3 → 0.21, not the other way round.
    expect(skills.get('find-the-note:pc:0')?.mastery).toBeCloseTo(0.21);
    expect(skills.get('find-the-note:pc:5')?.reps).toBe(1);
  });
});

describe('isWeak', () => {
  it('needs both a low mastery and enough evidence', () => {
    const weak = {
      ...initialSkill('s', 'e'),
      mastery: 0.2,
      reps: WEAK_MIN_ATTEMPTS,
    };
    expect(isWeak(weak)).toBe(true);
    expect(isWeak({ ...weak, reps: WEAK_MIN_ATTEMPTS - 1 })).toBe(false);
    expect(isWeak({ ...weak, mastery: 0.31 })).toBe(false);
  });
});

describe('exerciseMastery', () => {
  const skills = new Map([
    ['a', { ...initialSkill('a', 'e'), mastery: 0.8, reps: 4 }],
    ['b', { ...initialSkill('b', 'e'), mastery: 0.4, reps: 2 }],
  ]);

  it('is null while nothing in the exercise has been practised', () => {
    expect(exerciseMastery(['a', 'b'], new Map())).toBeNull();
    expect(exerciseMastery([], skills)).toBeNull();
  });

  it('averages over every skill, so one solid pitch is not 100%', () => {
    expect(exerciseMastery(['a', 'b', 'c', 'd'], skills)).toBeCloseTo(0.3);
    expect(exerciseMastery(['a', 'b'], skills)).toBeCloseTo(0.6);
  });

  it('ignores a record that exists but has no attempts', () => {
    const unseen = new Map([['a', initialSkill('a', 'e')]]);
    expect(exerciseMastery(['a'], unseen)).toBeNull();
  });
});

describe('timestamps', () => {
  it('never moves `lastSeenAt` backwards', () => {
    const later = applyAttempt(null, attempt({ ts: 5 * DAY }));
    const earlier = applyAttempt(later, attempt({ ts: DAY }));
    expect(earlier.lastSeenAt).toBe(5 * DAY);
  });
});
