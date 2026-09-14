<script lang="ts">
  // Home / "Practice now" (UX spec §3). With the first exercise registered
  // (slice 4) the hero starts a drill; the length control, the Today card and
  // the due counts arrive with persistence (slice 5) and sessions (slice 9),
  // so the hero uses the copy deck's empty-state wording until then.
  import { base } from '$app/paths';
  import { DEFAULT_EXERCISE_ID, EXERCISES } from '$lib/exercises/registry';
</script>

<svelte:head>
  <title>Practice · piano-trainer</title>
</svelte:head>

<h1>Ready to practise</h1>

<div class="hero-row">
  <div class="hero-col">
    <a class="hero" href={`${base}/practice/${DEFAULT_EXERCISE_ID}/`}>
      <span class="label">
        <span aria-hidden="true">▶</span> Start your first session
      </span>
      <span class="sub">Ten minutes is enough</span>
    </a>
    <p class="how">
      Sit at your piano. Connect it, or use the on-screen keyboard. You answer
      by playing — space replays the sound.
    </p>
  </div>

  <aside class="card">
    <h2>Exercises</h2>
    <ul class="exercises">
      {#each EXERCISES as exercise (exercise.id)}
        <li>
          <a href={`${base}/practice/${exercise.id}/`}>{exercise.title}</a>
          <span class="desc">{exercise.description}</span>
        </li>
      {/each}
    </ul>
    <p class="empty">
      Practice numbers appear once attempts are stored (slice 5).
    </p>
  </aside>
</div>

<style>
  .hero-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-6);
    margin-top: var(--space-6);
  }

  .hero-col {
    flex: 1 1 420px;
    max-width: 640px;
  }

  .hero {
    display: flex;
    text-decoration: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    width: 100%;
    height: 96px;
    border: none;
    border-radius: var(--radius-lg);
    background: var(--accent);
    color: var(--on-accent);
    cursor: pointer;
  }

  .hero:hover {
    text-decoration: none;
    filter: brightness(1.08);
  }

  .exercises {
    margin: var(--space-3) 0 0;
    padding: 0;
    list-style: none;
  }

  .exercises li + li {
    margin-top: var(--space-3);
  }

  .desc {
    display: block;
    font-size: var(--fs-small);
    color: var(--text-3);
  }

  .label {
    font-size: var(--fs-h1);
    font-weight: var(--fw-bold);
  }

  .sub {
    font-size: var(--fs-small);
  }

  .how {
    margin-top: var(--space-5);
    font-size: var(--fs-body-lg);
    color: var(--text-2);
  }

  .card {
    flex: 0 1 320px;
    padding: var(--space-5);
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .empty {
    margin-top: var(--space-3);
    font-size: var(--fs-small);
    color: var(--text-3);
  }
</style>
