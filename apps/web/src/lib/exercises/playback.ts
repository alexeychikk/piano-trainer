/**
 * Turning a `PlaybackPlan` (ADR §5) into sound, and the count-in maths in
 * front of it (slice 4; the count-in was deferred from slice 3 because it only
 * means anything inside the runner).
 *
 * The maths is pure and tested; the one impure part is `createAudioPlayback`,
 * which schedules the result on the audio clock through the engine — never
 * with `setTimeout` (ADR §2).
 */

import { audio, type AudioEngine } from '$lib/audio/engine.svelte';
import {
  clampBeatsPerBar,
  clampTempo,
  secondsPerBeat,
} from '$lib/audio/scheduler';
import type { CountIn } from '$lib/storage/settings.svelte';
import type { PlaybackPlan } from './types';

/**
 * Scheduling headroom before the first sound. The engine's synth voices are
 * created at schedule time, so a click or note placed exactly at `currentTime`
 * can be clipped by a busy frame.
 */
export const PLAYBACK_LEAD_S = 0.08;

/** How long the plan lasts, from its start to the end of its last note. */
export function planDurationMs(plan: PlaybackPlan): number {
  let end = 0;
  for (const event of plan.events) {
    end = Math.max(end, event.atMs + event.durationMs);
  }
  return end;
}

export interface CountInClick {
  /** Offset from the start of the count-in, in milliseconds. */
  atMs: number;
  /** Beat 1 of the bar is accented, like the metronome's downbeat. */
  accent: boolean;
}

/**
 * One bar of clicks in front of the question, at the metronome's tempo and
 * metre. `'off'` counts nothing in, so the plan starts immediately.
 */
export function countInClicks(
  countIn: CountIn,
  bpm: number,
  beatsPerBar: number,
): CountInClick[] {
  if (countIn === 'off') return [];
  const beats = clampBeatsPerBar(beatsPerBar);
  const beatMs = secondsPerBeat(clampTempo(bpm)) * 1000;
  return Array.from({ length: beats }, (_, index) => ({
    atMs: index * beatMs,
    accent: index === 0,
  }));
}

/** How long the count-in delays the question. `0` when it is off. */
export function countInLeadMs(
  countIn: CountIn,
  bpm: number,
  beatsPerBar: number,
): number {
  const clicks = countInClicks(countIn, bpm, beatsPerBar);
  if (clicks.length === 0) return 0;
  const beatMs = secondsPerBeat(clampTempo(bpm)) * 1000;
  return clicks[clicks.length - 1].atMs + beatMs;
}

export interface PlayOptions {
  countIn: CountIn;
  bpm: number;
  beatsPerBar: number;
}

/**
 * What the runner needs from the outside world to make a question audible.
 * Injectable so the state machine is testable without Web Audio.
 */
export interface PlaybackApi {
  /**
   * Start the plan (with its count-in) and return how long it will take, in
   * milliseconds — the runner waits that long before accepting an answer.
   */
  play(plan: PlaybackPlan, options: PlayOptions): number;
  /** Cut everything currently sounding. */
  stop(): void;
  /** The context may not exist yet: playback starts from a user gesture. */
  ensureStarted(): Promise<void>;
}

/** The real thing: schedule the plan on the engine's audio clock. */
export function createAudioPlayback(engine: AudioEngine = audio): PlaybackApi {
  return {
    play(plan, options) {
      const countIn = plan.countIn === true ? '1-bar' : options.countIn;
      const startS = engine.now() + PLAYBACK_LEAD_S;
      for (const click of countInClicks(
        countIn,
        options.bpm,
        options.beatsPerBar,
      )) {
        engine.click(startS + click.atMs / 1000, click.accent);
      }
      const leadMs = countInLeadMs(countIn, options.bpm, options.beatsPerBar);
      const planStartS = startS + leadMs / 1000;
      for (const event of plan.events) {
        engine.playChord(event.notes, {
          time: planStartS + event.atMs / 1000,
          duration: event.durationMs / 1000,
          velocity: event.velocity,
        });
      }
      return PLAYBACK_LEAD_S * 1000 + leadMs + planDurationMs(plan);
    },
    stop() {
      engine.stopAll();
    },
    ensureStarted() {
      return engine.ensureStarted();
    },
  };
}
