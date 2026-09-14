// See `storage/db.test.ts`: `idb` needs the whole IDB global family, and each
// test swaps in a fresh factory so one store's data never leaks into the next.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attemptKey, type NewAttempt } from '$lib/storage/db';
import { PRACTICE_COPY } from './copy';
import { PracticeStore } from './store.svelte';

function attempt(overrides: Partial<NewAttempt> = {}): NewAttempt {
  return {
    questionId: 'find-the-note:7:60',
    ts: 1_700_000_000_000,
    exerciseId: 'find-the-note',
    skillId: 'find-the-note:pc:0',
    seed: 7,
    correct: true,
    score: 1,
    responseMs: 640,
    replays: 0,
    answerSource: 'onscreen',
    ...overrides,
  };
}

/** Let the queued write (and the open behind it) run to completion. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('PracticeStore', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: new IDBFactory(),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'indexedDB');
  });

  it('updates its state synchronously — the write happens after', () => {
    const store = new PracticeStore();
    store.record(attempt());
    expect(store.attempts).toHaveLength(1);
    expect(store.byId.get('find-the-note:pc:0')?.reps).toBe(1);
    expect(store.masteryFor(['find-the-note:pc:0'])).toBeCloseTo(0.3);
  });

  it('survives a reload — a second store reads what the first wrote', async () => {
    const first = new PracticeStore();
    first.record(attempt());
    first.record(
      attempt({ questionId: 'find-the-note:8:62', correct: false, score: 0 }),
    );
    await settle();

    const second = new PracticeStore();
    await second.hydrate();
    expect(second.hydrated).toBe(true);
    expect(second.attempts).toHaveLength(2);
    expect(second.byId.get('find-the-note:pc:0')?.reps).toBe(2);
    expect(second.masteryFor(['find-the-note:pc:0'])).toBeCloseTo(0.21);
  });

  it('keeps both attempts when the same question comes round twice', async () => {
    // The log is append-only: a repeated question id (a seed collision, or a
    // slice-5b import from a second device) must not overwrite a row.
    const first = new PracticeStore();
    first.record(attempt({ ts: 1_700_000_000_000 }));
    first.record(attempt({ ts: 1_700_000_030_000, correct: false, score: 0 }));
    await settle();

    const second = new PracticeStore();
    await second.hydrate();
    expect(second.attempts).toHaveLength(2);
    expect(second.attempts.map((item) => item.attemptId)).toEqual([
      attemptKey({ ts: 1_700_000_000_000, questionId: 'find-the-note:7:60' }),
      attemptKey({ ts: 1_700_000_030_000, questionId: 'find-the-note:7:60' }),
    ]);
    expect(second.byId.get('find-the-note:pc:0')?.reps).toBe(2);
  });

  it('keeps an attempt recorded while hydration was still in flight', async () => {
    const first = new PracticeStore();
    first.record(attempt());
    await settle();

    const second = new PracticeStore();
    const onError = vi.fn();
    second.onError = onError;
    const reading = second.hydrate();
    // Answered before the read came back: it belongs to the session, and its
    // own write is already queued behind it. Both callers share the one open,
    // so the write waits for storage instead of seeing `null` and degrading.
    second.record(attempt({ ts: 1_700_000_060_000, questionId: 'live' }));
    await reading;
    await settle();

    expect(second.attempts.map((item) => item.questionId)).toEqual([
      'find-the-note:7:60',
      'live',
    ]);
    expect(second.degraded).toBe(false);
    expect(onError).not.toHaveBeenCalled();

    // …and it really reached the disk, which is what the promise claims.
    const third = new PracticeStore();
    await third.hydrate();
    expect(third.attempts.map((item) => item.questionId)).toEqual([
      'find-the-note:7:60',
      'live',
    ]);
    expect(third.byId.get('find-the-note:pc:0')?.reps).toBe(2);
  });

  it('rebuilds a missing skill record from the attempt log', async () => {
    const first = new PracticeStore();
    first.record(attempt());
    await settle();
    // A database whose `skills` store lost a record (a half-failed write, a
    // partial import): the log is the source of truth.
    const db = indexedDB.open('piano-trainer', 1);
    await new Promise((resolve) => {
      db.onsuccess = () => {
        const tx = db.result.transaction('skills', 'readwrite');
        tx.objectStore('skills').clear();
        tx.oncomplete = () => {
          db.result.close();
          resolve(null);
        };
      };
    });

    const second = new PracticeStore();
    await second.hydrate();
    expect(second.byId.get('find-the-note:pc:0')?.reps).toBe(1);
  });

  it('keeps a stored skill the log knows nothing about', async () => {
    // What an imported profile looks like before its attempts land (slice 5b).
    const open = indexedDB.open('piano-trainer', 1);
    await new Promise((resolve) => {
      open.onupgradeneeded = () => {
        const db = open.result;
        const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
        attempts.createIndex('by-ts', 'ts');
        attempts.createIndex('by-skill', 'skillId');
        db.createObjectStore('skills', { keyPath: 'skillId' });
        db.createObjectStore('meta', { keyPath: 'key' });
      };
      open.onsuccess = () => {
        const tx = open.result.transaction('skills', 'readwrite');
        tx.objectStore('skills').put({
          skillId: 'find-the-note:pc:5',
          exerciseId: 'find-the-note',
          reps: 4,
          lapses: 1,
          easiness: 2.5,
          intervalDays: 0,
          dueAt: 0,
          mastery: 0.6,
          lastSeenAt: 1_700_000_000_000,
        });
        tx.oncomplete = () => {
          open.result.close();
          resolve(null);
        };
      };
    });

    const store = new PracticeStore();
    await store.hydrate();
    expect(store.byId.get('find-the-note:pc:5')?.mastery).toBeCloseTo(0.6);
  });

  it('hydrates once; `reload()` re-reads for slice 5b', async () => {
    const store = new PracticeStore();
    await store.hydrate();
    const writer = new PracticeStore();
    writer.record(attempt());
    await settle();

    await store.hydrate();
    expect(store.attempts).toHaveLength(0);
    await store.reload();
    expect(store.attempts).toHaveLength(1);
  });

  it('replaces everything on import, and persists it (slice 5b)', async () => {
    const store = new PracticeStore();
    store.record(attempt());
    await settle();

    const imported = {
      attemptId: '1700000900000:imported',
      questionId: 'imported',
      ts: 1_700_000_900_000,
      exerciseId: 'find-the-note',
      skillId: 'find-the-note:pc:5',
      seed: 1,
      correct: true,
      score: 1,
      responseMs: 500,
      replays: 0,
      answerSource: 'midi',
    };
    const persisted = await store.replaceAll({
      attempts: [imported],
      skills: [],
    });

    expect(persisted).toBe(true);
    expect(store.attempts.map((item) => item.questionId)).toEqual(['imported']);
    expect(store.byId.get('find-the-note:pc:0')).toBeUndefined();
    expect(store.degraded).toBe(false);

    // …and the old log really is gone from disk, not just from the screen.
    const reopened = new PracticeStore();
    await reopened.hydrate();
    expect(reopened.attempts.map((item) => item.questionId)).toEqual([
      'imported',
    ]);
    expect(reopened.byId.get('find-the-note:pc:5')?.reps).toBe(1);
  });

  it('lets an in-flight attempt land before the import replaces it', async () => {
    const store = new PracticeStore();
    // Recorded and queued, then imported over — the queued write must not
    // resurrect itself on top of the imported log.
    store.record(attempt());
    await store.replaceAll({ attempts: [], skills: [] });
    await settle();

    const reopened = new PracticeStore();
    await reopened.hydrate();
    expect(reopened.attempts).toHaveLength(0);
  });

  it('imports in memory when there is no storage, and says it is degraded', async () => {
    Reflect.deleteProperty(globalThis, 'indexedDB');
    const store = new PracticeStore();
    const onError = vi.fn();
    store.onError = onError;

    const persisted = await store.replaceAll({
      attempts: [{ ...attempt(), attemptId: 'x' }],
      skills: [],
    });

    expect(persisted).toBe(false);
    expect(store.attempts).toHaveLength(1);
    expect(store.degraded).toBe(true);
    // The storage-failure sentence is about a lost *attempt*; the import has
    // its own line, and the component is what says it.
    expect(onError).not.toHaveBeenCalled();
  });

  it('resets everything, on disk as well as on screen', async () => {
    const store = new PracticeStore();
    store.record(attempt());
    store.record(attempt({ ts: 1_700_000_030_000, questionId: 'second' }));
    await settle();

    const persisted = await store.resetAll();

    expect(persisted).toBe(true);
    expect(store.attempts).toEqual([]);
    expect(store.skills).toEqual([]);
    expect(store.masteryFor(['find-the-note:pc:0'])).toBeNull();
    expect(store.degraded).toBe(false);

    const reopened = new PracticeStore();
    await reopened.hydrate();
    expect(reopened.attempts).toEqual([]);
    expect(reopened.skills).toEqual([]);
  });

  it('lets an attempt recorded a moment earlier land, then wipes it too', async () => {
    // The reset is on the write queue: the queued write must not resurrect
    // itself on top of an emptied log.
    const store = new PracticeStore();
    store.record(attempt());
    await store.resetAll();
    await settle();

    const reopened = new PracticeStore();
    await reopened.hydrate();
    expect(reopened.attempts).toEqual([]);
  });

  it('resets in memory when there is no storage, and says it is degraded', async () => {
    Reflect.deleteProperty(globalThis, 'indexedDB');
    const store = new PracticeStore();
    const onError = vi.fn();
    store.onError = onError;
    // Seeded through the import path, so nothing has reported a failed write
    // yet — this asserts what the *reset* says, not what a lost attempt said.
    await store.replaceAll({
      attempts: [{ ...attempt(), attemptId: 'x' }],
      skills: [],
    });
    expect(store.attempts).toHaveLength(1);

    const persisted = await store.resetAll();

    expect(persisted).toBe(false);
    expect(store.attempts).toEqual([]);
    expect(store.skills).toEqual([]);
    expect(store.degraded).toBe(true);
    // Like the import: the storage sentence is about a lost *attempt*, and the
    // section has its own line for a reset that could not be saved.
    expect(onError).not.toHaveBeenCalled();
  });

  it('`sync()` waits for queued writes, then re-reads storage', async () => {
    const store = new PracticeStore();
    await store.hydrate();
    const writer = new PracticeStore();
    writer.record(attempt());
    await settle();

    // No `settle()` here: `sync()` is what export relies on to see its own
    // writes and anything another tab has written.
    store.record(attempt({ ts: 1_700_000_500_000, questionId: 'mine' }));
    await store.sync();
    expect(store.attempts.map((item) => item.questionId)).toEqual([
      'find-the-note:7:60',
      'mine',
    ]);
  });

  it('`flush()` makes an attempt durable before the user has left', async () => {
    // The leave paths' promise: answer, navigate, and what the next screen
    // (or the next page load) reads already includes it. No `settle()` — the
    // flush is the only thing waited on.
    const store = new PracticeStore();
    store.record(attempt());
    await expect(store.flush()).resolves.toBe(true);

    const reopened = new PracticeStore();
    await reopened.hydrate();
    expect(reopened.attempts.map((item) => item.questionId)).toEqual([
      'find-the-note:7:60',
    ]);
  });

  it('`flush()` on an empty queue is a no-op, and is idempotent', async () => {
    const store = new PracticeStore();
    const timer = vi.spyOn(globalThis, 'setTimeout');

    // Nothing recorded: no deadline timer, nothing to wait for — a leave path
    // may fire this on every navigation.
    await expect(store.flush()).resolves.toBe(true);
    expect(timer).not.toHaveBeenCalled();

    store.record(attempt());
    await store.flush();
    // Flushed twice over: the queue is empty the second time, so it takes the
    // same free path.
    timer.mockClear();
    await expect(store.flush()).resolves.toBe(true);
    expect(timer).not.toHaveBeenCalled();
    timer.mockRestore();
  });

  it('`flush()` waits for an attempt recorded while it was waiting', async () => {
    // Answer, leave, and the reveal's last attempt lands mid-flush: awaiting
    // the queue once would capture the chain as it was and leave it behind.
    const store = new PracticeStore();
    store.record(attempt());
    const flushed = store.flush();
    store.record(attempt({ ts: 1_700_000_030_000, questionId: 'late' }));
    await expect(flushed).resolves.toBe(true);

    const reopened = new PracticeStore();
    await reopened.hydrate();
    expect(reopened.attempts.map((item) => item.questionId)).toEqual([
      'find-the-note:7:60',
      'late',
    ]);
  });

  it('`flush()` without storage does not throw and reports nothing of its own', async () => {
    Reflect.deleteProperty(globalThis, 'indexedDB');
    const store = new PracticeStore();
    const onError = vi.fn();
    store.onError = onError;

    // Nothing was ever recorded, so nothing was lost: the flush is silent.
    await expect(store.flush()).resolves.toBe(true);
    expect(onError).not.toHaveBeenCalled();
    expect(store.degraded).toBe(false);

    // And with a queued write that cannot land, the sentence comes from the
    // write (once), never from the flush.
    store.record(attempt());
    await expect(store.flush()).resolves.toBe(true);
    await expect(store.flush()).resolves.toBe(true);
    expect(store.degraded).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(PRACTICE_COPY.storageFailed);
  });

  it('`flush()` gives up on its deadline rather than hanging a navigation', async () => {
    // `openPracticeStorage()` may legitimately wait forever — another tab
    // holding an older database version open. A navigation may not.
    // A request that never fires `success` or `error`: `openDB` promisifies it
    // and waits, which is exactly what a blocked open looks like.
    const stuck = Object.assign(Object.create(IDBRequest.prototype), {
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      value: { open: () => stuck },
      configurable: true,
      writable: true,
    });
    const store = new PracticeStore();
    store.record(attempt());

    vi.useFakeTimers();
    try {
      const flushed = store.flush(50);
      await vi.advanceTimersByTimeAsync(50);
      await expect(flushed).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps practising without storage, and says so once', async () => {
    Reflect.deleteProperty(globalThis, 'indexedDB');
    const store = new PracticeStore();
    const onError = vi.fn();
    store.onError = onError;

    store.record(attempt());
    store.record(attempt({ questionId: 'second' }));
    await settle();

    expect(store.attempts).toHaveLength(2);
    expect(store.degraded).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(PRACTICE_COPY.storageFailed);
    await expect(store.hydrate()).resolves.toBeUndefined();
    expect(store.hydrated).toBe(true);
  });
});
