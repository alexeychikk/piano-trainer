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

/** Count-in before a question plays (slice 4; UX spec §4.3 timing table). */
export type CountIn = 'off' | '1-bar';

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
  /**
   * The playable range of the user's instrument, taught by the range wizard
   * (UX spec §6.3). Exercises generate inside it; the runner renders it.
   * One range, not one per device (see the note on `midiDeviceKey`).
   */
  keyboardLow: number;
  keyboardHigh: number;
  /** Count in one bar of clicks before each question, or not at all. */
  countIn: CountIn;
  /**
   * How long a mixed session lasts, in minutes — home's segmented control
   * (UX spec §3: 5 / 10 / 20, default 10). The allowed values are restated
   * here as plain numbers so this base layer keeps importing nothing;
   * `$lib/practice/session.ts` owns them for everyone else.
   */
  sessionLengthMin: number;
  /** Runner focus mode — chrome hidden (UX spec §4.7 persists it). */
  focusMode: boolean;
  /**
   * Epoch ms of the last practice-data export, or `null` — the `last export
   * 3 days ago` clause of the `#data` stats line (sci-fi-screens.md §8.5). It
   * is a setting rather than practice data on purpose: it describes *this*
   * browser, so an imported file must not overwrite it (the import applies
   * every other field).
   */
  lastExportAt: number | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  midiDeviceKey: null,
  noteLabels: 'c-only',
  instrument: 'acoustic_grand_piano',
  volume: 0.72,
  soundEnabled: true,
  tempoBpm: 90,
  beatsPerBar: 4,
  // C2–C7: the 61-key piano the keyboard component defaults to, until the
  // wizard hears what the user actually owns.
  keyboardLow: 36,
  keyboardHigh: 96,
  countIn: 'off',
  sessionLengthMin: 10,
  focusMode: false,
  lastExportAt: null,
};

const STORAGE_KEY = 'piano-trainer:settings';

const LABEL_MODES: readonly LabelMode[] = ['none', 'c-only', 'white', 'all'];

/** Bounds mirrored by `$lib/audio` (`clampVolume`, `clampTempo`, …). */
const VOLUME_RANGE: readonly [number, number] = [0, 1];
const TEMPO_RANGE: readonly [number, number] = [40, 240];
const BEATS_RANGE: readonly [number, number] = [1, 12];
/** MIDI note numbers; kept literal so this base layer imports nothing. */
const MIDI_RANGE: readonly [number, number] = [0, 127];

const COUNT_INS: readonly CountIn[] = ['off', '1-bar'];

/** UX spec §3's segmented control; mirrored by `$lib/practice/session.ts`. */
const SESSION_LENGTHS: readonly number[] = [5, 10, 20];

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
  try {
    return parseSettingsValue(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * The same validation over an already-parsed value — what slice 5b's import
 * hands in, since a settings object inside a JSON file was never a string.
 */
export function parseSettingsValue(parsed: unknown): AppSettings {
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
    ...parseRange(record),
    countIn: COUNT_INS.includes(record.countIn as CountIn)
      ? (record.countIn as CountIn)
      : DEFAULT_SETTINGS.countIn,
    sessionLengthMin: SESSION_LENGTHS.includes(
      record.sessionLengthMin as number,
    )
      ? (record.sessionLengthMin as number)
      : DEFAULT_SETTINGS.sessionLengthMin,
    focusMode:
      typeof record.focusMode === 'boolean'
        ? record.focusMode
        : DEFAULT_SETTINGS.focusMode,
    lastExportAt:
      typeof record.lastExportAt === 'number' &&
      Number.isFinite(record.lastExportAt)
        ? record.lastExportAt
        : null,
  };
}

/**
 * A stored range that is inverted or too small is not a range a piano has —
 * fall back to the default rather than generating questions inside it.
 */
function parseRange(record: Record<string, unknown>): {
  keyboardLow: number;
  keyboardHigh: number;
} {
  const low = Math.round(
    boundedNumber(record.keyboardLow, MIDI_RANGE, DEFAULT_SETTINGS.keyboardLow),
  );
  const high = Math.round(
    boundedNumber(
      record.keyboardHigh,
      MIDI_RANGE,
      DEFAULT_SETTINGS.keyboardHigh,
    ),
  );
  if (high - low < MIN_RANGE_SEMITONES) {
    return {
      keyboardLow: DEFAULT_SETTINGS.keyboardLow,
      keyboardHigh: DEFAULT_SETTINGS.keyboardHigh,
    };
  }
  return { keyboardLow: low, keyboardHigh: high };
}

/** A usable instrument spans at least an octave (the wizard enforces it too). */
export const MIN_RANGE_SEMITONES = 12;

/**
 * Trailing debounce for a continuous control (the volume slider, slice 5b): a
 * drag fires `input` every few ms and each one serialised the whole settings
 * object into `localStorage` — a synchronous write on the drag's frame budget.
 * Short enough that letting go and closing the tab still saves.
 */
export const WRITE_DEBOUNCE_MS = 250;

export class SettingsStore {
  value = $state<AppSettings>({ ...DEFAULT_SETTINGS });
  /** True once the stored values have been read (client only). */
  hydrated = $state(false);

  #pending: ReturnType<typeof setTimeout> | null = null;

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
    this.#write();
  }

  /**
   * Apply a change immediately and persist it on a trailing debounce — for a
   * control that fires continuously. The in-memory value is always current;
   * only the write waits, so anything that *reads storage* (export) flushes
   * first.
   */
  patchSoon(change: Partial<AppSettings>): void {
    this.value = { ...this.value, ...change };
    if (this.#pending !== null) clearTimeout(this.#pending);
    this.#pending = setTimeout(() => {
      this.#pending = null;
      this.#write();
    }, WRITE_DEBOUNCE_MS);
  }

  /**
   * Apply a change onto what is **stored**, not onto this tab's snapshot.
   *
   * `patch()` writes the whole in-memory object back, so a tab that has been
   * open across another tab's edits would undo them to record one field. For a
   * field a *reader* stamps (`lastExportAt`, written right after `read()`),
   * re-reading first keeps last-write-wins to the field that actually changed.
   */
  patchStored(change: Partial<AppSettings>): void {
    this.value = { ...this.read(), ...change };
    this.#write();
  }

  /** Persist a debounced change now. */
  flush(): void {
    if (this.#pending === null) return;
    clearTimeout(this.#pending);
    this.#pending = null;
    this.#write();
  }

  /**
   * What is actually **stored**, parsed fresh — `hydrate()` is one-shot, so the
   * in-memory snapshot can be older than storage (a second tab) and is what an
   * export must not trust. Pending debounced writes are flushed first, so this
   * never reports a value the user has already changed. Falls back to the live
   * value when there is no `localStorage` to read.
   */
  read(): AppSettings {
    this.flush();
    if (typeof localStorage === 'undefined') return { ...this.value };
    try {
      return parseSettings(localStorage.getItem(STORAGE_KEY));
    } catch {
      return { ...this.value };
    }
  }

  #write(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.value));
    } catch {
      // Settings are a convenience; losing them must never break practice.
    }
  }
}

export const settings = new SettingsStore();
