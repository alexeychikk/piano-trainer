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
   * `Reset all practice data` — §8.5's third control — is deliberately not
   * here; it is destructive, it has its own inline-confirmation behaviour, and
   * this ticket is backup/restore. See the closing comment.
   */
  import Button from '$lib/components/hud/Button.svelte';
  import { audio } from '$lib/audio/engine.svelte';
  import { metronome } from '$lib/audio/metronome.svelte';
  import { midiInput } from '$lib/midi/input.svelte';
  import {
    dataStats,
    exportDone,
    importDone,
    PRACTICE_COPY,
  } from '$lib/practice/copy';
  import { exportPracticeData } from '$lib/practice/download';
  import { practice } from '$lib/practice/store.svelte';
  import { parsePracticeFile } from '$lib/practice/transfer';
  import { banners } from '$lib/components/shell/banners.svelte';
  import { settings, type AppSettings } from '$lib/storage/settings.svelte';

  /** One clock for the screen, like `/progress` — no timer behind the user. */
  const now = Date.now();

  let picker = $state<HTMLInputElement | null>(null);
  let busy = $state(false);
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

    busy = true;
    try {
      const parsed = parsePracticeFile(await file.text());
      if (!parsed.ok) {
        report(false, parsed.message);
        return;
      }
      const persisted = await practice.replaceAll({
        attempts: parsed.file.attempts,
        skills: parsed.file.skills,
      });
      // A file that carries no settings block restores the log only: the
      // taught range, the remembered piano and the sound stay as they are
      // (`parsePracticeFile` keeps the two cases apart).
      if (parsed.file.settings) applySettings(parsed.file.settings);
      report(
        persisted,
        persisted
          ? importDone(parsed.file.attempts.length, parsed.file.skills.length)
          : PRACTICE_COPY.importNotSaved,
      );
    } catch {
      // An unreadable file (a directory, a revoked permission) is a file we
      // cannot parse — same outcome, same sentence.
      report(false, PRACTICE_COPY.importInvalid);
    } finally {
      busy = false;
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

<div class="measure">
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

  .small {
    font-size: var(--fs-small);
    color: var(--text-3);
  }
</style>
