/**
 * The mixed practice session (UX spec §4.8, `sci-fi-screens.md` §9 — slice
 * 9b): what `/session` asks, in which order, and what the summary says
 * afterwards.
 *
 * Pure, like `planner.ts` next door: no clock of its own, no storage, no
 * Svelte. The reactive half — the running clock, the tally as answers arrive —
 * is `session.svelte.ts`, which is this module plus `$state`.
 *
 * **The session consumes the planner, it does not re-plan.** `buildPlan()`
 * already answers *what is worth practising, most urgent first*; a session is
 * that same list, dealt out so that two consecutive questions come from
 * different exercises whenever the plan owes more than one exercise something.
 * Nothing here re-reads mastery or the schedule.
 */

import type { PlanItem, PlanReason, PracticePlan } from './planner';
import { targetSkillsFor } from './planner';

/** The lengths the home screen offers, in minutes (UX §3). */
export const SESSION_LENGTHS_MIN = [5, 10, 20] as const;
export type SessionLengthMin = (typeof SESSION_LENGTHS_MIN)[number];
/** UX §3: 10 minutes is the default, and the empty hero promises it. */
export const DEFAULT_SESSION_LENGTH_MIN: SessionLengthMin = 10;
export const MINUTE_MS = 60_000;

/** At most this many rows in the summary's `SKILLS TOUCHED` panel (§9). */
export const SUMMARY_MAX_ROWS = 6;

export function isSessionLength(value: unknown): value is SessionLengthMin {
  return (SESSION_LENGTHS_MIN as readonly unknown[]).includes(value);
}

/** One question's worth of intent: which exercise, favouring which skill. */
export interface SessionItem {
  exerciseId: string;
  skillId: string;
  reason: PlanReason;
}

/**
 * Deal the plan out across exercises.
 *
 * **Round-robin over the exercises, plan order inside each one.** The
 * exercises are taken in the order the plan first mentions them — so the
 * session opens on `plan.pick`, exactly what home's `Practice now` would have
 * opened — and then one question each, round and round, until every exercise
 * has run out.
 *
 * Dealing *globally* by urgency instead was the obvious thing and it is wrong:
 * with four exercises of 12 / 7 / 5 / 36 skills, "always the most urgent one
 * that is not the last one asked" alternates between the two lowest-ranked
 * exercises and never reaches the other two at all — a mixed session that
 * mixes two things. A round-robin keeps every exercise in the session and
 * still keeps each exercise's own tiers (overdue → weak → new) in order.
 *
 * The result is the *whole* plan, not a session's worth: a session is timed,
 * so the runner cycles this queue (`SessionCursor`) until the clock runs out.
 */
export function buildSessionQueue(plan: PracticePlan): SessionItem[] {
  const groups = new Map<string, PlanItem[]>();
  for (const item of plan.items) {
    const group = groups.get(item.exerciseId);
    if (group) group.push(item);
    else groups.set(item.exerciseId, [item]);
  }

  const order = [...groups.keys()];
  const queue: SessionItem[] = [];
  let dealt = true;
  while (dealt) {
    dealt = false;
    for (const exerciseId of order) {
      const item = groups.get(exerciseId)!.shift();
      if (!item) continue;
      queue.push({
        exerciseId,
        skillId: item.skillId,
        reason: item.reason,
      });
      dealt = true;
    }
  }
  return queue;
}

/**
 * The skills a question drawn for `item` should favour — the runner's
 * rejection-sampling bias (slice 9a), with this item's own skill first so an
 * exercise that honours `GenerateContext.targetSkillId` hits it on the first
 * draw.
 *
 * The rest of the exercise's owed skills stay in the set on purpose: the bias
 * is a bias, not a restriction (ADR 0003), and a draw that misses this exact
 * skill but lands on another overdue one is still the session doing its job.
 */
export function sessionTargets(
  plan: PracticePlan,
  item: SessionItem,
): string[] {
  const rest = targetSkillsFor(plan, item.exerciseId).filter(
    (skillId) => skillId !== item.skillId,
  );
  return [item.skillId, ...rest];
}

/**
 * The queue as the runner consumes it: one item per question, cycling when it
 * runs out (a five-skill plan and a ten-minute session both happen).
 */
export class SessionCursor {
  #items: readonly SessionItem[];
  #index = 0;

  constructor(items: readonly SessionItem[]) {
    this.#items = items;
  }

  get length(): number {
    return this.#items.length;
  }

  /** What the next question is for, without consuming it. */
  peek(): SessionItem | null {
    if (this.#items.length === 0) return null;
    return this.#items[this.#index % this.#items.length]!;
  }

  /** Take the next item. Cycles; `null` only for an empty queue. */
  next(): SessionItem | null {
    const item = this.peek();
    if (item) this.#index += 1;
    return item;
  }
}

// ---- the summary (UX §4.8, sci-fi-screens.md §9) -------------------------

/** What one skill did during the session. */
export interface SessionSkillTally {
  skillId: string;
  exerciseId: string;
  attempts: number;
  correct: number;
  /** Mastery before the session's first attempt on it; `null` = unpractised. */
  masteryBefore: number | null;
  /** Mastery after its last attempt, 0..1. */
  masteryAfter: number;
}

export interface SessionTally {
  elapsedMs: number;
  answers: number;
  correct: number;
  bestStreak: number;
  skills: readonly SessionSkillTally[];
}

export interface SessionSummaryRow {
  skillId: string;
  /** The exercise's own name for the skill. */
  label: string;
  /** Which exercise it belongs to. */
  exerciseTitle: string;
  mastery: number;
  /** Signed percentage points, rounded — what the row's meta shows. */
  deltaPercent: number;
  /** `up` / `down` — the ▲ / ▼ glyph; `flat` when nothing moved. */
  direction: 'up' | 'down' | 'flat';
}

export interface SessionSummary {
  elapsedMs: number;
  answers: number;
  correct: number;
  /** 0..1; `0` with nothing answered, which the screen shows as 0 %. */
  accuracy: number;
  bestStreak: number;
  /** At most `SUMMARY_MAX_ROWS`, by |delta| descending. */
  rows: SessionSummaryRow[];
  /** The weakest skill of the session, or `null` when nothing was answered. */
  weakest: { label: string; correct: number; attempts: number } | null;
}

export interface SessionLabels {
  /** The exercise's name for a skill (`skillLabel`), or the id's last part. */
  skillLabel(skillId: string, exerciseId: string): string;
  exerciseTitle(exerciseId: string): string;
}

/**
 * The numbers the summary shows. Every one of them is derived here so the
 * screen is markup — the same split `/progress` uses (`progress.ts`).
 *
 * A skill that was never practised before reads as a **rise from zero**: the
 * pips said `new`, they now say something, and calling that "no change"
 * because there is no baseline would hide the session's whole first run.
 */
export function summariseSession(
  tally: SessionTally,
  labels: SessionLabels,
): SessionSummary {
  const rows = tally.skills
    .map((skill) => {
      const before = skill.masteryBefore ?? 0;
      const deltaPercent = Math.round((skill.masteryAfter - before) * 100);
      return {
        skillId: skill.skillId,
        label: labels.skillLabel(skill.skillId, skill.exerciseId),
        exerciseTitle: labels.exerciseTitle(skill.exerciseId),
        mastery: skill.masteryAfter,
        deltaPercent,
        direction: deltaPercent > 0 ? 'up' : deltaPercent < 0 ? 'down' : 'flat',
      } satisfies SessionSummaryRow;
    })
    .sort(
      (a, b) =>
        Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent) ||
        (a.skillId < b.skillId ? -1 : a.skillId > b.skillId ? 1 : 0),
    )
    .slice(0, SUMMARY_MAX_ROWS);

  return {
    elapsedMs: tally.elapsedMs,
    answers: tally.answers,
    correct: tally.correct,
    accuracy: tally.answers === 0 ? 0 : tally.correct / tally.answers,
    bestStreak: tally.bestStreak,
    rows,
    weakest: weakestOf(tally, labels),
  };
}

/**
 * The lowest accuracy of the session, ties going to whoever was asked most
 * (more evidence), then to the id so the line is deterministic. A skill that
 * went perfectly is still named when it is the only one — the sentence is a
 * *where to look next*, not a scolding.
 */
function weakestOf(
  tally: SessionTally,
  labels: SessionLabels,
): SessionSummary['weakest'] {
  let worst: SessionSkillTally | null = null;
  for (const skill of tally.skills) {
    if (skill.attempts === 0) continue;
    if (!worst) {
      worst = skill;
      continue;
    }
    const a = skill.correct / skill.attempts;
    const b = worst.correct / worst.attempts;
    if (
      a < b ||
      (a === b &&
        (skill.attempts > worst.attempts ||
          (skill.attempts === worst.attempts && skill.skillId < worst.skillId)))
    ) {
      worst = skill;
    }
  }
  if (!worst) return null;
  return {
    label: labels.skillLabel(worst.skillId, worst.exerciseId),
    correct: worst.correct,
    attempts: worst.attempts,
  };
}
