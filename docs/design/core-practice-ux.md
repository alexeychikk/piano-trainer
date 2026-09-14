# UX spec — core practice experience (app shell + exercise loop)

- **Status**: Accepted, v1 (2026-09-13)
- **Scope**: the four v1 screens (home, exercise runner, progress, settings) plus Free Play, the
  piano-keyboard component, and the visual language. Everything a developer needs to build the shell
  and the exercise loop without inventing UX.
- **Out of scope** (do not design or build from this doc): repertoire, tunes, backing tracks,
  notation, mobile layouts, onboarding tours, theming beyond dark/light.
- **Companion files**: [`tokens.css`](tokens.css) — the design tokens below, ready to copy to
  `apps/web/src/lib/styles/tokens.css`.
- **Visual language (read after this document, before building)**:
  [`sci-fi-visual-language.md`](sci-fi-visual-language.md) — part 1: palette, panel anatomy, type,
  motion, the shared primitives, the shell and home. [`sci-fi-screens.md`](sci-fi-screens.md) —
  part 2: the exercise runner, `PianoKeyboard`, Free Play, Progress, Settings and `/session`, plus
  the three amendments it makes to this document (§6.3's preview-keyboard height and section nav,
  §11's light theme). Together they supersede §7 below; everything else here still wins.
- **Authority**: [`ADR 0001`](../decisions/0001-target-architecture-and-stack.md) wins on
  architecture, vocabulary and contracts. This spec wins on layout, states, copy and visuals.
  Deviations from the ADR are flagged inline as **[deviation]**.

---

## 1. The user and the posture

One user, one posture: an adult beginner sits at a MIDI digital piano, a desktop browser open on a
screen **0.8–1.2 m away**, **both hands on the keys**, often not looking at the screen at all. Design
consequences, applied everywhere in this document:

| Constraint | Rule |
| --- | --- |
| Read at ~1 m | Prompt type ≥ 56 px, feedback words ≥ 32 px, no body copy below 15 px anywhere. |
| Hands on keys | Every in-exercise action is on the **space bar**, **Enter**, **1–9**, or the MIDI keyboard. The mouse is optional for the whole practice loop. |
| Eyes on hands | State must be readable **peripherally**: position + colour + shape, big blocks, no tooltips, no toasts in the corner. |
| Drill, not quiz | Correct answers advance automatically; nothing waits for a click that the user cannot reach. |
| No interruptions | **No modal dialogs, no confirm boxes, no popovers while an exercise is running.** Warnings are one-line banners under the top bar; settings that matter mid-session are on-screen controls, not dialogs. |
| Sound is the content | The screen never carries information that was only audible — after a miss, the answer is shown *and* replayed. |

---

## 2. Information architecture and routes

Five routes, flat, no nested navigation. Names are final; use them verbatim.

| Route | Screen | Purpose | Slice |
| --- | --- | --- | --- |
| `/` | **Home / Practice now** | One primary action (start a session) + exercise list + today's numbers. | 1 (shell), 9 (session) |
| `/practice/[exerciseId]` | **Exercise runner** | Drill one exercise indefinitely. The workhorse screen. | 4 |
| `/session` | **Mixed session runner** | The same runner, driven by the spaced-repetition planner across exercises, for a chosen length. Ends on the session summary. **[deviation]** ADR §9 lists only `/practice/[exerciseId]`; a separate route avoids reserving a fake exercise id such as `now`. | 9 |
| `/progress` | **Progress** | Mastery per skill, streak, accuracy trend. | 5 |
| `/settings` | **Settings** | MIDI device + range wizard, sound, practice tuning, data export/import, appearance. | 2–5 |
| `/play` | **Free Play** | Silent-then-sounding sandbox: what am I holding, what chord is it. Also the "is my hardware working?" page. | 2 |

Navigation model:

- The **top bar** is on every screen and holds the nav. It is **hidden-but-focusable in `focus mode`**
  (see §4.7) so the runner is distraction-free.
- No breadcrumbs, no sidebars, no hamburger. Six destinations fit in one row.
- Deep links work (static site, `adapter-static`); all links go through `base` from `$app/paths`.
- Leaving a running exercise never prompts. The session state is disposable; attempts are already
  persisted per answer.

### 2.1 App shell

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ♪ piano-trainer   Practice  Progress  Free play  Settings   ● Roland FP-30  🔊 │  56px
├──────────────────────────────────────────────────────────────────────────────────┤
│  ⚠  Soundfont unavailable — using the built-in synth.                    Dismiss │  banner (conditional)
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                              ( screen content )                                  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- Height 56 px, background `--bg-1`, 1 px `--border` bottom, sticky.
- Left: wordmark (`♪ piano-trainer`, 18 px semibold) — links to `/`.
- Centre: nav links, 16 px, 12 px/16 px padding, active item gets `--text-1` plus a 2 px
  `--accent` underline; others `--text-2`.
- Right: **device chip** and **volume chip** (§2.2). They are status, not menus — clicking either
  goes to `/settings` and focuses the matching section.
- Content max width **1440 px**, centred, `--space-6` side padding; the keyboard area may go full
  width up to 1760 px (see §5.2).

### 2.2 Status chips (top bar, right)

| State | Dot | Label | Colour |
| --- | --- | --- | --- |
| Connected | ● filled | device name, truncated at 22 chars | `--success` |
| Several devices, none chosen | ◐ | `Choose MIDI device` | `--warn` |
| No device found | ○ hollow | `No MIDI device` | `--text-3` |
| Permission denied | ⊘ | `MIDI blocked` | `--danger` |
| Browser unsupported | ⊘ | `MIDI unsupported` | `--text-3` |
| Audio not started | 🔇 | `Click to enable sound` | `--warn`, pulses once per 4 s |

The chip is a `<a href="/settings#midi">` with an accessible name that spells the state out
(`MIDI: connected to Roland FP-30`). Never colour alone — the glyph differs per state.

### 2.3 Global banners (not dialogs)

One-line, full width, under the top bar, `--bg-2`, 4 px left border in the state colour, dismissible,
max two stacked (oldest wins). Used for: soundfont fallback, storage write failure, import result,
MIDI device disconnected mid-session. Never used for anything the user must answer.

---

## 3. Screen — Home / "Practice now" (`/`)

The only screen with a hero. Its job: get the user into a drill within one keypress.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ♪ piano-trainer   Practice  Progress  Free play  Settings    ● Roland FP-30  🔊  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   Ready to practise                                     ┌──────────────────────┐ │
│   12 skills due today                                   │  Today               │ │
│                                                         │                      │ │
│   ┌────────────────────────────────────────────────┐    │   48   attempts      │ │
│   │                                                │    │   87%  accuracy      │ │
│   │           ▶  Practice now      ( Space )       │    │   9    day streak    │ │
│   │                                                │    │                      │ │
│   └────────────────────────────────────────────────┘    │  ▁▃▅▂▇▆█ last 7 days │ │
│     [ 5 min ]  [ 10 min ]  [ 20 min ]  ← 10 min selected└──────────────────────┘ │
│                                                                                  │
│   Or drill one thing                                                             │
│   ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐  │
│   │ Find the note         │ │ Interval recognition  │ │ Chord quality         │  │
│   │ Pitch on the keyboard │ │ Hear the distance     │ │ maj7 · dom7 · min7 …  │  │
│   │ ●●●●●○○  71%          │ │ ●●●○○○○  38%   3 due  │ │ ○○○○○○○  new          │  │
│   └───────────────────────┘ └───────────────────────┘ └───────────────────────┘  │
│   ┌───────────────────────┐ ┌───────────────────────┐                            │
│   │ Play the voicing      │ │ ii-V-I progressions   │   ( needs a MIDI keyboard )│
│   │ Shells · rootless     │ │ Name the changes      │                            │
│   │ ●●○○○○○  22%          │ │ locked until chord    │                            │
│   └───────────────────────┘ │ quality reaches 60%   │                            │
│                             └───────────────────────┘                            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Specifics:

- **Hero button**: 100% of the left column (max 640 px), height **96 px**, 28 px semibold label,
  `--accent` background, `--bg-0` text, radius `--radius-lg`. Sub-label shows the shortcut chip
  `Space`. Pressing **space anywhere on `/`** starts the session; pressing a **MIDI key** does too
  (any note-on) — the user's hands are already on the piano.
- **Length segmented control** under the hero: 5 / 10 / 20 min, default 10, persisted in settings.
  Arrow keys move the selection.
- Before slice 9 exists, the hero reads **`▶ Practice`** and starts the first registered exercise;
  the "due" line is hidden. No placeholder that looks broken.
- **Today card**: three numbers at 32 px with 14 px `--text-2` labels, plus a 7-bar sparkline of
  attempts per day (bars `--accent`, today `--text-1`). No axes, no legend, no tooltip.
- **Exercise cards**: 320×140 px, `--bg-1`, 1 px `--border`, radius `--radius-md`, hover/focus lifts
  the border to `--accent`. Title 20 px semibold, one-line description 14 px `--text-2`, then the
  **mastery pips** (§6.2) and either `NN%`, `N due` (in `--warn`) or `new`.
- **Locked cards** (a later exercise gated by an earlier skill): 60 % opacity, lock glyph, the reason
  spelled out. Locking is advisory only — the card is still clickable and the runner still works;
  never block a user from their own instrument.
- `requiresMidi: true` exercises show `Needs a MIDI keyboard` in `--text-3` when no device is
  connected, and still open (the on-screen keyboard works, it is merely awkward).
- Empty state (no attempts ever): the Today card is replaced by a 3-line "How this works" note —
  *"Sit at your piano. Connect it, or use the on-screen keyboard. Answer by playing. Space replays
  the sound."* — and the hero reads `▶ Start your first session`.

---

## 4. Screen — Exercise runner (`/practice/[exerciseId]`, `/session`)

> **Visual treatment**: [`sci-fi-screens.md`](sci-fi-screens.md) §5 (runner), §9 (`/session` and the
> summary). The regions, dimensions, states, timings, shortcuts and copy below are unchanged.

One layout, every exercise, always. `ExerciseRunner.svelte` owns the frame; the exercise contributes
only the prompt text, the playback, and (optionally) an `AnswerComponent` rendered inside the answer
area.

### 4.1 Anatomy

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ♪ piano-trainer   Practice  Progress  Free play  Settings    ● Roland FP-30  🔊  │  ①
├──────────────────────────────────────────────────────────────────────────────────┤
│  Interval recognition          ■■■■■■■□□□  7/10      🔥 5     92%        ⚙  ⤢    │  ② status strip
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                        Which interval did you hear?                              │  ③ prompt
│                        Play it up from C4                                        │     (+ subtitle)
│                                                                                  │
│                         ┌──────────────────────────┐                             │  ④ replay
│                         │  ▶  Replay      Space    │                             │
│                         └──────────────────────────┘                             │
│                                                                                  │
│                   ┌──────────────────────────────────────┐                       │  ⑤ feedback slot
│                   │            (reserved 88 px)          │                       │     (never reflows)
│                   └──────────────────────────────────────┘                       │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│  ▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│▌│▌▌│▌│  │  ⑥ answer area
│  └───────────────────── on-screen / target keyboard ───────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│  Space replay · Enter skip & reveal · ⌫ clear · Esc end session                   │  ⑦ shortcut bar
└──────────────────────────────────────────────────────────────────────────────────┘
```

| # | Region | Height | Notes |
| --- | --- | --- | --- |
| ① | Top bar | 56 px | Hidden in focus mode (§4.7). |
| ② | Status strip | 52 px | Exercise title (18 px), question progress, streak, accuracy, settings toggle `⚙`, focus-mode toggle `⤢`. In `/session` the title shows the current exercise and the strip's progress bar shows **time remaining** instead of question count. |
| ③ | Prompt | min 140 px | Title 56 px semibold, centred; subtitle 24 px `--text-2`. For chord/progression prompts the symbol is the title (`C∆7`, 72 px). Exercise-supplied (`Prompt.title` / `subtitle`). |
| ④ | Replay | 64 px | Primary control, 240×64 px, `--bg-2` + 1 px `--accent` border, label `▶ Replay` + shortcut chip. Disabled (opacity .4) while playback is running. Replays increment `AttemptResult.replays`. |
| ⑤ | Feedback slot | **fixed 88 px, always reserved** | Empty during `awaiting`. Layout must never shift when feedback appears — that is what makes peripheral vision work. |
| ⑥ | Answer area | flexible, keyboard ≤ 280 px | `PianoKeyboard` (§5) for note/chord answers; choice buttons (§4.4) for `choice`; a custom `AnswerComponent` if the exercise ships one. |
| ⑦ | Shortcut bar | 40 px | 14 px `--text-3`, always visible (it is the manual). Contents adapt to `answerMode`. |

Vertical budget at 900 px viewport: 56 + 52 + 140 + 64 + 88 + 280 + 40 = 720 px, leaving ≥ 180 px of
breathing space distributed as `--space-6` gaps. At 1440×900 nothing scrolls — **the runner never
scrolls**; if the viewport is shorter than 700 px, drop the prompt subtitle, then shrink the keyboard,
then hide the shortcut bar, in that order.

### 4.2 States

The runner state machine (ADR §5) maps 1:1 to visual states. `t` is milliseconds from state entry.

| State | Prompt | Replay | Answer area | Feedback slot | Advance |
| --- | --- | --- | --- | --- | --- |
| `idle` | `Ready?` / `Press space to start` | dimmed | keyboard idle, all keys neutral | empty | space / any MIDI note → `presenting` |
| `presenting` | question prompt | active, shows `▶ Playing…`, spinner-free | keys inert; if the exercise reveals a root, it glows `--hint` | empty | auto → `awaiting` when playback ends |
| `awaiting` | question prompt | active | live: pressed keys light `--accent`; a subtle 2 px `--accent` progress line under the status strip counts the settling window for chord answers | empty | answer captured → `grading` |
| `grading` | unchanged | unchanged | keys freeze in the played state | empty | synchronous; ≤ 1 frame, no spinner |
| `feedback:correct` | unchanged | dimmed | played keys turn `--success` | ✓ **Correct** + the answer name | auto after **650 ms** |
| `feedback:wrong` | unchanged | active | played keys turn `--danger`; expected keys turn `--hint` outlined | ✗ **Minor 6th** + `You played a perfect 5th` + `Space to continue` | **waits** for space / Enter / any MIDI note-on |
| `feedback:reveal` (skipped) | unchanged | active | expected keys `--hint`, filled | ⤳ **Minor 6th** + `Skipped` | waits for space |
| `paused` | `Paused` | dimmed | keyboard dimmed 40 % | `Space to resume` | space |
| `summary` (session end) | see §4.8 | — | — | — | — |

**Transitions.** Prompt text swaps with a 120 ms cross-fade; feedback enters with a 120 ms fade +
4 px rise; the keyboard never animates position. No confetti, no sounds for correctness other than
the musical reveal.

### 4.3 Feedback timing (the thing that makes it a drill)

| Event | Timing |
| --- | --- |
| Answer captured → feedback shown | immediate (same frame). Grading is pure and synchronous. |
| Correct → next question **presenting** | **650 ms**. Long enough to register ✓, too short to break flow. |
| Correct in a streak ≥ 5 | **450 ms** — the drill speeds up as you get sharper. |
| Wrong → reveal audio | after **250 ms**, auto-replay the correct answer once (the user must *hear* the right thing while the wrong one is still in memory). |
| Wrong → next question | **only on user input** (space / Enter / MIDI note). No timeout: a miss is where learning happens. |
| Skip (Enter) | reveal + audio immediately, then same as wrong. |
| Replay (space during `awaiting`) | immediate, restarts the `PlaybackPlan`. |
| Chord answer settling | `CHORD_SETTLE_MS` (default 90 ms, ADR §3), visualised as the thin progress line. |
| Note-sequence answer | closes after `SEQUENCE_GAP_MS` 1200 ms of silence or at expected length. |
| Session auto-pause | after **90 s** with no input: state `paused`, audio stopped. |

Values live in one place: `$lib/exercises/runner.svelte.ts` as exported constants
(`FEEDBACK_CORRECT_MS = 650`, `FEEDBACK_STREAK_MS = 450`, `REVEAL_DELAY_MS = 250`,
`IDLE_PAUSE_MS = 90_000`), so tuning is a one-line change.

### 4.4 Answer input per `answerMode`

| `answerMode` | Answer area | Shortcut bar |
| --- | --- | --- |
| `single-note` | keyboard, live highlight; first note-on commits | `Space replay · Enter skip · Esc end` |
| `note-sequence` | keyboard + a row of "note slots" above it (`◻ ◻ ◻` filling with names as you play) | `+ ⌫ clear last` |
| `chord-sustained` | keyboard; held notes light up; settling line under the strip | `+ hold the chord to answer` |
| `chord-released` | keyboard; sounded notes stay lit until release commits | `+ release to answer` |
| `choice` | 2–5 big buttons in a row (or 2 rows of ≤ 4), each **min 200×88 px**, 24 px label, numbered `1`–`9` in the corner | `1–9 choose · Space replay · Enter skip` |

Choice buttons: `--bg-2`, 1 px `--border`, radius `--radius-md`; hover/focus → `--accent` border;
pressed → `--accent` fill. In `feedback`, the chosen wrong button turns `--danger` with the ✗ glyph
and the correct one turns `--success` with ✓ — both, simultaneously, so the correction is unambiguous.

**Number keys always work for choices**, even with MIDI connected — a laptop keyboard is within reach
of the piano; a mouse is not.

### 4.5 Keyboard shortcuts (global contract — same in every exercise)

| Key | Action | Where |
| --- | --- | --- |
| `Space` | replay the question / continue after feedback / start when idle / resume when paused | runner |
| `Enter` | skip & reveal | runner (`awaiting` only) |
| `1`–`9` | pick choice *n* | `choice` mode |
| `Backspace` | clear the answer in progress | `note-sequence` |
| `Esc` | end the session → summary (`/session`) or back to `/` | runner |
| `?` | toggle the shortcut help overlay (not a modal: a bottom sheet, dismiss with any key) | anywhere |
| `f` | toggle focus mode | runner |
| `m` | mute/unmute | anywhere |
| `,` | open settings | anywhere |

Rules: shortcuts are ignored while a text input has focus; `Space` must never also activate a focused
button (call `preventDefault`, handle at the document level, and blur buttons after click); repeat
(key-held) events are ignored.

### 4.6 "No MIDI device connected" — an explicit, non-blocking state

This is not an error. The app is fully usable without hardware; say so once and get out of the way.

On entering a runner with no device (or `denied` / `unsupported`), show a **strip above the answer
area**, 56 px, `--bg-2`, 4 px `--warn` left border — *not* a dialog, *not* a blocker:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ⌨  No MIDI keyboard — answer with the on-screen keys or A W S E D F T G Y H U J K │
│                                              [ Connect MIDI ]   [ Got it ]       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- `Connect MIDI` triggers `requestMIDIAccess` (must be a user gesture) and navigates to
  `/settings#midi` if it resolves with no inputs.
- `Got it` dismisses it for the session (`sessionStorage`), never permanently.
- Per-state copy:
  - `unsupported`: *"This browser has no Web MIDI. Chrome, Edge and Opera do — or play on-screen."*
  - `denied`: *"MIDI access was blocked. Re-allow it in the browser's site settings, or play
    on-screen."* + link to `/settings#midi`.
  - `granted, no inputs`: *"No MIDI input found. Plug your piano in and switch it on — it appears
    automatically."*
  - disconnected mid-session: a global banner *"Roland FP-30 disconnected — switched to the on-screen
    keyboard."* The session continues; the exercise does not know the difference.
- The computer-keyboard mapping is always live (`A W S E D F T G Y H U J K` = C…C of the movable
  octave, `Z` / `X` shift the octave down/up) and is shown in the shortcut bar whenever no MIDI device
  is connected.

### 4.7 Focus mode

`⤢` in the status strip, or `f`. Hides the top bar and the shortcut bar, keeps the status strip,
enlarges the prompt to 72 px and the keyboard to its max height. Chrome returns on `f`, `Esc`,
or when the pointer moves near the top edge. Persisted in settings. Never auto-enters.

### 4.8 Session summary (`/session` end, slice 9)

Not a modal — a full screen replacing the runner.

```
                         Session complete · 10:04

                  64 answers     89% correct     🔥 best streak 14

        Intervals        ●●●●●●○  +6%   ▲          Chord quality  ●●●○○○○  −2%  ▼
        Find the note    ●●●●●●●  +1%   ▲

                     Weakest: minor 6th up  (4 of 9)

               [ ▶ Practice again  (Space) ]     [ Done  (Esc) ]
```

Per-skill mastery delta only for skills touched this session, sorted by |delta| descending, max 6
rows. Direction is shown by both a triangle glyph and colour.

---

## 5. Piano keyboard component (`PianoKeyboard.svelte`)

> **Visual treatment**: [`sci-fi-screens.md`](sci-fi-screens.md) §4 — the bed, the octave apron,
> the lit key states and the **key-only focus ring** (§2.1: the global ring is invisible on a white
> key). Props, geometry, precedence, behaviour and a11y below are unchanged; glyphs are 16 px, as
> §5.3 always said (§2.6).

One component, two jobs (input surface + display surface), pure presentation: props in, `NoteEvent`s
out (ADR §3). It holds no exercise knowledge.

### 5.1 Props

```ts
interface PianoKeyboardProps {
  range: { low: Midi; high: Midi };       // clamped to a whole-key boundary, see 5.2
  layout?: 49 | 61 | 76 | 88 | 'range';   // preset or explicit range; default 'range'
  highlights?: Map<Midi, KeyHighlight>;   // display state per key
  labels?: 'none' | 'c-only' | 'white' | 'all';   // default 'c-only'
  labelStyle?: 'sharp' | 'flat' | 'context';      // 'context' = spelled by the current question
  interactive?: boolean;                  // default true; false = display only (no pointer/kbd input)
  computerKeys?: boolean;                 // default true when no MIDI device is connected
  maxHeightPx?: number;                   // default 280
}

type KeyHighlight =
  | 'played'    // the user is pressing it now            → --accent
  | 'correct'   // graded right                           → --success
  | 'wrong'     // graded wrong                           → --danger
  | 'target'    // the expected answer, revealed          → --hint, filled
  | 'ghost'     // a hint / given root / reference note   → --hint, outline only
  | 'dim';      // out of the exercise's range            → 40% opacity, not pressable
```

Precedence when several apply: `wrong` > `correct` > `target` > `played` > `ghost` > `dim`.

### 5.2 Geometry

Real-piano proportions, scaled to the container; never a fixed pixel width.

| Property | Value |
| --- | --- |
| White key width `W` | `floor(containerWidth / whiteKeyCount)`, clamped to **18 px ≤ W ≤ 48 px** |
| White key height | `min(6.2 × W, maxHeightPx)` → 112–280 px in practice |
| Black key width | `0.60 × W` |
| Black key height | `0.62 ×` white height |
| Key gap | 1 px `--bg-0` between white keys (drawn as a border, not a margin) |
| Corner radius | white: `0 0 4px 4px`; black: `0 0 3px 3px` |
| Container | centred; if `W` hits its 48 px cap the keyboard is narrower than the viewport — that is fine, it stays centred |

White-key counts: **49** keys = C2–C6 = 29 white; **61** = C2–C7 = 36; **76** = E1–G7 = 45;
**88** = A0–C8 = 52. At 1440 px content width: 61 keys → `W` = 40 px, height 248 px; 88 keys →
`W` = 27 px, height 167 px. Both are comfortably readable at 1 m.

**Black key placement.** Black keys are absolutely positioned, centred on the boundary between their
neighbouring white keys, then nudged by the table below (fractions of `W`) so the octave looks like a
real keyboard rather than a grid:

| Black key | Nudge from the boundary |
| --- | --- |
| C♯ | −0.12 `W` |
| D♯ | +0.12 `W` |
| F♯ | −0.15 `W` |
| G♯ | 0 |
| A♯ | +0.15 `W` |

**Range clamping**: a range must start on a white key and end on a white key; if `low`/`high` fall on
a black key, extend outward to the nearest white key. Keys outside the exercise's range but inside the
rendered keyboard get `dim`.

### 5.3 Visual states

| State | White key | Black key | Non-colour cue |
| --- | --- | --- | --- |
| idle | `--key-white` `#EDF1F5` | `--key-black` `#10151B` | — |
| hover (pointer only) | `#DCE3EA` | `#1A2028` | — |
| `played` | `--accent` fill, ink text | `--accent` fill, `--bg-0` text | key "depresses": `translateY(2px)` + inner shadow |
| `correct` | `--success` fill | `--success` fill | **✓ glyph** centred in the lower third of the key |
| `wrong` | `--danger` fill | `--danger` fill | **✗ glyph** + a 160 ms, 3 px horizontal shake |
| `target` | `--hint` fill | `--hint` fill | **◆ glyph**, plus a 2 px `--text-1` outline |
| `ghost` | key colour + 3 px inset `--hint` outline | same | ◇ hollow glyph |
| `dim` | 40 % opacity, `pointer-events: none` | same | — |

Glyphs are 16 px, `--bg-0` on filled keys, drawn in the bottom 24 px of the key where a hand does not
occlude the screen. **Every graded state carries a glyph** — colour is never the only signal (§8).

Label rendering: bottom-aligned, 12 px (`W` ≥ 32 px) or 10 px (below that), `--text-3` on white keys,
`--text-2` on black keys, hidden entirely on black keys when `labels: 'white'`. `c-only` shows `C4`,
`C5`, … on the C keys — the default, because octave orientation is what a beginner actually needs.

### 5.4 Behaviour

- **Pointer**: `pointerdown` → `note-on` (velocity fixed at 80), `pointerup`/`pointercancel`/
  `pointerleave` → `note-off`. Dragging across keys glissandos (note-off the old, note-on the new).
  Multi-touch is supported but not a design target.
- **Computer keys**: the mapping in §4.6; a pressed computer key renders identically to a pointer press.
- **MIDI notes outside the rendered range** still count as answers (they are real notes on the user's
  instrument); the keyboard shows an edge indicator — a 4 px `--accent` bar on the left or right edge
  with the note name — rather than silently swallowing them.
- The component **never plays audio itself**; the parent (Free Play or the runner) wires
  `NoteEvent → AudioEngine`, so exercises can keep the keyboard silent.
- Rendering: one `<svg>` or absolutely-positioned `<div>`s; highlights change via class only, so
  updating 10 keys is a class swap, not a re-layout. Budget: highlight visible within one frame of
  the MIDI event (ADR: 30 ms end-to-end for audio).

### 5.5 Accessibility

- The keyboard is a single `role="group"` labelled `Piano keyboard, C2 to C7`; each key is a
  `<button>` with `aria-label="C sharp 4"` and `aria-pressed`.
- **Not** in the tab order key-by-key (88 tab stops is hostile): the group takes one tab stop; arrow
  keys move a roving focus by semitone, `Home`/`End` jump to the range ends, `Enter`/`Space` play the
  focused key. Focus ring per §7.6.
- Highlight changes are announced on a **polite** live region as summaries, not per key
  (`Correct: E flat 4`, `Expected: C4, E4, G4, B flat 4`) — never per note-on, which would flood a
  screen reader during play.

---

## 6. Screens — Progress (`/progress`) and Settings (`/settings`)

> **Visual treatment**: [`sci-fi-screens.md`](sci-fi-screens.md) §7 (Progress) and §8 (Settings).
> §8 also **amends §6.3** on two points — the live preview keyboard is **72 px**, not 48 px, and the
> sticky section nav's width, offset and active rule are fixed there — and closes the two §6.3 gaps
> that were never specified: what the device `<select>` says before MIDI access is requested, and
> what the tempo field does with an out-of-range value.

### 6.1 Progress

Answers three questions in one screenful: *am I practising?*, *what is solid?*, *what should I fix?*
No charts beyond one sparkline and one heat strip.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ♪ piano-trainer   Practice  Progress  Free play  Settings    ● Roland FP-30  🔊  │
├──────────────────────────────────────────────────────────────────────────────────┤
│  Progress                                                        [ Export JSON ] │
│                                                                                  │
│   9 day streak      412 attempts      84% accuracy (7d)      12 due now          │
│   ▁▂▅▃▇▆█▅▂▃▆█▇▄▂▅▇█▆▃▁▂▅▇  last 28 days                                          │
│                                                                                  │
│   Intervals                                                       68% · 4 due    │
│   ┌────────────────────────────────────────────────────────────────────────────┐ │
│   │ m2 ●●●●●●○   M2 ●●●●●●●   m3 ●●●●○○○   M3 ●●●●●●○   P4 ●●●●●●●   TT ●●○○○○○│ │
│   │ P5 ●●●●●●●   m6 ●●○○○○○!  M6 ●●●●○○○   m7 ●●●●●○○   M7 ●●●○○○○   P8 ●●●●●●●│ │
│   └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                  [ Drill these ] │
│   Chord quality                                                   41% · 6 due    │
│   ┌────────────────────────────────────────────────────────────────────────────┐ │
│   │ maj7 ●●●●●○○  dom7 ●●●●○○○  min7 ●●●●●●○  m7b5 ●●○○○○○! dim7 ●○○○○○○!       │ │
│   └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                  [ Drill these ] │
│   Find the note                                                   71% · 0 due    │
│   …                                                                              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- Grouped by exercise; within a group one row per `SkillId`, laid out as a wrapping grid of
  fixed-width cells (140 px) so the eye can scan columns.
- `!` marks a skill with `mastery < 0.3` **and** ≥ 3 attempts — the "fix this" signal, rendered in
  `--danger` with the glyph, not by colour alone.
- `Drill these` starts `/practice/<exerciseId>` restricted to the group's due/weak skills.
- Row hover/focus reveals a 13 px `--text-3` line: `12 attempts · 67% · last seen 2 h ago · due in 3 h`.
- Empty state: *"No attempts yet. Practice something and this fills up."* plus a `▶ Practice now`
  button. Never an empty chart frame.
- Export/import lives here *and* in settings (the same component); export is one click, no dialog,
  filename `piano-trainer-YYYY-MM-DD.json`.

### 6.2 Mastery pips — the one progress primitive

Mastery (`SkillState.mastery`, 0..1) is shown **everywhere** as 7 pips, `Math.round(mastery * 7)`
filled. 10 px circles, 4 px gap, filled `--success` at ≥ 0.7, `--accent` at 0.3–0.7, `--warn` below
0.3; empty pips `--border`. Always paired with the numeric percentage nearby, and with an
`aria-label` `Mastery 68 percent`. Unseen skills render 7 empty pips plus the word `new`.

Why pips and not a bar: comparable at a glance across a grid, readable at 1 m, and quantised so tiny
EWMA wiggles do not look like progress.

### 6.3 Settings

One page, four sections with `id` anchors (`#midi`, `#sound`, `#practice`, `#data`), a sticky section
nav on the left at ≥ 1100 px. Every control applies **immediately** — no Save button, no dialogs.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Settings                                                                        │
│  ┌───────────┐                                                                   │
│  │ MIDI      │   MIDI                                                     #midi  │
│  │ Sound     │   Input device   [ Roland FP-30  ▾ ]        ● connected           │
│  │ Practice  │   Keyboard range  A0 ─────────────────────── C8    [ Run wizard ] │
│  │ Data      │   ┌── live preview keyboard (48 px tall, non-interactive) ──────┐ │
│  └───────────┘   └──────────────────────────────────────────────────────────────┘│
│                  Chord settle  50 ─────●──────── 200 ms   90 ms                  │
│                  Note labels   ( none | C only ● | white | all )                 │
│                                                                                  │
│                  Sound                                                    #sound │
│                  Instrument    [ Acoustic Grand Piano ▾ ]   ⟳ loading…           │
│                  Volume        ──────────●───── 72%       [ Test ♪ ]             │
│                  Metronome     tempo [ 90 ] bpm   count-in ( off | 1 bar ● )     │
│                                                                                  │
│                  Practice                                              #practice │
│                  Session length ( 5 | 10 ● | 20 ) min                            │
│                  Feedback pace  ( relaxed | normal ● | fast )                    │
│                  Auto-replay the answer after a miss   [ ● on ]                  │
│                  Per-exercise settings  ▸ Interval recognition                   │
│                                         ▸ Chord quality                          │
│                                                                                  │
│                  Data                                                     #data  │
│                  [ Export JSON ]  [ Import JSON… ]                               │
│                  412 attempts · 37 skills · 1.2 MB · last export 3 days ago      │
│                  [ Reset all practice data ]  ← type RESET to confirm, inline    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Range wizard**: inline, not a dialog. Pressing `Run wizard` turns the preview keyboard into a
  two-step prompt — *"Press your lowest key"* → *"Now your highest"* → *"A0 to C8. Saved."* with a
  `Cancel` next to it. Esc cancels.
- **Feedback pace** maps to the §4.3 constants: relaxed ×1.5, normal ×1, fast ×0.6.
- **Per-exercise settings** render from `settingsFields` (ADR §5) — the runner's `⚙` opens the same
  component inline in the status strip area, never as a modal.
- **Reset** is the only destructive control: inline confirmation (type `RESET`), with a nudge to
  export first. No `confirm()`.
- Import shows its result as a banner (`Imported 402 attempts, 37 skills.` / `This file is from
  schema v2; this app reads v1.`).

---

## 7. Visual language and design tokens

> **Superseded (2026-09-14) by [`sci-fi-visual-language.md`](sci-fi-visual-language.md).** The
> owner asked for a sci-fi/HUD re-skin; that document and the rewritten [`tokens.css`](tokens.css)
> now own the palette, type treatment, elevation, glow and motion **values**. The rest of this
> spec — behaviour, layout, information architecture, states, timings and the copy deck — is
> unchanged and still wins. §7 below is kept for the *rationale* and for the token **names and
> roles**, which did not change; read its hex values as historical.

Dark-first. A light theme exists as a token override only (`[data-theme='light']`) and is not a v1
design target — it must merely be legible.

### 7.1 Palette

| Token | Value | Use | Contrast on `--bg-0` |
| --- | --- | --- | --- |
| `--bg-0` | `#0E1116` | app background | — |
| `--bg-1` | `#151A21` | surfaces, top bar, cards | — |
| `--bg-2` | `#1D242D` | raised: buttons, banners, chips | — |
| `--border` | `#2A333F` | 1 px hairlines, empty pips | 1.48 (decorative only) |
| `--text-1` | `#F2F5F8` | primary text | **17.3** |
| `--text-2` | `#A9B4C0` | secondary text | **8.98** |
| `--text-3` | `#7C8794` | muted, shortcut bar, labels | **5.18** |
| `--accent` | `#5B9DFF` | primary action, played keys, links | **6.94** |
| `--success` | `#3DD68C` | correct | **10.08** |
| `--danger` | `#FF6B6B` | wrong, destructive | **6.81** |
| `--warn` | `#FFC65C` | due / attention / degraded | **12.14** |
| `--hint` | `#B48CFF` | target & ghost notes, reveals | **7.33** |
| `--key-white` | `#EDF1F5` | white keys | ink `#10151B` on it: **16.2** |
| `--key-black` | `#10151B` | black keys | — |
| `--focus` | `#7CC4FF` | focus ring | **10.08** |

All text and glyph pairings above clear **WCAG AA (4.5:1)**; the three state colours clear **AAA
(7:1)** against `--bg-0` except `--danger` (6.81) and `--accent` (6.94), which are AA-large-safe and
only ever used at ≥ 18 px or as fills with `--bg-0` ink. On a filled `--accent` / `--success` /
`--danger` / `--warn` surface, text and glyphs are always `--bg-0` (ratios 6.8–12.1).

### 7.2 Type

System stack, no webfont (offline-first, no layout shift):
`ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Inter, sans-serif`.
Numbers that update in place (score, streak, percentages, tempo) use `font-variant-numeric: tabular-nums`.

| Token | Size / line-height / weight | Use |
| --- | --- | --- |
| `--fs-display` | 72 / 1.05 / 650 | chord symbol prompt, focus-mode prompt |
| `--fs-prompt` | 56 / 1.1 / 650 | runner prompt |
| `--fs-feedback` | 32 / 1.2 / 650 | ✓/✗ line |
| `--fs-h1` | 28 / 1.2 / 650 | screen titles, hero button |
| `--fs-h2` | 20 / 1.3 / 600 | card titles, section headers |
| `--fs-body-lg` | 18 / 1.45 / 400 | prompt subtitle, nav |
| `--fs-body` | 16 / 1.5 / 400 | default |
| `--fs-small` | 14 / 1.45 / 400 | card descriptions, shortcut bar |
| `--fs-micro` | 12 / 1.3 / 500 | key labels, pips legend (the floor — never smaller) |

### 7.3 Spacing, radius, elevation

4 px base: `--space-1: 4px`, `-2: 8`, `-3: 12`, `-4: 16`, `-5: 24`, `-6: 32`, `-7: 48`, `-8: 64`.
Radius: `--radius-sm: 4px`, `--radius-md: 8px`, `--radius-lg: 12px`, `--radius-pill: 999px`.
Elevation is **borders, not shadows** (shadows look like mud on `#0E1116`). The single exception is
the depressed-key inner shadow, and `--shadow-pop` (`0 8px 24px rgb(0 0 0 / .45)`) for the `?` help
sheet.

### 7.4 Hit targets

Minimum interactive size **44×44 px**; in-exercise controls **≥ 64 px tall**; choice buttons
**≥ 200×88 px**; the hero **96 px**. White keys at the 18 px floor are narrower than 44 px — that is
accepted (it is a piano), and every note is also reachable via MIDI, the computer keys and roving
arrow focus.

### 7.5 Motion

| Token | Value | Use |
| --- | --- | --- |
| `--dur-fast` | 120 ms | fades, colour changes, key press |
| `--dur-base` | 200 ms | panel/strip enter-exit |
| `--dur-slow` | 320 ms | screen transitions (summary) |
| `--ease` | `cubic-bezier(.2,.8,.3,1)` | everything |

Rules: nothing animates for longer than 320 ms; **nothing animates in the answer path** (a highlight
is a class swap, so it lands within a frame); no looping animation except the two-step "audio not
started" pulse. `@media (prefers-reduced-motion: reduce)` sets all durations to 1 ms and removes the
shake and the key-press translate — feedback then relies on colour **and** glyph, which it already does.

### 7.6 Focus

`:focus-visible` only. Ring: `outline: 3px solid var(--focus); outline-offset: 2px;` plus
`box-shadow: 0 0 0 1px var(--bg-0)` so the ring stays visible on white keys as well as on dark
surfaces. Never `outline: none` without a replacement. Focus order follows the DOM; the runner puts
initial focus on the replay button, and the skip/reveal path is reachable by tab in three stops.

---

## 8. Accessibility requirements (binding)

1. **Never colour alone.** Correct = green **+ ✓**; wrong = red **+ ✗** (+ shake); target = violet
   **+ ◆**; due = amber **+ the word "due"**; weak = `!`. Verified by viewing the runner in greyscale:
   every state must still be distinguishable.
2. **Contrast**: body text ≥ 4.5:1, large text ≥ 3:1 — the palette in §7.1 meets this with margin.
   UI boundaries that carry meaning (state chips, key outlines) ≥ 3:1.
3. **Keyboard-complete**: every action in §4.5 works without a pointer; nothing is hover-only; no
   keyboard traps; the `?` sheet and the range wizard are dismissible with `Esc`.
4. **Screen reader**: the runner exposes a `role="status" aria-live="polite"` region that announces
   the prompt on each new question and the outcome once per answer (`Correct. Minor sixth.` /
   `Incorrect. You played a perfect fifth. The answer was a minor sixth.`). The keyboard does not
   announce per-key events (§5.5).
5. **Motion**: `prefers-reduced-motion` honoured (§7.5).
6. **No audio-only information**: after every miss, the expected answer is both displayed on the
   keyboard and named in text — the app is usable (if not enjoyable) with the sound off, which also
   makes Playwright tests trivial.
7. **Zoom/reflow**: usable at 200 % browser zoom on a 1440 px screen — the keyboard shrinks (§5.2),
   the prompt wraps, nothing is clipped.
8. **Language**: `<html lang="en">`; English-only in v1.

---

## 9. Copy deck (v1, use verbatim)

Voice: short, second person, a teacher's tone. No exclamation marks, no gamified praise ("Awesome!"),
no apologies. Musical terms spelled out in feedback (`minor 6th`, not `m6`), abbreviated in dense grids.

| Context | Copy |
| --- | --- |
| Home hero (with data) | `Practice now` / sub: `12 skills due today` |
| Home hero (empty) | `Start your first session` / sub: `Ten minutes is enough` |
| Home empty state | `Sit at your piano. Connect it, or use the on-screen keyboard. You answer by playing — space replays the sound.` |
| Runner idle | `Ready?` / `Press space to start` |
| Presenting | `Listen…` (only when the exercise has no prompt title) |
| Correct | `✓ Correct` + the answer name, e.g. `Minor 6th` |
| Correct, streak ≥ 5 | `✓ Correct · 7 in a row` |
| Wrong | `✗ Minor 6th` / `You played a perfect 5th · Space to continue` |
| Wrong, partial credit | `✗ 3 of 4 tones — missing the 7th · Space to continue` |
| Skipped | `⤳ Minor 6th` / `Skipped · Space to continue` |
| Paused | `Paused` / `Space to resume` |
| No MIDI | `No MIDI keyboard — answer with the on-screen keys or A W S E D F T G Y H U J K` |
| MIDI unsupported | `This browser has no Web MIDI. Chrome, Edge and Opera do — or play on-screen.` |
| MIDI denied | `MIDI access was blocked. Re-allow it in the browser's site settings, or play on-screen.` |
| MIDI granted, no inputs | `No MIDI input found. Plug your piano in and switch it on — it appears automatically.` |
| Device lost | `{device} disconnected — switched to the on-screen keyboard.` |
| Audio not started | `Click or press a key to enable sound` |
| Soundfont failed | `Soundfont unavailable — using the built-in synth.` |
| Storage failed | `Could not save this attempt — practice continues, but progress may be lost.` |
| Export done | `Exported {n} attempts and {m} skills.` |
| Import wrong version | `This file is from schema v{n}; this app reads v{m}.` |
| Progress empty | `No attempts yet. Practice something and this fills up.` |
| Session summary | `Session complete · {mm:ss}` |

---

## 10. Build order for this spec

Not a new slice plan — this maps the spec onto ADR §10 so nothing is built before it is needed.

| Slice | UX pieces to implement |
| --- | --- |
| 1 | Tokens (`tokens.css`), app shell §2.1, top bar + status chips (static), banner component §2.3, empty versions of all four screens. |
| 2 | `PianoKeyboard` §5 in full, Free Play, MIDI states §4.6, settings `#midi` §6.3. |
| 3 | Settings `#sound`, volume/instrument chips, audio-not-started chip, soundfont banner. |
| 4 | Runner §4 (anatomy, states, timing, shortcuts, focus mode) — everything except the session-only bits. |
| 5 | Progress §6.1, mastery pips §6.2, settings `#data`. |
| 6–8 | Answer modes §4.4 (`note-sequence`, `choice`, `chord-sustained`), partial-credit copy. |
| 9 | Home hero + length control §3, `/session`, summary §4.8, due badges. |

## 11. Open questions (decide when you get there, do not block on them)

- ~~Light theme values~~ — **closed 2026-09-14** ([`sci-fi-screens.md`](sci-fi-screens.md) §2.5):
  there is no light theme in v1 and the dormant `[data-theme='light']` token block was dropped. The
  HUD language is dark-only; a light theme would be its own ticket with its own contrast pass.
- Whether the status strip should show a running session timer in `/practice/[exerciseId]` too
  (currently: question count there, time in `/session`).
- Left-hand/right-hand split display for two-handed voicing drills (slice 8) — the keyboard component
  supports it via `highlights`, but no colour is reserved yet. Still deliberately deferred to slice 8
  ([`sci-fi-screens.md`](sci-fi-screens.md) §3.3), and it will need a **glyph** per hand: the palette
  has no headroom for two more hues that survive greyscale.
