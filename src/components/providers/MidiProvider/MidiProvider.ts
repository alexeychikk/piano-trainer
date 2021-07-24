import { useMemo, useState } from 'react';
import { useAsyncFn } from 'react-use';
import type { AsyncState } from 'react-use/lib/useAsyncFn';
import { createContainer } from 'unstated-next';
import type { MidiRange } from '@src/services/Midi/shared';
import { midiService, settingsService } from '@src/services/render';

export interface MidiContext {
  connect: (input: string) => Promise<void>;
  connectedInput?: string;
  connectState: AsyncState<void>;
  disconnect: () => Promise<void>;
  disconnectState: AsyncState<void>;
  fetchInputs: () => Promise<string[]>;
  inputs: AsyncState<string[]>;
  isInputReady: boolean;
  midiRange?: MidiRange;
  setMidiRange: (range?: MidiRange) => void;
}

function useMidiContext(): MidiContext {
  const [connectedInput, setConnectedInput] = useState<string>();
  const [midiRange, setMidiRange] = useState<MidiRange>();
  const [inputs, fetchInputs] = useAsyncFn(
    () => midiService.invoke.getInputs(),
    [],
  );

  const [connectState, connect] = useAsyncFn(
    async (inputName: string) => {
      console.debug('connecting', inputName);
      if (connectedInput) await disconnect();

      await midiService.invoke.connect(inputName);
      await settingsService.invoke.setLastConnectedInput(inputName);
      const settings = await settingsService.invoke.getInputSettings(inputName);
      setConnectedInput(inputName);
      if (settings) setMidiRange(settings.midiRange);
      console.debug('connected', inputName);
    },
    [connectedInput],
  );

  const [disconnectState, disconnect] = useAsyncFn(async () => {
    if (!connectedInput) return;
    console.debug('disconnecting', connectedInput);

    await midiService.invoke.disconnect(connectedInput);
    setConnectedInput(undefined);
    setMidiRange(undefined);
    console.debug('disconnect', connectedInput);
  }, [connectedInput]);

  return useMemo(
    () => ({
      connect,
      connectedInput,
      connectState,
      disconnect,
      disconnectState,
      fetchInputs,
      inputs,
      isInputReady: !!(connectedInput && midiRange),
      midiRange,
      setMidiRange,
    }),
    [connectedInput, connectState, disconnectState, inputs, midiRange],
  );
}

export const { Provider: MidiProvider, useContainer: useMidi } =
  createContainer(useMidiContext);
