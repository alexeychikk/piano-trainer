import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import NoMidiStrip from './NoMidiStrip.svelte';
import { midiInput } from '$lib/midi/input.svelte';
import { MIDI_COPY } from '$lib/midi/status';

/**
 * The strip Free Play and the runner show when there is no MIDI piano. With
 * `requestMIDIAccess` absent it explains why — and on an iPad (which reports
 * itself as a Mac with a touch screen) it never sends the user to Chrome,
 * which is WebKit there too (ADR 0005).
 */
function fakeIPad() {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: 5,
  });
}

describe('NoMidiStrip without Web MIDI', () => {
  beforeEach(() => {
    sessionStorage.clear();
    // @ts-expect-error — jsdom has none, but make sure of it
    delete navigator.requestMIDIAccess;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    // @ts-expect-error — removing the fake again
    delete navigator.maxTouchPoints;
  });

  it('points an iPad at a Web MIDI browser app, in text a screen reader reads', async () => {
    fakeIPad();
    await midiInput.autoConnect();
    render(NoMidiStrip);
    await tick();

    const line = screen.getByText(MIDI_COPY.unsupportedAppleMobile);
    expect(line.textContent).toContain('Web MIDI Browser');
    expect(line.textContent).not.toContain('Chrome');
    // Text in the document, not an `aria-hidden` decoration.
    expect(line.closest('[aria-hidden="true"]')).toBeNull();
    // Nothing to request: the strip offers the settings link instead.
    expect(screen.queryByText('Connect MIDI')).toBeNull();
    expect(screen.getByText('MIDI settings')).toBeTruthy();
  });

  it('keeps the generic wording on any other browser', async () => {
    await midiInput.autoConnect();
    render(NoMidiStrip);
    await tick();

    expect(screen.getByText(MIDI_COPY.unsupported)).toBeTruthy();
    expect(screen.queryByText(MIDI_COPY.unsupportedAppleMobile)).toBeNull();
  });
});
