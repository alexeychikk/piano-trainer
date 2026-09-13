import { useState } from 'react';
import { useAsync, useInterval } from 'react-use';
import { useMidi } from '@src/components/providers/MidiProvider';
import { settingsService } from '@src/services/render';

export function useMidiConnection() {
  const {
    connectedInput,
    connect,
    connectState,
    disconnect,
    inputs,
    fetchInputs,
  } = useMidi();

  useAsync(fetchInputs, []);

  useInterval(
    fetchInputs,
    inputs.loading ? null : connectedInput ? 5000 : 1000,
  );

  useInterval(() => {
    if (
      !connectedInput ||
      inputs.loading ||
      !inputs.value ||
      inputs.value.includes(connectedInput)
    )
      return;
    void disconnect();
  }, 1000);

  const [firstConnect, setFirstConnect] = useState<boolean>(true);
  useAsync(async () => {
    if (
      !firstConnect ||
      connectedInput ||
      inputs.loading ||
      !inputs.value?.length ||
      connectState.loading
    )
      return;

    const settings =
      await settingsService.invoke.getLastConnectedInputSettings();
    setFirstConnect(false);
    if (!settings) return;

    await connect(settings.name);
  }, [firstConnect, inputs, connectedInput, connect, connectState]);
}
