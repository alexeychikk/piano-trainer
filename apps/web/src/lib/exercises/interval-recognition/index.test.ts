import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import type { Answer, GenerateContext, Question } from '../types';
import {
  INTERVAL_RECOGNITION_ID,
  STARTER_INTERVALS,
  intervalRecognition,
  intervalSkillLabel,
  missDetail,
  skillIdFor,
  type IntervalPayload,
  type IntervalSettings,
} from './index';

const DEFAULTS = intervalRecognition.defaultSettings as IntervalSettings;

function context(
  seed: number,
  range = { low: 48, high: 84 },
  recentSkillIds: string[] = [],
  settings: IntervalSettings = DEFAULTS,
): GenerateContext<IntervalSettings> {
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
  settings?: IntervalSettings,
): Question<IntervalPayload> {
  return intervalRecognition.generate(context(seed, range, recent, settings));
}

/** The answer the runner builds from a `note-sequence` (played order). */
function played(...notes: number[]): Answer {
  return { kind: 'notes', notes: [...notes], order: notes, source: 'onscreen' };
}

describe('interval-recognition · generate', () => {
  it('keeps both notes inside the configured range', () => {
    for (let seed = 0; seed < 400; seed += 1) {
      const question = ask(seed, { low: 55, high: 72 });
      const { rootMidi, semitones } = question.payload;
      for (const midi of [rootMidi, rootMidi + semitones]) {
        expect(midi).toBeGreaterThanOrEqual(55);
        expect(midi).toBeLessThanOrEqual(72);
      }
    }
  });

  it('never asks a degenerate interval — two different notes, always', () => {
    for (let seed = 0; seed < 400; seed += 1) {
      const question = ask(seed);
      expect(Math.abs(question.payload.semitones)).toBeGreaterThan(0);
      const [first, second] = question.playback.events.map(
        (event) => event.notes[0],
      );
      expect(first).not.toBe(second);
    }
  });

  it('only asks intervals from the configured set', () => {
    const sizes = new Set<number>();
    for (let seed = 0; seed < 400; seed += 1) {
      sizes.add(Math.abs(ask(seed).payload.semitones));
    }
    for (const size of sizes) {
      expect(STARTER_INTERVALS).toContain(size);
    }
    // Over 400 draws every starter interval should have come up at least once.
    expect(sizes.size).toBe(STARTER_INTERVALS.length);
  });

  it('drops intervals the instrument range cannot hold', () => {
    // A ten-semitone range cannot hold the octave at all, but it can hold
    // everything smaller.
    for (let seed = 0; seed < 200; seed += 1) {
      const question = ask(seed, { low: 60, high: 70 });
      expect(Math.abs(question.payload.semitones)).toBeLessThanOrEqual(10);
    }
  });

  it('is reproducible from its seed', () => {
    expect(ask(4242).payload).toEqual(ask(4242).payload);
    expect(ask(4242).id).toBe(ask(4242).id);
  });

  it('avoids repeating the interval it has just asked', () => {
    const first = ask(7);
    const next = ask(7, undefined, [first.skillId]);
    expect(next.skillId).not.toBe(first.skillId);
  });

  it('describes the question the runner has to present', () => {
    const question = ask(11);
    const { rootMidi, semitones } = question.payload;
    expect(question.answerMode).toBe('note-sequence');
    expect(question.skillId).toBe(skillIdFor(semitones, 'asc'));
    expect(question.expected).toEqual({
      kind: 'notes',
      notes: [rootMidi, rootMidi + semitones],
      label: expect.any(String),
    });
    // Melodic: the second note starts when the first one stops.
    const [first, second] = question.playback.events;
    expect(first.atMs).toBe(0);
    expect(second.atMs).toBe(first.durationMs);
    expect(second.notes).toEqual([rootMidi + semitones]);
    // The answer may be played from any key, so nothing dims (UX §5.2).
    expect(question.range).toBeUndefined();
    expect(question.spellings?.size).toBe(2);
  });

  it('asks descending intervals when the settings say so', () => {
    const settings: IntervalSettings = {
      semitones: [7],
      direction: 'desc',
    };
    const question = ask(3, { low: 48, high: 84 }, [], settings);
    expect(question.payload.semitones).toBe(-7);
    expect(question.skillId).toBe(`${INTERVAL_RECOGNITION_ID}:7:desc`);
  });
});

describe('interval-recognition · grade', () => {
  const question = ask(11);
  const { rootMidi, semitones } = question.payload;

  it('accepts the interval played from the note it was asked from', () => {
    const grade = intervalRecognition.grade(
      question,
      played(rootMidi, rootMidi + semitones),
    );
    expect(grade).toEqual({ correct: true, score: 1 });
  });

  it('accepts the same interval played from any other root', () => {
    // The skill is relative pitch: only `played[1] − played[0]` is graded.
    for (const root of [36, 60, 84]) {
      const grade = intervalRecognition.grade(
        question,
        played(root, root + semitones),
      );
      expect(grade.correct).toBe(true);
    }
  });

  it('is enharmonic-blind, because it grades MIDI integers', () => {
    // Eb4 and D#4 are the same number: there is no spelling to disagree with.
    const eFlatUp = intervalRecognition.grade(
      { ...question, payload: { ...question.payload, semitones: 3 } },
      played(60, 63),
    );
    expect(eFlatUp.correct).toBe(true);
  });

  it('rejects the same interval an octave wide — a 12th is not a 5th', () => {
    const wide = {
      ...question,
      payload: { ...question.payload, semitones: 7 },
    };
    expect(intervalRecognition.grade(wide, played(60, 67)).correct).toBe(true);
    expect(intervalRecognition.grade(wide, played(60, 79)).correct).toBe(false);
  });

  it('rejects the right size played the other way round', () => {
    const up = { ...question, payload: { ...question.payload, semitones: 7 } };
    const grade = intervalRecognition.grade(up, played(67, 60));
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toBe('You played it the other way — downwards');
  });

  it('scores a miss binary, and names what was played instead', () => {
    const fifth = {
      ...question,
      payload: { ...question.payload, semitones: 8 },
    };
    const grade = intervalRecognition.grade(fifth, played(60, 67));
    expect(grade).toMatchObject({
      correct: false,
      score: 0,
      feedback: 'You played a perfect 5th',
    });
    expect(grade.revealed?.label).toBe('Minor 6th');
  });

  it('reveals both notes after a miss, so the answer is seen and heard', () => {
    const grade = intervalRecognition.grade(question, played(60, 61));
    expect(grade.revealed?.notes).toEqual([rootMidi, rootMidi + semitones]);
  });

  it('treats an unfinished answer as a miss, never as a crash', () => {
    expect(intervalRecognition.grade(question, played()).correct).toBe(false);
    expect(intervalRecognition.grade(question, played(60)).score).toBe(0);
    expect(
      intervalRecognition.grade(question, { kind: 'choice', choiceId: 'x' })
        .correct,
    ).toBe(false);
  });

  it('grades the first two notes of a longer fumble', () => {
    const fifth = {
      ...question,
      payload: { ...question.payload, semitones: 7 },
    };
    expect(intervalRecognition.grade(fifth, played(60, 67, 72)).correct).toBe(
      true,
    );
  });
});

describe('interval-recognition · labels', () => {
  it('abbreviates a skill for the progress grid, with its direction', () => {
    expect(intervalSkillLabel(`${INTERVAL_RECOGNITION_ID}:3:asc`)).toBe('m3 ↑');
    expect(intervalSkillLabel(`${INTERVAL_RECOGNITION_ID}:12:desc`)).toBe(
      'P8 ↓',
    );
  });

  it('leaves an id it does not recognise alone', () => {
    expect(intervalSkillLabel('find-the-note:pc:3')).toBe('find-the-note:pc:3');
    expect(intervalSkillLabel(`${INTERVAL_RECOGNITION_ID}:x:asc`)).toBe(
      `${INTERVAL_RECOGNITION_ID}:x:asc`,
    );
  });

  it('covers one skill per configured interval', () => {
    const skills = intervalRecognition.skillsCovered(DEFAULTS);
    expect(skills).toHaveLength(STARTER_INTERVALS.length);
    expect(skills).toContain(`${INTERVAL_RECOGNITION_ID}:7:asc`);
    expect(new Set(skills).size).toBe(skills.length);
  });
});

describe('missDetail', () => {
  it('says nothing when there is nothing to explain', () => {
    expect(missDetail(7, 7)).toBeUndefined();
  });

  it('names the interval actually played (ADR §10)', () => {
    expect(missDetail(7, 12)).toBe('You played an octave');
  });

  it('calls out a direction slip rather than renaming the interval', () => {
    expect(missDetail(-5, 5)).toBe('You played it upwards');
  });
});
