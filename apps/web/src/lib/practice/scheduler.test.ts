import { describe, expect, it } from 'vitest';
import { DEFAULT_EASINESS, type SkillState } from '$lib/storage/db';
import { initialSkill } from './mastery';
import {
  DAY_MS,
  EASINESS_BONUS,
  EASINESS_PENALTY,
  FIRST_INTERVAL_DAYS,
  isDue,
  MAX_EASINESS,
  MAX_INTERVAL_DAYS,
  MIN_EASINESS,
  msUntilDue,
  nextIntervalDays,
  overdueBy,
  review,
  SECOND_INTERVAL_DAYS,
} from './scheduler';

const T0 = Date.UTC(2026, 8, 14, 10, 0, 0);

function schedule(
  easiness = DEFAULT_EASINESS,
  intervalDays = 0,
  dueAt = 0,
): { easiness: number; intervalDays: number; dueAt: number } {
  return { easiness, intervalDays, dueAt };
}

function practised(over: Partial<SkillState> = {}): SkillState {
  return { ...initialSkill('s', 'e'), reps: 3, ...over };
}

describe('nextIntervalDays — the ladder', () => {
  it('starts inside the session, then goes to tomorrow', () => {
    expect(nextIntervalDays(0, DEFAULT_EASINESS)).toBe(FIRST_INTERVAL_DAYS);
    expect(nextIntervalDays(FIRST_INTERVAL_DAYS, DEFAULT_EASINESS)).toBe(
      SECOND_INTERVAL_DAYS,
    );
  });

  it('multiplies by easiness from the second rung on', () => {
    expect(nextIntervalDays(1, 2.5)).toBeCloseTo(2.5, 10);
    expect(nextIntervalDays(2.5, 2.6)).toBeCloseTo(6.5, 10);
  });

  it('clamps at half a year', () => {
    expect(nextIntervalDays(MAX_INTERVAL_DAYS, MAX_EASINESS)).toBe(
      MAX_INTERVAL_DAYS,
    );
    expect(nextIntervalDays(10_000, 2)).toBe(MAX_INTERVAL_DAYS);
  });

  it('treats a nonsense interval as the first rung', () => {
    expect(nextIntervalDays(-3, DEFAULT_EASINESS)).toBe(FIRST_INTERVAL_DAYS);
    expect(nextIntervalDays(Number.NaN, DEFAULT_EASINESS)).toBe(
      FIRST_INTERVAL_DAYS,
    );
  });
});

describe('review — the clock is injected', () => {
  it('schedules a first pass ten minutes out, from the time passed in', () => {
    const next = review(schedule(), { correct: true, at: T0 });
    expect(next.intervalDays).toBe(FIRST_INTERVAL_DAYS);
    expect(next.dueAt).toBe(T0 + 10 * 60 * 1000);
    expect(next.easiness).toBeCloseTo(DEFAULT_EASINESS + EASINESS_BONUS, 10);

    // Same state, a different clock: only `dueAt` moves.
    const later = review(schedule(), { correct: true, at: T0 + DAY_MS });
    expect(later.dueAt).toBe(next.dueAt + DAY_MS);
    expect(later.intervalDays).toBe(next.intervalDays);
  });

  it('climbs on a run of passes', () => {
    let state = schedule();
    const days: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      state = review(state, { correct: true, at: T0 + i * DAY_MS });
      days.push(state.intervalDays);
    }
    expect(days[0]).toBe(FIRST_INTERVAL_DAYS);
    expect(days[1]).toBe(SECOND_INTERVAL_DAYS);
    expect(days[2]).toBeGreaterThan(days[1]);
    expect(days[3]).toBeGreaterThan(days[2]);
    // Five passes would be 3.0; the cap holds it at 2.8.
    expect(state.easiness).toBe(MAX_EASINESS);
  });

  it('a miss collapses the interval and makes the skill due now', () => {
    const solid = schedule(2.6, 30, T0);
    const next = review(solid, { correct: false, at: T0 + DAY_MS });
    expect(next.intervalDays).toBe(0);
    expect(next.dueAt).toBe(T0 + DAY_MS);
    expect(next.easiness).toBeCloseTo(2.6 - EASINESS_PENALTY, 10);
  });

  it('a pass after a miss relearns from the first rung', () => {
    const lapsed = review(schedule(2.5, 30, T0), { correct: false, at: T0 });
    const relearn = review(lapsed, { correct: true, at: T0 + 60_000 });
    expect(relearn.intervalDays).toBe(FIRST_INTERVAL_DAYS);
  });

  it('clamps easiness at both ends', () => {
    let state = schedule();
    for (let i = 0; i < 20; i += 1) {
      state = review(state, { correct: false, at: T0 + i });
    }
    expect(state.easiness).toBe(MIN_EASINESS);
    for (let i = 0; i < 40; i += 1) {
      state = review(state, { correct: true, at: T0 + i });
    }
    expect(state.easiness).toBe(MAX_EASINESS);
  });

  it('repairs a hand-edited easiness before using it', () => {
    const next = review(schedule(Number.NaN, 1, 0), {
      correct: true,
      at: T0,
    });
    expect(next.easiness).toBe(MAX_EASINESS);
    expect(Number.isFinite(next.dueAt)).toBe(true);
  });
});

describe('isDue / overdueBy / msUntilDue', () => {
  it('a never-practised skill is new, not due', () => {
    const fresh = initialSkill('s', 'e');
    expect(isDue(fresh, T0)).toBe(false);
    expect(msUntilDue(fresh, T0)).toBeNull();
    expect(overdueBy(fresh, T0)).toBe(0);
  });

  it('is due from the instant the schedule comes round', () => {
    const state = practised({ dueAt: T0 });
    expect(isDue(state, T0 - 1)).toBe(false);
    expect(isDue(state, T0)).toBe(true);
    expect(overdueBy(state, T0 + 5_000)).toBe(5_000);
    expect(msUntilDue(state, T0 - 5_000)).toBe(5_000);
  });

  it('ignores a schedule on a record with no attempts behind it', () => {
    // An imported skill record (slice 5b) can carry a due date and no log.
    const imported = practised({ reps: 0, dueAt: T0 - DAY_MS });
    expect(isDue(imported, T0)).toBe(false);
  });
});
