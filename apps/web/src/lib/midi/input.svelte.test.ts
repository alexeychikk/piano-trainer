import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MidiInput, deviceKey } from './input.svelte';
import { settings } from '$lib/storage/settings.svelte';

/** A MIDI port good enough for the store: id, names, and a message hook. */
class FakePort {
  onmidimessage: ((event: { data: Uint8Array }) => void) | null = null;
  state = 'connected';
  constructor(
    readonly id: string,
    readonly name: string,
    readonly manufacturer: string,
  ) {}

  send(bytes: number[]) {
    this.onmidimessage?.({ data: Uint8Array.from(bytes) });
  }
}

class FakeAccess {
  onstatechange: (() => void) | null = null;
  inputs = new Map<string, FakePort>();

  constructor(ports: FakePort[]) {
    for (const port of ports) this.inputs.set(port.id, port);
  }

  remove(port: FakePort) {
    this.inputs.delete(port.id);
    this.onstatechange?.();
  }

  add(port: FakePort) {
    this.inputs.set(port.id, port);
    this.onstatechange?.();
  }
}

const piano = () => new FakePort('port-1', 'FP-30', 'Roland');
const synth = () => new FakePort('port-2', 'Minilogue', 'Korg');

function installWebMidi(access: FakeAccess | null, permission = 'granted') {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    writable: true,
    value: access
      ? vi.fn().mockResolvedValue(access)
      : vi.fn().mockRejectedValue(new Error('SecurityError')),
  });
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    writable: true,
    value: { query: vi.fn().mockResolvedValue({ state: permission }) },
  });
}

describe('MidiInput', () => {
  beforeEach(() => {
    localStorage.clear();
    settings.patch({ midiDeviceKey: null });
  });

  afterEach(() => {
    // @ts-expect-error — removing the fake again
    delete navigator.requestMIDIAccess;
  });

  it('reports an unsupported browser without throwing', async () => {
    // @ts-expect-error — no Web MIDI at all
    delete navigator.requestMIDIAccess;
    const input = new MidiInput();
    expect(input.supported).toBe(false);
    await input.connect();
    expect(input.status).toBe('unsupported');
    expect(input.chip.label).toBe('MIDI unsupported');
    expect(input.explanation).toContain('no Web MIDI');
  });

  it('reports a blocked permission as a state, not an error', async () => {
    installWebMidi(null);
    const input = new MidiInput();
    await input.connect();
    expect(input.status).toBe('denied');
    expect(input.chip.tone).toBe('danger');
  });

  it('auto-selects the only input and plays its notes', async () => {
    const port = piano();
    installWebMidi(new FakeAccess([port]));
    const input = new MidiInput();
    await input.connect();

    expect(input.status).toBe('granted');
    expect(input.devices).toHaveLength(1);
    expect(input.selectedDevice?.name).toBe('FP-30');
    expect(input.chip.tone).toBe('success');
    expect(input.explanation).toBeNull();

    port.send([0x90, 60, 100]);
    port.send([0x90, 64, 100]);
    expect(input.held).toEqual([60, 64]);
    port.send([0x90, 60, 0]); // note-on velocity 0 = note-off
    expect(input.held).toEqual([64]);
  });

  it('does not choose for the user when several inputs are present', async () => {
    installWebMidi(new FakeAccess([piano(), synth()]));
    const input = new MidiInput();
    await input.connect();

    expect(input.devices).toHaveLength(2);
    expect(input.selectedDevice).toBeNull();
    expect(input.chip.label).toBe('Choose MIDI device');
  });

  it('remembers the device across sessions and ignores the others', async () => {
    settings.patch({ midiDeviceKey: deviceKey('Korg', 'Minilogue') });
    const port = piano();
    const other = synth();
    installWebMidi(new FakeAccess([port, other]));

    const input = new MidiInput();
    await input.connect();
    expect(input.selectedDevice?.name).toBe('Minilogue');

    port.send([0x90, 60, 100]);
    expect(input.held).toEqual([]);
    other.send([0x90, 60, 100]);
    expect(input.held).toEqual([60]);
  });

  it('survives a disconnect: notes released, banner asked for, key kept', async () => {
    const port = piano();
    const access = new FakeAccess([port]);
    installWebMidi(access);
    const input = new MidiInput();
    const lost: string[] = [];
    input.onDeviceLost = (name) => lost.push(name);
    await input.connect();

    port.send([0x90, 60, 100]);
    expect(input.held).toEqual([60]);

    access.remove(port);
    expect(lost).toEqual(['FP-30']);
    expect(input.held).toEqual([]);
    expect(input.selectedDevice).toBeNull();
    expect(input.chip.label).toBe('No MIDI device');
    // The same piano is picked up again when it comes back.
    expect(settings.value.midiDeviceKey).toBe(deviceKey('Roland', 'FP-30'));

    const again = piano();
    access.add(again);
    expect(input.selectedDevice?.name).toBe('FP-30');
    again.send([0x90, 67, 100]);
    expect(input.held).toEqual([67]);
  });

  it('switches the port it listens to when the user picks another', async () => {
    const port = piano();
    const other = synth();
    installWebMidi(new FakeAccess([port, other]));
    const input = new MidiInput();
    await input.connect();

    input.select(deviceKey('Roland', 'FP-30'));
    port.send([0x90, 60, 100]);
    expect(input.held).toEqual([60]);
    port.send([0x80, 60, 0]);

    input.select(deviceKey('Korg', 'Minilogue'));
    port.send([0x90, 62, 100]);
    expect(input.held).toEqual([]);
    other.send([0x90, 62, 100]);
    expect(input.held).toEqual([62]);
  });

  it('stays quiet when the permission has not been granted yet', async () => {
    const requestSpy = vi.fn();
    installWebMidi(new FakeAccess([piano()]), 'prompt');
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      writable: true,
      value: requestSpy,
    });

    const input = new MidiInput();
    await input.autoConnect();
    expect(requestSpy).not.toHaveBeenCalled();
    expect(input.status).toBe('idle');
  });

  it('never prompts on load when the browser has no permissions API', async () => {
    // A browser with `requestMIDIAccess` but no `navigator.permissions` must
    // not be probed: `requestMIDIAccess` there *is* the prompt (ADR §3).
    const requestSpy = vi.fn();
    installWebMidi(new FakeAccess([piano()]));
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      writable: true,
      value: requestSpy,
    });
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const input = new MidiInput();
    await input.autoConnect();
    expect(requestSpy).not.toHaveBeenCalled();
    expect(input.status).toBe('idle');
  });

  it('never prompts on load when the permission query throws', async () => {
    const requestSpy = vi.fn();
    installWebMidi(new FakeAccess([piano()]));
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      writable: true,
      value: requestSpy,
    });
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      writable: true,
      value: {
        query: vi.fn().mockRejectedValue(new TypeError('unknown permission')),
      },
    });

    const input = new MidiInput();
    await input.autoConnect();
    expect(requestSpy).not.toHaveBeenCalled();
    expect(input.status).toBe('idle');
  });

  it('records a blocked permission found on load without prompting', async () => {
    const requestSpy = vi.fn();
    installWebMidi(new FakeAccess([piano()]), 'denied');
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      writable: true,
      value: requestSpy,
    });

    const input = new MidiInput();
    await input.autoConnect();
    expect(requestSpy).not.toHaveBeenCalled();
    expect(input.status).toBe('denied');
  });

  it('reconnects silently when the permission is already granted', async () => {
    installWebMidi(new FakeAccess([piano()]));
    const input = new MidiInput();
    await input.autoConnect();
    expect(input.status).toBe('granted');
    expect(input.selectedDevice?.name).toBe('FP-30');
  });
});
