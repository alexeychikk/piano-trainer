/**
 * The computer keyboard as a third note source (ADR §3, UX spec §4.6). Always
 * live, so the app is fully usable on a laptop with no piano attached.
 *
 * It never swallows shell shortcuts or browser defaults: modified presses,
 * auto-repeat and presses inside text fields are left alone (`keymap.ts`).
 */

import {
  DEFAULT_BASE_OCTAVE,
  OCTAVE_DOWN_KEY,
  OCTAVE_UP_KEY,
  isNoteKeyPress,
  isTypingTarget,
  midiForComputerKey,
  shiftOctave,
} from './keymap';
import { midiInput, type MidiInput } from './input.svelte';
import type { Midi } from '$lib/theory';

export class ComputerKeyboard {
  /** The octave `A` starts on; `Z` / `X` move it. */
  baseOctave = $state(DEFAULT_BASE_OCTAVE);

  #input: MidiInput;
  /** Which note each held key started — the octave may shift while held. */
  #down = new Map<string, Midi>();

  constructor(input: MidiInput) {
    this.#input = input;
  }

  /** The lowest note of the mapped octave, for the on-screen hint. */
  get lowestMidi(): Midi {
    return midiForComputerKey('KeyA', this.baseOctave) ?? 60;
  }

  handleKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target)) return;
    if (!isNoteKeyPress(event)) return;
    if (event.code === OCTAVE_DOWN_KEY || event.code === OCTAVE_UP_KEY) {
      event.preventDefault();
      this.releaseAll();
      this.baseOctave = shiftOctave(
        this.baseOctave,
        event.code === OCTAVE_UP_KEY ? 1 : -1,
      );
      return;
    }
    const midi = midiForComputerKey(event.code, this.baseOctave);
    if (midi === null || this.#down.has(event.code)) return;
    event.preventDefault();
    this.#down.set(event.code, midi);
    this.#input.noteOn(midi, 'computer-keyboard');
  };

  handleKeyUp = (event: KeyboardEvent): void => {
    const midi = this.#down.get(event.code);
    if (midi === undefined) return;
    this.#down.delete(event.code);
    this.#input.noteOff(midi, 'computer-keyboard');
  };

  /** Release every key we are holding (octave shift, blur, unmount). */
  releaseAll = (): void => {
    for (const [code, midi] of this.#down) {
      this.#down.delete(code);
      this.#input.noteOff(midi, 'computer-keyboard');
    }
  };

  /** Listen on the window; returns the detach function. */
  attach(target: Pick<Window, 'addEventListener' | 'removeEventListener'>) {
    target.addEventListener('keydown', this.handleKeyDown);
    target.addEventListener('keyup', this.handleKeyUp);
    target.addEventListener('blur', this.releaseAll);
    return () => {
      target.removeEventListener('keydown', this.handleKeyDown);
      target.removeEventListener('keyup', this.handleKeyUp);
      target.removeEventListener('blur', this.releaseAll);
      this.releaseAll();
    };
  }
}

/** The app-wide computer-keyboard source, feeding the shared MIDI input. */
export const computerKeyboard = new ComputerKeyboard(midiInput);
