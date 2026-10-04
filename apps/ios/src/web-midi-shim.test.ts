import { describe, expect, it, vi } from 'vitest';
import {
  createRequestMidiAccess,
  installWebMidiShim,
  isChannelVoiceMessage,
  shouldInstall,
  type CoreMidiPlugin,
  type MessagesEvent,
  type MidiSource,
  type ShimMidiAccess,
  type SourcesEvent,
} from './web-midi-shim';

const PIANO: MidiSource = {
  id: '1001',
  name: 'FP-30X',
  manufacturer: 'Roland',
};
const PADS: MidiSource = { id: '2002', name: 'Pads', manufacturer: '' };

/** The native side, as far as the shim can tell (ADR 0005 §4.2). */
function fakePlugin(initial: MidiSource[] = [PIANO]) {
  const listeners = {
    sourcesChanged: new Set<(event: SourcesEvent) => void>(),
    messages: new Set<(event: MessagesEvent) => void>(),
  };
  let sources = initial;
  const plugin = {
    start: vi.fn(async (): Promise<SourcesEvent> => ({ sources })),
    addListener: vi.fn(
      async (
        eventName: 'sourcesChanged' | 'messages',
        listener: (event: never) => void,
      ) => {
        const set = listeners[eventName] as Set<typeof listener>;
        set.add(listener);
        return { remove: async () => void set.delete(listener) };
      },
    ),
  };
  return {
    plugin: plugin as unknown as CoreMidiPlugin & typeof plugin,
    setSources(next: MidiSource[]) {
      sources = next;
      for (const listener of listeners.sourcesChanged) listener({ sources });
    },
    send(id: string, ...data: number[][]) {
      for (const listener of listeners.messages) listener({ id, data });
    },
  };
}

function fakeNavigator(withPermissions = true): Navigator {
  const query = vi.fn(async (descriptor: PermissionDescriptor) => ({
    name: descriptor.name,
    state: 'prompt',
  }));
  return (withPermissions
    ? { permissions: { query } }
    : {}) as unknown as Navigator;
}

async function connect(initial?: MidiSource[]) {
  const fake = fakePlugin(initial);
  const access = await createRequestMidiAccess(fake.plugin)();
  return { ...fake, access };
}

function statechanges(target: EventTarget) {
  const ports: Array<{ id: string; state: string; connection: string }> = [];
  target.addEventListener('statechange', (event) => {
    const port = (event as Event & { port: MIDIPort }).port;
    ports.push({ id: port.id, state: port.state, connection: port.connection });
  });
  return ports;
}

describe('shouldInstall', () => {
  const env = { isNativePlatform: true, pluginAvailable: true };

  it('installs inside the shell, with the plugin, without Web MIDI', () => {
    expect(shouldInstall({ ...env, navigator: {} as Navigator })).toBe(true);
  });

  it('stands down for real Web MIDI, outside the shell, or without the plugin', () => {
    const withMidi = { requestMIDIAccess: () => null } as unknown as Navigator;
    expect(shouldInstall({ ...env, navigator: withMidi })).toBe(false);
    const nav = {} as Navigator;
    expect(
      shouldInstall({ ...env, isNativePlatform: false, navigator: nav }),
    ).toBe(false);
    expect(
      shouldInstall({ ...env, pluginAvailable: false, navigator: nav }),
    ).toBe(false);
  });
});

describe('requestMIDIAccess', () => {
  it('resolves a real Promise with the sources start() reports', async () => {
    const fake = fakePlugin([PIANO, PADS]);
    const pending = createRequestMidiAccess(fake.plugin)({ sysex: false });
    expect(pending).toBeInstanceOf(Promise);
    const access = await pending;

    expect(access.sysexEnabled).toBe(false);
    expect(access.outputs.size).toBe(0);
    expect([...access.inputs.keys()]).toEqual(['1001', '2002']);
    const piano = access.inputs.get('1001')!;
    expect(piano).toMatchObject({
      id: '1001',
      name: 'FP-30X',
      manufacturer: 'Roland',
      type: 'input',
      version: '',
      state: 'connected',
      connection: 'closed',
    });
    expect(access.inputs.get('2002')!.manufacturer).toBe('');
    // The app iterates with forEach, as Chrome's MIDIInputMap allows.
    const names: string[] = [];
    access.inputs.forEach((port) => names.push(port.name));
    expect(names).toEqual(['FP-30X', 'Pads']);
  });

  it('is a singleton: one start(), one access', async () => {
    const fake = fakePlugin();
    const request = createRequestMidiAccess(fake.plugin);
    const [a, b] = await Promise.all([request(), request()]);
    expect(a).toBe(b);
    expect(await request()).toBe(a);
    expect(fake.plugin.start).toHaveBeenCalledTimes(1);
  });

  it('listens before it starts, so no hot-plug is missed', async () => {
    const fake = fakePlugin();
    await createRequestMidiAccess(fake.plugin)();
    const order = [
      ...fake.plugin.addListener.mock.invocationCallOrder,
      ...fake.plugin.start.mock.invocationCallOrder,
    ];
    expect(order).toEqual([...order].sort((x, y) => x - y));
    expect(fake.plugin.addListener.mock.calls.map(([name]) => name)).toEqual([
      'sourcesChanged',
      'messages',
    ]);
  });

  it('rejects sysex with NotSupportedError and never starts CoreMIDI', async () => {
    const fake = fakePlugin();
    const error = await createRequestMidiAccess(fake.plugin)({
      sysex: true,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe('NotSupportedError');
    expect(fake.plugin.start).not.toHaveBeenCalled();
  });

  it('rejects when CoreMIDI cannot start, and a later call tries again', async () => {
    const fake = fakePlugin();
    fake.plugin.start.mockRejectedValueOnce(new Error('no client'));
    const request = createRequestMidiAccess(fake.plugin);
    const error = await request().catch((e: unknown) => e);
    expect((error as DOMException).name).toBe('InvalidStateError');

    const access = await request();
    expect(access.inputs.size).toBe(1);
    expect(fake.plugin.start).toHaveBeenCalledTimes(2);
  });
});

describe('MIDIInput messages', () => {
  it('delivers one midimessage per message, as a Uint8Array', async () => {
    const { access, send } = await connect();
    const piano = access.inputs.get('1001')!;
    const received: Array<{ data: Uint8Array; self: unknown }> = [];
    piano.onmidimessage = function (this: unknown, event: Event) {
      received.push({
        data: (event as MIDIMessageEvent).data!,
        self: this,
      });
    };

    send('1001', [0x90, 60, 100], [0x80, 60, 0]);
    expect(received.map(({ data }) => [...data])).toEqual([
      [0x90, 60, 100],
      [0x80, 60, 0],
    ]);
    expect(received[0].data).toBeInstanceOf(Uint8Array);
    expect(received[0].self).toBe(piano);
  });

  it('is an ordinary event too, and a handler can be replaced or cleared', async () => {
    const { access, send } = await connect();
    const piano = access.inputs.get('1001')!;
    const viaListener = vi.fn();
    const first = vi.fn();
    const second = vi.fn();
    piano.addEventListener('midimessage', viaListener);
    piano.onmidimessage = first;
    piano.onmidimessage = second;
    send('1001', [0x90, 64, 90]);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(viaListener).toHaveBeenCalledTimes(1);

    piano.onmidimessage = null;
    expect(piano.onmidimessage).toBeNull();
    send('1001', [0x80, 64, 0]);
    expect(second).toHaveBeenCalledTimes(1);
    // Clearing the handler does not close the port (Web MIDI §4.5).
    expect(piano.connection).toBe('open');
    expect(viaListener).toHaveBeenCalledTimes(2);
  });

  it('routes each message to its own source only', async () => {
    const { access, send } = await connect([PIANO, PADS]);
    const piano = vi.fn();
    const pads = vi.fn();
    access.inputs.get('1001')!.onmidimessage = piano;
    access.inputs.get('2002')!.onmidimessage = pads;
    send('2002', [0x99, 36, 127]);
    send('9999', [0x90, 60, 100]);
    expect(piano).not.toHaveBeenCalled();
    expect(pads).toHaveBeenCalledTimes(1);
  });

  it('opens implicitly on onmidimessage, and delivers nothing to a closed port', async () => {
    const { access, send } = await connect();
    const piano = access.inputs.get('1001')!;
    const listener = vi.fn();
    piano.addEventListener('midimessage', listener);
    send('1001', [0x90, 60, 100]);
    expect(listener).not.toHaveBeenCalled();

    const changes = statechanges(access);
    piano.onmidimessage = () => {};
    expect(piano.connection).toBe('open');
    expect(changes).toEqual([
      { id: '1001', state: 'connected', connection: 'open' },
    ]);
    send('1001', [0x90, 60, 100]);
    expect(listener).toHaveBeenCalledTimes(1);

    await piano.close();
    expect(piano.connection).toBe('closed');
    send('1001', [0x80, 60, 0]);
    expect(listener).toHaveBeenCalledTimes(1);
    await expect(piano.open()).resolves.toBe(piano);
    expect(piano.connection).toBe('open');
  });

  it('never passes sysex, system or malformed messages on', async () => {
    const { access, send } = await connect();
    const piano = access.inputs.get('1001')!;
    const listener = vi.fn();
    piano.onmidimessage = listener;
    send(
      '1001',
      [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7],
      [0xf8],
      [0xfe],
      [0x40, 60],
      [0x90, 200, 100],
      [0x90, 60.5, 100],
      [],
      'nope' as unknown as number[],
      [0x90, 60, 100],
    );
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('isChannelVoiceMessage', () => {
  it('accepts 2–3 byte channel-voice messages only', () => {
    expect(isChannelVoiceMessage([0x90, 60, 100])).toBe(true);
    expect(isChannelVoiceMessage([0xc0, 5])).toBe(true);
    expect(isChannelVoiceMessage([0xef, 0, 64])).toBe(true);
    expect(isChannelVoiceMessage([0x7f, 60, 100])).toBe(false);
    expect(isChannelVoiceMessage([0xf0, 1, 2])).toBe(false);
    expect(isChannelVoiceMessage([0x90, 60, 100, 1])).toBe(false);
    expect(isChannelVoiceMessage([0x90])).toBe(false);
  });
});

describe('hot-plug (Chrome semantics)', () => {
  it('a new source is added to the live map and announced', async () => {
    const { access, setSources } = await connect();
    const inputs = access.inputs;
    const changes = statechanges(access);
    const handler = vi.fn();
    access.onstatechange = handler;

    setSources([PIANO, PADS]);
    expect(access.inputs).toBe(inputs);
    expect(inputs.get('2002')!.state).toBe('connected');
    expect(changes).toEqual([
      { id: '2002', state: 'connected', connection: 'closed' },
    ]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('a removed source stays as disconnected, and comes back as the same object', async () => {
    const { access, setSources, send } = await connect();
    const piano = access.inputs.get('1001')!;
    const received = vi.fn();
    piano.onmidimessage = received;
    const onAccess = statechanges(access);
    const onPort = statechanges(piano);

    setSources([]);
    expect(access.inputs.get('1001')).toBe(piano);
    expect(piano.state).toBe('disconnected');
    expect(piano.connection).toBe('pending');
    send('1001', [0x90, 60, 100]);
    expect(received).not.toHaveBeenCalled();

    setSources([{ ...PIANO, name: 'FP-30X (USB)' }]);
    expect(access.inputs.get('1001')).toBe(piano);
    expect(access.inputs.size).toBe(1);
    expect(piano.state).toBe('connected');
    expect(piano.connection).toBe('open');
    expect(piano.name).toBe('FP-30X (USB)');
    send('1001', [0x90, 60, 100]);
    expect(received).toHaveBeenCalledTimes(1);

    const expected = [
      { id: '1001', state: 'disconnected', connection: 'pending' },
      { id: '1001', state: 'connected', connection: 'open' },
    ];
    expect(onAccess).toEqual(expected);
    expect(onPort).toEqual(expected);
  });

  it('an unchanged list fires nothing', async () => {
    const { access, setSources } = await connect([PIANO, PADS]);
    const changes = statechanges(access);
    setSources([PADS, PIANO]);
    expect(changes).toEqual([]);
  });

  it('a port nobody opened stays closed across a replug', async () => {
    const { access, setSources } = await connect();
    const piano = access.inputs.get('1001')!;
    setSources([]);
    expect(piano.connection).toBe('closed');
    setSources([PIANO]);
    expect(piano.connection).toBe('closed');
  });

  it('ignores a malformed list rather than throwing', async () => {
    const { access, setSources } = await connect();
    setSources([null as unknown as MidiSource, { id: 7 } as never, PIANO]);
    expect([...access.inputs.keys()]).toEqual(['1001']);
  });
});

describe('installWebMidiShim', () => {
  it('defines requestMIDIAccess on the navigator', async () => {
    const nav = fakeNavigator();
    installWebMidiShim(nav, fakePlugin().plugin);
    expect('requestMIDIAccess' in nav).toBe(true);
    const access = (await nav.requestMIDIAccess()) as unknown as ShimMidiAccess;
    expect(access.inputs.size).toBe(1);
    expect(await nav.requestMIDIAccess()).toBe(access);
  });

  it('answers the midi permission granted, and passes every other name on', async () => {
    const nav = fakeNavigator();
    const original = nav.permissions.query;
    installWebMidiShim(nav, fakePlugin().plugin);

    const midi = await nav.permissions.query({
      name: 'midi' as PermissionName,
    });
    expect(midi.state).toBe('granted');
    expect(midi.name).toBe('midi');
    expect(original).not.toHaveBeenCalled();

    const camera = await nav.permissions.query({
      name: 'camera' as PermissionName,
    });
    expect(camera.state).toBe('prompt');
    expect(original).toHaveBeenCalledWith({ name: 'camera' });
  });

  it('defines a midi-only permissions object where the browser has none', async () => {
    const nav = fakeNavigator(false);
    installWebMidiShim(nav, fakePlugin().plugin);
    const midi = await nav.permissions.query({
      name: 'midi' as PermissionName,
    });
    expect(midi.state).toBe('granted');
    await expect(
      nav.permissions.query({ name: 'camera' as PermissionName }),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
