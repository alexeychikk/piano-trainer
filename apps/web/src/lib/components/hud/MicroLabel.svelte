<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The micro-label (sci-fi visual language §4.3): 12 px display, 600,
   * UPPERCASE, wide tracking. Panel headers, section labels, readout captions.
   *
   * `hot` (cyan + glow) is only for something that is live *right now*
   * (`LIVE INPUT`, `CURRENT NOTE`) — never for a static section header.
   *
   * Uppercasing is `text-transform`, so the DOM text — and therefore the
   * accessible name — keeps its real casing (§9.3).
   */
  interface Props {
    hot?: boolean;
    /** Renders a `<span>` by default; `as` allows h2/h3/legend/div. */
    as?: 'span' | 'div' | 'h2' | 'h3';
    /** So a heading rendered here can name its region (`aria-labelledby`). */
    id?: string;
    children: Snippet;
  }

  const { hot = false, as = 'span', id, children }: Props = $props();
</script>

<svelte:element this={as} {id} class="micro" class:hot>
  {@render children()}
</svelte:element>

<style>
  .micro {
    display: block;
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--fs-micro);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-snug);
    letter-spacing: var(--track-label);
    text-transform: uppercase;
    color: var(--text-2);
  }

  .hot {
    color: var(--cyan);
    text-shadow: var(--glow-text);
  }
</style>
