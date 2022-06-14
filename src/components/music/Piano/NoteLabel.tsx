import { Note } from '@tonaljs/tonal';
import clsx from 'clsx';
import React from 'react';
import type { NoteLabelProps } from 'react-piano';
import { useStyles } from './Piano.styles';

const NoteLabelBase: React.FC<
  NoteLabelProps & { isHighlighted?: boolean; isNotationVisible?: boolean }
> = (props) => {
  const classes = useStyles();
  const note = Note.fromMidi(props.midiNumber);
  const octave = Note.octave(note);
  const pitch = Note.pitchClass(note);

  return (
    <div
      className={clsx(
        classes.noteLabel,
        props.isAccidental && classes.noteAccidental,
        props.isActive && classes.noteActive,
        props.isHighlighted && classes.noteHighlighted,
        pitch === 'C' && classes.pitchC,
      )}
    >
      {props.isNotationVisible && (
        <>
          <div className={classes.labelSpacing} />
          <div className={classes.pitch}>{pitch}</div>
          <div className={classes.octave}>{octave}</div>
        </>
      )}
    </div>
  );
};

export const NoteLabel = React.memo(NoteLabelBase);
