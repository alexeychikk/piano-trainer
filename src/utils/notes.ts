import { Note } from '@tonaljs/tonal';
import { random } from 'lodash-es';

const NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SHARP_NOTES = ['C#', 'D#', 'F#', 'G#', 'A#'];
const FLAT_NOTES = ['Db', 'Eb', 'Gb', 'Ab', 'Bb'];
const FLAT_OCTAVE = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];
const SHARP_OCTAVE = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

export function getExactRandomNote(from: string, to: string): string {
  const midiFrom = Note.midi(from)!;
  const midiTo = Note.midi(to)!;
  const midi = random(midiFrom, midiTo);
  return Note.fromMidi(midi);
}

export function getRandomNote(): string {
  const notes = Math.random() > 0.5 ? SHARP_OCTAVE : FLAT_OCTAVE;
  return notes[random(0, notes.length - 1)];
}

export function getRandomWhiteNote(): string {
  return NOTES[random(0, NOTES.length - 1)];
}

export function getRandomBlackNote(): string {
  const notes = Math.random() > 0.5 ? SHARP_NOTES : FLAT_NOTES;
  return notes[random(0, notes.length - 1)];
}

export function getRandomSharpNote(): string {
  return SHARP_NOTES[random(0, SHARP_NOTES.length - 1)];
}

export function getRandomFlatNote(): string {
  return FLAT_NOTES[random(0, FLAT_NOTES.length - 1)];
}
