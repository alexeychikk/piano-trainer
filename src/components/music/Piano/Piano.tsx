import { Box, Typography } from '@material-ui/core';
import clsx from 'clsx';
import { noop } from 'lodash-es';
import React, { useCallback, useState } from 'react';
import type { NoteLabelProps } from 'react-piano';
import { Piano as ReactPiano } from 'react-piano';
import 'react-piano/dist/styles.css';
import type { Player } from 'soundfont-player';
import { useMidi } from '@src/components/providers/MidiProvider';
import { useActiveMidiNotes, usePianoPlayer } from '@src/hooks';
import { NoteLabel } from './NoteLabel';
import { useStyles } from './Piano.styles';

export interface PianoProps {
  className?: string;
  highlightedNotes?: number[];
  noteLabelsVisible?: boolean;
  usePianoPlayer?: boolean;
}

const PianoBase: React.FC<PianoProps> = (props) => {
  const classes = useStyles();
  const { isInputReady, inputSettings } = useMidi();
  const midiNotes = useActiveMidiNotes();
  const { player, audioContext } = usePianoPlayer();
  const [playedNotes, setPlayedNotes] = useState<Record<number, Player>>({});

  const renderNoteLabel = useCallback(
    (labelProps: NoteLabelProps) => {
      return (
        <NoteLabel
          {...labelProps}
          isHighlighted={props.highlightedNotes?.includes(
            labelProps.midiNumber,
          )}
        />
      );
    },
    [props.highlightedNotes],
  );

  const playNote = useCallback(
    (midi: number) => {
      if (!player.value) return;
      // wrong typings in soundfont-player, it accepts midi number as well
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const notePlayer = player.value.play(midi as any);
      setPlayedNotes((notes) => ({ ...notes, [midi]: notePlayer }));
    },
    [player.value, playedNotes],
  );

  const stopNote = useCallback(
    (midi: number) => {
      if (!player.value) return;
      playedNotes[midi].stop(audioContext.currentTime);
      setPlayedNotes(({ [midi]: _, ...notes }) => notes);
    },
    [player.value, playedNotes],
  );

  const maxWidth = Math.max(
    400,
    ((inputSettings?.midiRange.last || 0) -
      (inputSettings?.midiRange.first || 0)) *
      25,
  );

  return (
    <Box className={clsx(classes.piano, props.className)} maxWidth={maxWidth}>
      {!isInputReady && (
        <Typography variant="subtitle1">
          Midi keyboard is not configured
        </Typography>
      )}
      {props.usePianoPlayer && player.loading && (
        <Typography variant="subtitle1">Loading sound player...</Typography>
      )}
      {isInputReady && (!props.usePianoPlayer || !player.loading) && (
        <ReactPiano
          noteRange={inputSettings!.midiRange}
          playNote={props.usePianoPlayer ? playNote : noop}
          stopNote={props.usePianoPlayer ? stopNote : noop}
          activeNotes={midiNotes}
          renderNoteLabel={
            props.noteLabelsVisible ? renderNoteLabel : undefined
          }
        />
      )}
    </Box>
  );
};

export const Piano = React.memo(PianoBase);
