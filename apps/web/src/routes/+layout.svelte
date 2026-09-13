<script lang="ts">
  import '$lib/styles/tokens.css';
  import '$lib/styles/app.css';
  import TopBar from '$lib/components/shell/TopBar.svelte';
  import BannerStack from '$lib/components/shell/BannerStack.svelte';
  import { banners } from '$lib/components/shell/banners.svelte';
  import { computerKeyboard } from '$lib/midi/computer-keys.svelte';
  import { midiInput } from '$lib/midi/input.svelte';
  import { deviceLostMessage } from '$lib/midi/status';
  import { isTypingTarget } from '$lib/midi/keymap';
  import { audio } from '$lib/audio/engine.svelte';
  import { isMuteShortcut } from '$lib/audio/shortcuts';
  import { AUDIO_COPY } from '$lib/audio/status';
  import { settings } from '$lib/storage/settings.svelte';
  import { onMount } from 'svelte';

  const { children } = $props();

  /**
   * App-wide input and audio wiring (ADR §2, §3). The computer keyboard is
   * always live so the app works without hardware; MIDI reconnects silently
   * when the permission was already granted, and otherwise waits for a user
   * gesture.
   *
   * Audio is wired here, not per screen: the `AudioContext` may only be
   * created from a user gesture, so the *first* click or keypress anywhere
   * starts it, and every note — MIDI port, on-screen keys, computer keys —
   * reaches the engine through the one `midiInput` subscription.
   */
  onMount(() => {
    settings.hydrate();
    midiInput.onDeviceLost = (name) =>
      banners.show(deviceLostMessage(name), 'warn');
    void midiInput.autoConnect();

    audio.onFallback = () => banners.show(AUDIO_COPY.soundfontFailed, 'warn');

    // Straight from the event — no effects, no awaits in between: ADR §2
    // budgets 30 ms from key-press to sound.
    const unsubscribe = midiInput.subscribe((event) => {
      if (event.type === 'on') audio.noteOn(event.midi, event.velocity);
      else audio.noteOff(event.midi);
    });

    const startAudio = () => void audio.ensureStarted();
    const onKeyDown = (event: KeyboardEvent) => {
      startAudio();
      if (isTypingTarget(event.target)) return;
      // `m` mutes and unmutes anywhere (UX spec §4.5).
      if (isMuteShortcut(event)) audio.toggleMuted();
    };

    window.addEventListener('pointerdown', startAudio);
    window.addEventListener('keydown', onKeyDown);

    const detach = computerKeyboard.attach(window);
    return () => {
      detach();
      unsubscribe();
      window.removeEventListener('pointerdown', startAudio);
      window.removeEventListener('keydown', onKeyDown);
      midiInput.onDeviceLost = null;
      audio.onFallback = null;
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
