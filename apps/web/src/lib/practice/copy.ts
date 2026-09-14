/**
 * Practice-data wording, in one place — the same rule as `$lib/midi/status.ts`
 * and `$lib/audio/status.ts`: copy lives in a module, never in a component and
 * never in a computation module. The sentences are the copy deck's (UX spec
 * §9) verbatim; the functions assemble the spec's own templates (UX §6.2's
 * detail line) the way `midi/status.ts` assembles a device line.
 */
import { RESET_CONFIRM_WORD } from './reset';

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
  /**
   * The nudge above `Reset all practice data` (sci-fi-screens.md §8.5). Says
   * what is lost and offers the way to keep it, in the deck's voice; the
   * control itself is the warning, so this never shouts.
   */
  resetNudge: 'Export first if you want a copy — a reset cannot be undone.',
  /** The field's label, built from the word the reducer matches (§10.1). */
  resetConfirmLabel: `Type ${RESET_CONFIRM_WORD} to confirm`,
  /**
   * The same question in front of a *file* that would empty the log — an
   * honest export of an empty log, dropped on a real one (QA, slice 5b).
   * Names the file's emptiness, because nothing else on screen does.
   */
  importEmptyNudge:
    'That file contains no attempts or skills — importing it empties your practice data.',
  /** The reset landed, but only in memory (no storage, or a failed write). */
  resetNotSaved:
    'Reset here, but it could not be saved — the old data may come back when you reload.',
} as const;

/** `Reset 412 attempts and 37 skills.` — the counts that were wiped. */
export function resetDone(attempts: number, skills: number): string {
  return `Reset ${count(attempts, 'attempt')} and ${count(skills, 'skill')}.`;
}

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

/**
 * The schedule's readouts (UX §3, §6.1; sci-fi-screens.md §7). The word `due`
 * is always in the text: the amber is never the signal (§2.3), the word is.
 */

/** `12 due` — the `DUE NOW` counter's value. */
export function dueNow(n: number): string {
  return `${n} due`;
}

/** `Due 4` — the panel band's badge; the primitive uppercases it. */
export function dueBadge(n: number): string {
  return `Due ${n}`;
}

/** `12 skills due today` — the hero's sub-label once there is a schedule. */
export function skillsDueToday(n: number): string {
  return `${count(n, 'skill')} due today`;
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * The session's wording (slice 9b). `Session complete · {mm:ss}` is the copy
 * deck's (UX §9) verbatim; the other two assemble the spec's own templates
 * (UX §4.8 / sci-fi-screens.md §9's sketch) the way `skillDetail` does — no
 * new sentence, and no wording in a component.
 */

/** `10:04` — a session clock, never a duration in words. */
export function clockTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** `Session complete · 10:04` — copy deck (UX §9), verbatim. */
export function sessionComplete(elapsedMs: number): string {
  return `Session complete · ${clockTime(elapsedMs)}`;
}

/**
 * `Weakest: minor 6th up (4 of 9)` — the summary's well (UX §4.8). Sentence
 * case, the skill spelled the way its exercise spells it.
 */
export function sessionWeakest(
  label: string,
  correct: number,
  attempts: number,
): string {
  return `Weakest: ${label} (${correct} of ${attempts})`;
}

/**
 * `+6%` / `−2%` / `±0%` — a mastery delta. The sign is the signal and the
 * triangle beside it repeats it, so neither is ever carried by colour alone
 * (UX §4.8). The minus is U+2212, as the spec's sketch prints it.
 */
export function masteryDelta(deltaPercent: number): string {
  if (deltaPercent > 0) return `+${deltaPercent}%`;
  if (deltaPercent < 0) return `−${Math.abs(deltaPercent)}%`;
  return '±0%';
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
 * `in 3 h` / `now` — how far off the next review is, at the same granularity
 * as `timeAgo` (UX §6.2 asks for `due in 3 h`, not a clock time). A schedule
 * that has come round reads `now`, because "in 0 min" is not an English
 * sentence and an overdue skill is asking *now*.
 */
export function timeUntil(ts: number, now: number): string {
  const delta = ts - now;
  if (delta <= 0) return 'now';
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return 'in under a minute';
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} h`;
  return `in ${Math.round(hours / 24)} d`;
}

/**
 * A practised skill's detail line — UX §6.2 verbatim, and since slice 9a with
 * the spec's `due in 3 h` clause it was missing while nothing scheduled
 * anything (ADR 0002 §3):
 * `12 attempts · 67% · last seen 2 h ago · due in 3 h`.
 *
 * `dueAt` is optional and `null`-able: a skill with no schedule yet (an
 * imported record, slice 5b) simply has no clause, rather than a made-up one.
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
  /** Epoch ms of the next review; `0`/`null`/absent = unscheduled. */
  dueAt?: number | null;
}): string {
  const plural = input.attempts === 1 ? 'attempt' : 'attempts';
  const parts = [
    `${input.attempts} ${plural}`,
    `${input.accuracyPercent}%`,
    `last seen ${timeAgo(input.lastSeenAt, input.now)}`,
  ];
  if (input.dueAt) {
    parts.push(`due ${timeUntil(input.dueAt, input.now)}`);
  }
  return parts.join(' · ');
}
