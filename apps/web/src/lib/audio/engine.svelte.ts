/**
 * The one audio engine (ADR 0001 §2). It owns the single `AudioContext`, the
 * master gain, instrument loading and the instrument cache, and it is the only
 * thing in the app that makes a sound.
 *
 * Two rules shape the API:
 *
 * 1. **Nothing before a gesture.** No `AudioContext` exists until
 *    `ensureStarted()` is called from a real user gesture (autoplay policy).
 *    Until then the engine is `idle` and every `noteOn` is a silent no-op.
 * 2. **Never await on the way to a note.** `noteOn` is synchronous and plays
 *    through whatever source is ready — the sampled instrument when it has
 *    loaded, the built-in synth while it is still downloading or when it
 *    failed. That keeps the ADR's < 30 ms key-to-sound budget and means a
 *    dead CDN degrades to a thinner sound, never to silence or a crash.
 */

import { settings } from '$lib/storage/settings.svelte';
import type { Midi } from '$lib/theory';
import {
  DEFAULT_VELOCITY,
  clampVelocity,
  headroomScale,
  sampledVelocity,
  sampledVoiceGain,
  volumeGain,
} from './gain';
import { DEFAULT_INSTRUMENT, isInstrumentId } from './instruments';
import type { NotePlan, NoteSourceApi, StopVoice } from './source';
import { soundChip, type AudioStatus } from './status';
import { createSynthSource, scheduleClick } from './synth';

/** How long a `playNote` without an explicit duration rings. */
export const DEFAULT_NOTE_S = 0.9;

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof globalThis === 'undefined') return null;
  const candidate = (globalThis as { AudioContext?: AudioContextCtor })
    .AudioContext;
  return candidate ?? null;
}

export class AudioEngine {
  status = $state<AudioStatus>('idle');
  /** Which instrument the loaded source belongs to (for the settings UI). */
  loadedInstrument = $state<string | null>(null);

  /** Called once when the soundfont fails and the synth takes over. */
  onFallback: (() => void) | null = null;

  #ctx: AudioContext | null = null;
  #master: GainNode | null = null;
  #synth: NoteSourceApi | null = null;
  #sampled: NoteSourceApi | null = null;
  /** Instrument id → source, so switching back is instant (ADR §2 cache). */
  #cache = new Map<string, NoteSourceApi>();
  #loading: string | null = null;
  #held = new Map<Midi, StopVoice[]>();

  /** Top-bar chip descriptor (UX spec §2.2). */
  chip = $derived(soundChip({ status: this.status, muted: this.muted }));

  get muted(): boolean {
    return !settings.value.soundEnabled;
  }

  get started(): boolean {
    return this.#ctx !== null;
  }

  /** The audio clock, in seconds. 0 before the context exists. */
  now(): number {
    return this.#ctx?.currentTime ?? 0;
  }

  get destination(): AudioNode | null {
    return this.#master;
  }

  // ---- lifecycle ---------------------------------------------------------

  /**
   * Create (or resume) the context and start loading the instrument. Must be
   * called from a user gesture; calling it again is cheap and safe.
   */
  async ensureStarted(): Promise<void> {
    if (this.#ctx) {
      if (this.#ctx.state === 'suspended') await this.#ctx.resume();
      return;
    }
    const Ctor = audioContextCtor();
    if (!Ctor) {
      this.status = 'failed';
      return;
    }

    const ctx = new Ctor({ latencyHint: 'interactive' });
    const master = ctx.createGain();
    master.gain.value = volumeGain(settings.value.volume, this.muted);
    master.connect(ctx.destination);

    this.#ctx = ctx;
    this.#master = master;
    this.#synth = createSynthSource(ctx, master);
    this.status = 'loading';

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Some browsers reject a resume outside a gesture; the next gesture
        // retries, and the state stays honest either way.
      }
    }

    await this.#loadInstrument(this.#instrumentId);
  }

  get #instrumentId(): string {
    const stored = settings.value.instrument;
    return isInstrumentId(stored) ? stored : DEFAULT_INSTRUMENT;
  }

  async #loadInstrument(id: string): Promise<void> {
    const ctx = this.#ctx;
    const master = this.#master;
    if (!ctx || !master) return;

    const cached = this.#cache.get(id);
    if (cached) {
      this.#sampled = cached;
      this.loadedInstrument = id;
      this.status = 'ready';
      return;
    }

    this.#loading = id;
    if (this.status !== 'fallback') this.status = 'loading';

    try {
      // Imported lazily: the soundfont library is only needed once audio is
      // actually running, and it must never weigh on the first paint.
      const { Soundfont } = await import('smplr');
      const instrument = Soundfont(ctx, {
        instrument: id,
        destination: master,
      });
      await instrument.ready;
      if (this.#loading !== id) return; // A newer choice won the race.

      const source: NoteSourceApi = {
        start: ({ midi, velocity, time, duration, gainScale }: NotePlan) =>
          instrument.start({
            note: midi,
            // `smplr`'s `NoteEvent` has no gain field, so the headroom is
            // applied by lowering the velocity to the one that reaches it.
            velocity: sampledVelocity(velocity, gainScale),
            time,
            duration,
          }),
        stop: (midi?: Midi) =>
          midi === undefined ? instrument.stop() : instrument.stop(midi),
        dispose: () => instrument.dispose(),
        voiceGain: sampledVoiceGain,
      };
      this.#cache.set(id, source);
      this.#sampled = source;
      this.loadedInstrument = id;
      this.status = 'ready';
    } catch {
      // Offline or the CDN is down: the synth carries on (ADR §2 fallback).
      if (this.#loading !== id) return;
      this.#sampled = null;
      this.loadedInstrument = null;
      const first = this.status !== 'fallback';
      this.status = 'fallback';
      if (first) this.onFallback?.();
    } finally {
      if (this.#loading === id) this.#loading = null;
    }
  }

  // ---- settings ----------------------------------------------------------

  /**
   * Persist and apply the master volume (UX spec §6.3: applies at once).
   *
   * The gain moves now; only the `localStorage` write is debounced. A slider
   * drag fires `input` every few milliseconds and each one was serialising the
   * whole settings object synchronously — this is the one control in the app
   * that changes continuously (slice 5b). `settings.flush()` commits it early
   * (the slider's `change`), and anything that *reads* storage flushes first.
   */
  setVolume(volume: number): void {
    settings.patchSoon({ volume });
    this.#applyGain();
  }

  setMuted(muted: boolean): void {
    settings.patch({ soundEnabled: !muted });
    if (muted) this.stopAll();
    this.#applyGain();
  }

  toggleMuted(): void {
    this.setMuted(!this.muted);
  }

  /**
   * Switch instrument; the previous one stays cached.
   *
   * The id is validated *before* it is persisted, not only before it is
   * loaded: `/settings`' instrument `<select>` renders its options from
   * `INSTRUMENTS`, so a stored id that is none of them selects no option and
   * the control renders blank — the remembered-device defect again — while
   * audio quietly plays the default. Display and sound must agree whatever
   * the source (a hand-edited `localStorage`, an imported file), and the
   * engine is where the guard lives because `storage` may not import this
   * layer.
   */
  setInstrument(raw: string): void {
    const id = isInstrumentId(raw) ? raw : DEFAULT_INSTRUMENT;
    settings.patch({ instrument: id });
    if (!this.#ctx) return;
    this.stopAll();
    void this.#loadInstrument(id);
  }

  #applyGain(): void {
    const master = this.#master;
    const ctx = this.#ctx;
    if (!master || !ctx) return;
    const target = volumeGain(settings.value.volume, this.muted);
    // A short ramp instead of a jump: stepping a gain node clicks.
    master.gain.setTargetAtTime(target, ctx.currentTime, 0.01);
  }

  // ---- notes -------------------------------------------------------------

  /** The source a note plays through right now. Never awaits. */
  get #source(): NoteSourceApi | null {
    if (this.muted) return null;
    return this.#sampled ?? this.#synth;
  }

  /**
   * Start several voices as one group, with the summed-gain headroom applied
   * (`headroomScale`): their peaks together cannot exceed `SUMMED_PEAK_CEILING`,
   * whatever the source and however many voices there are.
   *
   * A group is what one call starts *at one time* — a chord, or a single note.
   * Voices that merely overlap because the user is holding keys are not a
   * group: they arrive one `noteOn` at a time, and a voice already sounding
   * cannot be turned down without a shared node that would duck it audibly.
   * The engine's own playback — every exercise, every reveal — always starts a
   * chord in one call, which is the path the headroom exists for.
   */
  #startGroup(
    source: NoteSourceApi,
    plans: readonly Omit<NotePlan, 'gainScale'>[],
  ): StopVoice[] {
    const gainScale = headroomScale(
      plans.map((plan) => source.voiceGain(plan.velocity)),
    );
    return plans.map((plan) => source.start({ ...plan, gainScale }));
  }

  /** Press a note. Silent (and harmless) before `ensureStarted()`. */
  noteOn(midi: Midi, velocity: number = DEFAULT_VELOCITY): void {
    const source = this.#source;
    if (!source) return;
    const [stop] = this.#startGroup(source, [
      { midi, velocity: clampVelocity(velocity) },
    ]);
    const held = this.#held.get(midi) ?? [];
    held.push(stop);
    this.#held.set(midi, held);
  }

  /** Release a note. */
  noteOff(midi: Midi): void {
    const held = this.#held.get(midi);
    this.#held.delete(midi);
    if (held) for (const stop of held) stop();
    // The sampled source tracks its own voices too; ask it as well, so a note
    // started before a source switch cannot hang.
    this.#sampled?.stop(midi);
  }

  /** Play a note for a fixed time — the exercise playback primitive. */
  playNote(
    midi: Midi,
    options: { duration?: number; velocity?: number; time?: number } = {},
  ): void {
    this.playChord([midi], options);
  }

  /**
   * All notes together (slice 7 chord playback) — one start group, so the
   * chord's voices share the headroom budget. `playNote` is the group of one.
   */
  playChord(
    notes: readonly Midi[],
    options: { duration?: number; velocity?: number; time?: number } = {},
  ): void {
    const source = this.#source;
    if (!source) return;
    const time = options.time ?? this.now();
    const velocity = clampVelocity(options.velocity ?? DEFAULT_VELOCITY);
    const duration = options.duration ?? DEFAULT_NOTE_S;
    this.#startGroup(
      source,
      notes.map((midi) => ({ midi, velocity, time, duration })),
    );
  }

  /**
   * A melodic line: each step's `at` is an offset in seconds from the start,
   * scheduled on the audio clock in one go (ADR §2 — no `setTimeout` chains).
   *
   * One step is one start group: the steps are a line, not a chord. Anything
   * that wants several notes to share a headroom budget is a `playChord`, which
   * is what a `PlaybackPlan` event becomes.
   */
  playSequence(
    steps: readonly { midi: Midi; at: number; duration?: number }[],
    options: { velocity?: number; startTime?: number } = {},
  ): void {
    const start = options.startTime ?? this.now();
    for (const step of steps) {
      this.playNote(step.midi, {
        velocity: options.velocity,
        time: start + step.at,
        duration: step.duration,
      });
    }
  }

  /** One metronome click, always through the synth (no samples needed). */
  click(time: number, accent: boolean): void {
    const ctx = this.#ctx;
    const master = this.#master;
    if (!ctx || !master || this.muted) return;
    scheduleClick(ctx, master, time, accent);
  }

  /** Cut every sounding note. */
  stopAll(): void {
    for (const held of this.#held.values()) for (const stop of held) stop();
    this.#held.clear();
    this.#sampled?.stop();
    this.#synth?.stop();
  }

  /** Tear the engine down (tests, hot reload). */
  async destroy(): Promise<void> {
    this.stopAll();
    for (const source of this.#cache.values()) source.dispose();
    this.#cache.clear();
    this.#synth?.dispose();
    this.#synth = null;
    this.#sampled = null;
    this.loadedInstrument = null;
    const ctx = this.#ctx;
    this.#ctx = null;
    this.#master = null;
    this.status = 'idle';
    await ctx?.close();
  }
}

/** The app-wide engine. Components read `audio.chip`, call `audio.noteOn`, … */
export const audio = new AudioEngine();
