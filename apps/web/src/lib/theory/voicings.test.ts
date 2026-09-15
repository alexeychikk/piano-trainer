import { describe, expect, it } from 'vitest';
import {
  GUIDE_TONE_QUALITIES,
  guideToneDegree,
  guideToneIntervals,
  guideToneNotes,
  guideTonePitchClasses,
  guideToneReadings,
  guideToneSpan,
  hasGuideTones,
  spellsGuideTones,
  ROOTLESS_FORMS,
  ROOTLESS_QUALITIES,
  SHELL_QUALITIES,
  hasRootless,
  hasShell,
  isRootlessForm,
  qualityOfShellIntervals,
  shellIntervals,
  shellNotes,
  shellPitchClasses,
  shellSpan,
  spellsShell,
  rootlessBassDegree,
  rootlessBassOffset,
  rootlessDegrees,
  rootlessIntervals,
  rootlessNotesFromBass,
  rootlessOfIntervalsAboveBass,
  rootlessPitchClasses,
  rootlessSpan,
  spellsRootless,
  spellsRootlessInAnyInversion,
  spellsShellInAnyInversion,
  type RootlessForm,
} from './voicings';
import type { ChordQuality, PitchClass } from './types';

const C3 = 48;
const C4 = 60;

describe('shellIntervals', () => {
  it('keeps the root, the 3rd and the 7th of a seventh chord', () => {
    expect(shellIntervals('maj7')).toEqual([0, 4, 11]);
    expect(shellIntervals('dom7')).toEqual([0, 4, 10]);
    expect(shellIntervals('min7')).toEqual([0, 3, 10]);
    expect(shellIntervals('minMaj7')).toEqual([0, 3, 11]);
  });

  it('has nothing to shell without a 7th', () => {
    for (const quality of ['maj', 'min', 'dim', 'aug', 'sus4'] as const)
      expect(shellIntervals(quality)).toBeNull();
  });

  it('does not read a 6th, or a diminished 7th, as a 7th', () => {
    // dim7's `7th` is nine semitones up: `C-Eb-A` spells Ebm6 just as well, so
    // a diminished chord has no shell and the exercise cannot ask for one.
    expect(shellIntervals('dim7')).toBeNull();
    expect(shellIntervals('maj6')).toBeNull();
    expect(shellIntervals('min6')).toBeNull();
  });

  it('says nothing for a quality with no interval set at all', () => {
    expect(shellIntervals('dom7alt')).toBeNull();
    expect(hasShell('dom7alt')).toBe(false);
  });

  it('measures the span of a close-position shell', () => {
    expect(shellSpan('maj7')).toBe(11);
    expect(shellSpan('min7')).toBe(10);
    expect(shellSpan('dim7')).toBe(0);
  });
});

describe('SHELL_QUALITIES', () => {
  it('all have a shell', () => {
    for (const quality of SHELL_QUALITIES) expect(hasShell(quality)).toBe(true);
  });

  it('are pairwise distinct — no two of them shell to the same shape', () => {
    const shapes = SHELL_QUALITIES.map((quality) =>
      shellIntervals(quality)?.join(','),
    );
    expect(new Set(shapes).size).toBe(SHELL_QUALITIES.length);
  });

  it('leave out the qualities whose shell belongs to another', () => {
    // The b5 is exactly the note a shell drops, so a half-diminished chord
    // shells to a minor 7th and cannot be drilled as a shell.
    expect(shellIntervals('min7b5')).toEqual(shellIntervals('min7'));
    expect(SHELL_QUALITIES).not.toContain('min7b5');
    // The 9ths shell onto their plain seventh chord.
    for (const [extended, plain] of [
      ['maj9', 'maj7'],
      ['dom9', 'dom7'],
      ['min9', 'min7'],
      ['dom7b9', 'dom7'],
    ] as [ChordQuality, ChordQuality][]) {
      expect(shellIntervals(extended)).toEqual(shellIntervals(plain));
      expect(SHELL_QUALITIES).not.toContain(extended);
    }
  });
});

describe('qualityOfShellIntervals', () => {
  it('names the shape a shell was built from', () => {
    expect(qualityOfShellIntervals([0, 4, 11])).toBe('maj7');
    expect(qualityOfShellIntervals([0, 4, 10])).toBe('dom7');
    expect(qualityOfShellIntervals([0, 3, 10])).toBe('min7');
  });

  it('ignores octave displacement and doubling', () => {
    expect(qualityOfShellIntervals([0, 16, 22])).toBe('dom7');
    expect(qualityOfShellIntervals([0, 4, 10, 12])).toBe('dom7');
  });

  it('says nothing about a shape that is not a shell', () => {
    expect(qualityOfShellIntervals([0, 4, 7])).toBeNull();
    expect(qualityOfShellIntervals([0, 4, 7, 11])).toBeNull();
    expect(qualityOfShellIntervals([])).toBeNull();
  });
});

describe('shellNotes', () => {
  it('builds the shell in close position, low to high', () => {
    expect(shellNotes(C3, 'maj7')).toEqual([48, 52, 59]);
    expect(shellNotes(C3, 'min7')).toEqual([48, 51, 58]);
  });

  it('is null for a quality with no shell', () => {
    expect(shellNotes(C3, 'dim7')).toBeNull();
  });

  it('lists the three pitch classes, sorted', () => {
    expect(shellPitchClasses(0, 'dom7')).toEqual([0, 4, 10]);
    // D7: D F# C -> 2, 6, 0 sorted
    expect(shellPitchClasses(2, 'dom7')).toEqual([0, 2, 6]);
  });
});

describe('spellsShell — the slice 8 matching rule', () => {
  it('accepts the close-position shell', () => {
    expect(spellsShell([48, 52, 59], 0, 'maj7')).toBe(true);
  });

  it('accepts the A form and the B form alike', () => {
    // B form 1-3-7: C3 E3 Bb3. A form 1-7-3: C3 Bb3 E4.
    expect(spellsShell([48, 52, 58], 0, 'dom7')).toBe(true);
    expect(spellsShell([48, 58, 64], 0, 'dom7')).toBe(true);
  });

  it('accepts any register, spacing and order', () => {
    expect(spellsShell([36, 76, 58], 0, 'dom7')).toBe(true);
    expect(spellsShell([C4, C4 + 10, C4 + 4], 0, 'dom7')).toBe(true);
  });

  it('compares enharmonics equal, because it compares integers', () => {
    // Db7: Db F B (= Cb). The spelling never enters the comparison.
    expect(spellsShell([49, 53, 59], 1, 'dom7')).toBe(true);
  });

  it('rejects the shell over the wrong bass', () => {
    // The right three notes, 3rd in the bass.
    expect(spellsShell([52, 58, 72], 0, 'dom7')).toBe(false);
    expect(spellsShellInAnyInversion([52, 58, 72], 0, 'dom7')).toBe(true);
  });

  it('rejects the shell of another key', () => {
    expect(spellsShell([50, 54, 60], 0, 'dom7')).toBe(false);
    expect(spellsShellInAnyInversion([50, 54, 60], 0, 'dom7')).toBe(false);
  });

  it('rejects another quality over the right root', () => {
    expect(spellsShell([48, 51, 58], 0, 'dom7')).toBe(false);
    expect(spellsShell([48, 52, 59], 0, 'dom7')).toBe(false);
  });

  it('rejects the triad — the 5th is the note a shell drops', () => {
    expect(spellsShell([48, 52, 55], 0, 'dom7')).toBe(false);
  });

  it('rejects the whole chord: a shell is three notes, not four', () => {
    expect(spellsShell([48, 52, 55, 58], 0, 'dom7')).toBe(false);
  });

  it('rejects a doubling, which always costs a chord tone', () => {
    expect(spellsShell([48, 52, 60], 0, 'dom7')).toBe(false);
    expect(spellsShell([48, 58, 60], 0, 'dom7')).toBe(false);
  });

  it('rejects nothing at all, and a quality with no shell', () => {
    expect(spellsShell([], 0, 'dom7')).toBe(false);
    expect(spellsShell([48, 51, 57], 0, 'dim7')).toBe(false);
  });
});

describe('an inherited key is not a quality', () => {
  // The crash this guard closes: `chordIntervals('constructor')` used to hand
  // back `Object`, and `shellIntervals()` called `.find()` on it — a
  // `TypeError` that took `/progress` down whenever a hand-edited or imported
  // record carried such a skill id.
  const inherited = [
    'constructor',
    'toString',
    '__proto__',
    'valueOf',
    'hasOwnProperty',
  ] as unknown as ChordQuality[];

  it('has no shell, and asks about one without throwing', () => {
    for (const quality of inherited) {
      expect(() => shellIntervals(quality), quality).not.toThrow();
      expect(shellIntervals(quality), quality).toBeNull();
      expect(hasShell(quality), quality).toBe(false);
      expect(shellNotes(C4, quality), quality).toBeNull();
      expect(shellSpan(quality), quality).toBe(0);
      expect(spellsShell([48, 52, 58], 0, quality), quality).toBe(false);
    }
  });
});

// ---- rootless A/B voicings (slice 11) ------------------------------------

describe('rootlessIntervals', () => {
  it('spells the A form 3-5-7-9 above the root', () => {
    expect(rootlessIntervals('maj7', 'A')).toEqual([4, 7, 11, 14]);
    expect(rootlessIntervals('dom7', 'A')).toEqual([4, 7, 10, 14]);
    expect(rootlessIntervals('min7', 'A')).toEqual([3, 7, 10, 14]);
  });

  it('spells the B form 7-9-3-5 above the root', () => {
    expect(rootlessIntervals('maj7', 'B')).toEqual([11, 14, 16, 19]);
    expect(rootlessIntervals('dom7', 'B')).toEqual([10, 14, 16, 19]);
    expect(rootlessIntervals('min7', 'B')).toEqual([10, 14, 15, 19]);
  });

  it('gives both forms the same four pitch classes', () => {
    for (const quality of ROOTLESS_QUALITIES) {
      const a = rootlessIntervals(quality, 'A') ?? [];
      const b = rootlessIntervals(quality, 'B') ?? [];
      const pcs = (values: readonly number[]) =>
        [...new Set(values.map((value) => value % 12))].sort((x, y) => x - y);
      expect(pcs(a), quality).toEqual(pcs(b));
    }
  });

  it('has no rootless voicing without a 7th, a 3rd or a perfect 5th', () => {
    // No 7th to voice; a 6th chord's 6th is not one either.
    for (const quality of ['maj', 'min', 'sus4', 'maj6', 'min6'] as const)
      expect(rootlessIntervals(quality, 'A'), quality).toBeNull();
    // `min7b5`'s flat 5th and `dim7`'s diminished 7th are a different shape
    // with a different 9th — their own drill, not this one's transposition.
    for (const quality of ['min7b5', 'dim7', 'dom7alt'] as const)
      expect(rootlessIntervals(quality, 'A'), quality).toBeNull();
    expect(hasRootless('min7b5')).toBe(false);
    expect(hasRootless('maj7')).toBe(true);
  });

  it('refuses a form that is not one of the two', () => {
    const crafted = 'constructor' as unknown as RootlessForm;
    expect(isRootlessForm('A')).toBe(true);
    expect(isRootlessForm('constructor')).toBe(false);
    expect(rootlessIntervals('maj7', crafted)).toBeNull();
    expect(rootlessBassOffset('maj7', crafted)).toBeNull();
    expect(rootlessSpan('maj7', crafted)).toBe(0);
    expect(rootlessNotesFromBass(C4, 'maj7', crafted)).toBeNull();
    expect(spellsRootless([64, 67, 71, 74], 0, 'maj7', crafted)).toBe(false);
  });
});

describe('rootlessNotesFromBass', () => {
  it('builds the voicing up from the note the form puts underneath', () => {
    // Cmaj7 A from E3: E-G-B-D.
    expect(rootlessNotesFromBass(52, 'maj7', 'A')).toEqual([52, 55, 59, 62]);
    // Cmaj7 B from B3: B-D-E-G.
    expect(rootlessNotesFromBass(59, 'maj7', 'B')).toEqual([59, 62, 64, 67]);
  });

  it('spans no more than a hand', () => {
    for (const quality of ROOTLESS_QUALITIES)
      for (const form of ROOTLESS_FORMS)
        expect(rootlessSpan(quality, form), `${quality} ${form}`).toBeLessThan(
          12,
        );
  });

  it('places its bass the form’s own degree above the root', () => {
    expect(rootlessBassOffset('maj7', 'A')).toBe(4);
    expect(rootlessBassOffset('min7', 'A')).toBe(3);
    expect(rootlessBassOffset('maj7', 'B')).toBe(11);
    expect(rootlessBassOffset('min7', 'B')).toBe(10);
  });
});

describe('rootlessOfIntervalsAboveBass', () => {
  it('tells all eight shapes apart', () => {
    const seen = new Set<string>();
    for (const quality of ROOTLESS_QUALITIES) {
      for (const form of ROOTLESS_FORMS) {
        const notes = rootlessNotesFromBass(C4, quality, form) ?? [];
        const found = rootlessOfIntervalsAboveBass(
          notes.map((midi) => midi - C4),
        );
        expect(found, `${quality} ${form}`).toEqual({ quality, form });
        seen.add(`${quality}:${form}`);
      }
    }
    expect(seen.size).toBe(ROOTLESS_QUALITIES.length * ROOTLESS_FORMS.length);
  });

  it('does not recognise a shell as one', () => {
    expect(rootlessOfIntervalsAboveBass([0, 4, 11])).toBeNull();
    expect(rootlessOfIntervalsAboveBass([])).toBeNull();
  });

  it('reads an A form as what it also is — a seventh chord', () => {
    // Not a defect, and not a collision we get to resolve: `Cm7`'s A form is
    // `Eb-G-Bb-D`, which is spelled exactly like `Ebmaj7`. Every A form is a
    // seventh chord on its own bass (no B form is anything else), so a played
    // shape can honestly be named either way, and this module names it the way
    // the drill asking the question does.
    expect(rootlessOfIntervalsAboveBass([0, 4, 7, 11])).toEqual({
      quality: 'min7',
      form: 'A',
    });
    expect(rootlessOfIntervalsAboveBass([0, 3, 7, 10])).toEqual({
      quality: 'maj7',
      form: 'A',
    });
  });
});

describe('spellsRootless', () => {
  // Cmaj7 A: E-G-B-D. Cmaj7 B: B-D-E-G.
  const cmaj7A = [52, 55, 59, 62];
  const cmaj7B = [59, 62, 64, 67];

  it('accepts the asked form in any octave, order and spacing', () => {
    expect(spellsRootless(cmaj7A, 0, 'maj7', 'A')).toBe(true);
    // Two octaves down, and struck in another order: the set and the lowest
    // note are what is graded.
    expect(
      spellsRootless([62 - 24, 55 - 24, 52 - 24, 59 - 24], 0, 'maj7', 'A'),
    ).toBe(true);
    // Open spacing: the upper notes an octave up, the 3rd still underneath.
    expect(spellsRootless([52, 67, 71, 74], 0, 'maj7', 'A')).toBe(true);
    expect(spellsRootless(cmaj7B, 0, 'maj7', 'B')).toBe(true);
  });

  it('transposes to all 12 keys', () => {
    for (let rootPc = 0; rootPc < 12; rootPc += 1)
      for (const quality of ROOTLESS_QUALITIES)
        for (const form of ROOTLESS_FORMS) {
          const bass =
            C4 + ((rootPc + (rootlessBassOffset(quality, form) ?? 0)) % 12);
          const notes = rootlessNotesFromBass(bass, quality, form) ?? [];
          expect(
            spellsRootless(notes, rootPc, quality, form),
            `${rootPc} ${quality} ${form}`,
          ).toBe(true);
        }
  });

  it('rejects the other form — the tones are the same, the bass is not', () => {
    expect(spellsRootless(cmaj7A, 0, 'maj7', 'B')).toBe(false);
    expect(spellsRootless(cmaj7B, 0, 'maj7', 'A')).toBe(false);
    // …but both are the right notes over the wrong one.
    expect(spellsRootlessInAnyInversion(cmaj7A, 0, 'maj7')).toBe(true);
    expect(spellsRootlessInAnyInversion(cmaj7B, 0, 'maj7')).toBe(true);
  });

  it('rejects the root, the shell and a doubling', () => {
    // The root added under the A form: five notes, and one of them is the
    // note a rootless voicing exists to leave out.
    expect(spellsRootless([48, ...cmaj7A], 0, 'maj7', 'A')).toBe(false);
    // The shell.
    expect(spellsRootless([48, 52, 59], 0, 'maj7', 'A')).toBe(false);
    // A doubled 3rd costs the 9th.
    expect(spellsRootless([52, 55, 59, 64], 0, 'maj7', 'A')).toBe(false);
    expect(spellsRootless([], 0, 'maj7', 'A')).toBe(false);
  });

  it('rejects another key and another quality', () => {
    expect(spellsRootless(cmaj7A, 1, 'maj7', 'A')).toBe(false);
    expect(spellsRootless(cmaj7A, 0, 'dom7', 'A')).toBe(false);
    expect(spellsRootlessInAnyInversion(cmaj7A, 0, 'min7b5')).toBe(false);
  });

  it('is enharmonic-blind: it is arithmetic on MIDI numbers', () => {
    // Db7 A from F3: F-Ab-B(=Cb)-Eb.
    const db7A = rootlessNotesFromBass(53, 'dom7', 'A') ?? [];
    expect(db7A).toEqual([53, 56, 59, 63]);
    expect(spellsRootless(db7A, 1, 'dom7', 'A')).toBe(true);
  });
});

describe('rootless form names', () => {
  it('names the tone each form puts underneath', () => {
    expect(rootlessBassDegree('A')).toBe('3rd');
    expect(rootlessBassDegree('B')).toBe('7th');
    expect(rootlessDegrees('A')).toBe('3rd, 5th, 7th, 9th');
    expect(rootlessDegrees('B')).toBe('7th, 9th, 3rd, 5th');
  });

  it('gives a name it does not own back unchanged', () => {
    const crafted = 'constructor' as unknown as RootlessForm;
    expect(rootlessBassDegree(crafted)).toBe('constructor');
    expect(rootlessDegrees(crafted)).toBe('constructor');
  });
});

describe('a rootless voicing asked about an inherited key', () => {
  const inherited = [
    'constructor',
    'toString',
    '__proto__',
    'valueOf',
    'hasOwnProperty',
  ] as unknown as ChordQuality[];

  it('has none, and asks about one without throwing', () => {
    for (const quality of inherited) {
      expect(() => rootlessIntervals(quality, 'A'), quality).not.toThrow();
      expect(rootlessIntervals(quality, 'A'), quality).toBeNull();
      expect(hasRootless(quality), quality).toBe(false);
      expect(rootlessNotesFromBass(C4, quality, 'A'), quality).toBeNull();
      expect(rootlessPitchClasses(0, quality), quality).toBeNull();
      expect(rootlessSpan(quality, 'A'), quality).toBe(0);
      expect(spellsRootless([52, 55, 59, 62], 0, quality, 'A'), quality).toBe(
        false,
      );
    }
  });
});

describe('guideToneIntervals', () => {
  it('keeps the 3rd and the 7th, in that order', () => {
    // Not sorted: which one is the 3rd and which the 7th is the vocabulary.
    expect(guideToneIntervals('maj7')).toEqual([4, 11]);
    expect(guideToneIntervals('dom7')).toEqual([4, 10]);
    expect(guideToneIntervals('min7')).toEqual([3, 10]);
    expect(guideToneIntervals('minMaj7')).toEqual([3, 11]);
  });

  it('is the shell with the root taken away', () => {
    for (const quality of SHELL_QUALITIES)
      expect(guideToneIntervals(quality), quality).toEqual(
        (shellIntervals(quality) ?? []).slice(1),
      );
  });

  it('has no pair without a 7th, or with a diminished one', () => {
    for (const quality of [
      'maj',
      'min',
      'sus4',
      'maj6',
      'min6',
      'dim7',
    ] as const) {
      expect(guideToneIntervals(quality), quality).toBeNull();
      expect(hasGuideTones(quality), quality).toBe(false);
    }
    expect(guideToneIntervals('dom7alt')).toBeNull();
  });

  it('measures the span from the root to the 7th', () => {
    expect(guideToneSpan('maj7')).toBe(11);
    expect(guideToneSpan('min7')).toBe(10);
    expect(guideToneSpan('dim7')).toBe(0);
  });
});

describe('GUIDE_TONE_QUALITIES', () => {
  it('all have a pair, and no two share one', () => {
    const shapes = new Set<string>();
    for (const quality of GUIDE_TONE_QUALITIES) {
      expect(hasGuideTones(quality), quality).toBe(true);
      shapes.add((guideTonePitchClasses(0, quality) ?? []).join(','));
    }
    expect(shapes.size).toBe(GUIDE_TONE_QUALITIES.length);
  });

  it('leaves out min7b5, whose pair is min7’s', () => {
    // The flat 5th is not a guide tone, so a half-diminished chord and a minor
    // seventh chord are the same two notes — it cannot be drilled this way.
    expect(guideTonePitchClasses(0, 'min7b5')).toEqual(
      guideTonePitchClasses(0, 'min7'),
    );
    expect(GUIDE_TONE_QUALITIES).not.toContain('min7b5');
  });
});

describe('guideToneNotes', () => {
  it('builds the pair above a root, without the root', () => {
    // Cmaj7 from C4: E4 and B4.
    expect(guideToneNotes(C4, 'maj7')).toEqual([64, 71]);
    // C7 from C3: E3 and Bb3.
    expect(guideToneNotes(C3, 'dom7')).toEqual([52, 58]);
    expect(guideToneNotes(C4, 'dim7')).toBeNull();
  });

  it('names which tone a pitch class is', () => {
    expect(guideToneDegree(0, 'dom7', 4)).toBe('3rd');
    expect(guideToneDegree(0, 'dom7', 10)).toBe('7th');
    // The root and the 5th are not guide tones.
    expect(guideToneDegree(0, 'dom7', 0)).toBeNull();
    expect(guideToneDegree(0, 'dom7', 7)).toBeNull();
    expect(guideToneDegree(0, 'dim7', 3)).toBeNull();
  });
});

describe('spellsGuideTones — the slice 12 matching rule', () => {
  // Cmaj7's guide tones: E and B.
  it('accepts the pair in any octave, order and spacing', () => {
    expect(spellsGuideTones([64, 71], 0, 'maj7')).toBe(true);
    // 7th underneath: a guide-tone pair has no bass rule, unlike a shell.
    expect(spellsGuideTones([59, 76], 0, 'maj7')).toBe(true);
    // Two octaves apart, and played high the other way round.
    expect(spellsGuideTones([83, 52], 0, 'maj7')).toBe(true);
  });

  it('is enharmonic-blind: it is arithmetic on MIDI numbers', () => {
    // Db7: F and Cb(=B).
    expect(spellsGuideTones([53, 59], 1, 'dom7')).toBe(true);
    expect(spellsGuideTones([59, 65], 1, 'dom7')).toBe(true);
  });

  it('rejects the root, the 5th and every larger voicing', () => {
    // The shell — slice 8's answer, one note too many here.
    expect(spellsGuideTones([60, 64, 71], 0, 'maj7')).toBe(false);
    // The whole chord, and a rootless A form.
    expect(spellsGuideTones([60, 64, 67, 71], 0, 'maj7')).toBe(false);
    expect(spellsGuideTones([64, 67, 71, 74], 0, 'maj7')).toBe(false);
  });

  it('rejects a fragment, a doubling and the wrong colour', () => {
    expect(spellsGuideTones([64], 0, 'maj7')).toBe(false);
    expect(spellsGuideTones([], 0, 'maj7')).toBe(false);
    // A doubled 3rd costs the 7th: two notes, one pitch class.
    expect(spellsGuideTones([64, 76], 0, 'maj7')).toBe(false);
    // C7's pair, asked for Cmaj7: the 7th is the difference.
    expect(spellsGuideTones([64, 70], 0, 'maj7')).toBe(false);
    // Cm7's pair, asked for C7: the 3rd is.
    expect(spellsGuideTones([63, 70], 0, 'dom7')).toBe(false);
  });

  it('has nothing to match for a quality with no pair', () => {
    expect(spellsGuideTones([63, 69], 0, 'dim7')).toBe(false);
  });
});

describe('guideToneReadings', () => {
  it('reads a tritone as both dominants — that is tritone substitution', () => {
    // E and Bb: C7 and Gb7.
    const readings = guideToneReadings([4, 10]);
    expect(readings).toEqual([
      { rootPc: 0, quality: 'dom7' },
      { rootPc: 6, quality: 'dom7' },
    ]);
  });

  it('reads a fifth as a maj7 and the min7 a semitone above it', () => {
    // E and B: Cmaj7, and C#m7 (C# + 3 = E, C# + 10 = B).
    expect(guideToneReadings([4, 11])).toEqual([
      { rootPc: 0, quality: 'maj7' },
      { rootPc: 1, quality: 'min7' },
    ]);
  });

  it('names every chord in the set, and nothing else', () => {
    for (const quality of GUIDE_TONE_QUALITIES) {
      for (let rootPc = 0; rootPc < 12; rootPc += 1) {
        const pcs = guideTonePitchClasses(rootPc as PitchClass, quality) ?? [];
        expect(guideToneReadings(pcs), `${quality}:${rootPc}`).toContainEqual({
          rootPc,
          quality,
        });
      }
    }
    // A pair of semitones is nobody's 3rd and 7th.
    expect(guideToneReadings([0, 1])).toEqual([]);
    expect(guideToneReadings([0])).toEqual([]);
  });
});

describe('guide tones asked about an inherited key', () => {
  const inherited = [
    'constructor',
    'toString',
    '__proto__',
  ] as unknown as ChordQuality[];

  it('has none, and asks about one without throwing', () => {
    for (const quality of inherited) {
      expect(() => guideToneIntervals(quality), quality).not.toThrow();
      expect(guideToneIntervals(quality), quality).toBeNull();
      expect(hasGuideTones(quality), quality).toBe(false);
      expect(guideToneNotes(C4, quality), quality).toBeNull();
      expect(guideTonePitchClasses(0, quality), quality).toBeNull();
      expect(guideToneSpan(quality), quality).toBe(0);
      expect(guideToneDegree(0, quality, 4), quality).toBeNull();
      expect(spellsGuideTones([64, 71], 0, quality), quality).toBe(false);
    }
  });
});
