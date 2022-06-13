import { useAsync } from 'react-use';
import Soundfont from 'soundfont-player';

export const audioContext = new AudioContext();

export function usePianoPlayer(
  instrument: Soundfont.InstrumentName = 'electric_guitar_jazz',
) {
  const player = useAsync(
    () =>
      Soundfont.instrument(audioContext, instrument, {
        format: 'mp3',
      }),
    [],
  );
  return { player, audioContext };
}
