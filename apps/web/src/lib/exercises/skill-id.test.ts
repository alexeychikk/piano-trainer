import { describe, expect, it } from 'vitest';
import {
  MAX_SEMITONE_SEGMENT,
  integerSegment,
  pitchClassSegment,
  skillIdSegments,
} from './skill-id';

describe('skillIdSegments', () => {
  it('splits an id of this exercise into its parts', () => {
    expect(skillIdSegments('play-the-voicing:maj7:3', 'play-the-voicing', 2)) //
      .toEqual(['maj7', '3']);
    expect(skillIdSegments('chord-quality:min7', 'chord-quality', 1)).toEqual([
      'min7',
    ]);
  });

  it('is null for another exercise, and for a bare exercise id', () => {
    expect(skillIdSegments('chord-quality:min7', 'play-the-voicing', 1)).toBe(
      null,
    );
    expect(skillIdSegments('chord-quality', 'chord-quality', 1)).toBe(null);
  });

  it('is null when the id has the wrong number of parts', () => {
    // A colon smuggled into a segment is a different id, not a longer one.
    expect(skillIdSegments('chord-quality:min7:3', 'chord-quality', 1)).toBe(
      null,
    );
    expect(
      skillIdSegments('play-the-voicing:maj7', 'play-the-voicing', 2),
    ).toBe(null);
  });
});

describe('integerSegment', () => {
  it('reads the digits we write', () => {
    expect(integerSegment('0', 11)).toBe(0);
    expect(integerSegment('11', 11)).toBe(11);
    expect(integerSegment('127', MAX_SEMITONE_SEGMENT)).toBe(127);
  });

  it('is null outside the bound', () => {
    expect(integerSegment('12', 11)).toBe(null);
    expect(integerSegment('128', MAX_SEMITONE_SEGMENT)).toBe(null);
  });

  it('is null for anything `Number()` would be lenient about', () => {
    // `Number('')` is 0 and `Number(' 3 ')` is 3: both used to label a
    // hand-edited id as a real skill.
    expect(integerSegment('', 11)).toBe(null);
    expect(integerSegment(' 3 ', 11)).toBe(null);
    expect(integerSegment('-5', 11)).toBe(null);
    expect(integerSegment('0x0', 11)).toBe(null);
    expect(integerSegment('1e21', MAX_SEMITONE_SEGMENT)).toBe(null);
    expect(integerSegment('3.0', 11)).toBe(null);
    expect(integerSegment('03', 11)).toBe(null);
    expect(integerSegment('NaN', 11)).toBe(null);
    expect(integerSegment('Infinity', 11)).toBe(null);
  });
});

describe('pitchClassSegment', () => {
  it('is the twelve pitch classes and nothing else', () => {
    expect(
      Array.from({ length: 12 }, (_, pc) => pitchClassSegment(String(pc))),
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(pitchClassSegment('12')).toBe(null);
    expect(pitchClassSegment('constructor')).toBe(null);
  });
});
