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
    <!-- The ramp layer is the full track and never moves (§2.4); only the
         reveal edge animates, so two bars at 62 % match mid-transition. -->
    <div class="fill" style:clip-path="inset(0 {100 - percent}% 0 0)"></div>
    <span class="cap" style:left="calc({percent}% - 1px)"></span>
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

  /*
   * The ramp is painted once across the whole track and revealed by a clip —
   * never by a `width` that would re-scale the gradient under it
   * (sci-fi-screens.md §2.4). The colour at any x is therefore fixed by
   * position, which is the entire point of "one ramp" (part 1 §2.3), and it
   * holds *during* the transition, not only after it.
   */
  .fill {
    position: absolute;
    inset: 0;
    background: var(--grad-data);
    transition: clip-path var(--dur-base) var(--ease);
  }

  /* The bright leading edge is the detail that makes it read as a HUD meter
     (§5.4). Decorative: 1 px, cyan, never the only cue for the value — it
     rides the reveal edge, so it moves with the same timing. */
  .cap {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--cyan);
    opacity: 0.8;
    transition: left var(--dur-base) var(--ease);
  }
</style>
