/**
 * The mastery vocabulary (UX spec §6.2), pure so home, Progress and the
 * session summary quantise identically: **always 7 pips**,
 * `Math.round(mastery * 7)` filled, always paired with the percentage.
 *
 * Unseen skills are `null`, not 0 — "never practised" and "practised badly"
 * are different things and the spec spells the first one out as `new`.
 */

import type { Tone } from './tones';

export const PIP_COUNT = 7;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** How many of the 7 pips are filled. */
export function filledPips(mastery: number | null): number {
  if (mastery === null) return 0;
  return Math.round(clamp01(mastery) * PIP_COUNT);
}

/** The percentage shown next to the pips. */
export function masteryPercent(mastery: number): number {
  return Math.round(clamp01(mastery) * 100);
}

/** Colour role of the filled pips: ≥ 0.7 solid, 0.3–0.7 learning, < 0.3 weak. */
export function masteryTone(mastery: number | null): Tone {
  if (mastery === null) return 'neutral';
  const value = clamp01(mastery);
  if (value >= 0.7) return 'success';
  if (value >= 0.3) return 'accent';
  return 'warn';
}

/** Accessible name, e.g. `Mastery 71 percent` — never a bare number. */
export function masteryLabel(mastery: number | null, skill?: string): string {
  const what = skill ? `${skill}: ` : '';
  if (mastery === null) return `${what}not practised yet`;
  return `${what}mastery ${masteryPercent(mastery)} percent`;
}
