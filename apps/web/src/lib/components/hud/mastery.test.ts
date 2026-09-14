import { describe, expect, it } from 'vitest';
import {
  PIP_COUNT,
  filledPips,
  masteryLabel,
  masteryPercent,
  masteryTone,
} from './mastery';

describe('filledPips', () => {
  it('quantises 0..1 onto the seven pips', () => {
    expect(filledPips(0)).toBe(0);
    expect(filledPips(0.5)).toBe(4); // round(3.5) — the spec says round
    expect(filledPips(0.71)).toBe(5);
    expect(filledPips(1)).toBe(PIP_COUNT);
  });

  it('treats an unseen skill as empty, not as zero mastery', () => {
    expect(filledPips(null)).toBe(0);
    expect(masteryTone(null)).toBe('neutral');
    expect(masteryTone(0)).toBe('warn');
  });

  it('survives out-of-range and NaN values rather than drawing 9 pips', () => {
    expect(filledPips(1.4)).toBe(PIP_COUNT);
    expect(filledPips(-3)).toBe(0);
    expect(filledPips(Number.NaN)).toBe(0);
  });
});

describe('masteryPercent', () => {
  it('rounds to a whole percentage', () => {
    expect(masteryPercent(0.714)).toBe(71);
    expect(masteryPercent(0.716)).toBe(72);
  });
});

describe('masteryTone', () => {
  it('follows the UX spec thresholds', () => {
    expect(masteryTone(0.7)).toBe('success');
    expect(masteryTone(0.69)).toBe('accent');
    expect(masteryTone(0.3)).toBe('accent');
    expect(masteryTone(0.29)).toBe('warn');
  });
});

describe('masteryLabel', () => {
  it('spells the number out and names the skill when there is one', () => {
    expect(masteryLabel(0.71)).toBe('mastery 71 percent');
    expect(masteryLabel(0.71, 'Find the note')).toBe(
      'Find the note: mastery 71 percent',
    );
    expect(masteryLabel(null, 'Find the note')).toBe(
      'Find the note: not practised yet',
    );
  });
});
