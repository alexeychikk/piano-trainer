# Visual language — "HUD" sci-fi re-skin (part 1: tokens, surfaces, components, shell, home)

- **Status**: Accepted, v1 (2026-09-14)
- **Scope**: the visual language of the whole app — palette, surfaces, typography, iconography,
  motion, and every shared component in its new skin — plus the re-skin of the app shell and the
  home screen.
- **Out of scope**: the exercise runner, `PianoKeyboard`, Free Play, Progress, Settings and
  `/session`. Those are **part 2**, a separate ticket. The tokens here are already sized to carry
  them; no new token should be needed for part 2 beyond two-hand colours (UX spec §11).
- **Authority**
  - [`ADR 0001`](../decisions/0001-target-architecture-and-stack.md) wins on architecture,
    vocabulary and contracts.
  - [`core-practice-ux.md`](core-practice-ux.md) **still wins on behaviour, layout, information
    architecture, states and copy**. Nothing in this document moves a region, adds a screen,
    renames a route, or changes a word of copy.
  - **This document supersedes `core-practice-ux.md` §7** (palette, type, elevation, motion
    *values*). Where §7 and this file disagree on a colour, a size or a shadow, this file wins.
  - [`tokens.css`](tokens.css) is the machine-readable half of this document and is the only place
    raw values live.
- **Reference**: [`reference/sci-fi-reference.png`](reference/sci-fi-reference.png) — committed so
  this spec survives the link dying.

---

## 1. How to read the reference

The owner supplied one screenshot of a fictional "JAZZFLOW" piano dashboard and clarified
(2026-09-14):

> The screenshot is more about the design system, it's not about the layout. I want you to follow
> the style on the screenshot as close as possible, not the layout, screenshot just showcases
> everything together.

So the reference is a **component and token sheet that happens to be arranged as one dashboard**.

| We copy (high fidelity) | We do not copy |
| --- | --- |
| Near-black navy ground + faint circuit/scanline texture | The left icon sidebar — we keep our top bar |
| Panel anatomy: chamfered corners, 1 px luminous edge, soft outer glow, wide-tracked uppercase header band | The reference's grid, hero composition, right column |
| Palette family: deep navy, electric blue, cyan, violet/magenta, mint-green for "go" | Its screen structure and information architecture |
| Gradient CTA with a glyph; outlined mint "go" button | Lessons / Jam Tracks / Sound Studio / Library — **not product scope, never spec or build them** |
| Chips, badges, status pills, list rows with glyph badges | Its content and labels (our copy deck is unchanged) |
| HUD readouts (the big `CURRENT NOTE C4` treatment) | Its knobs/skeuomorphic controls |
| Bar / ring / waveform / equalizer data-viz styling, neon key treatment | Its "particles" hero artwork |
| Uppercase squarish headings, wide-tracked micro-labels | |

Every colour below was **sampled from the PNG** (`PIL`, per-region dominant-hue histograms), then
nudged only where WCAG demanded it. The sampled anchors, for the record:

| Sampled from the reference | Value | Became |
| --- | --- | --- |
| Page background | `#000610`–`#000D1E` | `--bg-0 #01060F` |
| Panel interior | `#000C1B`–`#010E21` | `--bg-1 #041020` / `--grad-panel` |
| Resting panel edge | `#01346B` | `--panel-border #0C3F70` |
| CTA gradient | `#1B6BFF` → `#1030D8` | `--grad-primary #2A6BF5 → #1030D8` |
| Light-blue body text | `#7098F8`, `#E5F9FE` | `--text-1`, `--text-2` |
| Micro-label / HUD cyan | `#04B0FC`, `#D0F4FC` | `--cyan #35D6F5` |
| "MIDI CONNECTED" mint | `#00A880`, `#0CF5C9` | `--success #19E8B6` |
| Progress-bar violet | `#A07CFC` | `--hint #B48CFF` |
| Equalizer magenta | `#D07CFC` | `--magenta #E06AFF` |
| Level-bar amber | `#F8B030` | `--warn #FFC24D` |

---

## 2. Colour system

Full values and contrast ratios live in [`tokens.css`](tokens.css). This section says what each
role *means*; do not pick a token by how it looks.

### 2.1 Roles

| Token | Role — the only thing it may mean |
| --- | --- |
| `--bg-0` | The page. Nothing else is this dark except a sunken well. |
| `--bg-1` | A panel / card / the top bar. Painted with `--grad-panel`, not flat, on panels ≥ 200 px tall. |
| `--bg-2` | Something raised **on** a panel: chip, secondary button, input, segmented control. |
| `--bg-well` | Something **sunken into** a panel: a HUD readout, a bar/ring track, the keyboard bed, a code/export box. |
| `--border` | A non-luminous hairline: dividers inside a panel, empty mastery pips, table rules. |
| `--panel-border` | The resting luminous edge of a panel. Decorative — never the only cue for anything. |
| `--panel-border-hot` | A luminous edge that **means** something: hovered/focused card, active panel, status-pill outline, key outline. ≥ 3:1, so it is allowed to carry meaning. |
| `--accent` | Primary action, links, the `played` key state. |
| `--accent-deep` | Only a gradient stop or a pressed CTA. Never text, never a 1 px line. |
| `--cyan` | HUD furniture: micro-labels that need emphasis, live numeric readouts, rules, the cool end of the data ramp. **Not** an action colour — `--accent` is. |
| `--success` | Correct · "go" · MIDI connected · mastery ≥ 0.7. |
| `--danger` | Wrong · destructive · MIDI blocked. |
| `--warn` | Due · attention · degraded (synth fallback, sound off). |
| `--hint` | Target and ghost notes, reveals, the answer after a miss. |
| `--magenta` | **Data-viz only** — the hot end of `--grad-data-hot`. It never carries meaning on its own, so it needs no contrast guarantee. |

`--on-*` tokens give the ink for a filled surface of that colour. `--on-accent` is **white**
(4.65:1 on the lightest `--grad-primary` stop) — this is the one role that changed sign from the
old palette, where filled accents took `--bg-0` ink.

### 2.2 Never colour alone (unchanged, still binding)

UX spec §8.1 is unchanged and this palette makes it *more* necessary: in greyscale `--success`
(L 0.61) and `--warn` (L 0.60) are indistinguishable, as are `--accent` (0.33), `--danger` (0.34)
and `--hint` (0.36). The glyph is the signal; the colour is the accelerator.

| State | Colour | Glyph — mandatory |
| --- | --- | --- |
| correct | `--success` | `✓` |
| wrong | `--danger` | `✗` (+ shake) |
| target | `--hint` | `◆` |
| ghost | `--hint` outline | `◇` |
| due | `--warn` | the word `due` |
| weak | `--warn` | `!` |
| played | `--accent` | key depresses 2 px |
| connected | `--success` | `●` filled |
| degraded | `--warn` | `⚠` |

### 2.3 The data ramp

Every quantitative visual in the app — mastery bars, the accuracy ring, the level bar, the MIDI
level meter, the waveform, the sparkline — is painted with **one** gradient, `--grad-data`
(cyan → blue → violet, left to right / 0 % → 100 % of the arc). Consequences:

- A value's colour is a function of **how far along it is**, not of what it measures. Two bars at
  62 % look identical; that is the point, it makes a column of bars scannable.
- `--grad-data-hot` (violet → magenta) is reserved for **over-target / peak** segments: a level
  meter above 0 dB, an equalizer peak, a streak beyond the goal.
- The track underneath is always `--bg-well` with a 1 px `--border` inset.
- Never tint a bar by category (the reference does; see Deviations).

---

## 3. Surfaces and chrome

### 3.1 Panel anatomy

The panel is the one surface primitive. Everything that is not the page background is a panel, a
chip on a panel, or a well in a panel.

```
        ┌ 1px --panel-border, glow --glow-panel ──────────────────────┐
        │ ╭ header band: --grad-header, 32px tall ─────╮              │  ← optional
        │ │ MASTERY            (12px/600/--track-label)│              │
        │ ├────────────────────────────────────────────┴────────────╮ │  ← 1px --border rule
        │ │                                                         │ │
        │ │   body, --grad-panel, padding --space-5                 │ │
        │ │                                                         │╱ │  ← 14px chamfer
        │ ╰─────────────────────────────────────────────────────────╯  │
        ╰╱─────────────────────────────────────────────────────────────┘
          ↑ 14px chamfer (bottom-left)
```

| Property | Value |
| --- | --- |
| Silhouette | Rectangle with **two opposite 45° corner cuts**: top-right and bottom-left. `--chamfer-lg` (14 px) for panels, `--chamfer-md` (10 px) for cards/buttons/pills, `--chamfer-sm` (6 px) for chips and badges. |
| Edge | 1 px `--panel-border`; `--panel-border-hot` when hovered, focused, active or carrying a live state. |
| Fill | `--grad-panel` (a 2 %-lighter top). Flat `--bg-1` is fine below 200 px tall. |
| Glow | `--glow-panel` outside; `--inset-top` inside the top edge. `--glow-panel-hot` on the hot state. |
| Header band | 32 px, `--grad-header`, label in the micro-label style (§4.3), closed by a 1 px `--border` rule. Optional — a card with a 20 px title does not get one. |
| Padding | `--space-5` (24 px); `--space-4` in cards under 320 px wide. |

**Chamfer recipe.** `clip-path` clips the border away on the diagonal, so a chamfered panel is two
elements — an edge layer and a face layer inset by 1 px:

```css
.hud-panel {
  --cut: var(--chamfer-lg);
  --poly: polygon(
    0 0,
    calc(100% - var(--cut)) 0,
    100% var(--cut),
    100% 100%,
    var(--cut) 100%,
    0 calc(100% - var(--cut))
  );
  clip-path: var(--poly);
  background: var(--panel-border); /* becomes the 1px edge */
  filter: drop-shadow(0 0 10px rgb(28 116 184 / 0.35)); /* glow follows the cut */
}
.hud-panel__face {
  clip-path: var(--poly);
  background: var(--grad-panel);
  box-shadow: var(--inset-top);
  margin: 1px;
}
```

`filter: drop-shadow` is used instead of `box-shadow` **only on chamfered elements**, because
`box-shadow` would draw the glow around the unclipped rectangle. It is one composited layer per
panel; keep the blur ≤ 10 px (see §7).

**When not to chamfer.** Anything smaller than ~64 px wide, anything that repeats more than ~30
times on screen (piano keys, equalizer bars, mastery pips, sparkline bars), and anything inside a
scroll container. Those use `--radius-sm`/`--radius-md` and a plain 1 px border. Fidelity is not
worth 88 extra clip-paths.

**Corner rail (decorative, optional).** The reference doubles some panel edges with a short bright
line offset 3 px outside the top edge, running about 20 % of the width from the chamfered corner.
Implement as a single `::before` with `--grad-rule`, `height: 1px`. Droppable; never carries meaning.

### 3.2 The page background

Three cheap layers on `<body>`, painted once, never animated:

```css
body {
  background-color: var(--bg-0);
  background-image:
    var(--texture-vignette),
    repeating-linear-gradient(
      0deg,
      var(--texture-scanline) 0 1px,
      transparent 1px var(--texture-scanline-size)
    ),
    linear-gradient(var(--texture-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--texture-grid-line) 1px, transparent 1px);
  background-size:
    100% 100%,
    100% var(--texture-scanline-size),
    var(--texture-grid-size) var(--texture-grid-size),
    var(--texture-grid-size) var(--texture-grid-size);
  background-attachment: fixed;
}
```

- The grid is a 48 px square lattice at ~5 % opacity — visible as atmosphere, invisible as content.
  Measured effect on body-text contrast: none, because the grid never lands on top of a panel.
- The scanline is a 1-in-3-pixel horizontal line at ~2 % opacity. **It is disabled under
  `prefers-reduced-motion: reduce`** (some users read it as flicker) and under `[data-theme='light']`.
- The reference's circuit-trace artwork (right-angle traces with node dots) is **not** reproduced as
  an image. If a later pass wants it, it is a single static inline SVG at ≤ 6 % opacity, behind
  everything, `aria-hidden`, and no larger than 20 KB — not a canvas, not animated.

### 3.3 Elevation

Four levels, still expressed as **edge + glow, not drop shadows** (a soft black shadow on `#01060F`
is invisible):

| Level | Use | Recipe |
| --- | --- | --- |
| 0 | page | `--bg-0` + texture |
| 1 | panel, card, top bar | `--grad-panel` + 1 px `--panel-border` + `--glow-panel` |
| 2 | raised on a panel: chip, button, input | `--bg-2` + 1 px `--border`; hover lifts the border to `--panel-border-hot` |
| −1 | sunken well: readout, bar track, keyboard bed | `--bg-well` + `inset 0 1px 0 rgb(0 0 0 / .5)` + 1 px `--border` |

`--shadow-pop` exists for exactly one thing, the `?` help sheet, which is also the only element
allowed a scrim (`--bg-scrim`). **No modal dialogs while an exercise is running** (UX spec §1) is
unchanged.

### 3.4 Focus

One rule, in `tokens.css`: `outline: 3px solid var(--focus)`, `outline-offset: 2px`, plus
`0 0 0 1px var(--bg-0)` (keeps the ring legible on white piano keys) and a 14 px cyan glow (makes it
legible at a metre). `:focus-visible` only. `--focus #7CE4FF` is 13.9:1 on the page and 3.4:1 on
`--key-white`, so it reads on both.

On a chamfered element `outline` follows the unclipped rectangle, which looks wrong. Chamfered
components therefore take the ring on the **edge layer** via a second `drop-shadow`:
`filter: drop-shadow(0 0 0 var(--focus)) drop-shadow(0 0 8px var(--focus))` — or, simpler and
preferred, they swap their edge layer's background to `--focus` and widen the face inset to 3 px.
Either is acceptable; pick one and put it in a single shared class.

---

## 4. Typography and iconography

### 4.1 Families

| Token | Stack | Use |
| --- | --- | --- |
| `--font-display` | `'Chakra Petch'` → `'Saira Condensed'` → `'Roboto Condensed'` → `'Arial Narrow'` → system | Uppercase headings, the prompt, HUD readouts, micro-labels, button labels, numerals in data-viz |
| `--font-sans` | system UI stack (unchanged) | All body copy, descriptions, settings, banners |
| `--font-mono` | system mono (unchanged) | Export payloads, device ids, debug |

**The display face is a stated new dependency.** Chakra Petch is SIL OFL, squarish, semi-condensed
and flat-terminalled — the closest widely-available open face to the reference's headings. Rules for
adding it:

- **Self-hosted**, in `apps/web/static/fonts/`. No Google Fonts link, no CDN: the app is
  offline-first and static, and a webfont request is the one thing that can make the first paint
  depend on the network.
- Two weights only (**500**, **700**), Latin subset, `woff2`, `font-display: swap`. Budget **≤ 60 KB
  total**; if the subset lands above that, drop weight 500 and synthesise nothing.
- `@font-face` goes in `apps/web/src/lib/styles/fonts.css`, imported next to `tokens.css`.
- The fallbacks are condensed on purpose: with the font missing, tracking and case still carry the
  look and **no layout shifts past `swap`** because display text is short and uppercase.
- If the developer would rather not add the asset in pass 1, shipping the fallback stack alone is an
  acceptable, recorded deviation — the rest of the language does not depend on it.

### 4.2 Scale

Sizes are unchanged from UX spec §7.2 (they were tuned for the bench posture, and the posture did
not change). What changed is **case, weight and tracking**.

| Token | Size / line-height | Family · case · weight · tracking |
| --- | --- | --- |
| `--fs-display` 72 | /1.05 | display · **UPPERCASE** · 700 · `--track-heading` — chord symbols, HUD readouts, focus mode |
| `--fs-prompt` 56 | /1.1 | display · UPPERCASE · 700 · `--track-heading` — runner prompt. **56 px is a floor, never go below it.** |
| `--fs-feedback` 32 | /1.2 | display · UPPERCASE · 700 · `--track-heading` — the `✓ / ✗` line |
| `--fs-h1` 28 | /1.2 | display · UPPERCASE · 700 · `--track-heading` — screen titles, hero label |
| `--fs-h2` 20 | /1.3 | display · Sentence case · 600 · `--track-none` — card titles |
| `--fs-body-lg` 18 | /1.45 | sans · sentence · 400 — prompt subtitle, nav |
| `--fs-body` 16 | /1.5 | sans · sentence · 400 — default |
| `--fs-small` 14 | /1.45 | sans · sentence · 400 — card descriptions, shortcut bar |
| `--fs-micro` 12 | /1.3 | display · **UPPERCASE** · 600 · `--track-label` — panel headers, badges, key labels. The floor; never smaller. |

- **Uppercase stops at 20 px.** Card titles, body copy, descriptions, banners and every sentence in
  the copy deck stay in sentence case. Uppercase is for *labels and headlines*, because uppercase
  body copy at a metre is slower to read, and the copy deck's voice ("a teacher's tone") is not
  shouty. This is a deliberate deviation from the reference, which uppercases more.
- Numbers that update in place (score, streak, percentages, tempo, Hz) keep
  `font-variant-numeric: tabular-nums` and use `--font-display`.
- Letter-spacing on uppercase is mandatory: without `--track-label`/`--track-hud` the squarish face
  reads as a solid block.

### 4.3 The micro-label

The single most characteristic element of the reference, used for every panel header, section label
and badge:

```
MASTERY            12px · display · 600 · UPPERCASE · --track-label (.18em) · --text-2
LIVE INPUT         the "hot" variant: --cyan + text-shadow: var(--glow-text)
```

Rules: 12 px minimum; never a full sentence; never more than ~24 characters; no trailing colon; the
hot (cyan + glow) variant only when the label names something that is *live right now*
(`LIVE INPUT`, `CURRENT NOTE`, `RECORDING`), never for a static section header.

### 4.4 HUD readout

The `CURRENT NOTE C4 · 261.63 Hz` treatment. A sunken well containing a hot micro-label, one large
display-face value, and an optional `--cyan` secondary value:

```
┌─────────────────────────────────────┐   --bg-well, 1px --border, --chamfer-md
│ CURRENT NOTE                        │   12px micro-label, hot variant
│                                     │
│  C4      261.63 Hz                  │   72px display 700 --text-1  ·  18px --cyan
└─────────────────────────────────────┘
```

Used in part 2 for the runner prompt and Free Play; specified here so the token set is settled.
The big value gets `text-shadow: var(--glow-text)` — a glow that is ~0.35 alpha cyan, which does
**not** reduce measured contrast because it sits outside the glyph.

### 4.5 Iconography

- **Inline SVG only.** No icon font, no icon package. 24 px box (20 px in chips), 1.5 px stroke,
  round caps and joins, `stroke: currentColor`, `fill: none`. Store them as Svelte components under
  `$lib/components/icons/`.
- The reference's icons sit in a **glyph badge**: a 32 px `--chamfer-sm` square, `--bg-2` fill,
  1 px border in the state colour at 40 % alpha, icon in the state colour. That badge is the
  list-row and nav primitive (§5.9, §6.1).
- Icons we actually need, one per route plus states: home, exercise/target, session/play, progress
  (bar chart), settings (gear), keyboard (piano), midi (plug), volume/mute, check, cross, diamond,
  lock, warning, chevron. Nothing else — no icon is added for decoration.
- Every icon is `aria-hidden="true"` and sits next to a real text label. The one exception, the
  icon-only button, needs `aria-label` and is discouraged at this screen distance.

---

## 5. Component catalogue

All of these already exist as concepts in `core-practice-ux.md`; this section only restates them in
the new language. Behaviour, copy and dimensions are unchanged unless a row says otherwise.

### 5.1 Buttons

| Variant | Fill | Edge | Label | Use |
| --- | --- | --- | --- | --- |
| **Primary** | `--grad-primary` | 1 px `rgb(124 228 255 / .55)` inner top highlight + `--glow-accent` | `--on-accent` white, display, UPPERCASE, `--track-hud`, 600 | One per screen: the hero, "Start", "Save & apply" |
| **Go** | transparent over `--bg-well` | 2 px `--success` + `--glow-success` | `--success`, display, UPPERCASE, `--track-hud` | "Start" on an exercise card, "Resume" — the affordance the reference draws in mint |
| **Secondary** | `--bg-2` | 1 px `--border` → `--panel-border-hot` on hover | `--text-1`, display, UPPERCASE, `--track-hud` | Everything else |
| **Ghost** | none | none; hover adds `--bg-2` | `--text-2` → `--text-1` | Dismiss, cancel, tertiary links |
| **Danger** | `--bg-2` | 1 px `--danger` | `--danger` | Delete practice data (Settings `#data`) |

Shared: `--chamfer-md` silhouette; height ≥ `--hit-min` (44 px), ≥ `--hit-drill` (64 px) in-exercise,
96 px for the home hero; horizontal padding `--space-5`; a leading glyph (▶, ✓, ⟲) for anything that
starts, confirms or replays; `:active` drops the gradient to `--accent-deep` and removes the glow
(a 1-frame "press"). Disabled = 45 % opacity, no glow, `cursor: default` — and we barely have any:
a locked exercise card is **not** disabled (UX spec §3).

### 5.2 Status pills (top bar)

The reference's `● MIDI CONNECTED · Roland FP-30 · ◯ 2.3 ms` bar is exactly our status-chip row, so
this is a straight re-skin. **The copy is unchanged — use UX spec §2.2 and §9 verbatim.**

```
╭───────────────────────────────────────────╮  --chamfer-md, --bg-2,
│ ● MIDI CONNECTED │ Roland FP-30           │  1px --panel-border-hot, --glow-panel
╰───────────────────────────────────────────╯
  ↑ state glyph    ↑ 1px --border divider
    + state colour   device name, 14px sans --text-2, truncated at 22 chars
```

- The state word (`MIDI CONNECTED`, `MIDI BLOCKED`, …) is the micro-label style in the **state
  colour**; the device name stays sentence-case sans in `--text-2`. That mirrors the reference,
  where the status is shouted and the device name is not.
- The glyph column is fixed width so the pills do not jitter when the state changes.
- The pill keeps its `<a href="/settings#midi">` semantics and its spelled-out accessible name
  (`MIDI: connected to Roland FP-30`).
- The "audio not started" pill is the one element allowed a loop: a 4 s opacity pulse on the glyph
  only (§7).
- We do **not** add the reference's latency readout. We do not measure latency, and inventing a
  number is worse than not having one.

### 5.3 Chips and badges

| Thing | Skin |
| --- | --- |
| **Chip** (chord symbol `C7`, shortcut `Space`, filter) | `--bg-2`, 1 px `--border`, `--chamfer-sm`, 14 px display, `--text-1`, padding `--space-2`/`--space-3` |
| **Badge** (level, `NEW`, `DUE`) | `--chamfer-sm` pill, 12 px micro-label, state colour text on a 12 %-alpha fill of the same colour, 1 px border at 40 % alpha |
| **Glyph badge** (list rows, nav) | 32 px `--chamfer-sm` square, `--bg-2`, 1 px state colour at 40 %, 20 px icon in the state colour |
| **Shortcut key** | `--bg-well`, 1 px `--border`, `--radius-sm`, 12 px display, `--text-3` — a keycap, not a chip |

A badge never uses colour alone: `DUE` is amber **and says "due"**, `NEW` is grey **and says "new"**.

### 5.4 Progress bar

```
SCALES                                          80%
╭──────────────────────────────────────────╮
│████████████████████████████████░░░░░░░░░░│   8px tall (--bar-h)
╰──────────────────────────────────────────╯
 fill: --grad-data, clipped to the value    track: --bg-well + 1px --border inset
 --radius-pill on both; 1px --cyan cap line at the fill's leading edge
```

- Label left (micro-label, `--text-2`), value right (14 px display, tabular, `--cyan`).
- The 1 px bright cap at the leading edge of the fill is the detail that makes it read as a HUD
  meter; it is `--cyan` at 80 % and it is decorative.
- `role="progressbar"` with `aria-valuenow/min/max` and an `aria-label` naming the skill.
- Width changes animate over `--dur-base`; they never animate inside the answer path.

### 5.5 Mastery pips — unchanged primitive, new skin

Still **7 pips, `Math.round(mastery * 7)` filled, always next to the percentage** (UX spec §6.2).
This is our progress vocabulary and the reference does not get to change it.

```
◆◆◆◆◆◇◇  71%
```

- `--pip-size` 10 px, `--pip-gap` 4 px. Filled pips take the mastery colour (`--success` ≥ 0.7,
  `--accent` 0.3–0.7, `--warn` < 0.3) plus a 6 px glow of the same colour at 45 % alpha; empty pips
  are `--bg-well` with a 1 px `--border`.
- Pips are **diamonds** in this language (a 45°-rotated square, `--radius-sm` corners) rather than
  circles — it echoes the chamfer and reads as a HUD segment bar. Same count, same meaning.
- Unchanged: `aria-label="Mastery 71 percent"`, `new` in words for unseen skills, no tooltip.
- Do **not** glow all seven; only the filled ones, or the row turns into a smear at a metre.

### 5.6 Circular ring

For a single headline percentage (accuracy today, session score).

- Two SVG circles: track `--bg-well` + 1 px `--border`, value stroke `--grad-data` applied via a
  `<linearGradient>`, `stroke-linecap: round`, `--ring-stroke` 10 px, rotated −90°.
- Centre: the number at `--fs-h1`/`--fs-display` in display 700 `--text-1` with `--glow-text`, and
  a micro-label caption under it.
- A soft `drop-shadow` glow on the value arc only; never animate the sweep on load (see §7) except
  once, over `--dur-slow`, on the session summary screen.
- `role="img"` with an `aria-label` that states the number and what it measures.

### 5.7 Meters, waveform, sparkline

One family, three sizes. All use `--meter-bar-w` 6 px / `--meter-bar-gap` 3 px bars with
`--radius-sm` tops, painted `--grad-data` **across the whole row** (so a bar's colour depends on its
x position, not its height), on a `--bg-well` bed.

| Thing | Bars | Notes |
| --- | --- | --- |
| Home sparkline (attempts, last 7 days) | 7 | Today's bar gets a 1 px `--text-1` cap. Static data; no axes, no legend, no tooltip (UX spec §3). |
| Level / input meter | 24–40 | Segments above the target use `--grad-data-hot`. |
| Waveform | — | **Only** where there is real audio data to show. We have none in v1, so **do not draw a decorative waveform.** See Deviations. |

### 5.8 Panel header

Covered in §3.1. The label is a micro-label; a header may carry one trailing control (a link, a
badge, a 24 px ghost icon button) right-aligned on the same 32 px band. Never two.

### 5.9 List row

The "Recent activity" pattern — our progress history and settings device list reuse it.

```
┌────────────────────────────────────────────────────────────┐
│ [✓]  Correct · Minor 6th                          2 min ago│  48px row
└────────────────────────────────────────────────────────────┘
  ↑ 32px glyph badge      ↑ 16px sans; the lead word is 600 --text-1,
    in the state colour     the rest --text-2         ↑ 14px display --text-3, tabular
```

- Rows are separated by 1 px `--border`; no zebra striping; hover/focus fills `--bg-2` and lifts the
  left 2 px edge to the state colour.
- Timestamps are right-aligned, tabular, and relative (`2 min ago`), truncating before the label does.
- A list of rows lives in a panel with a header band; more than 8 rows gets an internal scroll, and
  panels that scroll do not chamfer (§3.1).

### 5.10 Banner (unchanged behaviour, new skin)

UX spec §2.3 stands: one line, full width, under the top bar, dismissible, max two, oldest wins,
**never a dialog**. New skin: `--bg-2` face, `--chamfer-md`, a 4 px left edge bar in the state colour
(this is one of the literal px values the spec fixes — keep it literal in the component, per
`CLAUDE.md`), a 20 px state glyph, the message in 16 px sans `--text-1`, and a ghost `Dismiss`.
No glow — a banner is information, not furniture.

### 5.11 Inputs, selects, sliders, segmented controls

- Field: `--bg-well`, 1 px `--border`, `--chamfer-sm`, 16 px sans `--text-1`, 44 px tall,
  `--space-3` padding. Focus takes the standard ring; the border goes `--panel-border-hot`.
- Label above in the micro-label style; help text below in 14 px `--text-3`.
- Slider: 4 px `--bg-well` track with a `--grad-data` filled portion, a 20 px `--chamfer-sm` thumb in
  `--bg-2` with a 1 px `--accent` edge and `--glow-accent`.
- Segmented control (the 5/10/20 min length picker): a `--chamfer-md` `--bg-well` group, 1 px
  `--border`; the selected segment takes `--grad-primary` and `--on-accent` ink; arrow keys move the
  selection (unchanged).
- Toggle: a 44×24 `--radius-pill` track, `--bg-well` off / `--grad-go` on, 1 px border, and a
  **text state** next to it (`On` / `Off`) — never colour alone.

### 5.12 Piano keys — direction only (part 2 owns this)

The tokens are set so part 2 can do the reference's neon treatment without new values:
white keys `--key-white` on a `--key-bed` trough, black keys `--key-black`, a played key filled
`--accent` with `--glow-accent`, a target key `--hint` with `--glow-hint` and its `◆`. Highlight
precedence (wrong > correct > target > played > ghost > dim), geometry, labels and the 2 px press
offset are unchanged from UX spec §5 and are **not** re-specified here.

---

## 6. App shell

**The shell layout does not change.** No left sidebar — the owner asked for style, not layout, and
the top bar is tuned for the bench posture. `core-practice-ux.md` §2.1 still describes the structure;
this is only the skin.

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ ⌁ PIANO-TRAINER   PRACTICE  PROGRESS  FREE PLAY  SETTINGS   ╭●MIDI CONNECTED╮ ╭🔊╮ │ 56px
└────────────────────────────────────────────────────────────────────────────────────┘
  ↑ wordmark: 18px display  ↑ nav: 16px display UPPERCASE --track-hud     ↑ status pills §5.2
    UPPERCASE --track-label   active = --text-1 + 2px --accent underline
    --text-1, mark in --cyan  + --glow-accent on the underline; rest --text-2
```

- Top bar: `--grad-panel`, 1 px `--panel-border` bottom edge, `--glow-panel` downward only, sticky,
  56 px (`--topbar-h`). It is a panel, but **not chamfered** — it is full-bleed.
- Wordmark: the `♪` becomes a 20 px inline-SVG waveform mark in `--cyan` with `--glow-text`;
  the word `PIANO-TRAINER` in display 700 uppercase `--track-label`, `--text-1`. Links to `/`.
- Nav: uppercase display, `--track-hud`, 16 px. Active route = `--text-1` + a 2 px `--accent`
  underline with `--glow-accent`; the rule for which route is active is unchanged (`nav.ts`).
  Hover = `--text-1`, no underline. No pills — the reference's filled nav pill is a sidebar idiom
  and would be heavy in a row.
- Focus mode (UX spec §4.7) is unchanged: the bar is hidden-but-focusable; hiding it also hides its
  glow, so the runner goes fully dark.
- Routes are still exactly six: `/`, `/practice/[exerciseId]`, `/session`, `/progress`, `/settings`,
  `/play`. **Nothing from the reference's nav (Lessons, Jam Lab, Sound Studio, Library) exists or
  will be created.**

---

## 7. Motion and performance

Audio scheduling runs on the main thread through `PulseScheduler`; a janky frame is an audible
problem. The rules:

| Allowed | Not allowed |
| --- | --- |
| Discrete transitions of `opacity`, `transform`, `background-color`, `border-color` ≤ `--dur-slow` | Any looping animation except the two below |
| The bar/ring fill width/`stroke-dashoffset` over `--dur-base` | Animating `filter`, `box-shadow`, `clip-path` or `background-position` |
| The "audio not started" glyph pulse — opacity, 4 s cycle, one element | Canvas/WebGL, particles, animated grid or scanlines |
| The active-route underline glow, if it is a static `box-shadow` | Sweeping a ring on every render (once, on the summary, is fine) |
| One `--dur-slow` ring sweep on the session summary | Anything at all in the **answer path** (highlights are class swaps, §5) |

- Glow is `filter: drop-shadow` or `box-shadow` set **statically**. Static glows are painted once;
  animating them re-rasterises every frame.
- Total simultaneous `drop-shadow` layers on a screen: **≤ 12**. That is roughly "every panel plus
  the focused control". Small repeated elements (pips, keys, meter bars) use one glow on their
  container, not one each.
- `prefers-reduced-motion: reduce` sets every duration to 1 ms (tokens), drops the scanline layer,
  drops the pulse and the ring sweep, and removes the key-press translate. Everything is still
  distinguishable because every state carries a glyph.
- The reference's decorative motion (particles, moving waveform, animated traces) is **not**
  implemented. See Deviations.

---

## 8. Home screen (`/`) in the new language

The content, the regions and their order are **exactly** `core-practice-ux.md` §3 — hero + length
control on the left, Today card on the right, exercise-card grid under "Or drill one thing". The
copy is the copy deck, verbatim. Only the treatment changes:

| Region (UX spec §3) | Treatment |
| --- | --- |
| Hero button (96 px, max 640 px) | Primary button (§5.1): `--grad-primary`, `--chamfer-md`, `▶` glyph, label in display 700 UPPERCASE `--fs-h1` `--track-hud`, white ink, `--glow-accent`. Sub-label keeps the `Space` shortcut keycap (§5.3). |
| Title + "12 skills due today" | Title `--fs-h1` display UPPERCASE; the due line stays sentence-case sans `--text-2`, with the count in `--warn` — it is a number, not a shout. |
| Length segmented control | §5.11 segmented control. |
| Today card | Panel with header band `TODAY`. The three numbers become HUD readouts (§4.4) at `--fs-h1`, tabular, `--text-1` with `--glow-text`; their labels are micro-labels. The 7-day sparkline is the §5.7 meter. |
| Exercise cards (320×140) | Cards: `--grad-panel`, `--chamfer-md`, 1 px `--panel-border` → `--panel-border-hot` + `--glow-panel-hot` on hover/focus. Title 20 px display **sentence case** 600; description 14 px sans `--text-2`; mastery pips (§5.5) + `NN%`; `N due` as a `--warn` badge; `new` as a grey badge. A "Go" button (§5.1) appears on hover/focus **only as decoration of an already-clickable card** — the whole card stays the link. |
| Locked card | Unchanged behaviour (still clickable, 60 % opacity, lock glyph, reason spelled out). The glow is dropped, not the border. |
| `Needs a MIDI keyboard` | 14 px `--text-3` sans, with the keyboard icon. Unchanged copy. |
| Empty state | Unchanged copy and structure; the "How this works" note sits in a well (§3.3, level −1) instead of the Today card. |
| Pre-slice-9 hero | Unchanged: reads `▶ Practice`, starts the first registered exercise, due line hidden. |

Nothing is added: no waveform panel, no hero artwork, no "quick access" grid, no level bar, no
achievements. Those are reference furniture with no product behind them.

---

## 9. Accessibility (binding, and re-verified for this palette)

Everything in `core-practice-ux.md` §8 stands. Re-measured for the new values:

| Pairing | Ratio | Verdict |
| --- | --- | --- |
| `--text-1` on `--bg-0` / `--bg-1` | 18.43 / 17.32 | AAA |
| `--text-2` on `--bg-0` / `--bg-1` | 11.34 / 10.66 | AAA |
| `--text-3` on `--bg-0` / `--bg-1` / `--bg-2` | 6.35 / 5.97 / 5.42 | AA (body), AAA-large |
| `--accent` on `--bg-0` | 7.33 | AAA |
| `--cyan` on `--bg-0` | 11.69 | AAA |
| `--success` / `--warn` on `--bg-0` | 12.82 / 12.64 | AAA |
| `--danger` on `--bg-0` | 7.47 | AAA |
| `--hint` on `--bg-0` | 7.87 | AAA |
| `--focus` on `--bg-0` / on `--key-white` | 13.92 / 3.43 | AAA / AA non-text |
| `--on-accent` white on `--grad-primary` (lightest stop `#2A6BF5`) | 4.65 | AA |
| `--key-ink` on `--key-white` | 15.57 | AAA |
| `--panel-border-hot` on `--bg-1` | 2.92 → **use ≥ 2 px, or pair with a glyph** | see note |
| `--panel-border` on `--bg-0` | 1.83 | decorative only |

Note on `--panel-border-hot`: at 3.11:1 on `--bg-0` it satisfies the 3:1 non-text requirement on the
page background, but at 2.92:1 on a panel it is marginally under. A hot edge **inside** a panel must
therefore be 2 px, or accompanied by a glyph/label — never a 1 px hairline as the sole indicator.
Hover and focus always add the focus ring or a text change as well, so this is a belt-and-braces rule.

Additional rules this language introduces:

1. **Glow never substitutes for contrast.** Every ratio above is measured on the flat colour, with
   the glow ignored. If an element only reads because of its glow, it fails.
2. **Texture never crosses text.** The grid and scanline live on `<body>` only; panels are opaque.
3. **Uppercase is never applied to body copy** (§4.2) and is applied with `text-transform`, so the
   accessible name and the DOM text keep their real casing for screen readers.
4. Greyscale check is now part of the definition of done for any screen: `filter: grayscale(1)` in
   devtools, every state still distinguishable (§2.2).

---

## 10. Implementation notes

- **`tokens.css` is the only place values live.** Copy `docs/design/tokens.css` byte-for-byte to
  `apps/web/src/lib/styles/tokens.css` as the first commit of developer pass 1 — the two files are
  deliberately out of sync until then, and this document is the reason.
- The `CLAUDE.md` exemption for literal one-off pixels still applies (the 4 px banner edge bar, the
  2 px key press offset, the 3 px black-key radius): keep them literal, cite the spec section in a
  comment. Everything reusable — chamfers, glows, gradients, tracking, data-viz sizes — is a token.
- New shared primitives worth extracting in pass 1, before any screen uses them twice:
  `HudPanel` (edge + face + optional header band), `MicroLabel`, `Chip`/`Badge`/`GlyphBadge`,
  `Button` with the five variants, `ProgressBar`, `MasteryPips`, `Meter`, `ListRow`. They belong in
  `$lib/components/hud/`, which may import nothing but tokens and icons.
- Developer pass 1 covers: tokens, the font (optional), the background texture, the shell re-skin
  and the home screen. **Pass 2** covers the runner, `PianoKeyboard`, Free Play, Progress, Settings
  and `/session`, and is ticketed after design part 2 lands.
- Slices 5–10 continue in this language. Earlier slices are not re-opened beyond the two passes.

---

## Deviations from the reference

Recorded deliberately; each is a legibility, scope or performance call, not an oversight.

1. **Layout fidelity was not pursued at all.** Per the owner's clarification of 2026-09-14, the
   screenshot is a style showcase, not a screen blueprint. No screen was rearranged to resemble it.
2. **No left icon sidebar.** We keep the top bar from `core-practice-ux.md` §2.1, re-skinned. The
   bench posture and six flat routes do not need a sidebar, and the reference's filled nav pill is a
   sidebar idiom.
3. **The reference's feature panels do not exist**: Lessons, Jam Lab / Jam Tracks, Sound Studio,
   Library, achievements, XP, levels, "Suggested for you", the user chip. They are not product
   scope and no token, component or ticket was created for them.
4. **No latency readout** in the status pills. We do not measure round-trip latency; a fabricated
   `2.3 ms` would be a lie on screen.
5. **Uppercase stops at 20 px.** The reference uppercases card titles and some body copy. At a metre,
   uppercase sentences read slower, and the copy deck's voice is a teacher's, not a HUD's.
6. **Body copy stays in the system sans**, not the display face. Only labels, headings, numerals and
   button text use `--font-display`. A squarish techno face at 16 px over three lines is tiring.
7. **Data-viz is monochromatic-by-position, not by category.** The reference tints each skill bar a
   different hue (green / violet / amber / magenta). We use one `--grad-data` ramp for every bar so a
   column of skills is comparable at a glance — the same reason UX spec §6.2 quantises mastery into
   7 pips.
8. **No decorative waveform.** The reference draws waveforms where there is no signal. We draw a
   meter only where real data exists (attempts per day, MIDI input level). A fake waveform in an
   ear-training app is actively misleading.
9. **No particles, no animated traces, no moving grid.** Audio scheduling shares the main thread;
   continuous animation risks audible jank. Motion is limited to §7.
10. **The circuit-trace background artwork is reduced** to a flat 48 px grid plus a 2 %-opacity
    scanline. The reference's traces are a raster image; at our contrast budget they would be either
    invisible or noisy behind text.
11. **Panel glow is dimmer than the reference's.** Sampled edges are ~`#01346B` at rest with a large
    bloom; we keep the edge colour and cut the bloom radius to ≤ 10 px so ≤ 12 composited layers
    cover a screen.
12. **Mastery pips are diamonds, not circles, and there are still exactly 7.** The reference has no
    equivalent; the pip count and meaning come from `core-practice-ux.md` §6.2 and did not change.
13. **`--on-accent` is white, not `--bg-0`.** The reference's blue CTA has white ink; the old palette
    put dark ink on filled accents. White clears AA (4.65) on the lightest gradient stop.
14. **The display font is optional.** If pass 1 ships without self-hosting Chakra Petch, the
    condensed fallback stack carries the look at some cost in character (§4.1).
15. **Light theme drops the language.** `[data-theme='light']` keeps the token contract but zeroes
    every glow, gradient and texture. It remains a legibility fallback, not a design target
    (UX spec §11).
