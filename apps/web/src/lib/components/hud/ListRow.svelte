<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Tone } from './tones';
  import GlyphBadge from './GlyphBadge.svelte';

  /**
   * The list row (sci-fi visual language §5.9): a 32 px glyph badge, a lead
   * word plus detail, and a right-aligned tabular timestamp. Progress history
   * and the Settings device list reuse it.
   *
   * Rows are separated by a hairline, never striped; a row inside a scrolling
   * panel does not chamfer (§3.1), which is why the row itself never does.
   *
   * **The separator needs the rows to be DOM siblings.** It is drawn with
   * `:not(:first-child)`, so wrapping each row in its own `<li>` (or any other
   * element) makes every row a first child and the hairlines silently vanish.
   * Render the rows directly inside their container, or draw the separator on
   * the wrapper yourself.
   */
  interface Props {
    tone?: Tone;
    /** The glyph inside the badge — a state glyph or an icon component. */
    glyph?: Snippet;
    /** The 600-weight lead word, e.g. `Correct`. */
    lead: string;
    /** The rest of the line, e.g. `Minor 6th`. */
    detail?: string;
    /**
     * One readout between the text and the meta — the session summary's
     * mastery pips (sci-fi-screens.md §9 draws them in the row). An extension
     * rather than a fork, the same move `Button`'s `testId` was.
     */
    trailing?: Snippet;
    /** Right-aligned, relative, tabular — e.g. `2 min ago`. */
    meta?: string;
  }

  const {
    tone = 'neutral',
    glyph,
    lead,
    detail,
    trailing,
    meta,
  }: Props = $props();
</script>

<div class="row {tone}">
  {#if glyph}
    <GlyphBadge {tone}>{@render glyph()}</GlyphBadge>
  {/if}
  <span class="text">
    <span class="lead">{lead}</span>
    {#if detail}<span class="detail">· {detail}</span>{/if}
  </span>
  {#if trailing}<span class="trailing">{@render trailing()}</span>{/if}
  {#if meta}<span class="meta tabular">{meta}</span>{/if}
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--hit-min);
    padding: var(--space-2) var(--space-3);
    border-left: 2px solid transparent;

    --tone-color: var(--text-3);
  }

  /* Rows are separated by a hairline, never striped (§5.9). `:not(:first-child)`
     rather than `.row + .row`: each row is its own component instance. */
  .row:not(:first-child) {
    border-top: 1px solid var(--border);
  }

  .row:hover {
    background: var(--bg-2);
    border-left-color: var(--tone-color);
  }

  .accent {
    --tone-color: var(--accent);
  }

  .success {
    --tone-color: var(--success);
  }

  .warn {
    --tone-color: var(--warn);
  }

  .hint {
    --tone-color: var(--hint);
  }

  .danger {
    --tone-color: var(--danger);
  }

  .text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lead {
    font-weight: var(--fw-semibold);
    color: var(--text-1);
  }

  .detail {
    color: var(--text-2);
  }

  .trailing {
    flex: none;
    display: inline-flex;
    align-items: center;
  }

  .meta {
    flex: none;
    font-family: var(--font-display);
    font-size: var(--fs-small);
    color: var(--text-3);
  }
</style>
