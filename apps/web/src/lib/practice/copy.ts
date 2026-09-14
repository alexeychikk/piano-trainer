/**
 * Practice-data wording, in one place — the same rule as `$lib/midi/status.ts`
 * and `$lib/audio/status.ts`: copy lives in a module, never in a component and
 * never in a computation module. The sentences are the copy deck's (UX spec
 * §9) verbatim; the functions assemble the spec's own templates (UX §6.2's
 * detail line) the way `midi/status.ts` assembles a device line.
 */
export const PRACTICE_COPY = {
  /** A failed write. Practice continues; the banner says what was lost. */
  storageFailed:
    'Could not save this attempt — practice continues, but progress may be lost.',
  /** `/progress` with nothing recorded yet. */
  empty: 'No attempts yet. Practice something and this fills up.',
} as const;

/** `2 h ago` — the granularity of the detail line (UX §6.2), not a clock. */
export function timeAgo(ts: number, now: number): string {
  const delta = Math.max(0, now - ts);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

/**
 * A practised skill's detail line — UX §6.2 verbatim, minus its `due in 3 h`
 * clause, because nothing schedules anything before slice 9 (ADR 0002 §3):
 * `12 attempts · 67% · last seen 2 h ago`.
 *
 * There is deliberately no unpractised counterpart: the screen renders this
 * only for a skill with attempts behind it, and the pips already say `new`
 * for the unseen case (UX §6.2).
 */
export function skillDetail(input: {
  attempts: number;
  /** 0..100, already rounded. */
  accuracyPercent: number;
  lastSeenAt: number;
  now: number;
}): string {
  const plural = input.attempts === 1 ? 'attempt' : 'attempts';
  return [
    `${input.attempts} ${plural}`,
    `${input.accuracyPercent}%`,
    `last seen ${timeAgo(input.lastSeenAt, input.now)}`,
  ].join(' · ');
}
