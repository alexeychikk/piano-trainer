import { describe, expect, it } from 'vitest';
import { createNoteEcho, soundsInApp } from './echo';
import type { NoteEvent, NoteSource } from './events';

function on(midi: number, source: NoteSource, velocity = 80): NoteEvent {
  return { type: 'on', midi, velocity, at: 0, source };
}
function off(midi: number, source: NoteSource): NoteEvent {
  return { type: 'off', midi, at: 0, source };
}

function harness(initial: boolean) {
  const calls: string[] = [];
  let playMidi = initial;
  const route = createNoteEcho(
    {
      noteOn: (midi, velocity) => calls.push(`on ${midi} ${velocity}`),
      noteOff: (midi) => calls.push(`off ${midi}`),
    },
    () => playMidi,
  );
  return {
    calls,
    route,
    set(value: boolean) {
      playMidi = value;
    },
  };
}

describe('soundsInApp', () => {
  it('mutes only the MIDI port, and only when the setting is off', () => {
    expect(soundsInApp('midi', true)).toBe(true);
    expect(soundsInApp('midi', false)).toBe(false);
    for (const source of ['onscreen', 'computer-keyboard'] as const) {
      expect(soundsInApp(source, true)).toBe(true);
      expect(soundsInApp(source, false)).toBe(true);
    }
  });
});

describe('createNoteEcho', () => {
  it('sounds every source by default, velocity included', () => {
    const h = harness(true);
    h.route(on(60, 'midi', 100));
    h.route(off(60, 'midi'));
    h.route(on(62, 'onscreen'));
    h.route(off(62, 'onscreen'));
    h.route(on(64, 'computer-keyboard'));
    h.route(off(64, 'computer-keyboard'));
    expect(h.calls).toEqual([
      'on 60 100',
      'off 60',
      'on 62 80',
      'off 62',
      'on 64 80',
      'off 64',
    ]);
  });

  it('when off, a MIDI note makes no sound at all — on or off', () => {
    const h = harness(false);
    h.route(on(60, 'midi'));
    h.route(off(60, 'midi'));
    expect(h.calls).toEqual([]);
  });

  it('when off, on-screen and computer keys still sound', () => {
    const h = harness(false);
    h.route(on(62, 'onscreen'));
    h.route(off(62, 'onscreen'));
    h.route(on(64, 'computer-keyboard'));
    h.route(off(64, 'computer-keyboard'));
    expect(h.calls).toEqual(['on 62 80', 'off 62', 'on 64 80', 'off 64']);
  });

  it('reads the setting per note, so a change applies to the next key', () => {
    const h = harness(true);
    h.route(on(60, 'midi'));
    h.set(false);
    h.route(on(62, 'midi'));
    h.set(true);
    h.route(on(64, 'midi'));
    expect(h.calls).toEqual(['on 60 80', 'on 64 80']);
  });

  it('still releases a MIDI note that was sounding when the setting went off', () => {
    const h = harness(true);
    h.route(on(60, 'midi'));
    h.set(false);
    h.route(off(60, 'midi'));
    expect(h.calls).toEqual(['on 60 80', 'off 60']);
  });

  it('a silent MIDI key does not cut the same pitch held on screen', () => {
    const h = harness(false);
    h.route(on(60, 'onscreen'));
    h.route(on(60, 'midi'));
    h.route(off(60, 'midi'));
    h.route(off(60, 'onscreen'));
    expect(h.calls).toEqual(['on 60 80', 'off 60']);
  });

  it('releaseAll’s MIDI-stamped offs still release keys of other sources', () => {
    const h = harness(false);
    h.route(on(64, 'computer-keyboard'));
    h.route(off(64, 'midi'));
    expect(h.calls).toEqual(['on 64 80', 'off 64']);
  });
});

describe('createNoteEcho · control notes', () => {
  it('never sounds a control note, nor its release, whatever the setting', () => {
    const calls: string[] = [];
    const route = createNoteEcho(
      {
        noteOn: (midi) => calls.push(`on ${midi}`),
        noteOff: (midi) => calls.push(`off ${midi}`),
      },
      () => true,
      (midi, source) => source === 'midi' && midi === 24,
    );
    route(on(24, 'midi'));
    route(off(24, 'midi'));
    route(on(24, 'onscreen'));
    route(off(24, 'onscreen'));
    route(on(60, 'midi'));
    route(off(60, 'midi'));
    expect(calls).toEqual(['on 24', 'off 24', 'on 60', 'off 60']);
  });
});
