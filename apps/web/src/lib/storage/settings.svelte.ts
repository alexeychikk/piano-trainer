/**
 * User settings (ADR 0001 §6: settings in `localStorage`, practice data in
 * IndexedDB from slice 5). Shared reactive state as a class instance exported
 * from a `*.svelte.ts` module — runes only, no stores.
 *
 * Reading storage is deferred to `hydrate()`, called once from the root layout
 * after mount: the app is prerendered, so module init must not touch
 * `localStorage` or the server HTML and the first client render would disagree.
 */

export type LabelMode = 'none' | 'c-only' | 'white' | 'all';

export interface AppSettings {
  /**
   * `${manufacturer}:${name}` of the chosen MIDI input — port ids are not
   * stable across sessions (ADR §3).
   */
  midiDeviceKey: string | null;
  /** Note labels on the piano keyboard (UX spec §6.3). */
  noteLabels: LabelMode;
  /**
   * Soundfont instrument id (slice 3). A plain string on purpose: validating
   * it against the curated list would make this base layer import
   * `$lib/audio`, which the layering rule forbids — the engine falls back to
   * its default when it does not know the id.
   */
  instrument: string;
  /** Master volume, 0..1 (UX spec §6.3 shows the slider at 72%). */
  volume: number;
  /** Master mute. `false` keeps the app completely silent. */
  soundEnabled: boolean;
  /** Metronome tempo in BPM. */
  tempoBpm: number;
  /** Metronome beats per bar; beat 1 is the accented downbeat. */
  beatsPerBar: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  midiDeviceKey: null,
  noteLabels: 'c-only',
  instrument: 'acoustic_grand_piano',
  volume: 0.72,
  soundEnabled: true,
  tempoBpm: 90,
  beatsPerBar: 4,
};

const STORAGE_KEY = 'piano-trainer:settings';

const LABEL_MODES: readonly LabelMode[] = ['none', 'c-only', 'white', 'all'];

/** Bounds mirrored by `$lib/audio` (`clampVolume`, `clampTempo`, …). */
const VOLUME_RANGE: readonly [number, number] = [0, 1];
const TEMPO_RANGE: readonly [number, number] = [40, 240];
const BEATS_RANGE: readonly [number, number] = [1, 12];

function boundedNumber(
  value: unknown,
  [min, max]: readonly [number, number],
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Keep only keys we know, with the right shape — storage is user-editable. */
export function parseSettings(raw: string | null): AppSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
  const record = parsed as Record<string, unknown>;
  const midiDeviceKey =
    typeof record.midiDeviceKey === 'string' ? record.midiDeviceKey : null;
  const noteLabels = LABEL_MODES.includes(record.noteLabels as LabelMode)
    ? (record.noteLabels as LabelMode)
    : DEFAULT_SETTINGS.noteLabels;
  return {
    midiDeviceKey,
    noteLabels,
    instrument:
      typeof record.instrument === 'string'
        ? record.instrument
        : DEFAULT_SETTINGS.instrument,
    volume: boundedNumber(record.volume, VOLUME_RANGE, DEFAULT_SETTINGS.volume),
    soundEnabled:
      typeof record.soundEnabled === 'boolean'
        ? record.soundEnabled
        : DEFAULT_SETTINGS.soundEnabled,
    tempoBpm: boundedNumber(
      record.tempoBpm,
      TEMPO_RANGE,
      DEFAULT_SETTINGS.tempoBpm,
    ),
    beatsPerBar: boundedNumber(
      record.beatsPerBar,
      BEATS_RANGE,
      DEFAULT_SETTINGS.beatsPerBar,
    ),
  };
}

export class SettingsStore {
  value = $state<AppSettings>({ ...DEFAULT_SETTINGS });
  /** True once the stored values have been read (client only). */
  hydrated = $state(false);

  /** Read persisted settings. Safe to call more than once. */
  hydrate(): void {
    if (this.hydrated) return;
    this.hydrated = true;
    if (typeof localStorage === 'undefined') return;
    try {
      this.value = parseSettings(localStorage.getItem(STORAGE_KEY));
    } catch {
      // Private mode or a blocked storage partition: defaults are fine.
    }
  }

  /** Apply a change immediately and persist it (UX spec §6.3: no Save). */
  patch(change: Partial<AppSettings>): void {
    this.value = { ...this.value, ...change };
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.value));
    } catch {
      // Settings are a convenience; losing them must never break practice.
    }
  }
}

export const settings = new SettingsStore();
