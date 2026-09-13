import { describe, expect, it } from 'vitest';
import {
  MIDDLE_C,
  clampMidi,
  isBlackKey,
  midiToFrequency,
  midiToName,
  nameToMidi,
  notesInRange,
  octaveOf,
  pcOf,
  spokenNoteName,
} from './notes';

describe('pitch identity', () => {
  it('maps middle C to pitch class 0, octave 4', () => {
    expect(pcOf(60)).toBe(0);
    expect(octaveOf(60)).toBe(4);
  });

  it('knows the black keys', () => {
    expect([61, 63, 66, 68, 70].every(isBlackKey)).toBe(true);
    expect([60, 62, 64, 65, 67, 69, 71].some(isBlackKey)).toBe(false);
  });

  it('treats enharmonics as the same pitch', () => {
    expect(nameToMidi('Eb4')).toBe(nameToMidi('D#4'));
  });
});

describe('display spelling', () => {
  it('spells sharps by default and flats on request', () => {
    expect(midiToName(61)).toBe('C#4');
    expect(midiToName(61, 'flat')).toBe('Db4');
    expect(midiToName(60)).toBe('C4');
  });

  it('round-trips through tonal', () => {
    expect(nameToMidi(midiToName(21))).toBe(21);
    expect(nameToMidi(midiToName(108))).toBe(108);
  });

  it('returns null for nonsense', () => {
    expect(nameToMidi('not a note')).toBeNull();
  });

  it('spells accessible names out in words', () => {
    expect(spokenNoteName(61)).toBe('C sharp 4');
    expect(spokenNoteName(21)).toBe('A 0');
  });
});

describe('ranges', () => {
  it('lists every semitone inclusively', () => {
    expect(notesInRange(60, 64)).toEqual([60, 61, 62, 63, 64]);
    expect(notesInRange(60, 60)).toEqual([60]);
    expect(notesInRange(64, 60)).toEqual([]);
  });

  it('clamps to the playable range', () => {
    expect(clampMidi(-4)).toBe(0);
    expect(clampMidi(9000)).toBe(127);
    expect(clampMidi(60)).toBe(60);
  });
});

describe('midiToFrequency', () => {
  it('tunes A4 to 440 Hz', () => {
    expect(midiToFrequency(69)).toBe(440);
  });

  it('doubles every octave', () => {
    expect(midiToFrequency(81)).toBeCloseTo(880, 6);
    expect(midiToFrequency(57)).toBeCloseTo(220, 6);
  });

  it('places middle C just above 261 Hz', () => {
    expect(midiToFrequency(MIDDLE_C)).toBeCloseTo(261.6255653, 6);
  });
});
