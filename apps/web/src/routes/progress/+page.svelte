<script lang="ts">
  /**
   * `/progress` (UX spec §6.1) in the part-2 language
   * (`docs/design/sci-fi-screens.md` §7): the `TODAY` panel — counters, the
   * accuracy `Ring`, the 28-day `Meter` — then one panel per exercise with a
   * wrapping grid of skill cells, each showing the 7 mastery pips and its
   * percentage.
   *
   * Every surface here is a `$lib/components/hud/` primitive; nothing is
   * re-styled locally. The numbers all come from the pure
   * `$lib/practice/progress.ts`, so this file is markup.
   *
   * Two things the spec draws that slice 5a has no data for, and does not
   * fake: the `DUE NOW` counter (with the per-panel `DUE n` badge) and
   * `Drill these` — both belong to the spaced-repetition planner, which is
   * slice 9. `Export JSON` is slice 5b.
   */
  import { base } from '$app/paths';
  import Button from '$lib/components/hud/Button.svelte';
  import HudPanel from '$lib/components/hud/HudPanel.svelte';
  import MasteryPips from '$lib/components/hud/MasteryPips.svelte';
  import Meter from '$lib/components/hud/Meter.svelte';
  import MicroLabel from '$lib/components/hud/MicroLabel.svelte';
  import Ring from '$lib/components/hud/Ring.svelte';
  import IconPlay from '$lib/components/icons/IconPlay.svelte';
  import { DEFAULT_EXERCISE_ID, EXERCISES } from '$lib/exercises/registry';
  import { PRACTICE_COPY } from '$lib/practice/copy';
  import {
    buildGroups,
    fallbackSkillLabel,
    STRIP_DAYS,
    summarise,
  } from '$lib/practice/progress';
  import { practice } from '$lib/practice/store.svelte';

  /**
   * One clock for the screen, read when it opens: every "last seen" line and
   * every day bucket then agrees, and nothing re-renders on a timer behind the
   * user's back.
   */
  const now = Date.now();

  const totals = $derived(summarise(practice.attempts, now));

  const groups = $derived(
    buildGroups(
      EXERCISES.map((exercise) => ({
        id: exercise.id,
        title: exercise.title,
        skillIds: exercise.skillsCovered(exercise.defaultSettings),
        // The screen never decodes a skill id: the exercise names its own
        // skills (`skillLabel`), or the id's last segment stands in.
        label: (skillId: string) =>
          exercise.skillLabel?.(skillId, exercise.defaultSettings) ??
          fallbackSkillLabel(skillId),
      })),
      practice.byId,
      practice.attempts,
      now,
    ),
  );

  const hasData = $derived(
    practice.attempts.length > 0 || practice.skills.length > 0,
  );
  // An exercise nothing has touched gets no panel — the screen answers "what is
  // solid?", and twelve `new` cells answer nothing. Mastery, not the attempt
  // count, is the test: an imported profile (slice 5b) may arrive without a log.
  const practised = $derived(
    groups.filter((group) => group.attempts > 0 || group.mastery !== null),
  );

  const streakLabel = $derived(
    totals.streakDays === 1 ? '1 day' : `${totals.streakDays} days`,
  );
  const stripLabel = $derived(
    `Attempts over the last ${STRIP_DAYS} days, ending today: ${totals.stripCounts.join(', ')}`,
  );
</script>

<svelte:head>
  <title>Progress · piano-trainer</title>
</svelte:head>

{#snippet playGlyph()}
  <IconPlay size="1.1em" />
{/snippet}

<h1>Progress</h1>

{#if hasData}
  <section class="today" aria-labelledby="today-heading">
    <HudPanel header="Today" headerAs="h2" headerId="today-heading">
      <div class="today-body">
        <div class="counters">
          <p class="counter">
            <MicroLabel>Streak</MicroLabel>
            <span class="value tabular">{streakLabel}</span>
          </p>
          <p class="counter">
            <MicroLabel>Attempts</MicroLabel>
            <span class="value tabular">{totals.attempts}</span>
          </p>
        </div>

        {#if totals.accuracy7d !== null}
          <Ring
            value={totals.accuracy7d}
            caption="accuracy (7d)"
            srLabel={`${Math.round(
              totals.accuracy7d * 100,
            )} percent accuracy over the last 7 days`}
          />
        {/if}
      </div>

      <div class="strip">
        <Meter values={totals.strip} srLabel={stripLabel} />
        <MicroLabel>Last {STRIP_DAYS} days</MicroLabel>
      </div>
    </HudPanel>
  </section>

  {#each practised as group (group.id)}
    <section class="group" aria-labelledby={`group-${group.id}`}>
      <HudPanel
        header={group.title}
        headerAs="h2"
        headerId={`group-${group.id}`}
      >
        {#snippet headerTrailing()}
          <span class="headline tabular">
            {group.mastery === null
              ? 'new'
              : `${Math.round(group.mastery * 100)}%`}
          </span>
        {/snippet}

        <ul class="cells">
          {#each group.cells as cell (cell.skillId)}
            <li class="cell">
              <span class="name">
                {cell.label}
                {#if cell.weak}
                  <!-- Never colour alone: the `!` is the signal, in --warn
                       (sci-fi-screens.md §2.3 — --danger means *wrong*). -->
                  <span class="weak" aria-label="needs work">!</span>
                {/if}
              </span>
              <MasteryPips mastery={cell.mastery} skill={cell.label} />
              {#if cell.attempts > 0}
                <span class="detail">{cell.detail}</span>
              {/if}
            </li>
          {/each}
        </ul>

        <p class="group-action">
          <Button
            href={`${base}/practice/${group.id}/`}
            glyph={playGlyph}
            ariaLabel={`Practice now: ${group.title}`}
          >
            Practice now
          </Button>
        </p>
      </HudPanel>
    </section>
  {/each}
{:else if practice.hydrated}
  <section class="empty">
    <HudPanel well padding="lg">
      <p class="empty-copy">{PRACTICE_COPY.empty}</p>
      <p class="empty-action">
        <Button
          variant="primary"
          href={`${base}/practice/${DEFAULT_EXERCISE_ID}/`}
          glyph={playGlyph}
        >
          Practice now
        </Button>
      </p>
    </HudPanel>
  </section>
{/if}

<style>
  .today,
  .group {
    margin-top: var(--space-6);
  }

  .today-body {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
  }

  .counters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-7);
  }

  .counter {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  /* A HUD readout: display face, tabular, the one text glow (§7). */
  .value {
    font-family: var(--font-display);
    font-size: var(--fs-h1);
    font-weight: var(--fw-bold);
    line-height: var(--lh-tight);
    color: var(--text-1);
    text-shadow: var(--glow-text);
  }

  .strip {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-5);
  }

  /* The band's one trailing control (§7): the exercise's headline number. */
  .headline {
    font-family: var(--font-display);
    font-size: var(--fs-small);
    font-weight: var(--fw-semibold);
    color: var(--text-2);
  }

  .cells {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .cell {
    /* 140 px fixed-width cells, so the eye scans columns (§7). */
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 140px;
  }

  .name {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    font-size: var(--fs-small);
    color: var(--text-2);
  }

  .weak {
    color: var(--warn);
    font-family: var(--font-display);
    font-weight: var(--fw-bold);
  }

  .detail {
    font-size: var(--fs-micro);
    line-height: var(--lh-snug);
    color: var(--text-3);
  }

  .group-action {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--space-5);
  }

  .empty {
    margin-top: var(--space-6);
    max-width: 60ch;
  }

  .empty-copy {
    color: var(--text-2);
  }

  .empty-action {
    margin-top: var(--space-4);
  }
</style>
