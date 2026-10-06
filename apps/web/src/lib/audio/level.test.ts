/**
 * Output level, measured — bug 94e41524 ("the piano is too quiet at 100 %").
 *
 * No sandbox can play audio and jsdom has no `OfflineAudioContext`, so this is
 * the equivalent: the real engine schedules into the fake context, and the
 * test renders what it scheduled sample by sample — the synth's triangle under
 * its envelope, or (for the soundfont) a sample at the measured MusyngKite
 * peak through `smplr`'s gain chain — through the master volume and the
 * limiter's static curve, then reads the peak. `e2e/output-level.spec.ts`
 * does the same against Chromium's real `OfflineAudioContext` and its real
 * compressor.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, settings } from '$lib/storage/settings.svelte';
import { midiToFrequency } from '$lib/theory';
import { AudioEngine } from './engine.svelte';
import {
  LIMITER_TRIM,
  SMPLR_CHANNEL_GAIN,
  SOUNDFONT_TYPICAL_PEAK,
  gainToDb,
  limiterStaticPeak,
  smplrVelocityGain,
} from './gain';
import { envelopeGainAt } from './synth';
import { installFakeAudioContext, type FakeAudioContext } from './testing';

const sf = vi.hoisted(() => ({
  fails: false,
  extraGain: undefined as number | undefined,
  started: [] as { note: number; velocity: number; time?: number }[],
}));

vi.mock('smplr', () => ({
  Soundfont: (_ctx: unknown, options: { extraGain?: number }) => {
    sf.extraGain = options.extraGain;
    return {
      ready: sf.fails
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(),
      start: (event: { note: number; velocity: number }) => {
        sf.started.push(event);
        return () => {};
      },
      stop: () => {},
      dispose: () => {},
    };
  },
}));

const RATE = 48_000;
/** Long enough to cover every attack; the peak is in the first few ms. */
const WINDOW_S = 0.25;
/** `smplr`'s own `extraGain` default — what the engine used before the fix. */
const SMPLR_DEFAULT_EXTRA_GAIN = 5;
/** The loudest sample of the seven MusyngKite instruments (gain.ts). */
const SOUNDFONT_LOUDEST_PEAK = 0.096;

const C_MAJ7 = [60, 64, 67, 71];

let fake: ReturnType<typeof installFakeAudioContext>;

beforeEach(() => {
  sf.fails = false;
  sf.extraGain = undefined;
  sf.started = [];
  settings.value = { ...DEFAULT_SETTINGS, volume: 1 };
  localStorage.clear();
  fake = installFakeAudioContext();
});

afterEach(() => {
  fake.restore();
});

function context(): FakeAudioContext {
  return fake.contexts[0];
}

/** Band-limit aside, Web Audio's triangle: peak 1, starting at 0. */
function triangle(phase: number): number {
  return (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * phase));
}

/**
 * Everything the master hears, sample by sample, then the limiter's static
 * curve on the peak (the e2e spec owns its dynamics).
 */
function render(voice: (t: number) => number): number {
  const ctx = context();
  // The master volume (`gains[0]`) and the trim that cancels the limiter's
  // make-up gain; below threshold the pair is unity.
  const master = ctx.gains[0].gain.value;
  let peak = 0;
  for (let i = 0; i < RATE * WINDOW_S; i += 1) {
    peak = Math.max(peak, Math.abs(voice(i / RATE) * master));
  }
  return limiterStaticPeak(peak);
}

/** The synth's voices as the fake recorded them: pitch, start, envelope peak. */
function renderSynth(): number {
  const ctx = context();
  const voices = ctx.oscillators
    .filter((osc) => osc.type === 'triangle')
    .map((osc, index) => {
      const gain = ctx.gains[index + 2]; // after the master and the trim
      const peak = gain.gain.events.find((e) => e.kind === 'linear')!.value;
      return {
        start: osc.startedAt ?? 0,
        frequency: osc.frequency.valueAt(osc.startedAt ?? 0),
        peak,
      };
    });
  return render((t) =>
    voices.reduce(
      (sum, v) =>
        sum +
        triangle(v.frequency * Math.max(0, t - v.start)) *
          envelopeGainAt(t, v.start, v.peak),
      0,
    ),
  );
}

/**
 * The soundfont's voices: a decaying partial whose own peak is the sample's,
 * through `smplr`'s velocity curve, its channel and the engine's `extraGain`.
 */
function renderSampled(samplePeak: number, extraGain: number): number {
  const voices = sf.started.map((event) => ({
    frequency: midiToFrequency(event.note),
    level:
      samplePeak *
      smplrVelocityGain(event.velocity) *
      SMPLR_CHANNEL_GAIN *
      extraGain,
  }));
  return render((t) =>
    voices.reduce(
      (sum, v) =>
        sum +
        v.level * Math.sin(2 * Math.PI * v.frequency * t) * Math.exp(-t / 0.8),
      0,
    ),
  );
}

async function started(fails: boolean): Promise<AudioEngine> {
  sf.fails = fails;
  const engine = new AudioEngine();
  await engine.ensureStarted();
  return engine;
}

describe('one note at 100 % volume', () => {
  it('peaks at −3 dBFS on the synth', async () => {
    const engine = await started(true);
    engine.playNote(60);
    const peak = renderSynth();
    // Before: `velocityGain(80)` was (80/127)^1.5 = 0.50, i.e. −6.0 dBFS.
    expect(gainToDb(peak)).toBeCloseTo(-3, 1);
  });

  it('peaks at −3 dBFS on the soundfont, ~19 dB louder than before', async () => {
    const engine = await started(false);
    engine.playNote(60);
    expect(sf.extraGain).toBeDefined();

    const after = renderSampled(SOUNDFONT_TYPICAL_PEAK, sf.extraGain!);
    const before = renderSampled(
      SOUNDFONT_TYPICAL_PEAK,
      SMPLR_DEFAULT_EXTRA_GAIN,
    );
    expect(gainToDb(after)).toBeCloseTo(-3, 1);
    expect(gainToDb(before)).toBeCloseTo(-22.1, 0);
    expect(gainToDb(after) - gainToDb(before)).toBeGreaterThan(18);
  });

  it('keeps the loudest sample in the kit under full scale', async () => {
    const engine = await started(false);
    engine.playNote(60);
    const peak = renderSampled(SOUNDFONT_LOUDEST_PEAK, sf.extraGain!);
    expect(peak).toBeLessThan(1);
  });
});

describe('a four-note chord at 100 % volume', () => {
  it.each([
    ['the synth', true],
    ['the soundfont', false],
  ])('never clips on %s, at any velocity', async (_label, fails) => {
    for (const velocity of [80, 88, 127]) {
      sf.started = [];
      fake.restore();
      fake = installFakeAudioContext();
      const engine = await started(fails);
      engine.playChord(C_MAJ7, { velocity });
      const peak = fails
        ? renderSynth()
        : renderSampled(SOUNDFONT_LOUDEST_PEAK, sf.extraGain!);
      expect(peak).toBeGreaterThan(0.5);
      expect(peak).toBeLessThan(1);
    }
  });
});

describe('four held notes at 100 % volume (a chord from a MIDI piano)', () => {
  it('reaches the limiter, which holds the sustained peak under full scale', async () => {
    const engine = await started(true);
    // Four separate note-ons: held keys are not a start group, so nothing
    // budgets them but the limiter.
    for (const midi of C_MAJ7) engine.noteOn(midi, 100);
    const peak = renderSynth();
    expect(peak).toBeLessThan(1);
    expect(LIMITER_TRIM).toBeLessThan(1);
  });
});
