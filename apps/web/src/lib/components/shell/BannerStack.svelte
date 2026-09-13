<script lang="ts">
  import { banners } from './banners.svelte';

  const GLYPHS = {
    info: 'ℹ',
    success: '✓',
    warn: '⚠',
    danger: '✗',
  } as const;
</script>

<!--
  The live region is mounted up front and stays mounted: a region that appears
  together with its first message is not announced by screen readers.
-->
<div class="stack" role="status" aria-live="polite">
  {#each banners.items as banner (banner.id)}
    <div class="banner {banner.tone}">
      <span class="glyph" aria-hidden="true">{GLYPHS[banner.tone]}</span>
      <span class="message">{banner.message}</span>
      <button type="button" onclick={() => banners.dismiss(banner.id)}>
        Dismiss
      </button>
    </div>
  {/each}
</div>

<style>
  .stack {
    display: flex;
    flex-direction: column;
  }

  .banner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-6);
    background: var(--bg-2);
    border-bottom: 1px solid var(--border);
    border-left: 4px solid var(--text-3);
    font-size: var(--fs-small);
  }

  .banner.info {
    border-left-color: var(--accent);
  }

  .banner.success {
    border-left-color: var(--success);
  }

  .banner.warn {
    border-left-color: var(--warn);
  }

  .banner.danger {
    border-left-color: var(--danger);
  }

  .message {
    flex: 1;
  }

  button {
    min-height: var(--hit-min);
    padding: 0 var(--space-3);
    background: none;
    border: none;
    color: var(--text-2);
    cursor: pointer;
  }

  button:hover {
    color: var(--text-1);
  }
</style>
