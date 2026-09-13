import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from './engine.svelte';
import { DEFAULT_SETTINGS, settings } from '$lib/storage/settings.svelte';
import { installFakeAudioContext, type FakeAudioContext } from './testing';

const ready = vi.hoisted(() => ({ fails: false }));
const sampled = vi.hoisted(() => ({
  started: [] as { note: number; velocity?: number }[],
  stopped: [] as (number | undefined)[],
}));

vi.mock('smplr', () => ({
  Soundfont: () => ({
    ready: ready.fails
      ? Promise.reject(new Error('offline'))
      : Promise.resolve(),
    start: (event: { note: number; velocity?: number }) => {
      sampled.started.push(event);
      return () => sampled.stopped.push(event.note);
    },
    stop: (midi?: number) => sampled.stopped.push(midi),
    dispose: () => {},
  }),
}));

let fake: ReturnType<typeof installFakeAudioContext>;

function context(): FakeAudioContext {
  return fake.contexts[0];
}

beforeEach(() => {
  ready.fails = false;
  sampled.started = [];
  sampled.stopped = [];
  settings.value = { ...DEFAULT_SETTINGS };
  localStorage.clear();
  fake = installFakeAudioContext();
});

afterEach(() => {
  fake.restore();
});

describe('the gesture rule (ADR §2)', () => {
  it('creates no AudioContext and makes no sound until it is started', () => {
    const engine = new AudioEngine();
    engine.noteOn(60, 100);
    engine.playNote(64);
    engine.click(0, true);

    expect(fake.contexts).toHaveLength(0);
    expect(engine.status).toBe('idle');
    expect(engine.started).toBe(false);
    expect(sampled.started).toEqual([]);
  });

  it('creates exactly one interactive context, however often it is started', async () => {
    const engine = new AudioEngine();
    await engine.ensureStarted();
    await engine.ensureStarted();

    expect(fake.contexts).toHaveLength(1);
    expect(context().options).toEqual({ latencyHint: 'interactive' });
    expect(context().state).toBe('running');
    expect(engine.status).toBe('ready');
  });

  it('reports a browser without Web Audio instead of throwing', async () => {
    fake.restore();
    const global = globalThis as { AudioContext?: unknown };
    const previous = global.AudioContext;
    delete global.AudioContext;

    const engine = new AudioEngine();
    await engine.ensureStarted();
    expect(engine.status).toBe('failed');
    expect(() => engine.noteOn(60)).not.toThrow();

    if (previous !== undefined) global.AudioContext = previous;
  });
});

describe('notes', () => {
  it('plays and releases held notes, polyphonically', async () => {
    const engine = new AudioEngine();
    await engine.ensureStarted();

    engine.noteOn(60, 100);
    engine.noteOn(64, 100);
    engine.noteOn(67, 100);
    expect(sampled.started.map((event) => event.note)).toEqual([60, 64, 67]);

    engine.noteOff(64);
    expect(sampled.stopped).toContain(64);
    expect(sampled.stopped).not.toContain(60);

    engine.stopAll();
    expect(sampled.stopped).toContain(60);
    expect(sampled.stopped).toContain(67);
  });

  it('clamps velocity into the MIDI range', async () => {
    const engine = new AudioEngine();
    await engine.ensureStarted();
    engine.noteOn(60, 999);
    expect(sampled.started[0].velocity).toBe(127);
  });

  it('schedules a sequence on the audio clock, all at once', async () => {
    const engine = new AudioEngine();
    await engine.ensureStarted();
    context().advance(5);

    engine.playSequence([
      { midi: 60, at: 0 },
      { midi: 64, at: 0.25 },
    ]);

    expect(sampled.started).toHaveLength(2);
    expect(sampled.started.map((event) => event)).toEqual([
      expect.objectContaining({ note: 60 }),
      expect.objectContaining({ note: 64 }),
    ]);
  });

  it('is silent while muted', async () => {
    const engine = new AudioEngine();
    await engine.ensureStarted();
    engine.setMuted(true);
    sampled.started = [];

    engine.noteOn(60);
    engine.playChord([60, 64]);
    engine.click(1, true);

    expect(sampled.started).toEqual([]);
    expect(context().oscillators).toHaveLength(0);
    expect(settings.value.soundEnabled).toBe(false);
  });
});

describe('the soundfont fallback', () => {
  it('keeps playing through the built-in synth and says so once', async () => {
    ready.fails = true;
    const engine = new AudioEngine();
    const onFallback = vi.fn();
    engine.onFallback = onFallback;

    await engine.ensureStarted();
    expect(engine.status).toBe('fallback');
    expect(onFallback).toHaveBeenCalledTimes(1);

    engine.noteOn(60, 100);
    expect(context().oscillators).toHaveLength(1);
    expect(() => engine.noteOff(60)).not.toThrow();

    // A second failing instrument does not re-announce the same thing.
    engine.setInstrument('harpsichord');
    await vi.waitFor(() => expect(engine.status).toBe('fallback'));
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it('clicks the metronome even when no samples loaded', async () => {
    ready.fails = true;
    const engine = new AudioEngine();
    await engine.ensureStarted();

    engine.click(2.5, true);
    engine.click(3, false);
    const [accent, beat] = context().oscillators;
    expect(accent.startedAt).toBe(2.5);
    expect(accent.frequency.value).toBeGreaterThan(beat.frequency.value);
  });
});

describe('settings', () => {
  it('persists volume and applies it to the master gain', async () => {
    const engine = new AudioEngine();
    await engine.ensureStarted();

    engine.setVolume(0.5);
    expect(settings.value.volume).toBe(0.5);
    // Squared curve (`volumeGain`), applied to the master gain node.
    expect(context().gains[0].gain.value).toBeCloseTo(0.25, 6);

    engine.setMuted(true);
    expect(context().gains[0].gain.value).toBe(0);
  });

  it('remembers the instrument and caches the loaded one', async () => {
    const engine = new AudioEngine();
    await engine.ensureStarted();
    expect(engine.loadedInstrument).toBe('acoustic_grand_piano');

    engine.setInstrument('vibraphone');
    await vi.waitFor(() => expect(engine.loadedInstrument).toBe('vibraphone'));
    expect(settings.value.instrument).toBe('vibraphone');

    // Switching back is instant: the first source is cached, not re-fetched.
    engine.setInstrument('acoustic_grand_piano');
    expect(engine.loadedInstrument).toBe('acoustic_grand_piano');
    expect(engine.status).toBe('ready');
  });

  it('falls back to the default for an unknown stored instrument', async () => {
    settings.value = { ...DEFAULT_SETTINGS, instrument: 'kazoo' };
    const engine = new AudioEngine();
    await engine.ensureStarted();
    expect(engine.loadedInstrument).toBe('acoustic_grand_piano');
  });
});
