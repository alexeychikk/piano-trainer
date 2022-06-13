import { Typography } from '@material-ui/core';
import React from 'react';
import { MidiPiano } from '@src/components/music/MidiPiano';
import { useActiveChords, useActiveNotes } from '@src/hooks';
import { useStyles } from './Chords.styles';

export const Chords: React.FC = () => {
  const classes = useStyles();
  const chords = useActiveChords();
  const notes = useActiveNotes();

  return (
    <MidiPiano className={classes.chords}>
      <Typography variant="h2">Chords: {chords.join('; ')}</Typography>
      <Typography variant="h4">Notes: {notes.join(', ')}</Typography>
    </MidiPiano>
  );
};

export default Chords;
