import { describe, expect, it } from 'vitest';
import {
  NEXT_QUESTION_HINT,
  NEXT_QUESTION_KEY_NAME,
  NEXT_QUESTION_MIDI_NOTE,
  isNextQuestionNote,
  isReservedNextQuestionNote,
  reserveNextQuestionNote,
} from './next-key';

describe('the next-question key', () => {
  it('is the piano C1, named in the hint', () => {
    expect(NEXT_QUESTION_MIDI_NOTE).toBe(24);
    expect(NEXT_QUESTION_KEY_NAME).toBe('C1');
    expect(NEXT_QUESTION_HINT).toBe('Press C1 or Enter for next');
  });

  it('is a MIDI port’s C1 only', () => {
    expect(isNextQuestionNote(24, 'midi')).toBe(true);
    expect(isNextQuestionNote(36, 'midi')).toBe(false);
    expect(isNextQuestionNote(24, 'onscreen')).toBe(false);
    expect(isNextQuestionNote(24, 'computer-keyboard')).toBe(false);
  });

  it('is reserved only while someone holds a claim, released once each', () => {
    expect(isReservedNextQuestionNote(24, 'midi')).toBe(false);
    const a = reserveNextQuestionNote();
    const b = reserveNextQuestionNote();
    expect(isReservedNextQuestionNote(24, 'midi')).toBe(true);
    a();
    a();
    expect(isReservedNextQuestionNote(24, 'midi')).toBe(true);
    b();
    expect(isReservedNextQuestionNote(24, 'midi')).toBe(false);
  });
});
