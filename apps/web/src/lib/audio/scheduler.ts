/**
 * The lookahead scheduler (ADR 0001 §2, the two-clock pattern): a coarse
 * `setInterval` tick schedules every pulse that falls inside a short window on
 * the **audio** clock, so nothing audible ever depends on timer jitter.
 *
 * Everything that has to be in time — the metronome now, exercise playback
 * later — goes through this one scheduler. The maths is pure and lives in
 * `pulsesInWindow`; the class is the thin timer wrapper around it.
 */

/** How far ahead of the audio clock pulses are scheduled. */
export const LOOKAHEAD_S = 0.1;
/** How often the wall-clock timer checks the window. */
export const TICK_MS = 25;

export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const DEFAULT_BPM = 90;

export const MIN_BEATS_PER_BAR = 1;
export const MAX_BEATS_PER_BAR = 12;
export const DEFAULT_BEATS_PER_BAR = 4;

/**
 * Safety valve: a single tick never emits more than this many pulses. Only a
 * suspended-then-resumed context can produce a large gap, and catching up by
 * firing a hundred clicks at once is worse than dropping them.
 */
const MAX_PULSES_PER_TICK = 32;

export function clampTempo(bpm: number): number {
  if (!Number.isFinite(bpm)) return DEFAULT_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export function clampBeatsPerBar(beats: number): number {
  if (!Number.isFinite(beats)) return DEFAULT_BEATS_PER_BAR;
  return Math.min(
    MAX_BEATS_PER_BAR,
    Math.max(MIN_BEATS_PER_BAR, Math.round(beats)),
  );
}

/** Seconds between beats at `bpm`. */
export function secondsPerBeat(bpm: number): number {
  return 60 / clampTempo(bpm);
}

export interface Pulse {
  /** Audio-clock time (seconds) the pulse must sound at. */
  time: number;
  /** Running count since the scheduler started. */
  index: number;
  /** 0-based position inside the bar. */
  beatInBar: number;
  /** True on the downbeat — the accented click. */
  accent: boolean;
}

export interface WindowInput {
  /** Time of the next unscheduled pulse. */
  nextTime: number;
  /** Index of that pulse. */
  nextIndex: number;
  /** `ctx.currentTime` right now. */
  now: number;
  interval: number;
  beatsPerBar: number;
  lookahead?: number;
}

export interface WindowResult {
  pulses: Pulse[];
  nextTime: number;
  nextIndex: number;
}

/**
 * Every pulse due inside `[now, now + lookahead)`, plus the state to carry
 * into the next tick. Pure — the metronome's timing is tested without audio.
 */
export function pulsesInWindow({
  nextTime,
  nextIndex,
  now,
  interval,
  beatsPerBar,
  lookahead = LOOKAHEAD_S,
}: WindowInput): WindowResult {
  const pulses: Pulse[] = [];
  const bar = clampBeatsPerBar(beatsPerBar);
  let time = nextTime;
  let index = nextIndex;

  if (interval <= 0) return { pulses, nextTime: time, nextIndex: index };

  const horizon = now + lookahead;
  while (time < horizon && pulses.length < MAX_PULSES_PER_TICK) {
    const beatInBar = index % bar;
    // A pulse already in the past (tab was backgrounded) is dropped, not
    // fired late: audio that arrives after its moment is worse than silence.
    if (time >= now) {
      pulses.push({ time, index, beatInBar, accent: beatInBar === 0 });
    }
    time += interval;
    index += 1;
  }

  return { pulses, nextTime: time, nextIndex: index };
}

/** The timer half of the two clocks — injectable so tests stay synchronous. */
export interface TimerApi {
  setInterval(handler: () => void, ms: number): number;
  clearInterval(handle: number): void;
}

const defaultTimer: TimerApi = {
  setInterval: (handler, ms) =>
    globalThis.setInterval(handler, ms) as unknown as number,
  clearInterval: (handle) => globalThis.clearInterval(handle),
};

export interface PulseSchedulerOptions {
  /** Reads the audio clock (`ctx.currentTime`). */
  now: () => number;
  onPulse: (pulse: Pulse) => void;
  timer?: TimerApi;
  tickMs?: number;
  lookahead?: number;
}

export class PulseScheduler {
  #options: PulseSchedulerOptions;
  #handle: number | null = null;
  #nextTime = 0;
  #nextIndex = 0;
  #interval = secondsPerBeat(DEFAULT_BPM);
  #beatsPerBar = DEFAULT_BEATS_PER_BAR;

  constructor(options: PulseSchedulerOptions) {
    this.#options = options;
  }

  get running(): boolean {
    return this.#handle !== null;
  }

  /** Beat length in seconds. Changing it while running takes effect next tick. */
  set interval(seconds: number) {
    this.#interval = seconds;
  }

  set beatsPerBar(beats: number) {
    this.#beatsPerBar = clampBeatsPerBar(beats);
  }

  /** Start pulsing; the first pulse lands at `startTime` (default: now). */
  start(startTime?: number): void {
    if (this.running) return;
    this.#nextTime = startTime ?? this.#options.now();
    this.#nextIndex = 0;
    const timer = this.#options.timer ?? defaultTimer;
    this.#handle = timer.setInterval(
      () => this.tick(),
      this.#options.tickMs ?? TICK_MS,
    );
    // Schedule the head of the first window immediately: waiting a whole tick
    // would delay the downbeat by up to 25 ms.
    this.tick();
  }

  stop(): void {
    if (this.#handle === null) return;
    const timer = this.#options.timer ?? defaultTimer;
    timer.clearInterval(this.#handle);
    this.#handle = null;
  }

  /** One pass of the window. Public so tests can drive it by hand. */
  tick(): void {
    const { pulses, nextTime, nextIndex } = pulsesInWindow({
      nextTime: this.#nextTime,
      nextIndex: this.#nextIndex,
      now: this.#options.now(),
      interval: this.#interval,
      beatsPerBar: this.#beatsPerBar,
      lookahead: this.#options.lookahead,
    });
    this.#nextTime = nextTime;
    this.#nextIndex = nextIndex;
    for (const pulse of pulses) this.#options.onPulse(pulse);
  }
}
