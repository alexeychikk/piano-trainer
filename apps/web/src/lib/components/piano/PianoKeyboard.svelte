<script module lang="ts">
  let instances = 0;
  /** Unique per mounted keyboard, so key element ids never collide. */
  function nextInstanceId(): number {
    instances += 1;
    return instances;
  }
</script>

<script lang="ts">
  /**
   * The piano keyboard (UX spec §5) — one component, two jobs: input surface
   * and exercise display surface. Pure presentation: props in, note callbacks
   * out. It holds no exercise knowledge and never plays audio itself.
   */
  import { midiToName, pcOf, spokenNoteName, type Midi } from '$lib/theory';
  import type { LabelMode } from '$lib/storage/settings.svelte';
  import {
    DEFAULT_MAX_HEIGHT,
    keyboardMetrics,
    layoutKeys,
    resolveRange,
    type KeyRange,
    type KeyboardLayout,
  } from './geometry';
  import {
    HIGHLIGHT_GLYPHS,
    isPressable,
    nextFocusableMidi,
    type KeyHighlight,
  } from './highlights';

  interface Props {
    /** Used when `layout` is `'range'` (the default). */
    range?: KeyRange;
    layout?: KeyboardLayout;
    /** Display state per key; `played` comes from the held-note set. */
    highlights?: ReadonlyMap<Midi, KeyHighlight>;
    labels?: LabelMode;
    labelStyle?: 'sharp' | 'flat';
    /** `false` = display only: no pointer, no keyboard input. */
    interactive?: boolean;
    maxHeightPx?: number;
    onNoteOn?: (midi: Midi) => void;
    onNoteOff?: (midi: Midi) => void;
  }

  const {
    range = { low: 36, high: 96 },
    layout = 'range',
    highlights,
    labels = 'c-only',
    labelStyle = 'sharp',
    interactive = true,
    maxHeightPx = DEFAULT_MAX_HEIGHT,
    onNoteOn,
    onNoteOff,
  }: Props = $props();

  let containerWidth = $state(0);

  const keyRange = $derived(resolveRange(layout, range));
  const keys = $derived(layoutKeys(keyRange));
  const metrics = $derived(
    keyboardMetrics(containerWidth, keyRange, maxHeightPx),
  );

  /** Notes that are highlighted but off the rendered keyboard (UX §5.4). */
  const offRangeBelow = $derived(
    [...(highlights?.keys() ?? [])]
      .filter((midi) => midi < keyRange.low)
      .sort((a, b) => b - a),
  );
  const offRangeAbove = $derived(
    [...(highlights?.keys() ?? [])]
      .filter((midi) => midi > keyRange.high)
      .sort((a, b) => a - b),
  );

  /** Roving focus: the group is one tab stop (UX §5.5). */
  let focusMidi = $state<Midi | null>(null);
  const rovingMidi = $derived(resolveRoving());

  function defaultFocus(bounds: KeyRange): Midi {
    return Math.min(Math.max(60, bounds.low), bounds.high);
  }

  /** A key can only hold focus while it is rendered pressable (not `dim`). */
  function isFocusableKey(midi: Midi): boolean {
    return interactive && isPressable(highlightOf(midi));
  }

  /**
   * The single tab stop. Prefer the last focused key, else middle C clamped
   * into range — but never a key that renders `disabled`, or tabbing into the
   * keyboard would land nowhere.
   */
  function resolveRoving(): Midi {
    const preferred =
      focusMidi !== null &&
      focusMidi >= keyRange.low &&
      focusMidi <= keyRange.high
        ? focusMidi
        : defaultFocus(keyRange);
    return (
      nextFocusableMidi(preferred, 1, keyRange, isFocusableKey) ??
      nextFocusableMidi(preferred, -1, keyRange, isFocusableKey) ??
      preferred
    );
  }

  function highlightOf(midi: Midi): KeyHighlight | null {
    return highlights?.get(midi) ?? null;
  }

  function labelFor(midi: Midi, black: boolean): string | null {
    if (labels === 'none') return null;
    if (labels === 'c-only')
      return pcOf(midi) === 0 ? midiToName(midi, labelStyle) : null;
    if (labels === 'white' && black) return null;
    return midiToName(midi, labelStyle);
  }

  // ---- press bookkeeping -------------------------------------------------

  /** Notes this component has sounded, per pointer id (`-1` = keyboard). */
  const pressed = new Map<number, Midi>();

  function press(pointerId: number, midi: Midi) {
    if (!interactive || !isPressable(highlightOf(midi))) return;
    if (pressed.get(pointerId) === midi) return;
    release(pointerId);
    pressed.set(pointerId, midi);
    onNoteOn?.(midi);
  }

  function release(pointerId: number) {
    const midi = pressed.get(pointerId);
    if (midi === undefined) return;
    pressed.delete(pointerId);
    onNoteOff?.(midi);
  }

  function releaseAll() {
    for (const pointerId of [...pressed.keys()]) release(pointerId);
  }

  function handlePointerDown(event: PointerEvent, midi: Midi) {
    if (!interactive) return;
    event.preventDefault();
    // Let `pointerenter` fire on the neighbours so a drag glissandos.
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    focusMidi = midi;
    press(event.pointerId, midi);
  }

  function handlePointerEnter(event: PointerEvent, midi: Midi) {
    if (!interactive) return;
    if (!pressed.has(event.pointerId)) return;
    press(event.pointerId, midi);
  }

  function handleKeyDown(event: KeyboardEvent, midi: Midi) {
    if (!interactive) return;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(midi + 1, 1);
        return;
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(midi - 1, -1);
        return;
      case 'Home':
        event.preventDefault();
        moveFocus(keyRange.low, 1);
        return;
      case 'End':
        event.preventDefault();
        moveFocus(keyRange.high, -1);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!event.repeat) press(-1, midi);
        return;
      default:
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') release(-1);
  }

  /** Move roving focus to the next key that can actually take it. */
  function moveFocus(midi: Midi, step: 1 | -1) {
    const next = nextFocusableMidi(midi, step, keyRange, isFocusableKey);
    // Nothing focusable that way (the edge, or only `dim` keys left): stay put,
    // so DOM focus and `focusMidi` never disagree.
    if (next === null) return;
    focusMidi = next;
    document.getElementById(keyId(next))?.focus();
  }

  const instance = nextInstanceId();
  const keyId = (midi: Midi) => `key-${instance}-${midi}`;

  const groupLabel = $derived(
    `Piano keyboard, ${midiToName(keyRange.low, labelStyle)} to ${midiToName(keyRange.high, labelStyle)}`,
  );
</script>

<svelte:window onpointerup={releaseAll} onpointercancel={releaseAll} />

<div class="frame" bind:clientWidth={containerWidth}>
  <div class="edge left" class:visible={offRangeBelow.length > 0}>
    {#if offRangeBelow.length > 0}
      <span>◂ {midiToName(offRangeBelow[0], labelStyle)}</span>
    {/if}
  </div>

  <div
    class="keys"
    role="group"
    aria-label={groupLabel}
    style:width="{metrics.width}px"
    style:height="{metrics.whiteHeight}px"
  >
    {#each keys as key (key.midi)}
      {@const state = highlightOf(key.midi)}
      {@const label = labelFor(key.midi, key.black)}
      <button
        type="button"
        id={keyId(key.midi)}
        class="key"
        class:black={key.black}
        class:white={!key.black}
        class:played={state === 'played'}
        class:correct={state === 'correct'}
        class:wrong={state === 'wrong'}
        class:target={state === 'target'}
        class:ghost={state === 'ghost'}
        class:dim={state === 'dim'}
        style:left="{key.left * metrics.whiteWidth}px"
        style:width="{key.width * metrics.whiteWidth}px"
        style:height="{key.black ? metrics.blackHeight : metrics.whiteHeight}px"
        tabindex={key.midi === rovingMidi ? 0 : -1}
        aria-label={spokenNoteName(key.midi)}
        aria-pressed={state === 'played'}
        disabled={!interactive || state === 'dim'}
        onpointerdown={(event) => handlePointerDown(event, key.midi)}
        onpointerenter={(event) => handlePointerEnter(event, key.midi)}
        onkeydown={(event) => handleKeyDown(event, key.midi)}
        onkeyup={handleKeyUp}
        onfocus={() => (focusMidi = key.midi)}
      >
        {#if state && HIGHLIGHT_GLYPHS[state]}
          <span class="glyph" aria-hidden="true">{HIGHLIGHT_GLYPHS[state]}</span
          >
        {/if}
        {#if label}
          <span class="label">{label}</span>
        {/if}
      </button>
    {/each}
  </div>

  <div class="edge right" class:visible={offRangeAbove.length > 0}>
    {#if offRangeAbove.length > 0}
      <span>{midiToName(offRangeAbove[0], labelStyle)} ▸</span>
    {/if}
  </div>
</div>

<style>
  /*
   * The raw px below (black-key radius, press offset, target outline, ghost
   * inset, edge bar, shake distance/duration) are spec-fixed literals from UX
   * §5.3 — see the tokens exemption in the root `CLAUDE.md`. Everything
   * reusable — colours, spacing, easing, key sizes — is a token.
   */
  .frame {
    display: flex;
    align-items: stretch;
    justify-content: center;
    gap: var(--space-2);
    width: 100%;
    max-width: var(--keyboard-max);
    margin: 0 auto;
  }

  .keys {
    position: relative;
    flex: 0 0 auto;
    background: var(--bg-0);
    border-radius: var(--radius-sm);
    touch-action: none;
  }

  .edge {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    width: var(--space-8);
    color: var(--accent);
    font-size: var(--fs-micro);
    opacity: 0;
  }

  .edge.right {
    justify-content: flex-end;
  }

  .edge.visible {
    opacity: 1;
  }

  .edge.visible.left {
    border-left: 4px solid var(--accent);
    padding-left: var(--space-2);
  }

  .edge.visible.right {
    border-right: 4px solid var(--accent);
    padding-right: var(--space-2);
  }

  .key {
    position: absolute;
    top: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-1);
    padding-bottom: var(--space-2);
    border: 1px solid var(--bg-0);
    background: var(--key-white);
    color: var(--text-3);
    cursor: pointer;
    transition:
      background-color var(--dur-fast) var(--ease),
      transform var(--dur-fast) var(--ease);
  }

  .white {
    border-radius: 0 0 var(--radius-sm) var(--radius-sm);
    z-index: 0;
  }

  .black {
    background: var(--key-black);
    color: var(--text-2);
    border-radius: 0 0 3px 3px;
    z-index: 1;
  }

  .white:hover:not(:disabled) {
    background: var(--key-white-hover);
  }

  .black:hover:not(:disabled) {
    background: var(--key-black-hover);
  }

  .key:disabled {
    cursor: default;
  }

  .played {
    background: var(--accent);
    color: var(--on-accent);
    transform: translateY(2px);
    box-shadow: var(--shadow-key-down);
  }

  .correct {
    background: var(--success);
    color: var(--on-success);
  }

  .wrong {
    background: var(--danger);
    color: var(--on-danger);
    animation: shake 160ms var(--ease);
  }

  .target {
    background: var(--hint);
    color: var(--bg-0);
    outline: 2px solid var(--text-1);
    outline-offset: -2px;
  }

  .ghost {
    box-shadow: inset 0 0 0 3px var(--hint);
  }

  .dim {
    opacity: 0.4;
    pointer-events: none;
  }

  .glyph,
  .label {
    font-size: var(--fs-micro);
    line-height: 1;
    pointer-events: none;
  }

  .played .label,
  .correct .label,
  .wrong .label,
  .target .label {
    color: inherit;
  }

  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-3px);
    }
    75% {
      transform: translateX(3px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .wrong {
      animation: none;
    }
  }
</style>
