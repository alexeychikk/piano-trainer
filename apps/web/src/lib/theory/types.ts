/**
 * The music vocabulary of the app (ADR 0001 §4). The **integer MIDI note
 * number is the runtime identity of a pitch**; spelling exists for display
 * only, and enharmonics compare equal.
 *
 * Only the types slice 2 actually uses are defined here; the rest of the ADR's
 * vocabulary (voicings, progressions) arrives with the slice that needs it.
 */

/** 0..127, C4 = 60 (middle C). */
export type Midi = number;

/** 0..11, C = 0. */
export type PitchClass = number;

/** Signed interval size in semitones. */
export type Semitones = number;

/** A tonal spelling — display only, never compared or graded on. */
export type NoteName = string;

export type ChordQuality =
  | 'maj'
  | 'min'
  | 'dim'
  | 'aug'
  | 'sus4'
  | 'maj7'
  | 'dom7'
  | 'min7'
  | 'min7b5'
  | 'dim7'
  | 'minMaj7'
  | 'maj6'
  | 'min6'
  | 'dom9'
  | 'maj9'
  | 'min9'
  | 'dom7b9'
  | 'dom7sharp9'
  | 'dom7alt';

export interface ChordSymbol {
  rootPc: PitchClass;
  quality: ChordQuality;
  /** Slash chords / inversions. */
  bassPc?: PitchClass;
}
