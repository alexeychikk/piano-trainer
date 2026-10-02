import { describe, expect, it } from 'vitest';
import {
  NothingToAskError,
  PITCH_CLASSES,
  askableExercises,
  buildableTarget,
  pitchClassesIn,
  planInputs,
} from './coverage';
import { EXERCISES } from './registry';

describe('pitchClassesIn', () => {
  it('is all twelve once the window spans eleven semitones', () => {
    expect(pitchClassesIn(60, 71)).toEqual([...PITCH_CLASSES]);
    expect(pitchClassesIn(21, 108)).toEqual([...PITCH_CLASSES]);
  });

  it('is the keys that occur in a narrower window, in pitch-class order', () => {
    expect(pitchClassesIn(60, 60)).toEqual([0]);
    expect(pitchClassesIn(70, 73)).toEqual([0, 1, 10, 11]);
    expect(pitchClassesIn(60, 70)).toHaveLength(11);
    expect(pitchClassesIn(60, 70)).not.toContain(11);
  });

  it('is empty for an inverted window', () => {
    expect(pitchClassesIn(61, 60)).toEqual([]);
  });
});

describe('buildableTarget', () => {
  const parse = (id: string) =>
    id.startsWith('x:') ? Number(id.slice(2)) : null;
  const even = (n: number) => n % 2 === 0;

  it('returns the decoded target when it is buildable', () => {
    expect(buildableTarget('x:4', parse, even)).toBe(4);
  });

  it('returns null with no target, a foreign one or an unbuildable one', () => {
    expect(buildableTarget(undefined, parse, even)).toBeNull();
    expect(buildableTarget('y:4', parse, even)).toBeNull();
    expect(buildableTarget('x:3', parse, even)).toBeNull();
  });
});

describe('NothingToAskError', () => {
  it('names the exercise', () => {
    const error = new NothingToAskError('chord-quality');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('NothingToAskError');
    expect(error.message).toContain('chord-quality');
  });
});

describe('planInputs / askableExercises', () => {
  it('lists every exercise with its buildable skills on a full range', () => {
    const range = { low: 36, high: 96 };
    const inputs = planInputs(EXERCISES, range);
    expect(inputs.map((input) => input.id)).toEqual(
      EXERCISES.map((exercise) => exercise.id),
    );
    for (const input of inputs)
      expect(input.skillIds.length).toBeGreaterThan(0);
    expect(askableExercises(EXERCISES, range)).toEqual([...EXERCISES]);
  });

  it('leaves out an exercise that has nothing to ask on a narrow range', () => {
    // One octave: a ii-V-I cadence needs about seventeen semitones.
    const range = { low: 60, high: 72 };
    const ids = askableExercises(EXERCISES, range).map((e) => e.id);
    expect(ids).not.toContain('progression-recognition');
    expect(ids).toContain('find-the-note');
    const inputs = planInputs(EXERCISES, range);
    expect(
      inputs.find((input) => input.id === 'progression-recognition')?.skillIds,
    ).toEqual([]);
  });
});
