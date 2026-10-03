/**
 * What the feedback slot says (UX spec §4.2 states and the §9 copy deck) and
 * what a screen reader hears (§8.4). Pure, so the wording lives in one place
 * and is tested — the runner and the exercise never invent copy.
 */

export type Outcome = 'correct' | 'wrong' | 'skipped';

export interface FeedbackLines {
  /** Never colour alone (§8.1): every state carries a glyph. */
  glyph: string;
  /** 32 px line: `Correct` or the answer's name. */
  headline: string;
  /** The second line, including the "Space to continue" prompt. */
  detail: string;
  tone: 'success' | 'danger' | 'hint';
}

export interface FeedbackInput {
  outcome: Outcome;
  /** The name of the correct answer, e.g. `C4` or `Minor 6th`. */
  expectedLabel: string;
  /** The exercise's one-line explanation of a miss, if it has one. */
  detail?: string;
  /** Streak *after* this answer. */
  streak: number;
}

/** The streak at which the drill speeds up and says so (§4.3, §9). */
export const STREAK_CALLOUT = 5;

const CONTINUE = 'Space to continue';

export function feedbackLines({
  outcome,
  expectedLabel,
  detail,
  streak,
}: FeedbackInput): FeedbackLines {
  if (outcome === 'correct') {
    return {
      glyph: '✓',
      headline:
        streak >= STREAK_CALLOUT ? `Correct · ${streak} in a row` : 'Correct',
      detail: expectedLabel,
      tone: 'success',
    };
  }
  if (outcome === 'skipped') {
    return {
      glyph: '⤳',
      headline: expectedLabel,
      detail: `Skipped · ${CONTINUE}`,
      tone: 'hint',
    };
  }
  return {
    glyph: '✗',
    headline: expectedLabel,
    detail: detail ? `${detail} · ${CONTINUE}` : CONTINUE,
    tone: 'danger',
  };
}

/**
 * The one polite announcement per answer (§8.4). Spoken, not glyphed: a screen
 * reader gets the same information the sighted user reads.
 */
export function feedbackAnnouncement({
  outcome,
  expectedLabel,
  detail,
}: Omit<FeedbackInput, 'streak'>): string {
  if (outcome === 'correct') return `Correct. ${expectedLabel}.`;
  const played = detail ? `${detail}. ` : '';
  if (outcome === 'skipped') return `Skipped. The answer was ${expectedLabel}.`;
  return `Incorrect. ${played}The answer was ${expectedLabel}.`;
}

/**
 * What the prompt well says when an exercise has nothing it can build under
 * its settings on this keyboard (`NothingToAskError`, `coverage.ts`) — today
 * only the ii-V-I on a keyboard narrower than its cadence. Generic on purpose:
 * the runner never learns which exercise, so the copy names the remedy, not
 * the drill. The settings link is the way out (the range lives in Settings →
 * Practice).
 */
export const NOTHING_TO_ASK = {
  title: 'This drill needs a wider keyboard',
  detail: 'Widen the keyboard range in Settings',
  action: 'Open Settings',
} as const;
