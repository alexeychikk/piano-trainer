import { List, Paper } from '@material-ui/core';
import clsx from 'clsx';
import React from 'react';
import { useAsync } from 'react-use';
import { Loader } from '@src/components/common/Loader';
import { useMidi } from '@src/components/providers/MidiProvider';
import { useStyles } from './MidiDevices.styles';
import { MidiInput } from './MidiInput';

export interface MidiDevicesProps {
  className?: string;
}

export const MidiDevices: React.FC<MidiDevicesProps> = (props) => {
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

  return (
    <Paper>
      <List className={clsx(classes.midiDevices, props.className)} dense>
        {inputs.loading && <Loader />}
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
