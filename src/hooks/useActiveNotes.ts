import { Note } from '@tonaljs/tonal';
import { useMemo } from 'react';
import { useActiveMidiNotes } from './useActiveMidiNotes';

export function useActiveNotes(): string[] {
  const midiNotes = useActiveMidiNotes();
  return useMemo(
    () => Note.sortedNames(midiNotes.map(Note.fromMidi)),
    [midiNotes],
  );
}
