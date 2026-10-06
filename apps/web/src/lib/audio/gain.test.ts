import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VELOCITY,
  DEFAULT_VOLUME,
  MAX_VELOCITY,
  MIN_VELOCITY,
  LIMITER,
  LIMITER_TRIM,
  NOTE_PEAK_TARGET,
  SOUNDFONT_OUTPUT_GAIN,
  SUMMED_PEAK_CEILING,
  clampGainScale,
  compressorMakeupGain,
  dbToGain,
  gainToDb,
  limiterStaticPeak,
  smplrVelocityGain,
  clampVelocity,
  clampVolume,
  headroomScale,
  sampledVelocity,
  sampledVoiceGain,
  velocityGain,
  volumeGain,
} from './gain';

describe('clampVolume', () => {
  it('keeps a volume inside 0..1', () => {
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(-2)).toBe(0);
    expect(clampVolume(9)).toBe(1);
  });

  it('falls back to the default for junk', () => {
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_VOLUME);
  });
});

describe('volumeGain', () => {
  it('is silent at zero and unity at full', () => {
    expect(volumeGain(0)).toBe(0);
    expect(volumeGain(1)).toBe(1);
  });

  it('curves below the linear slider position', () => {
    expect(volumeGain(0.5)).toBeCloseTo(0.25, 6);
  });

  it('is a hard zero when muted, whatever the slider says', () => {
    expect(volumeGain(1, true)).toBe(0);
  });
});

describe('velocityGain', () => {
  it('puts a voice at the app’s own velocity on the target level', () => {
    expect(velocityGain(DEFAULT_VELOCITY)).toBeCloseTo(NOTE_PEAK_TARGET, 12);
    expect(gainToDb(velocityGain(DEFAULT_VELOCITY))).toBeCloseTo(-3, 6);
  });

  it('is loudest at velocity 127', () => {
    expect(velocityGain(MAX_VELOCITY)).toBeGreaterThan(velocityGain(126));
    expect(velocityGain(MAX_VELOCITY)).toBeCloseTo(
      NOTE_PEAK_TARGET * (MAX_VELOCITY / DEFAULT_VELOCITY) ** 1.5,
      12,
    );
  });

  it('rises monotonically and stays audible when played softly', () => {
    const soft = velocityGain(20);
    const medium = velocityGain(64);
    expect(soft).toBeGreaterThan(0);
    expect(soft).toBeLessThan(medium);
    expect(medium).toBeLessThan(velocityGain(110));
  });

  it('clamps out-of-range velocities', () => {
    expect(clampVelocity(0)).toBe(1);
    expect(clampVelocity(999)).toBe(MAX_VELOCITY);
    expect(velocityGain(999)).toBe(velocityGain(MAX_VELOCITY));
  });

  it('falls back to the default velocity for junk, never to the loudest', () => {
    expect(clampVelocity(Number.NaN)).toBe(DEFAULT_VELOCITY);
    expect(clampVelocity(undefined as unknown as number)).toBe(
      DEFAULT_VELOCITY,
    );
    expect(clampVelocity(Number.POSITIVE_INFINITY)).toBe(DEFAULT_VELOCITY);
    expect(velocityGain(Number.NaN)).toBe(velocityGain(DEFAULT_VELOCITY));
  });
});

describe('headroomScale', () => {
  it('leaves anything already under the ceiling alone', () => {
    // A single note is the common case and must not get quieter.
    expect(headroomScale([velocityGain(90)])).toBe(1);
    expect(headroomScale([])).toBe(1);
    expect(headroomScale([SUMMED_PEAK_CEILING])).toBe(1);
  });

  it('scales a group so its voices sum to exactly the ceiling', () => {
    const scale = headroomScale([0.6, 0.6, 0.6]);
    expect(scale * 1.8).toBeCloseTo(SUMMED_PEAK_CEILING, 12);
  });

  it('keeps the ceiling however many voices there are', () => {
    for (const voices of [1, 3, 4, 12, 88]) {
      const gains = Array.from({ length: voices }, () => velocityGain(127));
      const scale = headroomScale(gains);
      const summed = gains.reduce((total, gain) => total + gain * scale, 0);
      expect(summed).toBeLessThanOrEqual(SUMMED_PEAK_CEILING + 1e-12);
    }
  });

  it('survives junk instead of silencing the group', () => {
    expect(headroomScale([Number.NaN])).toBe(1);
  });
});

describe('clampGainScale', () => {
  it('treats a missing or junk scale as untouched', () => {
    expect(clampGainScale(undefined)).toBe(1);
    expect(clampGainScale(Number.NaN)).toBe(1);
  });

  it('keeps a scale inside 0..1', () => {
    expect(clampGainScale(0.5)).toBe(0.5);
    expect(clampGainScale(-1)).toBe(0);
    expect(clampGainScale(4)).toBe(1);
  });
});

describe('the sampled path', () => {
  it('models smplr’s squared velocity curve', () => {
    expect(smplrVelocityGain(MAX_VELOCITY)).toBe(1);
    expect(smplrVelocityGain(64)).toBeCloseTo((64 / 127) ** 2, 12);
    expect(sampledVoiceGain(64) / sampledVoiceGain(32)).toBeCloseTo(4, 12);
  });

  it('puts a typical sample at the app’s own velocity on the target level', () => {
    expect(sampledVoiceGain(DEFAULT_VELOCITY)).toBeCloseTo(
      NOTE_PEAK_TARGET,
      12,
    );
    // What that took: smplr's default `extraGain` is 5.
    expect(SOUNDFONT_OUTPUT_GAIN).toBeGreaterThan(40);
    expect(SOUNDFONT_OUTPUT_GAIN).toBeLessThan(50);
  });

  it('hands smplr the velocity that reaches the scaled gain', () => {
    const scale = 0.25;
    const velocity = sampledVelocity(88, scale);
    // Rounded down, so never *above* the target — that is the whole point.
    expect(sampledVoiceGain(velocity)).toBeLessThanOrEqual(
      sampledVoiceGain(88) * scale,
    );
    expect(sampledVoiceGain(velocity)).toBeCloseTo(
      sampledVoiceGain(88) * scale,
      2,
    );
  });

  it('leaves an unscaled velocity where it was', () => {
    expect(sampledVelocity(88)).toBe(88);
    expect(sampledVelocity(999)).toBe(MAX_VELOCITY);
  });

  it('never scales a voice all the way to silence', () => {
    expect(sampledVelocity(88, 0)).toBe(MIN_VELOCITY);
  });
});

describe('the master limiter', () => {
  it('cancels the compressor’s make-up gain, so it is transparent below threshold', () => {
    // Spec: (1 / curve(0 dBFS)) ^ 0.6. A −2 dB hard knee at 20:1 maps 0 dBFS
    // to −1.9 dB, so the node adds 1.14 dB to everything.
    expect(gainToDb(compressorMakeupGain(-2, 20))).toBeCloseTo(1.14, 6);
    expect(
      LIMITER_TRIM * compressorMakeupGain(LIMITER.thresholdDb, LIMITER.ratio),
    ).toBeCloseTo(1, 12);
    expect(limiterStaticPeak(NOTE_PEAK_TARGET)).toBe(NOTE_PEAK_TARGET);
  });

  it('keeps a sustained overload under full scale', () => {
    for (const db of [0, 3, 6, 9, 12, 18]) {
      const out = limiterStaticPeak(dbToGain(db));
      expect(out).toBeLessThan(1);
      expect(out).toBeGreaterThanOrEqual(dbToGain(LIMITER.thresholdDb));
    }
  });

  it('sits above a single note and at most at the headroom ceiling', () => {
    expect(dbToGain(LIMITER.thresholdDb)).toBeGreaterThan(NOTE_PEAK_TARGET);
    expect(SUMMED_PEAK_CEILING).toBeLessThan(1);
  });
});
