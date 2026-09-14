import { describe, expect, it } from 'vitest';
import { chordNotes } from './chords';
import { nameToMidi, pcOf } from './notes';
import {
  PROGRESSION_TYPES,
  chunkIntoChords,
  isProgressionType,
  progressionChordSizes,
  progressionChords,
  progressionLength,
  progressionName,
  progressionNoteCount,
  progressionNotes,
  progressionNumerals,
  progressionShortName,
  progressionSpan,
  progressionSteps,
  progressionText,
  spellsProgression,
  spokenProgression,
} from './progressions';

const C = 0;
const Db = 1;

describe('the progression vocabulary', () => {
  it('knows both ii-V-Is and nothing else yet', () => {
    expect([...PROGRESSION_TYPES]).toEqual(['major-ii-V-I', 'minor-ii-V-i']);
    expect(isProgressionType('major-ii-V-I')).toBe(true);
    expect(isProgressionType('I-VI-ii-V')).toBe(false);
  });

  it('is three chords, ii then V then I', () => {
    expect(progressionLength('major-ii-V-I')).toBe(3);
    expect(progressionNumerals('major-ii-V-I')).toEqual(['ii', 'V', 'I']);
    // The minor tonic is a lower-case numeral, which is how the two cadences
    // are told apart in text (never by colour).
    expect(progressionNumerals('minor-ii-V-i')).toEqual(['ii', 'V', 'i']);
  });

  it('names a cadence in three registers', () => {
    expect(progressionName('major-ii-V-I')).toBe('Major ii-V-I');
    expect(progressionShortName('minor-ii-V-i')).toBe('ii-V-i');
    // Only the first word is lower-cased: the numerals' case is the cadence.
    expect(spokenProgression('minor-ii-V-i')).toBe('a minor ii-V-i');
    expect(spokenProgression('major-ii-V-I')).toBe('a major ii-V-I');
  });
});

describe('progressionChords', () => {
  it('spells the major cadence in C', () => {
    expect(progressionChords(C, 'major-ii-V-I')).toEqual([
      { rootPc: 2, quality: 'min7' },
      { rootPc: 7, quality: 'dom7' },
      { rootPc: 0, quality: 'maj7' },
    ]);
    expect(progressionText(C, 'major-ii-V-I')).toBe('Dm7 · G7 · Cmaj7');
  });

  it('spells the minor cadence with a half-diminished ii and a m7 tonic', () => {
    expect(progressionChords(C, 'minor-ii-V-i')).toEqual([
      { rootPc: 2, quality: 'min7b5' },
      { rootPc: 7, quality: 'dom7' },
      { rootPc: 0, quality: 'min7' },
    ]);
    expect(progressionText(C, 'minor-ii-V-i')).toBe('Dm7b5 · G7 · Cm7');
  });

  it('transposes into all 12 keys by arithmetic, wrapping the octave', () => {
    for (const type of PROGRESSION_TYPES) {
      for (let tonicPc = 0; tonicPc < 12; tonicPc += 1) {
        const chords = progressionChords(tonicPc, type);
        expect(chords).not.toBeNull();
        expect(chords?.map((chord) => chord.rootPc)).toEqual([
          (tonicPc + 2) % 12,
          (tonicPc + 7) % 12,
          tonicPc,
        ]);
      }
    }
    // Db: the roots wrap round C, and the symbols are spelled with flats.
    expect(progressionText(Db, 'major-ii-V-I')).toBe('Ebm7 · Ab7 · Dbmaj7');
  });
});

describe('progressionNotes', () => {
  it('voices the ii above the tonic and the V a fifth below it', () => {
    const tonic = nameToMidi('C3') ?? -1;
    const chords = progressionNotes(tonic, 'major-ii-V-I');
    expect(chords).not.toBeNull();
    const roots = chords?.map((chord) => chord[0]) ?? [];
    expect(roots).toEqual([tonic + 2, tonic - 5, tonic]);
    // Root motion down a fifth: the sound of a cadence, and it keeps the whole
    // progression inside two octaves.
    expect(chords?.[0]).toEqual(chordNotes(tonic + 2, 'min7'));
    expect(chords?.[2]).toEqual(chordNotes(tonic, 'maj7'));
  });

  it('reports the reach a caller needs to keep it inside an instrument', () => {
    const span = progressionSpan('major-ii-V-I');
    // The V's root is five semitones below the tonic; the ii's 7th is 2 + 10.
    expect(span).toEqual({ low: -5, high: 12 });
    const tonic = 60;
    const notes = progressionNotes(tonic, 'major-ii-V-I')?.flat() ?? [];
    expect(Math.min(...notes)).toBe(tonic + span.low);
    expect(Math.max(...notes)).toBe(tonic + span.high);
  });

  it('is twelve notes: three chords of four', () => {
    for (const type of PROGRESSION_TYPES) {
      expect(progressionChordSizes(type)).toEqual([4, 4, 4]);
      expect(progressionNoteCount(type)).toBe(12);
      expect(progressionNotes(60, type)?.flat()).toHaveLength(12);
    }
  });
});

describe('chunkIntoChords', () => {
  it('cuts by count and in played order, never by timing', () => {
    const notes = Array.from({ length: 12 }, (_, index) => 60 + index);
    expect(chunkIntoChords(notes, 'major-ii-V-I')).toEqual([
      [60, 61, 62, 63],
      [64, 65, 66, 67],
      [68, 69, 70, 71],
    ]);
  });

  it('keeps a half-played last chord, so feedback can still describe it', () => {
    expect(chunkIntoChords([60, 61, 62, 63, 64, 65], 'major-ii-V-I')).toEqual([
      [60, 61, 62, 63],
      [64, 65],
    ]);
    expect(chunkIntoChords([], 'major-ii-V-I')).toEqual([]);
  });

  it('puts anything past the cadence in a group of its own', () => {
    const notes = Array.from({ length: 14 }, (_, index) => 60 + index);
    expect(chunkIntoChords(notes, 'major-ii-V-I')).toHaveLength(4);
  });
});

describe('spellsProgression', () => {
  const played = (tonic: number, type: 'major-ii-V-I' | 'minor-ii-V-i') =>
    progressionNotes(tonic, type)?.flat() ?? [];

  it('accepts the cadence as it was voiced', () => {
    for (const type of PROGRESSION_TYPES) {
      for (let tonicPc = 0; tonicPc < 12; tonicPc += 1) {
        const notes = played(48 + tonicPc, type);
        expect(spellsProgression(notes, tonicPc, type)).toBe(true);
      }
    }
  });

  it('accepts any register, spacing and order inside a chord', () => {
    // Dm7 played out of order an octave up, G7 spread over two octaves, Cmaj7
    // in close position: three chords, one cadence in C. Each chord keeps its
    // own root at the bottom; everything else is free.
    const notes = [
      ...[62, 77, 69, 84],
      ...[43, 59, 62, 65],
      ...[60, 64, 67, 71],
    ];
    expect(spellsProgression(notes, C, 'major-ii-V-I')).toBe(true);
  });

  it('is enharmonic-blind, because it is integer arithmetic', () => {
    const dSharpM7 = [
      nameToMidi('D#3') ?? -1,
      nameToMidi('F#3') ?? -1,
      nameToMidi('A#3') ?? -1,
      nameToMidi('C#4') ?? -1,
    ];
    const notes = [
      ...dSharpM7,
      ...(chordNotes(nameToMidi('Ab2') ?? -1, 'dom7') ?? []),
      ...(chordNotes(nameToMidi('Db3') ?? -1, 'maj7') ?? []),
    ];
    // The ii of Db major spelled as D#m7: the same integers as Ebm7.
    expect(pcOf(dSharpM7[0])).toBe(3);
    expect(spellsProgression(notes, Db, 'major-ii-V-I')).toBe(true);
  });

  it('rejects the wrong key', () => {
    const notes = played(48, 'major-ii-V-I');
    expect(spellsProgression(notes, 1, 'major-ii-V-I')).toBe(false);
  });

  it('rejects the wrong quality — the major and the minor ii differ', () => {
    const notes = [
      ...(chordNotes(50, 'min7') ?? []),
      ...(chordNotes(43, 'dom7') ?? []),
      ...(chordNotes(48, 'min7') ?? []),
    ];
    // A minor ii-V-i needs a half-diminished ii; this is a m7.
    expect(spellsProgression(notes, C, 'minor-ii-V-i')).toBe(false);
    expect(
      spellsProgression(played(48, 'minor-ii-V-i'), C, 'minor-ii-V-i'),
    ).toBe(true);
  });

  it('rejects the right chords in the wrong order', () => {
    const chords = progressionNotes(48, 'major-ii-V-I') ?? [];
    const shuffled = [chords[2], chords[0], chords[1]].flat();
    expect(spellsProgression(shuffled, C, 'major-ii-V-I')).toBe(false);
  });

  it('rejects an inverted chord — each chord is read from its bass', () => {
    const chords = progressionNotes(48, 'major-ii-V-I') ?? [];
    const inverted = [
      [chords[0][1], chords[0][2], chords[0][3], chords[0][0] + 12],
      chords[1],
      chords[2],
    ].flat();
    expect(spellsProgression(inverted, C, 'major-ii-V-I')).toBe(false);
  });

  it('rejects a doubling, a short answer and a long one', () => {
    const chords = progressionNotes(48, 'major-ii-V-I') ?? [];
    const doubled = [
      [chords[0][0], chords[0][0] + 12, chords[0][1], chords[0][2]],
      chords[1],
      chords[2],
    ].flat();
    // A doubled note always costs a chord tone: the answer is twelve long.
    expect(spellsProgression(doubled, C, 'major-ii-V-I')).toBe(false);
    expect(
      spellsProgression(chords.flat().slice(0, 8), C, 'major-ii-V-I'),
    ).toBe(false);
    expect(spellsProgression([...chords.flat(), 60], C, 'major-ii-V-I')).toBe(
      false,
    );
  });

  it('rejects shells — this drill asks for the whole chord', () => {
    const shells = [
      [50, 53, 60],
      [43, 47, 53],
      [48, 52, 59],
    ].flat();
    expect(spellsProgression(shells, C, 'major-ii-V-I')).toBe(false);
  });
});

describe('the unknown type', () => {
  it('answers null rather than inventing a cadence', () => {
    const unknown = 'I-VI-ii-V' as unknown as 'major-ii-V-I';
    expect(progressionSteps(unknown)).toBeNull();
    expect(progressionChords(0, unknown)).toBeNull();
    expect(progressionNotes(60, unknown)).toBeNull();
    expect(progressionText(0, unknown)).toBe('');
    expect(progressionSpan(unknown)).toEqual({ low: 0, high: 0 });
    expect(progressionNoteCount(unknown)).toBe(0);
    expect(spellsProgression([60], 0, unknown)).toBe(false);
  });
});
