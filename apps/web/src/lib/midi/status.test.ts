import { describe, expect, it } from 'vitest';
import {
  MIDI_COPY,
  deviceLostMessage,
  midiChip,
  midiExplanation,
} from './status';

describe('midiChip', () => {
  it('shows the device when one is connected', () => {
    const chip = midiChip({
      status: 'granted',
      inputCount: 1,
      deviceName: 'Roland FP-30',
    });
    expect(chip).toMatchObject({ glyph: '●', tone: 'success' });
    expect(chip.srLabel).toBe('MIDI: connected to Roland FP-30');
  });

  it('asks the user to choose when several devices are available', () => {
    expect(
      midiChip({ status: 'granted', inputCount: 2, deviceName: null }),
    ).toMatchObject({ glyph: '◐', label: 'Choose MIDI device', tone: 'warn' });
  });

  it('falls back to "no device" before access is requested', () => {
    expect(
      midiChip({ status: 'idle', inputCount: 0, deviceName: null }),
    ).toMatchObject({ glyph: '○', label: 'No MIDI device', tone: 'muted' });
  });

  it('distinguishes blocked from unsupported, glyph and label both', () => {
    const denied = midiChip({
      status: 'denied',
      inputCount: 0,
      deviceName: null,
    });
    const unsupported = midiChip({
      status: 'unsupported',
      inputCount: 0,
      deviceName: null,
    });
    expect(denied).toMatchObject({ label: 'MIDI blocked', tone: 'danger' });
    expect(unsupported).toMatchObject({
      label: 'MIDI unsupported',
      tone: 'muted',
    });
  });
});

describe('midiExplanation', () => {
  it('says nothing when a device is connected', () => {
    expect(
      midiExplanation({
        status: 'granted',
        inputCount: 1,
        deviceName: 'Roland FP-30',
      }),
    ).toBeNull();
  });

  it('uses the copy deck line for each case', () => {
    expect(
      midiExplanation({
        status: 'unsupported',
        inputCount: 0,
        deviceName: null,
      }),
    ).toBe(MIDI_COPY.unsupported);
    expect(
      midiExplanation({ status: 'denied', inputCount: 0, deviceName: null }),
    ).toBe(MIDI_COPY.denied);
    expect(
      midiExplanation({ status: 'granted', inputCount: 0, deviceName: null }),
    ).toBe(MIDI_COPY.noInputs);
    expect(
      midiExplanation({ status: 'idle', inputCount: 0, deviceName: null }),
    ).toBe(MIDI_COPY.none);
  });
});

describe('deviceLostMessage', () => {
  it('names the device that went away', () => {
    expect(deviceLostMessage('Roland FP-30')).toBe(
      'Roland FP-30 disconnected — switched to the on-screen keyboard.',
    );
  });
});
