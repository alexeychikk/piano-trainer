<script lang="ts">
  /**
   * The audio state as a strip, in the same non-blocking shape as
   * `NoMidiStrip` (UX spec §4.6): "sound is not started yet" is normal, one
   * click fixes it, and nothing about it is a dialog. Copy comes from
   * `$lib/audio/status` so every screen says the same thing.
   */
  import { audio } from '$lib/audio/engine.svelte';
  import { audioExplanation } from '$lib/audio/status';

  const explanation = $derived(audioExplanation({ status: audio.status }));
</script>

{#if explanation}
  <div class="strip" data-testid="sound-strip">
    <span class="glyph" aria-hidden="true">{audio.chip.glyph}</span>
    <p class="message">{explanation}</p>
    {#if audio.status === 'idle'}
      <button
        type="button"
        class="action"
        data-testid="enable-sound"
        onclick={() => void audio.ensureStarted()}
      >
        Enable sound
      </button>
    {/if}
  </div>
{/if}

<style>
  .strip {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--statusbar-h);
    margin-top: var(--space-3);
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

  .action {
    display: inline-flex;
    align-items: center;
    min-height: var(--hit-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--accent);
    font-size: var(--fs-small);
    cursor: pointer;
    white-space: nowrap;
  }

  .action:hover {
    background: var(--bg-1);
  }
</style>
