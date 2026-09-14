import { describe, expect, it } from 'vitest';
import { mulberry32, pick, randomInt } from './rng';

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces different streams for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('stays inside [0, 1)', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 500; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('randomInt', () => {
  it('covers both ends of the range and never leaves it', () => {
    const rng = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) seen.add(randomInt(rng, 60, 63));
    expect([...seen].sort()).toEqual([60, 61, 62, 63]);
  });

  it('collapses an empty range to its single value', () => {
    expect(randomInt(() => 0.999, 60, 60)).toBe(60);
    expect(randomInt(() => 0.999, 60, 59)).toBe(60);
  });
});

describe('pick', () => {
  it('returns undefined for an empty list', () => {
    expect(pick(mulberry32(1), [])).toBeUndefined();
  });

  it('picks from the list', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 50; i += 1) {
      expect(['a', 'b', 'c']).toContain(pick(rng, ['a', 'b', 'c']));
    }
  });
});
