<script lang="ts">
  /**
   * The circular percentage ring (sci-fi visual language §5.6) — for a single
   * headline number (accuracy today, session score). Two SVG circles: a
   * `--bg-well` track and a `--grad-data` value arc, rotated −90°.
   *
   * It never animates on load (§7); the one allowed sweep is the session
   * summary's, which passes `sweep`.
   */
  interface Props {
    /** 0..1. */
    value: number;
    /** Micro-label under the number, e.g. `accuracy`. */
    caption: string;
    /** Spelled-out accessible name, e.g. `84 percent accuracy today`. */
    srLabel: string;
    /** Diameter in px. */
    size?: number;
    /** One-off sweep — the session summary only. */
    sweep?: boolean;
  }

  const {
    value,
    caption,
    srLabel,
    size = 120,
    sweep = false,
  }: Props = $props();

  const clamped = $derived(Math.min(1, Math.max(0, value)));
  const percent = $derived(Math.round(clamped * 100));
  // The stroke is centred on the path, so the radius leaves half of it inside.
  const radius = $derived(size / 2 - 6);
  const circumference = $derived(2 * Math.PI * radius);
  const offset = $derived(circumference * (1 - clamped));

  /**
   * One id for every ring: the gradient is the *same* ramp everywhere (§2.3),
   * so two rings on a screen redefining it is harmless — a per-instance random
   * id would only differ between the prerendered HTML and hydration.
   */
  const GRADIENT_ID = 'hud-ring-ramp';
</script>

<div class="ring" style:width="{size}px" role="img" aria-label={srLabel}>
  <svg
    viewBox="0 0 {size} {size}"
    width={size}
    height={size}
    aria-hidden="true"
    style:--ring-circumference={circumference}
  >
    <defs>
      <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="var(--cyan)" />
        <stop offset="46%" stop-color="var(--accent)" />
        <stop offset="100%" stop-color="var(--hint)" />
      </linearGradient>
    </defs>
    <circle class="track" cx={size / 2} cy={size / 2} r={radius} />
    <circle
      class="value"
      class:sweep
      cx={size / 2}
      cy={size / 2}
      r={radius}
      stroke="url(#{GRADIENT_ID})"
      stroke-dasharray={circumference}
      stroke-dashoffset={offset}
      transform="rotate(-90 {size / 2} {size / 2})"
    />
  </svg>
  <span class="centre" aria-hidden="true">
    <span class="number tabular">{percent}%</span>
    <span class="caption">{caption}</span>
  </span>
</div>

<style>
  .ring {
    position: relative;
    display: inline-grid;
    place-items: center;
  }

  svg {
    display: block;
  }

  circle {
    fill: none;
    stroke-width: var(--ring-stroke);
  }

  .track {
    stroke: var(--bg-well);
  }

  .value {
    stroke-linecap: round;
    filter: drop-shadow(
      0 0 6px color-mix(in srgb, var(--accent) 45%, transparent)
    );
  }

  .sweep {
    animation: ring-sweep var(--dur-slow) var(--ease) 1;
  }

  @keyframes ring-sweep {
    from {
      stroke-dashoffset: var(--ring-circumference);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sweep {
      animation: none;
    }
  }

  .centre {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
  }

  .number {
    font-family: var(--font-display);
    font-size: var(--fs-h1);
    font-weight: var(--fw-bold);
    color: var(--text-1);
    text-shadow: var(--glow-text);
  }

  .caption {
    font-family: var(--font-display);
    font-size: var(--fs-micro);
    font-weight: var(--fw-semibold);
    letter-spacing: var(--track-label);
    text-transform: uppercase;
    color: var(--text-2);
  }
</style>
