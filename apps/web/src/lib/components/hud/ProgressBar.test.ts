import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import ProgressBar from './ProgressBar.svelte';

/**
 * The markup carries a rule here: the data ramp must span the *track*, not the
 * fill, or two bars at the same value would read as different colours in
 * differently sized panels (sci-fi visual language §2.3) — and, since the fix
 * of sci-fi-screens.md §2.4, it must keep spanning it *while* the value
 * animates. So the ramp layer is full-track and the value is a clip.
 */
function parts(value: number) {
  const { container } = render(ProgressBar, {
    props: { value, label: 'Mastery' },
  });
  const fill = container.querySelector<HTMLElement>('.fill');
  const cap = container.querySelector<HTMLElement>('.cap');
  if (!fill || !cap) throw new Error('the bar has no fill');
  return { fill, cap };
}

describe('ProgressBar', () => {
  it('paints the ramp on a full-track layer and reveals it with a clip', () => {
    const { fill } = parts(0.25);
    // No width on the ramp layer: it is the whole track, always.
    expect(fill.style.width).toBe('');
    expect(fill.style.clipPath).toBe('inset(0 75% 0 0)');
    expect(parts(0.5).fill.style.clipPath).toBe('inset(0 50% 0 0)');
    expect(parts(1).fill.style.clipPath).toBe('inset(0 0% 0 0)');
  });

  it('has no --ramp-scale left to slide (§2.4)', () => {
    expect(parts(0.62).fill.style.getPropertyValue('--ramp-scale')).toBe('');
  });

  it('hides the whole ramp at zero', () => {
    expect(parts(0).fill.style.clipPath).toBe('inset(0 100% 0 0)');
  });

  it('rides the cap on the reveal edge', () => {
    expect(parts(0.62).cap.style.left).toBe('calc(62% - 1px)');
  });

  it('clamps out-of-range values', () => {
    expect(parts(1.4).fill.style.clipPath).toBe('inset(0 0% 0 0)');
    expect(parts(-1).fill.style.clipPath).toBe('inset(0 100% 0 0)');
  });

  it('reports the percentage to assistive tech', () => {
    const { container } = render(ProgressBar, {
      props: { value: 0.62, label: 'Mastery' },
    });
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-label')).toBe('Mastery');
    expect(bar?.getAttribute('aria-valuenow')).toBe('62');
  });
});
