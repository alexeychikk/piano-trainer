import { describe, expect, it } from 'vitest';
import {
  AUDIO_COPY,
  audioExplanation,
  soundChip,
  type AudioStatus,
} from './status';

const STATUSES: AudioStatus[] = [
  'idle',
  'loading',
  'ready',
  'fallback',
  'failed',
];

describe('soundChip', () => {
  it('asks for the gesture that starts audio, in the copy deck wording', () => {
    const chip = soundChip({ status: 'idle', muted: false });
    expect(chip.label).toBe('Click to enable sound');
    expect(chip.tone).toBe('warn');
    expect(chip.pulse).toBe(true);
  });

  it('still asks for the gesture when muted — there is no audio yet', () => {
    expect(soundChip({ status: 'idle', muted: true }).label).toBe(
      'Click to enable sound',
    );
  });

  it('reports muted once audio is running', () => {
    const chip = soundChip({ status: 'ready', muted: true });
    expect(chip.label).toBe('Sound muted');
    expect(chip.srLabel).toContain('muted');
  });

  it('distinguishes loading, ready and the synth fallback', () => {
    expect(soundChip({ status: 'loading', muted: false }).label).toBe(
      'Loading sounds',
    );
    expect(soundChip({ status: 'ready', muted: false }).tone).toBe('success');
    const fallback = soundChip({ status: 'fallback', muted: false });
    expect(fallback.label).toBe('Built-in synth');
    expect(fallback.tone).toBe('warn');
  });

  it('reports a browser without Web Audio as the only danger state', () => {
    const chip = soundChip({ status: 'failed', muted: false });
    expect(chip.tone).toBe('danger');
    expect(chip.label).toBe('No sound');
  });

  it('never leans on colour alone: a distinct glyph per state', () => {
    const glyphs = STATUSES.map(
      (status) => soundChip({ status, muted: false }).glyph,
    );
    expect(new Set(glyphs).size).toBe(glyphs.length);
    expect(soundChip({ status: 'ready', muted: true }).glyph).not.toBe(
      soundChip({ status: 'ready', muted: false }).glyph,
    );
  });

  it('spells the state out for screen readers', () => {
    for (const status of STATUSES) {
      const chip = soundChip({ status, muted: false });
      expect(chip.srLabel.startsWith('Sound:')).toBe(true);
      expect(chip.srLabel.length).toBeGreaterThan(chip.label.length);
    }
  });
});

describe('audioExplanation', () => {
  it('uses the copy deck verbatim', () => {
    expect(audioExplanation({ status: 'idle' })).toBe(AUDIO_COPY.notStarted);
    expect(audioExplanation({ status: 'fallback' })).toBe(
      AUDIO_COPY.soundfontFailed,
    );
  });

  it('says nothing when sound simply works', () => {
    expect(audioExplanation({ status: 'ready' })).toBeNull();
    expect(audioExplanation({ status: 'loading' })).toBeNull();
  });

  it('explains a browser with no Web Audio without making it a failure', () => {
    expect(audioExplanation({ status: 'failed' })).toContain('still works');
  });
});
