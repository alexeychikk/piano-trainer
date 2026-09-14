<script lang="ts">
  /**
   * The wordmark's mark (spec §6): a waveform where the old `♪` was. Purely
   * the logo — it never appears on its own.
   */
  const { size = '1.25em' }: { size?: string } = $props();
</script>

<svg
  aria-hidden="true"
  focusable="false"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="1.5"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M2 12h3l2.5-6 3 13 3-9 2 4h6.5" />
</svg>
