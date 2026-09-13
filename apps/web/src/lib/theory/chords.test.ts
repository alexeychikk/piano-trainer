import { describe, expect, it } from 'vitest';
import { detectChords, toChordSymbol } from './chords';

describe('detectChords', () => {
  it('needs at least two notes', () => {
    expect(detectChords([])).toEqual([]);
    expect(detectChords([60])).toEqual([]);
  });

  it('detects a major triad and names it', () => {
    const [first] = detectChords([60, 64, 67]);
    expect(first.name).toBe('CM');
    expect(first.symbol).toEqual({ rootPc: 0, quality: 'maj' });
  });

  it('reports an inversion as a slash chord', () => {
    const names = detectChords([52, 60, 67]).map((chord) => chord.name);
    expect(names).toContain('CM/E');
    expect(toChordSymbol('CM/E')).toEqual({
      rootPc: 0,
      quality: 'maj',
      bassPc: 4,
    });
  });

  it('detects seventh chords from the jazz vocabulary', () => {
    expect(detectChords([60, 63, 66, 70])[0].symbol).toEqual({
      rootPc: 0,
      quality: 'min7b5',
    });
    expect(detectChords([62, 66, 69, 72])[0].symbol).toEqual({
      rootPc: 2,
      quality: 'dom7',
    });
  });

  it('ignores duplicated octaves of the same pitch', () => {
    expect(detectChords([60, 64, 67, 60])).toEqual(detectChords([60, 64, 67]));
  });

  it('keeps the display name when the quality is outside our vocabulary', () => {
    const exotic = toChordSymbol('Em#5');
    expect(exotic).toBeNull();
  });
});
