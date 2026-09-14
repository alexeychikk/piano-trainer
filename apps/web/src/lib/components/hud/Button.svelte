<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The five button skins of the language (sci-fi visual language §5.1).
   * Behaviour, hit sizes and copy are unchanged from the UX spec: `--hit-min`
   * is the floor, `--hit-drill` in-exercise, 96 px for the home hero.
   *
   * `href` makes it a link that looks like a button (the hero is a link — it
   * navigates); everything else renders a real `<button>`.
   */
  interface Props {
    variant?: 'primary' | 'go' | 'secondary' | 'ghost' | 'danger';
    size?: 'md' | 'drill' | 'hero';
    href?: string;
    type?: 'button' | 'submit';
    disabled?: boolean;
    /** Fills the width of its column (the hero, a card action). */
    block?: boolean;
    /** Leading glyph for anything that starts, confirms or replays. */
    glyph?: Snippet;
    /** Second line under the label — the hero's sub-label. */
    sub?: string;
    ariaLabel?: string;
    /**
     * `data-testid` on the real control. A screen's e2e must be able to assert
     * that *the button* is enabled, which a wrapper `<div>` can never carry.
     */
    testId?: string;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
  }

  const {
    variant = 'secondary',
    size = 'md',
    href,
    type = 'button',
    disabled = false,
    block = false,
    glyph,
    sub,
    ariaLabel,
    testId,
    onclick,
    children,
  }: Props = $props();

  /**
   * A disabled link has no `href`, so it leaves the tab order and cannot be
   * activated by the keyboard — but a click on it would still reach `onclick`.
   * Swallow it, so `disabled` means the same thing in both renderings.
   */
  function onLinkClick(event: MouseEvent) {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onclick?.(event);
  }

  const glow = $derived(
    variant === 'primary'
      ? 'hud-glow hud-glow-accent'
      : variant === 'go'
        ? 'hud-glow hud-glow-success'
        : '',
  );
</script>

{#snippet body()}
  <span class="edge hud-cut">
    <span class="face hud-cut">
      <span class="row">
        {#if glyph}
          <span class="glyph" aria-hidden="true">{@render glyph()}</span>
        {/if}
        <span class="label">{@render children()}</span>
      </span>
      {#if sub}<span class="sub">{sub}</span>{/if}
    </span>
  </span>
{/snippet}

{#if href}
  <a
    href={disabled ? undefined : href}
    aria-disabled={disabled ? 'true' : undefined}
    aria-label={ariaLabel}
    data-testid={testId}
    onclick={onLinkClick}
    class="btn {variant} {size} {glow}"
    class:block
    class:disabled
  >
    {@render body()}
  </a>
{:else}
  <button
    {type}
    {disabled}
    aria-label={ariaLabel}
    data-testid={testId}
    {onclick}
    class="btn {variant} {size} {glow}"
    class:block
  >
    {@render body()}
  </button>
{/if}

<style>
  .btn {
    display: inline-block;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    text-decoration: none;
    cursor: pointer;
    transition: filter var(--dur-fast) var(--ease);
  }

  .block {
    display: block;
    width: 100%;
  }

  /* Edge is a flex container so the 1 px-inset face fills it exactly. */
  .edge {
    display: flex;
    height: 100%;
    background: var(--border);
  }

  .face {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    min-height: calc(var(--hit-min) - 2px);
    margin: 1px;
    padding: 0 var(--space-5);
    background: var(--bg-2);
    color: var(--text-1);
  }

  .drill .face {
    min-height: calc(var(--hit-drill) - 2px);
  }

  .hero .face {
    /* UX spec §3: the home hero is 96 px tall. */
    min-height: 94px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .label {
    font-family: var(--font-display);
    font-weight: var(--fw-semibold);
    font-size: var(--fs-body);
    letter-spacing: var(--track-hud);
    text-transform: uppercase;
  }

  .hero .label {
    font-size: var(--fs-h1);
    font-weight: var(--fw-bold);
  }

  .glyph {
    display: inline-flex;
    align-items: center;
  }

  /* The sub-label is body copy: sentence case, sans, and at full opacity —
     white on the lightest --grad-primary stop is 4.65:1, and fading it would
     spend that AA margin on decoration (§9.1). */
  .sub {
    font-family: var(--font-sans);
    font-size: var(--fs-small);
    letter-spacing: var(--track-none);
    text-transform: none;
  }

  /* ---- variants ------------------------------------------------------- */

  .primary .edge {
    background: var(--accent);
  }

  .primary .face {
    background: var(--grad-primary);
    color: var(--on-accent);
    box-shadow: var(--inset-top);
  }

  .primary:hover .face {
    background: var(--grad-primary-hover);
  }

  .go .edge {
    background: var(--success);
  }

  .go .face {
    /* 2 px mint edge over a well (§5.1) — the face is inset a second px. */
    margin: 2px;
    background: var(--bg-well);
    color: var(--success);
  }

  .secondary:hover .edge {
    background: var(--panel-border-hot);
  }

  .ghost .edge {
    background: transparent;
  }

  .ghost .face {
    background: transparent;
    color: var(--text-2);
  }

  .ghost:hover .face {
    background: var(--bg-2);
    color: var(--text-1);
  }

  .danger .edge {
    background: var(--danger);
  }

  .danger .face {
    color: var(--danger);
  }

  /* ---- states --------------------------------------------------------- */

  /* One frame of "press": the gradient drops and the glow goes (§5.1). */
  .btn:active {
    filter: none;
  }

  .primary:active .face {
    background: var(--accent-deep);
  }

  .btn:disabled,
  .btn.disabled {
    opacity: 0.45;
    cursor: default;
    filter: none;
  }

  .btn:disabled .edge,
  .btn.disabled .edge {
    background: var(--border);
  }

  /* Chamfered focus: the edge layer becomes the ring (§3.4). */
  .btn:focus-visible {
    outline: none;
    box-shadow: none;
  }

  .btn:focus-visible .edge {
    background: var(--focus);
  }

  .btn:focus-visible .face {
    margin: 3px;
  }
</style>
