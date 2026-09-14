/**
 * The practice log as shared reactive state (ADR §6, slice 5a): what the
 * runner writes, and what home and `/progress` read.
 *
 * Three properties it has to keep:
 * - **Memory first, storage after.** `record()` updates the state
 *   synchronously and returns; the IndexedDB write is queued behind it, so a
 *   slow disk can never sit in the runner's callback — which runs while audio
 *   is scheduled (ticket: writes stay off the scheduling hot path).
 * - **Writes are best-effort.** No storage, a quota, a database from a newer
 *   build: the session still works, in memory, and `onError` puts the copy
 *   deck's one-liner in a banner (the layout wires it, the same way it wires
 *   `midiInput.onDeviceLost` and `audio.onFallback`).
 * - **Reading happens after mount**, like `settings.hydrate()`: the app is
 *   prerendered and module init must not touch storage.
 */

import {
  openPracticeStorage,
  type PracticeStorage,
  type SkillState,
  type StoredAttempt,
} from '$lib/storage/db';
import { PRACTICE_COPY } from './copy';
import { applyAttempt, deriveSkills, exerciseMastery } from './mastery';

export class PracticeStore {
  /** Every attempt, oldest first. */
  attempts = $state<StoredAttempt[]>([]);
  /** One record per skill that has been practised. */
  skills = $state<SkillState[]>([]);
  /** True once storage has been read (or found to be unavailable). */
  hydrated = $state(false);
  /** True when a write failed — the session is memory-only from here. */
  degraded = $state(false);

  /** Told once, when persistence first fails. */
  onError: ((message: string) => void) | null = null;

  byId: Map<string, SkillState> = $derived(
    new Map(this.skills.map((skill) => [skill.skillId, skill])),
  );

  #storage: PracticeStorage | null = null;
  #opened = false;
  /** Serialises writes: one transaction at a time, in the order recorded. */
  #queue: Promise<void> = Promise.resolve();
  #reported = false;

  /** Read persisted practice data. Safe to call more than once. */
  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    await this.reload();
  }

  /**
   * Re-read everything from storage. `hydrate()` is the one-shot mount path;
   * this is what slice 5b's import calls after it has replaced the data, so
   * the screens do not have to be reloaded to see it.
   */
  async reload(): Promise<void> {
    const storage = await this.#open();
    if (!storage) {
      this.hydrated = true;
      return;
    }
    const snapshot = await storage.read();
    this.attempts = snapshot.attempts;
    // The attempt log is the source of truth (ADR 0002 §1): a skill the log
    // knows about is rebuilt from it, whatever the stored record says, and a
    // stored skill with no attempts behind it (an import, slice 5b) is kept.
    const merged = new Map(
      snapshot.skills.map((skill) => [skill.skillId, skill]),
    );
    for (const [skillId, skill] of deriveSkills(snapshot.attempts)) {
      merged.set(skillId, skill);
    }
    this.skills = [...merged.values()];
    this.hydrated = true;
  }

  /**
   * Record one graded answer. Returns immediately; the write follows.
   *
   * The parameter is structurally an `AttemptResult` (`$lib/exercises/types`)
   * — the storage layer keeps its own primitive shape so it imports nothing.
   */
  record(attempt: StoredAttempt): void {
    const skill = applyAttempt(this.byId.get(attempt.skillId) ?? null, attempt);
    this.attempts = [...this.attempts, attempt];
    this.skills = [
      ...this.skills.filter((item) => item.skillId !== skill.skillId),
      skill,
    ];
    this.#enqueue(attempt, skill);
  }

  /** Mean mastery over a set of skills — the home card's pips. */
  masteryFor(skillIds: readonly string[]): number | null {
    return exerciseMastery(skillIds, this.byId);
  }

  #enqueue(attempt: StoredAttempt, skill: SkillState): void {
    this.#queue = this.#queue.then(async () => {
      try {
        const storage = await this.#open();
        if (!storage) {
          this.#degrade();
          return;
        }
        // Plain objects only: the state proxy cannot be structured-cloned.
        await storage.write({ ...attempt }, { ...skill });
      } catch {
        this.#degrade();
      }
    });
  }

  async #open(): Promise<PracticeStorage | null> {
    if (!this.#opened) {
      this.#opened = true;
      this.#storage = await openPracticeStorage();
    }
    return this.#storage;
  }

  #degrade(): void {
    this.degraded = true;
    if (this.#reported) return;
    this.#reported = true;
    this.onError?.(PRACTICE_COPY.storageFailed);
  }
}

/** The app-wide practice log. Screens read it; only the runner writes. */
export const practice = new PracticeStore();
