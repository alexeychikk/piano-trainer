import { describe, expect, it } from 'vitest';
import {
  PRACTICE_SCHEMA_VERSION,
  type SkillState,
  type StoredAttempt,
} from '$lib/storage/db';
import { DEFAULT_SETTINGS } from '$lib/storage/settings.svelte';
import { PRACTICE_COPY } from './copy';
import {
  buildPracticeFile,
  exportFilename,
  parsePracticeFile,
  serialisePracticeFile,
} from './transfer';

function attempt(overrides: Partial<StoredAttempt> = {}): StoredAttempt {
  return {
    attemptId: '1700000000000:find-the-note:7:60',
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

function skill(overrides: Partial<SkillState> = {}): SkillState {
  return {
    skillId: 'find-the-note:pc:0',
    exerciseId: 'find-the-note',
    reps: 3,
    lapses: 1,
    easiness: 2.5,
    intervalDays: 0,
    dueAt: 0,
    mastery: 0.42,
    lastSeenAt: 1_700_000_000_000,
    ...overrides,
  };
}

const EXPORTED_AT = 1_757_800_000_000;

function fileText(
  data: {
    attempts?: StoredAttempt[];
    skills?: SkillState[];
  } = {},
) {
  return serialisePracticeFile(
    buildPracticeFile({
      settings: { ...DEFAULT_SETTINGS, noteLabels: 'all' },
      data: {
        attempts: data.attempts ?? [attempt()],
        skills: data.skills ?? [skill()],
      },
      exportedAt: EXPORTED_AT,
    }),
  );
}

describe('buildPracticeFile', () => {
  it('carries the schema version, the clock and both logs', () => {
    const file = buildPracticeFile({
      settings: DEFAULT_SETTINGS,
      data: { attempts: [attempt()], skills: [skill()] },
      exportedAt: EXPORTED_AT,
    });
    expect(file.schemaVersion).toBe(PRACTICE_SCHEMA_VERSION);
    expect(file.exportedAt).toBe(EXPORTED_AT);
    expect(file.attempts).toHaveLength(1);
    expect(file.skills).toHaveLength(1);
    expect(file.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('orders attempts by time and skills by id — a backup diffs cleanly', () => {
    const file = buildPracticeFile({
      settings: DEFAULT_SETTINGS,
      data: {
        attempts: [
          attempt({ ts: 3, attemptId: 'c' }),
          attempt({ ts: 1, attemptId: 'a' }),
          attempt({ ts: 2, attemptId: 'b' }),
        ],
        skills: [skill({ skillId: 'z' }), skill({ skillId: 'a' })],
      },
      exportedAt: EXPORTED_AT,
    });
    expect(file.attempts.map((item) => item.attemptId)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(file.skills.map((item) => item.skillId)).toEqual(['a', 'z']);
  });
});

describe('exportFilename', () => {
  it('is `piano-trainer-YYYY-MM-DD.json` in the local timezone', () => {
    const at = new Date(2026, 8, 14, 13, 30).getTime();
    expect(exportFilename(at)).toBe('piano-trainer-2026-09-14.json');
  });

  it('pads single-digit months and days', () => {
    const at = new Date(2027, 0, 5, 9, 0).getTime();
    expect(exportFilename(at)).toBe('piano-trainer-2027-01-05.json');
  });
});

describe('parsePracticeFile — a file we wrote', () => {
  it('round-trips export → import', () => {
    const parsed = parsePracticeFile(fileText());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.attempts).toEqual([attempt()]);
    expect(parsed.file.skills).toEqual([skill()]);
    expect(parsed.file.settings.noteLabels).toBe('all');
    expect(parsed.file.exportedAt).toBe(EXPORTED_AT);
  });

  it('keys an attempt that arrives without one (another device)', () => {
    const raw = JSON.stringify({
      schemaVersion: PRACTICE_SCHEMA_VERSION,
      exportedAt: EXPORTED_AT,
      settings: {},
      skills: [],
      attempts: [{ ...attempt(), attemptId: undefined }],
    });
    const parsed = parsePracticeFile(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.attempts[0].attemptId).toBe(
      '1700000000000:find-the-note:7:60',
    );
  });

  it('drops a record that is not one, and keeps the rest', () => {
    const raw = JSON.stringify({
      schemaVersion: PRACTICE_SCHEMA_VERSION,
      exportedAt: EXPORTED_AT,
      settings: {},
      skills: [skill(), { nonsense: true }],
      attempts: [attempt(), { questionId: 42 }, null],
    });
    const parsed = parsePracticeFile(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.attempts).toHaveLength(1);
    expect(parsed.file.skills).toHaveLength(1);
  });

  it('de-duplicates an attempt that appears twice', () => {
    const parsed = parsePracticeFile(
      fileText({ attempts: [attempt(), attempt()] }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.attempts).toHaveLength(1);
  });

  it('accepts an empty but well-formed file', () => {
    const parsed = parsePracticeFile(fileText({ attempts: [], skills: [] }));
    expect(parsed.ok).toBe(true);
  });
});

describe('parsePracticeFile — a file we refuse', () => {
  it('refuses a newer schema, and says which (copy deck)', () => {
    const raw = JSON.stringify({
      schemaVersion: PRACTICE_SCHEMA_VERSION + 1,
      exportedAt: EXPORTED_AT,
      settings: {},
      skills: [],
      attempts: [],
    });
    const parsed = parsePracticeFile(raw);
    expect(parsed).toEqual({
      ok: false,
      reason: 'version',
      message: `This file is from schema v${
        PRACTICE_SCHEMA_VERSION + 1
      }; this app reads v${PRACTICE_SCHEMA_VERSION}.`,
    });
  });

  it('accepts an older schema — we still understand it', () => {
    const raw = JSON.stringify({
      schemaVersion: PRACTICE_SCHEMA_VERSION - 1,
      settings: {},
      skills: [skill()],
      attempts: [attempt()],
    });
    expect(parsePracticeFile(raw).ok).toBe(true);
  });

  it('refuses anything that is not our envelope', () => {
    for (const raw of [
      '',
      'not json at all',
      '[]',
      '"a string"',
      'null',
      JSON.stringify({ attempts: [], skills: [] }),
      JSON.stringify({ schemaVersion: 'one', attempts: [], skills: [] }),
      JSON.stringify({ schemaVersion: PRACTICE_SCHEMA_VERSION, skills: [] }),
      JSON.stringify({
        schemaVersion: PRACTICE_SCHEMA_VERSION,
        attempts: {},
        skills: [],
      }),
    ]) {
      const parsed = parsePracticeFile(raw);
      expect(parsed, raw).toEqual({
        ok: false,
        reason: 'invalid',
        message: PRACTICE_COPY.importInvalid,
      });
    }
  });

  it('refuses a file whose every record is junk, rather than importing none', () => {
    // The envelope is right and it claims to hold data, so importing it as an
    // empty log would quietly replace a real one.
    const raw = JSON.stringify({
      schemaVersion: PRACTICE_SCHEMA_VERSION,
      exportedAt: EXPORTED_AT,
      settings: {},
      attempts: [1, 2, 3],
      skills: ['nope'],
    });
    const parsed = parsePracticeFile(raw);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('invalid');
  });

  it('falls back to default settings when the file has none it knows', () => {
    const raw = JSON.stringify({
      schemaVersion: PRACTICE_SCHEMA_VERSION,
      settings: 'corrupt',
      attempts: [attempt()],
      skills: [],
    });
    const parsed = parsePracticeFile(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.settings).toEqual(DEFAULT_SETTINGS);
  });
});
