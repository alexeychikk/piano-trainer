/**
 * Which played notes the app sounds (owner request, 2026-10-06): a user at an
 * acoustic or digital piano may want to hear only the instrument, so the echo
 * of notes from a **MIDI port** can be switched off. The on-screen keys and
 * the computer keys always sound — they make no sound of their own — and the
 * app's own playback (prompts, replays, reveals, the metronome) never comes
 * through here at all, so it is untouched.
 *
 * Pure and source-aware on purpose: this is the one place downstream of
 * `midiInput` that asks where a note came from, and it only decides *sound*.
 * Highlighting, grading and capture read the same events unchanged.
 *
 * It only needs a sink with `noteOn`/`noteOff` (the engine, in the root
 * layout), so the `midi` layer still does not import `audio`.
 */

import type { NoteEvent, NoteSource } from './events';
import type { Midi } from '$lib/theory';

export interface NoteSink {
  noteOn(midi: Midi, velocity: number): void;
  noteOff(midi: Midi): void;
}

/** Whether a note-on from `source` is sounded by the app. */
export function soundsInApp(
  source: NoteSource,
  playMidiNotes: boolean,
): boolean {
  return source !== 'midi' || playMidiNotes;
}

/**
 * Route note events into `sink`, swallowing the note-ons `soundsInApp` rejects
 * — and the note-off of each swallowed pitch, so a silent MIDI key released
 * while the same pitch is held on screen cannot cut that voice. Every other
 * note-off goes through, which is what lets a note that was sounding when the
 * setting was turned off still be released (and `releaseAll()`'s offs, which
 * are all stamped `midi`, release keys of any source).
 *
 * `playMidiNotes` is read per note-on, so the setting applies to the very next
 * key without re-wiring anything.
 *
 * `isControl` names note-ons that are controls rather than notes — the
 * drill's next-question key (`next-key.ts`) while a drill is on screen. They
 * are never sounded, whatever the setting, and their release is swallowed the
 * same way.
 */
export function createNoteEcho(
  sink: NoteSink,
  playMidiNotes: () => boolean,
  isControl: (midi: Midi, source: NoteSource) => boolean = () => false,
): (event: NoteEvent) => void {
  const silenced = new Set<Midi>();
  return (event) => {
    if (event.type === 'on') {
      if (
        !isControl(event.midi, event.source) &&
        soundsInApp(event.source, playMidiNotes())
      ) {
        silenced.delete(event.midi);
        sink.noteOn(event.midi, event.velocity);
      } else {
        silenced.add(event.midi);
      }
      return;
    }
    if (silenced.delete(event.midi)) return;
    sink.noteOff(event.midi);
  };
}
