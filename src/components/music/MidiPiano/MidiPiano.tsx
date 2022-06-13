import { Box, IconButton, Paper, Tooltip } from '@material-ui/core';
import {
  MusicNote as MusicNoteIcon,
  VolumeMute as VolumeMuteIcon,
  VolumeUp as VolumeUpIcon,
} from '@material-ui/icons';
import clsx from 'clsx';
import React, { useCallback } from 'react';
import { MidiDevices } from '@src/components/music/MidiDevices';
import { MidiWizard } from '@src/components/music/MidiWizard';
import type { PianoProps } from '@src/components/music/Piano';
import { Piano } from '@src/components/music/Piano';
import { useMidi } from '@src/components/providers/MidiProvider';
import { useStyles } from './MidiPiano.styles';

export interface MidiPianoProps
  extends Pick<
    PianoProps,
    'highlightedNotes' | 'noteLabelsVisible' | 'usePianoPlayer'
  > {
  className?: string;
  children?: React.ReactNode;
}

const MidiPianoBase: React.FC<MidiPianoProps> = (props) => {
  const classes = useStyles();
  const { connectedInput, isInputReady, inputSettings, updateInputSettings } =
    useMidi();

  const handleNoteButtonClick = useCallback(async () => {
    await updateInputSettings({
      noteLabelsVisible: !inputSettings?.noteLabelsVisible,
    });
  }, [connectedInput, inputSettings]);

  const handleVolumeButtonClick = useCallback(async () => {
    await updateInputSettings({
      usePianoPlayer: !inputSettings?.usePianoPlayer,
    });
  }, [connectedInput, inputSettings]);

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
            <Tooltip title="Show/hide note labels">
              <IconButton size="small" onClick={handleNoteButtonClick}>
                <MusicNoteIcon
                  color={
                    inputSettings!.noteLabelsVisible ? undefined : 'disabled'
                  }
                />
              </IconButton>
            </Tooltip>

            <Tooltip title="Play piano sounds">
              <IconButton size="small" onClick={handleVolumeButtonClick}>
                {inputSettings!.usePianoPlayer ? (
                  <VolumeUpIcon />
                ) : (
                  <VolumeMuteIcon />
                )}
              </IconButton>
            </Tooltip>
          </Paper>

          <Piano
            className={classes.piano}
            highlightedNotes={props.highlightedNotes}
            noteLabelsVisible={inputSettings!.noteLabelsVisible}
            usePianoPlayer={inputSettings!.usePianoPlayer}
          />
        </>
      )}
      {isInputReady && props.children}
    </Box>
  );
};

export const MidiPiano = React.memo(MidiPianoBase);
