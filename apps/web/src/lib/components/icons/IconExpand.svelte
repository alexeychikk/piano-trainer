<script lang="ts">
  /**
   * Focus mode's `⤢` (sci-fi-screens.md §10.2 — an addition to part 1 §4.5,
   * which omitted it): four corners pushed outwards.
   */
  const { size = '1em' }: { size?: string } = $props();
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
  <path d="M9 4H4v5M20 9V4h-5M15 20h5v-5M4 15v5h5" />
  <path d="M10 14l-5 5M14 10l5-5" />
</svg>
