<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { NAV_ITEMS, isActive, isRunnerRoute } from './nav';
  import StatusChip from './StatusChip.svelte';
  import IconWave from '$lib/components/icons/IconWave.svelte';
  import { midiInput } from '$lib/midi/input.svelte';
  import { audio } from '$lib/audio/engine.svelte';
  import { settings } from '$lib/storage/settings.svelte';

  /** Focus mode hides the shell — inside the runner only (UX §4.7). */
  const hidden = $derived(
    settings.value.focusMode && isRunnerRoute(page.url.pathname, base),
  );
</script>

{#if !hidden}
  <header class="topbar">
    <a class="wordmark" href={`${base}/`}>
      <span class="mark"><IconWave /></span>
      <span class="word">piano-trainer</span>
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
{/if}

<style>
  /*
   * The shell is unchanged (sci-fi visual language §6): same top bar, same six
   * routes, same copy — only the skin. It is a panel, but full-bleed, so it is
   * not chamfered; its glow points downward only.
   */
  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: var(--space-5);
    height: var(--topbar-h);
    padding: 0 var(--space-6);
    background: var(--grad-panel);
    background-color: var(--bg-1);
    border-bottom: 1px solid var(--panel-border);
    box-shadow: var(--glow-panel);
  }

  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-1);
  }

  .wordmark:hover {
    text-decoration: none;
  }

  .mark {
    display: inline-flex;
    color: var(--cyan);
    filter: drop-shadow(
      0 0 6px color-mix(in srgb, var(--cyan) 45%, transparent)
    );
  }

  .word {
    font-family: var(--font-display);
    font-size: var(--fs-body-lg);
    font-weight: var(--fw-bold);
    letter-spacing: var(--track-label);
    text-transform: uppercase;
  }

  nav ul {
    display: flex;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  nav a {
    position: relative;
    display: block;
    padding: var(--space-3) var(--space-4);
    color: var(--text-2);
    font-family: var(--font-display);
    letter-spacing: var(--track-hud);
    text-transform: uppercase;
    border-bottom: 2px solid transparent;
    transition: color var(--dur-fast) var(--ease);
  }

  nav a:hover {
    color: var(--text-1);
    text-decoration: none;
  }

  /* Active route: text lifts and a 2 px accent underline glows — statically,
     and on the underline itself rather than as a halo round the item (§6). */
  nav a.current {
    color: var(--text-1);
  }

  nav a.current::after {
    content: '';
    position: absolute;
    right: var(--space-4);
    bottom: 0;
    left: var(--space-4);
    height: 2px;
    background: var(--accent);
    box-shadow: var(--glow-accent);
  }

  .status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-left: auto;
  }
</style>
