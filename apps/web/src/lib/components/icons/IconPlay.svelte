<script lang="ts">
  /** "Starts something" glyph — the hero, Start, Resume (spec §5.1). */
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
  <path d="M8 5.5 19 12 8 18.5z" fill="currentColor" stroke="none" />
</svg>
