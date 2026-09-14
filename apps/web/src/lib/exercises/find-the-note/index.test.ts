import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import type { GenerateContext, Question } from '../types';
import {
  findTheNote,
  missDetail,
  skillIdFor,
  type FindTheNotePayload,
  type FindTheNoteSettings,
} from './index';

function context(
  seed: number,
  range = { low: 48, high: 72 },
  recentSkillIds: string[] = [],
): GenerateContext<FindTheNoteSettings> {
  return {
    settings: {},
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
): Question<FindTheNotePayload> {
  return findTheNote.generate(context(seed, range, recent));
}

describe('find-the-note · generate', () => {
  it('always picks a note inside the configured range', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const question = ask(seed, { low: 55, high: 67 });
      expect(question.payload.midi).toBeGreaterThanOrEqual(55);
      expect(question.payload.midi).toBeLessThanOrEqual(67);
    }
  });

  it('is reproducible from its seed', () => {
    expect(ask(4242).payload).toEqual(ask(4242).payload);
    expect(ask(4242).id).toBe(ask(4242).id);
  });

  it('describes the question the runner has to present', () => {
    const question = ask(11);
    const midi = question.payload.midi;
    expect(question.answerMode).toBe('single-note');
    expect(question.skillId).toBe(skillIdFor(midi));
    expect(question.expected).toEqual({
      kind: 'notes',
      notes: [midi],
      label: expect.any(String),
    });
    expect(question.playback.events).toEqual([
      {
        atMs: 0,
        notes: [midi],
        durationMs: expect.any(Number),
        velocity: expect.any(Number),
      },
    ]);
    // The keyboard dims nothing extra: the question spans the instrument.
    expect(question.range).toEqual({ low: 48, high: 72 });
    expect(question.spellings?.get(midi)).toBe(question.expected.label);
  });

  it('spells black keys with flats, consistently everywhere', () => {
    const question = ask(1, { low: 61, high: 61 });
    expect(question.expected.label).toBe('Db4');
    expect(question.spellings?.get(61)).toBe('Db4');
  });

  it('does not ask the same pitch class twice in a row', () => {
    const range = { low: 60, high: 72 };
    let recent: string[] = [];
    let previous: string | null = null;
    for (let seed = 1; seed <= 200; seed += 1) {
      const question = ask(seed, range, recent);
      expect(question.skillId).not.toBe(previous);
      previous = question.skillId;
      recent = [question.skillId, ...recent].slice(0, 8);
    }
  });

  it('covers every pitch class as a skill', () => {
    expect(findTheNote.skillsCovered({})).toHaveLength(12);
    expect(findTheNote.skillsCovered({})).toContain(skillIdFor(63));
  });
});

describe('find-the-note · grade', () => {
  const question = ask(1, { low: 60, high: 60 });

  function play(midi: number) {
    return findTheNote.grade(question, {
      kind: 'notes',
      notes: [midi],
      order: [midi],
      source: 'onscreen',
    });
  }

  it('accepts the exact note', () => {
    expect(play(60)).toEqual({ correct: true, score: 1 });
  });

  it('grades on the number, not the spelling', () => {
    // C#4 and Db4 are the same key: 61 either way (ADR §4).
    expect(play(61).correct).toBe(false);
    expect(play(61).score).toBe(0);
  });

  it('gives partial credit for the right note in the wrong octave', () => {
    const grade = play(72);
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0.5);
    expect(grade.feedback).toBe(
      'You played C5 — the right note, 1 octave too high',
    );
    expect(grade.revealed).toEqual({ notes: [60], label: 'C4' });
  });

  it('explains how far off a wrong note was', () => {
    expect(play(58).feedback).toBe('You played Bb3 — 2 semitones too low');
    expect(play(61).feedback).toBe('You played Db4 — 1 semitone too high');
  });

  it('treats an empty answer as a miss and still reveals', () => {
    const grade = findTheNote.grade(question, {
      kind: 'notes',
      notes: [],
      order: [],
      source: 'midi',
    });
    expect(grade).toEqual({
      correct: false,
      score: 0,
      revealed: { notes: [60] },
    });
  });
});

describe('missDetail', () => {
  it('counts octaves, not semitones, for the same pitch class', () => {
    expect(missDetail(60, 84)).toBe(
      'You played C6 — the right note, 2 octaves too high',
    );
  });
});
