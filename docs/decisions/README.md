# Architecture decision records

Short documents recording decisions that shape the codebase, newest last. Amend a decision with a new
ADR that supersedes the old one rather than rewriting history.

| # | Title | Status |
| --- | --- | --- |
| [0001](0001-target-architecture-and-stack.md) | Target architecture and stack for the Svelte rewrite | Accepted |
| [0002](0002-practice-persistence-and-mastery.md) | Practice persistence and what "mastery" is | Accepted |
| [0003](0003-spaced-repetition-scheduling.md) | Spaced repetition: SM-2-lite, replayed from the log | Accepted (supersedes 0002 §3) |
| [0004](0004-midi-chord-answers-close-on-release.md) | MIDI chord answers close on key release | Accepted, not yet implemented (amends 0001 §3, §5) |
| [0005](0005-midi-on-ipados-capacitor-shell.md) | MIDI on iPad: a Capacitor shell with a CoreMIDI-backed Web MIDI shim | Accepted (TestFlight parts superseded by 0006) |
| [0006](0006-ipad-app-free-sideloading.md) | The iPad app is installed free: unsigned IPA from CI, sideloaded with a free Apple ID | Accepted (supersedes 0005 §7 TestFlight, §8 steps 2–7, §9 ticket 6) |
| [0007](0007-output-level-and-master-limiter.md) | Output level: a calibrated note at −3 dBFS and a master limiter | Accepted (amends 0001 §2) |
