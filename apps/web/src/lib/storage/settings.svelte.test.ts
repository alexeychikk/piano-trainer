import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SettingsStore,
  WRITE_DEBOUNCE_MS,
  parseSettings,
} from './settings.svelte';

const STORAGE_KEY = 'piano-trainer:settings';

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

describe('SettingsStore — the debounced write (slice 5b)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('applies at once but writes once the drag settles', () => {
    const store = new SettingsStore();
    store.hydrate();
    for (const volume of [0.1, 0.2, 0.3, 0.4]) store.patchSoon({ volume });

    // In memory immediately — the gain must not wait for a disk write.
    expect(store.value.volume).toBeCloseTo(0.4);
    expect(parseSettings(localStorage.getItem(STORAGE_KEY)).volume).toBe(
      DEFAULT_SETTINGS.volume,
    );

    vi.advanceTimersByTime(WRITE_DEBOUNCE_MS);
    expect(parseSettings(localStorage.getItem(STORAGE_KEY)).volume).toBeCloseTo(
      0.4,
    );
  });

  it('flushes a pending write early (the slider let go)', () => {
    const store = new SettingsStore();
    store.hydrate();
    store.patchSoon({ volume: 0.5 });
    store.flush();
    expect(parseSettings(localStorage.getItem(STORAGE_KEY)).volume).toBeCloseTo(
      0.5,
    );
    // A second flush is a no-op, not a second write.
    localStorage.removeItem(STORAGE_KEY);
    store.flush();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('reads what is stored, not the hydrated snapshot', () => {
    const store = new SettingsStore();
    store.hydrate();
    // Another tab (or this one, before `hydrate()` was ever called) moved on.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, noteLabels: 'all' }),
    );
    expect(store.value.noteLabels).toBe('c-only');
    expect(store.read().noteLabels).toBe('all');
  });

  it('flushes before reading, so a debounced change is never missed', () => {
    const store = new SettingsStore();
    store.hydrate();
    store.patchSoon({ volume: 0.33 });
    expect(store.read().volume).toBeCloseTo(0.33);
  });
});

describe('slice-4 settings', () => {
  it('defaults to a 61-key range, no count-in and no focus mode', () => {
    const parsed = parseSettings(null);
    expect(parsed.keyboardLow).toBe(36);
    expect(parsed.keyboardHigh).toBe(96);
    expect(parsed.countIn).toBe('off');
    expect(parsed.focusMode).toBe(false);
  });

  it('keeps a range the range wizard could have produced', () => {
    const parsed = parseSettings(
      JSON.stringify({ keyboardLow: 28, keyboardHigh: 103 }),
    );
    expect(parsed.keyboardLow).toBe(28);
    expect(parsed.keyboardHigh).toBe(103);
  });

  it('falls back to the default range when the stored one is unusable', () => {
    for (const stored of [
      { keyboardLow: 96, keyboardHigh: 36 },
      { keyboardLow: 60, keyboardHigh: 64 },
      { keyboardLow: 'C2', keyboardHigh: 'C7' },
    ]) {
      const parsed = parseSettings(JSON.stringify(stored));
      expect(parsed.keyboardLow, JSON.stringify(stored)).toBe(36);
      expect(parsed.keyboardHigh, JSON.stringify(stored)).toBe(96);
    }
  });

  it('rejects a count-in value it does not know', () => {
    expect(parseSettings(JSON.stringify({ countIn: '2-bars' })).countIn).toBe(
      'off',
    );
    expect(parseSettings(JSON.stringify({ countIn: '1-bar' })).countIn).toBe(
      '1-bar',
    );
  });
});
