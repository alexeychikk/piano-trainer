import { useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import { useMidi } from '@src/components/providers/MidiProvider';
import type { MidiRange } from '@src/services/Midi/shared';
import { useActiveMidiNotes } from './useActiveMidiNotes';

export function useMidiWizard(): Partial<MidiRange> {
  const { connectedInput, isInputReady, inputSettings, updateInputSettings } =
    useMidi();
  const midiNotes = useActiveMidiNotes();
  const [firstNote, setFirstNote] = useState<number>();

  useAsync(async () => {
    if (!connectedInput || isInputReady) return;
    const [pressedNote] = midiNotes;
    if (!pressedNote) return;

    if (!firstNote) return setFirstNote(pressedNote);
    if (firstNote === pressedNote) return;

    const newMidiRange = { first: firstNote, last: pressedNote };
    await updateInputSettings({
      name: connectedInput,
      midiRange: newMidiRange,
      noteLabelsVisible: true,
      instrument: 'acoustic_grand_piano',
      volume: 0,
    });
  }, [connectedInput, isInputReady, midiNotes, firstNote]);

  return useMemo(
    () => ({ ...inputSettings?.midiRange, first: firstNote }),
    [firstNote, inputSettings],
  );
}
