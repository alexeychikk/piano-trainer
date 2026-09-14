/**
 * How the MIDI connection is described on screen. Pure: the state → chip and
 * state → copy mappings are here (UX spec §2.2, §4.6 and the copy deck §9), so
 * the wording is tested once and reused by the top bar, Free Play and Settings.
 *
 * "No MIDI device" is a normal, non-blocking state — never an error dialog.
 */

export type MidiStatus =
  /** Access has not been requested yet (ADR §3: never on page load). */
  | 'idle'
  /** The browser has no Web MIDI at all. */
  | 'unsupported'
  /** `requestMIDIAccess` is in flight. */
  | 'requesting'
  /** Access granted — `inputs` may still be empty. */
  | 'granted'
  /** The user (or a policy) blocked MIDI access. */
  | 'denied';

export interface MidiChip {
  glyph: string;
  label: string;
  /** Spelled-out accessible name; the glyph carries the state too. */
  srLabel: string;
  tone: 'muted' | 'success' | 'warn' | 'danger';
}

export interface MidiChipInput {
  status: MidiStatus;
  /** Number of available MIDI inputs. */
  inputCount: number;
  /** Name of the selected device, when one is selected and present. */
  deviceName: string | null;
}

/** The top-bar device chip (UX spec §2.2). Never colour alone. */
export function midiChip({
  status,
  inputCount,
  deviceName,
}: MidiChipInput): MidiChip {
  if (status === 'unsupported') {
    return {
      glyph: '⊘',
      label: 'MIDI unsupported',
      srLabel: 'MIDI: not supported by this browser',
      tone: 'muted',
    };
  }
  if (status === 'denied') {
    return {
      glyph: '⊘',
      label: 'MIDI blocked',
      srLabel: 'MIDI: access blocked',
      tone: 'danger',
    };
  }
  if (deviceName) {
    return {
      glyph: '●',
      label: deviceName,
      srLabel: `MIDI: connected to ${deviceName}`,
      tone: 'success',
    };
  }
  if (inputCount > 1) {
    return {
      glyph: '◐',
      label: 'Choose MIDI device',
      srLabel: `MIDI: ${inputCount} devices available, none chosen`,
      tone: 'warn',
    };
  }
  return {
    glyph: '○',
    label: 'No MIDI device',
    srLabel: 'MIDI: no device connected',
    tone: 'muted',
  };
}

export interface DeviceSelect {
  /**
   * The placeholder option's text. Never blank: a disabled `<select>` still
   * shows its current option, so the state is always readable.
   */
  placeholder: string;
  /** A select with nothing to choose is disabled. */
  disabled: boolean;
}

/**
 * What the Settings device `<select>` says (sci-fi-screens.md §8.2). Before
 * `requestMIDIAccess` has ever run we have not looked, so "No device found"
 * was a lie — the placeholder is a function of the status instead.
 *
 * These six option strings are new *labels*, not copy-deck sentences: the four
 * sentences in `MIDI_COPY` are unchanged and still carry the explanation.
 */
export function deviceSelect({
  status,
  inputCount,
}: Pick<MidiChipInput, 'status' | 'inputCount'>): DeviceSelect {
  if (status === 'unsupported') {
    return { placeholder: 'MIDI unavailable', disabled: true };
  }
  if (status === 'denied') {
    return { placeholder: 'MIDI blocked', disabled: true };
  }
  if (status === 'idle') {
    return { placeholder: 'Connect MIDI to list devices', disabled: true };
  }
  if (status === 'requesting') {
    return { placeholder: 'Looking for devices…', disabled: true };
  }
  // Granted: we have looked, so now "none found" is the truth.
  if (inputCount === 0) {
    return { placeholder: 'No device found', disabled: true };
  }
  return { placeholder: 'None', disabled: false };
}

export interface DeviceAction {
  label: string;
  disabled: boolean;
}

/**
 * The request button beside the select (§8.2's "Row action"), or `null` when
 * asking again would change nothing — `denied` is rejected instantly by the
 * browser and `unsupported` has nothing to request, so both are left to the
 * explanation and the `#midi` link.
 */
export function deviceAction({
  status,
}: Pick<MidiChipInput, 'status'>): DeviceAction | null {
  if (status === 'unsupported' || status === 'denied') return null;
  if (status === 'granted') {
    return { label: 'Rescan devices', disabled: false };
  }
  return { label: 'Connect MIDI', disabled: status === 'requesting' };
}

/** Copy deck §9, verbatim. */
export const MIDI_COPY = {
  none: `No MIDI keyboard — answer with the on-screen keys or A W S E D F T G Y H U J K`,
  unsupported: `This browser has no Web MIDI. Chrome, Edge and Opera do — or play on-screen.`,
  denied: `MIDI access was blocked. Re-allow it in the browser's site settings, or play on-screen.`,
  noInputs: `No MIDI input found. Plug your piano in and switch it on — it appears automatically.`,
} as const;

/** The one-line explanation for the current state, or `null` when connected. */
export function midiExplanation({
  status,
  inputCount,
  deviceName,
}: MidiChipInput): string | null {
  if (deviceName) return null;
  if (status === 'unsupported') return MIDI_COPY.unsupported;
  if (status === 'denied') return MIDI_COPY.denied;
  if (status === 'granted' && inputCount === 0) return MIDI_COPY.noInputs;
  return MIDI_COPY.none;
}

/** Banner shown when the selected device vanishes mid-session. */
export function deviceLostMessage(deviceName: string): string {
  return `${deviceName} disconnected — switched to the on-screen keyboard.`;
}
