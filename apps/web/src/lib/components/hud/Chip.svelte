<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Chip and keycap (sci-fi visual language §5.3). A chip is a raised label on
   * a panel — a chord symbol, a filter. A keycap (`variant="key"`) is the
   * sunken shortcut hint the copy deck spells out, e.g. `Space`.
   */
  interface Props {
    variant?: 'chip' | 'key';
    children: Snippet;
  }

  const { variant = 'chip', children }: Props = $props();
</script>

{#if variant === 'key'}
  <span class="keycap">{@render children()}</span>
{:else}
  <span class="chip hud-cut hud-cut-sm">
    <span class="face hud-cut hud-cut-sm">{@render children()}</span>
  </span>
{/if}

<style>
  .chip {
    display: inline-block;
    background: var(--border);
  }

  .chip .face {
    display: inline-block;
    margin: 1px;
    padding: var(--space-1) var(--space-3);
    background: var(--bg-2);
    color: var(--text-1);
    font-family: var(--font-display);
    font-size: var(--fs-small);
    letter-spacing: var(--track-hud);
  }

  /* A keycap, not a chip: sunken, hairline, small radius (§5.3). */
  .keycap {
    display: inline-block;
    padding: 0 var(--space-2);
    background: var(--bg-well);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-3);
    font-family: var(--font-display);
    font-size: var(--fs-micro);
    letter-spacing: var(--track-hud);
  }
</style>
