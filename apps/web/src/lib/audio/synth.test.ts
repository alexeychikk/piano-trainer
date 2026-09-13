import { describe, expect, it } from 'vitest';
import { velocityGain } from './gain';
import {
  ATTACK_S,
  RELEASE_S,
  SUSTAIN,
  createSynthSource,
  envelopeGainAt,
} from './synth';
import { FakeAudioContext, type FakeGain } from './testing';

/** A context plus the destination the source is wired into. */
function harness() {
  const ctx = new FakeAudioContext();
  const destination = ctx.createGain();
  const source = createSynthSource(
    ctx as unknown as BaseAudioContext,
    destination as unknown as AudioNode,
  );
  return {
    ctx,
    source,
    /** The gain node of the nth voice (index 0 is the destination). */
    voiceGain: (index = 0): FakeGain => ctx.gains[index + 1],
    voiceOsc: (index = 0) => ctx.oscillators[index],
  };
}

describe('envelopeGainAt', () => {
  it('rises to the peak and decays towards the sustain, never above peak', () => {
    const peak = 0.8;
    expect(envelopeGainAt(0, 0, peak)).toBe(0);
    expect(envelopeGainAt(ATTACK_S / 2, 0, peak)).toBeCloseTo(peak / 2, 6);
    expect(envelopeGainAt(ATTACK_S, 0, peak)).toBeCloseTo(peak, 6);

    const later = envelopeGainAt(1, 0, peak);
    expect(later).toBeLessThan(peak);
    expect(later).toBeGreaterThan(peak * SUSTAIN);

    for (const t of [0, 0.001, 0.005, 0.1, 0.5, 2, 30]) {
      expect(envelopeGainAt(t, 0, peak)).toBeLessThanOrEqual(peak + 1e-9);
    }
  });
});

describe('createSynthSource', () => {
  it('releases a scheduled note from its envelope value, never above peak', () => {
    const h = harness();
    const velocity = 40;
    const peak = velocityGain(velocity);
    h.source.start({ midi: 60, velocity, time: 0, duration: 1 });

    const gain = h.voiceGain().gain;
    // The release is anchored at the end of the note. Reading `gain.value` at
    // schedule time would have anchored it on the node's intrinsic 1 — a quiet
    // note jumping to full blast at its end.
    const anchor = gain.valueAt(1);
    expect(anchor).toBeGreaterThan(0);
    expect(anchor).toBeLessThanOrEqual(peak);
    expect(anchor).toBeCloseTo(envelopeGainAt(1, 0, peak), 6);
    // And it is silent once the release ramp has run.
    expect(gain.valueAt(1 + RELEASE_S)).toBeCloseTo(0.0001, 6);
    expect(h.voiceOsc().stoppedAt).toBeCloseTo(1 + RELEASE_S, 6);
  });

  it('still stops a scheduled note before its duration elapses', () => {
    const h = harness();
    h.source.start({ midi: 60, velocity: 100, time: 0, duration: 2 });

    h.ctx.advance(0.5);
    h.source.stop();

    const gain = h.voiceGain().gain;
    expect(h.voiceOsc().stoppedAt).toBeCloseTo(0.5 + RELEASE_S, 6);
    expect(h.voiceOsc().stoppedAt!).toBeLessThan(2);
    // Silent well before the note would have ended on its own.
    expect(gain.valueAt(1)).toBeCloseTo(0.0001, 6);
  });

  it('re-anchors only earlier, never prolonging a note', () => {
    const h = harness();
    h.source.start({ midi: 60, velocity: 100, time: 0, duration: 0.5 });

    h.ctx.advance(0.4);
    h.source.stop(); // earlier than the scheduled release: cuts it short
    expect(h.voiceOsc().stoppedAt).toBeCloseTo(0.4 + RELEASE_S, 6);

    h.ctx.advance(1);
    h.source.stop();
    expect(h.voiceOsc().stoppedAt).toBeCloseTo(0.4 + RELEASE_S, 6);
  });

  it('holds a note until it is released, and is polyphonic', () => {
    const h = harness();
    h.source.start({ midi: 60, velocity: 100 });
    h.source.start({ midi: 64, velocity: 100 });
    expect(h.source.voiceCount()).toBe(2);
    expect(h.voiceOsc(0).stoppedAt).toBeNull();

    h.ctx.advance(0.3);
    h.source.stop(60);
    expect(h.voiceOsc(0).stoppedAt).toBeCloseTo(0.3 + RELEASE_S, 6);
    expect(h.voiceOsc(1).stoppedAt).toBeNull();
    expect(h.source.voiceCount()).toBe(1);
  });

  it('prunes voices that have finished sounding', () => {
    const h = harness();
    for (const midi of [60, 62, 64]) {
      h.source.start({ midi, velocity: 90, time: 0, duration: 0.1 });
    }
    expect(h.source.voiceCount()).toBe(3);

    h.ctx.advance(0.1 + RELEASE_S + 0.01);
    h.source.start({ midi: 67, velocity: 90 });
    expect(h.source.voiceCount()).toBe(1);
  });
});
