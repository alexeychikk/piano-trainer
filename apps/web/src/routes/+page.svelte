<script lang="ts">
  // Home / "Practice now" (UX spec §3). The hero stays disabled until the
  // first exercise is registered (slice 4) — the length control and the Today
  // card arrive with persistence (slice 5) and sessions (slice 9).
</script>

<svelte:head>
  <title>Practice · piano-trainer</title>
</svelte:head>

<h1>Ready to practise</h1>

<div class="hero-row">
  <div class="hero-col">
    <button class="hero" type="button" disabled>
      <span class="label"><span aria-hidden="true">▶</span> Practice</span>
      <span class="sub">No exercises yet</span>
    </button>
    <p class="how">
      Sit at your piano. Connect it, or use the on-screen keyboard. You answer
      by playing — space replays the sound.
    </p>
  </div>

  <aside class="card">
    <h2>Today</h2>
    <p class="empty">
      Practice numbers appear once the first exercise lands (slice 4) and
      attempts are stored (slice 5).
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

  .hero:disabled {
    background: var(--bg-2);
    color: var(--text-3);
    border: 1px solid var(--border);
    cursor: not-allowed;
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
