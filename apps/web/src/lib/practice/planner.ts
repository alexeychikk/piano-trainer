/**
 * What to practise next — the pure selector over every skill the registry
 * knows about (slice 9a). `scheduler.ts` says *when* a skill is due; this says
 * *which* of the due ones to do first, and therefore which **exercise** home's
 * `Practice now` and `/progress`'s `Drill these` open.
 *
 * No clock, no storage, no Svelte: the screens pass `now` and the skill
 * records, and the same three tiers decide everything.
 *
 * **The order** (the ticket's, made precise):
 * 1. `overdue` — due and waiting, longest wait first. A missed skill is due
 *    from the moment it was missed (`scheduler.review`), so a fumble goes
 *    straight to the top and stays there until it is answered again.
 * 2. `weak` — `mastery < 0.3` with ≥ 3 attempts (the `!` marker) but not yet
 *    due: weakest first. Not "due" in the schedule's sense, but the honest
 *    answer to *what should I fix?* once the overdue queue is empty.
 * 3. `new` — never attempted, in the exercise's own order. Nothing is owed
 *    here, so it comes last; it is what a fresh install picks.
 *
 * A skill that is practised, not weak and not yet due is **absent**: it is
 * neither a reminder nor a gap, and padding the plan with it would make
 * `N due` meaningless.
 *
 * Ties always break on `skillId`, so the plan is deterministic — the same log
 * and the same clock give the same first pick on every screen and every load.
 */

import type { SkillState } from '$lib/storage/db';
import { isWeak } from './mastery';
import { isDue, overdueBy } from './scheduler';

/** Why a skill is in the plan — also the word the UI shows for it. */
export type PlanReason = 'overdue' | 'weak' | 'new';

export interface PlanItem {
  skillId: string;
  exerciseId: string;
  reason: PlanReason;
  /** 0..1, or `null` for a skill that has never been practised. */
  mastery: number | null;
  /** Epoch ms; `0` for a skill with no schedule yet. */
  dueAt: number;
  /** How long it has been waiting (ms); `0` unless `reason` is `overdue`. */
  overdueMs: number;
}

export interface ExercisePlan {
  id: string;
  items: PlanItem[];
  /**
   * What `N due` means on a card and a panel band: the skills asking for
   * attention *now* — overdue plus weak. Never-attempted skills are `new`,
   * not due (UX §6.2), so they are counted separately.
   */
  dueCount: number;
  unseenCount: number;
}

export interface PracticePlan {
  /** Every skill worth practising, in the order above. */
  items: PlanItem[];
  /** `overdue + weak`, across every exercise — `/progress`'s `DUE NOW`. */
  dueCount: number;
  byExercise: Map<string, ExercisePlan>;
  /** The head of `items`, or `null` when nothing is worth doing. */
  pick: PlanItem | null;
}

export interface PlannerExercise {
  id: string;
  /** Every skill the exercise covers, in the order it wants them shown. */
  skillIds: readonly string[];
}

const TIER: Record<PlanReason, number> = { overdue: 0, weak: 1, new: 2 };

/**
 * Build the plan. `exercises` is the registry's view (ids plus the skills each
 * one covers, in its own order); `skills` is the practice store's records.
 *
 * A stored skill whose exercise no longer lists it is still planned — it has a
 * history, and silently dropping it would make `N due` disagree with the cells
 * `/progress` shows (the same rule `buildGroups` follows for its extras).
 */
export function buildPlan(
  exercises: readonly PlannerExercise[],
  skills: ReadonlyMap<string, SkillState>,
  now: number,
): PracticePlan {
  const byExercise = new Map<string, ExercisePlan>();
  const items: PlanItem[] = [];

  for (const exercise of exercises) {
    const extras = [...skills.values()]
      .filter(
        (skill) =>
          skill.exerciseId === exercise.id &&
          !exercise.skillIds.includes(skill.skillId),
      )
      .map((skill) => skill.skillId)
      .sort();
    const own: PlanItem[] = [];
    for (const skillId of [...exercise.skillIds, ...extras]) {
      const item = planItem(skillId, exercise.id, skills.get(skillId), now);
      if (item) own.push(item);
    }
    own.sort(compareItems);
    byExercise.set(exercise.id, {
      id: exercise.id,
      items: own,
      dueCount: own.filter((item) => item.reason !== 'new').length,
      unseenCount: own.filter((item) => item.reason === 'new').length,
    });
    items.push(...own);
  }

  items.sort(compareItems);
  return {
    items,
    dueCount: items.filter((item) => item.reason !== 'new').length,
    byExercise,
    pick: items[0] ?? null,
  };
}

function planItem(
  skillId: string,
  exerciseId: string,
  state: SkillState | undefined,
  now: number,
): PlanItem | null {
  if (!state || state.reps === 0) {
    return {
      skillId,
      exerciseId,
      reason: 'new',
      mastery: null,
      dueAt: 0,
      overdueMs: 0,
    };
  }
  const base = {
    skillId,
    // The record wins over the registry: a skill whose exercise renamed it
    // still belongs to the exercise that recorded it.
    exerciseId: state.exerciseId || exerciseId,
    mastery: state.mastery,
    dueAt: state.dueAt,
  };
  if (isDue(state, now)) {
    return { ...base, reason: 'overdue', overdueMs: overdueBy(state, now) };
  }
  if (isWeak(state)) return { ...base, reason: 'weak', overdueMs: 0 };
  return null;
}

/** Tier, then the tier's own measure, then the id — total and stable. */
function compareItems(a: PlanItem, b: PlanItem): number {
  if (TIER[a.reason] !== TIER[b.reason]) return TIER[a.reason] - TIER[b.reason];
  if (a.reason === 'overdue' && a.overdueMs !== b.overdueMs) {
    return b.overdueMs - a.overdueMs;
  }
  if (a.reason === 'weak' && a.mastery !== b.mastery) {
    return (a.mastery ?? 0) - (b.mastery ?? 0);
  }
  // `new` keeps the order it arrived in — the exercise's own — because
  // `Array.sort` is stable, so only a real tie falls through to the id.
  if (a.reason === 'new') return 0;
  return a.skillId < b.skillId ? -1 : a.skillId > b.skillId ? 1 : 0;
}

/**
 * The skills a `Drill these` / `Practice now` run should favour, for one
 * exercise: its plan items in plan order. Empty means "anything goes".
 *
 * `new` skills are targets too: an exercise you have never touched should
 * still start somewhere deliberate rather than wherever the seed lands.
 */
export function targetSkillsFor(
  plan: PracticePlan,
  exerciseId: string,
): string[] {
  const own = plan.byExercise.get(exerciseId);
  if (!own) return [];
  return own.items.map((item) => item.skillId);
}
