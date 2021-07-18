import {
  Button,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
} from '@material-ui/core';
import React, { useCallback } from 'react';
import type { AsyncState } from 'react-use/lib/useAsyncFn';
import { useStyles } from './MidiDevices.styles';

export interface MidiInputProps {
  input: string;
  connectState: AsyncState<void>;
  onConnect?(input: string): void;
  disconnectState?: AsyncState<void>;
  onDisconnect?(input: string): void;
}

export const MidiInput: React.FC<MidiInputProps> = (props) => {
  const classes = useStyles();
  const loading = props.connectState.loading || props.disconnectState?.loading;
  const event = props.disconnectState ? props.onDisconnect : props.onConnect;
  const connected = !!props.disconnectState && !props.disconnectState.loading;

  const handleEvent = useCallback(() => {
    event?.(props.input);
  }, [props.input, event]);

  return (
    <ListItem className={classes.midiInput} selected={connected} dense>
      <ListItemText primary={props.input} />
      <ListItemSecondaryAction>
        <Button disabled={loading} onClick={handleEvent}>
          {loading
            ? props.disconnectState
              ? 'Disconnecting'
              : 'Connecting'
            : props.disconnectState
            ? 'Disconnect'
            : 'Connect'}
        </Button>
      </ListItemSecondaryAction>
    </ListItem>
  );
};
