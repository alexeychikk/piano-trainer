import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import SessionSummary from './SessionSummary.svelte';
import type { SessionSummary as Summary } from '$lib/practice/session';

/**
 * Markup-level rules only (the numbers are `summariseSession`'s, tested in
 * `$lib/practice/session.test.ts`): what `sci-fi-screens.md` §9 asks the DOM
 * to carry — the copy deck's title, the three readouts, a direction that is a
 * glyph *and* a sign, and no dialog.
 */
const SUMMARY: Summary = {
  elapsedMs: 604_000,
  answers: 64,
  correct: 57,
  accuracy: 57 / 64,
  bestStreak: 14,
  rows: [
    {
      skillId: 'interval-recognition:4:asc',
      label: 'M3 ↑',
      exerciseTitle: 'Interval recognition',
      mastery: 0.68,
      deltaPercent: 6,
      direction: 'up',
    },
    {
      skillId: 'chord-quality:min7',
      label: 'm7',
      exerciseTitle: 'Chord quality',
      mastery: 0.41,
      deltaPercent: -2,
      direction: 'down',
    },
  ],
  weakest: { label: 'm7', correct: 4, attempts: 9 },
};

function mount(summary: Summary = SUMMARY) {
  const { container } = render(SessionSummary, {
    props: { summary, onAgain: () => {}, onDone: () => {} },
  });
  return container;
}

describe('SessionSummary', () => {
  it('titles itself with the copy deck’s line and an mm:ss clock', () => {
    expect(mount().querySelector('h1')?.textContent).toBe(
      'Session complete · 10:04',
    );
  });

  it('shows the three readouts beside the ring', () => {
    const text = mount().querySelector('.headline')?.textContent ?? '';
    expect(text).toContain('64');
    expect(text).toContain('57');
    expect(text).toContain('14');
    expect(
      mount().querySelector('[role="img"][aria-label*="percent"]'),
    ).not.toBeNull();
  });

  it('shows direction as a glyph and a sign, never colour alone', () => {
    // `div.row` — the `ListRow` primitive; `Button` draws a `span.row` too.
    const rows = mount().querySelectorAll('div.row');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('▲');
    expect(rows[0]?.textContent).toContain('+6%');
    expect(rows[1]?.textContent).toContain('▼');
    expect(rows[1]?.textContent).toContain('−2%');
    // Mastery is never a bare number: the pips and the percentage (§6.2).
    expect(rows[0]?.querySelector('[role="img"]')).not.toBeNull();
  });

  it('names the weakest skill and offers both ways out', () => {
    const container = mount();
    expect(container.textContent).toContain('Weakest: m7 (4 of 9)');
    expect(
      container.querySelector('[data-testid="practice-again"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="session-done"]'),
    ).not.toBeNull();
    // A full screen replacing the runner, never a modal (§9).
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('carries no emoji (§2.7) and no panel when nothing was touched', () => {
    const container = mount({
      ...SUMMARY,
      answers: 0,
      correct: 0,
      accuracy: 0,
      bestStreak: 0,
      rows: [],
      weakest: null,
    });
    expect(container.querySelector('div.row')).toBeNull();
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
