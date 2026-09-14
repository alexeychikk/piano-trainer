import { describe, expect, it } from 'vitest';
import { feedbackAnnouncement, feedbackLines } from './feedback';

describe('feedbackLines', () => {
  it('says Correct, with the answer named (copy deck §9)', () => {
    expect(
      feedbackLines({ outcome: 'correct', expectedLabel: 'C4', streak: 1 }),
    ).toEqual({
      glyph: '✓',
      headline: 'Correct',
      detail: 'C4',
      tone: 'success',
    });
  });

  it('calls the streak out from five in a row', () => {
    expect(
      feedbackLines({ outcome: 'correct', expectedLabel: 'C4', streak: 4 })
        .headline,
    ).toBe('Correct');
    expect(
      feedbackLines({ outcome: 'correct', expectedLabel: 'C4', streak: 7 })
        .headline,
    ).toBe('Correct · 7 in a row');
  });

  it('names the answer and what went wrong, and waits for space', () => {
    expect(
      feedbackLines({
        outcome: 'wrong',
        expectedLabel: 'Eb4',
        detail: 'You played E4 — 1 semitone too high',
        streak: 0,
      }),
    ).toEqual({
      glyph: '✗',
      headline: 'Eb4',
      detail: 'You played E4 — 1 semitone too high · Space to continue',
      tone: 'danger',
    });
  });

  it('still prompts to continue when the exercise has no explanation', () => {
    expect(
      feedbackLines({ outcome: 'wrong', expectedLabel: 'Eb4', streak: 0 })
        .detail,
    ).toBe('Space to continue');
  });

  it('marks a skip with its own glyph', () => {
    expect(
      feedbackLines({ outcome: 'skipped', expectedLabel: 'G3', streak: 0 }),
    ).toEqual({
      glyph: '⤳',
      headline: 'G3',
      detail: 'Skipped · Space to continue',
      tone: 'hint',
    });
  });
});

describe('feedbackAnnouncement', () => {
  it('speaks the outcome once, in words (a11y §8.4)', () => {
    expect(
      feedbackAnnouncement({ outcome: 'correct', expectedLabel: 'C4' }),
    ).toBe('Correct. C4.');
    expect(
      feedbackAnnouncement({
        outcome: 'wrong',
        expectedLabel: 'C4',
        detail: 'You played E4 — 4 semitones too high',
      }),
    ).toBe(
      'Incorrect. You played E4 — 4 semitones too high. The answer was C4.',
    );
    expect(
      feedbackAnnouncement({ outcome: 'skipped', expectedLabel: 'C4' }),
    ).toBe('Skipped. The answer was C4.');
  });
});
