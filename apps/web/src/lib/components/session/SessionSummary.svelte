<script lang="ts">
  /**
   * The session summary (UX spec §4.8, `sci-fi-screens.md` §9): a **full
   * screen that replaces the runner**, never a modal — the drill is over, so
   * there is nothing behind it to protect.
   *
   * Every number comes from the pure `summariseSession()`; every sentence from
   * `$lib/practice/copy.ts`. This file is markup over HUD primitives, the same
   * way `/progress` is.
   */
  import { onMount } from 'svelte';
  import Button from '$lib/components/hud/Button.svelte';
  import Chip from '$lib/components/hud/Chip.svelte';
  import HudPanel from '$lib/components/hud/HudPanel.svelte';
  import ListRow from '$lib/components/hud/ListRow.svelte';
  import MasteryPips from '$lib/components/hud/MasteryPips.svelte';
  import MicroLabel from '$lib/components/hud/MicroLabel.svelte';
  import Ring from '$lib/components/hud/Ring.svelte';
  import IconPlay from '$lib/components/icons/IconPlay.svelte';
  import { isTypingTarget } from '$lib/midi/keymap';
  import {
    masteryDelta,
    sessionComplete,
    sessionWeakest,
  } from '$lib/practice/copy';
  import type { SessionSummary } from '$lib/practice/session';

  const {
    summary,
    onAgain,
    onDone,
  }: {
    summary: SessionSummary;
    /** `Practice again` — a new session, same length. */
    onAgain: () => void;
    /** `Done` — back to where a session starts. */
    onDone: () => void;
  } = $props();

  const accuracyPercent = $derived(Math.round(summary.accuracy * 100));

  /**
   * §4.5's contract, at the one place the drill is not running: `Space` starts
   * another session and `Esc` leaves. Handled on the window with
   * `preventDefault`, so `Space` never also activates a focused button.
   */
  function onKeyDown(event: KeyboardEvent) {
    if (event.repeat || isTypingTarget(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === ' ') {
      event.preventDefault();
      onAgain();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onDone();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

{#snippet playGlyph()}
  <IconPlay size="1.1em" />
{/snippet}

<section class="summary" data-testid="session-summary">
  <h1 class="title">{sessionComplete(summary.elapsedMs)}</h1>

  <div class="headline">
    <!-- The one sweep the motion budget allows (§9); `Ring` drops it under
         `prefers-reduced-motion` itself. -->
    <Ring
      value={summary.accuracy}
      caption="score"
      srLabel={`${accuracyPercent} percent of this session answered correctly`}
      sweep
    />
    <p class="readouts">
      <span class="readout">
        <MicroLabel>Answers</MicroLabel>
        <span class="value tabular" data-testid="summary-answers">
          {summary.answers}
        </span>
      </span>
      <span class="readout">
        <MicroLabel>Correct</MicroLabel>
        <span class="value tabular">{summary.correct}</span>
      </span>
      <span class="readout">
        <MicroLabel>Best streak</MicroLabel>
        <span class="value tabular">{summary.bestStreak}</span>
      </span>
    </p>
  </div>

  {#if summary.rows.length > 0}
    <section class="panel" aria-labelledby="skills-touched">
      <HudPanel
        header="Skills touched"
        headerAs="h2"
        headerId="skills-touched"
        padding="none"
      >
        <!-- The rows are DOM siblings: `ListRow`'s hairline is drawn with
             `:not(:first-child)` and a wrapper per row would erase it. -->
        {#each summary.rows as row (row.skillId)}
          <ListRow
            tone={row.direction === 'down' ? 'danger' : 'success'}
            lead={row.label}
            detail={row.exerciseTitle}
            meta={masteryDelta(row.deltaPercent)}
          >
            {#snippet glyph()}
              <!-- Direction is the triangle *and* the sign, never the colour
                   alone (UX §4.8). -->
              {row.direction === 'down' ? '▼' : '▲'}
            {/snippet}
            {#snippet trailing()}
              <MasteryPips mastery={row.mastery} skill={row.label} />
            {/snippet}
          </ListRow>
        {/each}
      </HudPanel>
    </section>
  {/if}

  {#if summary.weakest}
    <p class="weakest">
      <HudPanel well chamfer="md" padding="md">
        <span class="weakest-line">
          {sessionWeakest(
            summary.weakest.label,
            summary.weakest.correct,
            summary.weakest.attempts,
          )}
        </span>
      </HudPanel>
    </p>
  {/if}

  <p class="actions">
    <Button
      variant="primary"
      size="drill"
      glyph={playGlyph}
      testId="practice-again"
      onclick={(event: MouseEvent) => {
        (event.currentTarget as HTMLElement).blur();
        onAgain();
      }}
    >
      Practice again
      <span class="keycap"><Chip variant="key">Space</Chip></span>
    </Button>
    <Button
      variant="ghost"
      size="drill"
      testId="session-done"
      onclick={(event: MouseEvent) => {
        (event.currentTarget as HTMLElement).blur();
        onDone();
      }}
    >
      Done
      <span class="keycap"><Chip variant="key">Esc</Chip></span>
    </Button>
  </p>
</section>

<style>
  .summary {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
    max-width: var(--content-max);
    margin: 0 auto;
  }

  .title {
    font-size: var(--fs-h1);
    text-align: center;
  }

  .headline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--space-7);
  }

  .readouts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-7);
  }

  /* The §4.4 HUD readout: micro-label over a display numeral. */
  .readout {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .value {
    font-family: var(--font-display);
    font-size: var(--fs-h1);
    color: var(--text-1);
    text-shadow: var(--glow-text);
  }

  .panel,
  .weakest {
    width: 100%;
  }

  /* Sentence case, 18 px, `--text-2` — a pointer, not a verdict (§9). */
  .weakest-line {
    display: block;
    font-size: var(--fs-body-lg);
    color: var(--text-2);
    text-align: center;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-4);
    margin-top: var(--space-3);
  }

  .keycap {
    margin-left: var(--space-1);
  }
</style>
