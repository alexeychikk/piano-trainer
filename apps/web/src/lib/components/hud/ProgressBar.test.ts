import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import ProgressBar from './ProgressBar.svelte';

/**
 * The markup carries a rule here: the data ramp must span the *track*, not the
 * fill, or two bars at the same value would read as different colours in
 * differently sized panels (sci-fi visual language §2.3). The fill scales its
 * background back up by `100 / percent` to achieve that, so that number is
 * worth asserting.
 */
function fill(value: number): HTMLElement {
  const { container } = render(ProgressBar, {
    props: { value, label: 'Mastery' },
  });
  const element = container.querySelector<HTMLElement>('.fill');
  if (!element) throw new Error('the bar has no fill');
  return element;
}

describe('ProgressBar', () => {
  it('scales the ramp so it spans the track, whatever the fill width', () => {
    expect(fill(0.25).style.getPropertyValue('--ramp-scale')).toBe('4');
    expect(fill(0.5).style.getPropertyValue('--ramp-scale')).toBe('2');
    expect(fill(1).style.getPropertyValue('--ramp-scale')).toBe('1');
  });

  it('keeps the scale finite at zero, where there is nothing to paint', () => {
    const zero = fill(0);
    expect(zero.style.width).toBe('0%');
    expect(zero.style.getPropertyValue('--ramp-scale')).toBe('1');
  });

  it('clamps out-of-range values', () => {
    expect(fill(1.4).style.width).toBe('100%');
    expect(fill(-1).style.width).toBe('0%');
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
