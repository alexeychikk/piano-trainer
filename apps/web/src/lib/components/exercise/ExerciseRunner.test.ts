import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import ExerciseRunner from './ExerciseRunner.svelte';
import { findTheNote } from '$lib/exercises/find-the-note';
import { progressionRecognition } from '$lib/exercises/progression-recognition';
import { DEFAULT_SETTINGS, settings } from '$lib/storage/settings.svelte';

/**
 * Markup-level rules only — the state machine is tested in
 * `runner.svelte.test.ts` and the drill itself in the e2e smoke path. What
 * matters here is what the re-skin (sci-fi-screens.md §5) put *in the DOM*:
 * the phase micro-label, the `go` variant of `Start`, and the retirement of
 * the emoji streak (§2.7).
 */
function mount() {
  const { container } = render(ExerciseRunner, {
    props: { definition: findTheNote },
  });
  return container;
}

describe('ExerciseRunner frame', () => {
  it('names the phase in the prompt well', () => {
    expect(mount().querySelector('.phase')?.textContent).toBe('Ready');
  });

  it('offers Start as the drill’s one "go" affordance', () => {
    const replay = mount().querySelector('[data-testid="replay"]');
    expect(replay?.className).toContain('go');
    expect(replay?.textContent).toContain('Start');
  });

  it('carries no emoji — the streak is a HUD readout (§2.7)', () => {
    const rail = mount().querySelector('.rail');
    expect(rail?.textContent).toContain('streak');
    expect(rail?.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('advertises the whole computer mapping, octave shift included (§4.6)', () => {
    // There is no MIDI device in a test environment, so the bar carries the
    // mapping — and the mapping is `A W S E D F T G Y H U J K` *plus* `Z`/`X`.
    const bar = mount().querySelector('.shortcuts');
    const caps = [...(bar?.querySelectorAll('kbd') ?? [])].map(
      (kbd) => kbd.textContent,
    );
    expect(caps).toContain('A W S E D F T G Y H U J K');
    expect(caps).toContain('Z');
    expect(caps).toContain('X');
    expect(bar?.textContent).toContain('octave');
  });

  it('shows the question count on the ProgressBar, not in a second place', () => {
    const bar = mount().querySelector('[data-testid="answered"]');
    expect(bar?.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(bar?.textContent).toContain('0/0');
  });
});

describe('ExerciseRunner frame · nothing to ask on this keyboard', () => {
  afterEach(() => {
    settings.value = { ...DEFAULT_SETTINGS };
  });

  /** A 14-semitone keyboard: an octave and a bit, narrower than any cadence. */
  function mountNarrow() {
    settings.value = { ...DEFAULT_SETTINGS, keyboardLow: 60, keyboardHigh: 74 };
    const { container } = render(ExerciseRunner, {
      props: { definition: progressionRecognition },
    });
    return container;
  }

  it('says the drill needs a wider keyboard instead of offering Start', () => {
    const container = mountNarrow();
    expect(container.querySelector('[data-testid="prompt"]')?.textContent).toBe(
      'This drill needs a wider keyboard',
    );
    expect(
      container.querySelector('[data-testid="prompt-sub"]')?.textContent,
    ).toBe('Widen the keyboard range in Settings');
    expect(container.querySelector('.phase')?.textContent).toBe('Unavailable');
    expect(container.querySelector('[data-testid="replay"]')).toBeNull();
  });

  it('links to the keyboard range in Settings', () => {
    const link = mountNarrow().querySelector(
      '[data-testid="nothing-to-ask-settings"]',
    );
    expect(link?.tagName).toBe('A');
    expect(link?.getAttribute('href')).toMatch(/\/settings\/?#practice$/);
    expect(link?.textContent).toContain('Open Settings');
  });

  it('is a normal drill on a keyboard wide enough', () => {
    const { container } = render(ExerciseRunner, {
      props: { definition: progressionRecognition },
    });
    expect(container.querySelector('[data-testid="prompt"]')?.textContent).toBe(
      'Ready?',
    );
    expect(container.querySelector('[data-testid="replay"]')).not.toBeNull();
  });
});
