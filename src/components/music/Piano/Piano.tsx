import { Box, Typography } from '@material-ui/core';
import { Note } from '@tonaljs/tonal';
import clsx from 'clsx';
import React, { useMemo } from 'react';
import { Piano as ReactPiano } from 'react-piano';
import 'react-piano/dist/styles.css';
import { useMidi } from '@src/components/providers/MidiProvider';
import { useActiveMidiNotes } from '@src/hooks';
import { useStyles } from './Piano.styles';

export interface PianoProps {
  className?: string;
}

const noopFn = () => undefined;

const PianoBase: React.FC<PianoProps> = (props) => {
  const classes = useStyles();
  const { connectedInput } = useMidi();
  const midiNotes = useActiveMidiNotes();

  const noteRange = useMemo(
    () => ({ first: Note.midi('A0')!, last: Note.midi('C8')! }),
    [],
  );

  return (
    <Box className={clsx(classes.piano, props.className)}>
      {!connectedInput && (
        <Typography variant="subtitle1">Connect midi keyboard first</Typography>
      )}
      {connectedInput && (
        <ReactPiano
          noteRange={noteRange}
          playNote={noopFn}
          stopNote={noopFn}
          activeNotes={midiNotes}
        />
      )}
    </Box>
  );
};

export const Piano = React.memo(PianoBase);
