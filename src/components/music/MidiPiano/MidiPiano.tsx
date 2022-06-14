import { Box, IconButton, Paper, Tooltip } from '@material-ui/core';
import { MusicNote as MusicNoteIcon } from '@material-ui/icons';
import clsx from 'clsx';
import React, { useCallback, useEffect, useState } from 'react';
import { useDebounce } from 'react-use';
import type { InstrumentName } from 'soundfont-player';
import { InstrumentSelect } from '@src/components/music/InstrumentSelect';
import { MidiDevices } from '@src/components/music/MidiDevices';
import { MidiWizard } from '@src/components/music/MidiWizard';
import type { PianoProps } from '@src/components/music/Piano';
import { Piano } from '@src/components/music/Piano';
import { VolumeSlider } from '@src/components/music/VolumeSlider';
import { useMidi } from '@src/components/providers/MidiProvider';
import { useStyles } from './MidiPiano.styles';

export interface MidiPianoProps extends Pick<PianoProps, 'highlightedNotes'> {
  className?: string;
  children?: React.ReactNode;
}

const MidiPianoBase: React.FC<MidiPianoProps> = (props) => {
  const classes = useStyles();
  const { connectedInput, isInputReady, inputSettings, updateInputSettings } =
    useMidi();
  const [volume, setVolume] = useState(inputSettings?.volume || 0);

  useEffect(() => {
    if (inputSettings?.volume === undefined || volume !== 0) return;
    setVolume(inputSettings.volume);
  }, [inputSettings?.volume]);

  const handleInstrumentChange = useCallback(
    async (instrument: InstrumentName) => {
      await updateInputSettings({ instrument });
    },
    [connectedInput, inputSettings],
  );

  const handleNoteButtonClick = useCallback(async () => {
    await updateInputSettings({
      noteLabelsVisible: !inputSettings?.noteLabelsVisible,
    });
  }, [connectedInput, inputSettings]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
  }, []);

  useDebounce(
    async () => {
      await updateInputSettings({ volume });
    },
    500,
    [volume],
  );

  return (
    <Box
      className={clsx(
        classes.midiPiano,
        isInputReady && classes.inputReady,
        props.className,
      )}
    >
      <MidiDevices className={classes.devices} />
      {!!(connectedInput && !isInputReady) && <MidiWizard />}
      {isInputReady && (
        <>
          <Paper className={classes.pianoActions}>
            <Tooltip
              title={
                inputSettings!.noteLabelsVisible
                  ? 'Hide note labels'
                  : 'Show note labels'
              }
            >
              <IconButton size="small" onClick={handleNoteButtonClick}>
                <MusicNoteIcon
                  color={
                    inputSettings!.noteLabelsVisible ? undefined : 'disabled'
                  }
                />
              </IconButton>
            </Tooltip>

            <InstrumentSelect
              className={classes.instrumentSelect}
              instrument={inputSettings!.instrument}
              onChange={handleInstrumentChange}
            />

            <VolumeSlider
              className={classes.volumeSlider}
              value={volume}
              onChange={handleVolumeChange}
            />
          </Paper>

          <Piano
            className={classes.piano}
            highlightedNotes={props.highlightedNotes}
            noteLabelsVisible={inputSettings!.noteLabelsVisible}
            volume={volume}
          />
        </>
      )}
      {isInputReady && props.children}
    </Box>
  );
};

export const MidiPiano = React.memo(MidiPianoBase);
