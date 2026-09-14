# Visual language — "HUD" sci-fi re-skin, part 2: the practice screens + `PianoKeyboard`

- **Status**: Accepted, v1 (2026-09-14)
- **Scope**: the six surfaces part 1 deferred — the exercise runner (`/practice/[exerciseId]`),
  `PianoKeyboard`, Free Play (`/play`), Progress (`/progress`), Settings (`/settings`) and the mixed
  session (`/session`) plus its summary — dressed in the language part 1 established. Plus the
  carried-forward findings the delivery plan assigned to this pass (§2) and the token changes they
  need (§3).
- **Out of scope**: new screens, new regions, new features, new routes, new copy sentences. This is
  still a **re-skin**: it moves no region and changes no word of the copy deck. Two-hand voicing
  colours (UX spec §11) stay deferred — see §3.3.
- **Authority**
  - [`ADR 0001`](../decisions/0001-target-architecture-and-stack.md) wins on architecture,
    vocabulary and contracts.
  - [`core-practice-ux.md`](core-practice-ux.md) **wins on behaviour, layout, information
    architecture, states, timings and copy**. Where this document restates a dimension or a timing,
    it is quoting; where it changes one, the change is called out as **[amends §x]** and there are
    exactly three of them (§2.5, §8.2, §8.4).
  - [`sci-fi-visual-language.md`](sci-fi-visual-language.md) (part 1) wins on visual values —
    palette roles, panel anatomy, type, motion budget, component catalogue. This document applies
    it; where it corrects a measured number in part 1 it says so (§2.1, §2.2).
  - [`tokens.css`](tokens.css) is the only place raw values live. §3 lists this pass's edits;
    developer pass 2 re-copies the file byte-for-byte to `apps/web/src/lib/styles/tokens.css`.
- **Reference**: [`reference/sci-fi-reference.png`](reference/sci-fi-reference.png). The owner's
  rule stands: **style fidelity, not layout fidelity** — the screenshot is a token and component
  sheet that happens to be arranged as a dashboard.

---

## 1. How to build from this document

1. Read `core-practice-ux.md` for the screen you are building — regions, states, timings, copy.
2. Read part 1 for the primitives — `HudPanel`, `MicroLabel`, `Chip`, `Badge`, `GlyphBadge`,
   `Button`, `ProgressBar`, `MasteryPips`, `Ring`, `Meter`, `ListRow` in `$lib/components/hud/`.
3. Read the section here for the surface you are dressing. **Every panel, button, pill, bar and pip
   on these screens is one of those primitives.** If a screen needs a look a primitive does not
   have, extend the primitive (a prop), never re-style a copy of it in a screen.
4. Nothing here is a licence to add a region. If a treatment seems to need one, it is wrong.

The six surfaces in one line each:

| Surface | The one-sentence treatment |
| --- | --- |
| Runner | A HUD rail on top, the prompt in a sunken readout well, feedback as a state strip in the reserved 88 px, the keyboard in its bed at the bottom. |
| `PianoKeyboard` | A sunken `--key-bed` trough with a cyan hairline and octave ticks; flat key faces that *light* rather than recolour; every graded state still carries its glyph. |
| Free Play | The same keyboard, with the reference's `CURRENT NOTE` readout as the held-note/chord display. |
| Progress | Exercise groups as panels with header bands; the 7-pip mastery vocabulary untouched; the headline accuracy becomes the `Ring`. |
| Settings | Four panels with header bands, a sticky micro-label rail ≥ 1100 px, §5.11 fields — and the four §6.3 gaps closed. |
| `/session` | The runner frame with a time bar instead of a question bar; the summary is a full screen built from `Ring` + readouts + `ListRow`s. |

---

## 2. Corrections and decisions this pass owns

The delivery plan handed pass 2 a list of carried-forward findings. Each is resolved here.

### 2.1 The focus ring is invisible on a white piano key — **fixed** (corrects part 1 §9)

Part 1's contrast table claims `--focus` on `--key-white` is **3.43:1**. Re-measured, it is
**1.19:1** (`#7ce4ff` on `#dceaf5`; both are light). Every other number in that table reproduces
exactly, so this one row was simply wrong — and it matters, because the global ring in `tokens.css`
is `outline: 3px solid var(--focus); outline-offset: 2px`, which on a key inside a keyboard lands on
its **white neighbours**. A keyboard-only user roving the keys today has a focus indicator they
cannot see.

**The rule for piano keys** (and only for them — the global ring is unchanged everywhere else): the
ring is drawn **inside the key face** as two bands, so it never touches a neighbour and reads on
both a white and a black face:

```
outline: 3px solid var(--focus);   outline-offset: -5px;     /* inner cyan band */
box-shadow: inset 0 0 0 2px var(--bg-0);                     /* dark keyline hugging the edge */
```

Measured: `--focus` against the `--bg-0` keyline **13.92**, the keyline against `--key-white`
**16.56**, against `--key-black` ~1.1 (irrelevant — there the cyan band carries it at 13.9 against
the face). A dual-tone ring is the WCAG 2.2 "focus appearance" technique and is the only thing that
survives a surface that can be near-white or near-black.

Keys keep `:focus-visible` only, and the `--shadow-key-down` of a pressed key composes with the
inset keyline (both are `box-shadow`; list the keyline last).

### 2.2 `--panel-border-hot` is better than part 1 measured (no rule change)

Re-measured: **4.10** on `--bg-0` and **3.85** on `--bg-1` (part 1 says 3.11 / 2.92). So a hot edge
does clear the 3:1 non-text threshold on a panel. **Keep part 1's stricter rule anyway**: a hot edge
inside a panel is 2 px, or paired with a glyph or a text change. It is belt-and-braces, it costs
nothing, and hover/focus already change something else.

### 2.3 Weak skill marker is `--warn`, not `--danger`

UX spec §6.1 renders the `!` weak marker in `--danger`; part 1 §2.2 lists weak as `--warn` + `!`.
**Part 1 wins** (it owns visual values): `!` is `--warn`. Rationale beyond precedence — `--danger`
means *wrong* in the answer path, and a skill you have not drilled enough is not an error. `due`
(the word) and `!` therefore share `--warn`, and they are distinguished by their text, as the
never-colour-alone rule requires.

### 2.4 `ProgressBar`'s ramp slides while the width animates — **fixed**

Today the fill's width transitions over `--dur-base` while its background is scaled by
`100 / percent`, so `--ramp-scale` jumps on every value change and the ramp visibly slides under the
bar. Fix, in the primitive:

- Paint `--grad-data` on a **full-track-width layer** inside the track, at 100 % width, and reveal
  it: the animated property is `clip-path: inset(0 calc(100% - <value>%) 0 0)` on that layer (or
  `width` on an `overflow: hidden` wrapper whose child is 100 % of the *track*).
- The ramp then never moves: the colour at any x is fixed by position, which is the whole point of
  §2.3's "one ramp". Two bars at 62 % match during the transition, not only after it.
- The 1 px `--cyan` leading cap rides the reveal edge; keep it decorative.
- `--ramp-scale` disappears with the fix. Nothing else changes: `role="progressbar"`,
  `aria-valuenow`, the micro-label and the readout are unchanged.

### 2.5 The dormant light theme is **dropped** — this closes UX spec §11's light-theme question

`[data-theme='light']` is 58 lines of a second palette that nothing toggles (`app.html` hardcodes
`data-theme="dark"`), that no screen was ever designed or contrast-checked against, and that
`hud.css` and `app.css` carry branches for. The HUD language is dark-only by design (part 1 §2), and
an unreachable half-theme is worse than none: it invites "fixes" against values nobody verified.

**Decision** — remove it: the `[data-theme='light']` block in `tokens.css` (§3.2), the
`[data-theme='light'] .hud-glow` rule in `hud.css`, and any light branch in `app.css`. Keep
`data-theme="dark"` on `<html>` as a documentation-only marker of intent — `:root, [data-theme='dark']`
still matches it. **[amends §11]** of `core-practice-ux.md`: there is no light theme in v1; if the
owner asks for one it is a real ticket with its own contrast pass, not a token override.

### 2.6 Key glyph size: 16 px (as UX spec §5.3 always said)

`PianoKeyboard` currently renders the state glyph at `--fs-micro` (12 px), the same size as the note
label. UX spec §5.3 fixes glyphs at **16 px** — they are the non-colour signal and must win over the
label at a metre. Pass 2: glyph `--fs-body` (16 px), label `--fs-micro` (12 px, or 10 px below
`W` = 32 px per §5.3). At `W` < 24 px the **label** is dropped before the glyph, never the reverse.

### 2.7 No emoji anywhere in the HUD

The status strip's streak uses 🔥. Emoji render per-platform, ignore `--font-display`, and ignore
every colour token — in greyscale they are noise. Streak becomes a HUD readout: micro-label `STREAK`
+ tabular value (§5.2). The same rule retires the `⌨` in the no-MIDI strip (→ `IconKeyboard`) and
the 🔇/🔈 in the sound chip **only if** `$lib/audio/status.ts`'s glyphs are ever re-authored — they
are *copy* (`SoundChip.glyph`), so they stay verbatim for now and this is recorded as a known
inconsistency, not a change: copy is out of this pass's reach.

Text glyphs that are part of the copy deck — `✓ ✗ ◆ ◇ ⤳ ● ○ ◐ ⊘ ! ▶ ■ ⤢` — are **not** emoji and
stay exactly as they are. They are the never-colour-alone signal.

---

## 3. Token changes

### 3.1 Added: two key-face gradients (no new colours)

The reference's keys read as slabs with a top sheen, not flat rectangles. Both new tokens are
composed **entirely of existing key tokens**, so no measured pairing moves and no raw colour is
added:

```css
--grad-key-white: linear-gradient(180deg, var(--key-white) 0%, var(--key-white-hover) 100%);
--grad-key-black: linear-gradient(180deg, var(--key-black-hover) 0%, var(--key-black) 100%);
```

The lightest pixel of a white key is still exactly `--key-white`, so `--key-ink` on it is still
15.57 (13.52 on the bottom stop — still AAA). Hover **brightens** instead of darkening in this
language: a hovered white key is flat `--key-white`, a hovered black key flat `--key-black-hover`
(§4.4).

### 3.2 Removed: the `[data-theme='light']` block

Per §2.5. `tokens.css` shrinks to the dark contract plus the reduced-motion block and the focus
rule.

### 3.3 Still deferred: two-hand voicing colours

Slice 8 (play-the-voicing) is the first screen that needs a left-hand / right-hand split, and the
`highlights` map is already expressive enough to carry it. **No token is added now** — inventing a
pair of hand colours a year before anything paints them guarantees they are wrong. When slice 8 is
designed: two new highlight states, each with its own **glyph** (the palette has no headroom left
for two more meaningful hues that survive greyscale), most likely `L`/`R` set in `--font-display`
over the existing `played` fill.

### 3.4 Nothing else

Every other value this document uses already exists. If an implementer reaches for a raw hex, a
magic px or a new gradient, the answer is in §3.1–§3.3 or it is a bug in this spec — raise it, do
not inline it. The one standing exemption is `CLAUDE.md`'s: spec-fixed one-off literals (the 2 px
press offset, the 3 px black-key radius, the 4 px strip edge bar, the ring bands in §2.1) stay
literal in the component that draws them, with the spec section cited in a comment.

---

## 4. `PianoKeyboard` — the neon keyboard

**Unchanged and not re-specified here**: props (`range`, `layout`, `highlights`, `labels`,
`labelStyle`, `spellings`, `interactive`, `maxHeightPx`, `onNoteOn`, `onNoteOff`), geometry and the
black-key nudges (UX §5.2), highlight precedence `wrong > correct > target > played > ghost > dim`,
range clamping, pointer/computer-key/MIDI behaviour, the roving-focus model and every a11y rule in
§5.5. The component still holds no exercise state and plays no audio.

### 4.1 Anatomy

```
   ┌ bed: --key-bed, 1px --border, --chamfer-lg, inset 0 1px 0 rgb(0 0 0 /.5) ─────────────┐
   │ ·──────────·──────────·──────────·──────────·  ← 6px apron: --grad-rule hairline,     │
   │                                                  a --cyan tick at every C             │
   │ ▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│   keys (never chamfered, §3.1 part 1)   │
◂C2│ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │                                  G7▸  │
   │ └ C4 ┘                                          ← labels: --fs-micro, --key-ink /     │
   └───────────────────────────────────────────────────────  --text-2 on black ────────────┘
     ↑ off-range edge bar: 4px --accent + note name, --glow-accent
```

| Part | Treatment |
| --- | --- |
| **Bed** | Elevation −1 (part 1 §3.3): `--key-bed`, 1 px `--border`, `inset 0 1px 0 rgb(0 0 0 / .5)`, `--chamfer-lg`. **One** clip-path for the whole component — the keys are never chamfered (part 1 §3.1: nothing that repeats > ~30×). No outer glow: the *keys* glow, the bed does not. Padding `--space-2` around the keys, `--space-1` at the bottom. |
| **Apron** | A 6 px strip inside the bed, above the keys: a 1 px `--grad-rule` hairline (cyan, fading right) with a 2 px `--cyan` tick at each C. This is the reference's neon rail and the octave chrome; it carries **no text**, because the `c-only` key labels already name the octaves and two sources of truth for "where is C4" is one too many. Dropped when the bed is under 120 px tall (a compressed runner keyboard) — decoration, never meaning. |
| **White key** | `--grad-key-white`, 1 px `--bg-0` gap (drawn as a border, not a margin), radius `0 0 4px 4px`. Hover (pointer only): flat `--key-white` — it *lights*. |
| **Black key** | `--grad-key-black`, radius `0 0 3px 3px`, `--inset-top` for the sheen. Hover: flat `--key-black-hover`. |
| **Label** | `--fs-micro`, `--font-display`, bottom-aligned: **`--key-ink` on white, `--text-2` on black** (15.57 / 10.87 — part 1 §9; `--text-3` measures 2.61 on a key face and is a panel colour, never a key colour). |
| **Glyph** | `--fs-body` (16 px, §2.6), in the ink of the fill it sits on: `--on-*` on a filled state key. Bottom 24 px of the key, where a hand does not occlude it. |
| **Off-range edge bar** | Unchanged behaviour (UX §5.4): 4 px `--accent` bar plus the note name on the bed's left/right edge, now with `--glow-accent` and the name in `--font-display` `--fs-micro`. |

### 4.2 States — the same six, lit instead of recoloured

Glows here are **`box-shadow`**, not `filter: drop-shadow`. Keys are unchamfered, so `box-shadow`
draws the glow correctly *and* keeps the whole keyboard out of part 1 §7's "≤ 12 drop-shadow layers
per screen" budget — which a ten-note chord would otherwise blow on its own. This is the second
reason keys are never chamfered.

| State | Fill | Glow | Non-colour cue (mandatory) |
| --- | --- | --- | --- |
| idle | `--grad-key-white` / `--grad-key-black` | — | — |
| hover | flat `--key-white` / `--key-black-hover` | — | pointer-only affordance |
| `played` | `--grad-primary`, ink `--on-accent` | `--glow-accent` | `translateY(2px)` + `--shadow-key-down` |
| `correct` | `--success`, ink `--on-success` | `--glow-success` | **`✓`** |
| `wrong` | `--danger`, ink `--on-danger` | `--glow-danger` | **`✗`** + 160 ms, 3 px shake |
| `target` | `--hint`, ink `--on-hint` | `--glow-hint` | **`◆`** + 2 px `--text-1` inset outline |
| `ghost` | key face unchanged + 3 px inset `--hint` | — | **`◇`** (`--key-ink` / `--text-2`) |
| `dim` | key face at 40 % opacity, `pointer-events: none` | — | — (it is the absence of state) |

Notes, all measured:

- `played` is the **gradient**, never flat `--accent`: white ink on flat `--accent` is 2.77, on the
  gradient's stops 4.65 / 8.62 (part 1 §9). A flat-`--accent` key fill is always a contrast bug.
- Filled state keys against the bed: `--success` 12.54, `--hint` 7.69, `--danger` 7.30, the
  gradient's dark stop 2.30 — the last one is why a played key also *depresses*; the glyphless state
  never relies on its edge.
- `ghost`'s 3 px `--hint` inset on a white key is **2.11** — under 3:1. That is acceptable *only*
  because `◇` is mandatory and carries the state on its own (UX §8.1); do not thin the inset, and do
  not add a ghost state without the glyph.
- `dim` at 40 % opacity over `--key-bed` lands near mid-grey: still clearly "not in play", and the
  keys are unpressable, so nothing depends on reading it precisely.
- Reduced motion: no shake, no press translate (unchanged). Glows are static in every case —
  a lit key never pulses, breathes or fades in; a highlight is a class swap inside one frame
  (part 1 §7, UX §5.4).

### 4.3 Sizes, layout, focus

- Geometry, `W` clamps (18–48 px), heights and `maxHeightPx` are UX §5.2, unchanged. The bed adds
  `--space-2` × 2 + 6 px apron to the component's height; the runner's budget in §5.1 accounts for it.
- Keyboard focus: §2.1's dual-tone inner ring. The roving-focus rules (one tab stop, arrows by
  semitone, `Home`/`End`, keeping focus alive when a key goes `dim`) are unchanged.
- `data-piano-keyboard` stays on the frame: screens use it to tell a key press from a shell shortcut.

---

## 5. `/practice/[exerciseId]` — the exercise runner

**Unchanged**: the region order and every dimension in UX §4.1, the state machine and its visual
mapping (§4.2), every timing constant (§4.3, and they live in `runner.svelte.ts`), the answer modes
(§4.4), the shortcut contract (§4.5), the no-MIDI strip (§4.6), focus mode (§4.7). The runner still
**never scrolls** and the feedback slot is still a permanently reserved 88 px.

### 5.1 Anatomy in the new language

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ⌁ PIANO-TRAINER  PRACTICE PROGRESS FREE PLAY SETTINGS  ╭●MIDI CONNECTED╮ ╭🔊╮   │ ① 56px
├──────────────────────────────────────────────────────────────────────────────────┤
│ Find the note          ANSWERED ▁▃▅ 7/10   STREAK 5   ACCURACY 92%      ⚙   ⤢   │ ② 52px rail
├──────────────────────────────────────────────────────────────────────────────────┤
│   ┌ --bg-well, --chamfer-lg, 1px --border ────────────────────────────────────┐  │
│   │ LISTEN                                                        (hot label) │  │ ③ prompt
│   │                        WHICH NOTE?                                        │  │   well
│   │                   Play it back on your keyboard                           │  │   min 140px
│   └───────────────────────────────────────────────────────────────────────────┘  │
│                         ╭──────────────────────────╮                             │ ④ 64px
│                         │  ▶  REPLAY      [Space]  │                             │
│                         ╰──────────────────────────╯                             │
│   ┌ 88px reserved — empty during `awaiting`, never collapses ─────────────────┐  │ ⑤
│   │ ▌ [✓]  CORRECT · 7 IN A ROW                                       C4     │  │
│   └───────────────────────────────────────────────────────────────────────────┘  │
│   ┌ ⌨ No MIDI keyboard — answer with the on-screen keys or A W S E D … ───────┐  │ (conditional)
│   └───────────────────────────────────────────────────────────────────────────┘  │
│   ┌ keyboard bed (§4) ────────────────────────────────────────────────────────┐  │ ⑥
│   │ ▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│   │  │
│   └───────────────────────────────────────────────────────────────────────────┘  │
│  [Space] replay · [Enter] skip & reveal · [Esc] end · piano keys [A W S E D …]    │ ⑦ 40px
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 ② The status rail (52 px)

A full-bleed band, not a chamfered panel: `--grad-panel`, a 1 px `--panel-border` bottom edge and
`--glow-panel` downward only — the same treatment as the top bar, so the two read as one stack of
chrome. It is the **one** element that survives focus mode.

| Slot | Treatment |
| --- | --- |
| Exercise title | 20 px `--font-display`, **sentence case** (uppercase stops at 20 px, part 1 §4.2), `--text-1`. It is the `<h1>`. |
| Question progress | The `ProgressBar` primitive, ~200 px wide, `label="Answered"`, `readout="7/10"`. In `/session` the same bar is `label="Time"`, `readout="4:12"`, value = elapsed / total (UX §4.1 ②). |
| Streak | Micro-label `STREAK` + tabular value in `--font-display`. No emoji (§2.7). At streak ≥ `STREAK_CALLOUT` (5) the value takes `--warn` **and** the drill speeds up and says so in the feedback line — the colour is never the only sign. |
| Accuracy | Micro-label `ACCURACY` + tabular `92%` / `—`. `--cyan` for the value (a live numeric readout, part 1 §2.1), `--text-3` for the em dash. |
| `⚙` / `⤢` | 44 px icon buttons: `--bg-2`, 1 px `--border` → `--panel-border-hot` on hover/focus, `--chamfer-sm`, inline SVG (`IconSettings`, `IconExpand` — §10.2), `aria-label` spelled out, `aria-pressed` on `⤢`. `⚙` opens per-exercise settings **inline** (UX §6.3), never a dialog. |

Both readouts are `MicroLabel` + value, i.e. the §4.4 HUD readout at readout scale — the strip is
52 px, so no well and no glow: label 12 px over value 18 px, `--text-2` label / `--text-1` value.

### 5.3 ③ The prompt well

The reference's `CURRENT NOTE C4` treatment is exactly our prompt (part 1 §4.4, which reserved it
for this pass). The prompt region *becomes* the readout well — it costs no extra height because
UX §4.1 already reserves min 140 px:

- Well: `--bg-well`, 1 px `--border`, `--chamfer-lg`, `--inset-top`, no glow, full content width
  (max `--content-max`), centred text, padding `--space-5`.
- **Phase micro-label**, top-left, hot (`--cyan` + `--glow-text`) only while something is live:
  `READY` · `LISTEN` · `ANSWER` · `RESULT` · `PAUSED` (new label copy — §10.1; `LISTEN` and `ANSWER`
  are the hot ones).
- **Title**: `Question.prompt.title`, `--fs-prompt` (56 px, a floor), `--font-display` 700,
  UPPERCASE via `text-transform`, `--track-heading`, `--text-1`, `text-shadow: var(--glow-text)`.
  A chord-symbol prompt takes `--fs-display` (72 px). In focus mode the title is `--fs-display`.
- **Subtitle**: `Question.prompt.subtitle`, `--fs-h1` (per the implemented runner) in
  **`--font-sans`, sentence case**, `--text-2`. Body copy never goes uppercase and never goes
  display (part 1 deviations 5–6) — the subtitle is a sentence from the copy deck.
- Prompt text still cross-fades over `--dur-fast` (UX §4.2). The well itself never animates.

### 5.4 ④ Replay

The 240 × 64 primary control of the screen, from the `Button` primitive, `size="drill"`:

| Phase | Variant | Label | Glyph |
| --- | --- | --- | --- |
| `idle` | **`go`** (mint, outlined, `--glow-success`) | `Start` | `▶` |
| `presenting` (playing) | `secondary`, disabled (45 % opacity, no glow) | `Playing…` | `▶` |
| everything else | `secondary` | `Replay` | `▶` |

`Start` is the one "go" affordance the reference draws in mint, and it appears exactly once per
drill. The `Space` keycap (`Chip variant="key"`) sits inside the button after the label, unchanged.
Clicking still blurs the button so `Space` cannot double-fire (UX §4.5).

### 5.5 ⑤ The feedback slot

88 px, reserved, **always in the DOM, never a box when empty** — an always-drawn empty well would
read as a hole and an appearing panel would shift the eye. When feedback exists, it renders as a
state strip inside the reserved space:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ▌ [✓]  CORRECT · 7 IN A ROW                                          C4   │
└───────────────────────────────────────────────────────────────────────────┘
  ↑ 4px left edge bar in the state colour (a spec-fixed literal, part 1 §5.10)
     ↑ 32px GlyphBadge, tone = state       ↑ 32px display UPPERCASE  ↑ detail: 18px sans --text-2
```

- Face `--bg-2`, `--chamfer-md`, one `--glow-*` of the state colour, centred in the slot, max
  content width 720 px.
- Headline: `FeedbackLines.headline` at `--fs-feedback` (32 px), `--font-display` 700, UPPERCASE,
  `--track-heading`, in the state colour (`--success` 12.05 / `--danger` 7.02 / `--hint` 7.40 on
  `--bg-1`).
- Detail: `FeedbackLines.detail` — 18 px `--font-sans`, sentence case, `--text-2`. It carries
  `Space to continue`, verbatim.
- Glyph: `✓` / `✗` / `⤳` inside a `GlyphBadge` with the matching tone. The glyph is the signal; keep
  it even though the headline is also coloured.
- Entry: 120 ms fade + 4 px rise (UX §4.2), unchanged, and **nothing else in the answer path
  animates**.
- The `role="status" aria-live="polite"` announcement region and its wording are unchanged (UX §8.4).

### 5.6 ⑥ Answer area and the conditional strips

- `PianoKeyboard` per §4, `maxHeightPx` from the space the flex column leaves (unchanged logic).
- `choice` mode (slice 6+): the choice buttons are `Button variant="secondary"`, min 200 × 88 px,
  24 px display UPPERCASE label, the number `1`–`9` as a `Chip variant="key"` in the top-left
  corner. In feedback the chosen wrong button goes `--danger` + `✗` and the correct one `--success` +
  `✓`, simultaneously (UX §4.4). `note-sequence` slots are `--bg-well` `--chamfer-sm` cells with
  `◻`/the note name; `chord-sustained`'s settling line is a 2 px `--accent` line under the rail.
- No-MIDI strip (UX §4.6) and sound strip: `--bg-2` face, `--chamfer-md`, a 4 px left edge bar
  (`--warn`), an icon in a `GlyphBadge` (`IconKeyboard` — §2.7), the message in 16 px `--font-sans`
  `--text-1` **verbatim from the copy deck**, then `Connect MIDI` (`Button secondary`) and `Got it`
  (`Button ghost`). No glow: information, not furniture (part 1 §5.10). Still never a dialog, still
  dismissible for the session only.

### 5.7 ⑦ Shortcut bar (40 px)

14 px `--text-3` `--font-sans`, centred, keys as `Chip variant="key"` keycaps — including the
`A W S E D F T G Y H U J K` mapping whenever no MIDI device is connected. Hidden in focus mode.
It is the manual: never abbreviate it, never move it into a tooltip.

### 5.8 Focus mode, and the glow budget

Focus mode (UX §4.7): the top bar goes hidden-but-focusable, the shortcut bar goes, the rail stays,
the prompt goes to `--fs-display`, the keyboard to its max height. With the chrome gone the screen
is nearly all texture and two glows — which is the intended "instrument mode" look.

Glow count on a full runner: rail (1) + replay (1) + feedback strip (1) + the strips when present
(0 — they have none) = **3 `drop-shadow` layers**, plus however many keys are lit, which are
`box-shadow` and cost no filter layer (§4.2). Comfortably inside part 1 §7's ≤ 12.

---

## 6. `/play` — Free Play

**Unchanged**: the regions (title, lede, strips, readout, keyboard, computer-key hint, metronome),
the settling rule for the live region (`ANNOUNCE_SETTLE_MS`, 700 ms — a summary per settled hand,
never per note-on), all copy.

```
FREE PLAY                                                           ← --fs-h1 display UPPERCASE
Play anything — your notes sound and light up here. Press [M] to mute.  ← 16px sans --text-2

┌ --bg-well, --chamfer-lg, 1px --border ─────────────────────────────────────────┐
│ CURRENT CHORD                                                    (hot label)   │
│                                                                                │
│                            Cmaj7                                               │  72px display
│                    C4 · E4 · G4 · B4        also C6/9 · Em7                    │  18px / 14px
└────────────────────────────────────────────────────────────────────────────────┘
┌ keyboard bed (§4), 61 keys ────────────────────────────────────────────────────┐
└────────────────────────────────────────────────────────────────────────────────┘
Computer keys [A W S E D F T G Y H U J K] play from C4 upwards; [Z] / [X] shift the octave.

┌ METRONOME ─────────────────────────────────────────────────────────────────────┐
│ ▶ START   − [ 90 ] bpm +   Beats per bar [ 4 ▾ ]   ◆ ◇ ◇ ◇                      │
└────────────────────────────────────────────────────────────────────────────────┘
```

- **The readout is the reference's `CURRENT NOTE` HUD readout** (part 1 §4.4), built as the same
  well as the runner's prompt so the two screens feel like one instrument: hot micro-label,
  `--fs-display` value in `--font-display` 700 with `--glow-text`, secondary line in `--cyan`.
  - Hot micro-label: `CURRENT NOTE` while 0–1 notes are held, `CURRENT CHORD` with 2 or more
    (§10.1). It is live, so it is the hot variant.
  - Value: the detected chord name, else the held note names, else the idle copy `Play a chord` in
    `--fs-h1` `--text-3` (**not** uppercase, **not** glowing — it is a sentence, and nothing is
    live). Height is reserved as today so the keyboard never moves.
  - Second line: held note names, tabular, `--cyan` (a live numeric/HUD readout); the
    `also …` alternatives stay 14 px `--text-3`.
- **No input/level meter.** The reference draws an equalizer here; we have no signal to put in it —
  `midiInput.held` is a set of pitches, not a level, and a bar row driven by nothing is exactly the
  fake waveform part 1 deviation 8 forbids. A velocity meter would need `midiInput` to expose
  per-note velocity: that is a product question (is touch feedback a feature?), not a re-skin, and
  it is not ticketed. Recorded as deviation 18.
- Keyboard: §4, 61 keys, `played` highlights only — the parent never plays audio itself (the root
  layout routes every event to the engine).
- Metronome panel: a `HudPanel` with the header band `METRONOME`. Start/stop is `Button` (`go` when
  stopped, `secondary` when running, glyphs `▶` / `■`); tempo is the §5.11 field with `−`/`+` 44 px
  secondary buttons; beats-per-bar is a §5.11 select. The beat pips are **diamonds** like
  `MasteryPips` (part 1 §5.5) but numbered: the running beat is filled `--grad-primary` with
  `--on-accent` ink *and* larger, the downbeat is outlined — size and number, never colour alone.
  The visible beat still follows in `requestAnimationFrame`; the click may not wait for it.
- Sound strip and no-MIDI strip: §5.6's skin, copy verbatim.

---

## 7. `/progress`

**Unchanged**: UX §6.1's content and order — the title with `Export JSON`, the four numbers, the
28-day strip, then one panel per exercise with a wrapping grid of skill cells, `Drill these`, the
hover detail line, the empty state. Mastery is still 7 pips + the percentage everywhere (§6.2).

```
PROGRESS                                                        [ EXPORT JSON ]
┌ TODAY ──────────────────────────────────────────────────────────────────────────┐
│  STREAK        ATTEMPTS       DUE NOW           ╭─────╮                         │
│  9 days        412            12 due            │ 84% │  ← Ring, --grad-data    │
│                                                 ╰─────╯     ACCURACY (7D)       │
│  ▁▂▅▃▇▆█▅▂▃▆█▇▄▂▅▇█▆▃▁▂▅▇█▆▃   LAST 28 DAYS  ← Meter, 28 bars, today capped     │
└─────────────────────────────────────────────────────────────────────────────────┘
┌ INTERVALS ──────────────────────────────────────────── 68% · [DUE 4] ───────────┐
│  m2 ◆◆◆◆◆◇◇ 79%   M2 ◆◆◆◆◆◆◆ 94%   m3 ◆◆◆◆◇◇◇ 58%   M3 ◆◆◆◆◆◆◇ 83%             │
│  P5 ◆◆◆◆◆◆◆ 97%   m6 ◆◆◇◇◇◇◇ 24% !  M6 ◆◆◆◆◇◇◇ 55%  TT ◆◆◇◇◇◇◇ 22% !           │
│                                                            [ DRILL THESE ]      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- Screen title `--fs-h1` display UPPERCASE; `Export JSON` is a `Button secondary` (one click, no
  dialog, filename `piano-trainer-YYYY-MM-DD.json` — unchanged).
- **Top panel**: `HudPanel` with the header band `TODAY`. The three counters are HUD readouts
  (micro-label + `--fs-h1` tabular display value, `--glow-text`); `12 due` keeps the word `due` and
  `--warn`. The 28-day strip is the `Meter` primitive (`markIndex` = today), no axes, no legend, no
  tooltip.
- **The headline accuracy becomes the `Ring`** (part 1 §5.6 exists for exactly this): same datum,
  same label, new treatment — 120 px, `--grad-data` arc, the number in the centre, caption
  `accuracy (7d)`, `role="img"` with a spelled-out name. It never sweeps on load (only the session
  summary does).
- **One panel per exercise**, header band = the exercise title, with **one** trailing control on the
  band (part 1 §5.8): the `NN% · DUE n` readout, where `DUE n` is a `Badge tone="warn"`.
  `Drill these` is a `Button secondary` at the panel's bottom-right.
- **Skill cells**: 140 px fixed-width cells in a wrapping grid (so the eye scans columns),
  each = skill name (14 px `--font-sans` `--text-2`, abbreviated as §9 of the copy deck allows in
  dense grids) + `MasteryPips` + tabular percentage in `--font-display`. Weak (`mastery < 0.3` and
  ≥ 3 attempts) adds `!` in `--warn` (§2.3). Hover/focus reveals the 13 px `--text-3` detail line
  (`12 attempts · 67% · last seen 2 h ago · due in 3 h`) — fills the space it already reserves.
- **A panel with more than 8 skill rows scrolls internally and therefore does not chamfer**
  (part 1 §3.1). Pick chamfer by content, not by habit.
- Empty state: the copy deck's `No attempts yet. Practice something and this fills up.` in a well,
  plus a `▶ Practice now` primary button. Never an empty chart frame, never an empty ring.
- **No "Recent activity" panel.** The reference has one; we do not have that region and this pass
  adds no region (deviation 19). The `ListRow` primitive earns its keep on the Settings device list
  and the session summary instead.

---

## 8. `/settings`

**Unchanged**: one page, four sections with the `id` anchors `#midi`, `#sound`, `#practice`, `#data`
(the top-bar chips deep-link to them), every control applies immediately, no Save button, no dialogs,
the inline range wizard, the inline `RESET` confirmation.

```
SETTINGS
┌───────────┐  ┌ MIDI ────────────────────────────────────────────────── #midi ──┐
│▌MIDI      │  │ INPUT DEVICE  [ Roland FP-30            ▾ ]  ╭● MIDI CONNECTED╮ │
│ SOUND     │  │ [ RESCAN DEVICES ]                                             │
│ PRACTICE  │  │ ┌ preview keyboard, 72 px, non-interactive ──────────────────┐ │
│ DATA      │  │ └────────────────────────────────────────────────────────────┘ │
└───────────┘  │ Play a key — it lights up here as well as in Free play.        │
 ↑ sticky rail │ KEYBOARD RANGE  A0 ──────────────── C8        [ RUN WIZARD ]   │
   ≥ 1100 px   │ NOTE LABELS  ( none | C only ● | white | all )                 │
               └───────────────────────────────────────────────────────────────┘
```

### 8.1 Section panels and the sticky rail

- Each section is a `HudPanel` with a header band carrying the section name as a micro-label and the
  anchor id on the panel. Max width `--content-max`; the `#practice`/`#data` panels keep their
  60 ch measure for readable prose.
- **Sticky section nav (UX §6.3's "sticky section nav on the left at ≥ 1100 px", never built)**:
  at ≥ 1100 px the page is a two-column grid — a 160 px rail plus the panels, `--space-6` gap. The
  rail is `position: sticky; top: calc(var(--topbar-h) + var(--space-5))`, a `--chamfer-md` `--bg-1`
  panel containing four anchor links in the micro-label style, 44 px tall each: resting `--text-2`,
  hover `--text-1`, **active `--text-1` + a 2 px `--accent` left bar with `--glow-accent`** (the
  nav-active rule of part 1 §6, rotated 90°). Active follows the section in view (one
  `IntersectionObserver`, `rootMargin` biased to the top) and falls back to `location.hash`; the
  links are plain anchors, so keyboard and deep links work with the observer switched off.
  Below 1100 px the rail is not rendered — the sections are in DOM order and the top-bar chips still
  deep-link. **[amends §6.3]** only in that it fixes the rail's width, offset and active rule; the
  behaviour is the spec's.
- Every field is part 1 §5.11: `--bg-well` field, 1 px `--border` → `--panel-border-hot` on focus,
  `--chamfer-sm`, 44 px, label above in the micro-label style, help text below in 14 px `--text-3`.
  Sliders take the `--grad-data` fill and the 20 px `--chamfer-sm` thumb; the radio groups
  (`Note labels`, `Count-in`) are §5.11 segmented controls, arrow keys included.
- The inline state next to a select is the top-bar status pill's smaller sibling: glyph + state word
  in the **state colour** as a micro-label, device name in 14 px `--font-sans` `--text-2`. Copy is
  `midiChip()` / `soundChip()`, verbatim.

### 8.2 Gap 1 — what the device `<select>` says before access is requested

Today the select is disabled with the single option `No device found` whenever `devices.length === 0`
— which is a lie before `requestMIDIAccess` has ever run: we have not looked. The select's
placeholder becomes a function of `MidiStatus`, in `$lib/midi/status.ts` (all MIDI wording lives
there), and the rest of the row follows it:

| `MidiStatus` | Select | Option text | Row action |
| --- | --- | --- | --- |
| `idle` (never requested) | disabled | `Connect MIDI to list devices` | `Connect MIDI` (primary path) |
| `requesting` | disabled | `Looking for devices…` | `Connect MIDI`, disabled |
| `granted`, 0 inputs | disabled | `No device found` | `Rescan devices`, plus the copy deck's `No MIDI input found. Plug your piano in and switch it on — it appears automatically.` |
| `granted`, ≥ 1 input | enabled | `None` + one option per device | `Rescan devices` |
| `denied` | disabled | `MIDI blocked` | no request button; the copy deck's `MIDI access was blocked…` and the `#midi` link |
| `unsupported` | disabled | `MIDI unavailable` | no button; the copy deck's `This browser has no Web MIDI…` |

The four sentences are the copy deck's, verbatim. The six option strings are new **labels** (§10.1).
A disabled select still shows its current option, so the state is never blank.

### 8.3 Gap 2 — the preview keyboard is 72 px **[amends §6.3]**

UX §6.3's wireframe says "live preview keyboard (48 px tall, non-interactive)"; the implementation
ships 72 px. **72 px wins** and the spec is amended: at 49 keys a 48 px-tall keyboard puts the white
keys at ~7 px of visible face, the `c-only` labels below the 12 px floor, and the whole point of the
preview — "press a key, see that we hear it" — becomes unreadable from the bench. 72 px keeps the
labels at 12 px and the bed's apron legible. The preview stays `interactive={false}`,
`layout={49}`, `highlights` = whatever is held.

### 8.4 Gap 3 — the tempo field can display a value the metronome does not have

`onchange` clamps through `metronome.setTempo()`, but the `<input type="number">` keeps whatever was
typed, so the field can read `400` while the metronome runs at 300 (and `8` while it runs at 30).
The field is a **display of the committed value**, so:

1. Commit on `change` **and** on blur, as now — never on `input` (clamping mid-typing would rewrite
   `1` to the minimum before the `20` arrives).
2. After committing, **write the committed value back into the field**
   (`event.currentTarget.value = String(metronome.bpm)`). The field and the engine can never
   disagree once the user has left it.
3. While the typed value is outside `MIN_BPM`–`MAX_BPM`, the field takes `aria-invalid="true"`, a
   1 px `--warn` border and a 12 px `--warn` hint below it: `30–300 bpm` (§10.1 — the numbers come
   from the scheduler's constants, not from the copy).
4. `Escape` in the field reverts it to `metronome.bpm` and leaves the tempo alone.
5. The `−` / `+` nudges are unchanged: they call `setTempo` with the clamped value, so they are
   always in range.

### 8.5 Gap 4 — the `#data` section (slice 5)

`Export JSON` / `Import JSON…` are `Button secondary`, side by side; the stats line
(`412 attempts · 37 skills · 1.2 MB · last export 3 days ago`) is 14 px `--text-3`, tabular. Import
results are banners, verbatim copy. `Reset all practice data` is the one `Button danger`, and its
confirmation is **inline**: the button reveals a §5.11 field labelled `Type RESET to confirm`, the
danger button stays disabled until the field matches, and a ghost `Cancel` closes it. No
`confirm()`, no dialog — ever. A nudge to export first sits above it in 14 px `--text-2`.

---

## 9. `/session` — the mixed session and its summary

**Unchanged**: `/session` is the same runner frame driven by the planner (UX §4), and the summary is
a **full screen that replaces the runner**, not a modal.

- Session runner: §5 exactly, with two differences the spec already fixes — the rail's title shows
  the *current* exercise and its `ProgressBar` shows **time remaining** (`label="Time"`).
- `Esc` ends the session and goes to the summary (UX §4.5).

```
                        SESSION COMPLETE · 10:04

           ╭───────╮      ANSWERS        CORRECT       BEST STREAK
           │  89%  │      64             57            14
           ╰───────╯   ← Ring, one --dur-slow sweep (the only sweep in the app)
             SCORE

┌ SKILLS TOUCHED ─────────────────────────────────────────────────────────────┐
│ [▲] Intervals        ◆◆◆◆◆◆◇  68%                              +6%          │
│ [▼] Chord quality    ◆◆◆◇◇◇◇  41%                              −2%          │
└─────────────────────────────────────────────────────────────────────────────┘
┌ --bg-well ──────────────────────────────────────────────────────────────────┐
│ Weakest: minor 6th up  (4 of 9)                                             │
└─────────────────────────────────────────────────────────────────────────────┘
        [ ▶ PRACTICE AGAIN  (Space) ]        [ DONE  (Esc) ]
```

- Title: `Session complete · {mm:ss}` verbatim, `--fs-h1` display UPPERCASE.
- `Ring` with `sweep` — the single one-off `--dur-slow` animation the motion budget allows, dropped
  under `prefers-reduced-motion`. Three HUD readouts beside it.
- Per-skill deltas are `ListRow`s in a `HudPanel` (header band `SKILLS TOUCHED`): the glyph badge
  holds `▲`/`▼` in `--success`/`--danger`, the lead is the skill name, the meta is the signed delta,
  tabular — **direction is shown by the triangle and the sign, not by colour** (UX §4.8). Max 6
  rows, sorted by |delta| descending, only skills touched this session. Rows must be DOM siblings or
  the primitive's hairline separator vanishes (see its doc comment).
- Weakest line: a well, sentence case, 18 px `--text-2`.
- Buttons: `▶ Practice again` is the `primary` (with its `Space` keycap), `Done` is a `ghost` with
  its `Esc` keycap. Both are ≥ 64 px: the user is still at the piano.
- The `?` help sheet (UX §4.5) is the app's only scrimmed surface: a bottom sheet, `--bg-1`,
  `--chamfer-lg`, `--shadow-pop`, `--bg-scrim` behind it, dismissed by any key. It is not a modal
  dialog in the blocking sense and it is still forbidden while an exercise is running.

---

## 10. What this pass adds outside CSS

### 10.1 New copy — labels only, and where each one lives

The copy deck (UX §9) is unchanged: not one sentence was edited, added or removed. The HUD language
needs **micro-labels**, which the deck never had because the old language had no readouts. They are
words, not sentences, and they belong in the pure modules that already own wording — never in a
component.

| Label(s) | Where it lives | Why it is new |
| --- | --- | --- |
| `READY` `LISTEN` `ANSWER` `RESULT` `PAUSED` | a pure phase → label map next to `runner.svelte.ts` (or `feedback.ts`), unit-tested | The prompt well's hot micro-label (part 1 §4.4 requires one) |
| `ANSWERED` `TIME` `STREAK` `ACCURACY` | the runner's rail | Readout captions (part 1 §4.4) |
| `CURRENT NOTE` `CURRENT CHORD` | `/play` | The reference's readout caption, quoted by part 1 §4.4 |
| `TODAY` `SKILLS TOUCHED` `METRONOME` `MIDI` `SOUND` `PRACTICE` `DATA` `SCORE` `LAST 28 DAYS` | the screen that draws the panel | Panel header bands; the four Settings ones are the §6.3 section names already on screen |
| `Connect MIDI to list devices` `Looking for devices…` `MIDI blocked` `MIDI unavailable` | `$lib/midi/status.ts` | §8.2's select placeholders |
| `30–300 bpm` `Type RESET to confirm` | the metronome panel / `#data` | §8.4, §8.5 field hints |

Every one of them is set with `text-transform: uppercase`, so the DOM text — and the accessible name
— keeps its real casing (part 1 §9.3). Note for e2e authors: Chromium folds `text-transform` into
the accessible name, so `getByRole(..., { name })` on uppercased text needs a case-insensitive regex.

### 10.2 Icons pass 2 needs

Inline SVG Svelte components in `$lib/components/icons/`, 24 px box, 1.5 px stroke, round caps,
`stroke: currentColor`, `fill: none`, `aria-hidden`, always beside a real label. Existing:
`IconKeyboard`, `IconPlay`, `IconWave`. To add: **`IconSettings`** (gear, the rail's `⚙`),
**`IconExpand`** (the rail's `⤢` — an addition to part 1 §4.5's list, which omitted it),
**`IconMidi`** (plug), **`IconVolume`** / **`IconMute`**, **`IconChart`** (progress), and
**`IconChevron`** (disclosure). Nothing else: no icon is added for decoration, and the state glyphs
(`✓ ✗ ◆ ◇ ⤳`) stay as text because they are copy.

---

## 11. Contrast — everything this document asserts, measured

sRGB ratios, flat colours, glow ignored (part 1 §9.1: a glow never substitutes for contrast).

| Pairing | Ratio | Verdict |
| --- | --- | --- |
| `--key-ink` on `--grad-key-white` (top `--key-white` / bottom `--key-white-hover`) | 15.57 / 13.52 | AAA |
| `--text-2` on `--grad-key-black` (top `--key-black-hover` / bottom `--key-black`) | 9.79 / 10.87 | AAA |
| `--focus` on `--key-white` | **1.19** | **fails** — hence §2.1's dual-tone ring |
| `--focus` on `--bg-0` (the ring's dark keyline) | 13.92 | AAA |
| `--bg-0` keyline on `--key-white` | 16.56 | AAA |
| `--on-success` / `--on-danger` / `--on-hint` ink on their fills | 12.82 / 7.47 / 7.87 | AAA |
| `--on-accent` (white) on `--grad-primary` stops | 4.65 / 8.62 | AA / AAA |
| `--success` / `--danger` / `--hint` fill against `--key-bed` | 12.54 / 7.30 / 7.69 | non-text pass |
| `--grad-primary` dark stop against `--key-bed` | 2.30 | below 3 — the press offset and the gradient's light stop carry it |
| `--hint` 3 px ghost inset on `--key-white` | 2.11 | below 3 — **`◇` is mandatory** and carries the state |
| `--text-1` / `--text-2` / `--text-3` on `--bg-well` (the readout wells) | 18.02 / 11.09 / 6.21 | AAA / AAA / AA |
| `--cyan` on `--bg-well` / `--bg-1` | 11.43 / 10.99 | AAA |
| `--warn` on `--bg-well` / `--bg-1` / `--bg-2` | 12.36 / 11.89 / 10.79 | AAA |
| `--success` / `--danger` / `--hint` / `--accent` on `--bg-1` (feedback headline) | 12.05 / 7.02 / 7.40 / 6.89 | AAA / AAA / AAA / AA-large, and 32 px here |
| `--panel-border-hot` on `--bg-0` / `--bg-1` | 4.10 / 3.85 | non-text pass (part 1's 3.11 / 2.92 understated it) |
| `--border` on `--bg-1` | 1.46 | decorative only, as designed |

Greyscale check stays part of done: with `filter: grayscale(1)`, the runner's correct/wrong/reveal
states, the keyboard's six highlights, `due`/`!`/`new`, and the summary's ▲/▼ must all still be
distinguishable. They are, because each carries a glyph or a word.

---

## 12. Definition of done for developer pass 2

Not a slice plan — a checklist for the implementation ticket.

1. `tokens.css` re-copied byte-for-byte from `docs/design/tokens.css` (§3: two gradients added, the
   light block gone), and the light branches removed from `hud.css` and `app.css`.
2. Runner: rail, prompt well, phase micro-label, replay variants, feedback strip, strips, shortcut
   bar, focus mode. **Every drill-rhythm constant still lives in `runner.svelte.ts`** and no timing
   changed.
3. `PianoKeyboard`: bed + apron, key gradients, glow-by-`box-shadow` states, 16 px glyphs, the
   dual-tone key focus ring. Props, geometry, precedence, roving focus and the announcement rules
   unchanged; its component tests still assert the highlight classes and the a11y rules.
4. Free Play: the `CURRENT NOTE` well, the metronome panel as a `HudPanel`. No meter.
5. Settings: four `HudPanel`s, the sticky rail ≥ 1100 px, §5.11 fields, and the four gaps in
   §8.2–§8.5 closed (the select placeholders in `$lib/midi/status.ts`, with unit tests).
6. `ProgressBar` ramp fix (§2.4) with a test that the ramp layer is full-track width.
7. `/progress` and `/session` land with their slices (5 and 9) **in this language** — the sections
   here are their brief, not pass-2 work, except for the `Ring`/`Meter`/`ListRow` usages pass 2 can
   already exercise.
8. No new raw hex or magic px outside `tokens.css` (bar the cited literal exemptions); no primitive
   re-implemented in a screen; `pnpm lint check test build` green; greyscale and 200 %-zoom checks
   done on the runner.

---

## Deviations from the reference (continuing part 1's list)

16. **The keyboard gets no separate octave ruler with text.** The apron's cyan ticks mark the C's;
    the octave *names* stay on the keys themselves (`labels: 'c-only'`). Two places naming C4 is one
    too many, and the runner's vertical budget has no room for a text rail.
17. **A lit key glows with `box-shadow`, not `filter: drop-shadow`.** The reference's keys bloom
    heavily; ours light with a tight, static glow that stays outside the ≤ 12 drop-shadow budget so a
    ten-note chord cannot cost ten composited layers (§4.2).
18. **No input/level meter in Free Play.** We have pitches, not a level; a meter driven by nothing is
    part 1 deviation 8's fake waveform in another costume. Revisit only if per-note velocity becomes
    a product feature (§6).
19. **No "Recent activity" panel on `/progress`.** The reference has one; our progress screen's
    content is UX §6.1's, and this pass adds no region. `ListRow` is used on the Settings device list
    and the session summary instead (§7).
20. **The status rail is not chamfered.** Like the top bar it is full-bleed chrome; chamfering a
    full-width band draws a notch into the page edge (§5.2).
21. **The prompt is a sunken well, not a floating panel.** The reference floats its big readouts on
    glowing cards; at 56 px, centred, with a 88 px feedback slot below, a second glowing panel in the
    middle of the runner competes with the answer. The well recedes and the type carries it (§5.3).
22. **No emoji.** The reference has none either; we had 🔥. Emoji ignore the display face, every
    colour token and greyscale (§2.7).
23. **No light theme.** Part 1 deviation 15 kept `[data-theme='light']` as a legibility fallback;
    this pass drops it as dead, unverified code (§2.5). The HUD language is dark-only.
