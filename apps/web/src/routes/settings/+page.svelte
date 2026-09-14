<script lang="ts">
  /**
   * Settings (UX spec §6.3) in the part-2 language (sci-fi-screens.md §8):
   * four `HudPanel` sections with their header bands, the sticky section rail
   * at ≥ 1100 px, and §5.11 fields throughout.
   *
   * Section ids are fixed because the status chips in the top bar deep-link to
   * them; each section is filled by the slice that owns it. Every control
   * applies immediately — no Save button, no dialogs.
   */
  import { base } from '$app/paths';
  import MetronomePanel from '$lib/components/audio/MetronomePanel.svelte';
  import Button from '$lib/components/hud/Button.svelte';
  import Chip from '$lib/components/hud/Chip.svelte';
  import HudPanel from '$lib/components/hud/HudPanel.svelte';
  import MicroLabel from '$lib/components/hud/MicroLabel.svelte';
  import RangeWizard from '$lib/components/midi/RangeWizard.svelte';
  import PianoKeyboard from '$lib/components/piano/PianoKeyboard.svelte';
  import type { KeyHighlight } from '$lib/components/piano/highlights';
  import SectionRail from '$lib/components/settings/SectionRail.svelte';
  import { audio } from '$lib/audio/engine.svelte';
  import { INSTRUMENTS } from '$lib/audio/instruments';
  import { audioExplanation } from '$lib/audio/status';
  import { midiInput } from '$lib/midi/input.svelte';
  import { deviceAction, deviceSelect } from '$lib/midi/status';
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

  /** The rail's items: the four §6.3 sections, in page order. */
  const SECTIONS = [
    { id: 'midi', label: 'MIDI' },
    { id: 'sound', label: 'Sound' },
    { id: 'practice', label: 'Practice' },
    { id: 'data', label: 'Data' },
  ];

  const volumePercent = $derived(Math.round(settings.value.volume * 100));
  const soundExplanation = $derived(audioExplanation({ status: audio.status }));

  /**
   * §8.2: what the select and its button say is a function of `MidiStatus`, so
   * we stop claiming "No device found" before access was ever requested.
   */
  const select = $derived(
    deviceSelect({
      status: midiInput.status,
      inputCount: midiInput.devices.length,
    }),
  );
  const action = $derived(deviceAction({ status: midiInput.status }));

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

<div class="layout">
  <div class="rail-col">
    <SectionRail sections={SECTIONS} />
  </div>

  <div class="panels">
    <section id="midi">
      <HudPanel header="MIDI" chamfer="lg" padding="lg">
        <div class="row">
          <label class="field" for="midi-device">
            <MicroLabel>Input device</MicroLabel>
            <select
              id="midi-device"
              class="hud-field hud-cut hud-cut-sm"
              value={settings.value.midiDeviceKey ?? ''}
              onchange={selectDevice}
              disabled={select.disabled}
              data-testid="midi-device"
            >
              <option value="">{select.placeholder}</option>
              {#each midiInput.devices as device (device.key)}
                <option value={device.key}>{device.name}</option>
              {/each}
            </select>
          </label>

          <!-- The top-bar pill's smaller sibling (§8.1): glyph + state word in
               the state colour, never colour alone. -->
          <span class="state {midiInput.chip.tone}">
            <span aria-hidden="true">{midiInput.chip.glyph}</span>
            <MicroLabel>{midiInput.chip.label}</MicroLabel>
          </span>
        </div>

        {#if midiInput.explanation}
          <p class="note">{midiInput.explanation}</p>
        {/if}

        {#if action}
          <p class="action-row">
            <Button
              variant="secondary"
              disabled={action.disabled}
              testId="midi-action"
              onclick={() => midiInput.connect()}
            >
              {action.label}
            </Button>
          </p>
        {/if}

        <div class="preview">
          <!-- §8.3: 72 px, not the UX spec's 48 — at 49 keys that left ~7 px
               of key face and pushed the labels under the 12 px floor. -->
          <PianoKeyboard
            layout={49}
            {highlights}
            labels={settings.value.noteLabels}
            interactive={false}
            maxHeightPx={72}
          />
          <p class="note small">
            Play a key — it lights up here as well as in
            <a href={`${base}/play`}>Free play</a>.
          </p>
        </div>

        <fieldset class="row">
          <legend><MicroLabel>Note labels</MicroLabel></legend>
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
      </HudPanel>
    </section>

    <section id="sound">
      <HudPanel header="Sound" chamfer="lg" padding="lg">
        <div class="row">
          <label class="field" for="instrument">
            <MicroLabel>Instrument</MicroLabel>
            <select
              id="instrument"
              class="hud-field hud-cut hud-cut-sm"
              value={settings.value.instrument}
              onchange={(event) =>
                audio.setInstrument(event.currentTarget.value)}
            >
              {#each INSTRUMENTS as instrument (instrument.id)}
                <option value={instrument.id}>{instrument.name}</option>
              {/each}
            </select>
          </label>
          <span class="state {audio.chip.tone}">
            <span aria-hidden="true">{audio.chip.glyph}</span>
            <MicroLabel>{audio.chip.label}</MicroLabel>
          </span>
        </div>

        {#if soundExplanation}
          <p class="note">{soundExplanation}</p>
        {/if}

        <div class="row">
          <label class="field" for="volume">
            <MicroLabel>Volume</MicroLabel>
            <input
              id="volume"
              class="slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value={volumePercent}
              oninput={(event) =>
                audio.setVolume(Number(event.currentTarget.value) / 100)}
            />
          </label>
          <span class="readout tabular">{volumePercent}%</span>
          <Button variant="secondary" onclick={testSound}>
            {#snippet glyph()}
              <span aria-hidden="true">♪</span>
            {/snippet}
            Test
          </Button>
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
          <span class="note small">
            Press <Chip variant="key">M</Chip> anywhere to mute.
          </span>
        </div>

        <MetronomePanel />
      </HudPanel>
    </section>

    <section id="practice">
      <HudPanel header="Practice" chamfer="lg" padding="lg">
        <div class="measure">
          <fieldset class="row">
            <legend><MicroLabel>Count-in</MicroLabel></legend>
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
            One bar of metronome clicks before each question, at the tempo above
            — a beat to settle your hands before you listen.
          </p>

          <p class="note small">
            Session length and per-exercise settings arrive with the practice
            loop (slice 9).
          </p>
        </div>
      </HudPanel>
    </section>

    <section id="data">
      <HudPanel header="Data" chamfer="lg" padding="lg">
        <div class="measure">
          <p class="note">
            Export and import your practice data as a JSON file.
          </p>
          <!-- §8.5's controls (export/import, the inline RESET confirmation)
               land with the data they act on, in slice 5. -->
          <p class="note small">Arrives in slice 5.</p>
        </div>
      </HudPanel>
    </section>
  </div>
</div>

<style>
  .layout {
    display: grid;
    gap: var(--space-6);
    margin-top: var(--space-5);
    max-width: var(--content-max);
  }

  .rail-col {
    display: none;
  }

  .panels {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }

  /* §8.1: the rail only exists at ≥ 1100 px; below it the sections stand in
     DOM order and the top-bar chips still deep-link. */
  @media (min-width: 1100px) {
    .layout {
      grid-template-columns: 160px minmax(0, 1fr);
    }

    .rail-col {
      display: block;
    }
  }

  section {
    /* The anchor must clear the sticky top bar when a chip deep-links here. */
    scroll-margin-top: calc(var(--topbar-h) + var(--space-4));
  }

  /* Prose sections keep their readable measure (§8.1). */
  .measure {
    max-width: 60ch;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--space-4);
    margin: 0;
    margin-top: var(--space-4);
    padding: 0;
    border: none;
  }

  .row:first-child {
    margin-top: 0;
  }

  /* §5.11: label above the field, not beside it. */
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    color: var(--text-2);
  }

  legend {
    padding: 0;
  }

  .slider {
    width: 16rem;
    height: var(--hit-min);
    accent-color: var(--accent);
  }

  .readout {
    color: var(--cyan);
    font-family: var(--font-display);
  }

  .state {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-3);
  }

  /* The tone is an accelerator only: the glyph and the state word carry it. */
  .state.success {
    color: var(--success);
  }

  .state.warn {
    color: var(--warn);
  }

  .state.danger {
    color: var(--danger);
  }

  .state :global(.micro) {
    color: inherit;
  }

  .note {
    margin-top: var(--space-3);
    color: var(--text-2);
  }

  .small {
    font-size: var(--fs-small);
    color: var(--text-3);
  }

  .action-row {
    margin-top: var(--space-4);
  }

  .preview {
    margin-top: var(--space-5);
  }

  .choice {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-2);
  }
</style>
