import { describe, expect, it } from 'vitest';
import { runnerHighlights } from './highlights';

const keyboard = { low: 60, high: 72 };

describe('runnerHighlights', () => {
  it('shows held notes as played while the user answers', () => {
    const map = runnerHighlights({
      keyboard,
      held: [62, 64],
      answered: [],
      outcome: null,
      revealed: [],
    });
    expect(map.get(62)).toBe('played');
    expect(map.get(64)).toBe('played');
    expect(map.get(60)).toBeUndefined();
  });

  it('dims what the question does not cover', () => {
    const map = runnerHighlights({
      keyboard,
      questionRange: { low: 64, high: 67 },
      held: [],
      answered: [],
      outcome: null,
      revealed: [],
    });
    expect(map.get(60)).toBe('dim');
    expect(map.get(63)).toBe('dim');
    expect(map.get(64)).toBeUndefined();
    expect(map.get(72)).toBe('dim');
  });

  it('turns the answer green when it was right', () => {
    const map = runnerHighlights({
      keyboard,
      held: [65],
      answered: [65],
      outcome: 'correct',
      revealed: [],
    });
    // `correct` outranks `played`, even while the key is still down (§5.1).
    expect(map.get(65)).toBe('correct');
  });

  it('shows a miss as wrong against the revealed target', () => {
    const map = runnerHighlights({
      keyboard,
      held: [66],
      answered: [66],
      outcome: 'wrong',
      revealed: [65],
    });
    expect(map.get(66)).toBe('wrong');
    expect(map.get(65)).toBe('target');
  });

  it('reveals the target alone after a skip', () => {
    const map = runnerHighlights({
      keyboard,
      held: [],
      answered: [],
      outcome: 'skipped',
      revealed: [70],
    });
    expect(map.get(70)).toBe('target');
    expect([...map.values()]).toEqual(['target']);
  });

  it('lets wrong win over a dimmed key, so a stray note is still explained', () => {
    const map = runnerHighlights({
      keyboard,
      questionRange: { low: 64, high: 67 },
      held: [],
      answered: [60],
      outcome: 'wrong',
      revealed: [65],
    });
    expect(map.get(60)).toBe('wrong');
  });
});
