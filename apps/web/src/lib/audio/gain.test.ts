import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VOLUME,
  MAX_VELOCITY,
  clampVelocity,
  clampVolume,
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
  it('is loudest at velocity 127', () => {
    expect(velocityGain(MAX_VELOCITY)).toBe(1);
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
    expect(velocityGain(999)).toBe(1);
  });
});
