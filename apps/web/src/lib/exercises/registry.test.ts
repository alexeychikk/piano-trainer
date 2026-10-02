/**
 * The registry's cross-exercise guarantees. One drill's own rules are tested
 * next to it; what is tested here is what must hold for *every* exercise,
 * whichever is registered next.
 */

import { describe, expect, it } from 'vitest';
import { NothingToAskError } from './coverage';
import { EXERCISES, DEFAULT_EXERCISE_ID, getExercise } from './registry';
import { mulberry32 } from './rng';
import type { AnyExercise, KeyRange, SkillId } from './types';

/** The settings store’s default instrument range (36–96). */
const RANGE = { low: 36, high: 96 };

/**
 * The default range, then narrower and narrower keyboards: a range is what
 * decides which voicings fit, so the contract is checked on several. Every one
 * is at least the settings store's twelve-semitone floor.
 */
const RANGES: readonly KeyRange[] = [
  RANGE,
  { low: 48, high: 72 },
  { low: 60, high: 79 },
  { low: 60, high: 76 },
  { low: 60, high: 72 },
];

function ask(
  exercise: AnyExercise,
  seed: number,
  range: KeyRange,
  targetSkillId?: SkillId,
) {
  return exercise.generate({
    settings: exercise.defaultSettings,
    rng: mulberry32(seed),
    seed,
    range,
    history: { recentSkillIds: [] },
    targetSkillId,
  });
}

/**
 * Segments that come from a hand-edited IndexedDB record or an imported file,
 * never from `skillIdFor()`. The first four are `Object.prototype`'s own keys:
 * `'constructor' in TABLE` is true for every object literal, so before the
 * guards were own-key checks these walked into the vocabulary tables and came
 * back as functions — `play-the-voicing` then called `.find()` on one, threw,
 * and took the whole `/progress` screen down with it. The rest are what
 * `Number()` is lenient about (`Number('')` is 0).
 */
const CRAFTED = [
  'constructor',
  'toString',
  '__proto__',
  'valueOf',
  'hasOwnProperty',
  '',
  ' 3 ',
  '-5',
  '1e21',
  '0x0',
  '3.0',
  'bogus',
];

/**
 * Every shape a crafted segment can be smuggled into an id in — **at every
 * length an exercise uses**, so the net keeps its "whatever is registered
 * next" promise. It grew a third segment for slice 11 (`rootless-voicing`'s
 * ids are `<quality>:<rootPc>:<form>`), which the two-segment shapes could
 * only reach as an id of the wrong length.
 */
function craftedIds(exerciseId: string): string[] {
  return CRAFTED.flatMap((segment) => [
    `${exerciseId}:${segment}`,
    `${exerciseId}:${segment}:0`,
    `${exerciseId}:0:${segment}`,
    `${exerciseId}:pc:${segment}`,
    `${exerciseId}:maj7:${segment}`,
    `${exerciseId}:${segment}:${segment}`,
    `${exerciseId}:major-ii-V-I:${segment}`,
    `${exerciseId}:maj7:0:${segment}`,
    `${exerciseId}:maj7:${segment}:A`,
    `${exerciseId}:${segment}:0:A`,
    `${exerciseId}:${segment}:${segment}:${segment}`,
  ]);
}

describe('the registry', () => {
  it('offers every exercise under a unique id', () => {
    const ids = EXERCISES.map((exercise) => exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(getExercise(id)?.id).toBe(id);
    expect(getExercise(DEFAULT_EXERCISE_ID)).not.toBe(null);
    expect(getExercise('no-such-exercise')).toBe(null);
  });

  describe.each(EXERCISES.map((exercise) => [exercise.id, exercise] as const))(
    '%s',
    (_id, exercise) => {
      it.each(RANGES.map((range) => [`${range.low}–${range.high}`, range]))(
        'asks only skills it covers on %s',
        (_label, range) => {
          const covered = new Set(
            exercise.skillsCovered(exercise.defaultSettings, range),
          );
          for (let seed = 1; seed <= 200; seed += 1) {
            if (covered.size === 0) {
              expect(() => ask(exercise, seed, range)).toThrow(
                NothingToAskError,
              );
              continue;
            }
            expect(covered).toContain(ask(exercise, seed, range).skillId);
          }
        },
      );

      it.each(RANGES.map((range) => [`${range.low}–${range.high}`, range]))(
        'asks exactly the skill it is targeted at on %s',
        (_label, range) => {
          const covered = exercise.skillsCovered(
            exercise.defaultSettings,
            range,
          );
          covered.forEach((skillId, i) => {
            expect(ask(exercise, i + 1, range, skillId).skillId).toBe(skillId);
          });
        },
      );

      it('draws as usual for a target it cannot build', () => {
        const covered = new Set(
          exercise.skillsCovered(exercise.defaultSettings, RANGE),
        );
        const foreign = EXERCISES.filter((other) => other.id !== exercise.id)
          .flatMap((other) => other.skillsCovered(other.defaultSettings, RANGE))
          .concat(craftedIds(exercise.id));
        foreign.forEach((target, i) => {
          expect(covered).toContain(
            ask(exercise, i + 1, RANGE, target).skillId,
          );
        });
      });

      it('names every skill it covers', () => {
        const skillIds = exercise.skillsCovered(
          exercise.defaultSettings,
          RANGE,
        );
        expect(skillIds.length).toBeGreaterThan(0);
        for (const skillId of skillIds) {
          const label = exercise.skillLabel?.(
            skillId,
            exercise.defaultSettings,
          );
          expect(label).toBeTypeOf('string');
          expect(label).not.toBe('');
          // A label is a name somebody chose, never the id it decodes.
          expect(label).not.toBe(skillId);
        }
      });

      it('degrades a crafted skill id to the raw id, and never throws', () => {
        for (const skillId of craftedIds(exercise.id)) {
          const label = exercise.skillLabel?.(
            skillId,
            exercise.defaultSettings,
          );
          expect(label, skillId).toBe(skillId);
        }
      });

      it('never renders a function or an object for a crafted id', () => {
        for (const skillId of craftedIds(exercise.id)) {
          const label = String(
            exercise.skillLabel?.(skillId, exercise.defaultSettings),
          );
          expect(label, skillId).toBeTypeOf('string');
          expect(label, skillId).not.toMatch(/native code|\[object |function /);
        }
      });

      it('leaves another exercise’s id alone', () => {
        for (const other of EXERCISES) {
          if (other.id === exercise.id) continue;
          for (const skillId of other.skillsCovered(
            other.defaultSettings,
            RANGE,
          )) {
            expect(
              exercise.skillLabel?.(skillId, exercise.defaultSettings),
              skillId,
            ).toBe(skillId);
          }
        }
      });
    },
  );
});
