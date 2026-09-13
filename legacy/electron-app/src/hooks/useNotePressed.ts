import { noop } from 'lodash-es';
import { useEffect } from 'react';
import { usePrevious } from 'react-use';
import { useMidi } from '@src/components/providers/MidiProvider';

export function useNotePressed({
  onDown = noop,
  onUp = noop,
  notesOnly = [],
}: {
  onDown?: (midi: number) => void;
  onUp?: (midi: number) => void;
  notesOnly?: number[];
}) {
  const { midiNotes } = useMidi();
  const prevMidiNotes = usePrevious(midiNotes);

  useEffect(() => {
    if (notesOnly.length) {
      notesOnly.forEach((note) => {
        if (midiNotes.includes(note) && !prevMidiNotes?.includes(note)) {
          onDown(note);
        } else if (!midiNotes.includes(note) && prevMidiNotes?.includes(note)) {
          onUp(note);
        }
      });
    } else {
      if (midiNotes.length && !prevMidiNotes?.length) {
        onDown(midiNotes[0]);
      } else if (!midiNotes.length && prevMidiNotes?.length) {
        onUp(midiNotes[0]);
      }
    }
  }, [midiNotes, prevMidiNotes]);
}
