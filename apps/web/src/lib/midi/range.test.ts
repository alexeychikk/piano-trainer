import { describe, expect, it } from 'vitest';
import {
  IDLE_WIZARD,
  pressKey,
  startWizard,
  wizardPrompt,
  type WizardState,
} from './range';

describe('range wizard', () => {
  it('asks for the lowest key first, then the highest', () => {
    const low = startWizard();
    expect(low.step).toBe('low');
    expect(wizardPrompt(low)).toBe('Press the lowest key on your piano.');

    const high = pressKey(low, 28);
    expect(high).toMatchObject({ step: 'high', low: 28, high: null });
    expect(wizardPrompt(high)).toBe('Now press the highest key.');

    const done = pressKey(high, 103);
    expect(done).toMatchObject({ step: 'done', low: 28, high: 103 });
    expect(wizardPrompt(done)).toBe('Range set: E1 to G7.');
  });

  it('sorts the two presses, so either end may come first', () => {
    const state = pressKey(pressKey(startWizard(), 96), 36);
    expect(state).toMatchObject({ step: 'done', low: 36, high: 96 });
  });

  it('rejects a second press less than an octave away and keeps asking', () => {
    const high = pressKey(startWizard(), 60);
    const problem = pressKey(high, 64);
    expect(problem.step).toBe('high');
    expect(problem.problem).toContain('less than an octave');
    // The wizard is still usable: a proper press finishes it.
    const done = pressKey(problem, 84);
    expect(done).toMatchObject({ step: 'done', low: 60, high: 84 });
    expect(done.problem).toBeNull();
  });

  it('ignores presses when it is not running', () => {
    expect(pressKey(IDLE_WIZARD, 60)).toBe(IDLE_WIZARD);
    const done: WizardState = {
      step: 'done',
      low: 36,
      high: 96,
      problem: null,
    };
    expect(pressKey(done, 60)).toBe(done);
  });

  it('says nothing before it starts', () => {
    expect(wizardPrompt(IDLE_WIZARD)).toBe('');
  });
});
