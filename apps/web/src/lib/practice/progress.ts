/**
 * Everything `/progress` shows, computed from the attempt log and the skill
 * records — pure, so the screen is markup and this is what the tests exercise
 * (UX spec §6.1: *am I practising?*, *what is solid?*, *what should I fix?*).
 *
 * Days are **local** days: "practised today" means what the clock on the wall
 * says, not UTC.
 */

import type { SkillState, StoredAttempt } from '$lib/storage/db';
import { exerciseMastery, isWeak } from './mastery';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** The strip under the counters (UX §6.1: `last 28 days`). */
export const STRIP_DAYS = 28;
/** The headline accuracy window (UX §6.1: `84% accuracy (7d)`). */
export const ACCURACY_DAYS = 7;

/** Midnight at the start of the local day containing `ts`. */
export function startOfDay(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** How many local days ago `ts` was, relative to `now` (0 = today). */
export function daysAgo(ts: number, now: number): number {
  return Math.round((startOfDay(now) - startOfDay(ts)) / DAY_MS);
}

/**
 * Consecutive days of practice ending today — or ending yesterday, because a
 * streak is only broken once a whole day has gone by without practice.
 */
export function streakDays(
  attempts: readonly StoredAttempt[],
  now: number,
): number {
  const days = new Set(attempts.map((attempt) => daysAgo(attempt.ts, now)));
  if (days.size === 0) return 0;
  let day = days.has(0) ? 0 : 1;
  if (!days.has(day)) return 0;
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day += 1;
  }
  return streak;
}

/** Attempts per day, oldest first; the last entry is today. */
export function dailyCounts(
  attempts: readonly StoredAttempt[],
  now: number,
  days: number = STRIP_DAYS,
): number[] {
  const counts = new Array<number>(days).fill(0);
  for (const attempt of attempts) {
    const ago = daysAgo(attempt.ts, now);
    if (ago < 0 || ago >= days) continue;
    counts[days - 1 - ago] += 1;
  }
  return counts;
}

/** Counts scaled to 0..1 against the busiest day — the `Meter`'s input. */
export function normalise(counts: readonly number[]): number[] {
  const max = counts.reduce((a, b) => Math.max(a, b), 0);
  if (max === 0) return counts.map(() => 0);
  return counts.map((count) => count / max);
}

/** Share of correct answers in the window, or `null` without any attempts. */
export function accuracyOver(
  attempts: readonly StoredAttempt[],
  now: number,
  days: number = ACCURACY_DAYS,
): number | null {
  const window = attempts.filter((attempt) => {
    const ago = daysAgo(attempt.ts, now);
    return ago >= 0 && ago < days;
  });
  if (window.length === 0) return null;
  const correct = window.filter((attempt) => attempt.correct).length;
  return correct / window.length;
}

export interface PracticeTotals {
  attempts: number;
  streakDays: number;
  /** 0..1 over the last `ACCURACY_DAYS`, `null` when the window is empty. */
  accuracy7d: number | null;
  /** `STRIP_DAYS` bars, 0..1, oldest first. */
  strip: number[];
  /** Raw counts behind `strip`, for the accessible label. */
  stripCounts: number[];
}

export function summarise(
  attempts: readonly StoredAttempt[],
  now: number,
): PracticeTotals {
  const stripCounts = dailyCounts(attempts, now);
  return {
    attempts: attempts.length,
    streakDays: streakDays(attempts, now),
    accuracy7d: accuracyOver(attempts, now),
    strip: normalise(stripCounts),
    stripCounts,
  };
}

interface SkillTally {
  attempts: number;
  correct: number;
}

/** Attempts and hits per skill — the numbers in the hover detail line. */
export function tallyBySkill(
  attempts: readonly StoredAttempt[],
): Map<string, SkillTally> {
  const tallies = new Map<string, SkillTally>();
  for (const attempt of attempts) {
    const tally = tallies.get(attempt.skillId) ?? { attempts: 0, correct: 0 };
    tally.attempts += 1;
    if (attempt.correct) tally.correct += 1;
    tallies.set(attempt.skillId, tally);
  }
  return tallies;
}

/** `2 h ago` — the granularity of the detail line, not a clock. */
export function timeAgo(ts: number, now: number): string {
  const delta = Math.max(0, now - ts);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

export interface SkillCell {
  skillId: string;
  /** Abbreviated name — dense grids may abbreviate (copy deck §9). */
  label: string;
  /** 0..1, or `null` for a skill that has never been practised. */
  mastery: number | null;
  attempts: number;
  weak: boolean;
  /** `12 attempts · 67% · last seen 2 h ago`, or the unpractised line. */
  detail: string;
}

export interface ExerciseGroup {
  id: string;
  title: string;
  /** Mean mastery across the exercise's skills, `null` when none practised. */
  mastery: number | null;
  attempts: number;
  weakCount: number;
  cells: SkillCell[];
}

/**
 * What a skill is called when its exercise does not say (`skillLabel` is
 * optional): the id's last segment. Never the whole id — `/progress` shows
 * names, and an id is a name nobody chose.
 */
export function fallbackSkillLabel(skillId: string): string {
  const parts = skillId.split(':');
  return parts[parts.length - 1] || skillId;
}

export interface ExerciseInput {
  id: string;
  title: string;
  /** Every skill the exercise covers, in the order it wants them shown. */
  skillIds: readonly string[];
  /** How this exercise names one of its skills; ids are never shown raw. */
  label: (skillId: string) => string;
}

/**
 * One group per exercise, each with a cell per skill — covered skills in the
 * exercise's own order, then any stored skill it no longer lists (a renamed
 * or retired skill still has a history, and silently dropping it would make
 * the totals disagree with the cells).
 */
export function buildGroups(
  exercises: readonly ExerciseInput[],
  skills: ReadonlyMap<string, SkillState>,
  attempts: readonly StoredAttempt[],
  now: number,
): ExerciseGroup[] {
  const tallies = tallyBySkill(attempts);
  return exercises.map((exercise) => {
    const extras = [...skills.values()]
      .filter(
        (skill) =>
          skill.exerciseId === exercise.id &&
          !exercise.skillIds.includes(skill.skillId),
      )
      .map((skill) => skill.skillId)
      .sort();
    const skillIds = [...exercise.skillIds, ...extras];
    const cells = skillIds.map((skillId) =>
      buildCell(skillId, exercise.label(skillId), skills, tallies, now),
    );
    return {
      id: exercise.id,
      title: exercise.title,
      mastery: exerciseMastery(skillIds, skills),
      attempts: cells.reduce((total, cell) => total + cell.attempts, 0),
      weakCount: cells.filter((cell) => cell.weak).length,
      cells,
    };
  });
}

function buildCell(
  skillId: string,
  label: string,
  skills: ReadonlyMap<string, SkillState>,
  tallies: ReadonlyMap<string, SkillTally>,
  now: number,
): SkillCell {
  const state = skills.get(skillId);
  const tally = tallies.get(skillId) ?? { attempts: 0, correct: 0 };
  if (!state || state.reps === 0) {
    return {
      skillId,
      label,
      mastery: null,
      attempts: 0,
      weak: false,
      detail: 'Not practised yet',
    };
  }
  const accuracy = tally.attempts
    ? Math.round((tally.correct / tally.attempts) * 100)
    : 0;
  const plural = tally.attempts === 1 ? 'attempt' : 'attempts';
  return {
    skillId,
    label,
    mastery: state.mastery,
    attempts: tally.attempts,
    weak: isWeak(state),
    detail: `${tally.attempts} ${plural} · ${accuracy}% · last seen ${timeAgo(state.lastSeenAt, now)}`,
  };
}
