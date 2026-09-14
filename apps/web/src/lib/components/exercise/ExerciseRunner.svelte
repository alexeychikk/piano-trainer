<script lang="ts">
  /**
   * The exercise runner frame (UX spec §4): status strip, prompt, replay,
   * the fixed feedback slot, the answer area and the shortcut bar — one
   * layout for every exercise, always.
   *
   * It renders whatever the `ExerciseDefinition` supplies and never mentions a
   * particular exercise: everything on screen comes from `Question.prompt`,
   * `Question.expected` and the runner's state machine.
   */
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import NoMidiStrip from '$lib/components/midi/NoMidiStrip.svelte';
  import PianoKeyboard from '$lib/components/piano/PianoKeyboard.svelte';
  import { ExerciseRunner } from '$lib/exercises/runner.svelte';
  import type { AnyExercise } from '$lib/exercises/types';
  import { midiInput } from '$lib/midi/input.svelte';
  import { COMPUTER_KEY_HINT, isTypingTarget } from '$lib/midi/keymap';
  import { settings } from '$lib/storage/settings.svelte';
  import { runnerHighlights } from './highlights';

  const { definition }: { definition: AnyExercise } = $props();

  // The route remounts this component for a different exercise (`{#key}`), so
  // capturing the definition once is exactly right.
  // svelte-ignore state_referenced_locally
  const runner = new ExerciseRunner(definition);

  /** Keyboard height, so a short viewport shrinks the keys (UX §4.1). */
  const KEYBOARD_MAX_H = 280;
  const KEYBOARD_MIN_H = 96;
  let answerHeight = $state(KEYBOARD_MAX_H);
  const keyboardHeight = $derived(
    Math.max(KEYBOARD_MIN_H, Math.min(KEYBOARD_MAX_H, answerHeight)),
  );

  const focusMode = $derived(settings.value.focusMode);
  const keyboardRange = $derived({
    low: settings.value.keyboardLow,
    high: settings.value.keyboardHigh,
  });

  const highlights = $derived(
    runnerHighlights({
      keyboard: keyboardRange,
      questionRange: runner.question?.range,
      held: midiInput.held,
      answered: runner.answerNotes,
      outcome: runner.outcome,
      revealed: runner.revealNotes,
    }),
  );

  const promptTitle = $derived(
    runner.phase === 'paused'
      ? 'Paused'
      : (runner.question?.prompt.title ?? 'Ready?'),
  );
  const promptSubtitle = $derived(
    runner.phase === 'paused'
      ? 'Space to resume'
      : runner.question
        ? runner.question.prompt.subtitle
        : 'Press space to start',
  );
  const replayLabel = $derived(
    runner.phase === 'idle' ? 'Start' : runner.playing ? 'Playing…' : 'Replay',
  );

  function toggleFocus() {
    settings.patch({ focusMode: !settings.value.focusMode });
  }

  /** `Esc` leaves focus mode first, then the drill (UX §4.5, §4.7). */
  async function end() {
    if (settings.value.focusMode) {
      settings.patch({ focusMode: false });
      return;
    }
    await goto(`${base}/`);
  }

  /**
   * The global shortcut contract (§4.5). Handled on the window, with
   * `preventDefault` so `Space` never also activates a focused button — except
   * inside the piano keyboard, where `Space`/`Enter` play the focused key
   * (§5.5) and the answer must win.
   *
   * `f` (focus mode) is deliberately not bound: `F` is a note key and §4.6
   * keeps that mapping live at all times. The `⤢` button is the keyboard path.
   */
  function onKeyDown(event: KeyboardEvent) {
    if (event.repeat || isTypingTarget(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const inKeyboard =
      event.target instanceof HTMLElement &&
      event.target.closest('[data-piano-keyboard]') !== null;

    if (event.key === 'Escape') {
      event.preventDefault();
      void end();
      return;
    }
    if (inKeyboard) return;
    if (event.key === ' ') {
      event.preventDefault();
      runner.space();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      runner.skip();
    }
  }

  onMount(() => {
    // Answers arrive as note events, whatever the source — MIDI port,
    // on-screen keys or computer keys (ADR §3): the runner cannot tell.
    const unsubscribe = midiInput.subscribe((event) => {
      if (event.type === 'on') runner.noteOn(event.midi, event.source);
    });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      unsubscribe();
      window.removeEventListener('keydown', onKeyDown);
      runner.destroy();
    };
  });
</script>

<section class="runner" class:focus={focusMode} data-testid="runner">
  <div class="strip">
    <h1 class="exercise">{definition.title}</h1>
    <p class="stats">
      <span class="stat tabular" data-testid="answered">
        <span class="stat-label">answered</span>
        {runner.correctCount}/{runner.answered}
      </span>
      <span class="stat tabular" data-testid="streak">
        <span aria-hidden="true">🔥</span>
        <span class="visually-hidden">streak</span>
        {runner.streak}
      </span>
      <span class="stat tabular" data-testid="accuracy">
        {runner.accuracy === null ? '—' : `${runner.accuracy}%`}
        <span class="visually-hidden">accuracy</span>
      </span>
    </p>
    <a
      class="icon"
      href={`${base}/settings#practice`}
      title="Exercise settings"
    >
      <span aria-hidden="true">⚙</span>
      <span class="visually-hidden">Exercise settings</span>
    </a>
    <button
      type="button"
      class="icon"
      aria-pressed={focusMode}
      onclick={toggleFocus}
      data-testid="focus-toggle"
    >
      <span aria-hidden="true">⤢</span>
      <span class="visually-hidden">Focus mode</span>
    </button>
  </div>

  <div class="prompt">
    <p class="prompt-title" data-testid="prompt">{promptTitle}</p>
    {#if promptSubtitle}
      <p class="prompt-sub" data-testid="prompt-sub">{promptSubtitle}</p>
    {/if}
  </div>

  <div class="replay-row">
    <button
      type="button"
      class="replay"
      disabled={runner.playing}
      onclick={(event) => {
        // §4.5: a clicked button must not keep focus, or Space would hit it.
        event.currentTarget.blur();
        if (runner.phase === 'idle') void runner.start();
        else runner.replay();
      }}
      data-testid="replay"
    >
      <span aria-hidden="true">▶</span>
      {replayLabel}
      <kbd>Space</kbd>
    </button>
  </div>

  <div class="feedback" data-testid="feedback">
    {#if runner.feedback}
      <p class="feedback-line {runner.feedback.tone}">
        <span aria-hidden="true">{runner.feedback.glyph}</span>
        {runner.feedback.headline}
      </p>
      <p class="feedback-detail">{runner.feedback.detail}</p>
    {/if}
  </div>

  <p class="visually-hidden" role="status" aria-live="polite">
    {runner.announcement}
  </p>

  <!-- Non-blocking, directly above the answer area (§4.6) — never a dialog. -->
  <NoMidiStrip />

  <div class="answer" bind:clientHeight={answerHeight}>
    <PianoKeyboard
      range={keyboardRange}
      {highlights}
      labels={settings.value.noteLabels}
      labelStyle="context"
      spellings={runner.question?.spellings}
      maxHeightPx={keyboardHeight}
      onNoteOn={(midi) => midiInput.noteOn(midi, 'onscreen')}
      onNoteOff={(midi) => midiInput.noteOff(midi, 'onscreen')}
    />
  </div>

  {#if !focusMode}
    <p class="shortcuts">
      <kbd>Space</kbd> replay · <kbd>Enter</kbd> skip &amp; reveal ·
      <kbd>Esc</kbd> end
      {#if !midiInput.connected}
        · piano keys <kbd>{COMPUTER_KEY_HINT}</kbd>
      {/if}
    </p>
  {/if}
</section>

<style>
  /*
   * The runner never scrolls (UX §4.1): it fills what the shell leaves and
   * clips, and the keyboard shrinks (see `keyboardHeight`) rather than pushing
   * anything off screen.
   */
  .runner {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    gap: var(--space-4);
    overflow: hidden;
    /* Cancel the shell's page padding: this screen owns the whole area. */
    margin: calc(-1 * var(--space-7)) calc(-1 * var(--space-6));
    padding: var(--space-4) var(--space-6) var(--space-3);
  }

  .strip {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    min-height: var(--statusbar-h);
    border-bottom: 1px solid var(--border);
  }

  .exercise {
    font-size: var(--fs-h2);
    font-weight: var(--fw-semibold);
  }

  .stats {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    margin-left: auto;
    color: var(--text-2);
  }

  .stat-label {
    color: var(--text-3);
    font-size: var(--fs-small);
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--hit-min);
    height: var(--hit-min);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-1);
    color: var(--text-2);
    cursor: pointer;
  }

  .icon:hover {
    border-color: var(--accent);
    color: var(--accent);
    text-decoration: none;
  }

  .prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 140px;
    text-align: center;
  }

  .prompt-title {
    font-size: var(--fs-prompt);
    line-height: var(--lh-tight);
    font-weight: var(--fw-bold);
  }

  .focus .prompt-title {
    font-size: var(--fs-display);
  }

  .prompt-sub {
    color: var(--text-2);
    font-size: var(--fs-h1);
  }

  .replay-row {
    display: flex;
    justify-content: center;
  }

  .replay {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    width: 240px;
    height: var(--hit-drill);
    border: 1px solid var(--accent);
    border-radius: var(--radius-md);
    background: var(--bg-2);
    color: var(--text-1);
    cursor: pointer;
  }

  .replay:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* Fixed and always reserved: the layout must never shift (§4.1 ⑤). */
  .feedback {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    height: var(--feedback-h);
    text-align: center;
  }

  .feedback-line {
    font-size: var(--fs-feedback);
    line-height: var(--lh-tight);
    font-weight: var(--fw-bold);
    animation: rise var(--dur-fast) var(--ease);
  }

  .feedback-line.success {
    color: var(--success);
  }

  .feedback-line.danger {
    color: var(--danger);
  }

  .feedback-line.hint {
    color: var(--hint);
  }

  .feedback-detail {
    color: var(--text-2);
  }

  /*
   * `flex-basis: 0` on purpose: the area takes the space that is left, and the
   * keyboard sizes itself to *that* (`keyboardHeight`). With `basis: auto` the
   * measured height would feed back into its own flex basis.
   */
  .answer {
    display: flex;
    flex: 1 1 0;
    min-height: 0;
    align-items: flex-end;
  }

  .shortcuts {
    min-height: var(--shortcutbar-h);
    padding-top: var(--space-2);
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

  /* 4 px rise on entry (§4.2) — a literal the spec fixes, see CLAUDE.md. */
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .feedback-line {
      animation: none;
    }
  }
</style>
