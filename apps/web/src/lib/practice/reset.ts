/**
 * The inline confirmation in front of a destructive data change
 * (sci-fi-screens.md §8.5): `Reset all practice data` reveals a §5.11 field
 * labelled `Type RESET to confirm`, the danger button stays disabled until the
 * field matches, and a ghost `Cancel` closes it. **No `confirm()`, no dialog,
 * ever** (UX §2.3) — which is exactly why the behaviour lives here, as a pure
 * reducer, instead of in the platform.
 *
 * Two things it guards, beyond "the user typed the word":
 * - **Cancelling changes nothing at all.** `cancel` from `confirming` returns
 *   to `idle` without ever reaching the store, and re-asking always reopens
 *   with an empty field, so a stale `RESET` cannot arm the next question.
 * - **A wipe in flight cannot be called back.** `working` ignores `cancel`:
 *   the transaction is already on the write queue and pretending otherwise
 *   would be a lie about what is on disk.
 *
 * Pure and unit-tested, the same rule as `$lib/audio/tempo-field.ts`: no DOM,
 * no store, no copy (the wording lives in `./copy.ts`).
 */

/** The word the field must match. Uppercase is how the label spells it. */
export const RESET_CONFIRM_WORD = 'RESET';

/**
 * What is being confirmed. Both are "replace the log with nothing", so both
 * take the same affordance:
 * - `reset` — the §8.5 button.
 * - `empty-import` — a *valid* file that carries no attempts and no skills,
 *   dropped on a log that has some. `parsePracticeFile` cannot refuse it (an
 *   honest export of an empty log is a legitimate file, and `offered > 0 &&
 *   parsed === 0` is deliberately the only guard), so the wipe used to happen
 *   on a file pick alone — QA's slice-5b observation. It is the same
 *   destruction as the button, so it gets the same question.
 */
export type ConfirmTarget = 'reset' | 'empty-import';

export type ConfirmState =
  | { phase: 'idle' }
  | { phase: 'confirming'; target: ConfirmTarget; typed: string }
  | { phase: 'working'; target: ConfirmTarget };

export type ConfirmEvent =
  /** The destructive control was pressed, or a wiping file was picked. */
  | { type: 'ask'; target: ConfirmTarget }
  | { type: 'type'; value: string }
  /** `Cancel`, or `Escape` in the field. */
  | { type: 'cancel' }
  | { type: 'confirm' }
  /** The store answered — persisted or not, the affordance closes. */
  | { type: 'settled' };

export const IDLE: ConfirmState = { phase: 'idle' };

/** True when the typed text arms the danger button. */
export function canConfirm(state: ConfirmState): boolean {
  return state.phase === 'confirming' && matchesConfirmWord(state.typed);
}

/**
 * Surrounding whitespace is not a decision, and neither is the shift key: what
 * makes this deliberate is typing five specific letters into a field that only
 * exists because the user asked for it. Being strict about the case would only
 * turn a decided user away from their own data.
 */
export function matchesConfirmWord(raw: string): boolean {
  return raw.trim().toUpperCase() === RESET_CONFIRM_WORD;
}

/** The state machine. Every unhandled pair is deliberately a no-op. */
export function confirmReducer(
  state: ConfirmState,
  event: ConfirmEvent,
): ConfirmState {
  switch (event.type) {
    case 'ask':
      // Re-asking always starts from an empty field — including while another
      // target is open, so the file picker cannot inherit the button's typing.
      return state.phase === 'working'
        ? state
        : { phase: 'confirming', target: event.target, typed: '' };
    case 'type':
      return state.phase === 'confirming'
        ? { ...state, typed: event.value }
        : state;
    case 'cancel':
      return state.phase === 'confirming' ? IDLE : state;
    case 'confirm':
      return canConfirm(state) && state.phase === 'confirming'
        ? { phase: 'working', target: state.target }
        : state;
    case 'settled':
      return IDLE;
  }
}
