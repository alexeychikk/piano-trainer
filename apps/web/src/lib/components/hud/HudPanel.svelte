<script lang="ts">
  import type { Snippet } from 'svelte';
  import MicroLabel from './MicroLabel.svelte';

  /**
   * The one surface primitive (sci-fi visual language §3.1): a rectangle with
   * two opposite 45° cuts, a 1 px luminous edge, a static outer glow and an
   * optional 32 px micro-label header band.
   *
   * With `href` it becomes a card link (home's exercise cards, §8) and takes
   * the meaningful edge on hover/focus. Everything else — padding, chamfer
   * size, well vs panel — is a prop, so no screen re-implements the recipe.
   */
  interface Props {
    /** Micro-label header band. Omit for a card with its own title. */
    header?: string;
    /**
     * The band *is* the section heading on a panel that replaces one (Settings'
     * four sections, the metronome): a re-skin may restyle a heading, it may
     * not delete the document outline. Uppercasing stays `text-transform`, so
     * the accessible name keeps its real casing.
     */
    headerAs?: 'span' | 'h2' | 'h3';
    /** Id on the header, so a region can be `aria-labelledby` it. */
    headerId?: string;
    /** At most one trailing control on the band (§5.8). */
    headerTrailing?: Snippet;
    /** `lg` for panels, `md` for cards and small panels. */
    chamfer?: 'lg' | 'md';
    /** A panel that carries a live state wears the meaningful edge. */
    hot?: boolean;
    /** A well (elevation −1): sunken, hairline edge, no glow. */
    well?: boolean;
    href?: string;
    padding?: 'none' | 'md' | 'lg';
    children: Snippet;
  }

  const {
    header,
    headerAs = 'span',
    headerId,
    headerTrailing,
    chamfer = 'lg',
    hot = false,
    well = false,
    href,
    padding = 'lg',
    children,
  }: Props = $props();

  const cut = $derived(chamfer === 'lg' ? 'hud-cut hud-cut-lg' : 'hud-cut');
  const glow = $derived(well ? '' : hot ? 'hud-glow hud-glow-hot' : 'hud-glow');
</script>

<svelte:element
  this={href ? 'a' : 'div'}
  {href}
  class="panel {glow}"
  class:link={href !== undefined}
  class:hot
  class:well
>
  <span class="edge {cut}">
    <span class="face {cut}">
      {#if header}
        <span class="band">
          <MicroLabel as={headerAs} id={headerId}>{header}</MicroLabel>
          {@render headerTrailing?.()}
        </span>
      {/if}
      <span
        class="body"
        class:pad-md={padding === 'md'}
        class:pad-lg={padding === 'lg'}
      >
        {@render children()}
      </span>
    </span>
  </span>
</svelte:element>

<style>
  .panel {
    display: block;
    color: inherit;
    text-decoration: none;
    transition: filter var(--dur-base) var(--ease);
  }

  /* The edge is a flex container so the face can be inset by a margin and
     still fill it exactly, whatever the panel's height turns out to be. */
  .edge {
    display: flex;
    height: 100%;
    background: var(--panel-border);
    transition: background-color var(--dur-fast) var(--ease);
  }

  .hot .edge {
    background: var(--panel-border-hot);
  }

  .well .edge {
    background: var(--border);
  }

  .face {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    /* The 1 px inset *is* the edge: clip-path would eat a real border. */
    margin: 1px;
    background: var(--grad-panel);
    background-color: var(--bg-1);
    box-shadow: var(--inset-top);
  }

  .well .face {
    background: var(--bg-well);
    box-shadow: none;
  }

  .band {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    height: var(--space-6); /* the 32 px header band (§3.1) */
    padding: 0 var(--space-4);
    background: var(--grad-header);
    border-bottom: 1px solid var(--border);
  }

  .body {
    display: block;
    flex: 1;
    min-height: 0;
  }

  .pad-md {
    padding: var(--space-4);
  }

  .pad-lg {
    padding: var(--space-5);
  }

  /* A card link. The edge is 1 px, so it never carries the state alone: the
     card's own title and the cursor do (§9, note on --panel-border-hot). */
  .link:hover,
  .link:focus-visible {
    --hud-glow-color: var(--hud-glow-cyan);
  }

  .link:hover .edge,
  .link:focus-visible .edge {
    background: var(--panel-border-hot);
  }

  /*
   * Focus on a chamfered element: `outline` follows the unclipped rectangle,
   * so the edge layer becomes the ring and the face is inset 3 px instead
   * (spec §3.4).
   */
  .link:focus-visible {
    outline: none;
    box-shadow: none;
  }

  .link:focus-visible .edge {
    background: var(--focus);
  }

  .link:focus-visible .face {
    margin: 3px;
  }
</style>
