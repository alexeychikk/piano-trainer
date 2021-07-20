import { useEffect, useMemo, useState } from 'react';
import type { MidiRange } from '@src/components/providers/MidiProvider';
import { useMidi } from '@src/components/providers/MidiProvider';
import { useActiveMidiNotes } from './useActiveMidiNotes';

export function useMidiWizard(): Partial<MidiRange> {
  const { connectedInput, isInputReady, setMidiRange, midiRange } = useMidi();
  const midiNotes = useActiveMidiNotes();
  const [firstNote, setFirstNote] = useState<number>();

  useEffect(() => {
    if (!connectedInput || isInputReady) return;
    const [pressedNote] = midiNotes;
    if (!pressedNote) return;

    if (!firstNote) return setFirstNote(pressedNote);
    if (firstNote === pressedNote) return;
    setMidiRange({ first: firstNote, last: pressedNote });
  }, [connectedInput, isInputReady, midiNotes, firstNote]);

  return useMemo(
    () => ({ ...midiRange, first: firstNote }),
    [firstNote, midiRange],
  );
}
