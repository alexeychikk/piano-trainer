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
export const ATTACK_S = 0.005;
export const DECAY_S = 0.35;
export const SUSTAIN = 0.55;
export const RELEASE_S = 0.22;

/**
 * `exponentialRampToValueAtTime` cannot reach 0, so silence is this instead.
 */
const SILENCE = 0.0001;

/**
 * The gain the attack/decay envelope has reached at `time` — computed, not
 * read back from the `AudioParam`.
 *
 * `AudioParam.value` is the value at *`currentTime`*, so reading it to anchor a
 * release that happens in the future (a note scheduled with a `duration`) gives
 * the value before any of that note's automation has run — for a fresh gain
 * node, `1`, i.e. full blast at the end of a quiet note. The envelope is known
 * in closed form, so use it.
 */
export function envelopeGainAt(
  time: number,
  start: number,
  peak: number,
): number {
  if (time <= start) return 0;
  const attackEnd = start + ATTACK_S;
  if (time < attackEnd) return (peak * (time - start)) / ATTACK_S;
  // `setTargetAtTime`: an exponential approach to `peak * SUSTAIN` with time
  // constant `DECAY_S`, starting from `peak` at the end of the attack.
  const sustain = peak * SUSTAIN;
  return sustain + (peak - sustain) * Math.exp(-(time - attackEnd) / DECAY_S);
}

/** Metronome click: a short pitched blip, accented on the downbeat. */
export const CLICK_ACCENT_HZ = 1600;
export const CLICK_BEAT_HZ = 1000;
const CLICK_DECAY_S = 0.05;
const CLICK_GAIN = 0.5;

/** A sounding voice: how to release it, and when it goes quiet by itself. */
interface Voice {
  release: StopVoice;
  /** Audio-clock time the voice is silent at, or `null` while it is held. */
  endsAt: () => number | null;
}

/**
 * One voice: oscillator → gain → destination. Two detuned-ish partials would
 * sound nicer, but a single triangle keeps the fallback cheap and predictable.
 */
function startVoice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  { midi, velocity, time, duration }: NotePlan,
): Voice {
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

  /** When the release ramp was anchored; `null` while the note is held. */
  let releasedAt: number | null = null;
  const release: StopVoice = (at?: number) => {
    const from = Math.max(at ?? ctx.currentTime, start);
    // A note scheduled with a `duration` is released at schedule time, but it
    // may still be sounding: `noteOff`/`stopAll` must be able to cut it short,
    // so only a *later* release is ignored — an earlier one re-anchors.
    if (releasedAt !== null && releasedAt <= from) return;
    releasedAt = from;
    gain.gain.cancelScheduledValues(from);
    // The envelope is computed, never read back from the param — see
    // `envelopeGainAt`.
    const level = Math.max(envelopeGainAt(from, start, peak), SILENCE);
    gain.gain.setValueAtTime(level, from);
    gain.gain.exponentialRampToValueAtTime(SILENCE, from + RELEASE_S);
    osc.stop(from + RELEASE_S);
  };

  if (duration !== undefined) release(start + duration);
  return {
    release,
    endsAt: () => (releasedAt === null ? null : releasedAt + RELEASE_S),
  };
}

/** The synth source, plus a count of live voices for tests and diagnostics. */
export type SynthSource = NoteSourceApi & { voiceCount(): number };

/** A `NoteSourceApi` backed by the oscillator synth. */
export function createSynthSource(
  ctx: BaseAudioContext,
  destination: AudioNode,
): SynthSource {
  const voices = new Map<Midi, Voice[]>();

  /**
   * Drop voices that have finished sounding. There is no timer here (ADR §2:
   * the audio clock only), so the sweep is lazy — without it every
   * `playNote`/`playSequence` note would leave a dead closure behind for the
   * life of the source.
   */
  function prune(): void {
    const now = ctx.currentTime;
    for (const [midi, held] of voices) {
      const live = held.filter((voice) => {
        const end = voice.endsAt();
        return end === null || end > now;
      });
      if (live.length === 0) voices.delete(midi);
      else if (live.length !== held.length) voices.set(midi, live);
    }
  }

  return {
    start(note: NotePlan): StopVoice {
      prune();
      const voice = startVoice(ctx, destination, note);
      const held = voices.get(note.midi) ?? [];
      held.push(voice);
      voices.set(note.midi, held);
      return voice.release;
    },
    stop(midi?: Midi): void {
      if (midi === undefined) {
        for (const held of voices.values())
          for (const voice of held) voice.release();
        voices.clear();
        return;
      }
      for (const voice of voices.get(midi) ?? []) voice.release();
      voices.delete(midi);
    },
    dispose(): void {
      this.stop();
    },
    voiceCount(): number {
      prune();
      let count = 0;
      for (const held of voices.values()) count += held.length;
      return count;
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
