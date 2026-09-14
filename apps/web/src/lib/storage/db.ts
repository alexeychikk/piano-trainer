/**
 * Practice data in IndexedDB (ADR 0001 §6) — the attempt log and one mastery
 * record per skill. `localStorage` holds settings; the attempt log grows
 * without bound and must not be written synchronously, which is why it lives
 * here instead.
 *
 * This is a **base layer**: it imports `idb` and nothing else in the app, so
 * the record types are spelled out in primitives rather than borrowed from
 * `$lib/exercises` (an `AttemptResult` is structurally assignable to a
 * `StoredAttempt`, which is all the practice layer needs).
 *
 * Two rules the ADR asks for, both load-bearing:
 * - **Storage can vanish.** Private mode, a blocked partition, a quota, a
 *   database from a *newer* build of the app — every one of those resolves to
 *   `null` here, and the practice store then runs in memory. Practice never
 *   stops because a write failed.
 * - **Everything read back is validated.** IndexedDB content is user-editable
 *   (and, from slice 5b, user-*imported*), so a record that is not the shape we
 *   expect is dropped, never trusted and never thrown over.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * The payload's schema version, independent of any one store: it is what slice
 * 5b's export file carries and what slice 9's spaced-repetition fields will
 * bump. It doubles as the IndexedDB version, so an older build opening a newer
 * database fails cleanly (`VersionError`) instead of reading fields it does
 * not understand.
 */
export const PRACTICE_SCHEMA_VERSION = 1;

export const PRACTICE_DB_NAME = 'piano-trainer';

/**
 * One graded answer. Append-only — which is why the key is the *attempt*, not
 * the question: a question id repeats (a seed collision, or a slice-5b import
 * from a second device), and keying on it would silently overwrite a row and
 * leave the stored count disagreeing with the log.
 */
export interface StoredAttempt {
  /** Unique per attempt, `${ts}:${questionId}` — the store's key. */
  attemptId: string;
  /** The question that was asked. Two attempts may share one. */
  questionId: string;
  /** Epoch ms. */
  ts: number;
  exerciseId: string;
  skillId: string;
  seed: number;
  correct: boolean;
  /** 0..1 — partial credit, not just pass/fail. */
  score: number;
  responseMs: number;
  replays: number;
  answerSource: string;
}

/**
 * The per-skill record. `easiness`/`intervalDays`/`dueAt` are the SM-2 fields
 * ADR §6 reserves: slice 9's `review()` owns them, and until it exists nothing
 * schedules anything — they are written at their defaults and read by nobody.
 */
export interface SkillState {
  skillId: string;
  exerciseId: string;
  reps: number;
  lapses: number;
  easiness: number;
  intervalDays: number;
  dueAt: number;
  /** 0..1, EWMA of recent scores — what the progress screen shows. */
  mastery: number;
  lastSeenAt: number;
}

/** An attempt before it has been keyed — what the runner emits. */
export type NewAttempt = Omit<StoredAttempt, 'attemptId'>;

/** The store's key for an attempt. Derived, never chosen by a caller. */
export function attemptKey(
  attempt: Pick<StoredAttempt, 'ts' | 'questionId'>,
): string {
  return `${attempt.ts}:${attempt.questionId}`;
}

export interface PracticeSnapshot {
  schemaVersion: number;
  attempts: StoredAttempt[];
  skills: SkillState[];
}

/** The data half of a snapshot — what slice 5b's import replaces. */
export type PracticeData = Pick<PracticeSnapshot, 'attempts' | 'skills'>;

export const EMPTY_SNAPSHOT: PracticeSnapshot = {
  schemaVersion: PRACTICE_SCHEMA_VERSION,
  attempts: [],
  skills: [],
};

interface MetaRecord {
  key: string;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

const META_KEY = 'schema';

interface PracticeDbSchema extends DBSchema {
  attempts: {
    key: string;
    value: StoredAttempt;
    indexes: { 'by-ts': number; 'by-skill': string };
  };
  skills: { key: string; value: SkillState };
  meta: { key: string; value: MetaRecord };
}

/** What the practice store talks to. One implementation; `null` when absent. */
export interface PracticeStorage {
  read(): Promise<PracticeSnapshot>;
  /** One transaction: the attempt and the skill it updated move together. */
  write(attempt: StoredAttempt, skill: SkillState): Promise<void>;
  /**
   * Swap the whole log out for an imported one (slice 5b). Also one
   * transaction: a rejected or interrupted import leaves the old data exactly
   * as it was, never half of each.
   */
  replace(data: PracticeData): Promise<void>;
  close(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** A stored attempt, or `null` when the record is not one. */
export function parseAttempt(raw: unknown): StoredAttempt | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.questionId !== 'string' || raw.questionId === '') return null;
  if (typeof raw.exerciseId !== 'string' || typeof raw.skillId !== 'string') {
    return null;
  }
  if (typeof raw.ts !== 'number' || !Number.isFinite(raw.ts)) return null;
  return {
    // A record that arrives without a key (an import, slice 5b) gets the one
    // it would have been written with, rather than being dropped.
    attemptId:
      typeof raw.attemptId === 'string' && raw.attemptId !== ''
        ? raw.attemptId
        : attemptKey({ ts: raw.ts, questionId: raw.questionId }),
    questionId: raw.questionId,
    ts: raw.ts,
    exerciseId: raw.exerciseId,
    skillId: raw.skillId,
    seed: num(raw.seed, 0),
    correct: raw.correct === true,
    score: clamp01(num(raw.score, raw.correct === true ? 1 : 0)),
    responseMs: Math.max(0, num(raw.responseMs, 0)),
    replays: Math.max(0, num(raw.replays, 0)),
    answerSource:
      typeof raw.answerSource === 'string' ? raw.answerSource : 'unknown',
  };
}

/** A stored skill state, or `null` when the record is not one. */
export function parseSkill(raw: unknown): SkillState | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.skillId !== 'string' || raw.skillId === '') return null;
  if (typeof raw.exerciseId !== 'string') return null;
  return {
    skillId: raw.skillId,
    exerciseId: raw.exerciseId,
    reps: Math.max(0, num(raw.reps, 0)),
    lapses: Math.max(0, num(raw.lapses, 0)),
    easiness: num(raw.easiness, DEFAULT_EASINESS),
    intervalDays: Math.max(0, num(raw.intervalDays, 0)),
    dueAt: num(raw.dueAt, 0),
    mastery: clamp01(num(raw.mastery, 0)),
    lastSeenAt: num(raw.lastSeenAt, 0),
  };
}

/** SM-2's starting easiness factor (ADR §6); slice 9 is what changes it. */
export const DEFAULT_EASINESS = 2.5;

/**
 * Abort a transaction and wait for it to finish aborting. `tx.done` rejects
 * with an `AbortError`, and leaving that rejection unhandled is console noise
 * the e2e suite (which asserts an empty console) would see — the caller throws
 * its own error instead.
 */
async function abort(tx: { abort(): void; done: Promise<unknown> }) {
  tx.abort();
  await tx.done.catch(() => {});
}

/**
 * Open the practice database. Returns `null` — never throws — when there is no
 * IndexedDB, when it is blocked, or when the stored database is newer than
 * this build understands; the caller then keeps practice data in memory.
 */
export async function openPracticeStorage(): Promise<PracticeStorage | null> {
  // `idb` reads the global factory, so there is nothing to inject: a test
  // installs one (`fake-indexeddb`) and a browser without IndexedDB — or with
  // it blocked — leaves us in memory.
  if (typeof indexedDB === 'undefined' || !indexedDB) return null;
  let db: IDBPDatabase<PracticeDbSchema>;
  try {
    db = await openDB<PracticeDbSchema>(
      PRACTICE_DB_NAME,
      PRACTICE_SCHEMA_VERSION,
      {
        upgrade(database) {
          if (!database.objectStoreNames.contains('attempts')) {
            const attempts = database.createObjectStore('attempts', {
              keyPath: 'attemptId',
            });
            attempts.createIndex('by-ts', 'ts');
            attempts.createIndex('by-skill', 'skillId');
          }
          if (!database.objectStoreNames.contains('skills')) {
            database.createObjectStore('skills', { keyPath: 'skillId' });
          }
          if (!database.objectStoreNames.contains('meta')) {
            database.createObjectStore('meta', { keyPath: 'key' });
          }
        },
        blocking() {
          // Another tab is upgrading: let go rather than block it forever.
          db?.close();
        },
      },
    );
  } catch {
    return null;
  }

  return {
    async read(): Promise<PracticeSnapshot> {
      try {
        const meta = await db.get('meta', META_KEY);
        const schemaVersion = meta?.schemaVersion ?? PRACTICE_SCHEMA_VERSION;
        if (schemaVersion > PRACTICE_SCHEMA_VERSION) {
          // Written by a newer build. Read nothing and (see `write`) touch
          // nothing: losing a session beats corrupting the log.
          return { ...EMPTY_SNAPSHOT, schemaVersion };
        }
        const attempts = (await db.getAll('attempts'))
          .map(parseAttempt)
          .filter((attempt): attempt is StoredAttempt => attempt !== null)
          .sort((a, b) => a.ts - b.ts);
        const skills = (await db.getAll('skills'))
          .map(parseSkill)
          .filter((skill): skill is SkillState => skill !== null);
        return { schemaVersion, attempts, skills };
      } catch {
        return { ...EMPTY_SNAPSHOT };
      }
    },

    async write(attempt: StoredAttempt, skill: SkillState): Promise<void> {
      const tx = db.transaction(['attempts', 'skills', 'meta'], 'readwrite');
      const now = Date.now();
      const meta = await tx.objectStore('meta').get(META_KEY);
      if (
        (meta?.schemaVersion ?? PRACTICE_SCHEMA_VERSION) >
        PRACTICE_SCHEMA_VERSION
      ) {
        await abort(tx);
        throw new Error('practice database is newer than this build');
      }
      await tx.objectStore('attempts').put(attempt);
      await tx.objectStore('skills').put(skill);
      await tx.objectStore('meta').put({
        key: META_KEY,
        schemaVersion: PRACTICE_SCHEMA_VERSION,
        createdAt: meta?.createdAt ?? now,
        updatedAt: now,
      });
      await tx.done;
    },

    async replace(data: PracticeData): Promise<void> {
      const tx = db.transaction(['attempts', 'skills', 'meta'], 'readwrite');
      const now = Date.now();
      const metaStore = tx.objectStore('meta');
      const meta = await metaStore.get(META_KEY);
      if (
        (meta?.schemaVersion ?? PRACTICE_SCHEMA_VERSION) >
        PRACTICE_SCHEMA_VERSION
      ) {
        await abort(tx);
        throw new Error('practice database is newer than this build');
      }
      const attempts = tx.objectStore('attempts');
      const skills = tx.objectStore('skills');
      // Clear then put, inside the one transaction: the old log is only gone
      // once the new one is durable, so a failure mid-import is a no-op.
      await attempts.clear();
      await skills.clear();
      for (const attempt of data.attempts) await attempts.put(attempt);
      for (const skill of data.skills) await skills.put(skill);
      await metaStore.put({
        key: META_KEY,
        schemaVersion: PRACTICE_SCHEMA_VERSION,
        createdAt: meta?.createdAt ?? now,
        updatedAt: now,
      });
      await tx.done;
    },

    close(): void {
      db.close();
    },
  };
}
