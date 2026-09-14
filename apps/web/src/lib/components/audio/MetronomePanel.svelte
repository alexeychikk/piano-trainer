<script lang="ts">
  /**
   * Metronome controls (slice 3), in the part-2 language (sci-fi-screens.md
   * §6): a `HudPanel` with the `METRONOME` header band, `Button` for start and
   * stop, §5.11 fields for tempo and beats-per-bar, and numbered diamond pips.
   *
   * The beat indicator never rests on colour alone (UX spec §8): the running
   * beat is filled *and* larger *and* numbered, and the downbeat is outlined.
   * The visible beat still follows in `requestAnimationFrame` — the light may
   * lag, the click may not.
   */
  import Button from '$lib/components/hud/Button.svelte';
  import MicroLabel from '$lib/components/hud/MicroLabel.svelte';
  import HudPanel from '$lib/components/hud/HudPanel.svelte';
  import { metronome } from '$lib/audio/metronome.svelte';
  import {
    MAX_BEATS_PER_BAR,
    MAX_BPM,
    MIN_BEATS_PER_BAR,
    MIN_BPM,
  } from '$lib/audio/scheduler';
  import { TEMPO_RANGE_HINT, readTempoField } from '$lib/audio/tempo-field';

  /** ± steps that feel right on a tempo field. */
  const NUDGE_BPM = 5;

  const beats = $derived(
    Array.from({ length: metronome.beatsPerBar }, (_, index) => index),
  );

  const barOptions = Array.from(
    { length: MAX_BEATS_PER_BAR - MIN_BEATS_PER_BAR + 1 },
    (_, index) => index + MIN_BEATS_PER_BAR,
  );

  /**
   * The field is a display of the *committed* value (§8.4). While the typed
   * text is out of range it says so; it is only ever committed on `change` and
   * blur, never on `input` — clamping mid-typing would rewrite `1` to the
   * minimum before the `20` of `120` arrives.
   */
  let tempoOutOfRange = $state(false);

  function onTempoInput(event: Event) {
    tempoOutOfRange = readTempoField(
      (event.currentTarget as HTMLInputElement).value,
    ).outOfRange;
  }

  function commitTempo(event: Event) {
    const field = event.currentTarget as HTMLInputElement;
    const { bpm } = readTempoField(field.value);
    if (bpm !== null) metronome.setTempo(bpm);
    // Write the committed value back, so the field and the engine can never
    // disagree once the user has left it — an empty field self-repairs too.
    field.value = String(metronome.bpm);
    tempoOutOfRange = false;
  }

  /** `Escape` reverts the field and leaves the tempo alone (§8.4 point 4). */
  function onTempoKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    const field = event.currentTarget as HTMLInputElement;
    field.value = String(metronome.bpm);
    tempoOutOfRange = false;
  }
</script>

<HudPanel header="Metronome" chamfer="md" padding="md">
  <div class="controls">
    <Button
      variant={metronome.running ? 'secondary' : 'go'}
      ariaPressed={metronome.running}
      testId="metronome-toggle"
      onclick={() => void metronome.toggle()}
    >
      {#snippet glyph()}
        <span aria-hidden="true">{metronome.running ? '■' : '▶'}</span>
      {/snippet}
      {metronome.running ? 'Stop' : 'Start'}
    </Button>

    <div class="tempo">
      <button
        type="button"
        class="nudge hud-cut hud-cut-sm"
        aria-label="Slower"
        onclick={() => metronome.setTempo(metronome.bpm - NUDGE_BPM)}
      >
        −
      </button>
      <label class="field">
        <span class="visually-hidden">Tempo in beats per minute</span>
        <input
          class="hud-field hud-cut hud-cut-sm tempo-input"
          type="number"
          min={MIN_BPM}
          max={MAX_BPM}
          step="1"
          value={metronome.bpm}
          aria-invalid={tempoOutOfRange ? 'true' : undefined}
          aria-describedby={tempoOutOfRange ? 'tempo-range' : undefined}
          oninput={onTempoInput}
          onchange={commitTempo}
          onblur={commitTempo}
          onkeydown={onTempoKeydown}
          data-testid="metronome-tempo"
        />
      </label>
      <span class="unit">bpm</span>
      <button
        type="button"
        class="nudge hud-cut hud-cut-sm"
        aria-label="Faster"
        onclick={() => metronome.setTempo(metronome.bpm + NUDGE_BPM)}
      >
        +
      </button>
    </div>

    <label class="field">
      <MicroLabel>Beats per bar</MicroLabel>
      <select
        class="hud-field hud-cut hud-cut-sm"
        value={metronome.beatsPerBar}
        onchange={(event) =>
          metronome.setBeatsPerBar(Number(event.currentTarget.value))}
      >
        {#each barOptions as option (option)}
          <option value={option}>{option}</option>
        {/each}
      </select>
    </label>

    <p class="pips" aria-hidden="true" data-testid="metronome-beats">
      {#each beats as beat (beat)}
        <span
          class="pip"
          class:downbeat={beat === 0}
          class:active={metronome.running && metronome.beat === beat}
        >
          <span class="pip-number">{beat + 1}</span>
        </span>
      {/each}
    </p>
  </div>

  {#if tempoOutOfRange}
    <p class="hint" id="tempo-range" data-testid="tempo-hint">
      {TEMPO_RANGE_HINT}
    </p>
  {/if}
</HudPanel>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
  }

  .tempo {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  /* §6: the −/+ nudges are 44 px secondary buttons. They carry no label of
     their own, so they stay native buttons with the field's skin. */
  .nudge {
    width: var(--hit-min);
    height: var(--hit-min);
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--text-1);
    font: inherit;
    cursor: pointer;
  }

  .nudge:hover {
    border-color: var(--panel-border-hot);
    color: var(--accent);
  }

  .tempo-input {
    width: 5rem;
    font-family: var(--font-display);
    font-variant-numeric: tabular-nums;
  }

  .field {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-2);
  }

  .unit {
    color: var(--text-3);
    font-size: var(--fs-small);
  }

  .hint {
    margin-top: var(--space-2);
    color: var(--warn);
    font-size: var(--fs-small);
  }

  .pips {
    display: inline-flex;
    gap: var(--space-2);
    margin-left: auto;
  }

  /* Diamonds like `MasteryPips` (part 1 §5.5), but numbered — so the pip row
     is not re-implemented, only counted. The number counter-rotates so it
     stays upright inside the 45° square. */
  .pip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--space-6);
    height: var(--space-6);
    transform: rotate(45deg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-well);
    color: var(--text-3);
    font-family: var(--font-display);
    font-size: var(--fs-small);
    transition: transform var(--dur-fast) var(--ease);
  }

  .pip-number {
    transform: rotate(-45deg);
  }

  .pip.downbeat {
    border-color: var(--text-3);
  }

  /* A filled accent surface is `--grad-primary`, never flat `--accent`:
     `--on-accent` is white and only clears AA over the gradient's stops
     (4.65 / 8.62) — on flat `--accent` it measures 2.77. */
  .pip.active {
    background: var(--grad-primary);
    border-color: var(--accent-deep);
    color: var(--on-accent);
    transform: rotate(45deg) scale(1.15);
  }

  .pip.downbeat.active {
    background: var(--warn);
    border-color: var(--warn);
    color: var(--on-warn);
  }

  @media (prefers-reduced-motion: reduce) {
    .pip {
      transition: none;
    }
  }
</style>
