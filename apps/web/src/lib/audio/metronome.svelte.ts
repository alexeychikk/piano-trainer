/**
 * The metronome: a `PulseScheduler` driving `audio.click()`, plus the beat the
 * UI shows. It is a module-level singleton on purpose — it keeps ticking
 * across route changes, because a practising pianist does not expect the click
 * to stop when they open Settings.
 *
 * ADR §2's split is kept: clicks are scheduled on the audio clock, while the
 * visible beat follows in `requestAnimationFrame` by comparing
 * `ctx.currentTime` against the scheduled time — the light may lag, the click
 * never does.
 */

import { settings } from '$lib/storage/settings.svelte';
import { AudioEngine, audio } from './engine.svelte';
import {
  PulseScheduler,
  clampBeatsPerBar,
  clampTempo,
  secondsPerBeat,
  type Pulse,
  type TimerApi,
} from './scheduler';

/** The first click is scheduled a beat ahead, so it is never clipped. */
const START_DELAY_S = 0.12;

type FrameApi = {
  requestAnimationFrame(callback: () => void): number;
  cancelAnimationFrame(handle: number): void;
};

export class Metronome {
  running = $state(false);
  /** 0-based beat inside the bar, `-1` while stopped. Drives the indicator. */
  beat = $state(-1);

  #engine: AudioEngine;
  #scheduler: PulseScheduler;
  #frames: FrameApi | null;
  #pending: Pulse[] = [];
  #frame: number | null = null;

  constructor(
    engine: AudioEngine = audio,
    options: { timer?: TimerApi; frames?: FrameApi | null } = {},
  ) {
    this.#engine = engine;
    this.#frames =
      options.frames === undefined
        ? typeof requestAnimationFrame === 'function'
          ? {
              requestAnimationFrame: (callback) =>
                requestAnimationFrame(callback),
              cancelAnimationFrame: (handle) => cancelAnimationFrame(handle),
            }
          : null
        : options.frames;
    this.#scheduler = new PulseScheduler({
      now: () => this.#engine.now(),
      onPulse: (pulse) => this.#onPulse(pulse),
      timer: options.timer,
    });
  }

  get bpm(): number {
    return clampTempo(settings.value.tempoBpm);
  }

  get beatsPerBar(): number {
    return clampBeatsPerBar(settings.value.beatsPerBar);
  }

  /** Start the click. Starts audio too — call it from a user gesture. */
  async start(): Promise<void> {
    if (this.running) return;
    // `ensureStarted()` only settles once the soundfont load has, but the
    // layout's first-gesture handler has normally created the context already,
    // so this returns at once — the click itself needs no samples.
    await this.#engine.ensureStarted();
    if (!this.#engine.started) return;
    this.#scheduler.interval = secondsPerBeat(this.bpm);
    this.#scheduler.beatsPerBar = this.beatsPerBar;
    this.running = true;
    this.#scheduler.start(this.#engine.now() + START_DELAY_S);
    this.#watch();
  }

  stop(): void {
    if (!this.running) return;
    this.#scheduler.stop();
    this.running = false;
    this.beat = -1;
    this.#pending = [];
    if (this.#frame !== null && this.#frames) {
      this.#frames.cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
  }

  async toggle(): Promise<void> {
    if (this.running) this.stop();
    else await this.start();
  }

  /** Tempo in BPM — clamped, persisted and applied to the running click. */
  setTempo(bpm: number): void {
    const tempo = clampTempo(bpm);
    settings.patch({ tempoBpm: tempo });
    this.#scheduler.interval = secondsPerBeat(tempo);
  }

  setBeatsPerBar(beats: number): void {
    const bar = clampBeatsPerBar(beats);
    settings.patch({ beatsPerBar: bar });
    this.#scheduler.beatsPerBar = bar;
  }

  #onPulse(pulse: Pulse): void {
    this.#engine.click(pulse.time, pulse.accent);
    this.#pending.push(pulse);
    // The rAF loop is the normal drain, but it does not run without frames
    // (SSR, tests) or in a backgrounded tab — draining here as well keeps the
    // queue to the scheduler's lookahead instead of one entry per beat forever.
    this.#drain();
  }

  /** Advance the indicator to the last click the audio clock has reached. */
  #drain(): void {
    const now = this.#engine.now();
    while (this.#pending.length > 0 && this.#pending[0].time <= now) {
      this.beat = this.#pending.shift()!.beatInBar;
    }
  }

  /** Move the indicator when the audio clock reaches each scheduled click. */
  #watch(): void {
    const frames = this.#frames;
    if (!frames || this.#frame !== null) return;
    const step = () => {
      this.#frame = null;
      if (!this.running) return;
      this.#drain();
      this.#frame = frames.requestAnimationFrame(step);
    };
    this.#frame = frames.requestAnimationFrame(step);
  }

  /** Clicks scheduled but not yet shown — bounded by the lookahead (tests). */
  get pendingBeats(): number {
    return this.#pending.length;
  }

  /** Advance the visible beat without waiting for a frame (tests). */
  syncIndicator(): void {
    this.#drain();
  }
}

/** The app-wide metronome; it survives navigation by living here. */
export const metronome = new Metronome();
