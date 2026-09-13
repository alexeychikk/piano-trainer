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
  if (!Number.isFinite(velocity)) return MAX_VELOCITY;
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
