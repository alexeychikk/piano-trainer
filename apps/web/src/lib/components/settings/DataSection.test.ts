import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import DataSection from './DataSection.svelte';
import { practice } from '$lib/practice/store.svelte';
import type { NewAttempt } from '$lib/storage/db';

/**
 * Markup-level rules only — the reducer is tested in `practice/reset.test.ts`
 * and the wipe itself in `practice/store.svelte.test.ts`. What matters here is
 * the wiring §8.5 asks for: the control reveals a field instead of a dialog,
 * the danger button stays disabled until the field matches, and cancelling
 * leaves the log exactly as it was.
 */
const attempt: NewAttempt = {
  questionId: 'find-the-note:7:60',
  ts: 1_700_000_000_000,
  exerciseId: 'find-the-note',
  skillId: 'find-the-note:pc:0',
  seed: 7,
  correct: true,
  score: 1,
  responseMs: 640,
  replays: 0,
  answerSource: 'onscreen',
};

function press(el: Element | null) {
  (el as HTMLElement).click();
}

function type(input: Element | null, value: string) {
  const field = input as HTMLInputElement;
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Settings → Data, the reset control', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: new IDBFactory(),
      configurable: true,
      writable: true,
    });
    practice.attempts = [];
    practice.skills = [];
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'indexedDB');
    practice.attempts = [];
    practice.skills = [];
  });

  it('asks inline — never through a dialog — and arms only on the word', async () => {
    const { container } = render(DataSection);
    expect(container.querySelector('[data-testid="reset-word"]')).toBeNull();

    press(container.querySelector('[data-testid="reset-data"]'));
    await Promise.resolve();

    const field = container.querySelector('[data-testid="reset-word"]');
    expect(field).not.toBeNull();
    // The label is the question; the button is armed by the field, not by it.
    expect(container.textContent).toContain('Type RESET to confirm');
    const confirmButton = container.querySelector(
      '[data-testid="reset-confirm"]',
    );
    expect(confirmButton).toHaveProperty('disabled', true);

    type(field, 'rese');
    await Promise.resolve();
    expect(
      container.querySelector('[data-testid="reset-confirm"]'),
    ).toHaveProperty('disabled', true);

    type(field, 'reset');
    await Promise.resolve();
    expect(
      container.querySelector('[data-testid="reset-confirm"]'),
    ).toHaveProperty('disabled', false);
  });

  it('cancelling closes the question and leaves the log alone', async () => {
    practice.record(attempt);
    const before = [...practice.attempts];

    const { container } = render(DataSection);
    press(container.querySelector('[data-testid="reset-data"]'));
    await Promise.resolve();
    type(container.querySelector('[data-testid="reset-word"]'), 'RESET');
    await Promise.resolve();

    press(container.querySelector('[data-testid="reset-cancel"]'));
    await Promise.resolve();

    expect(container.querySelector('[data-testid="reset-word"]')).toBeNull();
    expect(practice.attempts).toEqual(before);
    // Re-asking starts from an empty field, so a typed `RESET` cannot survive
    // a cancel and arm the next question.
    press(container.querySelector('[data-testid="reset-data"]'));
    await Promise.resolve();
    expect(
      container.querySelector('[data-testid="reset-confirm"]'),
    ).toHaveProperty('disabled', true);
  });
});
