import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
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

describe('PianoKeyboard, the bed (sci-fi-screens.md §4)', () => {
  it('chamfers the bed once and never a key', () => {
    const { container } = render(PianoKeyboard, { props: { layout: 61 } });
    // One clip-path for the whole component: a chamfer per key would be 61 of
    // them, and keys glow with `box-shadow` precisely so they stay cheap.
    expect(container.querySelectorAll('.bed.hud-cut')).toHaveLength(1);
    expect(container.querySelectorAll('.key.hud-cut')).toHaveLength(0);
  });

  it('ticks the apron once per C, and never labels it', () => {
    const { container } = render(PianoKeyboard, { props: { layout: 61 } });
    const apron = container.querySelector('.apron');
    // C2…C7 on a 61-key keyboard.
    expect(apron?.querySelectorAll('.tick')).toHaveLength(6);
    expect(apron?.textContent?.trim()).toBe('');
    expect(apron?.getAttribute('aria-hidden')).toBe('true');
  });

  it('drops the apron when the bed is compressed (decoration, not meaning)', () => {
    const { container } = render(PianoKeyboard, {
      props: { layout: 61, maxHeightPx: 60 },
    });
    expect(container.querySelector('.apron')).toBeNull();
  });

  it('keeps the state glyph and the label apart, so each can be sized', () => {
    const { container } = render(PianoKeyboard, {
      props: {
        layout: 61,
        highlights: new Map<number, KeyHighlight>([[60, 'correct']]),
      },
    });
    const key = container.querySelector('[aria-label="C 4"]');
    // 16 px glyph over a 12 px label (§2.6) — two elements, two rules.
    expect(key?.querySelector('.glyph')?.textContent).toBe('✓');
    expect(key?.querySelector('.label')?.textContent).toBe('C4');
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

  it('never puts the tab stop on a dimmed key', () => {
    // Middle C is the default tab stop; dimmed keys render `disabled`, so
    // focus has to rove on to the next key that can actually take it.
    const body = html({
      highlights: new Map<number, KeyHighlight>([
        [60, 'dim'],
        [61, 'dim'],
      ]),
    });
    expect(body).toMatch(/tabindex="-1" aria-label="C 4"/);
    expect(body).toMatch(/tabindex="-1" aria-label="C sharp 4"/);
    expect(body).toMatch(/tabindex="0" aria-label="D 4"/);
    // Exactly one tab stop, whatever is dimmed.
    expect((body.match(/tabindex="0"/g) ?? []).length).toBe(1);
  });
});

describe('PianoKeyboard labelling', () => {
  it('spells keys the way the question does with labelStyle "context"', () => {
    const body = html({
      labels: 'all',
      labelStyle: 'context',
      spellings: new Map([[61, 'Db4']]),
    });
    expect(body).toContain('>Db4<');
    // Everything the question did not spell falls back to sharps.
    expect(body).toContain('>D#4<');
  });

  it('falls back to sharps when no spelling is supplied', () => {
    expect(html({ labels: 'all', labelStyle: 'context' })).toContain('>C#4<');
  });
});

describe('PianoKeyboard focus', () => {
  it('moves focus off a key that has just been dimmed', async () => {
    const { container, rerender } = render(PianoKeyboard, {
      props: { layout: 61 },
    });
    const key = (name: string) =>
      container.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;

    key('C 4').focus();
    expect(document.activeElement).toBe(key('C 4'));

    // A new question narrows the range: the focused key becomes display only,
    // and a disabled element drops focus to <body> unless we move it.
    await rerender({
      highlights: new Map<number, KeyHighlight>([
        [60, 'dim'],
        [61, 'dim'],
      ]),
    });
    await tick();
    expect(document.activeElement).toBe(key('D 4'));
  });
});
