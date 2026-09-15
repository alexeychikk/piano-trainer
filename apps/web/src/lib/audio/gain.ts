/**
 * Loudness maths (ADR 0001 §2). Pure: sliders and MIDI velocities are linear
 * numbers, hearing is not, so both mappings live here and are tested once.
 */

export const MIN_VOLUME = 0;
export const MAX_VOLUME = 1;
/** UX spec §6.3 shows the volume slider at 72%. */
export const DEFAULT_VOLUME = 0.72;

/** MIDI velocity range. */
export const MIN_VELOCITY = 1;
export const MAX_VELOCITY = 127;

/**
 * Velocity for notes the app plays itself (exercise playback, the Test button).
 * Deliberately a copy of `$lib/midi/events`' input-side default rather than an
 * import: `audio` and `midi` are sibling layers and neither may import the
 * other — played-back notes have no touch to read.
 */
export const DEFAULT_VELOCITY = 80;

export function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return DEFAULT_VOLUME;
  return Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, volume));
}

export function clampVelocity(velocity: number): number {
  // Junk in (a malformed MIDI message, `NaN`, `undefined`) must not come out as
  // the loudest note the synth can make — fall back to the app's own velocity.
  if (!Number.isFinite(velocity)) return DEFAULT_VELOCITY;
  return Math.min(MAX_VELOCITY, Math.max(MIN_VELOCITY, Math.round(velocity)));
}

/**
 * Slider position (0..1) → master gain. Squared, because perceived loudness
 * follows roughly a power law: a linear slider feels top-heavy, this one
 * feels even. Muted is a hard zero, never a near-zero gain.
 */
export function volumeGain(volume: number, muted = false): number {
  if (muted) return 0;
  const v = clampVolume(volume);
  return v * v;
}

/**
 * MIDI velocity → voice gain for the built-in synth. `smplr` does its own
 * velocity layering, so this is only the fallback path. The 1.5 exponent keeps
 * soft playing soft without making it inaudible.
 */
export function velocityGain(velocity: number): number {
  return (clampVelocity(velocity) / MAX_VELOCITY) ** 1.5;
}

// ---- summed-gain headroom ------------------------------------------------

/**
 * The loudest the voices the engine starts *together* may sum to, measured
 * before the master volume.
 *
 * Voices mix by addition, so a block chord's worst case is the sum of its
 * voices' peaks — and their attacks are aligned, which is exactly that case.
 * Four voices at velocity 88 summed to 2.31 on the synth path, and there is no
 * limiter on the master: at any volume above ~0.62 that clipped. Keeping the
 * *sum* below 1 makes clipping impossible at every volume, because the master
 * gain is itself ≤ 1 (`volumeGain`).
 *
 * 0.85 rather than 1.0 leaves a little room for the sample buffers themselves,
 * whose peak sample is near — but not guaranteed to be at — full scale.
 *
 * **This is the one constant to tweak if the app turns out to be too quiet or
 * too loud.** Nothing else in the audio path encodes a level policy.
 */
export const SUMMED_PEAK_CEILING = 0.85;

/**
 * The scale every voice of one start group gets, so their peaks sum to at most
 * `SUMMED_PEAK_CEILING`. `1` — nothing touched — whenever they already do, so a
 * single note at any normal velocity keeps exactly the level it always had and
 * the app does not feel weaker than before.
 *
 * Deliberately *not* the power-preserving `1 / sqrt(n)`: that is kinder to
 * perceived loudness but still clips (four voices at 88 would reach 1.15), and
 * a guarantee that survives twelve voices is worth ~2 dB on a chord. The rule
 * is one line so a later level policy is a one-line change.
 */
export function headroomScale(voiceGains: readonly number[]): number {
  let sum = 0;
  for (const gain of voiceGains) sum += gain;
  if (!Number.isFinite(sum) || sum <= SUMMED_PEAK_CEILING) return 1;
  return SUMMED_PEAK_CEILING / sum;
}

/** Keep a headroom scale a usable multiplier; junk must not silence a note. */
export function clampGainScale(scale: number | undefined): number {
  if (scale === undefined || !Number.isFinite(scale)) return 1;
  return Math.min(1, Math.max(0, scale));
}

/**
 * MIDI velocity → voice gain on the sampled path. `smplr`'s `midiVelToGain` is
 * `velocity² / 127²`, applied to each voice's gain node; its output channel
 * then adds a *constant* factor (`midiVelToGain(100)` = 0.62 at the default
 * volume) which we deliberately leave out — ignoring a constant ≤ 1 only makes
 * the headroom more conservative, and it keeps this a property of a velocity
 * rather than of an instrument's configuration.
 */
export function sampledVoiceGain(velocity: number): number {
  return (clampVelocity(velocity) / MAX_VELOCITY) ** 2;
}

/**
 * The velocity to hand `smplr` for a voice that should end up `scale ×` as loud
 * as `velocity`. A `NoteEvent` carries no gain, so velocity is the only knob on
 * that path; inverting the curve above gives `velocity × √scale`.
 *
 * Rounded **down**, never to nearest: rounding up would put the group's summed
 * gain a hair back over the ceiling, which is the one thing this must not do.
 */
export function sampledVelocity(velocity: number, scale?: number): number {
  const scaled = clampVelocity(velocity) * Math.sqrt(clampGainScale(scale));
  return Math.max(MIN_VELOCITY, Math.floor(scaled));
}
