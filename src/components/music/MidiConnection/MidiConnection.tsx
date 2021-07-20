import type React from 'react';
import { useAsync, useInterval } from 'react-use';
import { useMidi } from '@src/components/providers/MidiProvider';

export const MidiConnection: React.FC = () => {
  const { connectedInput, disconnect, inputs, fetchInputs } = useMidi();
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

  return null;
};
