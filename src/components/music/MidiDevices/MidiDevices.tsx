import { IconButton, List, ListSubheader, Paper } from '@material-ui/core';
import { Refresh as RefreshIcon } from '@material-ui/icons';
import clsx from 'clsx';
import React from 'react';
import { useAsync, useInterval } from 'react-use';
import { useMidi } from '@src/components/providers/MidiProvider';
import { useStyles } from './MidiDevices.styles';
import { MidiInput } from './MidiInput';

export interface MidiDevicesProps {
  className?: string;
}

const MidiDevicesBase: React.FC<MidiDevicesProps> = (props) => {
  const classes = useStyles();
  const {
    inputs,
    fetchInputs,
    connectedInput,
    connect,
    connectState,
    disconnect,
    disconnectState,
  } = useMidi();
  useAsync(fetchInputs, []);
  useInterval(fetchInputs, inputs.loading ? null : 5000);

  return (
    <Paper
      className={clsx(
        classes.midiDevices,
        props.className,
        connectedInput && classes.connected,
      )}
    >
      <List
        className={classes.list}
        subheader={
          connectedInput ? undefined : (
            <ListSubheader className={classes.subheader}>
              Devices:
              <b className={classes.deviceCount}>{inputs.value?.length || 0}</b>
              <IconButton
                className={classes.refreshButton}
                size="small"
                onClick={fetchInputs}
              >
                <RefreshIcon fontSize="inherit" />
              </IconButton>
            </ListSubheader>
          )
        }
        dense
      >
        {!connectedInput &&
          inputs.value?.map((input) => (
            <MidiInput
              key={input}
              input={input}
              connectState={connectState}
              onConnect={connect}
            />
          ))}
        {connectedInput && (
          <MidiInput
            input={connectedInput}
            connectState={connectState}
            disconnectState={disconnectState}
            onDisconnect={disconnect}
          />
        )}
      </List>
    </Paper>
  );
};

export const MidiDevices = React.memo(MidiDevicesBase);
