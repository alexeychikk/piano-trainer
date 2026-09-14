import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import ExerciseRunner from './ExerciseRunner.svelte';
import { findTheNote } from '$lib/exercises/find-the-note';

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

  it('shows the question count on the ProgressBar, not in a second place', () => {
    const bar = mount().querySelector('[data-testid="answered"]');
    expect(bar?.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(bar?.textContent).toContain('0/0');
  });
});
