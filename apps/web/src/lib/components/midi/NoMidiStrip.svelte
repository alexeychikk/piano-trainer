<script lang="ts">
  /**
   * "No MIDI device" as an explicit, non-blocking state (UX spec §4.6): a
   * strip, never a dialog. Copy comes from `$lib/midi/status` so every screen
   * says the same thing.
   */
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { midiInput } from '$lib/midi/input.svelte';

  const DISMISS_KEY = 'piano-trainer:midi-strip-dismissed';

  let dismissed = $state(false);

  onMount(() => {
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // No session storage (private mode): showing the strip is harmless.
    }
  });

  function dismiss() {
    dismissed = true;
    try {
      // For this session only — never permanently (§4.6).
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore: the strip is a hint, not state we must keep.
    }
  }

  async function connect() {
    await midiInput.connect();
  }
</script>

{#if midiInput.explanation && !dismissed}
  <div class="strip">
    <span class="glyph" aria-hidden="true">⌨</span>
    <p class="message">{midiInput.explanation}</p>
    {#if midiInput.supported && midiInput.status !== 'granted'}
      <button type="button" class="action" onclick={connect}
        >Connect MIDI</button
      >
    {:else}
      <a class="action" href={`${base}/settings#midi`}>MIDI settings</a>
    {/if}
    <button type="button" class="quiet" onclick={dismiss}>Got it</button>
  </div>
{/if}

<style>
  .strip {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--statusbar-h);
    padding: var(--space-2) var(--space-4);
    background: var(--bg-2);
    border-left: 4px solid var(--warn);
    border-radius: var(--radius-sm);
  }

  .message {
    flex: 1;
    color: var(--text-2);
    font-size: var(--fs-small);
  }

  .action,
  .quiet {
    min-height: var(--hit-min);
    padding: 0 var(--space-4);
    border-radius: var(--radius-sm);
    background: none;
    font-size: var(--fs-small);
    cursor: pointer;
    white-space: nowrap;
  }

  .action {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--accent);
    color: var(--accent);
  }

  .action:hover {
    text-decoration: none;
    background: var(--bg-1);
  }

  .quiet {
    border: 1px solid transparent;
    color: var(--text-3);
  }

  .quiet:hover {
    color: var(--text-1);
  }
</style>
