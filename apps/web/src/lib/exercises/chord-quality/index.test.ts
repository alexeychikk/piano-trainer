import { describe, expect, it } from 'vitest';
import { chordNotes, intervalsAboveBass, type ChordQuality } from '$lib/theory';
import { mulberry32 } from '../rng';
import type { Answer, GenerateContext, Question } from '../types';
import {
  CHORD_QUALITY_ID,
  STARTER_QUALITIES,
  chordQuality,
  chordSkillLabel,
  missDetail,
  skillIdFor,
  type ChordQualityPayload,
  type ChordQualitySettings,
} from './index';

const DEFAULTS = chordQuality.defaultSettings as ChordQualitySettings;

function context(
  seed: number,
  range = { low: 48, high: 84 },
  recentSkillIds: string[] = [],
  settings: ChordQualitySettings = DEFAULTS,
): GenerateContext<ChordQualitySettings> {
  return {
    settings,
    rng: mulberry32(seed),
    seed,
    range,
    history: { recentSkillIds },
  };
}

function ask(
  seed: number,
  range?: { low: number; high: number },
  recent: string[] = [],
  settings?: ChordQualitySettings,
): Question<ChordQualityPayload> {
  return chordQuality.generate(context(seed, range, recent, settings));
}

/** The notes of a question, as the runner plays them. */
function notesOf(question: Question<ChordQualityPayload>): number[] {
  return question.playback.events[0].notes;
}

function played(notes: number[]): Answer {
  return { kind: 'notes', notes, order: notes, source: 'onscreen' };
}

describe('chord-quality generate', () => {
  it('is reproducible from the seed', () => {
    expect(ask(99)).toEqual(ask(99));
  });

  it('only asks qualities from the settings set', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      expect(STARTER_QUALITIES).toContain(ask(seed).payload.quality);
    }
  });

  it('plays one block chord in root position, whole and in range', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const question = ask(seed);
      const notes = notesOf(question);
      expect(question.playback.events).toHaveLength(1);
      expect(notes).toEqual(
        chordNotes(question.payload.rootMidi, question.payload.quality),
      );
      // Four distinct notes — never a degenerate two-note "chord".
      expect(new Set(notes).size).toBe(4);
      expect(Math.min(...notes)).toBeGreaterThanOrEqual(48);
      expect(Math.max(...notes)).toBeLessThanOrEqual(84);
      expect(notes).toEqual([...notes].sort((a, b) => a - b));
    }
  });

  it('keeps the whole chord inside a narrow instrument', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const notes = notesOf(ask(seed, { low: 55, high: 72 }));
      expect(Math.min(...notes)).toBeGreaterThanOrEqual(55);
      expect(Math.max(...notes)).toBeLessThanOrEqual(72);
    }
  });

  it('answers on the keyboard, from any key, in played order', () => {
    const question = ask(7);
    expect(question.answerMode).toBe('note-sequence');
    expect(question.prompt.showKeyboard).toBe(true);
    // Nothing dims: the chord may be played back from any root.
    expect(question.range).toBeUndefined();
    expect(question.expected).toEqual({
      kind: 'notes',
      notes: notesOf(question),
      label: expect.stringContaining('chord'),
    });
    expect(
      [...(question.spellings ?? [])].map(([, name]) => name),
    ).toHaveLength(4);
  });

  it('avoids repeating the quality just asked', () => {
    const first = ask(3);
    const next = ask(3, undefined, [first.skillId]);
    expect(next.skillId).not.toBe(first.skillId);
  });

  it('derives the question id and skill id from the seed and the quality', () => {
    const question = ask(21);
    expect(question.id).toBe(
      `${CHORD_QUALITY_ID}:21:${question.payload.rootMidi}:${question.payload.quality}`,
    );
    expect(question.skillId).toBe(skillIdFor(question.payload.quality));
    expect(question.seed).toBe(21);
  });

  it('only offers qualities it can build, whatever the settings say', () => {
    const settings: ChordQualitySettings = {
      qualities: ['dom7alt', 'min7'] as ChordQuality[],
    };
    for (let seed = 0; seed < 20; seed += 1) {
      expect(ask(seed, undefined, [], settings).payload.quality).toBe('min7');
    }
  });
});

describe('chord-quality grade', () => {
  const question = ask(5);
  const quality = question.payload.quality;
  const notes = notesOf(question);
  const root = question.payload.rootMidi;

  it('accepts the chord played back as it sounded', () => {
    expect(chordQuality.grade(question, played(notes))).toEqual({
      correct: true,
      score: 1,
    });
  });

  it('accepts it from any other root — the quality is what is graded', () => {
    const transposed = notes.map((midi) => midi - 5);
    expect(chordQuality.grade(question, played(transposed)).correct).toBe(true);
  });

  it('accepts any octave placement above the root, in any played order', () => {
    const spread = [notes[0], notes[3] + 12, notes[1], notes[2]];
    expect(chordQuality.grade(question, played(spread)).correct).toBe(true);
  });

  it('rejects the same notes over a different bass (root position only)', () => {
    const inverted = [notes[1], notes[2], notes[3], notes[0] + 12];
    const grade = chordQuality.grade(question, played(inverted));
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0);
    expect(grade.feedback).toBe(
      'Right chord — but the root belongs at the bottom',
    );
    expect(grade.revealed).toEqual({
      notes,
      label: question.expected.label,
    });
  });

  it('names the wrong chord that was played instead', () => {
    const other: ChordQuality = quality === 'min7' ? 'maj7' : 'min7';
    const grade = chordQuality.grade(
      question,
      played(chordNotes(root, other) ?? []),
    );
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toMatch(/^You played an? /);
  });

  it('says nothing it cannot say about an unnameable answer', () => {
    const grade = chordQuality.grade(question, played([60, 61, 62, 63]));
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toBeUndefined();
    expect(grade.revealed?.notes).toEqual(notes);
  });

  it('counts an empty or one-note answer as a miss', () => {
    expect(chordQuality.grade(question, played([])).correct).toBe(false);
    expect(chordQuality.grade(question, played([root])).score).toBe(0);
    expect(
      chordQuality.grade(question, { kind: 'choice', choiceId: 'x' }).correct,
    ).toBe(false);
  });

  it('scores binary, never partial', () => {
    for (const answer of [
      notes,
      [notes[0], notes[1], notes[2], notes[3] + 1],
    ]) {
      const grade = chordQuality.grade(question, played(answer));
      expect(grade.score).toBe(grade.correct ? 1 : 0);
    }
  });
});

describe('chord-quality skills', () => {
  it('covers one skill per quality in the set', () => {
    expect(chordQuality.skillsCovered(DEFAULTS)).toEqual(
      STARTER_QUALITIES.map((item) => `${CHORD_QUALITY_ID}:${item}`),
    );
  });

  it('labels a skill with its chord symbol, for the grid', () => {
    expect(chordSkillLabel(skillIdFor('min7b5'))).toBe('m7b5');
    expect(chordSkillLabel(skillIdFor('dom7'))).toBe('7');
    expect(chordSkillLabel('find-the-note:pc:3')).toBe('find-the-note:pc:3');
    expect(chordSkillLabel(`${CHORD_QUALITY_ID}:nonsense`)).toBe(
      `${CHORD_QUALITY_ID}:nonsense`,
    );
  });
});

describe('missDetail', () => {
  it('says nothing when the answer was right', () => {
    expect(missDetail('maj7', chordNotes(60, 'maj7') ?? [])).toBeUndefined();
  });

  it('names the quality that was played instead', () => {
    expect(missDetail('maj7', chordNotes(60, 'dom7') ?? [])).toBe(
      'You played a dominant 7th chord',
    );
    expect(missDetail('min7', chordNotes(60, 'min7b5') ?? [])).toBe(
      'You played a half-diminished 7th chord',
    );
  });

  it('calls out the right chord over the wrong bass', () => {
    // Cmaj7 played as E G B C.
    expect(missDetail('maj7', [64, 67, 71, 72])).toBe(
      'Right chord — but the root belongs at the bottom',
    );
  });

  it('has nothing to say about a handful of notes', () => {
    expect(missDetail('maj7', [60])).toBeUndefined();
    expect(missDetail('maj7', [60, 61, 62, 63])).toBeUndefined();
  });

  it('reads the structure the same way grading does', () => {
    expect(intervalsAboveBass([60, 64, 67, 71])).toEqual([0, 4, 7, 11]);
  });
});
