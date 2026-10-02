/**
 * What an exercise can actually ask, on the user's instrument — the one
 * question the planner, `/progress`, home and `/session` put to the registry.
 *
 * `skillsCovered(settings, range)` returns **only skills `generate()` can
 * build** under those settings on that range: a quality whose voicing does not
 * fit the keyboard, or one the theory module cannot build at all, is not a
 * skill the drill will ever ask, so it may not appear as `due`, `weak` or
 * `new` either. Every exercise draws its questions from the same set it
 * reports, so the two cannot drift.
 *
 * An exercise with nothing buildable reports `[]` and its `generate()` throws
 * `NothingToAskError` — never a question from outside the settings (the old
 * `['maj']` fallback drilled a triad nobody had enabled, under a skill nobody
 * could see on `/progress`). The planner simply has nothing for it, `/session`
 * leaves it out of the mix (`askableExercises`), and a plain drill that is
 * opened anyway ends instead of asking (`runner.svelte.ts`).
 */

import { pcOf, type Midi, type PitchClass } from '$lib/theory';
import type { AnyExercise, KeyRange, SkillId } from './types';

/** All twelve, in order — the keys a keyed drill is asked in. */
export const PITCH_CLASSES: readonly PitchClass[] = Array.from(
  { length: 12 },
  (_, pc) => pc,
);

/**
 * The pitch classes that occur somewhere in `[low, high]`, in `PITCH_CLASSES`
 * order — i.e. the keys an anchor note may be placed in when it has to sit
 * between `low` and `high`. All twelve once the window is eleven semitones
 * wide; fewer on a window narrower than that, none on an empty one.
 */
export function pitchClassesIn(low: Midi, high: Midi): PitchClass[] {
  if (high < low) return [];
  if (high - low >= 11) return [...PITCH_CLASSES];
  return PITCH_CLASSES.filter((pc) => (pc - pcOf(low) + 12) % 12 <= high - low);
}

/** `generate()` was asked for a question it has no way to build. */
export class NothingToAskError extends Error {
  constructor(exerciseId: string) {
    super(`${exerciseId}: nothing buildable under these settings and range`);
    this.name = 'NothingToAskError';
  }
}

/** The skills `exercise` can ask on `range`, under its current settings. */
export function coveredSkills(
  exercise: AnyExercise,
  range: KeyRange,
): SkillId[] {
  return exercise.skillsCovered(exercise.defaultSettings, range);
}

/** The planner's input — one entry per exercise, buildable skills only. */
export function planInputs(
  exercises: readonly AnyExercise[],
  range: KeyRange,
): { id: string; skillIds: SkillId[] }[] {
  return exercises.map((exercise) => ({
    id: exercise.id,
    skillIds: coveredSkills(exercise, range),
  }));
}

/** The exercises that have at least one question to ask on `range`. */
export function askableExercises(
  exercises: readonly AnyExercise[],
  range: KeyRange,
): AnyExercise[] {
  return exercises.filter(
    (exercise) => coveredSkills(exercise, range).length > 0,
  );
}

/**
 * The exact target a `generate()` was handed, if it is one of `choices` —
 * `GenerateContext.targetSkillId` decoded by the exercise's own `parse`. A
 * target from another exercise, one that does not decode, or one this
 * exercise cannot build under its settings and range returns `null`, and the
 * caller draws as usual: a bias the drill cannot honour is not an error.
 */
export function buildableTarget<T>(
  targetSkillId: SkillId | undefined,
  parse: (skillId: SkillId) => T | null,
  isBuildable: (target: T) => boolean,
): T | null {
  if (targetSkillId === undefined) return null;
  const target = parse(targetSkillId);
  return target !== null && isBuildable(target) ? target : null;
}
