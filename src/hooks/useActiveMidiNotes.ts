import { useEffect, useState } from 'react';
import { useMidi } from '@src/components/providers/MidiProvider';
import { midiService } from '@src/services/render';

export function useActiveMidiNotes(): number[] {
  const { connectedInput } = useMidi();
  const [midiNotes, setMidiNotes] = useState<number[]>([]);

  useEffect(() => {
    if (!connectedInput) return;
    const { off } = midiService.onNoteDown(connectedInput, ({ note }) => {
      setMidiNotes((notes) => notes.concat(note));
    });
    return off;
  }, [connectedInput]);

  useEffect(() => {
    if (!connectedInput) return;
    const { off } = midiService.onNoteUp(connectedInput, ({ note }) => {
      setMidiNotes((notes) => notes.filter((n) => n !== note));
    });
    return off;
  }, [connectedInput]);

  return midiNotes;
}
