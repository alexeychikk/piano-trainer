<script lang="ts">
  // Home / "Practice now" (UX spec §3, re-skinned by the sci-fi visual
  // language §8). The regions and the copy are the spec's; only the treatment
  // is new. With the first exercise registered (slice 4) the hero starts a
  // drill, since slice 5a the cards' mastery pips are real, and since slice 9a
  // the **scheduler** picks where `Practice now` goes: the hero opens the
  // exercise holding the most urgent skill, with `?due=1` so the drill favours
  // it (`$lib/practice/planner.ts`).
  //
  // Still slice 9b's: the length control, the Today card, and `Space` starting
  // a mixed session at `/session` — all three are statements about a session,
  // which does not exist yet. So the Today card stays the "How this works"
  // well the spec prescribes for the empty state.
  import { base } from '$app/paths';
  import { DEFAULT_EXERCISE_ID, EXERCISES } from '$lib/exercises/registry';
  import { midiInput } from '$lib/midi/input.svelte';
  import { dueNow, skillsDueToday } from '$lib/practice/copy';
  import { buildPlan } from '$lib/practice/planner';
  import { practice } from '$lib/practice/store.svelte';
  import Badge from '$lib/components/hud/Badge.svelte';
  import Button from '$lib/components/hud/Button.svelte';
  import HudPanel from '$lib/components/hud/HudPanel.svelte';
  import MasteryPips from '$lib/components/hud/MasteryPips.svelte';
  import IconKeyboard from '$lib/components/icons/IconKeyboard.svelte';
  import IconPlay from '$lib/components/icons/IconPlay.svelte';

  /** One clock for the screen, read when it opens — as `/progress` does. */
  const now = Date.now();

  const plan = $derived(
    buildPlan(
      EXERCISES.map((exercise) => ({
        id: exercise.id,
        skillIds: exercise.skillsCovered(exercise.defaultSettings),
      })),
      practice.byId,
      now,
    ),
  );

  /**
   * Where the hero goes. The planner's first pick, or the default exercise
   * when there is nothing to schedule at all (an empty registry, or every
   * skill solid and still in the future) — the hero is never a dead end.
   * `?due=1` only makes sense when something is actually due.
   */
  const heroHref = $derived(
    plan.dueCount > 0
      ? `${base}/practice/${plan.pick?.exerciseId}/?due=1`
      : `${base}/practice/${plan.pick?.exerciseId ?? DEFAULT_EXERCISE_ID}/`,
  );
  /**
   * The copy deck's two hero labels (UX §3): `Start your first session` until
   * there is a history, `Practice now` after — with the spec's own sub-label
   * once the schedule has something to say.
   */
  const started = $derived(practice.attempts.length > 0);
  const heroLabel = $derived(
    started ? 'Practice now' : 'Start your first session',
  );
  const heroSub = $derived(
    plan.dueCount > 0 ? skillsDueToday(plan.dueCount) : 'Ten minutes is enough',
  );
</script>

<svelte:head>
  <title>Practice · piano-trainer</title>
</svelte:head>

{#snippet playGlyph()}
  <IconPlay size="1.1em" />
{/snippet}

<h1>Ready to practise</h1>

<div class="hero-row">
  <div class="hero-col">
    <Button
      variant="primary"
      size="hero"
      block
      href={heroHref}
      sub={heroSub}
      glyph={playGlyph}
      testId="hero"
    >
      {heroLabel}
    </Button>
  </div>

  <aside class="side">
    <HudPanel header="How this works" chamfer="md" well padding="md">
      <p class="how">
        Sit at your piano. Connect it, or use the on-screen keyboard. You answer
        by playing — space replays the sound.
      </p>
    </HudPanel>
  </aside>
</div>

<section class="drill">
  <h2>Or drill one thing</h2>
  <ul class="cards">
    {#each EXERCISES as exercise (exercise.id)}
      <li>
        <HudPanel
          href={`${base}/practice/${exercise.id}/`}
          chamfer="md"
          padding="md"
        >
          <span class="card">
            <span class="title">{exercise.title}</span>
            <span class="desc">{exercise.description}</span>
            <span class="foot">
              <!-- Real mastery from the practice log (slice 5a); an exercise
                   nothing has been practised in is honestly `new`. -->
              <MasteryPips
                mastery={practice.masteryFor(
                  exercise.skillsCovered(exercise.defaultSettings),
                )}
                skill={exercise.title}
              />
              <!-- UX §3: pips plus `NN%`, `N due` or `new`. The pips carry the
                   first and the last; this is the middle one, and it says the
                   word `due` rather than relying on the amber (§2.3). -->
              {#if (plan.byExercise.get(exercise.id)?.dueCount ?? 0) > 0}
                <Badge tone="warn">
                  {dueNow(plan.byExercise.get(exercise.id)?.dueCount ?? 0)}
                </Badge>
              {/if}
              {#if exercise.requiresMidi && !midiInput.connected}
                <span class="needs">
                  <IconKeyboard /> Needs a MIDI keyboard
                </span>
              {/if}
            </span>
          </span>
        </HudPanel>
      </li>
    {/each}
  </ul>
</section>

<style>
  .hero-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-6);
    margin-top: var(--space-6);
  }

  .hero-col {
    flex: 1 1 420px;
    max-width: 640px; /* UX spec §3: the hero never grows past 640 px. */
  }

  .side {
    flex: 0 1 320px;
  }

  .how {
    font-size: var(--fs-body);
    color: var(--text-2);
  }

  .drill {
    margin-top: var(--space-7);
  }

  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin: var(--space-4) 0 0;
    padding: 0;
    list-style: none;
  }

  .cards li {
    /* UX spec §3: exercise cards are 320 × 140. */
    width: 320px;
    min-height: 140px;
  }

  .cards li :global(.panel) {
    height: 100%;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    height: 100%;
  }

  /* Card titles stay sentence case — uppercase stops at 20 px (§4.2). */
  .title {
    font-family: var(--font-display);
    font-size: var(--fs-h2);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-snug);
    color: var(--text-1);
  }

  .desc {
    font-size: var(--fs-small);
    color: var(--text-2);
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    margin-top: auto;
  }

  .needs {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-small);
    color: var(--text-3);
  }
</style>
