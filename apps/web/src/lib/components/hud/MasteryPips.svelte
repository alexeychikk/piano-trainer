<script lang="ts">
  import {
    PIP_COUNT,
    filledPips,
    masteryLabel,
    masteryPercent,
    masteryTone,
  } from './mastery';

  /**
   * The one progress primitive (UX spec §6.2, re-skinned in §5.5): seven pips,
   * `round(mastery * 7)` filled, **always next to the percentage** — or the
   * word `new` for a skill that has never been practised.
   *
   * Pips are diamonds in this language (a 45°-rotated square), which echoes
   * the chamfer; the count and the meaning are unchanged. Only filled pips
   * glow, or the row smears at a metre.
   */
  interface Props {
    /** 0..1, or `null` for an unseen skill. */
    mastery: number | null;
    /** Names the skill in the accessible label. */
    skill?: string;
  }

  const { mastery, skill }: Props = $props();

  const filled = $derived(filledPips(mastery));
  const tone = $derived(masteryTone(mastery));
  const pips = $derived(
    Array.from({ length: PIP_COUNT }, (_, i) => i < filled),
  );
</script>

<span class="mastery" aria-label={masteryLabel(mastery, skill)} role="img">
  <span class="pips {tone}" aria-hidden="true">
    {#each pips as isFilled, index (index)}
      <span class="pip" class:filled={isFilled}></span>
    {/each}
  </span>
  <span class="value tabular" aria-hidden="true">
    {mastery === null ? 'new' : `${masteryPercent(mastery)}%`}
  </span>
</span>

<style>
  .mastery {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
  }

  .pips {
    display: inline-flex;
    gap: var(--pip-gap);

    --tone-color: var(--text-3);
  }

  .pips.accent {
    --tone-color: var(--accent);
  }

  .pips.success {
    --tone-color: var(--success);
  }

  .pips.warn {
    --tone-color: var(--warn);
  }

  .pip {
    width: var(--pip-size);
    height: var(--pip-size);
    /* A diamond: a 45°-rotated square with softened corners (§5.5). */
    transform: rotate(45deg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-well);
  }

  .pip.filled {
    border-color: var(--tone-color);
    background: var(--tone-color);
    box-shadow: 0 0 6px color-mix(in srgb, var(--tone-color) 45%, transparent);
  }

  .value {
    font-family: var(--font-display);
    font-size: var(--fs-small);
    color: var(--text-2);
  }
</style>
