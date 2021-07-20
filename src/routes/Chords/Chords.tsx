import { Box, Typography } from '@material-ui/core';
import React from 'react';
import { MidiDevices } from '@src/components/music/MidiDevices';
import { MidiWizard } from '@src/components/music/MidiWizard';
import { Piano } from '@src/components/music/Piano';
import { useMidi } from '@src/components/providers/MidiProvider';
import { useActiveChords, useActiveNotes } from '@src/hooks';
import { useStyles } from './Chords.styles';

export const Chords: React.FC = () => {
  const classes = useStyles();
  const { connectedInput, isInputReady } = useMidi();
  const chords = useActiveChords();
  const notes = useActiveNotes();

  return (
    <Box className={classes.chords}>
      <MidiDevices className={classes.devices} />
      {!!(connectedInput && !isInputReady) && <MidiWizard />}
      {isInputReady && <Piano className={classes.piano} />}
      {isInputReady && (
        <>
          <Typography variant="h2">Chords: {chords.join('; ')}</Typography>
          <Typography variant="h4">Notes: {notes.join(', ')}</Typography>
        </>
      )}
    </Box>
  );
};

export default Chords;
