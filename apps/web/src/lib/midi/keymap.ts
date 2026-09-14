/**
 * The computer-keyboard input source (UX spec §4.6): `A W S E D F T G Y H U J K`
 * is C…C of a movable octave, `Z` / `X` shift that octave down / up. It is the
 * third note source (ADR §3) and is always live, so the app works on a laptop.
 *
 * Pure: `code`-based (layout independent), no DOM.
 */

import type { Midi } from '$lib/theory';

/** `KeyboardEvent.code` → semitones above the C of the movable octave. */
export const COMPUTER_KEY_SEMITONES: Readonly<Record<string, number>> = {
  KeyA: 0, // C
  KeyW: 1, // C#
  KeyS: 2, // D
  KeyE: 3, // D#
  KeyD: 4, // E
  KeyF: 5, // F
  KeyT: 6, // F#
  KeyG: 7, // G
  KeyY: 8, // G#
  KeyH: 9, // A
  KeyU: 10, // A#
  KeyJ: 11, // B
  KeyK: 12, // C
};

export const OCTAVE_DOWN_KEY = 'KeyZ';
export const OCTAVE_UP_KEY = 'KeyX';

/** Shown in the shortcut bar and the "no MIDI" strip, verbatim (copy deck). */
export const COMPUTER_KEY_HINT = 'A W S E D F T G Y H U J K';

/**
 * The octave shift, advertised wherever the mapping is (UX §4.6: the bar shows
 * the mapping *including* `Z` / `X`). The keycaps are derived from the codes
 * the handler listens to, so the manual cannot drift from the behaviour, and
 * the label is a label — no copy-deck sentence says this.
 */
export const OCTAVE_DOWN_HINT = OCTAVE_DOWN_KEY.replace('Key', '');
export const OCTAVE_UP_HINT = OCTAVE_UP_KEY.replace('Key', '');
export const OCTAVE_SHIFT_HINT_LABEL = 'octave';

/** `A` starts on C4 by default — middle C is where a beginner orients. */
export const DEFAULT_BASE_OCTAVE = 4;
export const MIN_BASE_OCTAVE = 0;
export const MAX_BASE_OCTAVE = 7;

/** The note a mapped key plays, or `null` when the key is not mapped. */
export function midiForComputerKey(
  code: string,
  baseOctave: number = DEFAULT_BASE_OCTAVE,
): Midi | null {
  const semitones = COMPUTER_KEY_SEMITONES[code];
  if (semitones === undefined) return null;
  return (clampOctave(baseOctave) + 1) * 12 + semitones;
}

/** Move the movable octave, clamped to the playable range. */
export function shiftOctave(baseOctave: number, delta: number): number {
  return clampOctave(baseOctave + delta);
}

export function clampOctave(octave: number): number {
  return Math.min(MAX_BASE_OCTAVE, Math.max(MIN_BASE_OCTAVE, octave));
}

/**
 * Should this key press be handled as note input? Shell shortcuts and browser
 * defaults must keep working: anything with a modifier, an auto-repeat, or a
 * press inside a text field is left alone.
 */
export function isNoteKeyPress(event: {
  code: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): boolean {
  if (event.repeat) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return (
    event.code in COMPUTER_KEY_SEMITONES ||
    event.code === OCTAVE_DOWN_KEY ||
    event.code === OCTAVE_UP_KEY
  );
}

/** Is the event aimed at something the user is typing into? */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
