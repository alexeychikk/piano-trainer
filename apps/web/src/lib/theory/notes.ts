/**
 * Note helpers (ADR 0001 §4). Pure TypeScript — no DOM, no Svelte, no
 * randomness. `tonal` is only ever reached through this module.
 */

import { Note } from 'tonal';
import type { Midi, NoteName, PitchClass } from './types';

/** Middle C. */
export const MIDDLE_C: Midi = 60;

export const MIDI_MIN: Midi = 0;
export const MIDI_MAX: Midi = 127;

/** Semitone offsets inside an octave that are black keys on a piano. */
const BLACK_PITCH_CLASSES = new Set<PitchClass>([1, 3, 6, 8, 10]);

/** Spoken pitch-class names, for accessible names (never for grading). */
const SPOKEN = [
  'C',
  'C sharp',
  'D',
  'D sharp',
  'E',
  'F',
  'F sharp',
  'G',
  'G sharp',
  'A',
  'A sharp',
  'B',
];

/** Pitch class of a MIDI note, 0..11 (C = 0). */
export function pcOf(midi: Midi): PitchClass {
  return ((Math.round(midi) % 12) + 12) % 12;
}

/** Scientific octave number: C4 = 60 is octave 4. */
export function octaveOf(midi: Midi): number {
  return Math.floor(Math.round(midi) / 12) - 1;
}

/** Is this note a black key on a piano? */
export function isBlackKey(midi: Midi): boolean {
  return BLACK_PITCH_CLASSES.has(pcOf(midi));
}

/** Display spelling, e.g. `Eb4` or `D#4`. Display only. */
export function midiToName(
  midi: Midi,
  style: 'sharp' | 'flat' = 'sharp',
): NoteName {
  const value = Math.round(midi);
  return style === 'sharp' ? Note.fromMidiSharps(value) : Note.fromMidi(value);
}

/** Parse a spelling back to MIDI. `null` when it is not a note name. */
export function nameToMidi(name: NoteName): Midi | null {
  return Note.midi(name);
}

/** Accessible name for a key, e.g. `C sharp 4`. */
export function spokenNoteName(midi: Midi): string {
  return `${SPOKEN[pcOf(midi)]} ${octaveOf(midi)}`;
}

/** Every MIDI note from `low` to `high`, inclusive. */
export function notesInRange(low: Midi, high: Midi): Midi[] {
  const notes: Midi[] = [];
  for (let midi = low; midi <= high; midi += 1) notes.push(midi);
  return notes;
}

/** Clamp to the playable MIDI range. */
export function clampMidi(midi: Midi): Midi {
  return Math.min(MIDI_MAX, Math.max(MIDI_MIN, Math.round(midi)));
}

/** Concert pitch: A4 = 440 Hz, the reference the synth voices tune to. */
export const A4_HZ = 440;

/**
 * Equal-tempered frequency of a MIDI note. Pure maths, so the fallback synth
 * (and any future tuning work) shares one definition.
 */
export function midiToFrequency(midi: Midi): number {
  return A4_HZ * 2 ** ((midi - 69) / 12);
}
