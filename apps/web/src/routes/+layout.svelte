<script lang="ts">
  import '$lib/styles/tokens.css';
  import '$lib/styles/app.css';
  import TopBar from '$lib/components/shell/TopBar.svelte';
  import BannerStack from '$lib/components/shell/BannerStack.svelte';
  import { banners } from '$lib/components/shell/banners.svelte';
  import { computerKeyboard } from '$lib/midi/computer-keys.svelte';
  import { midiInput } from '$lib/midi/input.svelte';
  import { deviceLostMessage } from '$lib/midi/status';
  import { settings } from '$lib/storage/settings.svelte';
  import { onMount } from 'svelte';

  const { children } = $props();

  /**
   * App-wide input wiring (ADR §3). The computer keyboard is always live so
   * the app works without hardware; MIDI reconnects silently when the
   * permission was already granted, and otherwise waits for a user gesture.
   */
  onMount(() => {
    settings.hydrate();
    midiInput.onDeviceLost = (name) =>
      banners.show(deviceLostMessage(name), 'warn');
    void midiInput.autoConnect();

    const detach = computerKeyboard.attach(window);
    return () => {
      detach();
      midiInput.onDeviceLost = null;
    };
  });
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
