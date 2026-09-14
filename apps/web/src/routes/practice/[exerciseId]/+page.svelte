<script lang="ts">
  /**
   * The exercise runner route. The id comes from the URL and is resolved in
   * the registry (ADR §5) — an unknown id is a normal, non-blocking screen,
   * not an error page and never a dialog.
   */
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import ExerciseRunner from '$lib/components/exercise/ExerciseRunner.svelte';
  import { EXERCISES, getExercise } from '$lib/exercises/registry';

  const exerciseId = $derived(page.params.exerciseId ?? '');
  const definition = $derived(getExercise(exerciseId));
  /**
   * `?due=1` — the schedule asked for this run (home's `Practice now`,
   * `/progress`'s `Drill these`, slice 9a). Anything else is a plain drill;
   * the flag only ever biases which skills come up.
   */
  const dueFirst = $derived(page.url.searchParams.get('due') === '1');
</script>

<svelte:head>
  <title>{definition ? definition.title : exerciseId} · piano-trainer</title>
</svelte:head>

{#if definition}
  <!-- A different exercise is a different drill: rebuild, never re-use. -->
  {#key definition.id}
    <ExerciseRunner {definition} {dueFirst} />
  {/key}
{:else}
  <section class="unknown">
    <h1>No such exercise</h1>
    <p class="note">
      There is no exercise called <code>{exerciseId}</code>. Pick one of these:
    </p>
    <ul>
      {#each EXERCISES as exercise (exercise.id)}
        <li>
          <a href={`${base}/practice/${exercise.id}/`}>{exercise.title}</a>
          <span class="desc">{exercise.description}</span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .unknown {
    max-width: 60ch;
  }

  .note {
    margin-top: var(--space-3);
    color: var(--text-2);
  }

  ul {
    margin: var(--space-4) 0 0;
    padding: 0;
    list-style: none;
  }

  li {
    margin-top: var(--space-3);
  }

  .desc {
    display: block;
    color: var(--text-3);
    font-size: var(--fs-small);
  }

  code {
    font-family: var(--font-mono);
    font-size: var(--fs-small);
  }
</style>
