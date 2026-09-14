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
  /**
   * A file that is not ours (or not JSON at all). The copy deck has no line
   * for it — it names the wrong-version case only — so this is the one new
   * sentence slice 5b adds, in the deck's voice: says what happened, offers
   * the next move, never blames.
   */
  importInvalid:
    'That file is not piano-trainer practice data — nothing was changed.',
  /** The import landed, but only in memory (no storage, or a failed write). */
  importNotSaved:
    'Imported, but it could not be saved — it lasts until you close this tab.',
} as const;

/** `Exported 412 attempts and 37 skills.` — copy deck (UX §9), verbatim. */
export function exportDone(attempts: number, skills: number): string {
  return `Exported ${count(attempts, 'attempt')} and ${count(skills, 'skill')}.`;
}

/** `Imported 402 attempts, 37 skills.` — UX §6.3, verbatim. */
export function importDone(attempts: number, skills: number): string {
  return `Imported ${count(attempts, 'attempt')}, ${count(skills, 'skill')}.`;
}

/**
 * `This file is from schema v2; this app reads v1.` — copy deck (UX §9),
 * verbatim. A newer file is refused rather than half-understood.
 */
export function importWrongVersion(fileVersion: number, appVersion: number) {
  return `This file is from schema v${fileVersion}; this app reads v${appVersion}.`;
}

/**
 * The `#data` stats line (sci-fi-screens.md §8.5):
 * `412 attempts · 37 skills · last export 3 d ago`. The spec's `1.2 MB` clause
 * is dropped — see the section component.
 */
export function dataStats(input: {
  attempts: number;
  skills: number;
  lastExportAt: number | null;
  now: number;
}): string {
  const parts = [
    count(input.attempts, 'attempt'),
    count(input.skills, 'skill'),
  ];
  if (input.lastExportAt !== null) {
    parts.push(`last export ${timeAgo(input.lastExportAt, input.now)}`);
  }
  return parts.join(' · ');
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

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
