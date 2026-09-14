<script lang="ts">
  import { base } from '$app/paths';

  /** Status, not a menu: clicking goes to the matching Settings section. */
  interface Props {
    href: string;
    /** Glyph carries the state too — never colour alone (UX spec §8.1). */
    glyph: string;
    label: string;
    /** Spelled-out accessible name, e.g. 'MIDI: no device found'. */
    srLabel: string;
    tone?: 'muted' | 'success' | 'warn' | 'danger';
    /** UX spec §2.2: the "audio not started" chip pulses once per 4 s. */
    pulse?: boolean;
  }

  const {
    href,
    glyph,
    label,
    srLabel,
    tone = 'muted',
    pulse = false,
  }: Props = $props();
</script>

<a
  class="chip {tone} hud-glow"
  class:pulse
  href={`${base}${href}`}
  aria-label={srLabel}
>
  <span class="edge hud-cut">
    <span class="face hud-cut">
      <span class="glyph" aria-hidden="true">{glyph}</span>
      <span class="label">{label}</span>
    </span>
  </span>
</a>

<style>
  /*
   * The status pill (sci-fi visual language §5.2): chamfered, raised, with a
   * meaningful edge and a fixed-width glyph column so the pills do not jitter
   * when the state changes. Copy is UX spec §2.2 and §9, verbatim.
   */
  .chip {
    display: inline-block;
    height: calc(var(--topbar-h) - var(--space-5));
    color: var(--text-3);
    text-decoration: none;
  }

  .edge {
    display: flex;
    height: 100%;
    background: var(--panel-border-hot);
  }

  .face {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--space-2);
    margin: 1px;
    padding: 0 var(--space-3);
    background: var(--bg-2);
    font-size: var(--fs-small);
    white-space: nowrap;
  }

  .chip:hover .face,
  .chip:focus-visible .face {
    background: var(--bg-1);
  }

  /* The glyph column is fixed so a state change never reflows the row (§5.2). */
  .glyph {
    display: inline-block;
    width: 1.25em;
    text-align: center;
  }

  /*
   * The label keeps the copy deck's own casing: it is either a state phrase or
   * a device name ("Roland FP-30"), and a proper noun is not shouted. See the
   * ticket comment on this deviation from §5.2's uppercase state word.
   */
  .label {
    max-width: 22ch;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--font-display);
    letter-spacing: var(--track-hud);
  }

  .success {
    color: var(--success);
  }

  .warn {
    color: var(--warn);
  }

  .danger {
    color: var(--danger);
  }

  /* Chamfered focus: the edge layer is the ring (§3.4). */
  .chip:focus-visible {
    outline: none;
    box-shadow: none;
  }

  .chip:focus-visible .edge {
    background: var(--focus);
  }

  .chip:focus-visible .face {
    margin: 3px;
  }

  /*
   * "Audio not started" pulses once per 4 s (UX spec §2.2) — the one looping
   * animation in the shell, opacity only, on the glyph only (§7). The 4 s
   * period is a one-off the spec fixes for this chip, so it stays literal.
   */
  .pulse .glyph {
    animation: chip-pulse 4s var(--ease) infinite;
  }

  @keyframes chip-pulse {
    0%,
    80%,
    100% {
      opacity: 1;
    }
    90% {
      opacity: 0.35;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pulse .glyph {
      animation: none;
    }
  }
</style>
