/**
 * The registry's cross-exercise guarantees. One drill's own rules are tested
 * next to it; what is tested here is what must hold for *every* exercise,
 * whichever is registered next.
 */

import { describe, expect, it } from 'vitest';
import { EXERCISES, DEFAULT_EXERCISE_ID, getExercise } from './registry';

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

/** Every shape a crafted segment can be smuggled into an id in. */
function craftedIds(exerciseId: string): string[] {
  return CRAFTED.flatMap((segment) => [
    `${exerciseId}:${segment}`,
    `${exerciseId}:${segment}:0`,
    `${exerciseId}:0:${segment}`,
    `${exerciseId}:pc:${segment}`,
    `${exerciseId}:maj7:${segment}`,
    `${exerciseId}:${segment}:${segment}`,
    `${exerciseId}:major-ii-V-I:${segment}`,
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
      it('names every skill it covers', () => {
        const skillIds = exercise.skillsCovered(exercise.defaultSettings);
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
          for (const skillId of other.skillsCovered(other.defaultSettings)) {
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
