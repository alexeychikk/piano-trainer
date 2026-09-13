import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from './engine.svelte';
import { Metronome } from './metronome.svelte';
import { DEFAULT_SETTINGS, settings } from '$lib/storage/settings.svelte';
import { TICK_MS, type TimerApi } from './scheduler';

vi.mock('smplr', () => ({
  Soundfont: () => ({
    ready: Promise.resolve(),
    start: () => () => {},
    stop: () => {},
    dispose: () => {},
  }),
}));

/** A stand-in engine: it records clicks instead of making them. */
class FakeEngine {
  started = true;
  clicks: { time: number; accent: boolean }[] = [];
  #now = 0;

  async ensureStarted() {}
  now() {
    return this.#now;
  }
  advance(seconds: number) {
    this.#now += seconds;
  }
  click(time: number, accent: boolean) {
    this.clicks.push({ time, accent });
  }
}

function harness() {
  const engine = new FakeEngine();
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
  const metronome = new Metronome(engine as unknown as AudioEngine, {
    timer,
    frames: null,
  });
  return {
    engine,
    metronome,
    /** Run the clock forward in the scheduler's own 25 ms steps. */
    run: (seconds: number) => {
      const steps = Math.round(seconds / (TICK_MS / 1000));
      for (let step = 0; step < steps; step += 1) {
        engine.advance(TICK_MS / 1000);
        handler?.();
      }
    },
    get ticking() {
      return handler !== null;
    },
  };
}

beforeEach(() => {
  settings.value = { ...DEFAULT_SETTINGS };
  localStorage.clear();
});

describe('Metronome', () => {
  it('clicks at the stored tempo, accenting the downbeat', async () => {
    const h = harness();
    h.metronome.setTempo(120);
    await h.metronome.start();

    h.run(3);

    const times = h.engine.clicks.map((click) => click.time);
    expect(times.length).toBeGreaterThanOrEqual(2);
    times.forEach((time, index) => {
      // 120 bpm = every 0.5 s from the first click; no drift.
      expect(time).toBeCloseTo(times[0] + index * 0.5, 6);
    });
    expect(h.engine.clicks[0].accent).toBe(true);
    expect(h.engine.clicks[1].accent).toBe(false);
  });

  it('accents every bar according to beats per bar', async () => {
    const h = harness();
    h.metronome.setTempo(240);
    h.metronome.setBeatsPerBar(3);
    await h.metronome.start();
    h.run(2);

    const accents = h.engine.clicks.map((click) => click.accent);
    expect(accents.slice(0, 6)).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it('moves the beat indicator only once the audio clock reaches the click', async () => {
    const h = harness();
    h.metronome.setTempo(60);
    await h.metronome.start();
    expect(h.metronome.beat).toBe(-1);

    h.run(0.05);
    h.metronome.syncIndicator();
    expect(h.metronome.beat).toBe(-1); // the first click is still ahead

    h.run(0.2);
    h.metronome.syncIndicator();
    expect(h.metronome.beat).toBe(0);

    h.run(1);
    h.metronome.syncIndicator();
    expect(h.metronome.beat).toBe(1);
  });

  it('never accumulates pending beats, even with no animation frames', async () => {
    const h = harness();
    h.metronome.setTempo(240);
    await h.metronome.start();

    h.run(60); // a minute of clicks with the rAF drain unavailable
    expect(h.engine.clicks.length).toBeGreaterThan(200);
    // Bounded by the scheduler's lookahead, not one entry per beat.
    expect(h.metronome.pendingBeats).toBeLessThanOrEqual(2);
  });

  it('stops cleanly and resets the indicator', async () => {
    const h = harness();
    await h.metronome.start();
    expect(h.metronome.running).toBe(true);
    h.run(1);

    h.metronome.stop();
    expect(h.metronome.running).toBe(false);
    expect(h.metronome.beat).toBe(-1);
    expect(h.ticking).toBe(false);

    const clicked = h.engine.clicks.length;
    h.run(2);
    expect(h.engine.clicks).toHaveLength(clicked);
  });

  it('toggles, and a tempo change applies while running', async () => {
    const h = harness();
    h.metronome.setTempo(60);
    await h.metronome.start();
    h.run(0.5);
    h.metronome.setTempo(120);
    h.run(1.5);

    const times = h.engine.clicks.map((click) => click.time);
    // The click already scheduled keeps its slot; the change lands after it.
    expect(times[1] - times[0]).toBeCloseTo(1, 6);
    expect(times[2] - times[1]).toBeCloseTo(0.5, 6);

    await h.metronome.toggle();
    expect(h.metronome.running).toBe(false);
  });

  it('persists tempo and beats per bar, clamped to the usable range', () => {
    const h = harness();
    h.metronome.setTempo(1000);
    h.metronome.setBeatsPerBar(0);
    expect(settings.value.tempoBpm).toBe(240);
    expect(settings.value.beatsPerBar).toBe(1);
    expect(h.metronome.bpm).toBe(240);
    expect(h.metronome.beatsPerBar).toBe(1);
    expect(
      JSON.parse(localStorage.getItem('piano-trainer:settings')!),
    ).toMatchObject({ tempoBpm: 240, beatsPerBar: 1 });
  });
});
