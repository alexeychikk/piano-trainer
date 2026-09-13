<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { NAV_ITEMS, isActive } from './nav';
  import StatusChip from './StatusChip.svelte';
  import { midiInput } from '$lib/midi/input.svelte';
  import { audio } from '$lib/audio/engine.svelte';
</script>

<header class="topbar">
  <a class="wordmark" href={`${base}/`}>
    <span aria-hidden="true">♪</span> piano-trainer
  </a>

  <nav aria-label="Main">
    <ul>
      {#each NAV_ITEMS as item (item.href)}
        {@const current = isActive(page.url.pathname, item.href, base)}
        <li>
          <a
            href={`${base}${item.href}`}
            class:current
            aria-current={current ? 'page' : undefined}>{item.label}</a
          >
        </li>
      {/each}
    </ul>
  </nav>

  <div class="status">
    <StatusChip
      href="/settings#midi"
      glyph={midiInput.chip.glyph}
      label={midiInput.chip.label}
      srLabel={midiInput.chip.srLabel}
      tone={midiInput.chip.tone}
    />
    <StatusChip
      href="/settings#sound"
      glyph={audio.chip.glyph}
      label={audio.chip.label}
      srLabel={audio.chip.srLabel}
      tone={audio.chip.tone}
      pulse={audio.chip.pulse}
    />
  </div>
</header>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: var(--space-5);
    height: var(--topbar-h);
    padding: 0 var(--space-6);
    background: var(--bg-1);
    border-bottom: 1px solid var(--border);
  }

  .wordmark {
    font-size: var(--fs-body-lg);
    font-weight: var(--fw-semibold);
    color: var(--text-1);
  }

  .wordmark:hover {
    text-decoration: none;
    color: var(--accent);
  }

  nav ul {
    display: flex;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  nav a {
    display: block;
    padding: var(--space-3) var(--space-4);
    color: var(--text-2);
    border-bottom: 2px solid transparent;
  }

  nav a:hover {
    color: var(--text-1);
    text-decoration: none;
  }

  nav a.current {
    color: var(--text-1);
    border-bottom-color: var(--accent);
  }

  .status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-left: auto;
  }
</style>
