/**
 * What the engine plays through. One interface, two implementations: the
 * sampled `smplr` instrument and the built-in oscillator synth (ADR §2's
 * fallback). Callers never learn which one they got.
 */

import type { Midi } from '$lib/theory';

export interface NotePlan {
  midi: Midi;
  /** MIDI velocity 1..127. */
  velocity: number;
  /** Audio-clock start time; omitted means "now". */
  time?: number;
  /** Seconds; omitted means "until `stop` is called" (a held note). */
  duration?: number;
}

/** Stops the voices a `start()` call produced. */
export type StopVoice = (time?: number) => void;

export interface NoteSourceApi {
  start(note: NotePlan): StopVoice;
  /** Stop one note, or everything when no note is given. */
  stop(midi?: Midi): void;
  dispose(): void;
}
