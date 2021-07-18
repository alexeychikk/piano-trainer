import { Box } from '@material-ui/core';
import React from 'react';
import { MidiDevices } from '@src/components/music/MidiDevices';
import { useStyles } from './Chords.styles';

export const Chords: React.FC = () => {
  const classes = useStyles();

  return (
    <Box className={classes.chords}>
      <MidiDevices />
    </Box>
  );
};

export default Chords;
