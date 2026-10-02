# Refinement pass — UX audit after slice 12

**Status**: current · 2026-10-02 · audited `master` @ `38aaf9d` (the build live on Pages).
**Amends**: `core-practice-ux.md` §3 (home cards, locked cards, empty state), §4.2 (idle prompt),
§6.1 (progress grid) and §9 (copy deck rows named below); `sci-fi-visual-language.md` §8 (exercise
card row) and §7 (one rule added). Nothing here adds a screen or a route.

Point of view: a beginner at the piano bench, first visit, no MIDI device, then the same person three
weeks in with 200+ skills on `/progress`. Each item is one ticket-sized change; **S** ≈ a few hours,
**M** ≈ a day with tests. Items are in priority order.

---

## 1. The home-card decision (owed before the next exercise slice)

**Problem.** Every exercise card is a `HudPanel`, and a non-well `HudPanel` always wears
`.hud-glow` — a `drop-shadow` layer. Home today: wordmark mark (1) + hero (1) + Today card (1, or the
glowless well for a first-timer) + 7 cards = **9–10 of the ≤ 12 budget** (part 1 §7). Two more
exercises break it, and `/progress` has the same cliff (one glowing panel per practised exercise).

**Decision — a repeated panel glows only when it is hot.**

- New rule for part 1 §7: *a panel that is one of N repeated siblings (one per exercise) wears **no
  glow at rest**.* At rest it keeps the full level-1 anatomy minus the filter: `--grad-panel` face,
  1 px `--panel-border` edge, `--inset-top`, `--chamfer-md`. On `:hover` / `:focus-visible` it takes
  the hot state the spec already gives it (`--panel-border-hot` + `hud-glow-hot`). The swap is
  **discrete** — `HudPanel`'s current `transition: filter` is itself a §7 violation ("animating
  `filter`… not allowed") and goes.
- Cost on home becomes **wordmark + hero + Today + at most one hot card = ≤ 4 at any exercise
  count**; on `/progress`, **wordmark + Today + ≤ 1 hot panel**. The budget stops scaling with the
  registry, which is the point.
- Implementation shape: `HudPanel` gains `glow?: 'rest' | 'hot-only'` (default `'rest'`, so every
  other panel is unchanged); home cards and `/progress` group panels pass `'hot-only'`. A
  `/progress` group panel is not a link, so its hot state is `:focus-within` (a focused cell or its
  button), never `:hover`.
- **Locked cards** (item 3) never glow, hot or not — part 1 §8 already says "the glow is dropped".

**Rejected.** *Wrapping each family in one glowing panel* (2 glows, but cards inside a panel are a
level-2 surface on a level-1 surface — the reference never nests chamfers, and it reads as clutter).
*Compact list rows instead of cards* (loses UX §3's 320×140 card, the description and the pips —
exactly what a beginner needs). *Dropping the glow from every panel* (the hero and Today card are
where the HUD look lives; the repeated cards are where the budget goes).

**Grouping (ships with item 2, not instead of the glow rule):** the cards split into two labelled
rows by family, so the grid stays scannable at 9–12 exercises:

```
OR DRILL ONE THING                                          (h2, unchanged)

EAR  Hear it, play it back                                  (h3 micro-label + --text-2 line)
┌ Find the note ─┐ ┌ Interval recog. ┐ ┌ Chord quality ──┐ ┌ ii-V-I progr. ──┐
└────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
HANDS  Read a chord symbol, play the voicing
┌ Shell voicings ┐ ┌ Guide tones ────┐ ┌ Rootless voic. ─┐
└────────────────┘ └─────────────────┘ └─────────────────┘
```

Family headings are plain text (no panel, no glow), `--space-6` above each row.

---

## 2. Prioritised list

### R1 · Repeated panels glow only when hot — **S**
Exactly §1's decision: `HudPanel` `glow` prop, home cards + `/progress` group panels on
`'hot-only'`, `transition: filter` removed. Acceptance (home e2e, `getComputedStyle(...).filter`):
with history, ≤ 4 filter layers at rest; focusing card 1 gives it the hot glow while card 2 stays
`none` — the glow is now the card's focus feedback, so the keyboard path is part of the test.

### R2 · Families, ladder order and one rename — **M**
- `ExerciseDefinition` gains `family: 'ear' | 'hands'` (generic, like `skillLabel`); family wording
  (`EAR` / `Hear it, play it back`, `HANDS` / `Read a chord symbol, play the voicing`) lives in a new
  `$lib/exercises/families.ts`. Home renders one row per family, cards in registry order. Nothing
  else reads `family` except item R3.
- Registry order becomes the **ladder**: ear = Find the note → Interval recognition → Chord quality
  → ii-V-I progressions; hands = Shell voicings → **Guide tones → Rootless voicings**. Guide tones
  move ahead of rootless: two notes before four, and a guide-tone pair *is* the shell minus its root,
  so it is the shortest step up from the drill before it.
- Rename `Play the voicing` → **`Shell voicings`**. With three voicing drills the old title no longer
  says which one; the prompt already says "Play the shell". Title only — the exercise id
  `play-the-voicing` and every stored `SkillId` stay, so no data moves.

### R3 · The mixed session follows the ladder (locked cards, finally) — **M**
**Problem.** A first session round-robins **every** registered drill: question 5 of a beginner's
first ten minutes is a rootless B form. UX §3 specified advisory **locked cards** for exactly this;
they were never built.
- An exercise is **unlocked** if it is first in its family, or the exercise before it in the same
  family has ≥ `UNLOCK_ATTEMPTS` = 20 attempts, or it has ≥ 1 attempt of its own (the user chose it;
  never re-lock). Pure, in `$lib/practice/planner.ts` (`unlockedExercises(exercises, attempts)`),
  driven only by family + registry order — no exercise names.
- `/session` (`buildSessionQueue` and the empty-plan registry fallback) draws **only unlocked**
  exercises. A first session is therefore Find the note + Shell voicings, alternating.
- Locked card (UX §3, part 1 §8, unchanged treatment): 60 % opacity, lock glyph (new inline
  `IconLock.svelte`), no glow, **still a link** — locking is advisory. Its foot replaces the pips
  with the reason: `Unlocks after 20 answers in Shell voicings · 14 to go` (template in
  `$lib/practice/copy.ts`, `unlockHint(prevTitle, remaining)`). Screen readers get the same text.
- Home's due counts and `/progress` are unaffected: a locked exercise has no practised skills.

### R4 · Card descriptions say what the drill teaches — **S**
Current descriptions describe only the mechanic. Replace (copy deck §9 amendment; ≤ 80 characters,
two lines at 14 px in a 320 px card):

| Exercise | New description |
| --- | --- |
| Find the note | `Hear a note, find its key. Links what you hear to where it lives.` |
| Interval recognition | `Hear two notes, play the same gap from any key. Every chord is built from these.` |
| Chord quality | `Hear a 7th chord and play it back from any root — learn each chord's colour.` |
| ii-V-I progressions | `Hear jazz's core cadence and play its three chords back, in order.` |
| Shell voicings | `Read a chord symbol, play root, 3rd and 7th — the first jazz left hand.` |
| Guide tones | `Read a chord symbol, play just its 3rd and 7th — the notes that name it.` |
| Rootless voicings | `Read a symbol and a form, play the A or B voicing — four notes, no root.` |

### R5 · Home empty state explains session vs. drill — **S**
The "How this works" well keeps its sentence and gains a second paragraph (copy deck §9, "Home empty
state" row extended):
> `The big button mixes your drills for the minutes you pick. Or drill one thing below — each row is
> a ladder, start at its first card.`

No tour, no dialog (UX §1 rules onboarding tours out); this is the only first-run text.

### R6 · The idle runner says what is about to happen — **S**
`/practice/<id>` idle prompt today: `Ready?` / `Press space to start` — a first visit to a drill gives
no hint of what it asks. Idle subtitle becomes the exercise's `description` (R4's copy); the `Space`
cue moves onto the `Start` go-button as a `Space` keycap `Chip` (as on the hero). In `/session` the
idle subtitle is `A mix of your drills · 10 minutes` (`sessionIdle(min)` in `copy.ts`). The §4.1
no-scroll guard at 1280×720 with the no-MIDI strip must stay green — the subtitle wraps to at most
two lines at `--fs-body`.

### R7 · Chord quality gets a construction-length answer window — **S**
Rootless (2.5 s), guide tones (2.5 s) and ii-V-I (3 s) set `answerGapMs`; chord quality still closes
a four-note answer after the runner's 1200 ms default. A beginner finding the 4th note by ear — or
with a mouse — is graded wrong mid-search. Set chord quality's `answerGapMs` to **2500 ms**, the
same reasoning as slice 11. Interval recognition (two notes) and Find the note stay on the default.

### R8 · Copy drift in prompts and miss lines — **S**
Three wordings exist for the same "right notes, wrong bass" miss; one prompt hides that octave
counts. Change (copy deck §9 rows):

| Where | Now | Becomes |
| --- | --- | --- |
| Find the note · subtitle | `Play it back on your keyboard` | `Play the same key back — the octave counts` |
| Chord quality · miss | `Right chord — but the root belongs at the bottom` | `Right notes — the root belongs at the bottom` |
| ii-V-I · miss | `The ii is Dm7 — the root belongs at the bottom` | `The ii is Dm7 — its root belongs at the bottom` |

Everything else was checked and is consistent: the shortcut bar is one generic component (only
note-sequence drills add `⌫ clear last`, by design), the three playing drills' subtitles share the
`Play the <thing>: <degrees>[ — no root]` shape, and every miss names what was played.

### R9 · `/progress` at 200+ skills: needs-work first, grid as a matrix — **M**
**Problem.** A practised rootless group is 72 cells, mostly `new`, wrapping in registry order; the
three weak keys the screen exists to show are somewhere in the middle.
- Each group panel opens with a **NEEDS WORK** list: up to 6 `ListRow`s (due + weak, planner order),
  each with the skill label, `MasteryPips`, the existing detail line and the `!`/`due` marks. Hidden
  when empty. The `Drill these` button stays below it.
- Below, the cells become a **matrix** when the exercise can place its skills: new optional
  `ExerciseDefinition.skillGrid(skillId) → { row: string; col: string } | null` (generic, like
  `skillLabel`; the screen still never decodes an id). Keyed drills: rows = quality (× form for
  rootless), columns = the 12 keys `C Db D … B`; interval recognition: rows = interval, columns
  `↑ ↓`. A matrix cell is `MasteryPips` + `NN%` / `new` only — row and column headers carry the name,
  and the cell's accessible name is the full label (`Cmaj7 A, 43 %`). Exercises without `skillGrid`
  keep today's wrapping cells.
- Width check: 12 columns × 72 px + a 96 px row header = 960 px, inside `--content-max` at 1280.
  Below 1100 px the matrix scrolls horizontally *inside its panel* (the page never does).

### R10 · Settings: drop the stale note, mirror session length — **S**
Settings → Practice still says *"Session length and per-exercise settings arrive with the practice
loop (slice 9)"* — slice 9 shipped. Remove the note. Add the same 5 / 10 / 20 min segmented control
there (`Session length`, one setting, one store — home's control and this one are the same
`settings.patch({ sessionLengthMin })`), so the one place a user looks for preferences has it.

---

## 3. Not in this pass (recorded so nobody re-audits them)

- **Per-drill scope** (pick which qualities/keys a drill asks) needs the runner to render
  `settingsFields` — a feature, its own ticket, not a refinement.
- Free Play, the session summary and the runner frame were walked and match `sci-fi-screens.md`; no
  change. The sound chip's emoji remain the recorded exemption (CLAUDE.md).
- Two-hand voicings remain deferred (a `NoteEvent` has no hand).

## 4. Suggested ticket split

`R1` (glow rule + its tests) → `R2` → `R3` (needs R2's `family`) → `R4 + R5 + R8`
(one copy PR) → `R6`, `R7`, `R10` (independent S) → `R9` (largest; independent of the rest).
R1 lands before the next exercise slice.
