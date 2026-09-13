/**
 * A minimal Web Audio test double. jsdom has no `AudioContext`, and CI must
 * never depend on a sound card or on fetching soundfonts, so the engine tests
 * run against this instead (ticket: "mock the Web Audio API").
 *
 * It records what was created and scheduled; it makes no sound. Imported by
 * tests only.
 */

interface FakeParam {
  value: number;
  setValueAtTime(value: number, time: number): FakeParam;
  linearRampToValueAtTime(value: number, time: number): FakeParam;
  exponentialRampToValueAtTime(value: number, time: number): FakeParam;
  setTargetAtTime(value: number, time: number, constant: number): FakeParam;
  cancelScheduledValues(time: number): FakeParam;
}

function createParam(initial = 1): FakeParam {
  const param: FakeParam = {
    value: initial,
    setValueAtTime(value) {
      param.value = value;
      return param;
    },
    linearRampToValueAtTime(value) {
      param.value = value;
      return param;
    },
    exponentialRampToValueAtTime(value) {
      param.value = value;
      return param;
    },
    setTargetAtTime(value) {
      param.value = value;
      return param;
    },
    cancelScheduledValues() {
      return param;
    },
  };
  return param;
}

export interface FakeOscillator {
  type: string;
  frequency: FakeParam;
  startedAt: number | null;
  stoppedAt: number | null;
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
      gain: createParam(1),
      connect: () => {},
      disconnect: () => {},
    };
    this.gains.push(gain);
    return gain;
  }

  createOscillator(): FakeOscillator {
    const osc: FakeOscillator = {
      type: 'sine',
      frequency: createParam(440),
      startedAt: null,
      stoppedAt: null,
      connect: () => {},
      start: (time = this.currentTime) => {
        osc.startedAt = time;
      },
      stop: (time = this.currentTime) => {
        osc.stoppedAt = time;
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
