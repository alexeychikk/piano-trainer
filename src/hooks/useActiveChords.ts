import { Chord } from '@tonaljs/tonal';
import { useMemo } from 'react';
import { useActiveNotes } from './useActiveNotes';

export function useActiveChords(): string[] {
  const notes = useActiveNotes();
  return useMemo(() => Chord.detect(notes), [notes]);
}
