/**
 * Source-agnostic note events (ADR 0001 §3). Every input source — the MIDI
 * port, the on-screen keyboard, the computer keys — produces the *same* event,
 * so nothing downstream can tell them apart.
 *
 * Pure: message decoding and the held-note transitions live here so they are
 * testable without hardware or a browser.
 */

import type { Midi } from '$lib/theory';

export type NoteSource = 'midi' | 'onscreen' | 'computer-keyboard';

export type NoteEvent =
  | { type: 'on'; midi: Midi; velocity: number; at: number; source: NoteSource }
  | { type: 'off'; midi: Midi; at: number; source: NoteSource };

export interface HeldNote {
  velocity: number;
  /** `performance.now()` of the note-on that started this hold. */
  at: number;
}

export type HeldNotes = ReadonlyMap<Midi, HeldNote>;

/** Default velocity for sources that have no touch sensitivity (UX §5.4). */
export const DEFAULT_VELOCITY = 80;

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

/**
 * Decode one MIDI message into a note event, or `null` when it is not a note
 * message. A note-on with velocity 0 is a note-off — real pianos send those.
 */
export function parseMidiMessage(
  data: Uint8Array | readonly number[],
  at: number,
): NoteEvent | null {
  if (data.length < 3) return null;
  const [status, midi, velocity] = data;
  if (midi < 0 || midi > 127) return null;
  const command = status & 0xf0;
  if (command === NOTE_ON && velocity > 0) {
    return { type: 'on', midi, velocity, at, source: 'midi' };
  }
  if (command === NOTE_OFF || (command === NOTE_ON && velocity === 0)) {
    return { type: 'off', midi, at, source: 'midi' };
  }
  return null;
}

/**
 * Apply an event to the held-note set. Returns a **new** map when something
 * changed and the same map when nothing did, so reactive readers only update
 * on real changes.
 */
export function applyNoteEvent(held: HeldNotes, event: NoteEvent): HeldNotes {
  if (event.type === 'on') {
    const next = new Map(held);
    // Re-pressing a held key restarts the hold (a repeated note-on without a
    // note-off happens with sustain pedals and sloppy re-triggers).
    next.set(event.midi, { velocity: event.velocity, at: event.at });
    return next;
  }
  if (!held.has(event.midi)) return held;
  const next = new Map(held);
  next.delete(event.midi);
  return next;
}

/** Held notes, ascending — the order exercises and chord detection expect. */
export function heldMidiNotes(held: HeldNotes): Midi[] {
  return [...held.keys()].sort((a, b) => a - b);
}
