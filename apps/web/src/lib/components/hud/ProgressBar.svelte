<script lang="ts">
  /**
   * The HUD progress bar (sci-fi visual language §5.4): a `--bg-well` track
   * with a `--grad-data` fill and a 1 px bright cap at the leading edge.
   *
   * One ramp for every quantitative visual (§2.3): the colour encodes *how far
   * along* the value is, never what it measures, so a column of bars is
   * comparable at a glance.
   */
  interface Props {
    /** 0..1. */
    value: number;
    /** Micro-label on the left; also the accessible name. */
    label: string;
    /** Right-hand readout; defaults to the percentage. */
    readout?: string;
  }

  const { value, label, readout }: Props = $props();

  const clamped = $derived(Math.min(1, Math.max(0, value)));
  const percent = $derived(Math.round(clamped * 100));
</script>

<div class="bar">
  <div class="head">
    <span class="label">{label}</span>
    <span class="readout tabular">{readout ?? `${percent}%`}</span>
  </div>
  <div
    class="track"
    role="progressbar"
    aria-label={label}
    aria-valuenow={percent}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    <div class="fill" style:width="{percent}%">
      <span class="cap"></span>
    </div>
  </div>
</div>

<style>
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-1);
  }

  .label {
    font-family: var(--font-display);
    font-size: var(--fs-micro);
    font-weight: var(--fw-semibold);
    letter-spacing: var(--track-label);
    text-transform: uppercase;
    color: var(--text-2);
  }

  .readout {
    font-family: var(--font-display);
    font-size: var(--fs-small);
    color: var(--cyan);
  }

  .track {
    position: relative;
    height: var(--bar-h);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: var(--bg-well);
    overflow: hidden;
  }

  .fill {
    position: relative;
    height: 100%;
    border-radius: var(--radius-pill);
    /* The ramp is painted across the *track*, so a value's colour depends on
       where it ends, not on how wide the fill happens to be (§2.3). */
    background: var(--grad-data);
    background-size: 100vw 100%;
    transition: width var(--dur-base) var(--ease);
  }

  /* The bright leading edge is the detail that makes it read as a HUD meter
     (§5.4). Decorative: 1 px, cyan, never the only cue for the value. */
  .cap {
    position: absolute;
    inset: 0 0 0 auto;
    width: 1px;
    background: var(--cyan);
    opacity: 0.8;
  }
</style>
