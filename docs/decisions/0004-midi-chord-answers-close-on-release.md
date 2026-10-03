# ADR 0004 — MIDI chord answers close on key release

- **Status**: Accepted (product decision on ticket `34bbf58c`, 2026-10-03). **Not yet implemented.**
- **Date**: 2026-10-03
- **Context**: refinement backlog item 1. Amends ADR 0001 §3 (revives `chord-released` and
  `CHORD_SETTLE_MS`, with the rules below rather than §3's one-line sketch) and ADR 0001 §5 (one
  field on `Answer`, one on `Question`). Changes the doubling rule of five drills. `SkillId`s,
  `PRACTICE_SCHEMA_VERSION`, the attempt record and RNG consumption are all **unchanged**.

## Problem

Every chord drill answers in `note-sequence`, and the runner closes that answer at the **Nth
note-on** (`expectedLength`). At a real MIDI piano the natural way to play a chord is with two hands:
a left-hand root under a right-hand voicing, often with a doubled note. Then:

- the answer is graded on whichever N notes arrived first, so the last-landing chord tone is lost;
- a doubled note always "costs a chord tone", which is a false miss;
- in the ii-V-I, one extra key shifts the 4–4–4 chunking, so all three chords are misread.

The target user is "at a MIDI digital piano", and that user's most natural input is the one grading
punishes. Every false miss also feeds the mastery EWMA and makes SM-2 reschedule the skill as due
now (ADR 0003 §1). So the damage reaches `/progress`, home and `/session`.

**The fix is almost entirely in the runner, not in grading.** All five chord drills already grade
on **pitch-class set plus lowest note**: `intervalsAboveBass` folds and dedupes, and `spellsShell`,
`spellsRootless` and `spellsGuideTones` compare pitch-class sets. Doublings fail today only because
the answer is cut off at N notes before `grade()` sees it.

## 1. Which path an answer takes

A chord drill's questions declare **`answerMode: 'chord-released'`**. The runner picks the capture
path **per answer**, from the **source of that answer's first note-on**:

| first note-on's `source` | capture path | closes when |
| --- | --- | --- |
| `midi` | **chord capture** (§2) | every key is up for `CHORD_RELEASE_MS` and enough chords have been captured, or the silence window runs out |
| `onscreen`, `computer-keyboard` | **`note-sequence`, exactly as today** (`expectedLength`, `answerGapMs`, `Backspace`) | unchanged |

- **Why mouse and computer keys keep `note-sequence`.** One pointer cannot hold a chord, so on
  release-close every click would be an answer. Computer-key rollover is hardware-dependent. Both
  stay on the behaviour slices 7–12 shipped, so the "playable with no MIDI device" rule is untouched.
- **One answer, one path.** Once chord capture has started, note events from any other source are
  **ignored for grading** (they still sound, through the layout's single subscription). This keeps
  `answerSource` truthful (`midi`) and keeps the two capture algorithms from mixing. A note-sequence
  answer still takes notes from any source, as today.
- **The exercise still never learns the source.** It declares a mode. The runner, which already
  records `answerSource`, owns the policy. A `chord-released` question that never gets a MIDI note is
  indistinguishable from today's `note-sequence` question.
- `interval-recognition` (melodic, two notes in order) stays `note-sequence` for every source, and
  `find-the-note` stays `single-note`.

## 2. Chord capture (MIDI): the algorithm

The runner now receives **note-offs**. `ExerciseRunner.svelte`'s `midiInput.subscribe` forwards
`event.type === 'off'` to a new `runner.noteOff(midi, source)`. It keeps, for the answer in
progress:

- `held`: pitches down now that were pressed **during this answer**. A key already down when
  `awaiting` began (still held from the reveal, or the note-on that advanced the drill) is never
  counted, and its note-off is ignored;
- `pending`: pitches pressed since the last *moment* (below);
- `offSinceMoment`: whether any counted key went up since the last moment;
- `chords: Midi[][]`: the chords captured so far, each a deduped set.

**Constants** (in `runner.svelte.ts` beside the other drill-rhythm constants):

| constant | value | meaning |
| --- | --- | --- |
| `CHORD_SETTLE_MS` | **90 ms** | ADR 0001 §3's settling window. How long the held set must be still (no counted on/off) to be a *moment*. It covers rolled chords and two hands that do not land together. |
| `CHORD_RELEASE_MS` | **250 ms** | How long every key must stay up before a chord is finished. It covers a hand coming back: a left-hand root lifted just before the right hand lands. |

**Rules**

1. **A moment.** The settle timer restarts on every counted note-on or note-off. When it fires with
   `held` non-empty **and `pending ∩ held` non-empty**, `held` is a *moment*: a key pressed since the
   last moment has been held still for `CHORD_SETTLE_MS`. Then `pending` is cleared.
2. **Strays are dropped.** If a key is grazed while a chord is held, it goes down and up inside the
   window, so it is never in a moment. The `pending ∩ held` condition means it cannot create a moment
   on its own either. A deliberate wrong key **held** through a settle *is* counted. On a piano there
   is no take-back, and today's `note-sequence` counts a wrong key too (only the mouse path has
   `Backspace`). **Velocity is not used**: touch differs per instrument and per player, and duration
   does not.
3. **Where a moment goes.**
   - Single-chord questions (`answerChords` absent or 1): every moment is **merged** into one chord.
     So a rolled chord, a left hand that lands first, and a bass note lifted before the right hand
     lands all become one union.
   - Multi-chord questions (`answerChords > 1`, the ii-V-I): a moment **starts a new chord** when
     `offSinceMoment` is true and `chords` is non-empty. Otherwise it merges into the current chord.
     A chord that is still being built (keys only added) is therefore one chord, and a change of hand
     shape (some keys up, new keys down) is the next one. **Voice-leading that holds common tones
     works.** Dm7 → G7 with D and F held is a note-off (A, C up) followed by new keys (G, B), which is
     a new chord. So does lifting both hands between chords. `offSinceMoment` then resets.
     Root position is still required (each chord's lowest note is its root, slice 10); a left hand
     playing the roots, which is how a two-handed ii-V-I is played, gives that for free.
4. **A stab.** When `held` empties with unsettled `pending` notes (a staccato chord shorter than
   `CHORD_SETTLE_MS`), they count as one moment **if there are ≥ 2 distinct pitches**. A single
   unsettled pitch is a graze and is dropped. So a lone brushed key before the real chord never
   becomes the answer, while a deliberate single note **held** ≥ 90 ms does (guide tones name a
   one-note miss on purpose, CLAUDE.md slice 12).
5. **Closing.** When `held` empties, `CHORD_RELEASE_MS` starts. A counted note-on cancels it, and
   the gesture continues. When it fires:
   - if `chords.length ≥ answerChords` (default 1), the answer **closes**;
   - otherwise the **silence window** is armed: `Question.answerGapMs ?? SEQUENCE_GAP_MS`, measured
     only while nothing is held. A note-on cancels it. When it fires, the answer closes with what was
     captured, which is a miss the drill names (§4). If nothing was captured at all (only grazes),
     the runner stays in `awaiting`, and `IDLE_PAUSE_MS` handles abandonment as it does today.
   - A held key never closes an answer, and the silence window never runs while a key is down. A
     stuck key is cleared by `midiInput.releaseAll()` on disconnect, or by the idle pause.
6. **Not affected:** `replay` (the answer survives it, as a sequence does), `pause` (drops the
   answer in progress, as for a sequence), `skip`, the idle timer (re-armed on every counted on/off),
   `ADVANCE_LOCKOUT_MS`. `Backspace` is a no-op in chord capture.
7. **The sustain pedal is not read.** `parseMidiMessage` ignores CC 64, and that stays. The pedal
   changes what sounds, not which keys are down, and chord boundaries are made with the hands. A
   rolled chord whose early keys are released *without* the pedal is still one chord in a
   single-chord drill (rule 3). In the ii-V-I it would read as a new chord. That is a known
   limitation (§6).

**The `Answer` the drill receives** (ADR 0001 §5, additive):

```ts
type Answer =
  | { kind: 'notes'; notes: Midi[]; order: Midi[]; source: NoteSource; chords?: Midi[][] }
  | { kind: 'choice'; choiceId: string };
```

- `chords`: **present only from chord capture**. Each chord is ascending and deduped, in the order
  the chords were played.
- `notes`: the union of all chords, ascending and deduped.
- `order`: those pitches in first-note-on order.
- `source`: `'midi'`.

So every single-chord `grade()` keeps reading `answer.notes` **unchanged**. A note-sequence answer
has no `chords` field and is exactly today's.

**On `Question`** (an eighth generic extension to ADR §5, like `answerGapMs`):
`answerChords?: number`, the number of chords a `chord-released` answer is made of (default 1). It
says how many *chords* the answer has, never what they are. Only the ii-V-I sets it (3).

## 3. Grading rules per drill

The rule for every chord drill is now stated once: **the graded quantity is the pitch-class set
plus the lowest note. Register, spacing, hands and doublings are free.** In each drill's table,
"doubling" moves from *rejected* to *free* for **every** source.

On the note-sequence path a doubling still *costs* a note, because that path closes at the expected
length. That is an artefact of counting, not a grading rule. The mouse and computer keys have no
reason to double anyway.

| drill | `grade()` change | passes (MIDI) | still misses |
| --- | --- | --- | --- |
| **chord-quality** (slice 7) | none | any root, any octave and spacing, LH root + RH chord, any doubling (e.g. `C2 · C4 E4 G4 B4`) | an inversion (lowest note ≠ root), an extra pitch class (a held stray, a 9th), a missing tone |
| **play-the-voicing** (slice 8) | none | LH root + RH `3-7` or `7-3`, a doubled root (`C3 · C4 E4 B4`), any spacing | the 5th or the whole chord (an extra pitch class), any lowest note other than the asked root, a rootless shape |
| **rootless-voicing** (slice 11) | none | the four pitch classes with the form's own degree lowest, doubled in any octave, split across the hands | **any root, including a left-hand root under the voicing**: rootless means rootless, the app sounds the root itself as the reference bass, and the named near-miss line stays. The other form, another key, an extra pitch class. |
| **guide-tones** (slice 12) | none | the two pitch classes in any register, doubled across the hands (LH `3-7` + RH `7-3`), either one lowest | the root (the habit this drill breaks), the 5th/9th, half the pair (still a *named* one-note miss), another key. The tritone substitute stays correct. |
| **progression-recognition** (slice 10) | chunks come from `answer.chords` when present (below) | each chord spells its degree's quality over its own root, with doublings and two hands, voice-led with common tones held or lifted between chords | wrong count of chords, any chord inverted, wrong quality, wrong key, wrong order, an extra pitch class in a chord |

**The ii-V-I change**, in `$lib/theory/progressions.ts` and the exercise:

- New: `spellsProgressionChords(chords: readonly (readonly Midi[])[], tonicPc, type)`. It requires
  `chords.length === progressionSteps(type).length` and `spellsQualityFromRoot(chords[i], …)` for
  each chord. There is no note count: a chord's size is free.
- `spellsProgression(notes, …)` becomes `chunkIntoChords` + the length check + `spellsProgressionChords`.
  Its behaviour on the sequence path is byte-identical.
- `grade()`: `chunks = answer.chords ?? chunkIntoChords(answer.order, type)`, graded through
  `spellsProgressionChords` (sequence path: still guarded by the twelve-note length check).
- `missDetail` takes the chunks, not the flat notes. On the chord path, "a whole chunk" means any
  non-empty chord, not `chunk.length === size`. It gains one line, asked first, for a chord-path
  answer whose count is wrong: `Heard N chords — a ii-V-I is three` (singular `1 chord`), in the
  exercise's copy like its other lines. That is the named miss for chords run together (rule 3) or
  a correction that split a chord.
- The prompt subtitle gains nothing. Lifting between chords is *not* required (rule 3), so there is
  nothing to instruct.

`Grade.score` stays binary (ADR 0001 §10).

## 4. What the frame shows

UX §4.4 already specifies `chord-released`: *"keyboard; sounded notes stay lit until release
commits"*, shortcut bar `+ release to answer`. The developer builds that; no new copy is invented.

- **Live keys**: while chord capture is open, the frame passes `held ∪ runner.answerNotes` as the
  `held` input of `runnerHighlights()`. `answerNotes` is the union of the chords captured so far, so
  captured notes stay lit after the hands lift (especially between the ii-V-I's chords).
- **Slots**: the runner exposes `capture: 'sequence' | 'chord' | null` (`null` until the first
  note-on). Slots render exactly as today unless `capture === 'chord'`. Then they become **one slot
  per expected chord** (`answerChords ?? 1`). Each is filled, once that chord is captured, with its
  **lowest note's name** (via `Question.spellings`, falling back to the flat name). That is the root
  the grader will read, so a wrong bass is visible before the reveal. They sit in the same reserved
  88 px slot, so the §4.1 no-scroll guard is unaffected (≤ 3 slots is narrower than today's 12).
- **Shortcut bar**: for a `chord-released` question **with a MIDI device connected**, append
  `release to answer` (UX §4.4), wording in `$lib/midi/keymap.ts`. Without a device the bar is
  today's (the mapping + `⌫ clear last`), which is still the widest state the no-scroll e2e
  measures.
- **Not built** (deferred, no ticket needed now): UX §4.3's 2 px settling line (a 90 ms bar is
  imperceptible) and the Settings `Chord settle 50–200 ms` slider (UX §6.3). `CHORD_SETTLE_MS` is a
  module constant until a user asks for the slider.

## 5. Data, determinism, tests

- **No data moves.** `SkillId`s, the attempt record (`answerSource` was already `'midi'` for these
  answers) and `PRACTICE_SCHEMA_VERSION` are untouched. Past false misses stay in the log. Mastery
  (EWMA, α = 0.3) and SM-2 recover from them on their own within a few correct answers. A retroactive
  re-grade is impossible anyway, because the log stores no notes.
- **Seed snapshot**: questions change (`answerMode`, plus `answerChords` on the ii-V-I), so
  `seed-snapshot.test.ts`'s **digests** for the five chord drills must be re-recorded. Their **50
  question ids per range must not change**, and no RNG is consumed differently. This is the
  deliberate question change the CLAUDE.md rule allows; the PR calls it out.
- **Unit tests** (fake timers, `source: 'midi'` events into `runner.noteOn/noteOff`, no hardware):
  - two-hand chord + doubling closes on release and grades correct;
  - a rolled chord;
  - LH root lifted 150 ms before RH lands = one chord;
  - a graze while holding is dropped;
  - a lone graze before the chord is dropped;
  - a held wrong key is counted;
  - a stab < 90 ms counts;
  - a held chord never closes, and the silence window does not run while held;
  - ii-V-I with full lifts, and with common tones held, gives three chords;
  - ii-V-I with chords run together gives the named count miss;
  - a mouse first note keeps `note-sequence` byte-for-byte (the existing suite must pass unchanged);
  - mixed-source events are ignored once chord capture has started;
  - keys held from before `awaiting` are ignored.
  - Theory: `spellsProgressionChords` with doublings and variable chord sizes, plus the existing
    `spellsProgression` suite unchanged.
- **e2e**: none new. Playwright has no MIDI port, and the mouse/computer-key smoke paths, which are
  what e2e can drive, must stay green unchanged (that is the regression proof for §1).

## 6. Rejected alternatives and known limits

- **Union of every note sounded** (ADR 0001 §3's original sketch). Rejected: one brushed neighbour
  fails the answer. The settle-moment rule keeps the forgiveness for rolled chords and drops grazes.
- **The last settled held set** (grade the final hand shape). Rejected: it lets a user hunt by ear
  until it sounds right, which defeats an ear drill. A key held long enough to be heard has been
  played.
- **Chord boundaries by full release only** (ii-V-I). Rejected: voice-leading with common tones held
  is how jazz pianists play a ii-V-I. Under that rule all three chords would merge into one answer.
- **`chord-sustained`** (grade the settled set while still held). Not adopted: closing mid-hold
  grades a chord before a late hand lands, and it would need a longer settle that slows every answer.
- **A left-hand root under a rootless voicing passes.** Rejected for now: the drill's skill *is*
  playing without the root, and the reference already sounds it. If the owner wants solo-piano
  two-handed rootless voicings, that is a new skill (a settings option or its own drill), not a
  grading loosening.
- **Known limit: corrections in the ii-V-I.** Lifting a wrong key and pressing the right one is
  indistinguishable from voice-leading, so it splits a chord. The answer then has four chords and
  gets the named count miss. Single-chord drills are unaffected: the wrong key was held, so it was
  played.
- **Known limit: no pedal.** See §2 rule 7.

## 7. CLAUDE.md changes (land with the implementation, not before)

- **Runner** bullet: add the chord-capture paragraph. Cover `chord-released` per §1, the two
  constants, the moment / stray / stab / close rules, `runner.noteOff`, `Answer.chords`,
  `Question.answerChords` as the **eighth** generic extension, and `capture` for the frame.
- **Slices 7, 8, 10, 11, 12**: replace each "a doubling … misses / always costs a chord tone"
  sentence with: *"Doublings are free: grading is pitch-class set plus lowest note. On the
  `note-sequence` path (mouse, computer keys) a doubled note still uses up one of the answer's N
  notes, because that path closes at the expected length."* Slice 7's "answer mode is
  `note-sequence`, not … `chord-released`" paragraph becomes "`chord-released`, which the runner
  captures as a chord from a MIDI port and as a `note-sequence` from every other source". Slice 10's
  "chords are separated by count, not by time" stays true for the sequence path, plus a line that
  chord capture separates them by hand shape (§2 rule 3).
- The same doubling sentences in the docblocks of `chord-quality`, `play-the-voicing`,
  `rootless-voicing`, `guide-tones`, `progression-recognition` and `theory/progressions.ts` (the
  `spellsProgression` doc), plus `theory/voicings.ts`'s "a doubling costs one of the N notes" lines.
- ADR 0001 §3's 2026-10-03 note already points here.
