import { useMemo, useState } from 'react';
import { useAsyncFn } from 'react-use';
import type { AsyncState } from 'react-use/lib/useAsyncFn';
import { createContainer } from 'unstated-next';
import { midiService } from '@src/services/render';

export interface MidiContext {
  connectedInput?: string;
  inputs: AsyncState<string[]>;
  fetchInputs: () => Promise<string[]>;
  connect: (input: string) => Promise<void>;
  connectState: AsyncState<void>;
  disconnect: () => Promise<void>;
  disconnectState: AsyncState<void>;
}

function useMidiContext(): MidiContext {
  const [connectedInput, setConnectedInput] = useState<string>();
  const [inputs, fetchInputs] = useAsyncFn(
    () => midiService.invoke.getInputs(),
    [connectedInput],
  );

  const [connectState, connect] = useAsyncFn(
    async (inputName: string) => {
      console.debug('connecting', inputName);
      if (connectedInput) await disconnect();

      await midiService.invoke.connect(inputName);
      setConnectedInput(inputName);
      console.debug('connected', inputName);
    },
    [connectedInput],
  );

  const [disconnectState, disconnect] = useAsyncFn(async () => {
    if (!connectedInput) return;
    console.debug('disconnecting', connectedInput);

    await midiService.invoke.disconnect(connectedInput);
    setConnectedInput(undefined);
    console.debug('disconnect', connectedInput);
  }, [connectedInput]);

  return useMemo(
    () => ({
      inputs,
      fetchInputs,
      connectedInput,
      connect,
      connectState,
      disconnect,
      disconnectState,
    }),
    [connectedInput, inputs, connectState, disconnectState],
  );
}

export const { Provider: MidiProvider, useContainer: useMidi } =
  createContainer(useMidiContext);
