<script lang="ts">
  import '$lib/styles/tokens.css';
  import '$lib/styles/app.css';
  import TopBar from '$lib/components/shell/TopBar.svelte';
  import BannerStack from '$lib/components/shell/BannerStack.svelte';

  const { children } = $props();
</script>

<a class="skip visually-hidden" href="#main">Skip to content</a>
<TopBar />
<BannerStack />
<main id="main" tabindex="-1">
  {@render children?.()}
</main>

<style>
  main {
    max-width: var(--content-max);
    margin: 0 auto;
    padding: var(--space-7) var(--space-6);
  }

  main:focus {
    outline: none;
  }

  .skip:focus {
    display: inline-block;
    padding: var(--space-2) var(--space-4);
    background: var(--bg-2);
    color: var(--text-1);
  }
</style>
