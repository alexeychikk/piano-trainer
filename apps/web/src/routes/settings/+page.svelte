<script lang="ts">
  /**
   * Settings (UX spec §6.3). Section ids are fixed because the status chips in
   * the top bar deep-link to them; each section is filled by the slice that
   * owns it. Every control applies immediately — no Save button, no dialogs.
   */
  import { base } from '$app/paths';
  import PianoKeyboard from '$lib/components/piano/PianoKeyboard.svelte';
  import type { KeyHighlight } from '$lib/components/piano/highlights';
  import { midiInput } from '$lib/midi/input.svelte';
  import { settings, type LabelMode } from '$lib/storage/settings.svelte';
  import type { Midi } from '$lib/theory';

  const PENDING_SECTIONS = [
    {
      id: 'sound',
      title: 'Sound',
      note: 'Instrument, volume and the metronome tempo.',
      slice: 3,
    },
    {
      id: 'practice',
      title: 'Practice',
      note: 'Session length, chord settling window and per-exercise settings.',
      slice: 4,
    },
    {
      id: 'data',
      title: 'Data',
      note: 'Export and import your practice data as a JSON file.',
      slice: 5,
    },
  ];

  const LABEL_MODES: { value: LabelMode; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'c-only', label: 'C only' },
    { value: 'white', label: 'White keys' },
    { value: 'all', label: 'All' },
  ];

  const highlights = $derived(
    new Map<Midi, KeyHighlight>(midiInput.held.map((midi) => [midi, 'played'])),
  );

  function selectDevice(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    midiInput.select(value === '' ? null : value);
  }
</script>

<svelte:head>
  <title>Settings · piano-trainer</title>
</svelte:head>

<h1>Settings</h1>

<section id="midi">
  <h2>MIDI</h2>

  <div class="row">
    <label for="midi-device">Input device</label>
    <select
      id="midi-device"
      value={settings.value.midiDeviceKey ?? ''}
      onchange={selectDevice}
      disabled={midiInput.devices.length === 0}
    >
      <option value="">
        {midiInput.devices.length === 0 ? 'No device found' : 'None'}
      </option>
      {#each midiInput.devices as device (device.key)}
        <option value={device.key}>{device.name}</option>
      {/each}
    </select>
    <span class="state" class:connected={midiInput.connected}>
      <span aria-hidden="true">{midiInput.chip.glyph}</span>
      {midiInput.chip.label}
    </span>
  </div>

  {#if midiInput.explanation}
    <p class="note">{midiInput.explanation}</p>
  {/if}

  {#if midiInput.supported}
    <button
      type="button"
      class="action"
      onclick={() => midiInput.connect()}
      disabled={midiInput.status === 'requesting'}
    >
      {midiInput.status === 'granted' ? 'Rescan devices' : 'Connect MIDI'}
    </button>
  {/if}

  <div class="preview">
    <PianoKeyboard
      layout={49}
      {highlights}
      labels={settings.value.noteLabels}
      interactive={false}
      maxHeightPx={72}
    />
    <p class="caption">
      Play a key — it lights up here as well as in
      <a href={`${base}/play`}>Free play</a>.
    </p>
  </div>

  <fieldset class="row">
    <legend>Note labels</legend>
    {#each LABEL_MODES as mode (mode.value)}
      <label class="choice">
        <input
          type="radio"
          name="note-labels"
          value={mode.value}
          checked={settings.value.noteLabels === mode.value}
          onchange={() => settings.patch({ noteLabels: mode.value })}
        />
        {mode.label}
      </label>
    {/each}
  </fieldset>

  <p class="slice">
    The keyboard-range wizard arrives with the exercise runner (slice 4).
  </p>
</section>

{#each PENDING_SECTIONS as section (section.id)}
  <section id={section.id}>
    <h2>{section.title}</h2>
    <p class="note">{section.note}</p>
    <p class="slice">Arrives in slice {section.slice}.</p>
  </section>
{/each}

<style>
  section {
    margin-top: var(--space-6);
    padding: var(--space-5);
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    max-width: 60ch;
  }

  #midi {
    max-width: var(--content-max);
  }

  .note {
    margin-top: var(--space-2);
    color: var(--text-2);
  }

  .slice {
    margin-top: var(--space-2);
    font-size: var(--fs-small);
    color: var(--text-3);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-top: var(--space-4);
    padding: 0;
    border: none;
  }

  legend {
    padding: 0;
    color: var(--text-2);
  }

  select {
    min-height: var(--hit-min);
    padding: 0 var(--space-3);
    background: var(--bg-2);
    color: var(--text-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font: inherit;
  }

  .state {
    color: var(--text-3);
    font-size: var(--fs-small);
  }

  .state.connected {
    color: var(--success);
  }

  .action {
    min-height: var(--hit-min);
    margin-top: var(--space-4);
    padding: 0 var(--space-4);
    background: var(--bg-2);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    color: var(--accent);
    cursor: pointer;
  }

  .action:disabled {
    border-color: var(--border);
    color: var(--text-3);
    cursor: default;
  }

  .preview {
    margin-top: var(--space-5);
  }

  .caption {
    margin-top: var(--space-2);
    color: var(--text-3);
    font-size: var(--fs-small);
  }

  .choice {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-2);
  }
</style>
