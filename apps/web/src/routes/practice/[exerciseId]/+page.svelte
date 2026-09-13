<script lang="ts">
  import { page } from '$app/state';
  import Placeholder from '$lib/components/shell/Placeholder.svelte';

  const exerciseId = $derived(page.params.exerciseId);
</script>

<svelte:head>
  <title>{exerciseId} · piano-trainer</title>
</svelte:head>

<Placeholder
  title="Exercise: {exerciseId}"
  note="The exercise runner — prompt, replay on space, answer capture and feedback — lives here."
  slice={4}
/>
