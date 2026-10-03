import { describe, expect, it } from 'vitest';
import {
  MAX_REDRAWS,
  choose,
  drawAvoidingRepeat,
  drawKey,
  lowestFrom,
  occurrences,
  pickInWindow,
  pickOccurrence,
  referenceThenReveal,
  spell,
  spellings,
} from './draw';
import { mulberry32 } from './rng';

/** An rng that counts how often it is asked. */
function counting(seed = 1): { rng: () => number; calls: () => number } {
  const inner = mulberry32(seed);
  let calls = 0;
  return {
    rng: () => {
      calls += 1;
      return inner();
    },
    calls: () => calls,
  };
}

describe('spell', () => {
  it('spells black keys with flats', () => {
    expect(spell(61)).toBe('Db4');
    expect(spellings([60, 63])).toEqual(
      new Map([
        [60, 'C4'],
        [63, 'Eb4'],
      ]),
    );
  });
});

describe('occurrences / lowestFrom', () => {
  it('lists every octave of a pitch class in an inclusive span', () => {
    expect(occurrences(0, 48, 72)).toEqual([48, 60, 72]);
    expect(occurrences(2, 48, 49)).toEqual([]);
    expect(lowestFrom(2, 48)).toBe(50);
    expect(lowestFrom(0, 61)).toBe(72);
  });
});

describe('choose', () => {
  it('spends no rng on a single item', () => {
    const { rng, calls } = counting();
    expect(choose(rng, ['only'])).toBe('only');
    expect(calls()).toBe(0);
  });
});

describe('drawAvoidingRepeat', () => {
  it('redraws at most MAX_REDRAWS times while the draw repeats', () => {
    let draws = 0;
    const value = drawAvoidingRepeat(
      () => {
        draws += 1;
        return 'same';
      },
      (v) => v,
      ['same'],
    );
    expect(value).toBe('same');
    expect(draws).toBe(1 + MAX_REDRAWS);
  });

  it('stops at the first draw that differs from the last skill', () => {
    const queue = ['a', 'a', 'b', 'a'];
    expect(
      drawAvoidingRepeat(
        () => queue.shift()!,
        (v) => v,
        ['a', 'b'],
      ),
    ).toBe('b');
    expect(queue).toEqual(['a']);
  });

  it('draws once when nothing else can be drawn', () => {
    let draws = 0;
    drawAvoidingRepeat(
      () => (draws += 1),
      () => 'same',
      ['same'],
      false,
    );
    expect(draws).toBe(1);
  });
});

describe('drawKey', () => {
  const base = {
    recentSkillIds: [],
    choices: ['maj7', 'min7'] as const,
    rootsOf: () => [0, 7] as const,
    parseSkillId: (id: string) => {
      const [quality, rootPc] = id.split(':');
      return { quality: quality as 'maj7' | 'min7', rootPc: Number(rootPc) };
    },
    skillIdFor: (quality: string, rootPc: number) => `${quality}:${rootPc}`,
  };

  it('honours a buildable target without spending rng', () => {
    const { rng, calls } = counting();
    expect(drawKey({ ...base, rng, targetSkillId: 'min7:7' })).toEqual({
      quality: 'min7',
      rootPc: 7,
    });
    expect(calls()).toBe(0);
  });

  it('draws a quality, then a root, for a target it cannot build', () => {
    const { rng, calls } = counting();
    const key = drawKey({ ...base, rng, targetSkillId: 'min7:3' });
    expect(base.choices).toContain(key.quality);
    expect([0, 7]).toContain(key.rootPc);
    expect(calls()).toBe(2);
  });
});

describe('pickInWindow', () => {
  it('prefers the comfortable part of the window', () => {
    const { rng } = counting(7);
    for (let i = 0; i < 50; i += 1) {
      const midi = pickInWindow(
        rng,
        { low: 36, high: 96 },
        { low: 48, high: 72 },
      );
      expect(midi).toBeGreaterThanOrEqual(48);
      expect(midi).toBeLessThanOrEqual(72);
    }
  });

  it('falls back to the whole window, and an inverted one costs nothing', () => {
    const { rng, calls } = counting();
    const midi = pickInWindow(
      rng,
      { low: 80, high: 84 },
      { low: 48, high: 72 },
    );
    expect(midi).toBeGreaterThanOrEqual(80);
    expect(midi).toBeLessThanOrEqual(84);
    expect(calls()).toBe(1);
    expect(
      pickInWindow(rng, { low: 70, high: 60 }, { low: 0, high: 127 }),
    ).toBe(70);
    expect(calls()).toBe(1);
  });
});

describe('pickOccurrence', () => {
  it('prefers a comfortable octave, then any octave, then null', () => {
    const { rng } = counting();
    expect(
      pickOccurrence(rng, 0, { low: 36, high: 96 }, { low: 55, high: 65 }),
    ).toBe(60);
    expect(
      pickOccurrence(rng, 0, { low: 70, high: 75 }, { low: 55, high: 65 }),
    ).toBe(72);
    expect(
      pickOccurrence(rng, 0, { low: 61, high: 70 }, { low: 55, high: 65 }),
    ).toBeNull();
  });
});

describe('referenceThenReveal', () => {
  it('sounds the root, and reveals the answer', () => {
    const plan = referenceThenReveal(48, [52, 55, 59]);
    expect(plan.playback.events.map((e) => e.notes)).toEqual([[48]]);
    expect(plan.revealPlayback.events.map((e) => e.notes)).toEqual([
      [52, 55, 59],
    ]);
  });
});
