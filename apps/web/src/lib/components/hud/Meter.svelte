<script lang="ts">
  /**
   * The bar meter (sci-fi visual language §5.7): the home sparkline, the input
   * level meter, the equalizer — one family, three sizes. Bars take their
   * colour from `--grad-data` **by position in the row**, never by height and
   * never by category (§2.3), so two meters are comparable at a glance.
   *
   * Only real data is ever drawn (§ deviation 8): this app has no decorative
   * waveform.
   */
  interface Props {
    /** One value per bar, each 0..1. */
    values: readonly number[];
    /** Spelled-out accessible name, e.g. `Attempts over the last 7 days`. */
    srLabel: string;
    /** Height of the bed in px. */
    height?: number;
    /** Index that gets the bright cap — "today" on the home sparkline. */
    markIndex?: number;
  }

  const { values, srLabel, height = 48, markIndex }: Props = $props();

  /**
   * The ramp, sampled at `t` (0..1 across the row): cyan → blue at 46 %, then
   * blue → violet. Same stops as `--grad-data`, evaluated per bar because a
   * gradient painted per element would restart in every bar.
   */
  function rampColour(t: number): string {
    if (t <= 0.46) {
      const mix = Math.round((t / 0.46) * 100);
      return `color-mix(in srgb, var(--accent) ${mix}%, var(--cyan))`;
    }
    const mix = Math.round(((t - 0.46) / 0.54) * 100);
    return `color-mix(in srgb, var(--hint) ${mix}%, var(--accent))`;
  }

  const bars = $derived(
    values.map((value, index) => ({
      height: Math.min(1, Math.max(0, value || 0)),
      colour: rampColour(values.length > 1 ? index / (values.length - 1) : 0),
    })),
  );
</script>

<div class="meter" style:height="{height}px" role="img" aria-label={srLabel}>
  {#each bars as bar, index (index)}
    <span class="slot">
      <span
        class="bar"
        class:mark={index === markIndex}
        style:height="max({Math.round(bar.height * 100)}%, 2px)"
        style:background={bar.colour}
      ></span>
    </span>
  {/each}
</div>

<style>
  .meter {
    display: flex;
    align-items: flex-end;
    gap: var(--meter-bar-gap);
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-well);
  }

  .slot {
    display: flex;
    align-items: flex-end;
    width: var(--meter-bar-w);
    height: 100%;
  }

  .bar {
    width: 100%;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  }

  /* The marked bar gets a 1 px light cap — a position marker, not a colour. */
  .mark {
    box-shadow: inset 0 1px 0 var(--text-1);
  }
</style>
