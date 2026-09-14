<script lang="ts">
  /**
   * Settings → `#data` (UX spec §6.3, sci-fi-screens.md §8.5): export the
   * practice payload to a JSON file, and import one back.
   *
   * Three rules the section is built around:
   * - **Nothing leaves the machine.** The export is a `Blob` and an anchor
   *   click; the import is a file the user picks. There is no endpoint.
   * - **Import replaces, in one transaction** (`practice.replaceAll` →
   *   `storage.replace`). A backup restores a moment, so merging two logs by
   *   hand is not something the owner asked for and not something a file can
   *   describe; a rejected file changes nothing at all.
   * - **No dialog, ever** (UX §2.3). The result is a banner *and* an inline
   *   line here: the banner is the spec's channel, the inline line survives a
   *   full banner stack and sits where the user just clicked.
   *
   * §8.5's third control, `Reset all practice data`, is the `danger` button
   * below, in front of the inline `Type RESET to confirm` field the same
   * section owns. Its state machine is the pure `$lib/practice/reset.ts`, and
   * the **same** affordance guards an import that would empty the log — see
   * `ConfirmTarget`.
   */
  import { tick } from 'svelte';
  import Button from '$lib/components/hud/Button.svelte';
  import MicroLabel from '$lib/components/hud/MicroLabel.svelte';
  import { audio } from '$lib/audio/engine.svelte';
  import { metronome } from '$lib/audio/metronome.svelte';
  import { midiInput } from '$lib/midi/input.svelte';
  import {
    dataStats,
    exportDone,
    importDone,
    PRACTICE_COPY,
    resetDone,
  } from '$lib/practice/copy';
  import { exportPracticeData } from '$lib/practice/download';
  import {
    canConfirm,
    confirmReducer,
    IDLE,
    type ConfirmEvent,
    type ConfirmState,
  } from '$lib/practice/reset';
  import { practice } from '$lib/practice/store.svelte';
  import { parsePracticeFile, type PracticeFile } from '$lib/practice/transfer';
  import { banners } from '$lib/components/shell/banners.svelte';
  import { settings, type AppSettings } from '$lib/storage/settings.svelte';

  /** One clock for the screen, like `/progress` — no timer behind the user. */
  const now = Date.now();

  let picker = $state<HTMLInputElement | null>(null);
  let busy = $state(false);
  /** The inline confirmation in front of anything that empties the log. */
  let confirm = $state<ConfirmState>(IDLE);
  /** The parsed file waiting behind an `empty-import` confirmation. */
  let pendingImport = $state<PracticeFile | null>(null);
  let field = $state<HTMLInputElement | null>(null);
  let root = $state<HTMLDivElement | null>(null);
  /** The last export/import result, shown inline. Glyph + word, never colour. */
  let result = $state<{ ok: boolean; message: string } | null>(null);

  const stats = $derived(
    dataStats({
      attempts: practice.attempts.length,
      skills: practice.skills.length,
      lastExportAt: settings.value.lastExportAt,
      now,
    }),
  );

  function report(ok: boolean, message: string) {
    result = { ok, message };
    banners.show(message, ok ? 'success' : 'danger');
  }

  async function exportNow() {
    busy = true;
    try {
      const counts = await exportPracticeData();
      report(true, exportDone(counts.attempts, counts.skills));
    } finally {
      busy = false;
    }
  }

  async function onFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    // Clear it straight away, so picking the same file twice fires `change`.
    input.value = '';
    if (!file) return;

    // A file pick supersedes an open confirmation: the question on screen is
    // no longer the one being answered.
    dispatch({ type: 'cancel' });
    pendingImport = null;

    busy = true;
    try {
      const parsed = parsePracticeFile(await file.text());
      if (!parsed.ok) {
        report(false, parsed.message);
        return;
      }
      if (wipesTheLog(parsed.file)) {
        // A legitimate file that happens to carry nothing, dropped on a log
        // that has something: the outcome is a reset, so it asks the reset's
        // question first (QA, slice 5b). Nothing has been written yet.
        pendingImport = parsed.file;
        await ask('empty-import');
        return;
      }
      await applyImport(parsed.file);
    } catch {
      // An unreadable file (a directory, a revoked permission) is a file we
      // cannot parse — same outcome, same sentence.
      report(false, PRACTICE_COPY.importInvalid);
    } finally {
      busy = false;
    }
  }

  /** True when applying this file would leave the user with less than nothing. */
  function wipesTheLog(file: PracticeFile): boolean {
    if (file.attempts.length > 0 || file.skills.length > 0) return false;
    return practice.attempts.length > 0 || practice.skills.length > 0;
  }

  async function applyImport(file: PracticeFile) {
    const persisted = await practice.replaceAll({
      attempts: file.attempts,
      skills: file.skills,
    });
    // A file that carries no settings block restores the log only: the
    // taught range, the remembered piano and the sound stay as they are
    // (`parsePracticeFile` keeps the two cases apart).
    if (file.settings) applySettings(file.settings);
    report(
      persisted,
      persisted
        ? importDone(file.attempts.length, file.skills.length)
        : PRACTICE_COPY.importNotSaved,
    );
  }

  function dispatch(event: ConfirmEvent) {
    confirm = confirmReducer(confirm, event);
  }

  /** Open the confirmation and put the caret where the question is asked. */
  async function ask(target: 'reset' | 'empty-import') {
    dispatch({ type: 'ask', target });
    await tick();
    field?.focus();
  }

  /**
   * Close it without touching anything, and hand focus back to the control
   * that opened it — the field it was on is about to leave the DOM, and a
   * focus that falls to `<body>` loses the keyboard user's place (UX §8).
   */
  async function cancel() {
    dispatch({ type: 'cancel' });
    pendingImport = null;
    await tick();
    root?.querySelector<HTMLElement>('[data-testid="reset-data"]')?.focus();
  }

  async function runConfirm() {
    const armed = confirm;
    if (armed.phase !== 'confirming' || !canConfirm(armed)) return;
    dispatch({ type: 'confirm' });
    busy = true;
    try {
      if (armed.target === 'reset') {
        // The counts are what is about to be wiped: after the replace they
        // are both 0, and "Reset 0 attempts" says nothing about what happened.
        const attempts = practice.attempts.length;
        const skills = practice.skills.length;
        const persisted = await practice.resetAll();
        report(
          persisted,
          persisted ? resetDone(attempts, skills) : PRACTICE_COPY.resetNotSaved,
        );
      } else if (pendingImport) {
        await applyImport(pendingImport);
      }
    } finally {
      pendingImport = null;
      busy = false;
      dispatch({ type: 'settled' });
      await tick();
      root?.querySelector<HTMLElement>('[data-testid="reset-data"]')?.focus();
    }
  }

  /**
   * A backup restores settings too. Sound and tempo go through their owners
   * (`audio` holds the master gain, `metronome` a running scheduler) and the
   * device through `midiInput.select`, never by patching `settings` — the same
   * rule every other control on this screen follows. `lastExportAt` describes
   * *this* browser and is deliberately left alone.
   */
  function applySettings(imported: AppSettings) {
    settings.patch({
      noteLabels: imported.noteLabels,
      keyboardLow: imported.keyboardLow,
      keyboardHigh: imported.keyboardHigh,
      countIn: imported.countIn,
      focusMode: imported.focusMode,
    });
    midiInput.select(imported.midiDeviceKey);
    audio.setVolume(imported.volume);
    audio.setMuted(!imported.soundEnabled);
    audio.setInstrument(imported.instrument);
    metronome.setTempo(imported.tempoBpm);
    metronome.setBeatsPerBar(imported.beatsPerBar);
  }
</script>

<div class="measure" bind:this={root}>
  <p class="note">Export and import your practice data as a JSON file.</p>

  <div class="actions">
    <Button
      variant="secondary"
      disabled={busy}
      testId="export-json"
      onclick={() => void exportNow()}
    >
      Export JSON
    </Button>
    <Button
      variant="secondary"
      disabled={busy}
      testId="import-json"
      onclick={() => picker?.click()}
    >
      Import JSON…
    </Button>
    <!-- The real control is the button above; this is the file dialog it
         opens. `hidden` keeps it out of the tab order and off the a11y tree,
         so there is exactly one control to find. -->
    <input
      bind:this={picker}
      type="file"
      accept="application/json,.json"
      hidden
      data-testid="import-file"
      onchange={(event) => void onFile(event)}
    />
  </div>

  <p class="stats tabular">{stats}</p>

  {#if result}
    <!-- Never colour alone (UX §8): the ✓ / ✗ is the signal, the tone follows.
         `aria-live` so the outcome is announced without stealing focus. -->
    <p class="result" class:ok={result.ok} role="status" aria-live="polite">
      <span aria-hidden="true">{result.ok ? '✓' : '✗'}</span>
      {result.message}
    </p>
  {/if}

  <p class="note small">Importing replaces the data stored here.</p>

  <!-- §8.5's third control. The nudge sits above it, 14 px --text-2, and the
       confirmation is inline: the button reveals the field, the danger button
       stays disabled until it matches, and a ghost `Cancel` closes it. -->
  <hr class="rule" />

  <p class="note small">{PRACTICE_COPY.resetNudge}</p>

  {#if confirm.phase === 'idle'}
    <div class="actions">
      <Button
        variant="danger"
        disabled={busy}
        testId="reset-data"
        onclick={() => void ask('reset')}
      >
        Reset all practice data
      </Button>
    </div>
  {:else}
    <div class="confirm">
      {#if confirm.target === 'empty-import'}
        <!-- Only the file case needs a sentence: what the picked file would
             do is not otherwise on screen. `aria-live` announces it; the caret
             is already in the field, so nothing is stolen. The `!` carries the
             state with --warn — nothing here is *wrong* yet (part 2 §11). -->
        <p class="question" role="status" aria-live="polite">
          <span aria-hidden="true">!</span>
          {PRACTICE_COPY.importEmptyNudge}
        </p>
      {/if}

      <div class="actions">
        <label class="field">
          <MicroLabel>{PRACTICE_COPY.resetConfirmLabel}</MicroLabel>
          <input
            bind:this={field}
            class="hud-field hud-cut hud-cut-sm word"
            type="text"
            autocomplete="off"
            spellcheck="false"
            value={confirm.phase === 'confirming' ? confirm.typed : ''}
            disabled={confirm.phase === 'working'}
            data-testid="reset-word"
            oninput={(event) =>
              dispatch({ type: 'type', value: event.currentTarget.value })}
            onkeydown={(event) => {
              if (event.key === 'Escape') void cancel();
              if (event.key === 'Enter') {
                event.preventDefault();
                void runConfirm();
              }
            }}
          />
        </label>

        <Button
          variant="danger"
          disabled={!canConfirm(confirm) || busy}
          testId="reset-confirm"
          onclick={() => void runConfirm()}
        >
          Reset all practice data
        </Button>
        <Button
          variant="ghost"
          disabled={confirm.phase === 'working'}
          testId="reset-cancel"
          onclick={() => void cancel()}
        >
          Cancel
        </Button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Prose sections keep their readable measure (§8.1). */
  .measure {
    max-width: 60ch;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin-top: var(--space-4);
  }

  /* §8.5's stats line: 14 px --text-3, tabular. */
  .stats {
    margin-top: var(--space-4);
    font-size: var(--fs-small);
    color: var(--text-3);
  }

  .result {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    margin-top: var(--space-3);
    color: var(--danger);
  }

  .result.ok {
    color: var(--success);
  }

  .note {
    margin-top: var(--space-3);
    color: var(--text-2);
  }

  /* Backup/restore above, the destructive control below — a hairline, the
     same --grad-rule the keyboard's apron uses, so the two halves of the
     section read apart without a second panel (§8.5 adds no region). */
  .rule {
    height: 1px;
    margin: var(--space-5) 0 0;
    border: 0;
    background: var(--grad-rule);
  }

  /* The reveal is a height/opacity settle, not a slide: --dur-base already
     collapses to 1 ms under `prefers-reduced-motion` (tokens.css), so this
     honours it without a second media query. */
  .confirm {
    margin-top: var(--space-4);
    animation: reveal var(--dur-base) ease-out;
  }

  @keyframes reveal {
    from {
      opacity: 0;
      /* A one-off nudge distance, like the runner's strips (§7 exemption). */
      transform: translateY(-4px);
    }
  }

  .question {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    margin: 0 0 var(--space-3);
    font-size: var(--fs-small);
    color: var(--warn);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  /* Wide enough for the word and its tracking, and no wider — it takes five
     letters, not a sentence. */
  .word {
    width: 14ch;
    letter-spacing: var(--track-hud);
    text-transform: uppercase;
  }

  /* The field and the two buttons sit on one baseline row. */
  .confirm .actions {
    align-items: flex-end;
  }

  .small {
    font-size: var(--fs-small);
    color: var(--text-3);
  }
</style>
