import { Note } from '@tonaljs/tonal';
import { useMemo } from 'react';
import { useMidi } from '@src/components/providers/MidiProvider';

export function useActiveNotes(): string[] {
  const { midiNotes } = useMidi();
  return useMemo(
    () => Note.sortedNames(midiNotes.map(Note.fromMidi)),
    [midiNotes],
  );
}
