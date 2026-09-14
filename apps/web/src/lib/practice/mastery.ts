/**
 * How an attempt moves a skill's mastery (ADR §6: `mastery` is an EWMA of
 * recent scores, 0..1 — the number every pip row and percentage shows).
 *
 * Pure, so the progress screen and — from slice 9 — the planner agree on what
 * "getting better" means without a browser in the loop.
 *
 * **Spaced repetition is not here.** ADR §6 puts `review()` in
 * `$lib/practice/scheduler.ts` and the delivery plan puts it in slice 9; this
 * module only keeps the SM-2 fields at their defaults so the record shape (and
 * therefore the export format) already has room for them.
 */

import {
  DEFAULT_EASINESS,
  type SkillState,
  type StoredAttempt,
} from '$lib/storage/db';

/**
 * EWMA weight of the newest score. 0.3 means one lucky answer cannot mark a
 * skill solid (a first correct lands at 30 %, five in a row at 83 %) and one
 * fumble on a known skill does not wipe it out — mastery is a trend, and the
 * 7 pips quantise it so small wiggles do not read as progress (UX §6.2).
 */
export const MASTERY_ALPHA = 0.3;

/** What a skill looks like before its first attempt — mastery starts at 0. */
export function initialSkill(skillId: string, exerciseId: string): SkillState {
  return {
    skillId,
    exerciseId,
    reps: 0,
    lapses: 0,
    easiness: DEFAULT_EASINESS,
    intervalDays: 0,
    dueAt: 0,
    mastery: 0,
    lastSeenAt: 0,
  };
}

/**
 * Fold one attempt into a skill's state. `null` means the skill has never been
 * practised, which is a different thing from mastery 0 (UX §6.2 renders it as
 * the word `new`) — so the first attempt creates the record.
 */
export function applyAttempt(
  state: SkillState | null,
  attempt: StoredAttempt,
): SkillState {
  const base = state ?? initialSkill(attempt.skillId, attempt.exerciseId);
  const score = Math.min(1, Math.max(0, attempt.score));
  return {
    ...base,
    exerciseId: attempt.exerciseId || base.exerciseId,
    reps: base.reps + 1,
    lapses: base.lapses + (attempt.correct ? 0 : 1),
    mastery: base.mastery + MASTERY_ALPHA * (score - base.mastery),
    lastSeenAt: Math.max(base.lastSeenAt, attempt.ts),
  };
}

/** Rebuild every skill from the attempt log — the recovery path, in order. */
export function deriveSkills(
  attempts: readonly StoredAttempt[],
): Map<string, SkillState> {
  const skills = new Map<string, SkillState>();
  for (const attempt of [...attempts].sort((a, b) => a.ts - b.ts)) {
    skills.set(
      attempt.skillId,
      applyAttempt(skills.get(attempt.skillId) ?? null, attempt),
    );
  }
  return skills;
}

/** Mastery below this, with enough evidence, is the `!` "fix this" signal. */
export const WEAK_MASTERY = 0.3;
/** How many attempts a skill needs before `!` is fair (UX §6.1). */
export const WEAK_MIN_ATTEMPTS = 3;

export function isWeak(state: SkillState): boolean {
  return state.mastery < WEAK_MASTERY && state.reps >= WEAK_MIN_ATTEMPTS;
}

/**
 * One number for a whole exercise — the mean mastery over the skills it
 * covers, counting an unpractised skill as 0 so a card cannot claim 100 %
 * after one pitch class. `null` when nothing in it has been practised at all.
 */
export function exerciseMastery(
  skillIds: readonly string[],
  skills: ReadonlyMap<string, SkillState>,
): number | null {
  if (skillIds.length === 0) return null;
  let total = 0;
  let seen = 0;
  for (const skillId of skillIds) {
    const state = skills.get(skillId);
    if (!state || state.reps === 0) continue;
    total += state.mastery;
    seen += 1;
  }
  if (seen === 0) return null;
  return total / skillIds.length;
}
