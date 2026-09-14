/**
 * A session while it is running (slice 9b): the clock, the queue cursor and
 * the tally the summary is built from — `session.ts` plus `$state`.
 *
 * The split is the one the runner already makes between its state machine and
 * its audio: everything that can be decided without a browser lives in the
 * pure module, and this class only holds what changes over time. It is
 * constructed per session (never a singleton), so `Practice again` is a new
 * instance rather than a reset path.
 *
 * It knows **no exercise**: it is handed the definitions it may draw from and
 * returns one per question, exactly as the registry gave it. The runner asks
 * it three questions — *which exercise?*, *which skills?*, *is there time
 * left?* — and nothing else.
 */

import type { AnyExercise, AttemptResult } from '$lib/exercises/types';
import { clockTime } from './copy';
import type { PracticePlan } from './planner';
import {
  buildSessionQueue,
  MINUTE_MS,
  SessionCursor,
  sessionTargets,
  type SessionItem,
  type SessionSkillTally,
  type SessionTally,
} from './session';

export interface SessionRunOptions {
  /** The exercises a question may come from — the registry, injected. */
  exercises: readonly AnyExercise[];
  /** The planner's output, built once when the session opens. */
  plan: PracticePlan;
  /** How long the session lasts, in minutes (UX §3's 5 / 10 / 20). */
  lengthMin: number;
  /** Epoch ms; injected so the clock is testable. */
  now?: () => number;
}

export class SessionRun {
  /** Epoch ms of the first question, or `null` until the drill starts. */
  startedAt = $state<number | null>(null);
  /** Epoch ms the session ended, or `null` while it runs. */
  endedAt = $state<number | null>(null);
  /** Re-read on a tick, so the rail's time bar moves. */
  elapsedMs = $state(0);

  answers = $state(0);
  correct = $state(0);
  bestStreak = $state(0);

  readonly lengthMs: number;

  #exercises: Map<string, AnyExercise>;
  #order: readonly AnyExercise[];
  #plan: PracticePlan;
  #cursor: SessionCursor;
  #now: () => number;
  /** Insertion-ordered, so a tie in the summary breaks the way it happened. */
  #skills = new Map<string, SessionSkillTally>();
  #current: SessionItem | null = null;
  /** Where the round-robin over the *registry* stands — see `#nextFallback`. */
  #fallbackIndex = 0;

  constructor(options: SessionRunOptions) {
    this.#order = options.exercises;
    this.#exercises = new Map(
      options.exercises.map((exercise) => [exercise.id, exercise]),
    );
    this.#plan = options.plan;
    this.#cursor = new SessionCursor(
      buildSessionQueue(options.plan).filter((item) =>
        this.#exercises.has(item.exerciseId),
      ),
    );
    this.lengthMs = options.lengthMin * MINUTE_MS;
    this.#now = options.now ?? Date.now;
  }

  /** The exercise the session opens on — the runner's initial definition. */
  get first(): AnyExercise | null {
    const item = this.#cursor.peek();
    return (
      (item && this.#exercises.get(item.exerciseId)) ?? this.#peekFallback()
    );
  }

  get ended(): boolean {
    return this.endedAt !== null;
  }

  /** How much of the session is gone, 0..1 — the rail's bar (§9). */
  get timeValue(): number {
    if (this.lengthMs <= 0) return 1;
    return Math.min(1, Math.max(0, this.elapsedMs / this.lengthMs));
  }

  /** What is left, `mm:ss` — the rail's readout, which counts *down*. */
  get timeReadout(): string {
    return clockTime(Math.max(0, this.lengthMs - this.elapsedMs));
  }

  /**
   * Which exercise the next question comes from. The clock starts here rather
   * than at mount: a session is the time spent answering, and the runner sits
   * in `idle` until the user presses Space (UX §4.2).
   */
  pickExercise(): AnyExercise | null {
    this.startedAt ??= this.#now();
    this.tick();
    const item = this.#cursor.next();
    const exercise = item ? this.#exercises.get(item.exerciseId) : undefined;
    // Only an item whose exercise we actually have may bias the question:
    // otherwise the fallback below answers, and it targets nothing.
    this.#current = exercise ? item : null;
    return exercise ?? this.#nextFallback();
  }

  /**
   * What a session asks when the queue is empty — which is not a rare corner:
   * a user with every skill practised, none overdue and none weak gets
   * `items: []` from the planner (a practised-not-due skill is deliberately
   * absent), and that user is exactly the one who has earned a mixed session.
   *
   * So the fallback is a **round-robin over the registry**, not `#order[0]`
   * repeated: the questions are ordinary ones (`targetSkills()` stays empty,
   * because nothing is owed), but they still come from every exercise, which
   * is what the screen promises. It mirrors `targetSkillsFor()`'s own rule —
   * an exercise that owes nothing falls back to its whole list rather than to
   * nothing at all.
   */
  #nextFallback(): AnyExercise | null {
    const exercise = this.#peekFallback();
    if (exercise) this.#fallbackIndex += 1;
    return exercise;
  }

  #peekFallback(): AnyExercise | null {
    if (this.#order.length === 0) return null;
    return this.#order[this.#fallbackIndex % this.#order.length]!;
  }

  /** The skills the current question should favour (a bias, not a filter). */
  targetSkills(): string[] {
    return this.#current ? sessionTargets(this.#plan, this.#current) : [];
  }

  /** False once the time is up: the runner then shows the summary, mid-drill
   * questions are never cut off — the check happens between questions. */
  shouldContinue(): boolean {
    if (this.ended) return false;
    if (this.startedAt === null) return true;
    return this.#now() - this.startedAt < this.lengthMs;
  }

  /** Re-read the clock (the screen's interval, and every question). */
  tick(): void {
    if (this.startedAt === null) return;
    const end = this.endedAt ?? this.#now();
    this.elapsedMs = Math.max(0, end - this.startedAt);
  }

  /**
   * Fold in one graded answer. `masteryBefore` is read *before* the practice
   * store records it and `masteryAfter` after, so the delta is this session's
   * — the store is the one authority on what mastery is.
   */
  record(
    attempt: AttemptResult,
    masteryBefore: number | null,
    masteryAfter: number,
    streak: number,
  ): void {
    this.answers += 1;
    if (attempt.correct) this.correct += 1;
    this.bestStreak = Math.max(this.bestStreak, streak);
    const tally = this.#skills.get(attempt.skillId);
    if (tally) {
      tally.attempts += 1;
      tally.correct += attempt.correct ? 1 : 0;
      tally.masteryAfter = masteryAfter;
    } else {
      this.#skills.set(attempt.skillId, {
        skillId: attempt.skillId,
        exerciseId: attempt.exerciseId,
        attempts: 1,
        correct: attempt.correct ? 1 : 0,
        masteryBefore,
        masteryAfter,
      });
    }
  }

  /** End the session — the clock stops here, and the summary reads it. */
  end(): void {
    if (this.ended) return;
    this.endedAt = this.#now();
    this.tick();
  }

  /** Everything `summariseSession()` needs, once the session has ended. */
  tally(): SessionTally {
    return {
      elapsedMs: this.elapsedMs,
      answers: this.answers,
      correct: this.correct,
      bestStreak: this.bestStreak,
      skills: [...this.#skills.values()].map((skill) => ({ ...skill })),
    };
  }
}
