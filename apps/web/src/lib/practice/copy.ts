/**
 * Practice-data wording, in one place — the same rule as `$lib/midi/status.ts`
 * and `$lib/audio/status.ts`: copy lives in a module, never in a component.
 * Every line here is the copy deck's (UX spec §9), verbatim.
 */
export const PRACTICE_COPY = {
  /** A failed write. Practice continues; the banner says what was lost. */
  storageFailed:
    'Could not save this attempt — practice continues, but progress may be lost.',
  /** `/progress` with nothing recorded yet. */
  empty: 'No attempts yet. Practice something and this fills up.',
} as const;
