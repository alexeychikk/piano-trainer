import { describe, expect, it } from 'vitest';
import {
  OCTAVE,
  intervalBetween,
  intervalName,
  intervalShortName,
  isSimpleInterval,
  spokenInterval,
} from './intervals';

describe('intervalBetween', () => {
  it('is signed: up is positive, down is negative', () => {
    expect(intervalBetween(60, 67)).toBe(7);
    expect(intervalBetween(67, 60)).toBe(-7);
    expect(intervalBetween(60, 60)).toBe(0);
  });

  it('is enharmonic-blind, because it is arithmetic on MIDI numbers', () => {
    // Eb4 and D#4 are the same integer, so there is nothing to compare.
    expect(intervalBetween(60, 63)).toBe(intervalBetween(60, 63));
    expect(intervalBetween(60, 72)).toBe(OCTAVE);
  });
});

describe('intervalName', () => {
  it('spells out every simple interval', () => {
    expect(intervalName(0)).toBe('Unison');
    expect(intervalName(1)).toBe('Minor 2nd');
    expect(intervalName(4)).toBe('Major 3rd');
    expect(intervalName(6)).toBe('Tritone');
    expect(intervalName(7)).toBe('Perfect 5th');
    expect(intervalName(11)).toBe('Major 7th');
    expect(intervalName(12)).toBe('Octave');
  });

  it('names a descending interval the same as an ascending one', () => {
    expect(intervalName(-8)).toBe(intervalName(8));
  });

  it('names a compound interval by its simple part plus the octaves', () => {
    expect(intervalName(16)).toBe('Major 3rd + 1 octave');
    expect(intervalName(24)).toBe('2 octaves');
    expect(intervalName(31)).toBe('Perfect 5th + 2 octaves');
  });
});

describe('intervalShortName', () => {
  it('abbreviates for dense grids', () => {
    expect(intervalShortName(0)).toBe('U');
    expect(intervalShortName(3)).toBe('m3');
    expect(intervalShortName(6)).toBe('TT');
    expect(intervalShortName(12)).toBe('P8');
    expect(intervalShortName(19)).toBe('P5+P8');
    expect(intervalShortName(24)).toBe('2×P8');
  });
});

describe('spokenInterval', () => {
  it('builds the copy deck feedback phrase', () => {
    expect(spokenInterval(7)).toBe('a perfect 5th');
    expect(spokenInterval(12)).toBe('an octave');
    expect(spokenInterval(0)).toBe('a unison');
    expect(spokenInterval(8)).toBe('a minor 6th');
  });

  it('does not put an article in front of a plural', () => {
    expect(spokenInterval(24)).toBe('2 octaves');
  });
});

describe('isSimpleInterval', () => {
  it('draws the line at the octave', () => {
    expect(isSimpleInterval(12)).toBe(true);
    expect(isSimpleInterval(-12)).toBe(true);
    expect(isSimpleInterval(13)).toBe(false);
  });
});
