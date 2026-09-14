import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// `idb` needs the whole IDB global family (`IDBRequest`, `IDBTransaction`, …),
// which jsdom has none of; `/auto` installs them, and each test then swaps in a
// fresh factory so one test's database never leaks into the next.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import {
  openPracticeStorage,
  parseAttempt,
  parseSkill,
  PRACTICE_DB_NAME,
  PRACTICE_SCHEMA_VERSION,
  type StoredAttempt,
  type SkillState,
} from './db';

function attempt(overrides: Partial<StoredAttempt> = {}): StoredAttempt {
  return {
    id: 'find-the-note:1:60',
    ts: 1_700_000_000_000,
    exerciseId: 'find-the-note',
    skillId: 'find-the-note:pc:0',
    seed: 1,
    correct: true,
    score: 1,
    responseMs: 900,
    replays: 0,
    answerSource: 'onscreen',
    ...overrides,
  };
}

function skill(overrides: Partial<SkillState> = {}): SkillState {
  return {
    skillId: 'find-the-note:pc:0',
    exerciseId: 'find-the-note',
    reps: 1,
    lapses: 0,
    easiness: 2.5,
    intervalDays: 0,
    dueAt: 0,
    mastery: 0.3,
    lastSeenAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('parseAttempt', () => {
  it('accepts a well-formed record', () => {
    expect(parseAttempt(attempt())).toEqual(attempt());
  });

  it('rejects anything that is not an attempt', () => {
    expect(parseAttempt(null)).toBeNull();
    expect(parseAttempt('nope')).toBeNull();
    expect(parseAttempt({})).toBeNull();
    expect(parseAttempt({ ...attempt(), id: 42 })).toBeNull();
    expect(parseAttempt({ ...attempt(), ts: 'yesterday' })).toBeNull();
    expect(parseAttempt({ ...attempt(), skillId: undefined })).toBeNull();
  });

  it('repairs fields that are merely wrong, rather than throwing', () => {
    const parsed = parseAttempt({
      ...attempt(),
      score: 9,
      replays: -3,
      responseMs: Number.NaN,
      answerSource: 7,
    });
    expect(parsed).toMatchObject({
      score: 1,
      replays: 0,
      responseMs: 0,
      answerSource: 'unknown',
    });
  });
});

describe('parseSkill', () => {
  it('clamps mastery and fills the SM-2 defaults', () => {
    expect(parseSkill({ skillId: 'a:b', exerciseId: 'a' })).toEqual({
      skillId: 'a:b',
      exerciseId: 'a',
      reps: 0,
      lapses: 0,
      easiness: 2.5,
      intervalDays: 0,
      dueAt: 0,
      mastery: 0,
      lastSeenAt: 0,
    });
    expect(parseSkill({ ...skill(), mastery: 12 })?.mastery).toBe(1);
    expect(parseSkill({ exerciseId: 'a' })).toBeNull();
  });
});

describe('openPracticeStorage', () => {
  beforeEach(() => {
    // A fresh factory per test: `idb` (and the app) read the global one.
    Object.defineProperty(globalThis, 'indexedDB', {
      value: new IDBFactory(),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'indexedDB');
  });

  it('is null when there is no IndexedDB at all', async () => {
    Reflect.deleteProperty(globalThis, 'indexedDB');
    expect(await openPracticeStorage()).toBeNull();
  });

  it('reads back what it wrote', async () => {
    const storage = await openPracticeStorage();
    expect(storage).not.toBeNull();
    await storage!.write(attempt(), skill());
    const snapshot = await storage!.read();
    expect(snapshot.schemaVersion).toBe(PRACTICE_SCHEMA_VERSION);
    expect(snapshot.attempts).toEqual([attempt()]);
    expect(snapshot.skills).toEqual([skill()]);
  });

  it('survives a reopen — attempts are what persistence means', async () => {
    const first = await openPracticeStorage();
    await first!.write(attempt(), skill());
    first!.close();

    const second = await openPracticeStorage();
    const snapshot = await second!.read();
    expect(snapshot.attempts).toHaveLength(1);
    expect(snapshot.skills).toHaveLength(1);
  });

  it('is empty, not broken, before anything has been written', async () => {
    const storage = await openPracticeStorage();
    await expect(storage!.read()).resolves.toEqual({
      schemaVersion: PRACTICE_SCHEMA_VERSION,
      attempts: [],
      skills: [],
    });
  });

  it('drops corrupt records instead of throwing', async () => {
    // Straight past our own writer, the way a hand-edited or half-imported
    // database looks.
    const raw = await openDB(PRACTICE_DB_NAME, PRACTICE_SCHEMA_VERSION, {
      upgrade(db) {
        const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
        attempts.createIndex('by-ts', 'ts');
        attempts.createIndex('by-skill', 'skillId');
        db.createObjectStore('skills', { keyPath: 'skillId' });
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
    await raw.put('attempts', attempt({ id: 'good' }));
    await raw.put('attempts', { id: 'junk', ts: 'whenever' });
    await raw.put('skills', { skillId: 'orphan' });
    raw.close();

    const storage = await openPracticeStorage();
    const snapshot = await storage!.read();
    expect(snapshot.attempts.map((a) => a.id)).toEqual(['good']);
    expect(snapshot.skills).toEqual([]);
  });

  it('refuses a database written by a newer build', async () => {
    const newer = await openDB(PRACTICE_DB_NAME, PRACTICE_SCHEMA_VERSION + 1, {
      upgrade(db) {
        db.createObjectStore('attempts', { keyPath: 'id' });
      },
    });
    newer.close();

    expect(await openPracticeStorage()).toBeNull();
  });
});
