# piano-trainer — notes for agents

## What this repository is right now

`master` currently holds the **legacy Electron desktop app**. It is being **completely rewritten**
as a browser app on a Svelte + TypeScript stack, in this same repository. The legacy UI is
discarded; only a small amount of pure logic is worth porting.

**Before doing any design or implementation work, read
[`docs/codebase-overview-pre-rewrite.md`](docs/codebase-overview-pre-rewrite.md).** It is the
survey of what exists today — stack, screens, MIDI/audio approach, persistence, and an explicit
reuse-vs-replace list. The short version: the salvageable surface is about one utils file plus a
few dependency choices, so budget the rewrite as new work, not a port.

> Some tickets refer to this survey as the knowledge-base entry *"piano-trainer codebase overview
> (pre-rewrite)"*. Creating knowledge entries requires the `upsert_knowledge` tool, which only the
> **product** role has, so the content lives at the path above until Product mirrors it into the
> knowledge base. If both exist, the knowledge-base entry is canonical.

## Conventions

- **Technical decisions** with lasting consequences go in an ADR under `docs/decisions/`, numbered
  and dated. Neither that directory nor any ADR exists yet — the first architecture ticket creates
  both.
- **Project conventions and styleguides** go in this file. Update or supersede existing entries
  rather than appending duplicates.
- No stack conventions are recorded yet for the rewrite: the target architecture is still being
  designed. Do not infer conventions from the legacy `src/` tree — it is on its way out.

## Environment caveat

Agent sandboxes for this project have so far had **no working shell** (`Bash` fails with "No
suitable shell found") and no `Glob`/`Grep`. Explore with `Read` and expect to verify file absence
by probing conventional paths. If your sandbox *does* have a shell, a `git ls-files` is cheap and
upgrades several "probably absent" claims in the survey to certainties.
