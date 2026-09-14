<script lang="ts">
  /**
   * Metronome controls (slice 3). The UX spec only fixes the *setting*
   * (§6.3: `Metronome tempo [ 90 ] bpm`), so this panel follows the shell's
   * visual language rather than inventing a new one: one row, everything
   * reachable with Tab, and `m` still mutes globally.
   *
   * The beat indicator is a row of numbered pips — the running beat is filled
   * *and* larger, and the downbeat is outlined, so the state never rests on
   * colour alone (UX spec §8).
   */
  import { metronome } from '$lib/audio/metronome.svelte';
  import {
    MAX_BEATS_PER_BAR,
    MAX_BPM,
    MIN_BEATS_PER_BAR,
    MIN_BPM,
  } from '$lib/audio/scheduler';

  /** ± steps that feel right on a tempo field. */
  const NUDGE_BPM = 5;

  const beats = $derived(
    Array.from({ length: metronome.beatsPerBar }, (_, index) => index),
  );

  /**
   * Committed on `change`, not on every keystroke: clamping mid-typing would
   * rewrite "1" to the minimum tempo before the "20" arrives.
   */
  function onTempoChange(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(value)) metronome.setTempo(value);
  }
</script>

<section class="metronome" aria-labelledby="metronome-heading">
  <h2 id="metronome-heading">Metronome</h2>

  <div class="controls">
    <button
      type="button"
      class="toggle"
      aria-pressed={metronome.running}
      data-testid="metronome-toggle"
      onclick={() => void metronome.toggle()}
    >
      <span aria-hidden="true">{metronome.running ? '■' : '▶'}</span>
      {metronome.running ? 'Stop' : 'Start'}
    </button>

    <div class="tempo">
      <button
        type="button"
        class="nudge"
        aria-label="Slower"
        onclick={() => metronome.setTempo(metronome.bpm - NUDGE_BPM)}
      >
        −
      </button>
      <label class="field">
        <span class="visually-hidden">Tempo in beats per minute</span>
        <input
          type="number"
          min={MIN_BPM}
          max={MAX_BPM}
          step="1"
          value={metronome.bpm}
          onchange={onTempoChange}
          data-testid="metronome-tempo"
        />
      </label>
      <span class="unit">bpm</span>
      <button
        type="button"
        class="nudge"
        aria-label="Faster"
        onclick={() => metronome.setTempo(metronome.bpm + NUDGE_BPM)}
      >
        +
      </button>
    </div>

    <label class="field">
      <span>Beats per bar</span>
      <select
        value={metronome.beatsPerBar}
        onchange={(event) =>
          metronome.setBeatsPerBar(Number(event.currentTarget.value))}
      >
        {#each Array.from({ length: MAX_BEATS_PER_BAR - MIN_BEATS_PER_BAR + 1 }, (_, index) => index + MIN_BEATS_PER_BAR) as option (option)}
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
          {beat + 1}
        </span>
      {/each}
    </p>
  </div>
</section>

<style>
  .metronome {
    margin-top: var(--space-6);
    padding: var(--space-4) var(--space-5);
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  h2 {
    font-size: var(--fs-h2);
    color: var(--text-2);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
    margin-top: var(--space-3);
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 7rem;
    min-height: var(--hit-min);
    padding: 0 var(--space-4);
    background: var(--bg-2);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    color: var(--accent);
    font: inherit;
    cursor: pointer;
  }

  /* A filled accent surface is `--grad-primary`, never flat `--accent`:
     `--on-accent` is white and only clears AA over the gradient's stops
     (4.65 / 8.62) — on flat `--accent` it measures 2.77. */
  .toggle[aria-pressed='true'] {
    background: var(--grad-primary);
    border-color: var(--accent-deep);
    color: var(--on-accent);
  }

  .tempo {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .nudge {
    width: var(--hit-min);
    height: var(--hit-min);
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-1);
    font: inherit;
    cursor: pointer;
  }

  .field {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-2);
  }

  input,
  select {
    min-height: var(--hit-min);
    padding: 0 var(--space-3);
    background: var(--bg-2);
    color: var(--text-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font: inherit;
  }

  input {
    width: 5rem;
    font-family: var(--font-mono);
  }

  .unit {
    color: var(--text-3);
    font-size: var(--fs-small);
  }

  .pips {
    display: inline-flex;
    gap: var(--space-2);
    margin-left: auto;
  }

  .pip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--space-6);
    height: var(--space-6);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    color: var(--text-3);
    font-family: var(--font-mono);
    font-size: var(--fs-small);
    transition: transform var(--dur-fast) var(--ease);
  }

  .pip.downbeat {
    border-color: var(--text-3);
  }

  .pip.active {
    background: var(--grad-primary);
    border-color: var(--accent-deep);
    color: var(--on-accent);
    transform: scale(1.15);
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
