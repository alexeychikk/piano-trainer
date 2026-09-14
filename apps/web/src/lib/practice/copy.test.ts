import { describe, expect, it } from 'vitest';
import { skillDetail, timeAgo } from './copy';

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
