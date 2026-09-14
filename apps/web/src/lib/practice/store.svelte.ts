/**
 * The practice log as shared reactive state (ADR §6, slice 5a): what the
 * runner writes, and what home and `/progress` read.
 *
 * Three properties it has to keep:
 * - **Memory first, storage after.** `record()` updates the state
 *   synchronously and returns; the IndexedDB write is queued behind it, so a
 *   slow disk can never sit in the runner's callback — which runs while audio
 *   is scheduled (ticket: writes stay off the scheduling hot path).
 * - **…but the queue is drained before the user leaves.** Because the write
 *   trails the answer, a user who answers and immediately navigates (or hides
 *   the tab, or closes it) could outrun the transaction and lose the attempt.
 *   `flush()` waits for the queue on the leave paths only — never while a
 *   question is on screen.
 * - **Writes are best-effort.** No storage, a quota, a database from a newer
 *   build: the session still works, in memory, and `onError` puts the copy
 *   deck's one-liner in a banner (the layout wires it, the same way it wires
 *   `midiInput.onDeviceLost` and `audio.onFallback`).
 * - **Reading happens after mount**, like `settings.hydrate()`: the app is
 *   prerendered and module init must not touch storage.
 */

import {
  attemptKey,
  openPracticeStorage,
  type NewAttempt,
  type PracticeData,
  type PracticeStorage,
  type SkillState,
  type StoredAttempt,
} from '$lib/storage/db';
import { PRACTICE_COPY } from './copy';
import { applyAttempt, deriveSkills, exerciseMastery } from './mastery';

/**
 * How long a leave path waits for the write queue before it gives up and lets
 * the user go (ms). Generous next to an IndexedDB commit, short next to a
 * navigation a human would call broken.
 */
export const FLUSH_DEADLINE_MS = 2000;

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

  /**
   * The **promise** of the one open, not its result: a second caller that
   * arrives while the first open is still in flight has to await the same
   * promise. Memoising a boolean instead would hand it `null` — and to
   * `#enqueue` a `null` storage is indistinguishable from no storage at all, so
   * it would `#degrade()` the whole session and drop the attempt. The window is
   * usually the few ms of `onMount`, but `openDB` waits indefinitely while
   * another tab holds an older connection open.
   */
  #opening: Promise<PracticeStorage | null> | null = null;
  /** Serialises writes: one transaction at a time, in the order recorded. */
  #queue: Promise<void> = Promise.resolve();
  /** How many queued writes have not finished yet — `flush()`'s fast path. */
  #pending = 0;
  #reported = false;

  /**
   * Read persisted practice data — the one-shot mount path. Safe to call more
   * than once. Anything recorded while the read was in flight is **kept**: it
   * is a real attempt of this session, and the queued write is still coming.
   */
  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    await this.#load(true);
  }

  /**
   * Re-read everything from storage, **replacing** what is in memory: this is
   * what slice 5b's import calls once it has swapped the data out, and an
   * import that replaces the log must not have this session's attempts folded
   * back into it.
   */
  async reload(): Promise<void> {
    await this.#load(false);
  }

  /**
   * Let queued writes land, then re-read storage — what export calls, so the
   * file is what is *stored* (another tab may have practised) rather than the
   * snapshot this tab hydrated with. Without storage it is a no-op and memory
   * stands, which is the most current thing there is.
   */
  async sync(): Promise<void> {
    await this.flush(0);
    await this.reload();
  }

  /**
   * Wait for the queued writes to land — the leave paths: the root layout's
   * `onNavigate` (client-side navigation) awaits this directly, and
   * `$lib/practice/leave.ts` attaches it to `visibilitychange` → `hidden` and
   * `pagehide`. `record()` returns before its transaction commits, so a user
   * who answers and leaves in the same breath could otherwise outrun it and
   * lose the attempt.
   *
   * Never throws (a queued write reports its own failure through `onError`,
   * once) and never reports anything of its own: a flush is not an event the
   * user did, so it has no sentence. With nothing queued — including every
   * call after storage turned out to be unavailable, when the queue empties
   * immediately — it costs one microtask and no waiting (it is `async`, so it
   * is never literally synchronous), so a leave path may call it on every
   * navigation.
   *
   * Resolves `true` when the queue is empty, `false` when the deadline ran out
   * first. The deadline exists because `openPracticeStorage()` may legitimately
   * wait forever (another tab holding an older database version open), and a
   * navigation that waits forever is a hung app — a missed write is the lesser
   * failure, and it is the one we already survive.
   */
  async flush(deadlineMs: number = FLUSH_DEADLINE_MS): Promise<boolean> {
    if (this.#pending === 0) return true;
    if (deadlineMs <= 0) {
      await this.#settle();
      return true;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), deadlineMs);
    });
    try {
      return await Promise.race([this.#settle().then(() => true), expired]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Await the queue until its tail stops moving. Awaiting `#queue` once only
   * captures the chain as it was at that microtask: a write queued while we
   * waited — an answer given as the tab goes away, or an import landing on the
   * same queue — extends it, and would be left behind.
   */
  async #settle(): Promise<void> {
    let tail = this.#queue;
    for (;;) {
      await tail;
      if (this.#queue === tail) return;
      tail = this.#queue;
    }
  }

  /**
   * Swap the whole log out for an imported one (slice 5b). Storage is replaced
   * in a single transaction and then re-read, so what the screens show is what
   * is on disk; with no storage — or a failed write — the import still applies
   * to this session, in memory, and `degraded` says so.
   *
   * Returns whether it was persisted. Never throws: an import is a user
   * action, and its result is a banner, not an exception.
   */
  async replaceAll(data: PracticeData): Promise<boolean> {
    // On the write queue, so an attempt recorded a moment ago cannot land on
    // top of the imported log after the swap — and counted on it, so a leave
    // path flushing mid-import waits for the transaction like any other write.
    this.#pending += 1;
    const task = this.#queue.then(async () => {
      const storage = await this.#open();
      if (!storage) return false;
      await storage.replace({
        // Plain objects only: the state proxy cannot be structured-cloned.
        attempts: data.attempts.map((attempt) => ({ ...attempt })),
        skills: data.skills.map((skill) => ({ ...skill })),
      });
      return true;
    });
    this.#queue = task.then(
      () => {
        this.#pending -= 1;
      },
      () => {
        this.#pending -= 1;
      },
    );
    let persisted = false;
    try {
      persisted = await task;
    } catch {
      persisted = false;
    }
    if (persisted) {
      await this.reload();
    } else {
      this.#apply({ attempts: [...data.attempts], skills: [...data.skills] });
      // Degraded, but *not* reported through `onError`: the storage banner's
      // sentence is about a lost attempt, and the caller has the one that fits
      // an import (`PRACTICE_COPY.importNotSaved`).
      this.degraded = true;
    }
    return persisted;
  }

  /**
   * Wipe the practice log and every skill record — Settings → Data's
   * `Reset all practice data`. A reset *is* a replace with nothing, so it is
   * the same one transaction on the same write queue: an attempt recorded a
   * moment earlier cannot survive it, and a failed or interrupted reset
   * changes nothing on disk at all. Settings are not practice data and are
   * untouched here.
   *
   * Returns whether it was persisted, like `replaceAll`; without storage the
   * session is emptied in memory and `degraded` says so.
   */
  resetAll(): Promise<boolean> {
    return this.replaceAll({ attempts: [], skills: [] });
  }

  async #load(keepPending: boolean): Promise<void> {
    const storage = await this.#open();
    if (!storage) {
      this.hydrated = true;
      return;
    }
    const snapshot = await storage.read();
    let attempts = snapshot.attempts;
    if (keepPending && this.attempts.length > 0) {
      // Merge by key, not by concatenation: an attempt recorded before the
      // read resolved may already be on disk, so appending would count it
      // twice and assigning outright would drop it from the screens.
      const byKey = new Map(attempts.map((item) => [item.attemptId, item]));
      for (const item of this.attempts) byKey.set(item.attemptId, item);
      attempts = [...byKey.values()].sort((a, b) => a.ts - b.ts);
    }
    this.#apply({ attempts, skills: snapshot.skills });
  }

  /** Put one set of records on screen, skills rebuilt from the log. */
  #apply(data: PracticeData): void {
    this.attempts = data.attempts;
    // The attempt log is the source of truth (ADR 0002 §1): a skill the log
    // knows about is rebuilt from it, whatever the stored record says, and a
    // stored skill with no attempts behind it (an import, slice 5b) is kept.
    const skills = new Map(data.skills.map((skill) => [skill.skillId, skill]));
    for (const [skillId, skill] of deriveSkills(data.attempts)) {
      skills.set(skillId, skill);
    }
    this.skills = [...skills.values()];
    this.hydrated = true;
  }

  /**
   * Record one graded answer. Returns immediately; the write follows.
   *
   * The parameter is structurally an `AttemptResult` (`$lib/exercises/types`)
   * — the storage layer keeps its own primitive shape so it imports nothing.
   * The store is what stamps the storage key: a caller never chooses it.
   */
  record(result: NewAttempt): void {
    const attempt: StoredAttempt = { ...result, attemptId: attemptKey(result) };
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
    this.#pending += 1;
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
      } finally {
        this.#pending -= 1;
      }
    });
  }

  #open(): Promise<PracticeStorage | null> {
    this.#opening ??= openPracticeStorage();
    return this.#opening;
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
