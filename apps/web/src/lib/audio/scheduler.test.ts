import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BPM,
  LOOKAHEAD_S,
  MAX_BPM,
  MIN_BPM,
  PulseScheduler,
  clampBeatsPerBar,
  clampTempo,
  pulsesInWindow,
  secondsPerBeat,
  type Pulse,
  type TimerApi,
} from './scheduler';

describe('tempo maths', () => {
  it('converts BPM to a beat length', () => {
    expect(secondsPerBeat(60)).toBe(1);
    expect(secondsPerBeat(120)).toBe(0.5);
    expect(secondsPerBeat(90)).toBeCloseTo(0.666667, 6);
  });

  it('clamps tempo to the usable range and rounds', () => {
    expect(clampTempo(10)).toBe(MIN_BPM);
    expect(clampTempo(1000)).toBe(MAX_BPM);
    expect(clampTempo(90.4)).toBe(90);
    expect(clampTempo(Number.NaN)).toBe(DEFAULT_BPM);
  });

  it('clamps beats per bar', () => {
    expect(clampBeatsPerBar(0)).toBe(1);
    expect(clampBeatsPerBar(99)).toBe(12);
    expect(clampBeatsPerBar(3.2)).toBe(3);
  });
});

describe('pulsesInWindow', () => {
  const base = {
    nextTime: 1,
    nextIndex: 0,
    interval: 0.5,
    beatsPerBar: 4,
    lookahead: LOOKAHEAD_S,
  };

  it('schedules only what falls inside the lookahead window', () => {
    const first = pulsesInWindow({ ...base, now: 0.95 });
    expect(first.pulses.map((pulse) => pulse.time)).toEqual([1]);
    expect(first.nextTime).toBeCloseTo(1.5, 6);
    expect(first.nextIndex).toBe(1);

    // Nothing is due yet a moment later.
    const idle = pulsesInWindow({
      ...base,
      nextTime: first.nextTime,
      nextIndex: first.nextIndex,
      now: 1.2,
    });
    expect(idle.pulses).toEqual([]);
    expect(idle.nextTime).toBeCloseTo(1.5, 6);
  });

  it('accents the downbeat and counts inside the bar', () => {
    const { pulses } = pulsesInWindow({
      ...base,
      interval: 0.02,
      now: 1,
      lookahead: 0.1,
    });
    expect(pulses.map((pulse) => pulse.beatInBar)).toEqual([0, 1, 2, 3, 0]);
    expect(pulses.map((pulse) => pulse.accent)).toEqual([
      true,
      false,
      false,
      false,
      true,
    ]);
  });

  it('does not drift: pulse n is always n intervals from the start', () => {
    let state = { nextTime: 0, nextIndex: 0 };
    const times: number[] = [];
    // 25 ms ticks with jitter, 120 bpm — a minute of clicking.
    for (let tick = 0; tick < 60 * 40; tick += 1) {
      const now = tick * 0.025 + (tick % 7) * 0.003;
      const result = pulsesInWindow({
        ...base,
        ...state,
        interval: 0.5,
        now,
      });
      state = { nextTime: result.nextTime, nextIndex: result.nextIndex };
      for (const pulse of result.pulses) times.push(pulse.time);
    }
    expect(times.length).toBeGreaterThan(100);
    times.forEach((time, index) => {
      expect(time).toBeCloseTo(index * 0.5, 6);
    });
  });

  it('drops pulses that are already in the past instead of firing them late', () => {
    // The tab was backgrounded: the clock jumped three beats ahead.
    const result = pulsesInWindow({ ...base, now: 2.45 });
    expect(result.pulses.map((pulse) => pulse.time)).toEqual([2.5]);
    // The count still advanced, so the bar stays in phase.
    expect(result.pulses[0].index).toBe(3);
    expect(result.pulses[0].beatInBar).toBe(3);
  });

  it('never loops forever on a nonsense interval', () => {
    const result = pulsesInWindow({ ...base, interval: 0, now: 1 });
    expect(result.pulses).toEqual([]);
    expect(result.nextTime).toBe(1);
  });
});

describe('PulseScheduler', () => {
  function harness() {
    let handler: (() => void) | null = null;
    const timer: TimerApi = {
      setInterval: (fn) => {
        handler = fn;
        return 1;
      },
      clearInterval: () => {
        handler = null;
      },
    };
    let now = 10;
    const pulses: Pulse[] = [];
    const scheduler = new PulseScheduler({
      now: () => now,
      onPulse: (pulse) => pulses.push(pulse),
      timer,
    });
    return {
      scheduler,
      pulses,
      tick: (at: number) => {
        now = at;
        handler?.();
      },
      get running() {
        return handler !== null;
      },
    };
  }

  it('schedules the first pulse without waiting for a timer tick', () => {
    const h = harness();
    h.scheduler.interval = 0.5;
    h.scheduler.start(10);
    expect(h.pulses).toHaveLength(1);
    expect(h.pulses[0]).toMatchObject({ time: 10, index: 0, accent: true });
  });

  it('keeps pulsing on each tick and stops on demand', () => {
    const h = harness();
    h.scheduler.interval = 0.1;
    h.scheduler.beatsPerBar = 2;
    h.scheduler.start(10);
    h.tick(10.1);
    h.tick(10.2);
    expect(h.pulses.map((pulse) => pulse.beatInBar)).toEqual([0, 1, 0]);
    expect(h.scheduler.running).toBe(true);

    h.scheduler.stop();
    expect(h.scheduler.running).toBe(false);
    h.tick(10.5);
    expect(h.pulses).toHaveLength(3);
  });

  it('applies a tempo change to the pulses after it', () => {
    const h = harness();
    h.scheduler.interval = 0.5;
    h.scheduler.start(10);
    h.scheduler.interval = 0.25;
    h.tick(10.5);
    expect(h.pulses.map((pulse) => pulse.time)).toEqual([10, 10.5]);
    h.tick(10.75);
    expect(h.pulses.at(-1)?.time).toBe(10.75);
  });
});
