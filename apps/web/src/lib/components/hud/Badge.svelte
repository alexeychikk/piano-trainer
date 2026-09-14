<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Tone } from './tones';

  /**
   * A state badge (sci-fi visual language §5.3): 12 px micro-label in the
   * state colour on a 12 %-alpha fill of the same colour.
   *
   * A badge never uses colour alone — its *text* is the state (`due`, `new`),
   * which is why there is no glyph prop and no colour-only variant (§2.2).
   */
  interface Props {
    tone?: Tone;
    children: Snippet;
  }

  const { tone = 'neutral', children }: Props = $props();
</script>

<span class="badge {tone} hud-cut hud-cut-sm">
  <span class="face hud-cut hud-cut-sm">{@render children()}</span>
</span>

<style>
  .badge {
    display: inline-block;
    background: color-mix(in srgb, var(--tone-color) 40%, transparent);

    --tone-color: var(--text-3);
  }

  .face {
    display: inline-block;
    margin: 1px;
    padding: 0 var(--space-2);
    background: color-mix(in srgb, var(--tone-color) 12%, var(--bg-1));
    color: var(--tone-color);
    font-family: var(--font-display);
    font-size: var(--fs-micro);
    font-weight: var(--fw-semibold);
    letter-spacing: var(--track-label);
    text-transform: uppercase;
    line-height: var(--lh-base);
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
</style>
