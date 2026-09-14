/**
 * The seeded random number generator every exercise draws from (ADR §5:
 * `generate()` is pure and takes an `rng`, never `Math.random()`). A question
 * is reproducible from `(exerciseId, seed, settings)`, which is what makes
 * grading bugs reproducible and unit tests deterministic.
 *
 * `mulberry32` — 32-bit state, one multiply-xorshift round: tiny, fast, and
 * good enough for picking notes. Not for anything cryptographic.
 */

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in `[min, max]`, inclusive. */
export function randomInt(rng: () => number, min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

/** Pick one item. Returns `undefined` only for an empty list. */
export function pick<T>(rng: () => number, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[randomInt(rng, 0, items.length - 1)];
}

/** A fresh seed for the next question. Impure by design — the only place. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
