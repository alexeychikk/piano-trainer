import { describe, expect, it } from 'vitest';
import {
  dataStats,
  dueBadge,
  dueNow,
  exportDone,
  skillsDueToday,
  timeUntil,
  importDone,
  importWrongVersion,
  skillDetail,
  timeAgo,
} from './copy';

/** Midday, so a ±hours case never crosses a local midnight by accident. */
const NOW = new Date('2026-09-14T12:00:00').getTime();
const HOUR = 60 * 60_000;

describe('timeAgo', () => {
  it('is coarse on purpose — a detail line, not a clock', () => {
    expect(timeAgo(NOW, NOW)).toBe('just now');
    expect(timeAgo(NOW - 5 * 60_000, NOW)).toBe('5 min ago');
    expect(timeAgo(NOW - 2 * HOUR, NOW)).toBe('2 h ago');
    expect(timeAgo(NOW - 3 * 24 * HOUR, NOW)).toBe('3 d ago');
  });

  it('never reads into the future when clocks disagree', () => {
    expect(timeAgo(NOW + 10 * HOUR, NOW)).toBe('just now');
  });
});

describe('skillDetail', () => {
  it('is UX §6.2 line, minus the clause slice 9 owns', () => {
    expect(
      skillDetail({
        attempts: 12,
        accuracyPercent: 67,
        lastSeenAt: NOW - 2 * HOUR,
        now: NOW,
      }),
    ).toBe('12 attempts · 67% · last seen 2 h ago');
  });

  it('counts one attempt in the singular', () => {
    expect(
      skillDetail({
        attempts: 1,
        accuracyPercent: 100,
        lastSeenAt: NOW,
        now: NOW,
      }),
    ).toBe('1 attempt · 100% · last seen just now');
  });
});

describe('export/import wording (slice 5b)', () => {
  it('reports an export the way the copy deck writes it', () => {
    expect(exportDone(412, 37)).toBe('Exported 412 attempts and 37 skills.');
    expect(exportDone(1, 1)).toBe('Exported 1 attempt and 1 skill.');
  });

  it('reports an import the way UX §6.3 writes it', () => {
    expect(importDone(402, 37)).toBe('Imported 402 attempts, 37 skills.');
  });

  it('names both schema versions when a file is too new', () => {
    expect(importWrongVersion(2, 1)).toBe(
      'This file is from schema v2; this app reads v1.',
    );
  });
});

describe('dataStats', () => {
  it('is the §8.5 line, with the export clause when there was one', () => {
    expect(
      dataStats({
        attempts: 412,
        skills: 37,
        lastExportAt: NOW - 3 * 24 * HOUR,
        now: NOW,
      }),
    ).toBe('412 attempts · 37 skills · last export 3 d ago');
  });

  it('drops the clause entirely before the first export', () => {
    expect(
      dataStats({ attempts: 0, skills: 0, lastExportAt: null, now: NOW }),
    ).toBe('0 attempts · 0 skills');
  });
});

describe('the schedule readouts', () => {
  it('always keeps the word `due` in the text (never colour alone)', () => {
    expect(dueNow(12)).toBe('12 due');
    expect(dueNow(0)).toBe('0 due');
    expect(dueBadge(4)).toBe('Due 4');
  });

  it('counts the skills due today, with the plural', () => {
    expect(skillsDueToday(12)).toBe('12 skills due today');
    expect(skillsDueToday(1)).toBe('1 skill due today');
  });

  it('says how far off the next review is, at `timeAgo`’s granularity', () => {
    expect(timeUntil(NOW + 3 * HOUR, NOW)).toBe('in 3 h');
    expect(timeUntil(NOW + 25 * 60_000, NOW)).toBe('in 25 min');
    expect(timeUntil(NOW + 2 * 24 * HOUR, NOW)).toBe('in 2 d');
    expect(timeUntil(NOW + 20_000, NOW)).toBe('in under a minute');
    // A schedule that has come round is asking *now*, not "in 0 min".
    expect(timeUntil(NOW, NOW)).toBe('now');
    expect(timeUntil(NOW - 5 * HOUR, NOW)).toBe('now');
  });
});
