import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import PianoKeyboard from './PianoKeyboard.svelte';
import type { KeyHighlight } from './highlights';

/**
 * Markup-level checks only: the keyboard's maths lives in `geometry.ts` and
 * `highlights.ts` (tested there). What matters here is that every key is a
 * labelled button, that highlights reach the DOM with their glyph, and that
 * display-only keyboards take no input.
 */
function html(props: Record<string, unknown> = {}) {
  const { container } = render(PianoKeyboard, {
    props: { layout: 61, ...props },
  });
  return container.innerHTML;
}

describe('PianoKeyboard', () => {
  it('renders one labelled button per key, in a labelled group', () => {
    const body = html();
    expect(body).toContain('role="group"');
    expect(body).toContain('aria-label="Piano keyboard, C2 to C7"');
    expect((body.match(/<button/g) ?? []).length).toBe(61);
    expect(body).toContain('aria-label="C 4"');
    expect(body).toContain('aria-label="C sharp 4"');
  });

  it('marks held keys as pressed', () => {
    const highlights = new Map<number, KeyHighlight>([[60, 'played']]);
    const body = html({ highlights });
    expect(body).toMatch(/aria-label="C 4"[^>]*aria-pressed="true"/);
    expect(body).toMatch(/aria-label="D 4"[^>]*aria-pressed="false"/);
  });

  it('pairs every graded state with its glyph, never colour alone', () => {
    const body = html({
      highlights: new Map<number, KeyHighlight>([
        [60, 'correct'],
        [62, 'wrong'],
        [64, 'target'],
        [65, 'ghost'],
      ]),
    });
    for (const glyph of ['✓', '✗', '◆', '◇']) expect(body).toContain(glyph);
  });

  it('labels C keys only by default', () => {
    const body = html();
    expect(body).toContain('>C4<');
    expect(body).not.toContain('>D4<');
    expect(html({ labels: 'all' })).toContain('>D4<');
    expect(html({ labels: 'none' })).not.toContain('>C4<');
  });

  it('disables every key when it is display only', () => {
    const body = html({ interactive: false });
    expect((body.match(/disabled/g) ?? []).length).toBe(61);
  });

  it('keeps one tab stop for the whole keyboard', () => {
    const body = html();
    expect((body.match(/tabindex="0"/g) ?? []).length).toBe(1);
  });

  it('shows an edge indicator for highlighted notes off the keyboard', () => {
    const body = html({
      layout: 49, // C2–C6
      highlights: new Map<number, KeyHighlight>([[96, 'target']]),
    });
    expect(body).toContain('C7 ▸');
  });
});

describe('PianoKeyboard input', () => {
  function mount(props: Record<string, unknown> = {}) {
    const played: string[] = [];
    const { container } = render(PianoKeyboard, {
      props: {
        layout: 61,
        onNoteOn: (midi: number) => played.push(`on:${midi}`),
        onNoteOff: (midi: number) => played.push(`off:${midi}`),
        ...props,
      },
    });
    const key = (name: string) =>
      container.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
    return { played, key };
  }

  it('plays the focused key on Enter and releases it on key-up', () => {
    const { played, key } = mount();
    const c4 = key('C 4');
    c4.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    c4.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }),
    );
    expect(played).toEqual(['on:60', 'off:60']);
  });

  it('stays silent when it is display only', () => {
    const { played, key } = mount({ interactive: false });
    key('C 4').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(played).toEqual([]);
  });
});
