import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
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
 *
 * It only *starts* the import: the handler runs on behind `file.text()`, the
 * parse, the write queue, the open and the `reload()`. The caller waits for
 * the outcome the component itself announces — see the signals below.
 */
function pick(container: HTMLElement, text: string): void {
  const input = container.querySelector(
    '[data-testid="import-file"]',
  ) as HTMLInputElement;
  Object.defineProperty(input, 'files', {
    value: [{ text: () => Promise.resolve(text) }],
    configurable: true,
  });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/*
 * The signals. Each is the **last** thing the component does on that path, so
 * once it is visible everything before it has run — never a count of ticks or
 * macrotask rounds, which is a guess that a loaded runner outgrows (the
 * `settle()` drain this file used to have failed exactly that way, as
 * `store.svelte.test.ts`'s did on `5836f1a`):
 *
 * - an import or a confirmed reset ends in `report()` — the inline `✓`/`✗`
 *   result line, which is written only after `replaceAll()` has resolved (and
 *   so after its transaction and `reload()`) and after `applySettings()`;
 * - a question being asked ends in `ask()` focusing the field;
 * - a cancel ends in `restoreFocus()` focusing the control that opened it.
 *
 * Writes queued *outside* the component (`practice.record`) are waited for with
 * `practice.flush()`, the store's own signal.
 */
async function reported(container: HTMLElement): Promise<void> {
  await vi.waitFor(() =>
    expect(container.querySelector('[role="status"]')).not.toBeNull(),
  );
}

async function focused(container: HTMLElement, testId: string): Promise<void> {
  await vi.waitFor(() =>
    expect(document.activeElement).toBe(
      container.querySelector(`[data-testid="${testId}"]`),
    ),
  );
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
    await tick();

    const field = container.querySelector('[data-testid="reset-word"]');
    expect(field).not.toBeNull();
    // The label is the question; the button is armed by the field, not by it.
    expect(container.textContent).toContain('Type RESET to confirm');
    const confirmButton = container.querySelector(
      '[data-testid="reset-confirm"]',
    );
    expect(confirmButton).toHaveProperty('disabled', true);

    type(field, 'rese');
    await tick();
    expect(
      container.querySelector('[data-testid="reset-confirm"]'),
    ).toHaveProperty('disabled', true);

    type(field, 'reset');
    await tick();
    expect(
      container.querySelector('[data-testid="reset-confirm"]'),
    ).toHaveProperty('disabled', false);
  });

  it('cancelling closes the question and leaves the log alone', async () => {
    practice.record(attempt);
    await practice.flush();
    const before = [...practice.attempts];

    const { container } = render(DataSection);
    press(container.querySelector('[data-testid="reset-data"]'));
    await tick();
    type(container.querySelector('[data-testid="reset-word"]'), 'RESET');
    await tick();

    press(container.querySelector('[data-testid="reset-cancel"]'));
    // The field has left the DOM, so focus goes back to the control that
    // opened the question rather than falling to `<body>` (UX §8).
    await focused(container, 'reset-data');

    expect(container.querySelector('[data-testid="reset-word"]')).toBeNull();
    expect(practice.attempts).toEqual(before);
    // Re-asking starts from an empty field, so a typed `RESET` cannot survive
    // a cancel and arm the next question.
    press(container.querySelector('[data-testid="reset-data"]'));
    await tick();
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
    await practice.flush();
    const replaceAll = vi.spyOn(practice, 'replaceAll');

    const { container } = render(DataSection);
    pick(container, fileText([]));
    await focused(container, 'reset-word');

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
    await tick();
    press(container.querySelector('[data-testid="reset-confirm"]'));
    await reported(container);

    expect(replaceAll).toHaveBeenCalledWith({ attempts: [], skills: [] });
    expect(practice.attempts).toHaveLength(0);
  });

  it('cancelling discards the pending file and leaves the log byte-identical', async () => {
    practice.record(attempt);
    await practice.flush();
    const before = JSON.stringify(practice.attempts);
    const replaceAll = vi.spyOn(practice, 'replaceAll');

    const { container } = render(DataSection);
    pick(container, fileText([]));
    await focused(container, 'reset-word');
    press(container.querySelector('[data-testid="reset-cancel"]'));
    // Focus goes back to the control that opened the question — `Import JSON…`
    // here, not the danger button the user never invoked.
    await focused(container, 'import-json');

    expect(container.querySelector('[data-testid="reset-word"]')).toBeNull();
    expect(replaceAll).not.toHaveBeenCalled();
    expect(JSON.stringify(practice.attempts)).toBe(before);

    // The file is gone, not parked: pressing the reset button afterwards asks
    // about the reset, and confirming it cannot apply the discarded file.
    press(container.querySelector('[data-testid="reset-data"]'));
    await tick();
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
    settings.patch({
      sessionLengthMin: 5,
      countIn: 'off',
      playMidiNotes: true,
    });

    const { container } = render(DataSection);
    pick(
      container,
      JSON.stringify({
        schemaVersion: PRACTICE_SCHEMA_VERSION,
        exportedAt: 1_700_000_000_000,
        settings: {
          sessionLengthMin: 20,
          countIn: '1-bar',
          playMidiNotes: false,
        },
        skills: [],
        attempts: [{ ...attempt, ts: 1 }],
      }),
    );
    await reported(container);

    expect(settings.value.sessionLengthMin).toBe(20);
    expect(settings.value.countIn).toBe('1-bar');
    expect(settings.value.playMidiNotes).toBe(false);
  });

  it('a file that carries something still imports without a question', async () => {
    practice.record(attempt);
    await practice.flush();
    const replaceAll = vi.spyOn(practice, 'replaceAll');

    const { container } = render(DataSection);
    pick(
      container,
      fileText([{ ...attempt, questionId: 'find-the-note:9:64', ts: 1 }]),
    );
    await reported(container);

    expect(container.querySelector('[data-testid="reset-word"]')).toBeNull();
    expect(replaceAll).toHaveBeenCalledTimes(1);
    expect(practice.attempts).toHaveLength(1);
    expect(practice.attempts[0]?.questionId).toBe('find-the-note:9:64');
  });
});
