/**
 * The exercise registry (ADR §5). `/practice/[exerciseId]` resolves an id
 * here; home lists what is registered. Adding an exercise is one import and
 * one array entry — nothing else in the app changes.
 */

import { chordQuality } from './chord-quality';
import { findTheNote } from './find-the-note';
import { intervalRecognition } from './interval-recognition';
import { playTheVoicing } from './play-the-voicing';
import type { AnyExercise, ExerciseId } from './types';

/** In the order they are offered. */
export const EXERCISES: readonly AnyExercise[] = [
  findTheNote,
  intervalRecognition,
  chordQuality,
  playTheVoicing,
];

export function getExercise(id: ExerciseId): AnyExercise | null {
  return EXERCISES.find((exercise) => exercise.id === id) ?? null;
}

/**
 * The fallback drill: `/progress`'s empty state, and anything that needs *an*
 * exercise with no plan to pick one. Since slice 9b home's hero opens the
 * mixed session (`/session`) instead.
 */
export const DEFAULT_EXERCISE_ID: ExerciseId = findTheNote.id;
