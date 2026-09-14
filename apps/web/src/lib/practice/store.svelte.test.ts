// See `storage/db.test.ts`: `idb` needs the whole IDB global family, and each
// test swaps in a fresh factory so one store's data never leaks into the next.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredAttempt } from '$lib/storage/db';
import { PRACTICE_COPY } from './copy';
import { PracticeStore } from './store.svelte';

function attempt(overrides: Partial<StoredAttempt> = {}): StoredAttempt {
  return {
    id: 'find-the-note:7:60',
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
      attempt({ id: 'find-the-note:8:62', correct: false, score: 0 }),
    );
    await settle();

    const second = new PracticeStore();
    await second.hydrate();
    expect(second.hydrated).toBe(true);
    expect(second.attempts).toHaveLength(2);
    expect(second.byId.get('find-the-note:pc:0')?.reps).toBe(2);
    expect(second.masteryFor(['find-the-note:pc:0'])).toBeCloseTo(0.21);
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

  it('keeps practising without storage, and says so once', async () => {
    Reflect.deleteProperty(globalThis, 'indexedDB');
    const store = new PracticeStore();
    const onError = vi.fn();
    store.onError = onError;

    store.record(attempt());
    store.record(attempt({ id: 'second' }));
    await settle();

    expect(store.attempts).toHaveLength(2);
    expect(store.degraded).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(PRACTICE_COPY.storageFailed);
    await expect(store.hydrate()).resolves.toBeUndefined();
    expect(store.hydrated).toBe(true);
  });
});
