import { useMemo, useState } from 'react';
import { useAsyncFn } from 'react-use';
import type { AsyncState } from 'react-use/lib/useAsyncFn';
import { createContainer } from 'unstated-next';
import type { InputSettings } from '@src/services/Settings/shared';
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
  inputSettings?: InputSettings;
  updateInputSettings: (settings?: Partial<InputSettings>) => Promise<void>;
  updateInputSettingsState: AsyncState<void>;
}

function useMidiContext(): MidiContext {
  const [connectedInput, setConnectedInput] = useState<string>();
  const [inputSettings, setInputSettings] = useState<InputSettings>();
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
      if (settings) setInputSettings(settings);
      console.debug('connected', inputName);
    },
    [connectedInput],
  );

  const [disconnectState, disconnect] = useAsyncFn(async () => {
    if (!connectedInput) return;
    console.debug('disconnecting', connectedInput);

    await midiService.invoke.disconnect(connectedInput);
    setConnectedInput(undefined);
    setInputSettings(undefined);
    console.debug('disconnect', connectedInput);
  }, [connectedInput]);

  const [updateInputSettingsState, updateInputSettings] = useAsyncFn(
    async (settings?: Partial<InputSettings>) => {
      if (!connectedInput) return;
      const newSettings = settings
        ? { ...inputSettings!, ...settings }
        : undefined;
      if (newSettings) {
        await settingsService.invoke.setInputSettings(
          connectedInput,
          newSettings,
        );
      } else {
        await settingsService.invoke.deleteInputSettings(connectedInput);
      }
      setInputSettings(newSettings);
    },
    [connectedInput, inputSettings],
  );

  return useMemo(
    () => ({
      connect,
      connectedInput,
      connectState,
      disconnect,
      disconnectState,
      fetchInputs,
      inputs,
      isInputReady: !!(connectedInput && inputSettings?.midiRange),
      inputSettings,
      updateInputSettings,
      updateInputSettingsState,
    }),
    [
      connectedInput,
      connectState,
      disconnectState,
      inputs,
      inputSettings,
      updateInputSettingsState,
    ],
  );
}

export const { Provider: MidiProvider, useContainer: useMidi } =
  createContainer(useMidiContext);
