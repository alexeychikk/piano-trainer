/**
 * The one MIDI input store (ADR 0001 §3). Every note source — the MIDI port,
 * the on-screen keyboard and the computer keys — feeds the same held-note set
 * and the same event stream, so nothing downstream knows where a note came
 * from.
 *
 * Shared reactive state as a class instance in a `*.svelte.ts` module; the
 * pure parts (message decoding, held-note transitions, status copy) live in
 * `events.ts` / `status.ts` and are unit-tested without a browser.
 */

import {
  DEFAULT_VELOCITY,
  applyNoteEvent,
  heldMidiNotes,
  parseMidiMessage,
} from './events';
import type { HeldNotes, NoteEvent, NoteSource } from './events';
import { midiChip, midiExplanation, type MidiStatus } from './status';
import { settings } from '$lib/storage/settings.svelte';
import type { Midi } from '$lib/theory';

export interface MidiDevice {
  /** Port id — not stable across sessions, use `key` for persistence. */
  id: string;
  /** `${manufacturer}:${name}` — what we remember. */
  key: string;
  name: string;
  manufacturer: string;
}

export function deviceKey(manufacturer: string, name: string): string {
  return `${manufacturer}:${name}`;
}

type NoteListener = (event: NoteEvent) => void;

export class MidiInput {
  status = $state<MidiStatus>('idle');
  devices = $state<MidiDevice[]>([]);
  heldNotes = $state<HeldNotes>(new Map());

  /** Called when the selected device disappears; the UI shows a banner. */
  onDeviceLost: ((deviceName: string) => void) | null = null;

  #access: MIDIAccess | null = null;
  #listeners = new Set<NoteListener>();
  #ports = new Map<string, MIDIInput>();

  /** Held notes, ascending. */
  held: Midi[] = $derived(heldMidiNotes(this.heldNotes));

  /** The remembered device, when it is currently present. */
  selectedDevice: MidiDevice | null = $derived(
    this.devices.find(
      (device) => device.key === settings.value.midiDeviceKey,
    ) ?? null,
  );

  /** Top-bar chip descriptor (UX spec §2.2). */
  chip = $derived(
    midiChip({
      status: this.status,
      inputCount: this.devices.length,
      deviceName: this.selectedDevice?.name ?? null,
    }),
  );

  /** One-line explanation of the current state, `null` when connected. */
  explanation: string | null = $derived(
    midiExplanation({
      status: this.status,
      inputCount: this.devices.length,
      deviceName: this.selectedDevice?.name ?? null,
    }),
  );

  connected: boolean = $derived(this.selectedDevice !== null);

  get supported(): boolean {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  // ---- note events ------------------------------------------------------

  /** Subscribe to the event stream. Returns an unsubscribe function. */
  subscribe(listener: NoteListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Feed an event in from any source. */
  emit(event: NoteEvent): void {
    const next = applyNoteEvent(this.heldNotes, event);
    if (next !== this.heldNotes) this.heldNotes = next;
    for (const listener of this.#listeners) listener(event);
  }

  noteOn(
    midi: Midi,
    source: NoteSource,
    velocity: number = DEFAULT_VELOCITY,
  ): void {
    this.emit({ type: 'on', midi, velocity, at: now(), source });
  }

  noteOff(midi: Midi, source: NoteSource): void {
    this.emit({ type: 'off', midi, at: now(), source });
  }

  /** Release everything — used on blur and when a device goes away. */
  releaseAll(source: NoteSource = 'midi'): void {
    for (const midi of this.held) this.noteOff(midi, source);
  }

  // ---- access & devices -------------------------------------------------

  /**
   * Request Web MIDI access. Must be called from a user gesture (ADR §3);
   * `autoConnect()` is the silent variant for an already-granted permission.
   */
  async connect(): Promise<void> {
    if (!this.supported) {
      this.status = 'unsupported';
      return;
    }
    if (this.#access) {
      this.#refreshDevices();
      return;
    }
    this.status = 'requesting';
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      this.#access = access;
      this.status = 'granted';
      access.onstatechange = () => this.#refreshDevices();
      this.#refreshDevices();
    } catch {
      this.status = 'denied';
    }
  }

  /**
   * Connect without prompting: only when the permission is already granted,
   * so a reload picks the piano back up but a first visit stays quiet.
   */
  async autoConnect(): Promise<void> {
    if (!this.supported) {
      this.status = 'unsupported';
      return;
    }
    let permission: PermissionStatus | undefined;
    try {
      permission = await navigator.permissions?.query({
        name: 'midi' as PermissionName,
      });
    } catch {
      // The query itself failed (some browsers reject the unknown `midi`
      // permission name); fall through to the same "ask nothing" branch.
      permission = undefined;
    }
    // Without a definite `granted` we must not touch `requestMIDIAccess`:
    // ADR §3 forbids prompting on page load, and a browser that exposes no
    // `navigator.permissions` at all would do exactly that. Stay `idle` and
    // wait for the user's gesture (`connect()`).
    if (permission?.state !== 'granted') {
      if (permission?.state === 'denied') this.status = 'denied';
      return;
    }
    await this.connect();
  }

  /** Remember a device (or `null` for none) and listen to it. */
  select(key: string | null): void {
    settings.patch({ midiDeviceKey: key });
    this.#attachPorts();
  }

  #refreshDevices(): void {
    const access = this.#access;
    if (!access) return;
    const devices: MidiDevice[] = [];
    access.inputs.forEach((port) => {
      if (port.state === 'disconnected') return;
      const name = port.name ?? 'MIDI device';
      const manufacturer = port.manufacturer ?? '';
      devices.push({
        id: port.id,
        key: deviceKey(manufacturer, name),
        name,
        manufacturer,
      });
    });

    const previous = this.selectedDevice;
    this.devices = devices;

    const remembered = settings.value.midiDeviceKey;
    const stillThere = devices.some((device) => device.key === remembered);

    if (previous && !stillThere) {
      // Keep the remembered key: the same piano reappears when it is switched
      // back on. Just say so and fall back to the on-screen keyboard.
      this.releaseAll();
      this.onDeviceLost?.(previous.name);
    }

    // Auto-select the only input when nothing is remembered (ADR §3).
    if (!remembered && devices.length === 1) {
      settings.patch({ midiDeviceKey: devices[0].key });
    }

    this.#attachPorts();
  }

  /** Listen to the selected port only, so other gear cannot inject notes. */
  #attachPorts(): void {
    const access = this.#access;
    if (!access) return;
    const wanted = settings.value.midiDeviceKey;
    const seen = new Set<string>();

    access.inputs.forEach((port) => {
      const key = deviceKey(
        port.manufacturer ?? '',
        port.name ?? 'MIDI device',
      );
      if (key !== wanted) {
        if (this.#ports.has(port.id)) {
          port.onmidimessage = null;
          this.#ports.delete(port.id);
        }
        return;
      }
      seen.add(port.id);
      if (this.#ports.has(port.id)) return;
      port.onmidimessage = (event: MIDIMessageEvent) => {
        if (!event.data) return;
        const parsed = parseMidiMessage(event.data, now());
        if (parsed) this.emit(parsed);
      };
      this.#ports.set(port.id, port);
    });

    for (const [id, port] of this.#ports) {
      if (seen.has(id)) continue;
      port.onmidimessage = null;
      this.#ports.delete(id);
    }
  }

  /** Drop every listener and port handler (tests, teardown). */
  destroy(): void {
    for (const port of this.#ports.values()) port.onmidimessage = null;
    this.#ports.clear();
    this.#listeners.clear();
    if (this.#access) this.#access.onstatechange = null;
    this.#access = null;
    this.heldNotes = new Map();
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** The app-wide input. Components read `midiInput.held`, `midiInput.chip`, … */
export const midiInput = new MidiInput();
