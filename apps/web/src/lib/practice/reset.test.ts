import { describe, expect, it } from 'vitest';
import {
  canConfirm,
  confirmReducer,
  IDLE,
  matchesConfirmWord,
  RESET_CONFIRM_WORD,
  type ConfirmState,
} from './reset';

/** Open the affordance on a target, as the button and the file pick do. */
function asking(target: 'reset' | 'empty-import' = 'reset'): ConfirmState {
  return confirmReducer(IDLE, { type: 'ask', target });
}

function typing(value: string): ConfirmState {
  return confirmReducer(asking(), { type: 'type', value });
}

describe('matchesConfirmWord', () => {
  it('matches the word, ignoring case and surrounding space', () => {
    for (const raw of ['RESET', 'reset', ' Reset ', '\tRESET\n']) {
      expect(matchesConfirmWord(raw)).toBe(true);
    }
  });

  it('matches nothing else', () => {
    for (const raw of ['', 'RESE', 'RESETT', 'RE SET', 'delete']) {
      expect(matchesConfirmWord(raw)).toBe(false);
    }
  });
});

describe('confirmReducer', () => {
  it('opens with an empty field, whatever was typed last time', () => {
    const armed = typing(RESET_CONFIRM_WORD);
    const reopened = confirmReducer(armed, { type: 'ask', target: 'reset' });
    expect(reopened).toEqual({
      phase: 'confirming',
      target: 'reset',
      typed: '',
    });
    // …and re-asking for the *other* target cannot inherit the arming either.
    const swapped = confirmReducer(armed, {
      type: 'ask',
      target: 'empty-import',
    });
    expect(canConfirm(swapped)).toBe(false);
    expect(swapped).toMatchObject({ target: 'empty-import' });
  });

  it('arms the danger button only once the field matches', () => {
    expect(canConfirm(IDLE)).toBe(false);
    expect(canConfirm(asking())).toBe(false);
    expect(canConfirm(typing('rese'))).toBe(false);
    expect(canConfirm(typing('reset'))).toBe(true);
  });

  it('confirms into `working`, and only from an armed field', () => {
    expect(confirmReducer(typing('nope'), { type: 'confirm' })).toEqual({
      phase: 'confirming',
      target: 'reset',
      typed: 'nope',
    });
    expect(confirmReducer(typing('RESET'), { type: 'confirm' })).toEqual({
      phase: 'working',
      target: 'reset',
    });
    // Nothing to confirm when nothing was asked.
    expect(confirmReducer(IDLE, { type: 'confirm' })).toEqual(IDLE);
  });

  it('cancels back to idle — and a cancelled question never re-arms', () => {
    const cancelled = confirmReducer(typing('RESET'), { type: 'cancel' });
    expect(cancelled).toEqual(IDLE);
    expect(canConfirm(cancelled)).toBe(false);
    expect(confirmReducer(cancelled, { type: 'type', value: 'RESET' })).toEqual(
      IDLE,
    );
  });

  it('cannot call back a wipe that is already in flight', () => {
    const working = confirmReducer(typing('RESET'), { type: 'confirm' });
    expect(confirmReducer(working, { type: 'cancel' })).toEqual(working);
    expect(confirmReducer(working, { type: 'type', value: '' })).toEqual(
      working,
    );
    expect(
      confirmReducer(working, { type: 'ask', target: 'empty-import' }),
    ).toEqual(working);
    // Only the store's answer closes it.
    expect(confirmReducer(working, { type: 'settled' })).toEqual(IDLE);
  });
});
