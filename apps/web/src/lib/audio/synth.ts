/**
 * The built-in oscillator synth (ADR 0001 §2 "Fallback"): when the soundfont
 * cannot be fetched — offline, CDN down — exercises must still run, so this
 * plays instead. It is also what the metronome clicks with, because a click
 * needs no samples and must work the moment audio starts.
 *
 * Everything is scheduled against `ctx.currentTime`; nothing here uses timers.
 */

import { midiToFrequency, type Midi } from '$lib/theory';
import { velocityGain } from './gain';
import type { NotePlan, NoteSourceApi, StopVoice } from './source';

/** Envelope of a synth note, in seconds. Short attack, piano-ish decay. */
const ATTACK_S = 0.005;
const DECAY_S = 0.35;
const SUSTAIN = 0.55;
const RELEASE_S = 0.22;

/** Metronome click: a short pitched blip, accented on the downbeat. */
export const CLICK_ACCENT_HZ = 1600;
export const CLICK_BEAT_HZ = 1000;
const CLICK_DECAY_S = 0.05;
const CLICK_GAIN = 0.5;

/**
 * One voice: oscillator → gain → destination. Two detuned-ish partials would
 * sound nicer, but a single triangle keeps the fallback cheap and predictable.
 */
function startVoice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  { midi, velocity, time, duration }: NotePlan,
): StopVoice {
  const start = time ?? ctx.currentTime;
  const peak = velocityGain(velocity);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(midiToFrequency(midi), start);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + ATTACK_S);
  gain.gain.setTargetAtTime(peak * SUSTAIN, start + ATTACK_S, DECAY_S);

  osc.connect(gain);
  gain.connect(destination);
  osc.start(start);

  let stopped = false;
  const release: StopVoice = (at?: number) => {
    if (stopped) return;
    stopped = true;
    const from = Math.max(at ?? ctx.currentTime, start);
    gain.gain.cancelScheduledValues(from);
    // `setTargetAtTime` leaves no readable value to ramp from, so re-anchor.
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), from);
    gain.gain.exponentialRampToValueAtTime(0.0001, from + RELEASE_S);
    osc.stop(from + RELEASE_S);
  };

  if (duration !== undefined) release(start + duration);
  return release;
}

/** A `NoteSourceApi` backed by the oscillator synth. */
export function createSynthSource(
  ctx: BaseAudioContext,
  destination: AudioNode,
): NoteSourceApi {
  const voices = new Map<Midi, StopVoice[]>();

  return {
    start(note: NotePlan): StopVoice {
      const release = startVoice(ctx, destination, note);
      const held = voices.get(note.midi) ?? [];
      held.push(release);
      voices.set(note.midi, held);
      return release;
    },
    stop(midi?: Midi): void {
      if (midi === undefined) {
        for (const held of voices.values()) for (const stop of held) stop();
        voices.clear();
        return;
      }
      for (const stop of voices.get(midi) ?? []) stop();
      voices.delete(midi);
    },
    dispose(): void {
      this.stop();
    },
  };
}

/**
 * Schedule one metronome click at `time`. Sine + fast exponential decay: dry
 * and easy to hear under playing, without a sample to load.
 */
export function scheduleClick(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  accent: boolean,
): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(accent ? CLICK_ACCENT_HZ : CLICK_BEAT_HZ, time);

  const gain = ctx.createGain();
  const peak = accent ? CLICK_GAIN : CLICK_GAIN * 0.6;
  gain.gain.setValueAtTime(peak, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + CLICK_DECAY_S);

  osc.connect(gain);
  gain.connect(destination);
  osc.start(time);
  osc.stop(time + CLICK_DECAY_S);
}
