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
      ...DEFAULT_SETTINGS,
      midiDeviceKey: 'Roland:FP-30',
      noteLabels: 'all',
    });
    expect(parsed).not.toHaveProperty('somethingElse');
  });

  it('rejects an unknown label mode', () => {
    expect(
      parseSettings(JSON.stringify({ noteLabels: 'rainbow' })).noteLabels,
    ).toBe(DEFAULT_SETTINGS.noteLabels);
  });

  it('keeps the sound settings inside their range', () => {
    const parsed = parseSettings(
      JSON.stringify({
        instrument: 'vibraphone',
        volume: 9,
        soundEnabled: false,
        tempoBpm: 5,
        beatsPerBar: 99,
      }),
    );
    expect(parsed).toMatchObject({
      instrument: 'vibraphone',
      volume: 1,
      soundEnabled: false,
      tempoBpm: 40,
      beatsPerBar: 12,
    });
  });

  it('falls back for sound values of the wrong type', () => {
    const parsed = parseSettings(
      JSON.stringify({
        instrument: 7,
        volume: 'loud',
        soundEnabled: 'yes',
        tempoBpm: null,
      }),
    );
    expect(parsed.instrument).toBe(DEFAULT_SETTINGS.instrument);
    expect(parsed.volume).toBe(DEFAULT_SETTINGS.volume);
    expect(parsed.soundEnabled).toBe(DEFAULT_SETTINGS.soundEnabled);
    expect(parsed.tempoBpm).toBe(DEFAULT_SETTINGS.tempoBpm);
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
