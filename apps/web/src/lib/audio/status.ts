/**
 * How the audio engine is described on screen (UX spec §2.2 chip table and the
 * §9 copy deck). Pure, like `$lib/midi/status.ts`: the wording lives here, so
 * the top bar, Free Play and Settings never invent their own.
 *
 * Sound is never blocking — "not started" is a normal first state that one
 * click or keypress resolves, and a missing soundfont degrades to the built-in
 * synth rather than to an error.
 */

export type AudioStatus =
  /** No `AudioContext` yet — ADR §2: it is created on a user gesture only. */
  | 'idle'
  /** The context exists; the instrument is still downloading. */
  | 'loading'
  /** Sampled instrument ready. */
  | 'ready'
  /** Samples unavailable (offline, CDN down): the built-in synth is playing. */
  | 'fallback'
  /** This browser has no Web Audio at all — nothing will sound. */
  | 'failed';

export interface SoundChip {
  glyph: string;
  label: string;
  /** Spelled-out accessible name; the glyph carries the state too. */
  srLabel: string;
  tone: 'muted' | 'success' | 'warn' | 'danger';
  /** UX spec §2.2: the "audio not started" chip pulses once per 4 s. */
  pulse: boolean;
}

export interface SoundChipInput {
  status: AudioStatus;
  muted: boolean;
}

/** The top-bar sound chip (UX spec §2.2). Never colour alone. */
export function soundChip({ status, muted }: SoundChipInput): SoundChip {
  if (status === 'failed') {
    return {
      glyph: '⊘',
      label: 'No sound',
      srLabel: 'Sound: this browser has no Web Audio',
      tone: 'danger',
      pulse: false,
    };
  }
  if (status === 'idle') {
    return {
      glyph: '🔇',
      label: 'Click to enable sound',
      srLabel: 'Sound: not started, click or press a key to enable it',
      tone: 'warn',
      pulse: true,
    };
  }
  if (muted) {
    return {
      glyph: '🔈',
      label: 'Sound muted',
      srLabel: 'Sound: muted, press M to unmute',
      tone: 'muted',
      pulse: false,
    };
  }
  if (status === 'loading') {
    return {
      glyph: '⟳',
      label: 'Loading sounds',
      srLabel: 'Sound: loading the instrument',
      tone: 'muted',
      pulse: false,
    };
  }
  if (status === 'fallback') {
    return {
      glyph: '⚠',
      label: 'Built-in synth',
      srLabel: 'Sound: soundfont unavailable, using the built-in synth',
      tone: 'warn',
      pulse: false,
    };
  }
  return {
    glyph: '🔊',
    label: 'Sound on',
    srLabel: 'Sound: ready',
    tone: 'success',
    pulse: false,
  };
}

/** Copy deck §9, verbatim. */
export const AUDIO_COPY = {
  notStarted: `Click or press a key to enable sound`,
  soundfontFailed: `Soundfont unavailable — using the built-in synth.`,
} as const;

/**
 * The one-line explanation for the current state, or `null` when there is
 * nothing to say (sound is working, or it is merely muted on purpose).
 */
export function audioExplanation({
  status,
}: Pick<SoundChipInput, 'status'>): string | null {
  if (status === 'idle') return AUDIO_COPY.notStarted;
  if (status === 'fallback') return AUDIO_COPY.soundfontFailed;
  if (status === 'failed') {
    return `This browser has no Web Audio — the app still works, silently.`;
  }
  return null;
}
