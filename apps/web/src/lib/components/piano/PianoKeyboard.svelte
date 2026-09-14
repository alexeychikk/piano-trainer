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
  import {
    midiToName,
    pcOf,
    spokenNoteName,
    type Midi,
    type NoteName,
  } from '$lib/theory';
  import type { LabelMode } from '$lib/storage/settings.svelte';
  import {
    DEFAULT_MAX_HEIGHT,
    keyboardMetrics,
    layoutKeys,
    resolveRange,
    showsApron,
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
    /**
     * `'context'` spells a key the way the current question does — the
     * `spellings` map below — and falls back to sharps for everything else.
     */
    labelStyle?: 'sharp' | 'flat' | 'context';
    /** Spelling per key, used by `labelStyle: 'context'` (UX §5.1). */
    spellings?: ReadonlyMap<Midi, NoteName>;
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
    spellings,
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

  /** Does DOM focus currently sit on one of our keys? */
  let hasFocus = $state(false);

  /**
   * Focus left a key. When it moved somewhere else the keyboard is no longer
   * ours; when it was *dropped* (`relatedTarget === null`, which is what
   * disabling the focused element does) we keep ownership so the effect below
   * can put it back.
   */
  function handleFocusOut(event: FocusEvent) {
    const next = event.relatedTarget;
    if (next === null) return;
    if (next instanceof Node && event.currentTarget instanceof HTMLElement) {
      if (event.currentTarget.contains(next)) return;
    }
    hasFocus = false;
  }

  /**
   * A key that goes `dim` under the user's fingers renders `disabled`, and a
   * disabled element silently drops focus to `<body>` — the keyboard would go
   * dead mid-exercise. Move focus to the tab stop instead, so arrow keys keep
   * working when a question narrows the range (UX §5.2, §5.5).
   */
  $effect(() => {
    if (!hasFocus || focusMidi === null) return;
    if (isFocusableKey(focusMidi)) return;
    const next = rovingMidi;
    if (next === focusMidi) return;
    focusMidi = next;
    document.getElementById(keyId(next))?.focus();
  });

  /** Sharps are the fallback spelling; `'context'` asks the question first. */
  const fallbackStyle = $derived(labelStyle === 'flat' ? 'flat' : 'sharp');

  function nameOf(midi: Midi): NoteName {
    if (labelStyle === 'context') {
      const spelled = spellings?.get(midi);
      if (spelled) return spelled;
    }
    return midiToName(midi, fallbackStyle);
  }

  function labelFor(midi: Midi, black: boolean): string | null {
    if (labels === 'none') return null;
    if (labels === 'c-only') return pcOf(midi) === 0 ? nameOf(midi) : null;
    if (labels === 'white' && black) return null;
    return nameOf(midi);
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

  /**
   * The apron's octave chrome (§4.1): one 2 px cyan tick per C, on the key
   * boundary. It carries no text — the `c-only` labels already name the
   * octaves, and two sources of truth for "where is C4" is one too many.
   */
  const apron = $derived(showsApron(metrics.whiteHeight));
  const cTicks = $derived(
    keys
      .filter((key) => !key.black && pcOf(key.midi) === 0)
      .map((key) => key.left * metrics.whiteWidth),
  );

  /** Labels shrink below `W` = 32 px, glyphs never do (UX §5.3, §2.6). */
  const denseLabels = $derived(metrics.whiteWidth < 32);

  const groupLabel = $derived(
    `Piano keyboard, ${midiToName(keyRange.low, fallbackStyle)} to ${midiToName(keyRange.high, fallbackStyle)}`,
  );
</script>

<svelte:window onpointerup={releaseAll} onpointercancel={releaseAll} />

<!-- Marked so screens can tell a key press apart from a shell shortcut. -->
<div class="frame" data-piano-keyboard>
  <!-- The bed (§4.1): one clip-path for the whole component — the keys are
       never chamfered, and the 1 px luminous edge is the usual glow-less
       edge/face pair, because clip-path would eat a real border. -->
  <div class="bed hud-cut hud-cut-lg">
    <div class="face hud-cut hud-cut-lg" bind:clientWidth={containerWidth}>
      <div class="row">
        <div class="edge left" class:visible={offRangeBelow.length > 0}>
          {#if offRangeBelow.length > 0}
            <span>◂ {nameOf(offRangeBelow[0])}</span>
          {/if}
        </div>

        <div class="stack" style:width="{metrics.width}px">
          {#if apron}
            <div class="apron" aria-hidden="true">
              {#each cTicks as left (left)}
                <span class="tick" style:left="{left}px"></span>
              {/each}
            </div>
          {/if}

          <div
            class="keys"
            role="group"
            aria-label={groupLabel}
            onfocusin={() => (hasFocus = true)}
            onfocusout={handleFocusOut}
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
                style:height="{key.black
                  ? metrics.blackHeight
                  : metrics.whiteHeight}px"
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
                  <span class="glyph" aria-hidden="true"
                    >{HIGHLIGHT_GLYPHS[state]}</span
                  >
                {/if}
                {#if label}
                  <span class="label" class:dense={denseLabels}>{label}</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <div class="edge right" class:visible={offRangeAbove.length > 0}>
          {#if offRangeAbove.length > 0}
            <span>{nameOf(offRangeAbove[0])} ▸</span>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /*
   * The raw px below (black-key radius, press offset, target outline, ghost
   * inset, edge bar, apron height, the focus ring's two bands, shake
   * distance/duration) are spec-fixed literals from UX §5.3 and
   * sci-fi-screens.md §2.1/§4.1 — see the tokens exemption in the root
   * `CLAUDE.md`. Everything reusable — colours, spacing, easing, key sizes —
   * is a token.
   */
  .frame {
    display: flex;
    justify-content: center;
    width: 100%;
    max-width: var(--keyboard-max);
    margin: 0 auto;
  }

  /* Bed, elevation −1 (§4.1): `--key-bed` trough, 1 px `--border` edge, a dark
     inset top, one chamfer for the whole component and **no outer glow** — the
     keys glow, the bed does not. */
  .bed {
    display: flex;
    flex: 1;
    background: var(--border);
  }

  .bed .face {
    display: flex;
    flex: 1;
    min-width: 0;
    margin: 1px;
    padding: var(--space-2) var(--space-2) var(--space-1);
    background: var(--key-bed);
    box-shadow: inset 0 1px 0 rgb(0 0 0 / 0.5);
  }

  .row {
    display: flex;
    flex: 1;
    align-items: stretch;
    justify-content: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .stack {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: var(--space-2);
  }

  /* The apron (§4.1): the reference's neon rail, as a fading cyan hairline
     with a tick at every C. Decoration — it carries no text and a compressed
     bed drops it (`showsApron`). */
  .apron {
    position: relative;
    height: 6px;
  }

  .apron::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 1px;
    background: var(--grad-rule);
  }

  .tick {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--cyan);
  }

  .keys {
    position: relative;
    flex: 0 0 auto;
    touch-action: none;
  }

  /* Off-range notes (UX §5.4): a 4 px accent bar on the bed's edge, glowing,
     with the note name in the display face. */
  .edge {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    width: var(--space-8);
    color: var(--accent);
    font-family: var(--font-display);
    font-size: var(--fs-micro);
    letter-spacing: var(--track-hud);
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
    box-shadow: var(--glow-accent);
  }

  .edge.visible.right {
    border-right: 4px solid var(--accent);
    padding-right: var(--space-2);
    box-shadow: var(--glow-accent);
  }

  /*
   * A lit key glows with `box-shadow`, never `filter: drop-shadow` (§4.2):
   * keys are unchamfered, so a box-shadow draws the glow correctly *and* keeps
   * a ten-note chord out of part 1 §7's ≤ 12 filter-layer budget. The two
   * shadow slots compose — press/inset first, glow second, and the focus rule
   * appends the keyline last — so no state has to restate another's shadow.
   */
  .key {
    --key-press: 0 0 0 transparent;
    --key-glow: 0 0 0 transparent;

    position: absolute;
    top: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-1);
    padding-bottom: var(--space-2);
    border: 1px solid var(--bg-0);
    background: var(--grad-key-white);
    /* Key faces are not panels: `--text-3` is a panel-text colour and measures
       2.61 on `--key-white` (2.26 on hover). The sci-fi spec §9 pairs the key
       label with `--key-ink` (15.57 / 13.52 on the gradient's two stops).
       `.black` overrides it below, because `--key-ink` on `--key-black` is
       1.02. */
    color: var(--key-ink);
    box-shadow: var(--key-press), var(--key-glow);
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
    background: var(--grad-key-black);
    color: var(--text-2);
    border-radius: 0 0 3px 3px;
    z-index: 1;
  }

  /* Hover *brightens* in this language (§3.1): the key lights, it never dims. */
  .white:hover:not(:disabled) {
    background: var(--key-white);
  }

  .black:hover:not(:disabled) {
    background: var(--key-black-hover);
  }

  .key:disabled {
    cursor: default;
  }

  /* `--grad-primary`, not flat `--accent`: the key ink is `--on-accent`
     (white), which clears AA over the gradient's stops but only reaches 2.77
     on flat `--accent`. Same rule as every other filled accent surface. */
  .played {
    --key-press: var(--shadow-key-down);
    --key-glow: var(--glow-accent);

    background: var(--grad-primary);
    color: var(--on-accent);
    transform: translateY(2px);
  }

  .correct {
    --key-glow: var(--glow-success);

    background: var(--success);
    color: var(--on-success);
  }

  .wrong {
    --key-glow: var(--glow-danger);

    background: var(--danger);
    color: var(--on-danger);
    animation: shake 160ms var(--ease);
  }

  .target {
    --key-glow: var(--glow-hint);

    background: var(--hint);
    color: var(--on-hint);
    outline: 2px solid var(--text-1);
    outline-offset: -2px;
  }

  /* The 3 px inset is 2.11 on a white key — under 3:1, which is acceptable
     *only* because `◇` is mandatory and carries the state on its own (§4.2).
     Do not thin it, and never draw a ghost without the glyph. */
  .ghost {
    --key-press: inset 0 0 0 3px var(--hint);
  }

  .dim {
    opacity: 0.4;
    pointer-events: none;
  }

  /*
   * Focus on a piano key is its own rule (§2.1). The global ring is invisible
   * here — `--focus` measures 1.19 on `--key-white` — and its
   * `outline-offset: 2px` lands on the white *neighbours*. So the ring is
   * dual-tone and drawn inside the face: a 3 px `--focus` band (13.92 against
   * the keyline) over a 2 px `--bg-0` keyline (16.56 on a white key). The
   * keyline is listed last so a pressed key's `--shadow-key-down` composes
   * with it.
   */
  .key:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: -5px;
    box-shadow:
      var(--key-press),
      var(--key-glow),
      inset 0 0 0 2px var(--bg-0);
  }

  /* The glyph is the signal, so it wins over the label at a metre (§2.6). */
  .glyph {
    font-size: var(--fs-body);
    line-height: 1;
    pointer-events: none;
  }

  .label {
    font-family: var(--font-display);
    font-size: var(--fs-micro);
    line-height: 1;
    pointer-events: none;
  }

  /* 10 px below `W` = 32 px (UX §5.3) — the one place the 12 px label floor
     bends, because a wider label would not fit the key it names. */
  .label.dense {
    font-size: 10px;
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
