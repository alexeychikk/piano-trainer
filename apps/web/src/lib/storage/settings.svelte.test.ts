import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SettingsStore,
  parseSettings,
} from './settings.svelte';

describe('parseSettings', () => {
  it('falls back to the defaults for missing or broken data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{ not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('"a string"')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps known values and drops the rest', () => {
    const parsed = parseSettings(
      JSON.stringify({
        midiDeviceKey: 'Roland:FP-30',
        noteLabels: 'all',
        somethingElse: 42,
      }),
    );
    expect(parsed).toEqual({
      midiDeviceKey: 'Roland:FP-30',
      noteLabels: 'all',
    });
  });

  it('rejects an unknown label mode', () => {
    expect(
      parseSettings(JSON.stringify({ noteLabels: 'rainbow' })).noteLabels,
    ).toBe(DEFAULT_SETTINGS.noteLabels);
  });
});

describe('SettingsStore', () => {
  beforeEach(() => localStorage.clear());

  it('starts from the defaults and only reads storage on hydrate', () => {
    localStorage.setItem(
      'piano-trainer:settings',
      JSON.stringify({ noteLabels: 'all' }),
    );
    const store = new SettingsStore();
    expect(store.value.noteLabels).toBe('c-only');
    store.hydrate();
    expect(store.value.noteLabels).toBe('all');
  });

  it('persists a change so it survives a reload', () => {
    const store = new SettingsStore();
    store.hydrate();
    store.patch({ midiDeviceKey: 'Roland:FP-30' });

    const reloaded = new SettingsStore();
    reloaded.hydrate();
    expect(reloaded.value.midiDeviceKey).toBe('Roland:FP-30');
    expect(reloaded.value.noteLabels).toBe('c-only');
  });
});
