/**
 * The scaffolding every drill's `generate()` is built from — how a question is
 * *drawn* and *placed*, as opposed to what it asks (the exercise) or how the
 * music is spelled (`$lib/theory`). A new exercise composes these instead of
 * copying them from its neighbours.
 *
 * **RNG consumption is part of the contract.** Question ids and seeds are
 * logged with every attempt, so a seed must keep drawing the same question
 * across refactors: each helper consumes the rng exactly as the inline code it
 * replaced did — `randomInt` with an empty or one-item span consumes nothing —
 * and `seed-snapshot.test.ts` holds every registered exercise to it.
 */

import {
  midiToName,
  pcOf,
  type Midi,
  type NoteName,
  type PitchClass,
} from '$lib/theory';
import { buildableTarget } from './coverage';
import { randomInt } from './rng';
import type { PlaybackPlan, SkillId } from './types';

/** How hard a drill tries to avoid asking the same skill twice in a row. */
export const MAX_REDRAWS = 4;

/**
 * Black keys are spelled with flats: that is how a jazz chart names them, and
 * one spelling per pitch keeps the reveal, the prompt and the keyboard label
 * (`labelStyle: 'context'`) saying the same thing.
 */
export function spell(midi: Midi): NoteName {
  return midiToName(midi, 'flat');
}

/** `Question.spellings` for these notes, each spelled with `spell()`. */
export function spellings(notes: readonly Midi[]): Map<Midi, NoteName> {
  return new Map(notes.map((midi) => [midi, spell(midi)]));
}

/** Every occurrence of `pc` in `[from, to]`, low to high. */
export function occurrences(pc: PitchClass, from: Midi, to: Midi): Midi[] {
  const notes: Midi[] = [];
  for (let midi = lowestFrom(pc, from); midi <= to; midi += 12)
    notes.push(midi);
  return notes;
}

/** The lowest occurrence of `pc` at or above `from`. */
export function lowestFrom(pc: PitchClass, from: Midi): Midi {
  return from + ((pc - pcOf(from) + 12) % 12);
}

/** One of `items`, uniformly. `items` must not be empty. */
export function choose<T>(rng: () => number, items: readonly T[]): T {
  return items[randomInt(rng, 0, items.length - 1)];
}

/**
 * Draw, then redraw a few times while the draw repeats the last skill asked.
 *
 * A few times rather than until different: the same skill twice in a row is
 * dull, but forcing a change would bias the draw on a small set (and could not
 * terminate at all on a one-skill one). `canVary` is `false` when no other
 * draw is possible, so no rng is spent trying. A planner target is never
 * passed through here — the planner asked for it, so it is never redrawn.
 */
export function drawAvoidingRepeat<T>(
  draw: () => T,
  skillIdOf: (value: T) => SkillId,
  recentSkillIds: readonly SkillId[],
  canVary = true,
): T {
  let value = draw();
  for (
    let redraw = 0;
    canVary && redraw < MAX_REDRAWS && recentSkillIds[0] === skillIdOf(value);
    redraw += 1
  )
    value = draw();
  return value;
}

/** A keyed skill: something asked in one of the twelve keys. */
export interface Keyed<Q> {
  quality: Q;
  rootPc: PitchClass;
}

/** A quality, then a key from that quality's buildable keys. */
export function drawKeyed<Q>(
  rng: () => number,
  choices: readonly Q[],
  rootsOf: (quality: Q) => readonly PitchClass[],
): Keyed<Q> {
  const quality = choose(rng, choices);
  return { quality, rootPc: choose(rng, rootsOf(quality)) };
}

/**
 * The keyed drill's whole draw: the planner's target exactly when it is one
 * of `choices` in a key `rootsOf` can build, otherwise a quality, then a key
 * from that quality's buildable keys, avoiding a repeat of the last skill.
 * Drawing the quality first means a full range consumes the rng the same way
 * whatever the range (`coverage.ts`).
 */
export function drawKey<Q>(options: {
  rng: () => number;
  targetSkillId: SkillId | undefined;
  recentSkillIds: readonly SkillId[];
  choices: readonly Q[];
  rootsOf: (quality: Q) => readonly PitchClass[];
  parseSkillId: (skillId: SkillId) => Keyed<Q> | null;
  skillIdFor: (quality: Q, rootPc: PitchClass) => SkillId;
}): Keyed<Q> {
  const { rng, choices, rootsOf, skillIdFor } = options;
  const target = buildableTarget(
    options.targetSkillId,
    options.parseSkillId,
    (skill) =>
      choices.includes(skill.quality) &&
      rootsOf(skill.quality).includes(skill.rootPc),
  );
  return (
    target ??
    drawAvoidingRepeat(
      () => drawKeyed(rng, choices, rootsOf),
      (key) => skillIdFor(key.quality, key.rootPc),
      options.recentSkillIds,
    )
  );
}

/** An inclusive span of keys: where a note may go, or where it is comfortable. */
export interface Window {
  low: Midi;
  high: Midi;
}

/**
 * A key in `window`, drawn from the part of it inside `comfort` when that is
 * not empty: a drill prefers the register where its question is easiest to
 * hear and play, but the user's instrument is the real limit. An inverted
 * window yields its `low` without consuming the rng.
 */
export function pickInWindow(
  rng: () => number,
  window: Window,
  comfort: Window,
): Midi {
  if (window.high < window.low) return window.low;
  const comfortLow = Math.max(window.low, comfort.low);
  const comfortHigh = Math.min(window.high, comfort.high);
  return comfortHigh >= comfortLow
    ? randomInt(rng, comfortLow, comfortHigh)
    : randomInt(rng, window.low, window.high);
}

/**
 * An occurrence of `pc` in `window`, drawn from those inside `comfort` when
 * there are any — `pickInWindow` for a note whose key is already decided.
 * `null` when `pc` does not occur in `window` at all (no rng consumed), so the
 * caller decides how to place a shape that does not fit.
 */
export function pickOccurrence(
  rng: () => number,
  pc: PitchClass,
  window: Window,
  comfort: Window,
): Midi | null {
  const comfortable = occurrences(
    pc,
    Math.max(window.low, comfort.low),
    Math.min(window.high, comfort.high),
  );
  const anywhere =
    comfortable.length > 0
      ? comfortable
      : occurrences(pc, window.low, window.high);
  return anywhere.length === 0 ? null : choose(rng, anywhere);
}

/** How long a read drill's reference root rings, and how loud. */
export const REFERENCE_MS = 900;
export const REFERENCE_VELOCITY = 80;
/** How long the revealed answer of a read drill rings, and how loud. */
export const REVEAL_MS = 1600;
export const REVEAL_VELOCITY = 84;

/**
 * The playback of a drill that is **read** rather than heard (a chord symbol
 * you play): the question sounds the root alone, so `Replay` is worth
 * pressing and the key can be found by ear without giving the answer away;
 * a miss gets to hear the answer itself, and only it
 * (`Question.revealPlayback`, slice 8). Velocities are musical — the root sits
 * under the voicing on purpose — never headroom (`audio/gain.ts`).
 */
export function referenceThenReveal(
  rootMidi: Midi,
  answer: Midi[],
): { playback: PlaybackPlan; revealPlayback: PlaybackPlan } {
  return {
    playback: {
      events: [
        {
          atMs: 0,
          notes: [rootMidi],
          durationMs: REFERENCE_MS,
          velocity: REFERENCE_VELOCITY,
        },
      ],
    },
    revealPlayback: {
      events: [
        {
          atMs: 0,
          notes: answer,
          durationMs: REVEAL_MS,
          velocity: REVEAL_VELOCITY,
        },
      ],
    },
  };
}
