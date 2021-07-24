import { useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import { useMidi } from '@src/components/providers/MidiProvider';
import type { MidiRange } from '@src/services/Midi/shared';
import { settingsService } from '@src/services/render';
import { useActiveMidiNotes } from './useActiveMidiNotes';

export function useMidiWizard(): Partial<MidiRange> {
  const { connectedInput, isInputReady, setMidiRange, midiRange } = useMidi();
  const midiNotes = useActiveMidiNotes();
  const [firstNote, setFirstNote] = useState<number>();

  useAsync(async () => {
    if (!connectedInput || isInputReady) return;
    const [pressedNote] = midiNotes;
    if (!pressedNote) return;

    if (!firstNote) return setFirstNote(pressedNote);
    if (firstNote === pressedNote) return;

    const newMidiRange = { first: firstNote, last: pressedNote };
    setMidiRange(newMidiRange);
    await settingsService.invoke.setInputSettings(connectedInput, {
      name: connectedInput,
      midiRange: newMidiRange,
    });
  }, [connectedInput, isInputReady, midiNotes, firstNote]);

  return useMemo(
    () => ({ ...midiRange, first: firstNote }),
    [firstNote, midiRange],
  );
}
