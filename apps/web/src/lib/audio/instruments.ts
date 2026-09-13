/**
 * The curated instrument list (ADR 0001 §2: `smplr` over the MIDI-js
 * soundfonts the old app already used). The 2022 app shipped all ~130 General
 * MIDI programs; for ear training a short list of keyboard timbres is more
 * useful and far less to scroll past, so this is a deliberate reduction.
 *
 * Ids are MusyngKite soundfont names — `smplr` resolves them to sample URLs.
 */

export interface InstrumentOption {
  id: string;
  name: string;
}

export const INSTRUMENTS: readonly InstrumentOption[] = [
  { id: 'acoustic_grand_piano', name: 'Acoustic Grand Piano' },
  { id: 'bright_acoustic_piano', name: 'Bright Acoustic Piano' },
  { id: 'electric_grand_piano', name: 'Electric Grand Piano' },
  { id: 'electric_piano_1', name: 'Electric Piano (Rhodes)' },
  { id: 'electric_piano_2', name: 'Electric Piano (FM)' },
  { id: 'harpsichord', name: 'Harpsichord' },
  { id: 'vibraphone', name: 'Vibraphone' },
];

export const DEFAULT_INSTRUMENT = INSTRUMENTS[0].id;

export function isInstrumentId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    INSTRUMENTS.some((instrument) => instrument.id === value)
  );
}

export function instrumentName(id: string): string {
  return INSTRUMENTS.find((instrument) => instrument.id === id)?.name ?? id;
}
