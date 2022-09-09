import { useAsync } from 'react-use';
import Soundfont from 'soundfont-player';
import { useMidi } from '@src/components/providers/MidiProvider';

export const audioContext = new AudioContext();

const instrumentsCache: Record<string, Soundfont.Player> = {};

export function usePianoPlayer() {
  const { inputSettings } = useMidi();

  const player = useAsync(async () => {
    const instrumentName = inputSettings?.instrument || 'acoustic_grand_piano';
    let instrument = instrumentsCache[instrumentName];

    if (!instrument) {
      instrument = await Soundfont.instrument(
        audioContext,
        inputSettings?.instrument || 'acoustic_grand_piano',
        { format: 'mp3' },
      );
      instrumentsCache[instrumentName] = instrument;
    }

    return instrument;
  }, [inputSettings?.instrument]);

  return { player, audioContext };
}
