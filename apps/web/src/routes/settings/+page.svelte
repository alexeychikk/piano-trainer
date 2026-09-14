<script lang="ts">
  /**
   * Settings (UX spec §6.3). Section ids are fixed because the status chips in
   * the top bar deep-link to them; each section is filled by the slice that
   * owns it. Every control applies immediately — no Save button, no dialogs.
   */
  import { base } from '$app/paths';
  import MetronomePanel from '$lib/components/audio/MetronomePanel.svelte';
  import RangeWizard from '$lib/components/midi/RangeWizard.svelte';
  import PianoKeyboard from '$lib/components/piano/PianoKeyboard.svelte';
  import type { KeyHighlight } from '$lib/components/piano/highlights';
  import { audio } from '$lib/audio/engine.svelte';
  import { INSTRUMENTS } from '$lib/audio/instruments';
  import { audioExplanation } from '$lib/audio/status';
  import { midiInput } from '$lib/midi/input.svelte';
  import {
    settings,
    type CountIn,
    type LabelMode,
  } from '$lib/storage/settings.svelte';
  import { MIDDLE_C, type Midi } from '$lib/theory';

  /** A short arpeggio, so "Test" says something about the instrument. */
  const TEST_PHRASE: { midi: Midi; at: number }[] = [
    { midi: MIDDLE_C, at: 0 },
    { midi: MIDDLE_C + 4, at: 0.18 },
    { midi: MIDDLE_C + 7, at: 0.36 },
    { midi: MIDDLE_C + 11, at: 0.54 },
  ];

  const volumePercent = $derived(Math.round(settings.value.volume * 100));
  const soundExplanation = $derived(audioExplanation({ status: audio.status }));

  async function testSound() {
    // Pressing "Test" means "let me hear it": while the app is muted the
    // button used to be silently inert (QA of slice 3), so it unmutes first —
    // visibly, through the same call the checkbox and the chip read.
    if (!settings.value.soundEnabled) audio.setMuted(false);
    await audio.ensureStarted();
    audio.playSequence(TEST_PHRASE, { velocity: 90 });
  }

  const COUNT_INS: { value: CountIn; label: string }[] = [
    { value: 'off', label: 'Off' },
    { value: '1-bar', label: 'One bar' },
  ];

  const PENDING_SECTIONS = [
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

  <RangeWizard />
</section>

<section id="sound">
  <h2>Sound</h2>

  <div class="row">
    <label for="instrument">Instrument</label>
    <select
      id="instrument"
      value={settings.value.instrument}
      onchange={(event) => audio.setInstrument(event.currentTarget.value)}
    >
      {#each INSTRUMENTS as instrument (instrument.id)}
        <option value={instrument.id}>{instrument.name}</option>
      {/each}
    </select>
    <span class="state" class:connected={audio.status === 'ready'}>
      <span aria-hidden="true">{audio.chip.glyph}</span>
      {audio.chip.label}
    </span>
  </div>

  {#if soundExplanation}
    <p class="note">{soundExplanation}</p>
  {/if}

  <div class="row">
    <label for="volume">Volume</label>
    <input
      id="volume"
      type="range"
      min="0"
      max="100"
      step="1"
      value={volumePercent}
      oninput={(event) =>
        audio.setVolume(Number(event.currentTarget.value) / 100)}
    />
    <span class="state tabular">{volumePercent}%</span>
    <button type="button" class="action inline" onclick={testSound}>
      Test <span aria-hidden="true">♪</span>
    </button>
  </div>

  <div class="row">
    <label class="choice" for="sound-on">
      <input
        id="sound-on"
        type="checkbox"
        checked={settings.value.soundEnabled}
        onchange={(event) => audio.setMuted(!event.currentTarget.checked)}
      />
      Sound on
    </label>
    <span class="slice">Press <kbd>M</kbd> anywhere to mute.</span>
  </div>

  <MetronomePanel />
</section>

<section id="practice">
  <h2>Practice</h2>

  <fieldset class="row">
    <legend>Count-in</legend>
    {#each COUNT_INS as option (option.value)}
      <label class="choice">
        <input
          type="radio"
          name="count-in"
          value={option.value}
          checked={settings.value.countIn === option.value}
          onchange={() => settings.patch({ countIn: option.value })}
        />
        {option.label}
      </label>
    {/each}
  </fieldset>
  <p class="note">
    One bar of metronome clicks before each question, at the tempo above — a
    beat to settle your hands before you listen.
  </p>

  <p class="slice">
    Session length and per-exercise settings arrive with the practice loop
    (slice 9).
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

  #midi,
  #sound {
    max-width: var(--content-max);
  }

  .tabular {
    font-family: var(--font-mono);
  }

  .inline {
    margin-top: 0;
  }

  input[type='range'] {
    width: 16rem;
    accent-color: var(--accent);
  }

  kbd {
    padding: 0 var(--space-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-2);
    color: var(--text-2);
    font-family: var(--font-mono);
    font-size: var(--fs-micro);
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
