import type { Note } from 'easymidi';
import { ipcEvent, ipcFn } from '@src/services/Ipc/shared';

export const MidiSchema = {
  name: 'Midi',
  methods: {
    getInputs: ipcFn<() => Promise<string[]>>(),
    connect: ipcFn<(name: string) => Promise<void>>(),
    disconnect: ipcFn<(name: string) => Promise<void>>(),
  },
  events: {
    onNoteDown: ipcEvent<{ input: string; note: Note }>(),
    onNoteUp: ipcEvent<{ input: string; note: Note }>(),
  },
} as const;

export type MidiMethods = typeof MidiSchema['methods'];
