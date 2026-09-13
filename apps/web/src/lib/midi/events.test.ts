import { describe, expect, it } from 'vitest';
import {
  applyNoteEvent,
  heldMidiNotes,
  parseMidiMessage,
  type HeldNotes,
  type NoteEvent,
} from './events';

const on = (midi: number, velocity = 80, at = 0): NoteEvent => ({
  type: 'on',
  midi,
  velocity,
  at,
  source: 'midi',
});

const off = (midi: number, at = 0): NoteEvent => ({
  type: 'off',
  midi,
  at,
  source: 'midi',
});

describe('parseMidiMessage', () => {
  it('decodes note-on', () => {
    expect(parseMidiMessage([0x90, 60, 100], 12)).toEqual({
      type: 'on',
      midi: 60,
      velocity: 100,
      at: 12,
      source: 'midi',
    });
  });

  it('decodes note-off', () => {
    expect(parseMidiMessage([0x80, 60, 0], 3)).toEqual({
      type: 'off',
      midi: 60,
      at: 3,
      source: 'midi',
    });
  });

  it('treats note-on with velocity 0 as note-off', () => {
    expect(parseMidiMessage([0x90, 64, 0], 0)).toEqual({
      type: 'off',
      midi: 64,
      at: 0,
      source: 'midi',
    });
  });

  it('reads any channel', () => {
    expect(parseMidiMessage(Uint8Array.of(0x9f, 72, 64), 0)?.type).toBe('on');
    expect(parseMidiMessage(Uint8Array.of(0x83, 72, 64), 0)?.type).toBe('off');
  });

  it('ignores everything that is not a note message', () => {
    expect(parseMidiMessage([0xb0, 64, 127], 0)).toBeNull(); // sustain pedal
    expect(parseMidiMessage([0xf8], 0)).toBeNull(); // clock
    expect(parseMidiMessage([0x90, 60], 0)).toBeNull(); // truncated
    expect(parseMidiMessage([0x90, 200, 100], 0)).toBeNull(); // out of range
  });
});

describe('held notes', () => {
  const empty: HeldNotes = new Map();

  it('adds and removes notes', () => {
    const one = applyNoteEvent(empty, on(60, 90, 5));
    expect(one.get(60)).toEqual({ velocity: 90, at: 5 });
    const none = applyNoteEvent(one, off(60, 9));
    expect(none.size).toBe(0);
  });

  it('holds a chord and clears it key by key', () => {
    let held: HeldNotes = empty;
    for (const midi of [60, 64, 67]) held = applyNoteEvent(held, on(midi));
    expect(heldMidiNotes(held)).toEqual([60, 64, 67]);
    held = applyNoteEvent(held, off(64));
    expect(heldMidiNotes(held)).toEqual([60, 67]);
  });

  it('sorts held notes ascending whatever the play order', () => {
    let held: HeldNotes = empty;
    for (const midi of [67, 48, 60]) held = applyNoteEvent(held, on(midi));
    expect(heldMidiNotes(held)).toEqual([48, 60, 67]);
  });

  it('restarts a hold when the same key is pressed again', () => {
    const first = applyNoteEvent(empty, on(60, 30, 1));
    const second = applyNoteEvent(first, on(60, 110, 4));
    expect(second.size).toBe(1);
    expect(second.get(60)).toEqual({ velocity: 110, at: 4 });
  });

  it('keeps the same map when a note-off does not match a held note', () => {
    const held = applyNoteEvent(empty, on(60));
    expect(applyNoteEvent(held, off(61))).toBe(held);
  });
});
