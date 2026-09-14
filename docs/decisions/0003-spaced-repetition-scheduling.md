# ADR 0003 — Spaced repetition: SM-2-lite, replayed from the log

- **Status**: Accepted
- **Date**: 2026-09-14
- **Context**: slice 9a (SR scheduler + due/weak surfacing). Implements ADR 0001 §6's
  `$lib/practice/scheduler.ts` and closes ADR 0002 §3 ("no scheduling until slice 9"), which it
  supersedes. `/session` (slice 9b) consumes what is decided here; nothing in ADR 0001 or 0002 is
  overruled otherwise.

## 1. The algorithm is SM-2 with pass/fail, and a ten-minute first rung

`$lib/practice/scheduler.ts#review(state, { correct, at })` — pure, and the review time is passed
in, never read from a clock:

| input | easiness | intervalDays | dueAt |
| --- | --- | --- | --- |
| pass | `+0.1`, capped at **2.8** | `0 → 10 min → 1 day → × easiness`, capped at **180 d** | `at + interval` |
| fail | `−0.2`, floored at **1.3** | `0` | `at` — **due now** |

Why not classic SM-2: its quality grades are a 0–5 self-rating, and this app never asks — a drill
reports `correct`, and ADR 0001 §10 makes scoring binary. Why the extra first rung at **10 minutes**
rather than SM-2's one day: hearing a minor 6th right once is not learning it, and the piano the
user is already sitting at is the cheapest place to ask again. A miss is therefore due *immediately*
and comes back inside the same session, which is also what makes `Drill these` worth pressing.

**`score` (partial credit) deliberately does not enter the schedule.** It drives mastery (ADR 0002
§2); for recall, the right pitch class in the wrong octave is a failure, not half of one.

## 2. The schedule is replayed from the attempt log, not trusted from the record

ADR 0002 §1 makes the attempt log the source of truth and `skills` a cache of a fold over it; ADR
0002 §3 warned that the fold therefore resets `easiness`/`intervalDays`/`dueAt` on every load.

The fix is to fold **the review into the attempt**, not to make the fold defer to the cache:
`mastery.ts#applyAttempt` now calls `review(base, { correct, at: attempt.ts })`, so
`deriveSkills()` reproduces the schedule the last session wrote — from the log, at each attempt's
own timestamp, in order. Consequences, all wanted:

- A reload cannot wipe the schedule (`store.svelte.test.ts` hydrates twice and asserts it).
- A half-written or hand-edited skill record heals, exactly like mastery does.
- An import (slice 5b) that carries attempts gets a schedule derived from them; one that carries
  only skill records keeps the `dueAt` in the file, because nothing in the log contradicts it.
- No `PRACTICE_SCHEMA_VERSION` bump: the three fields have been in the record and the export
  payload since slice 5a, and their meaning only narrowed from "defaults" to "a schedule".

## 3. What is "due" — and what `new` is instead

`isDue(state, now)` is `reps > 0 && dueAt > 0 && dueAt <= now`. A never-practised skill is **`new`**
(UX §6.2), never due: a fresh install owes the user nothing, and "36 due" on day one is a claim
about a schedule that does not exist. So `N due` counts **overdue + weak** (`mastery < 0.3` with
≥ 3 attempts — the `!`), and unseen skills are counted separately (`unseenCount`).

## 4. The selector is pure, and its order is the ticket's

`$lib/practice/planner.ts#buildPlan(exercises, skills, now)` returns the plan, per-exercise counts
and the first pick. Three tiers: **overdue** (longest wait first) → **weak** (weakest first) →
**new** (the exercise's own order). Ties break on `skillId`, so every screen and every load agree.
A skill that is practised, not weak and not yet due is **absent** from the plan — it is neither a
reminder nor a gap, and padding the plan with it would make `N due` meaningless.

`Practice now` and `Drill these` therefore have one authority for both *where to go* (the pick's
exercise) and *what to say* (`DUE NOW`, `DUE n`, `N due`).

## 5. A targeted run is a bias, not a restriction

UX §6.1 says `Drill these` starts the exercise "restricted to the group's due/weak skills", but only
`generate()` can choose a skill, and no exercise reads `GenerateContext.targetSkillId` yet. Rather
than teach four exercises a new contract in this slice, the runner does **rejection sampling**: on a
targeted run (`?due=1`) it draws up to `TARGET_SAMPLE_TRIES` (16) seeds and keeps the first question
whose `skillId` is in the planner's list, passing the head of the list as `targetSkillId` for the
day an exercise honours it directly. If no draw lands, the drill runs a normal question instead of
hanging.

This keeps the runner ignorant of every exercise (it compares ids and nothing else) and is honest
about what it delivers: strongly biased, not guaranteed. Making it exact is an exercise-side change
and belongs with whichever slice first needs `settingsFields`.
