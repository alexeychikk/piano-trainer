/**
 * The Web MIDI shim (ADR 0005 §4.1): `navigator.requestMIDIAccess` over the
 * shell's `CoreMidi` plugin, so `apps/web`'s `$lib/midi` sees ordinary Web
 * MIDI and never learns it is inside an app.
 *
 * It copies **Chrome's** semantics, because that is what `$lib/midi` was
 * written and tested against:
 * - `requestMIDIAccess()` is a real `Promise` and a singleton; `sysex: true`
 *   rejects with `NotSupportedError`; no user gesture is needed.
 * - `inputs` is a live `Map`, mutated in place. A removed source stays in it
 *   as `disconnected`, and the same unique id coming back revives the same
 *   object.
 * - `statechange` fires on the port and on the access, and every
 *   `onstatechange` / `onmidimessage` is also an ordinary event listener.
 * - A `midimessage` event carries exactly one message as a `Uint8Array`.
 * - `navigator.permissions.query({ name: 'midi' })` is `granted` — CoreMIDI
 *   has no permission, and that is what lets `autoConnect()` pick the piano
 *   back up on launch with no tap.
 *
 * Everything here is plain DOM + the plugin interface, injected, so it is
 * tested in Vitest against a fake plugin. `entry.ts` is the only file that
 * touches Capacitor.
 */

/** The local plugin's name, as `AppViewController` registers it (ADR §3.3). */
export const PLUGIN_NAME = 'CoreMidi';

/** A CoreMIDI source, as the plugin reports it (ADR §4.2). */
export interface MidiSource {
  /** `kMIDIPropertyUniqueID`, stringified. */
  id: string;
  /** `kMIDIPropertyDisplayName`. */
  name: string;
  /** Empty when CoreMIDI has none. */
  manufacturer: string;
}

export interface SourcesEvent {
  sources: MidiSource[];
}

/** One bridge call per CoreMIDI event list: channel-voice messages only. */
export interface MessagesEvent {
  id: string;
  data: number[][];
}

export interface ListenerHandle {
  remove(): Promise<void>;
}

/** What the shim needs from the native side (ADR §4.2). */
export interface CoreMidiPlugin {
  start(): Promise<SourcesEvent>;
  addListener(
    eventName: 'sourcesChanged',
    listener: (event: SourcesEvent) => void,
  ): Promise<ListenerHandle>;
  addListener(
    eventName: 'messages',
    listener: (event: MessagesEvent) => void,
  ): Promise<ListenerHandle>;
}

type PortState = 'connected' | 'disconnected';
type PortConnection = 'open' | 'closed' | 'pending';
type Handler<E extends Event> = ((event: E) => unknown) | null;

/** `MIDIConnectionEvent`: a `statechange` that names its port. */
function connectionEvent(port: ShimMidiInput): Event {
  const event = new Event('statechange');
  Object.defineProperty(event, 'port', { value: port, enumerable: true });
  return event;
}

/** `MIDIMessageEvent`: exactly one message, as bytes. */
function messageEvent(data: Uint8Array): Event {
  const event = new Event('midimessage');
  Object.defineProperty(event, 'data', { value: data, enumerable: true });
  return event;
}

/**
 * Only channel-voice messages travel (ADR §4.2): a status byte `0x80`–`0xEF`
 * followed by data bytes `0x00`–`0x7F`. CoreMidiPlugin already drops system
 * messages natively; this is the same rule on the JS side, so a sysex or a
 * malformed array can never reach `parseMidiMessage` — "no sysex" holds here
 * whatever the native side sends.
 */
export function isChannelVoiceMessage(bytes: readonly unknown[]): boolean {
  if (!Array.isArray(bytes) || bytes.length < 2 || bytes.length > 3) {
    return false;
  }
  const [status, ...rest] = bytes;
  if (!Number.isInteger(status)) return false;
  if ((status as number) < 0x80 || (status as number) > 0xef) return false;
  return rest.every(
    (byte) => Number.isInteger(byte) && byte >= 0 && byte <= 0x7f,
  );
}

/**
 * Event-handler attributes (`onstatechange`, `onmidimessage`) the way the DOM
 * has them: an ordinary listener registered once, which calls whatever handler
 * is set now.
 */
function handlerSlot<E extends Event>(
  target: EventTarget,
  type: string,
): { get(): Handler<E>; set(handler: Handler<E>): void } {
  let current: Handler<E> = null;
  target.addEventListener(type, (event) => {
    current?.call(target, event as E);
  });
  return {
    get: () => current,
    set: (handler) => {
      current = typeof handler === 'function' ? handler : null;
    },
  };
}

export class ShimMidiInput extends EventTarget {
  readonly type = 'input';
  readonly version = '';
  readonly id: string;
  #name: string;
  #manufacturer: string;
  #state: PortState = 'connected';
  #connection: PortConnection = 'closed';
  #access: ShimMidiAccess;
  #onmidimessage = handlerSlot<Event>(this, 'midimessage');
  #onstatechange = handlerSlot<Event>(this, 'statechange');

  constructor(source: MidiSource, access: ShimMidiAccess) {
    super();
    this.id = source.id;
    this.#name = source.name;
    this.#manufacturer = source.manufacturer ?? '';
    this.#access = access;
  }

  get name(): string {
    return this.#name;
  }
  get manufacturer(): string {
    return this.#manufacturer;
  }
  get state(): PortState {
    return this.#state;
  }
  get connection(): PortConnection {
    return this.#connection;
  }

  get onmidimessage(): Handler<Event> {
    return this.#onmidimessage.get();
  }
  /** Setting a handler opens the port implicitly, as in Chrome. */
  set onmidimessage(handler: Handler<Event>) {
    this.#onmidimessage.set(handler);
    if (handler) void this.open();
  }

  get onstatechange(): Handler<Event> {
    return this.#onstatechange.get();
  }
  set onstatechange(handler: Handler<Event>) {
    this.#onstatechange.set(handler);
  }

  open(): Promise<this> {
    if (this.#connection === 'closed') {
      this.#setConnection(
        this.#state === 'connected' ? 'open' : 'pending',
        true,
      );
    }
    return Promise.resolve(this);
  }

  close(): Promise<this> {
    if (this.#connection !== 'closed') this.#setConnection('closed', true);
    return Promise.resolve(this);
  }

  /** The plugin's view of this source changed. Internal to the shim. */
  _update(source: MidiSource | null): void {
    if (source) {
      this.#name = source.name;
      this.#manufacturer = source.manufacturer ?? '';
    }
    const state: PortState = source ? 'connected' : 'disconnected';
    if (state === this.#state) return;
    this.#state = state;
    // An open port that loses its device waits as `pending` and opens again
    // when it returns (Web MIDI §4.4, what Chrome does).
    if (state === 'disconnected' && this.#connection === 'open') {
      this.#connection = 'pending';
    } else if (state === 'connected' && this.#connection === 'pending') {
      this.#connection = 'open';
    }
    this.#notify();
  }

  /** Deliver one bridged message, if the port can receive it. */
  _receive(bytes: readonly number[]): void {
    if (this.#state !== 'connected' || this.#connection !== 'open') return;
    if (!isChannelVoiceMessage(bytes)) return;
    this.dispatchEvent(messageEvent(Uint8Array.from(bytes)));
  }

  #setConnection(connection: PortConnection, notify: boolean): void {
    this.#connection = connection;
    if (notify) this.#notify();
  }

  #notify(): void {
    this.dispatchEvent(connectionEvent(this));
    this.#access.dispatchEvent(connectionEvent(this));
  }
}

export class ShimMidiAccess extends EventTarget {
  /** Live: ports are added and updated in place, never removed. */
  readonly inputs = new Map<string, ShimMidiInput>();
  readonly outputs = new Map<string, never>();
  readonly sysexEnabled = false;
  #onstatechange = handlerSlot<Event>(this, 'statechange');

  get onstatechange(): Handler<Event> {
    return this.#onstatechange.get();
  }
  set onstatechange(handler: Handler<Event>) {
    this.#onstatechange.set(handler);
  }

  /**
   * Bring `inputs` in line with the plugin's full list of sources. `notify`
   * is off for the list `start()` returns: ports present when access is
   * granted fire nothing, as in Chrome.
   */
  _applySources(sources: readonly MidiSource[], notify = true): void {
    const present = new Map<string, MidiSource>();
    for (const source of sources ?? []) {
      if (source && typeof source.id === 'string') {
        present.set(source.id, source);
      }
    }
    for (const [id, source] of present) {
      const port = this.inputs.get(id);
      if (port) {
        port._update(source);
        continue;
      }
      const added = new ShimMidiInput(source, this);
      this.inputs.set(id, added);
      if (notify) this.dispatchEvent(connectionEvent(added));
    }
    for (const [id, port] of this.inputs) {
      if (!present.has(id)) port._update(null);
    }
  }

  _receive(event: MessagesEvent): void {
    const port = this.inputs.get(event?.id);
    if (!port || !Array.isArray(event.data)) return;
    for (const bytes of event.data) port._receive(bytes);
  }
}

export interface RequestMidiAccessOptions {
  sysex?: boolean;
  software?: boolean;
}

/**
 * `navigator.requestMIDIAccess` over a plugin. The access is a singleton; a
 * failed start is not cached, so a later `Connect MIDI` tap tries again.
 */
export function createRequestMidiAccess(
  plugin: CoreMidiPlugin,
): (options?: RequestMidiAccessOptions) => Promise<ShimMidiAccess> {
  let pending: Promise<ShimMidiAccess> | null = null;

  async function open(): Promise<ShimMidiAccess> {
    const access = new ShimMidiAccess();
    // Listen before starting, so a source plugged in during `start()` is
    // not missed; both are full lists, so the later one simply wins.
    await plugin.addListener('sourcesChanged', (event) =>
      access._applySources(event?.sources ?? []),
    );
    await plugin.addListener('messages', (event) => access._receive(event));
    let started: SourcesEvent;
    try {
      started = await plugin.start();
    } catch (error) {
      throw new DOMException(
        `CoreMIDI could not start: ${String(error)}`,
        'InvalidStateError',
      );
    }
    access._applySources(started?.sources ?? [], false);
    return access;
  }

  return (options) => {
    if (options?.sysex) {
      return Promise.reject(
        new DOMException(
          'System exclusive is not supported.',
          'NotSupportedError',
        ),
      );
    }
    pending ??= open().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
}

/** A `PermissionStatus` that is, and stays, `granted`. */
function grantedMidiStatus(): PermissionStatus {
  const status = new EventTarget() as PermissionStatus;
  Object.defineProperties(status, {
    name: { value: 'midi', enumerable: true },
    state: { value: 'granted', enumerable: true },
    onchange: { value: null, writable: true, enumerable: true },
  });
  return status;
}

function isMidiDescriptor(descriptor: unknown): boolean {
  return (
    typeof descriptor === 'object' &&
    descriptor !== null &&
    (descriptor as { name?: unknown }).name === 'midi'
  );
}

/**
 * `{ name: 'midi' }` is `granted`; every other name goes to the browser's own
 * `query`. Where the browser has no `navigator.permissions` at all (Safari
 * before 16), one is defined that only knows `midi`.
 */
function installMidiPermission(nav: Navigator): void {
  const permissions = nav.permissions as Permissions | undefined;
  if (permissions && typeof permissions.query === 'function') {
    const original = permissions.query.bind(permissions);
    Object.defineProperty(permissions, 'query', {
      configurable: true,
      writable: true,
      value: (descriptor: PermissionDescriptor) =>
        isMidiDescriptor(descriptor)
          ? Promise.resolve(grantedMidiStatus())
          : original(descriptor),
    });
    return;
  }
  Object.defineProperty(nav, 'permissions', {
    configurable: true,
    value: {
      query: (descriptor: PermissionDescriptor) =>
        isMidiDescriptor(descriptor)
          ? Promise.resolve(grantedMidiStatus())
          : Promise.reject(new TypeError('Unsupported permission name.')),
    },
  });
}

export interface ShimEnvironment {
  navigator: Navigator;
  /** `Capacitor.isNativePlatform()` — we are inside the shell. */
  isNativePlatform: boolean;
  /** `Capacitor.isPluginAvailable('CoreMidi')` — the native side is there. */
  pluginAvailable: boolean;
}

/**
 * ADR §4.1: install only inside the shell, only when the plugin is there, and
 * only when the browser has no Web MIDI of its own — so a future WebKit that
 * ships Web MIDI wins by itself, and a shell without the plugin (ADR §9
 * ticket 3) falls back to the on-screen keyboard.
 */
export function shouldInstall(env: ShimEnvironment): boolean {
  return (
    env.isNativePlatform &&
    env.pluginAvailable &&
    !('requestMIDIAccess' in env.navigator)
  );
}

/** Define `navigator.requestMIDIAccess` and the `midi` permission. */
export function installWebMidiShim(
  nav: Navigator,
  plugin: CoreMidiPlugin,
): void {
  Object.defineProperty(nav, 'requestMIDIAccess', {
    configurable: true,
    writable: true,
    value: createRequestMidiAccess(plugin),
  });
  installMidiPermission(nav);
}
