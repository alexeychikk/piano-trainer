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
   * Since slice 9a the schedule is real, so the three things the spec draws
   * for it are here: the `DUE NOW` counter, the per-panel `DUE n` badge and
   * `Drill these` (which opens the drill with `?due=1`, biasing it towards
   * this panel's due and weak skills). The counts come from the pure
   * `$lib/practice/planner.ts` — one authority, so a card, a band and the
   * counter can never disagree.
   *
   * `Export JSON` (slice 5b) is the same one-click action as Settings → Data,
   * through the same `exportPracticeData()` — the screen only reports it.
   */
  import { base } from '$app/paths';
  import Badge from '$lib/components/hud/Badge.svelte';
  import Button from '$lib/components/hud/Button.svelte';
  import HudPanel from '$lib/components/hud/HudPanel.svelte';
  import MasteryPips from '$lib/components/hud/MasteryPips.svelte';
  import Meter from '$lib/components/hud/Meter.svelte';
  import MicroLabel from '$lib/components/hud/MicroLabel.svelte';
  import Ring from '$lib/components/hud/Ring.svelte';
  import IconPlay from '$lib/components/icons/IconPlay.svelte';
  import { banners } from '$lib/components/shell/banners.svelte';
  import { DEFAULT_EXERCISE_ID, EXERCISES } from '$lib/exercises/registry';
  import {
    dueBadge,
    dueNow,
    exportDone,
    PRACTICE_COPY,
  } from '$lib/practice/copy';
  import { exportPracticeData } from '$lib/practice/download';
  import { buildPlan } from '$lib/practice/planner';
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

  const inputs = $derived(
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
  );

  const groups = $derived(
    buildGroups(inputs, practice.byId, practice.attempts, now),
  );

  /** The schedule, once: the counter, every badge and `Drill these` read it. */
  const plan = $derived(buildPlan(inputs, practice.byId, now));
  const dueFor = $derived(
    (exerciseId: string) => plan.byExercise.get(exerciseId)?.dueCount ?? 0,
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

  /** One click, no dialog (§7); the result is a banner, like Settings → Data. */
  let exporting = $state(false);

  async function exportNow() {
    exporting = true;
    try {
      const counts = await exportPracticeData();
      banners.show(exportDone(counts.attempts, counts.skills), 'success');
    } finally {
      exporting = false;
    }
  }
</script>

<svelte:head>
  <title>Progress · piano-trainer</title>
</svelte:head>

{#snippet playGlyph()}
  <IconPlay size="1.1em" />
{/snippet}

<div class="title-row">
  <h1>Progress</h1>
  {#if hasData}
    <!-- §7: the title's one trailing control. Hidden while there is nothing to
         export — an empty backup answers no question the owner has. -->
    <Button
      variant="secondary"
      disabled={exporting}
      testId="export-json"
      onclick={() => void exportNow()}
    >
      Export JSON
    </Button>
  {/if}
</div>

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
          <p class="counter">
            <MicroLabel>Due now</MicroLabel>
            <!-- §7: `12 due` keeps the word and takes `--warn`; nothing due is
                 not a warning, so it stays in the ordinary readout ink. -->
            <span class="value tabular" class:warn={plan.dueCount > 0}>
              {dueNow(plan.dueCount)}
            </span>
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
        <!-- §7: the 28-day strip is the `Meter`, `markIndex` = today, and
             `dailyCounts()` puts today last. -->
        <Meter
          values={totals.strip}
          markIndex={totals.strip.length - 1}
          srLabel={stripLabel}
        />
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
          <span class="band">
            <span class="headline tabular">
              {group.mastery === null
                ? 'new'
                : `${Math.round(group.mastery * 100)}%`}
            </span>
            {#if dueFor(group.id) > 0}
              <!-- §7: the band's `DUE n` is a warn `Badge` — the word is the
                   signal, the amber only carries it. -->
              <Badge tone="warn">{dueBadge(dueFor(group.id))}</Badge>
            {/if}
          </span>
        {/snippet}

        <ul class="cells">
          {#each group.cells as cell (cell.skillId)}
            <li class="cell">
              <span class="name">
                {cell.label}
                {#if cell.due}
                  <!-- `due` is a word, not a colour (UX §8.2 / §2.3). -->
                  <span class="due">due</span>
                {/if}
                {#if cell.weak}
                  <!-- Never colour alone: the `!` is the signal, in --warn
                       (sci-fi-screens.md §2.3 — --danger means *wrong*).
                       `role="img"` because `aria-label` on a bare <span> is
                       prohibited ARIA and may be dropped — the same pairing
                       `MasteryPips`, `Meter` and `Ring` use. -->
                  <span class="weak" role="img" aria-label="needs work">!</span>
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
          {#if dueFor(group.id) > 0}
            <!-- §7 / UX §6.1: `Drill these` opens this exercise on its due and
                 weak skills (`?due=1`), rather than wherever the seed lands. -->
            <Button
              variant="secondary"
              href={`${base}/practice/${group.id}/?due=1`}
              ariaLabel={`Drill these: ${group.title}`}
            >
              Drill these
            </Button>
          {:else}
            <Button
              href={`${base}/practice/${group.id}/`}
              glyph={playGlyph}
              ariaLabel={`Practice now: ${group.title}`}
            >
              Practice now
            </Button>
          {/if}
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
  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

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

  /* `12 due` in `--warn` (§7); the word `due` is already in the text. */
  .warn {
    color: var(--warn);
  }

  .band {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
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

  .due {
    color: var(--warn);
    font-family: var(--font-display);
    font-size: var(--fs-micro);
    letter-spacing: var(--track-label);
    text-transform: uppercase;
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
