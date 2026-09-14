<script lang="ts">
  /**
   * "Teach the app your keyboard" (UX spec §6.3), inline in Settings — a
   * panel, not a dialog, dismissible with `Esc` (§8.3). Notes arrive through
   * the one input store, so a MIDI piano, the on-screen keys and the computer
   * keys all teach the range the same way.
   */
  import { onMount } from 'svelte';
  import { midiInput } from '$lib/midi/input.svelte';
  import {
    IDLE_WIZARD,
    pressKey,
    startWizard,
    wizardPrompt,
    type WizardState,
  } from '$lib/midi/range';
  import { settings } from '$lib/storage/settings.svelte';
  import { midiToName } from '$lib/theory';

  let wizard = $state<WizardState>(IDLE_WIZARD);
  const prompt = $derived(wizardPrompt(wizard));
  const running = $derived(wizard.step === 'low' || wizard.step === 'high');

  const current = $derived(
    `${midiToName(settings.value.keyboardLow)} to ${midiToName(
      settings.value.keyboardHigh,
    )}`,
  );

  function start() {
    wizard = startWizard();
  }

  function cancel() {
    wizard = IDLE_WIZARD;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (running && event.key === 'Escape') cancel();
  }

  onMount(() => {
    const unsubscribe = midiInput.subscribe((event) => {
      if (event.type !== 'on') return;
      if (wizard.step !== 'low' && wizard.step !== 'high') return;
      const next = pressKey(wizard, event.midi);
      wizard = next;
      if (next.step === 'done' && next.low !== null && next.high !== null) {
        settings.patch({ keyboardLow: next.low, keyboardHigh: next.high });
      }
    });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      unsubscribe();
      window.removeEventListener('keydown', onKeyDown);
    };
  });
</script>

<div class="wizard" data-testid="range-wizard">
  <p class="current">
    Keyboard range: <span class="value" data-testid="range-value"
      >{current}</span
    >
  </p>

  {#if running}
    <p
      class="prompt"
      role="status"
      aria-live="polite"
      data-testid="range-prompt"
    >
      {prompt}
    </p>
    {#if wizard.problem}
      <p class="problem"><span aria-hidden="true">⚠</span> {wizard.problem}</p>
    {/if}
    <button type="button" class="action" onclick={cancel}>
      Cancel <kbd>Esc</kbd>
    </button>
  {:else}
    {#if wizard.step === 'done'}
      <p class="done" role="status" aria-live="polite">
        <span aria-hidden="true">✓</span>
        {prompt}
      </p>
    {/if}
    <button
      type="button"
      class="action"
      onclick={start}
      data-testid="range-start"
    >
      Set up range
    </button>
  {/if}
</div>

<style>
  .wizard {
    margin-top: var(--space-4);
    padding: var(--space-4);
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .value {
    font-family: var(--font-mono);
  }

  .prompt {
    margin-top: var(--space-2);
    color: var(--text-1);
    font-size: var(--fs-body-lg);
  }

  .problem {
    margin-top: var(--space-2);
    color: var(--warn);
    font-size: var(--fs-small);
  }

  .done {
    margin-top: var(--space-2);
    color: var(--success);
    font-size: var(--fs-small);
  }

  .action {
    min-height: var(--hit-min);
    margin-top: var(--space-3);
    padding: 0 var(--space-4);
    background: var(--bg-1);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    color: var(--accent);
    cursor: pointer;
  }

  kbd {
    padding: 0 var(--space-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-2);
    font-family: var(--font-mono);
    font-size: var(--fs-micro);
  }
</style>
