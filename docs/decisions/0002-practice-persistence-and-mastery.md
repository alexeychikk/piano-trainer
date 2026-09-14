# ADR 0002 — Practice persistence and what "mastery" is

- **Status**: Accepted
- **Date**: 2026-09-14
- **Context**: slice 5a (persistence + `/progress`). Implements ADR 0001 §6; nothing in it is
  overruled. This ADR only fixes what §6 left open: the mastery formula, and what happens to the
  spaced-repetition fields before the scheduler exists.
- **Amends**: ADR 0001 §5 — a fifth display extension to `ExerciseDefinition` (`skillLabel`).

## 1. The attempt log is the source of truth

`$lib/storage/db.ts` (IndexedDB via `idb`, per ADR §6) holds `attempts`, `skills` and `meta`, keyed
and indexed as §6 specifies. `skills` is a **cache of a fold over `attempts`**, not independent
state: `$lib/practice/mastery.ts#deriveSkills` rebuilds it from the log, and the store prefers the
derived value on every read. A half-failed write, a partial import (slice 5b) or a hand-edited
database therefore heals on the next load instead of leaving a skill claiming a mastery its history
does not support.

Everything read back is validated field by field (`parseAttempt`, `parseSkill`); a record that is
not the right shape is dropped. Storage that is missing, blocked or **written by a newer build**
resolves to `null` and the session runs in memory, with the copy deck's one-liner in a banner —
practice never stops because a write failed (ADR §6's "assume storage can vanish").

`PRACTICE_SCHEMA_VERSION` is both the payload version (what slice 5b's export carries) and the
IndexedDB version, so an older build meeting a newer database fails at `open` rather than halfway
through a read.

## 2. Mastery is an EWMA with α = 0.3, and nothing else

`mastery ← mastery + 0.3 × (score − mastery)`, starting at 0, over the grade's `score` (so partial
credit — the right pitch class in the wrong octave — counts for half). Consequences, all wanted:
a first correct answer lands at 30 %, five in a row at 83 %, and a single fumble on a solid skill
costs ~24 points instead of erasing it. A skill with no attempts is `null` ("new"), which is a
different thing from mastery 0 (UX §6.2).

**A skill is weak** at `mastery < 0.3` **and** ≥ 3 attempts — the `!` marker, in `--warn`.

## 3. No scheduling until slice 9

`easiness`, `intervalDays` and `dueAt` exist in the record from day one — so the export format and
slice 9 have somewhere to grow — but slice 5a **writes them at their defaults and reads none of
them**. Consequently `/progress` ships without the `DUE NOW` counter, the per-panel `DUE n` badge
and `Drill these` (`docs/design/sci-fi-screens.md` §7): all three are statements about a schedule,
and inventing a due date here would mean inventing the spaced-repetition rule that ADR §6 assigns to
`$lib/practice/scheduler.ts` in slice 9. Everything else on the screen is real data.

## 4. Layering: `practice` sits above `storage` and `exercises`

`$lib/practice/` may import `$lib/storage` and `$lib/exercises` types; **nothing imports it back** —
the runner stays ignorant of persistence and receives an `onAttempt` callback, which is also what
keeps its state machine testable without a database. `$lib/storage/db.ts` stays a base layer: it
spells its record types out in primitives rather than importing `AttemptResult`, which is
structurally assignable to `StoredAttempt`.

## 5. `ExerciseDefinition.skillLabel`

`/progress` shows a cell per `SkillId` and a raw id (`find-the-note:pc:3`) is not a name — but only
the exercise knows what `pc:3` means, and "nothing else in the app may learn an exercise's name"
(ADR §5). So the definition gains an optional `skillLabel(skillId, settings)`, a display concern as
generic as the other four extensions; without it the screen falls back to the id's last segment.
