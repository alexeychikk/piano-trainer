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
}

export const DEFAULT_SETTINGS: AppSettings = {
  midiDeviceKey: null,
  noteLabels: 'c-only',
};

const STORAGE_KEY = 'piano-trainer:settings';

const LABEL_MODES: readonly LabelMode[] = ['none', 'c-only', 'white', 'all'];

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
  return { midiDeviceKey, noteLabels };
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
