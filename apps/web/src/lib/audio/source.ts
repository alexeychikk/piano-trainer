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
  /**
   * Linear scale on the voice's peak, 0..1; omitted means 1 (untouched). The
   * engine's summed-gain headroom — see `headroomScale` — and the only reason
   * a source ever plays below its velocity.
   */
  gainScale?: number;
}

/** Stops the voices a `start()` call produced. */
export type StopVoice = (time?: number) => void;

export interface NoteSourceApi {
  start(note: NotePlan): StopVoice;
  /** Stop one note, or everything when no note is given. */
  stop(midi?: Midi): void;
  dispose(): void;
  /**
   * The peak gain one unscaled voice at this velocity reaches on this source.
   * The two paths answer differently (`smplr` squares the velocity, the synth
   * raises it to 1.5), which is how the engine budgets a chord's headroom
   * without ever learning which source it got.
   */
  voiceGain(velocity: number): number;
}
