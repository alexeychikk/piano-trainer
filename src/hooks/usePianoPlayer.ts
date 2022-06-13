import { useAsync } from 'react-use';
import Soundfont from 'soundfont-player';
import { useMidi } from '@src/components/providers/MidiProvider';

export const audioContext = new AudioContext();

export function usePianoPlayer() {
  const { inputSettings } = useMidi();
  const player = useAsync(
    () =>
      Soundfont.instrument(
        audioContext,
        inputSettings?.instrument || 'acoustic_grand_piano',
        {
          format: 'mp3',
        },
      ),
    [inputSettings?.instrument],
  );
  return { player, audioContext };
}
