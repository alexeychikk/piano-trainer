/**
 * Reading a skill id back apart — the one place an exercise decodes the ids it
 * writes with its own `skillIdFor()`.
 *
 * A skill id is **not** trusted input. It arrives from IndexedDB or from a 5b
 * import file, both of which the user can hand-edit, so the decoding path gets
 * the storage layer's rule (`parseAttempt`/`parseSkill`): validate, and on
 * anything unexpected degrade to the raw id rather than throw or invent a
 * label. Two traps this module closes for every exercise:
 *
 * - **Inherited keys.** `'constructor' in TABLE` is `true` for every object
 *   literal, so a segment like `constructor` used to walk straight into a
 *   lookup table and come back as `function Object() { [native code] }` — or,
 *   in `play-the-voicing`, as a function that `hasShell()` then called
 *   `.find()` on, throwing and taking the whole `/progress` screen down. Every
 *   membership test is `Object.hasOwn()`, here and in `$lib/theory`.
 * - **Loose numbers.** `Number('')` is `0` and `Number(' 3 ')` is `3`, so an
 *   empty or padded segment used to render a plausible, wrong label. A numeric
 *   segment is only a number when it is spelled the way we wrote it.
 */

import type { PitchClass } from '$lib/theory';

/** Canonical decimal, no sign, no padding, no exponent — what we write out. */
const CANONICAL_INT = /^(0|[1-9][0-9]*)$/;

/**
 * The segments of `skillId` after the `<exerciseId>:` prefix, or `null` when
 * the id is not this exercise's or does not have exactly `count` of them.
 */
export function skillIdSegments(
  skillId: string,
  exerciseId: string,
  count: number,
): string[] | null {
  const prefix = `${exerciseId}:`;
  if (!skillId.startsWith(prefix)) return null;
  const segments = skillId.slice(prefix.length).split(':');
  return segments.length === count ? segments : null;
}

/**
 * A segment as a whole number in `0..max`, or `null`. Bounded because every
 * number in a skill id is one: a pitch class, or an interval no wider than the
 * MIDI keyboard it must be played on.
 */
export function integerSegment(segment: string, max: number): number | null {
  if (!CANONICAL_INT.test(segment)) return null;
  const value = Number(segment);
  return Number.isSafeInteger(value) && value <= max ? value : null;
}

/** A segment as a pitch class (`0..11`), or `null`. */
export function pitchClassSegment(segment: string): PitchClass | null {
  return integerSegment(segment, 11);
}

/**
 * The widest a numeric segment that names an interval may be: two notes on a
 * MIDI keyboard are at most 127 semitones apart, so nothing beyond that is a
 * distance anyone can play — or name (`M3 + 83333333333333330000 octaves` was
 * what `1e21` used to render as).
 */
export const MAX_SEMITONE_SEGMENT = 127;
