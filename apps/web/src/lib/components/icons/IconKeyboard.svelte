<script lang="ts">
  /** A piano, for "Needs a MIDI keyboard" and the Free Play nav copy. */
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
  <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
  <path d="M8 6v7M12 6v7M16 6v7" />
</svg>
