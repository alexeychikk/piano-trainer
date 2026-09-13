/**
 * Chord detection (ADR 0001 §4): tonal's `Chord.detect`, normalised to our
 * types. Input is always `Midi[]` — never strings — and the result carries a
 * display name plus, when we recognise the quality, a `ChordSymbol`.
 *
 * Qualities outside the v1 vocabulary (ADR §4) keep their display name with
 * `symbol: null`, so Free Play can show `Em#5/C` without us pretending it maps
 * onto an exercise-grade chord.
 */

import { Chord } from 'tonal';
import { midiToName, nameToMidi, pcOf } from './notes';
import type { ChordQuality, ChordSymbol, Midi, PitchClass } from './types';

export interface DetectedChord {
  /** Tonal's symbol, e.g. `Cmaj7` or `Em#5/C`. Display only. */
  name: string;
  /** Present when the quality is part of the v1 vocabulary. */
  symbol: ChordSymbol | null;
}

/** tonal chord `type` → our `ChordQuality`. */
const QUALITY_BY_TYPE: Record<string, ChordQuality> = {
  major: 'maj',
  minor: 'min',
  diminished: 'dim',
  augmented: 'aug',
  'suspended fourth': 'sus4',
  'major seventh': 'maj7',
  'dominant seventh': 'dom7',
  'minor seventh': 'min7',
  'half-diminished': 'min7b5',
  'diminished seventh': 'dim7',
  'minor/major seventh': 'minMaj7',
  sixth: 'maj6',
  'sixth added ninth': 'maj6',
  'minor sixth': 'min6',
  'dominant ninth': 'dom9',
  'major ninth': 'maj9',
  'minor ninth': 'min9',
  'dominant flat ninth': 'dom7b9',
  'dominant sharp ninth': 'dom7sharp9',
  'altered dominant': 'dom7alt',
};

/**
 * Chords that the held notes could spell, best match first. Notes are deduped
 * but their octaves matter: the lowest note is taken as the bass, so
 * inversions are reported as slash chords.
 */
export function detectChords(notes: Midi[]): DetectedChord[] {
  if (notes.length < 2) return [];
  const sorted = [...new Set(notes)].sort((a, b) => a - b);
  const names = Chord.detect(sorted.map((midi) => midiToName(midi, 'sharp')));
  return names.map((name) => ({ name, symbol: toChordSymbol(name) }));
}

/** Parse a chord symbol string into our vocabulary, or `null`. */
export function toChordSymbol(name: string): ChordSymbol | null {
  const chord = Chord.get(name);
  if (chord.empty || !chord.tonic) return null;
  const quality = QUALITY_BY_TYPE[chord.type];
  if (!quality) return null;
  const rootPc = pitchClassOf(chord.tonic);
  if (rootPc === null) return null;
  const bassPc = chord.bass ? pitchClassOf(chord.bass) : null;
  const symbol: ChordSymbol = { rootPc, quality };
  if (bassPc !== null && bassPc !== rootPc) symbol.bassPc = bassPc;
  return symbol;
}

/** Pitch class of a bare note name (`Eb`, `F#`), or `null`. */
function pitchClassOf(name: string): PitchClass | null {
  // A bare pitch class has no octave; spell it into octave 4 and take the pc.
  const midi = nameToMidi(`${name}4`);
  return midi === null ? null : pcOf(midi);
}
