# UX specs

Design specifications for the web app. A spec is authoritative for layout, states, copy and visuals;
[`docs/decisions/`](../decisions/) is authoritative for architecture and contracts. Supersede a spec
by revising it in place and bumping its status line — the developer should only ever read the current
one.

| Doc | Covers |
| --- | --- |
| [`core-practice-ux.md`](core-practice-ux.md) | **Behaviour**: app shell, routes, exercise runner and its states, feedback timing, piano keyboard component, progress, settings, accessibility, copy deck. Its §7 (visual *values*) is superseded. |
| [`sci-fi-visual-language.md`](sci-fi-visual-language.md) | **Visuals, part 1**: the HUD/sci-fi palette, surfaces, typography, iconography, component skins, motion budget, plus the app-shell and home re-skin. Supersedes `core-practice-ux.md` §7. |
| [`sci-fi-screens.md`](sci-fi-screens.md) | **Visuals, part 2**: the exercise runner, `PianoKeyboard`, Free Play, Progress, Settings, `/session` and its summary in that language — plus the key focus-ring fix, the `ProgressBar` ramp fix, the dropped light theme and the four Settings §6.3 gaps. Amends `core-practice-ux.md` §6.3 and §11. |
| [`tokens.css`](tokens.css) | The design tokens, ready to copy **byte-for-byte** to `apps/web/src/lib/styles/tokens.css`. |
| [`reference/`](reference/) | Owner-supplied reference imagery (`sci-fi-reference.png`). |

Read them in that order: behaviour first, then the skin.
