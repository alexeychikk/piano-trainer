import { describe, expect, it } from 'vitest';
import { MAX_BPM, MIN_BPM } from './scheduler';
import { TEMPO_RANGE_HINT, readTempoField } from './tempo-field';

describe('readTempoField', () => {
  it('commits a value inside the range unchanged', () => {
    expect(readTempoField('120')).toEqual({ bpm: 120, outOfRange: false });
  });

  it('accepts the range boundaries', () => {
    expect(readTempoField(String(MIN_BPM))).toEqual({
      bpm: MIN_BPM,
      outOfRange: false,
    });
    expect(readTempoField(String(MAX_BPM))).toEqual({
      bpm: MAX_BPM,
      outOfRange: false,
    });
  });

  it('clamps above the maximum and flags it out of range (§8.4)', () => {
    // The bug this closes: the field read 400 while the metronome ran at max.
    expect(readTempoField('400')).toEqual({ bpm: MAX_BPM, outOfRange: true });
  });

  it('clamps below the minimum and flags it out of range', () => {
    expect(readTempoField('8')).toEqual({ bpm: MIN_BPM, outOfRange: true });
  });

  it('rounds a fractional tempo without calling it out of range', () => {
    expect(readTempoField('119.6')).toEqual({ bpm: 120, outOfRange: false });
  });

  it('has nothing to commit for an empty or unparseable field', () => {
    // Not "invalid": unfinished. Flagging it mid-edit would be noise.
    for (const raw of ['', '   ', 'fast']) {
      expect(readTempoField(raw)).toEqual({ bpm: null, outOfRange: false });
    }
  });

  it('takes the hint numbers from the scheduler, not from the copy', () => {
    expect(TEMPO_RANGE_HINT).toBe(`${MIN_BPM}–${MAX_BPM} bpm`);
  });
});
