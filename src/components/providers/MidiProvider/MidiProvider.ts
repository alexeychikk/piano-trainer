import type { Note } from 'easymidi';
import { useMemo, useState } from 'react';
import { useAsyncFn } from 'react-use';
import type { AsyncState } from 'react-use/lib/useAsyncFn';
import { createContainer } from 'unstated-next';
import { MidiService } from '@src/services/render';

export interface MidiContext {
  connectedInput?: string;
  inputs: AsyncState<string[]>;
  fetchInputs: () => Promise<string[]>;
  connect: (input: string) => Promise<void>;
  connectState: AsyncState<void>;
  disconnect: () => Promise<void>;
  disconnectState: AsyncState<void>;
  onNoteUp?: (fn: (note: Note) => void) => void;
  onNoteDown?: (fn: (note: Note) => void) => void;
}

function useMidiContext(): MidiContext {
  const [connectedInput, setConnectedInput] = useState<string>();
  const [inputs, fetchInputs] = useAsyncFn(
    () => MidiService.getInputs(),
    [connectedInput],
  );

  const [events, setEvents] = useState<{
    onNoteUp?: MidiContext['onNoteUp'];
    offNoteUp?: () => void;
    onNoteDown?: MidiContext['onNoteDown'];
    offNoteDown?: () => void;
  }>({});

  const [connectState, connect] = useAsyncFn(
    async (inputName: string) => {
      console.debug('connecting', inputName);
      if (connectedInput) await disconnect();

      await MidiService.connect(inputName);
      setConnectedInput(inputName);
      console.debug('connected', inputName);

      setEvents({
        onNoteUp: (fn) => {
          const { off } = MidiService.onNoteUp(({ input, note }) =>
            input === connectedInput ? fn(note) : undefined,
          );
          setEvents({ ...events, offNoteUp: off });
        },
        onNoteDown: (fn) => {
          const { off } = MidiService.onNoteDown(({ input, note }) =>
            input === connectedInput ? fn(note) : undefined,
          );
          setEvents({ ...events, offNoteDown: off });
        },
      });
    },
    [connectedInput, events],
  );

  const [disconnectState, disconnect] = useAsyncFn(async () => {
    if (!connectedInput) return;
    console.debug('disconnecting', connectedInput);

    events.offNoteDown?.();
    events.offNoteUp?.();
    setEvents({});
    await MidiService.disconnect(connectedInput);
    setConnectedInput(undefined);
    console.debug('disconnect', connectedInput);
  }, [connectedInput, events]);

  return useMemo(
    () => ({
      inputs,
      fetchInputs,
      connectedInput,
      connect,
      connectState,
      disconnect,
      disconnectState,
      onNoteUp: events.onNoteUp,
      onNoteDown: events.onNoteDown,
    }),
    [connectedInput, inputs, connectState, disconnectState, events],
  );
}

export const { Provider: MidiProvider, useContainer: useMidi } =
  createContainer(useMidiContext);
