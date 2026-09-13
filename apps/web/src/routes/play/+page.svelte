<script lang="ts">
  /**
   * Free play (UX spec §2, route `/play`): the keyboard, what you are holding,
   * the chord it spells — and, since slice 3, the sound. Notes are not played
   * from here: the root layout routes every `midiInput` event to the engine,
   * so this screen stays a view of the same state whatever the source was.
   */
  import MetronomePanel from '$lib/components/audio/MetronomePanel.svelte';
  import SoundStrip from '$lib/components/audio/SoundStrip.svelte';
  import NoMidiStrip from '$lib/components/midi/NoMidiStrip.svelte';
  import PianoKeyboard from '$lib/components/piano/PianoKeyboard.svelte';
  import type { KeyHighlight } from '$lib/components/piano/highlights';
  import { computerKeyboard } from '$lib/midi/computer-keys.svelte';
  import { midiInput } from '$lib/midi/input.svelte';
  import { COMPUTER_KEY_HINT } from '$lib/midi/keymap';
  import { settings } from '$lib/storage/settings.svelte';
  import {
    detectChords,
    midiToName,
    spokenNoteName,
    type Midi,
  } from '$lib/theory';

  /**
   * How long the held set must stay still before we announce it. UX spec §5.5:
   * highlight changes are announced "as summaries, not per key — never per
   * note-on, which would flood a screen reader during play". So the visible
   * readout is *not* a live region; this settling window is, and a run of
   * note-ons while playing only ever produces one announcement at the end.
   * Deliberately far longer than the runner's `CHORD_SETTLE_MS` (90 ms, §4.4):
   * that one captures an answer, this one waits for a hand to come to rest.
   */
  const ANNOUNCE_SETTLE_MS = 700;

  const held = $derived(midiInput.held);

  const highlights = $derived(
    new Map<Midi, KeyHighlight>(held.map((midi) => [midi, 'played'])),
  );

  const noteNames = $derived(held.map((midi) => midiToName(midi)));
  const chords = $derived(detectChords(held));
  const octaveLabel = $derived(midiToName(computerKeyboard.lowestMidi));

  /** What a screen reader hears once the hand settles (empty = say nothing). */
  const spokenSummary = $derived(
    held.length === 0
      ? ''
      : [chords[0]?.name, held.map((midi) => spokenNoteName(midi)).join(', ')]
          .filter(Boolean)
          .join(' — '),
  );

  let announcement = $state('');

  $effect(() => {
    const summary = spokenSummary;
    const timer = setTimeout(() => {
      announcement = summary;
    }, ANNOUNCE_SETTLE_MS);
    // Each change restarts the window, so only the settled set is announced.
    return () => clearTimeout(timer);
  });
</script>

<svelte:head>
  <title>Free play · piano-trainer</title>
</svelte:head>

<h1>Free play</h1>
<p class="lede">
  Play anything — your notes sound and light up here. Press <kbd>M</kbd> to mute.
</p>

<NoMidiStrip />
<SoundStrip />

<!-- Visual only: see `ANNOUNCE_SETTLE_MS` for what is announced instead. -->
<section class="readout">
  <p class="chord" data-testid="chord">
    {#if chords.length > 0}
      {chords[0].name}
    {:else if held.length > 0}
      {noteNames.join(' ')}
    {:else}
      <span class="idle">Play a chord</span>
    {/if}
  </p>
  <p class="notes" data-testid="held-notes">
    {#if held.length > 0}
      <span class="tabular">{noteNames.join(' · ')}</span>
      {#if chords.length > 1}
        <span class="alternatives">
          also {chords
            .slice(1, 4)
            .map((chord) => chord.name)
            .join(' · ')}
        </span>
      {/if}
    {:else}
      &nbsp;
    {/if}
  </p>
</section>

<p
  class="visually-hidden"
  role="status"
  aria-live="polite"
  data-testid="spoken"
>
  {announcement}
</p>

<PianoKeyboard
  layout={61}
  {highlights}
  labels={settings.value.noteLabels}
  onNoteOn={(midi) => midiInput.noteOn(midi, 'onscreen')}
  onNoteOff={(midi) => midiInput.noteOff(midi, 'onscreen')}
/>

<p class="hint">
  Computer keys <kbd>{COMPUTER_KEY_HINT}</kbd> play from {octaveLabel} upwards;
  <kbd>Z</kbd> / <kbd>X</kbd> shift the octave.
</p>

<MetronomePanel />

<style>
  .lede {
    margin-top: var(--space-2);
    margin-bottom: var(--space-5);
    color: var(--text-2);
  }

  .readout {
    margin: var(--space-6) 0;
    text-align: center;
  }

  .chord {
    /* Reserved height, so the line never pushes the keyboard around. */
    min-height: calc(var(--fs-display) * var(--lh-tight));
    font-size: var(--fs-display);
    line-height: var(--lh-tight);
    font-weight: var(--fw-bold);
  }

  .idle {
    color: var(--text-3);
    font-size: var(--fs-h1);
    font-weight: var(--fw-regular);
  }

  .notes {
    min-height: calc(var(--fs-body-lg) * var(--lh-base));
    color: var(--text-2);
    font-size: var(--fs-body-lg);
  }

  .alternatives {
    margin-left: var(--space-3);
    color: var(--text-3);
    font-size: var(--fs-small);
  }

  .hint {
    margin-top: var(--space-5);
    text-align: center;
    color: var(--text-3);
    font-size: var(--fs-small);
  }

  kbd {
    padding: 0 var(--space-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-1);
    color: var(--text-2);
    font-family: var(--font-mono);
    font-size: var(--fs-micro);
  }
</style>
