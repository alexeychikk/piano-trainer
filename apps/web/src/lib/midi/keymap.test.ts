import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BASE_OCTAVE,
  isNoteKeyPress,
  isTypingTarget,
  midiForComputerKey,
  shiftOctave,
} from './keymap';

describe('midiForComputerKey', () => {
  it('maps A to middle C by default and K to the octave above', () => {
    expect(midiForComputerKey('KeyA')).toBe(60);
    expect(midiForComputerKey('KeyK')).toBe(72);
  });

  it('maps the whole chromatic octave in row order', () => {
    const codes = [
      'KeyA',
      'KeyW',
      'KeyS',
      'KeyE',
      'KeyD',
      'KeyF',
      'KeyT',
      'KeyG',
      'KeyY',
      'KeyH',
      'KeyU',
      'KeyJ',
      'KeyK',
    ];
    expect(codes.map((code) => midiForComputerKey(code))).toEqual([
      60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72,
    ]);
  });

  it('follows the movable octave', () => {
    expect(midiForComputerKey('KeyA', DEFAULT_BASE_OCTAVE - 1)).toBe(48);
    expect(midiForComputerKey('KeyA', 7)).toBe(96);
  });

  it('returns null for unmapped keys', () => {
    expect(midiForComputerKey('Space')).toBeNull();
    expect(midiForComputerKey('KeyZ')).toBeNull();
  });
});

describe('shiftOctave', () => {
  it('shifts and clamps to the playable range', () => {
    expect(shiftOctave(4, 1)).toBe(5);
    expect(shiftOctave(4, -1)).toBe(3);
    expect(shiftOctave(0, -1)).toBe(0);
    expect(shiftOctave(7, 1)).toBe(7);
  });
});

describe('isNoteKeyPress', () => {
  it('accepts mapped keys and the octave shifts', () => {
    expect(isNoteKeyPress({ code: 'KeyA' })).toBe(true);
    expect(isNoteKeyPress({ code: 'KeyZ' })).toBe(true);
    expect(isNoteKeyPress({ code: 'KeyX' })).toBe(true);
  });

  it('leaves shell shortcuts and browser defaults alone', () => {
    expect(isNoteKeyPress({ code: 'KeyA', metaKey: true })).toBe(false);
    expect(isNoteKeyPress({ code: 'KeyA', ctrlKey: true })).toBe(false);
    expect(isNoteKeyPress({ code: 'KeyA', altKey: true })).toBe(false);
    expect(isNoteKeyPress({ code: 'Space' })).toBe(false);
    expect(isNoteKeyPress({ code: 'Tab' })).toBe(false);
  });

  it('ignores auto-repeat, so a held key is one note', () => {
    expect(isNoteKeyPress({ code: 'KeyA', repeat: true })).toBe(false);
  });
});

describe('isTypingTarget', () => {
  it('spots text entry', () => {
    const input = document.createElement('input');
    const div = document.createElement('div');
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    expect(isTypingTarget(div)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
