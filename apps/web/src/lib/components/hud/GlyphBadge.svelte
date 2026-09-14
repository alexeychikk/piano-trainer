<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Tone } from './tones';

  /**
   * The 32 px glyph badge (sci-fi visual language §5.3): the icon holder used
   * by list rows. The icon inside is `aria-hidden`; the row's text carries the
   * meaning, so this is decoration with a state colour, never a label.
   */
  interface Props {
    tone?: Tone;
    children: Snippet;
  }

  const { tone = 'neutral', children }: Props = $props();
</script>

<span class="badge {tone} hud-cut hud-cut-sm" aria-hidden="true">
  <span class="face hud-cut hud-cut-sm">{@render children()}</span>
</span>

<style>
  .badge {
    display: inline-flex;
    width: var(--space-6); /* 32 px square (§5.3) */
    height: var(--space-6);
    background: color-mix(in srgb, var(--tone-color) 40%, transparent);

    --tone-color: var(--text-3);
  }

  .face {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    margin: 1px;
    background: var(--bg-2);
    color: var(--tone-color);
    font-size: var(--fs-body-lg);
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
