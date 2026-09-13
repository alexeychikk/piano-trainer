import { Box, Typography } from '@material-ui/core';
import clsx from 'clsx';
import React from 'react';
import { useMidi } from '@src/components/providers/MidiProvider';
import { useMidiWizard } from '@src/hooks';
import { useStyles } from './MidiWizard.styles';

export interface MidiWizardProps {
  className?: string;
}

const MidiWizardBase: React.FC<MidiWizardProps> = (props) => {
  const classes = useStyles();
  const { connectedInput, isInputReady } = useMidi();
  const { first } = useMidiWizard();

  return (
    <Box className={clsx(classes.midiWizard, props.className)}>
      {!connectedInput && (
        <Typography variant="subtitle1">
          Midi keyboard is not connected
        </Typography>
      )}
      {!!(connectedInput && !first) && (
        <Typography variant="h5">
          Press the FIRST note on you MIDI keyboard
        </Typography>
      )}
      {!!(connectedInput && first) && (
        <Typography variant="h5">
          Press the LAST note on you MIDI keyboard
        </Typography>
      )}
      {isInputReady && (
        <Typography variant="subtitle1">
          Your MIDI keyboard is already configured
        </Typography>
      )}
    </Box>
  );
};

export const MidiWizard = React.memo(MidiWizardBase);
