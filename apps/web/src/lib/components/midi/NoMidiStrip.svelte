<script lang="ts">
  /**
   * "No MIDI device" as an explicit, non-blocking state (UX spec §4.6): a
   * strip, never a dialog. Copy comes from `$lib/midi/status` so every screen
   * says the same thing.
   */
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import Button from '$lib/components/hud/Button.svelte';
  import GlyphBadge from '$lib/components/hud/GlyphBadge.svelte';
  import IconKeyboard from '$lib/components/icons/IconKeyboard.svelte';
  import { midiInput } from '$lib/midi/input.svelte';

  const DISMISS_KEY = 'piano-trainer:midi-strip-dismissed';

  let dismissed = $state(false);

  onMount(() => {
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // No session storage (private mode): showing the strip is harmless.
    }
  });

  function dismiss() {
    dismissed = true;
    try {
      // For this session only — never permanently (§4.6).
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore: the strip is a hint, not state we must keep.
    }
  }

  async function connect() {
    await midiInput.connect();
    // §4.6: if access resolves with no inputs there is nothing more to do here,
    // so take the user where the device list and the troubleshooting copy live.
    if (midiInput.status === 'granted' && midiInput.devices.length === 0) {
      await goto(`${base}/settings#midi`);
    }
  }

  /**
   * Once access is blocked, `requestMIDIAccess` is rejected instantly by the
   * browser and the button would change nothing — §4.6 asks for the settings
   * link instead. Same for `unsupported`, where there is nothing to request.
   */
  const canRequest = $derived(
    midiInput.supported &&
      midiInput.status !== 'granted' &&
      midiInput.status !== 'denied',
  );
</script>

{#if midiInput.explanation && !dismissed}
  <!-- Information, not furniture: a 4 px `--warn` edge bar, a glyph badge and
       the copy verbatim — no glow, never a dialog (sci-fi-screens.md §5.6). -->
  <div class="strip hud-cut">
    <GlyphBadge tone="warn"><IconKeyboard /></GlyphBadge>
    <p class="message">{midiInput.explanation}</p>
    {#if canRequest}
      <Button onclick={connect}>Connect MIDI</Button>
    {:else}
      <Button href={`${base}/settings#midi`}>MIDI settings</Button>
    {/if}
    <Button variant="ghost" onclick={dismiss}>Got it</Button>
  </div>
{/if}

<style>
  /* The 4 px edge bar is a spec-fixed literal (part 1 §5.10, `CLAUDE.md`). */
  .strip {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--statusbar-h);
    padding: var(--space-2) var(--space-4);
    background: var(--bg-2);
    border-left: 4px solid var(--warn);
  }

  .message {
    flex: 1;
    color: var(--text-1);
    font-size: var(--fs-body);
  }
</style>
