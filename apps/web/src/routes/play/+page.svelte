<script lang="ts">
  /**
   * Free play (UX spec §2, route `/play`): the keyboard, what you are holding,
   * the chord it spells — and, since slice 3, the sound. Notes are not played
   * from here: the root layout routes every `midiInput` event to the engine,
   * so this screen stays a view of the same state whatever the source was.
   */
  import MetronomePanel from '$lib/components/audio/MetronomePanel.svelte';
  import SoundStrip from '$lib/components/audio/SoundStrip.svelte';
  import Chip from '$lib/components/hud/Chip.svelte';
  import HudPanel from '$lib/components/hud/HudPanel.svelte';
  import MicroLabel from '$lib/components/hud/MicroLabel.svelte';
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

  /**
   * The readout's hot micro-label (§6, §10.1): `CURRENT NOTE` while 0-1 notes
   * are held, `CURRENT CHORD` with two or more. It is live, so it is hot.
   */
  const readoutLabel = $derived(
    held.length >= 2 ? 'Current chord' : 'Current note',
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
  Play anything — your notes sound and light up here. Press <Chip variant="key"
    >M</Chip
  > to mute.
</p>

<NoMidiStrip />
<SoundStrip />

<!--
  The reference's `CURRENT NOTE` HUD readout (§6): the same sunken well as the
  runner's prompt, so the two screens feel like one instrument.
  Visual only — see `ANNOUNCE_SETTLE_MS` for what is announced instead.
-->
<div class="readout">
  <HudPanel well chamfer="lg" padding="lg">
    <div class="readout-body">
      <MicroLabel hot>{readoutLabel}</MicroLabel>
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
    </div>
  </HudPanel>
</div>

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
  Computer keys <Chip variant="key">{COMPUTER_KEY_HINT}</Chip> play from {octaveLabel}
  upwards;
  <Chip variant="key">Z</Chip> / <Chip variant="key">X</Chip> shift the octave.
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
    max-width: var(--content-max);
  }

  .readout-body {
    position: relative;
    text-align: center;
  }

  /* The hot micro-label sits at the well's top-left, as the runner's phase
     label does — the two readouts are the same object (§6). */
  .readout-body :global(.micro) {
    position: absolute;
    top: 0;
    left: 0;
    text-align: left;
  }

  .chord {
    /* Reserved height, so the line never pushes the keyboard around. */
    min-height: calc(var(--fs-display) * var(--lh-tight));
    font-family: var(--font-display);
    font-size: var(--fs-display);
    line-height: var(--lh-tight);
    font-weight: var(--fw-bold);
    text-shadow: var(--glow-text);
  }

  /* The idle line is a sentence, not a readout: no uppercase, no glow. */
  .idle {
    color: var(--text-3);
    font-size: var(--fs-h1);
    font-weight: var(--fw-regular);
    text-shadow: none;
  }

  /* The held notes are a live numeric HUD readout, so they take --cyan. */
  .notes {
    min-height: calc(var(--fs-body-lg) * var(--lh-base));
    color: var(--cyan);
    font-size: var(--fs-body-lg);
  }

  /* `.tabular` (app.css) already fixes the digits; the readout face and
     tracking are what make it a HUD line. */
  .tabular {
    font-family: var(--font-display);
    letter-spacing: var(--track-hud);
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
</style>
