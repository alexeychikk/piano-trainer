import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import DataSection from './DataSection.svelte';
import { practice } from '$lib/practice/store.svelte';
import { settings } from '$lib/storage/settings.svelte';
import { PRACTICE_SCHEMA_VERSION, type NewAttempt } from '$lib/storage/db';

/**
 * Markup-level rules only — the reducer is tested in `practice/reset.test.ts`
 * and the wipe itself in `practice/store.svelte.test.ts`. What matters here is
 * the wiring §8.5 asks for: the control reveals a field instead of a dialog,
 * the danger button stays disabled until the field matches, cancelling leaves
 * the log exactly as it was — and the same question guards a *file* that would
 * empty the log (QA's slice-5b observation), which is the only genuinely new
 * behaviour the component owns.
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

/** A file's text, as the picker would hand it over. */
function fileText(attempts: unknown[]): string {
  return JSON.stringify({
    schemaVersion: PRACTICE_SCHEMA_VERSION,
    exportedAt: 1_700_000_000_000,
    // No settings block: this is about the log, and `null` is the case the
    // import deliberately skips.
    skills: [],
    attempts,
  });
}

/**
 * Drive the hidden `<input type="file">` the way the browser does. jsdom has no
 * file picker, so the `FileList` is stubbed and `text()` is the only method the
 * component calls — the parser is pure, so nothing else is needed.
 */
async function pick(container: HTMLElement, text: string): Promise<void> {
  const input = container.querySelector(
    '[data-testid="import-file"]',
  ) as HTMLInputElement;
  Object.defineProperty(input, 'files', {
    value: [{ text: () => Promise.resolve(text) }],
    configurable: true,
  });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
}

/**
 * Let the picker's `await`s, the write queue, the open and the `reload()`
 * behind a replace all run out — several rounds, because each IndexedDB
 * transaction needs a macrotask turn of its own.
 *
 * The one drain left in the suite, and deliberately: `practice.flush()` — the
 * signal `store.svelte.test.ts` waits on — only covers the write queue, and at
 * the moment this is called nothing is queued yet (the component is still
 * awaiting `file.text()` and the parse). There is no signal here for "the
 * handler and the re-render behind it are done"; a component-level one would
 * have to come from the component.
 */
async function settle(): Promise<void> {
  for (let round = 0; round < 6; round += 1) {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
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
    await settle();

    expect(container.querySelector('[data-testid="reset-word"]')).toBeNull();
    expect(practice.attempts).toEqual(before);
    // The field has left the DOM, so focus goes back to the control that
    // opened the question rather than falling to `<body>` (UX §8).
    expect(document.activeElement).toBe(
      container.querySelector('[data-testid="reset-data"]'),
    );
    // Re-asking starts from an empty field, so a typed `RESET` cannot survive
    // a cancel and arm the next question.
    press(container.querySelector('[data-testid="reset-data"]'));
    await Promise.resolve();
    expect(
      container.querySelector('[data-testid="reset-confirm"]'),
    ).toHaveProperty('disabled', true);
  });
});

/**
 * QA's slice-5b observation, answered in the UI: `parsePracticeFile()` cannot
 * refuse an honest export of an empty log (`offered > 0 && parsed === 0` stays
 * its only guard), so a file that would leave the user with nothing asks the
 * reset's question first.
 */
describe('Settings → Data, a file that would empty the log', () => {
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
    vi.restoreAllMocks();
  });

  it('asks before applying an empty file, and writes nothing until the word is typed', async () => {
    practice.record(attempt);
    await settle();
    const replaceAll = vi.spyOn(practice, 'replaceAll');

    const { container } = render(DataSection);
    await pick(container, fileText([]));

    // The same inline question, with its own sentence naming the emptiness —
    // and the field is described by it, so focusing the field reads the reason.
    const field = container.querySelector('[data-testid="reset-word"]');
    expect(field).not.toBeNull();
    expect(container.textContent).toContain('contains no attempts');
    const describedBy = (field as HTMLInputElement).getAttribute(
      'aria-describedby',
    );
    expect(describedBy).not.toBeNull();
    expect(container.querySelector(`#${describedBy}`)?.textContent).toContain(
      'contains no attempts',
    );
    // Nothing has been written: the file is only pending.
    expect(replaceAll).not.toHaveBeenCalled();
    expect(practice.attempts).toHaveLength(1);

    type(field, 'RESET');
    await Promise.resolve();
    press(container.querySelector('[data-testid="reset-confirm"]'));
    await settle();

    expect(replaceAll).toHaveBeenCalledWith({ attempts: [], skills: [] });
    expect(practice.attempts).toHaveLength(0);
  });

  it('cancelling discards the pending file and leaves the log byte-identical', async () => {
    practice.record(attempt);
    await settle();
    const before = JSON.stringify(practice.attempts);
    const replaceAll = vi.spyOn(practice, 'replaceAll');

    const { container } = render(DataSection);
    await pick(container, fileText([]));
    press(container.querySelector('[data-testid="reset-cancel"]'));
    await settle();

    expect(container.querySelector('[data-testid="reset-word"]')).toBeNull();
    expect(replaceAll).not.toHaveBeenCalled();
    expect(JSON.stringify(practice.attempts)).toBe(before);
    // Focus goes back to the control that opened the question — `Import JSON…`
    // here, not the danger button the user never invoked.
    expect(document.activeElement).toBe(
      container.querySelector('[data-testid="import-json"]'),
    );

    // The file is gone, not parked: pressing the reset button afterwards asks
    // about the reset, and confirming it cannot apply the discarded file.
    press(container.querySelector('[data-testid="reset-data"]'));
    await Promise.resolve();
    expect(
      container
        .querySelector('[data-testid="reset-word"]')
        ?.getAttribute('aria-describedby'),
    ).toBeNull();
  });

  /**
   * A preference is restored by a backup. `applySettings()` enumerates the
   * fields it patches, so every field added to `AppSettings` has to be added
   * there too — only `lastExportAt`, which describes *this* browser, is
   * deliberately left alone. `sessionLengthMin` was missed once.
   */
  it('restores the preferences a backup carries, session length included', async () => {
    settings.patch({ sessionLengthMin: 5, countIn: 'off' });

    const { container } = render(DataSection);
    await pick(
      container,
      JSON.stringify({
        schemaVersion: PRACTICE_SCHEMA_VERSION,
        exportedAt: 1_700_000_000_000,
        settings: { sessionLengthMin: 20, countIn: '1-bar' },
        skills: [],
        attempts: [{ ...attempt, ts: 1 }],
      }),
    );

    expect(settings.value.sessionLengthMin).toBe(20);
    expect(settings.value.countIn).toBe('1-bar');
  });

  it('a file that carries something still imports without a question', async () => {
    practice.record(attempt);
    await settle();
    const replaceAll = vi.spyOn(practice, 'replaceAll');

    const { container } = render(DataSection);
    await pick(
      container,
      fileText([{ ...attempt, questionId: 'find-the-note:9:64', ts: 1 }]),
    );

    expect(container.querySelector('[data-testid="reset-word"]')).toBeNull();
    expect(replaceAll).toHaveBeenCalledTimes(1);
    expect(practice.attempts).toHaveLength(1);
    expect(practice.attempts[0]?.questionId).toBe('find-the-note:9:64');
  });
});
