/**
 * The piano's "next question" key (owner request, 2026-10-06): a correct
 * answer no longer advances the drill by itself — the user plays on freely,
 * and the lowest C of an 88-key piano moves on. It is a **control**, not a
 * note: while a drill is on screen it is never graded, never part of an
 * answer and never sounded by the app.
 *
 * Only a MIDI port's C1 is the control. The on-screen and computer keys have
 * `Enter` / `Space` / the `Next` button a hand-width away, and an on-screen C1
 * stays an ordinary key.
 *
 * Pure, plus one counter: the runner frame reserves the key while it is
 * mounted, and the layout's echo (`echo.ts`) asks whether it is reserved — so
 * Free Play and Settings, which reserve nothing, still sound a low C.
 */

import type { NoteSource } from './events';
import { midiToName, type Midi } from '$lib/theory';

/** C1 in scientific pitch (C4 = 60): the lowest C on an 88-key piano. */
export const NEXT_QUESTION_MIDI_NOTE: Midi = 24;

/** The key's name in copy (`C1`), derived so the hint cannot drift from it. */
export const NEXT_QUESTION_KEY_NAME = midiToName(NEXT_QUESTION_MIDI_NOTE);

/**
 * The hint the success state, the reveal and the shortcut bar carry
 * (core-practice-ux.md §4.2, §9).
 */
export const NEXT_QUESTION_HINT = `Press ${NEXT_QUESTION_KEY_NAME} or Enter for next`;

/** Whether a note-on is the next-question control (a MIDI port's C1). */
export function isNextQuestionNote(midi: Midi, source: NoteSource): boolean {
  return source === 'midi' && midi === NEXT_QUESTION_MIDI_NOTE;
}

let reservations = 0;

/**
 * Claim the control for as long as a drill is on screen. Returns the release;
 * calling it twice releases once, so an unmount that runs twice cannot free
 * another screen's claim.
 */
export function reserveNextQuestionNote(): () => void {
  reservations += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    reservations -= 1;
  };
}

/** Whether this note-on is the control *and* a drill has claimed it. */
export function isReservedNextQuestionNote(
  midi: Midi,
  source: NoteSource,
): boolean {
  return reservations > 0 && isNextQuestionNote(midi, source);
}
