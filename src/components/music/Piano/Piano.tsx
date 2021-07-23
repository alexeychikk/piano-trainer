import { Box, Typography } from '@material-ui/core';
import clsx from 'clsx';
import React, { useCallback } from 'react';
import type { NoteLabelProps } from 'react-piano';
import { Piano as ReactPiano } from 'react-piano';
import 'react-piano/dist/styles.css';
import { useMidi } from '@src/components/providers/MidiProvider';
import { useActiveMidiNotes } from '@src/hooks';
import { NoteLabel } from './NoteLabel';
import { useStyles } from './Piano.styles';

export interface PianoProps {
  className?: string;
}

const noopFn = () => undefined;

const PianoBase: React.FC<PianoProps> = (props) => {
  const classes = useStyles();
  const { isInputReady, midiRange } = useMidi();
  const midiNotes = useActiveMidiNotes();

  const renderNoteLabel = useCallback((labelProps: NoteLabelProps) => {
    if (!labelProps.isActive) return null;
    return <NoteLabel {...labelProps} />;
  }, []);

  return (
    <Box className={clsx(classes.piano, props.className)}>
      {!isInputReady && (
        <Typography variant="subtitle1">
          Midi keyboard is not configured
        </Typography>
      )}
      {isInputReady && (
        <ReactPiano
          noteRange={midiRange!}
          playNote={noopFn}
          stopNote={noopFn}
          activeNotes={midiNotes}
          renderNoteLabel={renderNoteLabel}
        />
      )}
    </Box>
  );
};

export const Piano = React.memo(PianoBase);
