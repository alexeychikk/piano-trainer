import { Box, Button, Typography } from '@material-ui/core';
import { Note } from '@tonaljs/tonal';
import { range } from 'lodash-es';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useKeyPressEvent } from 'react-use';
import { MidiPiano } from '@src/components/music/MidiPiano';
import { useMidi } from '@src/components/providers/MidiProvider';
import { useActiveNotes, usePianoPlayer, useUniqueValue } from '@src/hooks';
import { getExactRandomNote } from '@src/utils';
import { useStyles } from './EarTraining.styles';

export const EarTraining: React.FC = () => {
  const classes = useStyles();
  const { isInputReady, inputSettings } = useMidi();
  const activeNotes = useActiveNotes();
  const { player, audioContext } = usePianoPlayer();
  const isPlayerLoading = isInputReady && player.loading;

  const [noteFrom, setNoteFrom] = useState<string>('C3');
  const [noteTo, setNoteTo] = useState<string>('C5');
  const [correctNotePressed, setCorrectNotePressed] = useState<boolean>(false);

  const [randomNote, getNewRandomNote] = useUniqueValue(() =>
    getExactRandomNote(noteFrom, noteTo),
  );

  const highlightedNotes = useMemo(
    () => range(Note.midi(noteFrom)!, Note.midi(noteTo)! + 1),
    [noteFrom, noteTo],
  );

  const playNote = () => {
    if (!player.value) return;
    player.value.play(randomNote, audioContext.currentTime, {
      duration: 1,
      gain: inputSettings?.volume || 1,
    });
  };
  const handlePlayNoteClick = useCallback(playNote, [player.value, randomNote]);

  const getNewNote = () => {
    setCorrectNotePressed(false);
    getNewRandomNote();
  };
  const handleNewNoteClick = useCallback(getNewNote, [randomNote]);

  useEffect(() => {
    if (!isInputReady) return;
    playNote();
  }, [isInputReady, player.value, randomNote]);

  useEffect(() => {
    if (correctNotePressed || activeNotes.length !== 1) return;
    const [activeNote] = activeNotes;
    if (activeNote === randomNote) {
      setCorrectNotePressed(true);
    }
  }, [correctNotePressed, activeNotes, randomNote]);

  useEffect(() => {
    if (!correctNotePressed || activeNotes.length !== 1) return;
    const [activeNote] = activeNotes;
    if (
      activeNote !== randomNote &&
      (activeNote === noteFrom || activeNote === noteTo)
    ) {
      getNewNote();
    }
  }, [correctNotePressed, activeNotes, noteFrom]);

  useKeyPressEvent(' ', (event) => {
    event.preventDefault();
    if (correctNotePressed) return getNewNote();
    playNote();
  });

  return (
    <Box className={classes.earTraining}>
      <MidiPiano highlightedNotes={highlightedNotes} />
      {isInputReady && isPlayerLoading && (
        <Typography variant="h4">Loading player...</Typography>
      )}
      {isInputReady && !isPlayerLoading && (
        <>
          <Typography variant="h5">
            From:{' '}
            <Typography display="inline" variant="inherit" color="primary">
              {noteFrom}
            </Typography>
          </Typography>
          <Typography variant="h5">
            To:{' '}
            <Typography display="inline" variant="inherit" color="primary">
              {noteTo}
            </Typography>
          </Typography>
          <Typography variant="h5">
            Current: {correctNotePressed ? randomNote : '?'}
          </Typography>
          <div className={classes.buttonsWrapper}>
            <Button
              className={classes.newNoteButton}
              color="primary"
              variant="contained"
              onClick={handlePlayNoteClick}
            >
              Play Note
            </Button>
            <Button
              className={classes.newNoteButton}
              color="primary"
              variant="outlined"
              onClick={handleNewNoteClick}
            >
              New Note
            </Button>
          </div>
        </>
      )}
    </Box>
  );
};

export default EarTraining;
