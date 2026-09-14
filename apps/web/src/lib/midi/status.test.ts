import { describe, expect, it } from 'vitest';
import {
  MIDI_COPY,
  deviceAction,
  deviceLostMessage,
  deviceSelect,
  deviceValue,
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

describe('deviceSelect', () => {
  it('does not claim "no device" before access was ever requested', () => {
    // The §8.2 bug: we have not looked yet, so saying we found nothing is a lie.
    expect(deviceSelect({ status: 'idle', inputCount: 0 })).toEqual({
      placeholder: 'Connect MIDI to list devices',
      disabled: true,
    });
  });

  it('says it is looking while the request is in flight', () => {
    expect(deviceSelect({ status: 'requesting', inputCount: 0 })).toEqual({
      placeholder: 'Looking for devices…',
      disabled: true,
    });
  });

  it('only says "No device found" once we have actually looked', () => {
    expect(deviceSelect({ status: 'granted', inputCount: 0 })).toEqual({
      placeholder: 'No device found',
      disabled: true,
    });
  });

  it('offers the devices once there are any', () => {
    expect(deviceSelect({ status: 'granted', inputCount: 2 })).toEqual({
      placeholder: 'None',
      disabled: false,
    });
  });

  it('names the blocked and unsupported states', () => {
    expect(deviceSelect({ status: 'denied', inputCount: 0 })).toEqual({
      placeholder: 'MIDI blocked',
      disabled: true,
    });
    expect(deviceSelect({ status: 'unsupported', inputCount: 0 })).toEqual({
      placeholder: 'MIDI unavailable',
      disabled: true,
    });
  });

  it('never leaves the select blank', () => {
    const states = ['idle', 'requesting', 'granted', 'denied', 'unsupported'];
    for (const status of states) {
      const { placeholder } = deviceSelect({
        status: status as Parameters<typeof deviceSelect>[0]['status'],
        inputCount: 0,
      });
      expect(placeholder).not.toBe('');
    }
  });
});

describe('deviceAction', () => {
  it('offers to connect before access is granted', () => {
    expect(deviceAction({ status: 'idle' })).toEqual({
      label: 'Connect MIDI',
      disabled: false,
    });
  });

  it('disables the button while the request is in flight', () => {
    expect(deviceAction({ status: 'requesting' })).toEqual({
      label: 'Connect MIDI',
      disabled: true,
    });
  });

  it('rescans once access is granted', () => {
    expect(deviceAction({ status: 'granted' })).toEqual({
      label: 'Rescan devices',
      disabled: false,
    });
  });

  it('offers no button when asking again would change nothing', () => {
    expect(deviceAction({ status: 'denied' })).toBeNull();
    expect(deviceAction({ status: 'unsupported' })).toBeNull();
  });
});

describe('deviceValue (slice 5b fix)', () => {
  const devices = [{ key: 'Roland:FP-30' }, { key: 'Nektar:Impact LX' }];

  it('shows the remembered device when it is plugged in', () => {
    expect(deviceValue('Roland:FP-30', devices)).toBe('Roland:FP-30');
  });

  it('falls back to the placeholder when the piano is switched off', () => {
    // The key stays remembered — only the <select>'s displayed value falls
    // back, because a value matching no option renders blank.
    expect(deviceValue('Roland:FP-30', [])).toBe('');
    expect(deviceValue('Yamaha:P-125', devices)).toBe('');
  });

  it('shows the placeholder when nothing was ever chosen', () => {
    expect(deviceValue(null, devices)).toBe('');
    expect(deviceValue('', devices)).toBe('');
  });
});
