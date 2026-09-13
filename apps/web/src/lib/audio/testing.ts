/**
 * A minimal Web Audio test double. jsdom has no `AudioContext`, and CI must
 * never depend on a sound card or on fetching soundfonts, so the engine tests
 * run against this instead (ticket: "mock the Web Audio API").
 *
 * It records what was created and scheduled; it makes no sound. Imported by
 * tests only.
 */

/** One point on a param's automation timeline. */
export interface ParamEvent {
  kind: 'set' | 'linear' | 'exponential' | 'target';
  time: number;
  value: number;
}

/**
 * A param with a *timeline*, not a single eager number. `value` reports what a
 * real `AudioParam` would: the automation at or before `currentTime` only —
 * scheduling something for the future must not change what the getter returns.
 * (The eager version of this double hid a real bug: a release anchored on
 * `gain.value` read at schedule time looked correct in tests.)
 */
export class FakeParam {
  readonly events: ParamEvent[] = [];

  constructor(
    private readonly initial: number,
    private readonly now: () => number,
  ) {}

  /** The value the automation has reached at `time` (step-wise, no ramps). */
  valueAt(time: number): number {
    let current = this.initial;
    let at = -Infinity;
    for (const event of this.events) {
      if (event.time <= time && event.time >= at) {
        current = event.value;
        at = event.time;
      }
    }
    return current;
  }

  get value(): number {
    return this.valueAt(this.now());
  }

  set value(value: number) {
    this.events.push({ kind: 'set', time: this.now(), value });
  }

  setValueAtTime(value: number, time: number): this {
    this.events.push({ kind: 'set', time, value });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.events.push({ kind: 'linear', time, value });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    this.events.push({ kind: 'exponential', time, value });
    return this;
  }

  setTargetAtTime(value: number, time: number): this {
    this.events.push({ kind: 'target', time, value });
    return this;
  }

  cancelScheduledValues(time: number): this {
    for (let i = this.events.length - 1; i >= 0; i -= 1) {
      if (this.events[i].time >= time) this.events.splice(i, 1);
    }
    return this;
  }
}

export interface FakeOscillator {
  type: string;
  frequency: FakeParam;
  startedAt: number | null;
  /** The last `stop()` time — a re-anchored release calls `stop()` again. */
  stoppedAt: number | null;
  stopCalls: number[];
  connect(): void;
  start(time?: number): void;
  stop(time?: number): void;
}

export interface FakeGain {
  gain: FakeParam;
  connect(): void;
  disconnect(): void;
}

export class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = 'suspended';
  destination = {} as AudioDestinationNode;
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  closed = false;

  constructor(public options?: AudioContextOptions) {}

  createGain(): FakeGain {
    const gain: FakeGain = {
      gain: new FakeParam(1, () => this.currentTime),
      connect: () => {},
      disconnect: () => {},
    };
    this.gains.push(gain);
    return gain;
  }

  createOscillator(): FakeOscillator {
    const osc: FakeOscillator = {
      type: 'sine',
      frequency: new FakeParam(440, () => this.currentTime),
      startedAt: null,
      stoppedAt: null,
      stopCalls: [],
      connect: () => {},
      start: (time = this.currentTime) => {
        osc.startedAt = time;
      },
      stop: (time = this.currentTime) => {
        osc.stoppedAt = time;
        osc.stopCalls.push(time);
      },
    };
    this.oscillators.push(osc);
    return osc;
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }

  async close(): Promise<void> {
    this.closed = true;
    this.state = 'closed';
  }

  /** Move the audio clock, the way `ctx.currentTime` advances by itself. */
  advance(seconds: number): void {
    this.currentTime += seconds;
  }
}

/**
 * Install `FakeAudioContext` as the global `AudioContext`. Returns the
 * instances it creates plus a restore function for `afterEach`.
 */
export function installFakeAudioContext(): {
  contexts: FakeAudioContext[];
  restore: () => void;
} {
  const contexts: FakeAudioContext[] = [];
  const global = globalThis as { AudioContext?: unknown };
  const previous = global.AudioContext;

  class TrackedContext extends FakeAudioContext {
    constructor(options?: AudioContextOptions) {
      super(options);
      contexts.push(this);
    }
  }

  global.AudioContext = TrackedContext;
  return {
    contexts,
    restore: () => {
      if (previous === undefined) delete global.AudioContext;
      else global.AudioContext = previous;
    },
  };
}
