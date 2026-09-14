/**
 * The practice-data file (slice 5b): build it, serialise it, and — the half
 * that matters — parse a file someone hands back.
 *
 * Pure, like `progress.ts`: no DOM, no storage, no clock of its own. The
 * browser half (the download, the file picker) lives in `download.ts` and in
 * the component; everything decidable is decided here so it is tested without
 * a browser.
 *
 * The payload is `{ schemaVersion, exportedAt, settings, skills, attempts }`.
 * `schemaVersion` is `PRACTICE_SCHEMA_VERSION` — the same number the database
 * carries — so a file written by a newer build is refused instead of being
 * half-understood, exactly as the database is (`db.ts`).
 *
 * Validation is the storage layer's rule applied to a stranger's file: every
 * record goes through `parseAttempt`/`parseSkill`, a record that is not the
 * shape we expect is dropped rather than trusted, and an attempt that arrives
 * without a key (another device's export, a hand-written file) is keyed on
 * read. A file whose records *all* fail is not a piano-trainer file at all, and
 * is rejected rather than imported as nothing.
 */

import {
  parseAttempt,
  parseSkill,
  PRACTICE_SCHEMA_VERSION,
  type PracticeData,
  type SkillState,
  type StoredAttempt,
} from '$lib/storage/db';
import {
  parseSettingsValue,
  type AppSettings,
} from '$lib/storage/settings.svelte';
import { PRACTICE_COPY, importWrongVersion } from './copy';

export interface PracticeFile {
  schemaVersion: number;
  /** Epoch ms, like every other timestamp in the payload. */
  exportedAt: number;
  settings: AppSettings;
  skills: SkillState[];
  attempts: StoredAttempt[];
}

/** Why a file was refused — the caller turns it into the banner's tone. */
export type ImportRejection = 'invalid' | 'version';

export type ImportResult =
  | { ok: true; file: PracticeFile }
  | { ok: false; reason: ImportRejection; message: string };

export function buildPracticeFile(input: {
  settings: AppSettings;
  data: PracticeData;
  exportedAt: number;
}): PracticeFile {
  return {
    schemaVersion: PRACTICE_SCHEMA_VERSION,
    exportedAt: input.exportedAt,
    settings: { ...input.settings },
    // Plain objects, ordered: a backup should diff cleanly against the next
    // one rather than reordering itself.
    skills: input.data.skills
      .map((skill) => ({ ...skill }))
      .sort((a, b) => a.skillId.localeCompare(b.skillId)),
    attempts: input.data.attempts
      .map((attempt) => ({ ...attempt }))
      .sort((a, b) => a.ts - b.ts),
  };
}

/** Indented on purpose: the owner's backup is theirs to read. */
export function serialisePracticeFile(file: PracticeFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** `piano-trainer-2026-09-14.json` (UX §6.1), in the user's own timezone. */
export function exportFilename(exportedAt: number): string {
  const at = new Date(exportedAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  return `piano-trainer-${date}.json`;
}

/** Parse and validate a file's text. Never throws. */
export function parsePracticeFile(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return invalid();
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid();
  const record = raw as Record<string, unknown>;

  const schemaVersion = record.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isFinite(schemaVersion)) {
    return invalid();
  }
  if (schemaVersion > PRACTICE_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: 'version',
      message: importWrongVersion(schemaVersion, PRACTICE_SCHEMA_VERSION),
    };
  }
  if (!Array.isArray(record.attempts) || !Array.isArray(record.skills)) {
    return invalid();
  }

  const attempts = dedupe(
    record.attempts
      .map(parseAttempt)
      .filter((attempt): attempt is StoredAttempt => attempt !== null),
  ).sort((a, b) => a.ts - b.ts);
  const skills = record.skills
    .map(parseSkill)
    .filter((skill): skill is SkillState => skill !== null);

  const offered = record.attempts.length + record.skills.length;
  if (offered > 0 && attempts.length + skills.length === 0) {
    // Right envelope, nothing inside it we recognise: refusing beats replacing
    // a real log with an empty one.
    return invalid();
  }

  return {
    ok: true,
    file: {
      schemaVersion,
      exportedAt:
        typeof record.exportedAt === 'number' &&
        Number.isFinite(record.exportedAt)
          ? record.exportedAt
          : 0,
      settings: parseSettingsValue(record.settings),
      skills,
      attempts,
    },
  };
}

/** A file may carry the same attempt twice (two exports, merged by hand). */
function dedupe(attempts: StoredAttempt[]): StoredAttempt[] {
  const byKey = new Map(
    attempts.map((attempt) => [attempt.attemptId, attempt]),
  );
  return [...byKey.values()];
}

function invalid(): ImportResult {
  return {
    ok: false,
    reason: 'invalid',
    message: PRACTICE_COPY.importInvalid,
  };
}
