<script lang="ts">
  /**
   * The exercise runner frame (UX spec §4): status rail, prompt, replay,
   * the fixed feedback slot, the answer area and the shortcut bar — one
   * layout for every exercise, always.
   *
   * It renders whatever the `ExerciseDefinition` supplies and never mentions a
   * particular exercise: everything on screen comes from `Question.prompt`,
   * `Question.expected` and the runner's state machine.
   *
   * Visual treatment: `docs/design/sci-fi-screens.md` §5 — every panel, button
   * and bar here is a `$lib/components/hud/` primitive; none of them is
   * re-styled locally.
   */
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import Button from '$lib/components/hud/Button.svelte';
  import Chip from '$lib/components/hud/Chip.svelte';
  import GlyphBadge from '$lib/components/hud/GlyphBadge.svelte';
  import HudPanel from '$lib/components/hud/HudPanel.svelte';
  import MicroLabel from '$lib/components/hud/MicroLabel.svelte';
  import ProgressBar from '$lib/components/hud/ProgressBar.svelte';
  import IconExpand from '$lib/components/icons/IconExpand.svelte';
  import IconSettings from '$lib/components/icons/IconSettings.svelte';
  import NoMidiStrip from '$lib/components/midi/NoMidiStrip.svelte';
  import PianoKeyboard from '$lib/components/piano/PianoKeyboard.svelte';
  import { BED_CHROME_H } from '$lib/components/piano/geometry';
  import { phaseLabel } from '$lib/exercises/phases';
  import { ExerciseRunner, expectedLength } from '$lib/exercises/runner.svelte';
  import { STREAK_CALLOUT } from '$lib/exercises/feedback';
  import type { AnyExercise } from '$lib/exercises/types';
  import { midiToName, type Midi } from '$lib/theory';
  import { midiInput } from '$lib/midi/input.svelte';
  import { buildPlan, targetSkillsFor } from '$lib/practice/planner';
  import type { SessionRun } from '$lib/practice/session.svelte';
  import { practice } from '$lib/practice/store.svelte';
  import {
    COMPUTER_KEY_HINT,
    OCTAVE_DOWN_HINT,
    OCTAVE_SHIFT_HINT_LABEL,
    OCTAVE_UP_HINT,
    isTypingTarget,
  } from '$lib/midi/keymap';
  import { settings } from '$lib/storage/settings.svelte';
  import { runnerHighlights } from './highlights';

  const {
    definition,
    /**
     * Drill the schedule rather than the whole exercise (`?due=1` — home's
     * `Practice now` and `/progress`'s `Drill these`, slice 9a). The runner
     * only ever sees a list of skill ids, so it still knows nothing about the
     * exercise; the planner decides what is in it.
     */
    dueFirst = false,
    /**
     * A mixed session (`/session`, slice 9b): it supplies the exercise per
     * question, the skills to favour and the clock. The frame is the same
     * one, with the two differences the spec fixes (sci-fi-screens.md §9) —
     * the rail's title follows the *current* exercise and its bar shows time
     * instead of question count. Absent for a plain drill.
     */
    session = null,
  }: {
    definition: AnyExercise;
    dueFirst?: boolean;
    session?: SessionRun | null;
  } = $props();

  // The route remounts this component for a different exercise (`{#key}`), so
  // capturing the definition once is exactly right.
  // svelte-ignore state_referenced_locally
  // Every graded answer is logged (slice 5a). `record()` returns immediately
  // and queues the write, so persistence never sits inside the state machine's
  // callback — and the runner keeps knowing nothing about storage.
  const runner = new ExerciseRunner(definition, {
    // Read at every question, not captured: the plan moves as the drill is
    // answered (a skill just passed drops out of it), and a run that started
    // before the store hydrated still picks the schedule up.
    targetSkills: () =>
      session
        ? session.targetSkills()
        : dueFirst
          ? targetSkillsFor(
              buildPlan(
                [
                  {
                    id: definition.id,
                    skillIds: definition.skillsCovered(
                      definition.defaultSettings,
                    ),
                  },
                ],
                practice.byId,
                Date.now(),
              ),
              definition.id,
            )
          : [],
    pickExercise: session ? () => session.pickExercise() : undefined,
    shouldContinue: session ? () => session.shouldContinue() : undefined,
    onEnd: session ? () => session.end() : undefined,
    onAttempt: (attempt) => {
      // The store is the one authority on mastery, so the session's delta is
      // read from it — before the attempt lands and after (slice 9b).
      const before = practice.byId.get(attempt.skillId)?.mastery ?? null;
      practice.record(attempt);
      const after = practice.byId.get(attempt.skillId)?.mastery ?? 0;
      session?.record(attempt, before, after, runner.streak);
    },
  });

  /** Keyboard height, so a short viewport shrinks the keys (UX §4.1). */
  const KEYBOARD_MAX_H = 280;
  const KEYBOARD_MIN_H = 96;
  let answerHeight = $state(KEYBOARD_MAX_H);
  /** The bed is part of the component's height now (sci-fi-screens.md §4.3). */
  const keyboardHeight = $derived(
    Math.max(
      KEYBOARD_MIN_H,
      Math.min(KEYBOARD_MAX_H, answerHeight - BED_CHROME_H),
    ),
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
  /** `Start` is the one "go" affordance of the drill (§5.4). */
  const replayVariant = $derived(runner.phase === 'idle' ? 'go' : 'secondary');
  const phase = $derived(phaseLabel(runner.phase));
  /** The rail's bar: how much of what has been answered was right (UX §4.1 ②). */
  const answeredFraction = $derived(
    runner.answered === 0 ? 0 : runner.correctCount / runner.answered,
  );

  /**
   * The note slots of a `note-sequence` answer (UX §4.4): one `◻` per expected
   * note, filling with names as they are played. Nothing exercise-specific —
   * the count comes from `Question.expected`, the spelling from
   * `Question.spellings` (the same map the keys are labelled from).
   */
  const sequenceMode = $derived(
    runner.question?.answerMode === 'note-sequence',
  );
  const slots = $derived.by(() => {
    const question = runner.question;
    if (!question || !sequenceMode) return [];
    const played = runner.answerNotes;
    const count = Math.max(expectedLength(question.expected), played.length);
    return Array.from({ length: count }, (_, index) => {
      const midi: Midi | undefined = played[index];
      return {
        index,
        label:
          midi === undefined
            ? '◻'
            : (question.spellings?.get(midi) ?? midiToName(midi, 'flat')),
        filled: midi !== undefined,
      };
    });
  });

  function toggleFocus() {
    settings.patch({ focusMode: !settings.value.focusMode });
  }

  /**
   * `Esc` leaves focus mode first, then the drill (UX §4.5, §4.7). In a
   * session it ends the run and the summary replaces the frame (§4.8) rather
   * than navigating away — a session that is over still has something to say.
   */
  async function end() {
    if (settings.value.focusMode) {
      settings.patch({ focusMode: false });
      return;
    }
    if (session) {
      runner.end();
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
    if (event.key === 'Backspace') {
      /*
       * §4.5's row reads "clear the answer in progress"; we take back the *last*
       * note instead — §4.4's own wording, what the shortcut bar promises
       * (`⌫ clear last`) and the better reading: one fumbled key should not cost
       * the notes already played right.
       *
       * Deliberately handled above the `inKeyboard` return: the piano keyboard
       * binds no Backspace (§5.5 is `Space`/`Enter`), so answering with roving
       * focus on the on-screen keys would otherwise have no undo at all. The
       * runner ignores it outside a `note-sequence` answer.
       */
      event.preventDefault();
      runner.backspace();
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
      return;
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
  <!-- ② The status rail (§5.2): full-bleed chrome, like the top bar, and the
       one element that survives focus mode. Never chamfered (deviation 20). -->
  <div class="rail">
    <!-- The *current* exercise: in a session the questions are mixed, so the
         title follows the question, never the route (§9). -->
    <h1 class="exercise">{runner.definition.title}</h1>
    <div class="progress" data-testid="answered">
      {#if session}
        <!-- §9: the session's bar is the clock, counting down. -->
        <ProgressBar
          value={session.timeValue}
          label="Time"
          readout={session.timeReadout}
        />
      {:else}
        <ProgressBar
          value={answeredFraction}
          label="Answered"
          readout="{runner.correctCount}/{runner.answered}"
        />
      {/if}
    </div>
    <p class="readouts">
      <span class="readout" data-testid="streak">
        <MicroLabel>streak</MicroLabel>
        <span
          class="value tabular"
          class:callout={runner.streak >= STREAK_CALLOUT}>{runner.streak}</span
        >
      </span>
      <span class="readout" data-testid="accuracy">
        <MicroLabel>accuracy</MicroLabel>
        <span
          class="value tabular"
          class:live={runner.accuracy !== null}
          class:muted={runner.accuracy === null}
        >
          {runner.accuracy === null ? '—' : `${runner.accuracy}%`}
        </span>
      </span>
    </p>
    <a
      class="icon"
      href={`${base}/settings#practice`}
      aria-label="Exercise settings"
    >
      <span class="edge hud-cut hud-cut-sm">
        <span class="face hud-cut hud-cut-sm"><IconSettings /></span>
      </span>
    </a>
    <button
      type="button"
      class="icon"
      aria-pressed={focusMode}
      aria-label="Focus mode"
      onclick={toggleFocus}
      data-testid="focus-toggle"
    >
      <span class="edge hud-cut hud-cut-sm">
        <span class="face hud-cut hud-cut-sm"><IconExpand /></span>
      </span>
    </button>
  </div>

  <!-- ③ The prompt, in the sunken HUD readout well (§5.3). -->
  <div class="prompt-row">
    <div class="prompt-well">
      <HudPanel well chamfer="lg" padding="lg">
        <div class="prompt">
          <span class="phase">
            <MicroLabel hot={phase.hot}>{phase.label}</MicroLabel>
          </span>
          <p class="prompt-title" data-testid="prompt">{promptTitle}</p>
          {#if promptSubtitle}
            <p class="prompt-sub" data-testid="prompt-sub">{promptSubtitle}</p>
          {/if}
        </div>
      </HudPanel>
    </div>
  </div>

  <div class="replay-row">
    <div class="replay">
      <Button
        variant={replayVariant}
        size="drill"
        disabled={runner.playing}
        testId="replay"
        block
        onclick={(event: MouseEvent) => {
          // §4.5: a clicked button must not keep focus, or Space would hit it.
          (event.currentTarget as HTMLElement).blur();
          if (runner.phase === 'idle') void runner.start();
          else runner.replay();
        }}
      >
        {#snippet glyph()}▶{/snippet}
        {replayLabel}
        <span class="keycap"><Chip variant="key">Space</Chip></span>
      </Button>
    </div>
  </div>

  <!-- ⑤ 88 px, always reserved, but never a box when empty (§5.5). -->
  <div class="feedback" data-testid="feedback">
    {#if runner.feedback}
      <div class="strip-glow hud-glow hud-glow-{runner.feedback.tone}">
        <div class="strip {runner.feedback.tone} hud-cut">
          <GlyphBadge tone={runner.feedback.tone}>
            {runner.feedback.glyph}
          </GlyphBadge>
          <p class="feedback-line">{runner.feedback.headline}</p>
          <p class="feedback-detail">{runner.feedback.detail}</p>
        </div>
      </div>
    {:else if sequenceMode}
      <!-- The note slots of a sequence answer (§4.4), in the slot that is
           reserved and empty for exactly as long as an answer is open. -->
      <p class="slots" data-testid="slots">
        <MicroLabel>answer</MicroLabel>
        {#each slots as slot (slot.index)}
          <span class="slot" class:filled={slot.filled}>{slot.label}</span>
        {/each}
      </p>
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
    <p class="shortcuts" data-testid="shortcuts">
      <Chip variant="key">Space</Chip> replay ·
      <Chip variant="key">Enter</Chip> skip &amp; reveal ·
      {#if sequenceMode}
        <Chip variant="key">⌫</Chip> clear last ·
      {/if}
      <Chip variant="key">Esc</Chip> end
      {#if !midiInput.connected}
        <!-- The whole mapping, `Z` / `X` included (§4.6): with the root at the
             bottom of a voicing, most answers need the shift between notes. -->
        · piano keys <Chip variant="key">{COMPUTER_KEY_HINT}</Chip>
        · <Chip variant="key">{OCTAVE_DOWN_HINT}</Chip> /
        <Chip variant="key">{OCTAVE_UP_HINT}</Chip>
        {OCTAVE_SHIFT_HINT_LABEL}
      {/if}
    </p>
  {/if}
</section>

<style>
  /*
   * The runner never scrolls (UX §4.1): it fills what the shell leaves and
   * clips, and the keyboard shrinks (see `keyboardHeight`) rather than pushing
   * anything off screen.
   *
   * The literals below (the strip's 4 px edge bar, the feedback strip's
   * 720 px measure, the 240 px replay button) are spec-fixed values from
   * UX §4.1 and sci-fi-screens.md §5.4–§5.5 — the exemption in `CLAUDE.md`.
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
    padding: 0 var(--space-6) var(--space-3);
  }

  /* Full-bleed band, not a panel: `--grad-panel`, a luminous bottom edge and a
     downward glow — the same chrome as the top bar, so the two read as one
     stack (§5.2). */
  .rail {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    min-height: var(--statusbar-h);
    margin: 0 calc(-1 * var(--space-6));
    padding: 0 var(--space-6);
    background: var(--grad-panel);
    background-color: var(--bg-1);
    border-bottom: 1px solid var(--panel-border);
    box-shadow: var(--glow-panel);
  }

  /* An `h1` that is only 20 px: uppercase stops there (part 1 §4.2), so the
     rail's exercise title keeps the sentence case of the copy deck. */
  .exercise {
    font-size: var(--fs-h2);
    font-weight: var(--fw-semibold);
    text-transform: none;
    letter-spacing: var(--track-none);
    white-space: nowrap;
  }

  .progress {
    width: 200px; /* ~200 px question progress (§5.2) */
  }

  .readouts {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    margin-left: auto;
  }

  /* Label over value, the §4.4 HUD readout at rail scale: no well, no glow. */
  .readout {
    display: flex;
    flex-direction: column;
    line-height: var(--lh-snug);
  }

  .value {
    font-family: var(--font-display);
    font-size: var(--fs-body-lg);
    color: var(--text-1);
  }

  /* At the callout streak the drill speeds up *and* says so in the feedback
     line, so the colour is never the only sign (§5.2). Weak/attention is
     `--warn`, never `--danger` — that means *wrong* in the answer path (§2.3). */
  .callout {
    color: var(--warn);
  }

  /* A live numeric readout is cyan (§5.2, part 1 §2.1); the em dash of "no
     answers yet" is muted, because there is nothing live to report. */
  .live {
    color: var(--cyan);
  }

  .muted {
    color: var(--text-3);
  }

  /* 44 px icon buttons (§5.2): chamfered, with the meaningful edge on hover
     and focus. `⚙` is a link to the per-exercise settings, never a dialog. */
  .icon {
    display: inline-flex;
    width: var(--hit-min);
    height: var(--hit-min);
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
  }

  .icon .edge {
    display: flex;
    flex: 1;
    background: var(--border);
  }

  .icon .face {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    margin: 1px;
    background: var(--bg-2);
    color: var(--text-2);
    font-size: var(--fs-body-lg);
  }

  .icon:hover .edge,
  .icon:focus-visible .edge {
    background: var(--panel-border-hot);
  }

  .icon:hover .face {
    color: var(--text-1);
    text-decoration: none;
  }

  .icon[aria-pressed='true'] .face {
    background: var(--grad-primary);
    color: var(--on-accent);
  }

  /* Chamfered focus: the edge layer is the ring (part 1 §3.4). */
  .icon:focus-visible {
    outline: none;
    box-shadow: none;
  }

  .icon:focus-visible .edge {
    background: var(--focus);
  }

  .icon:focus-visible .face {
    margin: 3px;
  }

  .prompt-row {
    display: flex;
    justify-content: center;
  }

  /* The reference's `CURRENT NOTE` readout *is* our prompt (§5.3): the well
     variant of the one panel primitive, no glow — the type carries it
     (deviation 21). */
  .prompt-well {
    flex: 1;
    max-width: var(--content-max);
  }

  .prompt {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    /* UX §4.1 ③: the prompt region is at least 140 px, minus the well's own
       `--space-5` padding above and below. */
    min-height: calc(140px - 2 * var(--space-5));
    text-align: center;
  }

  .phase {
    position: absolute;
    top: 0;
    left: 0;
  }

  .prompt-title {
    font-family: var(--font-display);
    font-size: var(--fs-prompt);
    line-height: var(--lh-tight);
    font-weight: var(--fw-bold);
    letter-spacing: var(--track-heading);
    text-transform: uppercase;
    text-shadow: var(--glow-text);
  }

  .focus .prompt-title {
    font-size: var(--fs-display);
  }

  /* Body copy: sentence case, sans, never display (part 1 deviations 5–6). */
  .prompt-sub {
    color: var(--text-2);
    font-size: var(--fs-h1);
  }

  .replay-row {
    display: flex;
    justify-content: center;
  }

  .replay {
    width: 240px; /* the 240 × 64 primary control of the screen (§5.4) */
  }

  .keycap {
    margin-left: var(--space-1);
  }

  /* Fixed and always reserved: the layout must never shift (§4.1 ⑤). */
  .feedback {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--feedback-h);
  }

  /* The state strip inside the reserved slot (§5.5): a 4 px edge bar in the
     state colour, the glyph badge, the headline, the detail. The glow is on
     the unclipped parent — a chamfered element cannot wear its own
     (`hud.css`). */
  .strip-glow {
    width: 100%;
    max-width: 720px;
    animation: rise var(--dur-fast) var(--ease);
  }

  .strip {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--bg-2);
    border-left: 4px solid var(--tone-color);

    --tone-color: var(--text-3);
  }

  .strip.success {
    --tone-color: var(--success);
  }

  .strip.danger {
    --tone-color: var(--danger);
  }

  .strip.hint {
    --tone-color: var(--hint);
  }

  .feedback-line {
    font-family: var(--font-display);
    font-size: var(--fs-feedback);
    line-height: var(--lh-tight);
    font-weight: var(--fw-bold);
    letter-spacing: var(--track-heading);
    text-transform: uppercase;
    color: var(--tone-color);
  }

  /* Sentence case, sans: it carries `Space to continue` verbatim (§5.5). */
  .feedback-detail {
    margin-left: auto;
    padding-left: var(--space-4);
    color: var(--text-2);
    font-size: var(--fs-body-lg);
    text-align: right;
  }

  /* The answer slots (§4.4): the sunken HUD readout treatment the prompt well
     and Free Play's readout share, at chip scale — an empty slot is the `◻`
     glyph in muted ink, a filled one the note name in cyan, so the state is
     never carried by colour alone (§8.1).

     They live *inside* the reserved feedback slot rather than in a row of
     their own above the keys (a deviation from §4.4's sketch): that slot is
     88 px, always reserved and empty for exactly as long as an answer is open,
     so the slots cost no height at all — and the runner, which must never
     scroll (§4.1), still fits a keyboard at a 720 px viewport with the no-MIDI
     strip showing. Nothing is ever hidden by this: the moment feedback exists,
     the answer is graded and the keys carry it in colour and glyph. */
  .slots {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }

  .slot {
    min-width: 72px; /* three note names wide, so filling never reflows */
    padding: var(--space-1) var(--space-3);
    background: var(--bg-well);
    border: 1px solid var(--border);
    color: var(--text-3);
    font-family: var(--font-display);
    font-size: var(--fs-body-lg);
    letter-spacing: var(--track-hud);
    text-align: center;
  }

  .slot.filled {
    border-color: var(--accent);
    color: var(--cyan);
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

  /* ⑦ The manual (§5.7): never abbreviated, never a tooltip. */
  .shortcuts {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--shortcutbar-h);
    padding-top: var(--space-2);
    color: var(--text-3);
    font-size: var(--fs-small);
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
    .strip-glow {
      animation: none;
    }
  }
</style>
