import { ipcFn } from '@src/services/Ipc/shared';
import type { MidiRange } from '../Midi/shared';

export const SettingsSchema = {
  name: 'Settings',
  methods: {
    getInputSettings:
      ipcFn<(name: string) => Promise<InputSettings | undefined>>(),
    setInputSettings:
      ipcFn<(name: string, settings: InputSettings) => Promise<void>>(),
    getLastConnectedInputSettings:
      ipcFn<() => Promise<InputSettings | undefined>>(),
    setLastConnectedInput: ipcFn<(name: string) => Promise<void>>(),
  },
} as const;

export type SettingsMethods = typeof SettingsSchema['methods'];

export type Settings = {
  lastConnectedInput?: string;
  inputs: Record<string, InputSettings>;
};

export type InputSettings = {
  name: string;
  midiRange: MidiRange;
};
