import { describe, expect, it } from 'vitest';
import { countInClicks, countInLeadMs, planDurationMs } from './playback';
import type { PlaybackPlan } from './types';

const plan: PlaybackPlan = {
  events: [
    { atMs: 0, notes: [60], durationMs: 500 },
    { atMs: 400, notes: [64], durationMs: 900 },
  ],
};

describe('planDurationMs', () => {
  it('runs to the end of the last note, not the last onset', () => {
    expect(planDurationMs(plan)).toBe(1300);
  });

  it('is zero for an empty plan', () => {
    expect(planDurationMs({ events: [] })).toBe(0);
  });
});

describe('countInClicks', () => {
  it('counts nothing in when the setting is off', () => {
    expect(countInClicks('off', 120, 4)).toEqual([]);
    expect(countInLeadMs('off', 120, 4)).toBe(0);
  });

  it('is one bar of beats at the metronome tempo, downbeat accented', () => {
    // 120 bpm → 500 ms per beat.
    expect(countInClicks('1-bar', 120, 4)).toEqual([
      { atMs: 0, accent: true },
      { atMs: 500, accent: false },
      { atMs: 1000, accent: false },
      { atMs: 1500, accent: false },
    ]);
  });

  it('delays the question by the whole bar, last beat included', () => {
    expect(countInLeadMs('1-bar', 120, 4)).toBe(2000);
    expect(countInLeadMs('1-bar', 60, 3)).toBe(3000);
  });

  it('follows the metre', () => {
    expect(countInClicks('1-bar', 90, 3)).toHaveLength(3);
    expect(countInClicks('1-bar', 90, 7)).toHaveLength(7);
  });

  it('clamps an out-of-range tempo or metre the way the metronome does', () => {
    expect(countInClicks('1-bar', 10_000, 99)).toHaveLength(12);
    expect(countInLeadMs('1-bar', 10_000, 1)).toBeCloseTo(250, 5);
  });
});
