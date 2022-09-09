import { FormControl, InputLabel } from '@material-ui/core';
import { MenuItem, Select } from '@material-ui/core';
import { Note } from '@tonaljs/tonal';
import clsx from 'clsx';
import { clamp } from 'lodash-es';
import React from 'react';
import { useToggle } from 'react-use';
import { useMidi } from '@src/components/providers/MidiProvider';
import { useNotePressed } from '@src/hooks';
import { useStyles } from './NoteSelect.styles';

export interface NoteSelectProps {
  className?: string;
  id?: string;
  label?: React.ReactNode;
  noteFrom?: number;
  noteTo?: number;
  value: number;
  onChange: (midiNote: number) => void;
}

const NoteSelectBase: React.FC<NoteSelectProps> = (props) => {
  const classes = useStyles();
  const { inputSettings } = useMidi();
  const [isSelectOpened, toggleSelect] = useToggle(false);

  const id = props.id || 'note-select';
  const { first, last } = inputSettings!.midiRange;
  const noteFrom = props.noteFrom ?? first;
  const noteTo = props.noteTo ?? last;

  useNotePressed({
    onDown: (midi) => {
      if (!isSelectOpened) return;
      const newValue = clamp(midi, noteFrom, noteTo);
      props.onChange(newValue);
      toggleSelect(false);
    },
  });

  return (
    <FormControl
      className={clsx(classes.noteSelect, props.className)}
      variant="outlined"
    >
      {props.label && (
        <InputLabel shrink id={`${id}-label`}>
          {props.label}
        </InputLabel>
      )}
      <Select
        labelId={props.label ? `${id}-label` : undefined}
        label={props.label}
        id={id}
        value={props.value}
        open={false}
        onOpen={toggleSelect}
        onClose={toggleSelect}
      >
        {isSelectOpened ? (
          <MenuItem value={props.value}>Press note to select...</MenuItem>
        ) : (
          <MenuItem value={props.value}>{Note.fromMidi(props.value)}</MenuItem>
        )}
      </Select>
    </FormControl>
  );
};

export const NoteSelect = React.memo(NoteSelectBase);
