import { describe, expect, it } from 'vitest';
import {
  SHELL_QUALITIES,
  hasShell,
  qualityOfShellIntervals,
  shellIntervals,
  shellNotes,
  shellPitchClasses,
  shellSpan,
  spellsShell,
  spellsShellInAnyInversion,
} from './voicings';
import type { ChordQuality } from './types';

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
