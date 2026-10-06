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
 * Velocity → voice gain for the built-in synth. The 1.5 exponent keeps soft
 * playing soft without making it inaudible; the curve is anchored so a voice
 * at the app's own velocity peaks at exactly `NOTE_PEAK_TARGET` — the same
 * level the sampled path is calibrated to, so a dead CDN changes the timbre
 * and not the loudness.
 */
export function velocityGain(velocity: number): number {
  return NOTE_PEAK_TARGET * (clampVelocity(velocity) / DEFAULT_VELOCITY) ** 1.5;
}

// ---- output level --------------------------------------------------------

/** Decibels (full scale) → linear gain. */
export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

/** Linear gain → decibels (full scale); silence is `-Infinity`. */
export function gainToDb(gain: number): number {
  return 20 * Math.log10(gain);
}

/**
 * How loud one note is at 100 % volume: a voice at `DEFAULT_VELOCITY` (what
 * every exercise plays) peaks at −3 dBFS, on both paths (bug 94e41524 — the
 * soundfont used to peak around −22 dBFS while the synth sat at −6).
 *
 * **This is the one constant to tweak if the owner's listen-through says the
 * app is too loud or too quiet.** The synth curve, the soundfont's output gain
 * and the headroom budget are all derived from it.
 */
export const NOTE_PEAK_TARGET = dbToGain(-3);

/**
 * The MusyngKite soundfonts `smplr` loads are mastered quietly. Measured by
 * decoding every sample of the seven `INSTRUMENTS` (2026-10-06): per-sample
 * peaks run 0.024–0.096, the acoustic grand's median is 0.064 and no
 * instrument's loudest sample tops 0.096. The typical peak is what the level
 * is calibrated on; the worst case is what the master limiter is for.
 */
export const SOUNDFONT_TYPICAL_PEAK = 0.064;

/**
 * `smplr`'s own velocity curve (`midiVelToGain`, `velocity² / 127²`). Its
 * output channel applies the same curve to its `volume` option (default 100),
 * which is `SMPLR_CHANNEL_GAIN`.
 */
export function smplrVelocityGain(velocity: number): number {
  return (clampVelocity(velocity) / MAX_VELOCITY) ** 2;
}

export const SMPLR_CHANNEL_GAIN = smplrVelocityGain(100);

/**
 * The gain the engine hands `Soundfont({ extraGain })` — `smplr`'s own
 * default is 5, which left a typical note at −22 dBFS. Derived, not tuned: it
 * is whatever puts a typical sample at `DEFAULT_VELOCITY` on
 * `NOTE_PEAK_TARGET` (≈ 45).
 */
export const SOUNDFONT_OUTPUT_GAIN =
  NOTE_PEAK_TARGET /
  (SOUNDFONT_TYPICAL_PEAK *
    smplrVelocityGain(DEFAULT_VELOCITY) *
    SMPLR_CHANNEL_GAIN);

// ---- summed-gain headroom ------------------------------------------------

/**
 * The loudest the voices the engine starts *together* may sum to, measured
 * before the master volume.
 *
 * Voices mix by addition, so a block chord's worst case is the sum of its
 * voices' peaks — and their attacks are aligned, which is exactly that case.
 * Keeping the *sum* under full scale keeps every chord the app plays itself
 * out of the master limiter's way, at every volume, because the master gain
 * is itself ≤ 1 (`volumeGain`).
 *
 * −0.45 dBFS: a hair under full scale. It is a ceiling, not a level — the
 * level is `NOTE_PEAK_TARGET`, and a single note at the app's velocity is
 * well under it and untouched.
 */
export const SUMMED_PEAK_CEILING = 0.95;

/**
 * The scale every voice of one start group gets, so their peaks sum to at most
 * `SUMMED_PEAK_CEILING`. `1` — nothing touched — whenever they already do, so a
 * single note at any normal velocity keeps exactly its calibrated level.
 *
 * Deliberately *not* the power-preserving `1 / sqrt(n)`: that is kinder to
 * perceived loudness but still clips (four voices at 88 would reach 1.15), and
 * a guarantee that survives twelve voices is worth the ~3 dB it costs a chord.
 * The rule is one line so a later level policy is a one-line change.
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
 * MIDI velocity → the peak one soundfont voice reaches at 100 % volume: a
 * typical sample through `smplr`'s velocity curve, its channel and the
 * engine's `SOUNDFONT_OUTPUT_GAIN` — i.e. `NOTE_PEAK_TARGET` at
 * `DEFAULT_VELOCITY` by construction.
 *
 * Budgeted on the *typical* sample, not the loudest: budgeting the 0.096
 * worst case would cost every note 3.5 dB to protect a few samples, and
 * would flatten every touch above velocity ~76 to the same level. What a
 * loud sample adds on top is the master limiter's job.
 */
export function sampledVoiceGain(velocity: number): number {
  return (
    SOUNDFONT_TYPICAL_PEAK *
    smplrVelocityGain(velocity) *
    SMPLR_CHANNEL_GAIN *
    SOUNDFONT_OUTPUT_GAIN
  );
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

// ---- master limiter ------------------------------------------------------

/**
 * The `DynamicsCompressorNode` between the master volume and the speakers.
 *
 * The headroom above budgets what the engine starts *together*; it cannot
 * budget what the user holds down — a chord played on a MIDI piano arrives as
 * separate `noteOn`s, and a voice already sounding cannot be turned down
 * without ducking it audibly. At `NOTE_PEAK_TARGET` four held notes sum to
 * about +9 dBFS, so the master needs a limiter: a hard knee at −2 dBFS, the
 * steepest ratio Web Audio allows, the fastest attack. Every browser runs the
 * same compressor kernel with a 6 ms look-ahead, which is what lets a 1 ms
 * attack catch a 5 ms synth attack — and also 6 ms of latency, well inside
 * ADR 0001's 30 ms key-to-sound budget.
 *
 * Below the threshold the limiter must be transparent, so a single note keeps
 * exactly `NOTE_PEAK_TARGET` — see `LIMITER_TRIM`.
 */
export const LIMITER = {
  thresholdDb: -2,
  kneeDb: 0,
  ratio: 20,
  attackS: 0.001,
  releaseS: 0.1,
} as const;

/**
 * The make-up gain a `DynamicsCompressorNode` applies to *everything*, as the
 * Web Audio spec (§ DynamicsCompressorNode, "makeup gain") and Blink/WebKit's
 * kernel compute it: `(1 / fullRangeGain) ^ 0.6`, where `fullRangeGain` is the
 * compression curve at 0 dBFS. Closed form for a hard knee only.
 */
export function compressorMakeupGain(
  thresholdDb: number,
  ratio: number,
): number {
  const fullRangeDb = thresholdDb + (0 - thresholdDb) / ratio;
  return dbToGain(-0.6 * fullRangeDb);
}

/**
 * The gain after the limiter that cancels its make-up gain (≈ −1.1 dB), so a
 * signal under the threshold leaves exactly as loud as it arrived and
 * `NOTE_PEAK_TARGET` is what the speakers get.
 */
export const LIMITER_TRIM =
  1 / compressorMakeupGain(LIMITER.thresholdDb, LIMITER.ratio);

/**
 * The limiter's steady-state curve (hard knee, trim included): what a sustained
 * peak `input` leaves the master at. Its attack and release are the browser's
 * — this is the static half, the one a unit test can hold it to.
 */
export function limiterStaticPeak(input: number): number {
  const threshold = dbToGain(LIMITER.thresholdDb);
  if (input <= threshold) return input;
  const db =
    LIMITER.thresholdDb +
    (gainToDb(input) - LIMITER.thresholdDb) / LIMITER.ratio;
  return dbToGain(db);
}
