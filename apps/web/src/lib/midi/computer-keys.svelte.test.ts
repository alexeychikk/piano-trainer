import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComputerKeyboard } from './computer-keys.svelte';
import { MidiInput } from './input.svelte';
import { detectChords } from '$lib/theory';

function keydown(code: string, init: KeyboardEventInit = {}) {
  return new KeyboardEvent('keydown', { code, bubbles: true, ...init });
}

function keyup(code: string) {
  return new KeyboardEvent('keyup', { code, bubbles: true });
}

describe('ComputerKeyboard', () => {
  let input: MidiInput;
  let keyboard: ComputerKeyboard;
  let detach: () => void;

  beforeEach(() => {
    input = new MidiInput();
    keyboard = new ComputerKeyboard(input);
    detach = keyboard.attach(window);
    return () => detach();
  });

  it('holds a chord and spells it, then clears on release', () => {
    for (const code of ['KeyA', 'KeyD', 'KeyG']) {
      window.dispatchEvent(keydown(code));
    }
    expect(input.held).toEqual([60, 64, 67]);
    expect(detectChords(input.held)[0].name).toBe('CM');

    for (const code of ['KeyA', 'KeyD', 'KeyG']) {
      window.dispatchEvent(keyup(code));
    }
    expect(input.held).toEqual([]);
  });

  it('emits the same events as any other source', () => {
    const events: string[] = [];
    input.subscribe((event) => events.push(`${event.type}:${event.midi}`));
    window.dispatchEvent(keydown('KeyA'));
    window.dispatchEvent(keyup('KeyA'));
    expect(events).toEqual(['on:60', 'off:60']);
  });

  it('marks its events as coming from the computer keyboard', () => {
    const sources: string[] = [];
    input.subscribe((event) => sources.push(event.source));
    window.dispatchEvent(keydown('KeyW'));
    expect(sources).toEqual(['computer-keyboard']);
  });

  it('shifts the movable octave with Z and X, releasing what is held', () => {
    window.dispatchEvent(keydown('KeyA'));
    expect(input.held).toEqual([60]);
    window.dispatchEvent(keydown('KeyX'));
    expect(input.held).toEqual([]);
    window.dispatchEvent(keydown('KeyA'));
    expect(input.held).toEqual([72]);
    window.dispatchEvent(keyup('KeyA'));

    window.dispatchEvent(keydown('KeyZ'));
    window.dispatchEvent(keydown('KeyZ'));
    window.dispatchEvent(keydown('KeyA'));
    expect(input.held).toEqual([48]);
  });

  it('releases the note it started even when the octave moved meanwhile', () => {
    window.dispatchEvent(keydown('KeyA'));
    keyboard.baseOctave = 5;
    window.dispatchEvent(keyup('KeyA'));
    expect(input.held).toEqual([]);
  });

  it('ignores auto-repeat, modifiers and typing', () => {
    window.dispatchEvent(keydown('KeyA', { repeat: true }));
    window.dispatchEvent(keydown('KeyS', { metaKey: true }));
    expect(input.held).toEqual([]);

    const field = document.createElement('input');
    document.body.append(field);
    field.dispatchEvent(keydown('KeyA'));
    expect(input.held).toEqual([]);
    field.remove();
  });

  it('does not preventDefault on keys it does not own', () => {
    const event = keydown('Space');
    const preventDefault = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('releases everything when the window loses focus', () => {
    window.dispatchEvent(keydown('KeyA'));
    window.dispatchEvent(new Event('blur'));
    expect(input.held).toEqual([]);
  });

  it('stops listening once detached', () => {
    detach();
    window.dispatchEvent(keydown('KeyA'));
    expect(input.held).toEqual([]);
  });
});
