# UX specs

Design specifications for the web app. A spec is authoritative for layout, states, copy and visuals;
[`docs/decisions/`](../decisions/) is authoritative for architecture and contracts. Supersede a spec
by revising it in place and bumping its status line — the developer should only ever read the current
one.

| Doc | Covers |
| --- | --- |
| [`core-practice-ux.md`](core-practice-ux.md) | **Behaviour**: app shell, routes, exercise runner and its states, feedback timing, piano keyboard component, progress, settings, accessibility, copy deck. Its §7 (visual *values*) is superseded. |
| [`sci-fi-visual-language.md`](sci-fi-visual-language.md) | **Visuals**: the HUD/sci-fi palette, surfaces, typography, iconography, component skins, motion budget, plus the app-shell and home re-skin. Supersedes `core-practice-ux.md` §7. Part 2 (runner, `PianoKeyboard`, Free Play, Progress, Settings, `/session`) is a separate ticket. |
| [`tokens.css`](tokens.css) | The design tokens, ready to copy **byte-for-byte** to `apps/web/src/lib/styles/tokens.css`. |
| [`reference/`](reference/) | Owner-supplied reference imagery (`sci-fi-reference.png`). |

Read them in that order: behaviour first, then the skin.
