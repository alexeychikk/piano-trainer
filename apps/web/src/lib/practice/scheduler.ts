/**
 * When a skill comes back — the spaced-repetition half of ADR 0001 §6, which
 * ADR 0002 §3 parked until this slice (9a). Pure, with the review time passed
 * in: nothing here reads a clock, so a schedule is a function of the attempt
 * log and can be replayed (see `mastery.ts#applyAttempt`, which folds `review`
 * in exactly so the schedule survives a reload).
 *
 * **SM-2-lite.** Classic SM-2 with the quality grades collapsed to pass/fail,
 * because that is all an ear drill reports (ADR §10: scoring is binary) and a
 * 0..5 self-rating is a question this app never asks:
 *
 * - pass → `easiness += 0.1` (capped), and the interval climbs the ladder
 *   below.
 * - fail → `easiness -= 0.2` (floored), the interval collapses to 0 and the
 *   skill is **due immediately**, so a miss comes back inside the session.
 *
 * The ladder's first rung is **10 minutes**, not SM-2's one day: hearing a
 * minor 6th correctly once is not learning it, and the drill the user is
 * already sitting at is the cheapest place to ask again. From the second rung
 * on it is ordinary SM-2 (`interval × easiness`).
 *
 * `score` (partial credit) deliberately does **not** enter here: it drives
 * mastery (ADR 0002 §2), and for scheduling a half-right answer — the right
 * pitch class in the wrong octave — is a failure of recall, not half of one.
 */

import type { SkillState } from '$lib/storage/db';

export const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;

/** SM-2's floor: a skill can get hard, but never infinitely hard. */
export const MIN_EASINESS = 1.3;
/** And a ceiling, so one lucky run cannot push a skill a year out. */
export const MAX_EASINESS = 2.8;
/** What a pass adds to easiness. */
export const EASINESS_BONUS = 0.1;
/** What a miss costs — twice the bonus, so a lapse is felt. */
export const EASINESS_PENALTY = 0.2;

/** First rung: the same session, ten minutes later. */
export const FIRST_INTERVAL_DAYS = 10 / MINUTES_PER_DAY;
/** Second rung: tomorrow. From here on the easiness factor multiplies. */
export const SECOND_INTERVAL_DAYS = 1;
/** No skill is ever more than half a year away — this is a beginner's app. */
export const MAX_INTERVAL_DAYS = 180;

/** The three scheduling fields of a `SkillState`, and nothing else. */
export type SkillSchedule = Pick<
  SkillState,
  'easiness' | 'intervalDays' | 'dueAt'
>;

export function clampEasiness(easiness: number): number {
  if (!Number.isFinite(easiness)) return MAX_EASINESS;
  return Math.min(MAX_EASINESS, Math.max(MIN_EASINESS, easiness));
}

/**
 * The next interval after a pass, in days. Pure in `(intervalDays, easiness)`,
 * so the ladder is one testable expression:
 * `0 → 10 min → 1 day → × easiness`, clamped at `MAX_INTERVAL_DAYS`.
 */
export function nextIntervalDays(
  intervalDays: number,
  easiness: number,
): number {
  if (!(intervalDays > 0)) return FIRST_INTERVAL_DAYS;
  if (intervalDays < SECOND_INTERVAL_DAYS) return SECOND_INTERVAL_DAYS;
  return Math.min(MAX_INTERVAL_DAYS, intervalDays * clampEasiness(easiness));
}

export interface ReviewInput {
  /** Pass or fail — the grade's `correct`, never its `score`. */
  correct: boolean;
  /** When the review happened (epoch ms). The injected clock. */
  at: number;
}

/**
 * Schedule the next review of a skill. `state` is the schedule as it stands (a
 * never-practised skill passes its defaults, `intervalDays: 0`).
 *
 * A miss returns `dueAt === at`: due *now*, not overdue — the planner's
 * "overdue by" then grows from the moment of the miss, which is what puts a
 * fumbled skill at the top of the list for the rest of the session.
 */
export function review(
  state: SkillSchedule,
  input: ReviewInput,
): SkillSchedule {
  const easiness = clampEasiness(
    clampEasiness(state.easiness) +
      (input.correct ? EASINESS_BONUS : -EASINESS_PENALTY),
  );
  const intervalDays = input.correct
    ? nextIntervalDays(state.intervalDays, easiness)
    : 0;
  return {
    easiness,
    intervalDays,
    dueAt: input.at + intervalDays * DAY_MS,
  };
}

/**
 * Is this skill asking to be practised? A skill with no attempts behind it is
 * `new`, not due (UX §6.2) — a fresh install owes the user nothing, and
 * "36 due" on day one is a lie about a schedule that does not exist yet.
 */
export function isDue(state: SkillState, now: number): boolean {
  return state.reps > 0 && state.dueAt > 0 && state.dueAt <= now;
}

/** How long a skill has been waiting, in ms; `0` when it is not due yet. */
export function overdueBy(state: SkillState, now: number): number {
  if (!isDue(state, now)) return 0;
  return Math.max(0, now - state.dueAt);
}

/** Milliseconds until the next review, or `null` for an unscheduled skill. */
export function msUntilDue(state: SkillState, now: number): number | null {
  if (state.reps === 0 || state.dueAt <= 0) return null;
  return state.dueAt - now;
}
