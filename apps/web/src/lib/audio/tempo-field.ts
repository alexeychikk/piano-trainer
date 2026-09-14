/**
 * The tempo field's reading of what was typed (sci-fi-screens.md §8.4).
 *
 * `onchange` always clamped through `metronome.setTempo()`, but the
 * `<input type="number">` kept whatever was typed — so the field could read
 * `400` while the metronome ran at its maximum. The field is a *display of the
 * committed value*, so the component commits, then writes `metronome.bpm`
 * back; this module is the pure half it needs to do that.
 *
 * Pure and unit-tested: no DOM, no store, no audio.
 */
import { MAX_BPM, MIN_BPM, clampTempo } from './scheduler';

/**
 * The out-of-range hint (§10.1). The numbers come from the scheduler's
 * constants, not from the copy — the spec's example reads `30–300 bpm`, but
 * this app's clamp is `MIN_BPM`–`MAX_BPM`, and a hint that disagrees with the
 * clamp would be the very bug §8.4 is closing. En dash, as the spec writes it.
 */
export const TEMPO_RANGE_HINT = `${MIN_BPM}–${MAX_BPM} bpm`;

export interface TempoReading {
  /**
   * The tempo to commit, or `null` when there is no number to commit at all
   * (an empty or unparseable field) — the caller then leaves the tempo alone
   * and writes the committed value back, so the field self-repairs.
   */
  bpm: number | null;
  /**
   * The typed value is outside the range: the field takes `aria-invalid` and
   * shows `TEMPO_RANGE_HINT`. A blank field is not "out of range" — it is
   * simply unfinished, and flagging it mid-edit would be noise.
   */
  outOfRange: boolean;
}

/**
 * Read the field's raw text. Never called on `input` for committing — only to
 * light the hint; clamping mid-typing would rewrite `1` to the minimum before
 * the `20` of `120` arrives (§8.4 point 1).
 */
export function readTempoField(raw: string): TempoReading {
  const text = raw.trim();
  if (text === '') return { bpm: null, outOfRange: false };

  const value = Number(text);
  if (!Number.isFinite(value)) return { bpm: null, outOfRange: false };

  const bpm = clampTempo(value);
  // Compare against the rounded value: `119.6` commits to 120 and is in range,
  // it is not a number the user needs warning about.
  return {
    bpm,
    outOfRange: Math.round(value) < MIN_BPM || Math.round(value) > MAX_BPM,
  };
}
