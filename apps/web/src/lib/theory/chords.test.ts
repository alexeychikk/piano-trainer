import { describe, expect, it } from 'vitest';
import {
  chordIntervals,
  chordNotes,
  chordQualityName,
  chordQualityShortName,
  chordSymbolText,
  detectChords,
  intervalsAboveBass,
  isBuildableQuality,
  qualityOfIntervals,
  spellsQuality,
  spellsQualityFromRoot,
  spellsQualityInAnyInversion,
  spokenChordQuality,
  toChordSymbol,
} from './chords';

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

describe('chord-quality vocabulary', () => {
  it('builds a quality from its root, in root position', () => {
    expect(chordNotes(60, 'maj7')).toEqual([60, 64, 67, 71]);
    expect(chordNotes(62, 'min7b5')).toEqual([62, 65, 68, 72]);
  });

  it('has no interval set for an altered dominant', () => {
    expect(chordIntervals('dom7alt')).toBeNull();
    expect(isBuildableQuality('dom7alt')).toBe(false);
    expect(isBuildableQuality('dim7')).toBe(true);
    expect(chordNotes(60, 'dom7alt')).toBeNull();
  });

  it('names a quality three ways, and never as an interval', () => {
    expect(chordQualityName('dom7')).toBe('Dominant 7th chord');
    expect(chordQualityShortName('dom7')).toBe('7');
    expect(spokenChordQuality('dom7')).toBe('a dominant 7th chord');
    expect(spokenChordQuality('aug')).toBe('an augmented triad');
  });

  it('reads the structure above the lowest note, ignoring octaves', () => {
    // C3 E4 G4 B5 is still a major 7th chord in root position.
    expect(intervalsAboveBass([48, 64, 67, 83])).toEqual([0, 4, 7, 11]);
    // A doubled root changes nothing.
    expect(intervalsAboveBass([60, 64, 67, 72])).toEqual([0, 4, 7]);
    expect(intervalsAboveBass([])).toEqual([]);
  });

  it('names the quality a structure spells, or nothing', () => {
    expect(qualityOfIntervals([0, 3, 6, 10])).toBe('min7b5');
    expect(qualityOfIntervals([0, 4, 7, 10, 14])).toBe('dom9');
    expect(qualityOfIntervals([0, 1, 2])).toBeNull();
  });

  it('matches a quality from any root, octave and voicing', () => {
    expect(spellsQuality([60, 64, 67, 71], 'maj7')).toBe(true);
    // Any key: the same shape from Eb.
    expect(spellsQuality([63, 67, 70, 74], 'maj7')).toBe(true);
    // Any spacing, and enharmonics compare equal for free (it is arithmetic).
    expect(spellsQuality([48, 64, 79, 83], 'maj7')).toBe(true);
    // A missing note is not the chord.
    expect(spellsQuality([60, 64, 67], 'maj7')).toBe(false);
  });

  it('reads the lowest note as the root, so an inversion is not a match', () => {
    // E G B C — a Cmaj7 over E.
    expect(spellsQuality([64, 67, 71, 72], 'maj7')).toBe(false);
    expect(spellsQualityInAnyInversion([64, 67, 71, 72], 'maj7')).toBe(true);
    expect(spellsQualityInAnyInversion([60, 64, 67, 70], 'maj7')).toBe(false);
    // A diminished 7th is symmetric: every inversion is root position too.
    expect(spellsQuality([63, 66, 69, 72], 'dim7')).toBe(true);
  });

  it('is silent about a quality it cannot build', () => {
    expect(spellsQuality([60, 64, 67], 'dom7alt')).toBe(false);
    expect(spellsQualityInAnyInversion([60, 64, 67], 'dom7alt')).toBe(false);
    expect(spellsQuality([], 'maj7')).toBe(false);
  });
});

describe('chordSymbolText', () => {
  it('prints the symbol a chart would print', () => {
    expect(chordSymbolText(0, 'maj7')).toBe('Cmaj7');
    expect(chordSymbolText(1, 'dom7')).toBe('Db7');
    expect(chordSymbolText(10, 'min7')).toBe('Bbm7');
    expect(chordSymbolText(6, 'min7b5')).toBe('Gbm7b5');
  });

  it('spells sharp when asked to', () => {
    expect(chordSymbolText(6, 'dom7', 'sharp')).toBe('F#7');
  });

  it('prints a major triad bare — a chart writes `C`, never `Cmaj`', () => {
    expect(chordSymbolText(0, 'maj')).toBe('C');
    expect(chordSymbolText(4, 'maj')).toBe('E');
    // The grid still needs the word, and the other qualities are unchanged.
    expect(chordQualityShortName('maj')).toBe('maj');
    expect(chordSymbolText(0, 'min')).toBe('Cm');
  });
});

describe('spellsQualityFromRoot', () => {
  it('pins the key: the same colour from another root is not the chord', () => {
    // Cmaj7 in any register, spacing or doubling, but rooted on C.
    expect(spellsQualityFromRoot([60, 64, 67, 71], 0, 'maj7')).toBe(true);
    expect(spellsQualityFromRoot([48, 64, 79, 83], 0, 'maj7')).toBe(true);
    // Dbmaj7 is the same quality and a different chord.
    expect(spellsQualityFromRoot([61, 65, 68, 72], 0, 'maj7')).toBe(false);
    expect(spellsQualityFromRoot([61, 65, 68, 72], 1, 'maj7')).toBe(true);
  });

  it('is root position: the lowest note played is the root', () => {
    expect(spellsQualityFromRoot([64, 67, 71, 72], 0, 'maj7')).toBe(false);
    expect(spellsQualityFromRoot([], 0, 'maj7')).toBe(false);
  });

  it('is enharmonic-blind, like every other comparison here', () => {
    // D#m7 spelled as Ebm7: the same integers, the same pitch class.
    expect(spellsQualityFromRoot([63, 66, 70, 73], 3, 'min7')).toBe(true);
  });
});
