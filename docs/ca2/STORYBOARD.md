# CA2 storyboard

One row per shot, in order. Timings match `SCRIPT.md`. Frame sizes are given so
the same shot can be re-recorded later and still cut together.

Target format: 1920 by 1080, 30 fps, no letterboxing, no zoom transitions.

## Shot list

| # | Time | Length | Source | Framing | On screen |
|---|---|---|---|---|---|
| 1 | 0:00 | 0:12 | Title card | Full frame | Product name, module code, student name, date |
| 2 | 0:12 | 0:23 | Web app | Full window | Hub, lesson grid, nothing loading |
| 3 | 0:35 | 0:30 | Web app | Top bar, cropped to upper third | The three stage links, hovered in order |
| 4 | 1:05 | 0:35 | Web app | Full window | Design stage, chassis and one parameter edit |
| 5 | 1:40 | 0:30 | Web app | Viewport only, 16:9 crop | The rover driving, uninterrupted |
| 6 | 2:10 | 0:25 | Web app | Right panel, half frame | Telemetry, one changed value pointed at |
| 7 | 2:35 | 0:25 | Web app | Full window | Lesson list, Key Stage 2 lesson opened |
| 8 | 3:00 | 0:35 | Web app | Split: editor left, viewport right | Starter program running |
| 9 | 3:35 | 0:30 | Web app | Verdict panel, half frame | Grade, failed check named, explanation |
| 10 | 4:05 | 0:20 | Web app | Full window | `00d_fix_the_turn` opened, run, fails |
| 11 | 4:25 | 0:15 | Web app | Verdict panel, tight | `✗ Not yet · 80/100` |
| 12 | 4:40 | 0:15 | Web app | Editor, tight on one line | The single word edited to `turn_left(90)` |
| 13 | 4:55 | 0:10 | Web app | Verdict panel, tight | `✓ Complete · 100/100` |
| 14 | 5:05 | 0:60 | Terminal | Full frame, 16 pt font minimum | MCP session: initialize, tools/list, one good call, one refused call |
| 15 | 6:05 | 0:45 | Web app | Voice panel plus transcript, half frame | Spoken command, transcript, identical typed command, then stop |
| 16 | 6:50 | 0:25 | Editor | Full frame | `docs/eval/test_suite.json`, scrolled to the counts |
| 17 | 7:15 | 0:25 | Terminal | Full frame | Gate output, honesty gate line visible |
| 18 | 7:40 | 0:60 | Talking head or static frame | Full frame | Limits. No UI motion competing with the words |
| 19 | 8:40 | 0:55 | Web app | Full window, static | Hub, held still |
| 20 | 9:35 | 0:05 | End card | Full frame | Repository name and date. No animation |

## Framing rules

- Terminal text at 16 pt or larger. A marker watching on a laptop must read the
  JSON-RPC frames without pausing.
- Never crop mid-word. If a panel does not fit, resize the window before the
  take rather than zooming in post.
- The cursor is a pointer, not a highlighter. Move it once, deliberately, to the
  thing being named, then leave it still.
- No animated transitions between shots. Straight cuts. A cross-dissolve between
  two UI shots reads as a mistake.

## Intro card

The intro is a static title card, shot 1. It is a card and not an animation for
one reason: the animation toolchain has not been proven in this environment.

`npx hyperframes` cannot install non-interactively here. The exact failure:

```
npm error npx canceled due to missing packages and no YES option: ["hyperframes@0.7.109"]
```

No lint, validate or inspect result exists, so none is claimed. If the toolchain
is made to work later, the intro must still satisfy the determinism rules that
were set for it: no random values, no asynchronous timeline construction, no
infinite repeats, no jump cuts, no animation of layout dimensions, and no
overlapping track timings. Until then a static card is the honest choice and
costs nothing on camera.

## What must not appear in frame

Check every one of these before recording. Several are visible in the default
state of the repository.

- Development probe files in the served asset directory: `_a11y_probe.html`,
  `_a11y_probe2.html` through `_a11y_probe4.html`, `_perf_probe.html`,
  `cap.html`, `harness.html`, `harness_bundle.js`, `studio_harness.html`,
  `_alex_default.png`, `_ped_home.png`, `_ped_typo.png`. Some of these are
  referenced by the QA harnesses, so they must not be deleted to tidy the shot.
  Keep them out of frame instead, or check the references first and move them
  deliberately.
- Repository clutter at the root: `AUDIT_CODEX.md`, `HUMAN_TODO.md`.
- Any file path containing the machine's user name. This rules out a full-screen
  file explorer and most terminal title bars. Set the terminal to show a short
  relative prompt before recording.
- Editor tabs from unrelated work, notification toasts, and the clock if the
  recording date matters.
- Any browser tab bar showing unrelated sites.
