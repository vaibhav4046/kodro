# CA2 storyboard

One row per shot, in order. Timings match `SCRIPT.md`. Frame sizes are given so
the same shot can be re-recorded later and still cut together.

Target format: 1920 by 1080, 30 fps, no letterboxing, no zoom transitions.

## Shot list

| # | Time | Length | Source | Framing | On screen |
|---|---|---|---|---|---|
| 1 | 0:00 | 0:12 | Title card | Full frame | Product name, module code, student name, date. Animated since 15 August, see the superseded note below; the 0:12 is the rendered file's exact runtime |
| 2 | 0:12 | 0:23 | Web app | Full window | Hub, lesson grid, nothing loading |
| 3 | 0:35 | 0:25 | Web app | Top bar, cropped to upper third | The three stage links, hovered in order. Was 0:30 until 17 August |
| 4 | 1:00 | 0:25 | Web app | Full window | Design stage, chassis and one parameter edit. Was 0:35 until 15 August, see the retiming note below |
| 5 | 1:25 | 0:30 | Web app | Viewport only, 16:9 crop | The rover driving, uninterrupted. Length untouched by either retiming; this is the silence that is load-bearing |
| 6 | 1:55 | 0:15 | Web app | Right panel, half frame | Telemetry, one changed value pointed at. Was 0:25 until 15 August |
| 7 | 2:10 | 0:25 | Web app | Full window | Lesson list, Key Stage 2 lesson opened |
| 8 | 2:35 | 0:30 | Web app | Split: editor left, viewport right | Starter program running. Was 0:35 until 17 August |
| 9 | 3:05 | 0:30 | Web app | Verdict panel, half frame | Grade, failed check named, explanation |
| 10 | 3:35 | 0:20 | Web app | Full window | `00d_fix_the_turn` opened, run, fails |
| 11 | 3:55 | 0:15 | Web app | Verdict panel, tight | `✗ Not yet · 40/100` and the three reasons under it. Was written here as 80 until 15 August; the grader returns 40, see `CLAIM_LEDGER.md` |
| 12 | 4:10 | 0:15 | Web app | Editor, tight on one line | The single word edited to `turn_left(90)` |
| 13 | 4:25 | 0:10 | Web app | Verdict panel, tight | `✓ Complete · 100/100` |
| 14 | 4:35 | 0:45 | Web app | Voice panel plus transcript, half frame | Spoken command, transcript, identical typed command, then stop |
| 15 | 5:20 | 0:25 | Editor | Full frame | `docs/eval/test_suite.json`, scrolled to the counts |
| 16 | 5:45 | 0:25 | Terminal | Full frame | Gate output, honesty gate line visible |
| 17 | 6:10 | 1:30 | Talking head or static frame | Full frame | Limits. No UI motion competing with the words. Was 0:60 until 15 August, which demanded 204 words a minute |
| 18 | 7:40 | 1:15 | Claude Code in a terminal | Full frame, 16 pt font minimum | The MCP finale. One prompt, then the client's own tool-call lines: handshake, lesson found and read, starter run and graded at 40, one word changed to 100, then the sandbox program at 0, `runs: 0` refused and a misspelt lesson id refused. Was shot 14 at 0:60 until 17 August |
| 19 | 8:55 | 0:40 | Web app | Full window, static | Hub, held still. Was 0:55 until 15 August and 0:45 until 17 August |
| 20 | 9:35 | 0:05 | End card | Full frame | Repository name and date. No animation |

## Expansion inserts

The shot list above is the 9:40 master cut only. If the 15 minute cap is
confirmed, three inserts from `SCRIPT.md` go in, and all three land exactly on
an existing shot boundary, so no master shot is cut into.

| Insert | Goes after shot | At | Length | Source | Framing | On screen |
|---|---|---|---|---|---|---|
| EXPAND-1 | 6 | 2:10 | 1:10 | Web app, then terminal | Full window; terminal at 16 pt for the last beat | Ultrasonic removed, assistant refusing obstacle avoidance, sensor refitted, requirements check returning an unresolved payload row, `.krs` validated over MCP |
| EXPAND-2 | 9 | 3:35 | 1:20 | Web app | Full window | More tools to Teacher progress, classroom mode engaging on its own, the summary strip, the concept heatmap with per-cell scores and colour, the legend, the one-combined-record line, both CSV buttons, an age chip in the lesson list, readable-text setting on |
| EXPAND-4 | 16 | 6:10 | 1:20 | Editor, then terminal | Full frame | The coverage figure in `test_suite.json`, then the lesson export regenerated and diffed against the committed file |

With all three in, the shots after each insert shift by the running total: shots
7 to 9 by 70 seconds, 10 to 16 by 150, and 17 to 20 by 230. Shot 20 then starts
at 13:25 and the cut ends at 13:30. Re-derive that rather than trusting this
paragraph, the same way the master runtime is checked.

Three inserts changed content on 15 August because what they asked for did not
exist: EXPAND-1 wanted a chassis-capacity refusal the product does not perform,
EXPAND-2 wanted a heatmap cell drilled down to a pupil, which the web dashboard
has no handler for, and EXPAND-3 wanted a schema bound no schema declares. All
three now show real behaviour. The reasons are in `SCRIPT.md` under each block
and in `CLAIM_LEDGER.md`. EXPAND-3 itself no longer exists as a separate insert:
on 17 August its two beats were folded into the master cut, see the restructure
note below. The paragraph above is left as written because it records why the
insert was rewritten, which is still the reason those beats look the way they do
inside shot 18.

EXPAND-2 also carries a state prerequisite the other three do not: the heatmap
renders rows only once lessons have been graded on the machine being filmed
(`bridge.js:214-227`, `hooks.jsx:604-616`), so an untouched register shows the
empty state instead. `CAPTURE_MANIFEST.md` places it after the blocks that
generate that history.

## Restructured 17 August 2026

The MCP demonstration moved from the middle of the video to the end, because it
is the strongest thing in the artefact and it was being spent at 4:45 on an
audience that had not yet seen the lesson it grades. It was shot 14 at 0:60. It
is now shot 18 at 1:15, and it is the last thing before the close.

Everything between the old and new position renumbered down by one: voice was
15 and is 14, the two evidence shots were 16 and 17 and are 15 and 16, limits
was 18 and is 17. Shots 1 to 13, 19 and 20 keep their numbers.

The extra 15 seconds came from EXPAND-3, which was a separate insert covering
`resources/read` and the `runs: 0` refusal in the same terminal window as the
old shot 14. With the finale at the end and 15 more seconds in it, both beats
fit inside the master cut, so the insert is gone and three remain. That is why
the insert numbering now reads 1, 2, 4.

The 15 seconds themselves came from three shots: shot 3 gave 5 (0:30 to 0:25),
shot 8 gave 5 (0:35 to 0:30), and shot 19 gave 5 (0:45 to 0:40). Shot 3's
narration was rewritten from 59 words to 53 at the same time, because 59 words
in 25 seconds is 142 a minute and the limits block already established 136 as
the ceiling this presenter can hold. Shot 5, the rover driving, was left alone
again, for the same reason it was left alone on 15 August.

The master runtime is unchanged at 9:40. With all three inserts the cut is
13:30, down from 14:30, which buys an extra minute of headroom against a 15
minute cap.

The shot numbers quoted in the 15 August section below are the numbering that
was current when it was written. Read them against that table, not this one:
its "shots 7 to 18" means today's shots 7 to 17 plus the MCP shot, and its
"shot 19" is still shot 19.

## Retimed 15 August 2026

Four shot lengths changed and fifteen start times moved with them. The master
runtime is unchanged at 9:40 and shot 20 still ends exactly there, because the
time was moved between shots rather than added.

That count read eleven until it was checked. Fifteen is what the table gives:
shots 5 and 6 sit 10 seconds earlier, shots 7 to 18 sit 20 seconds earlier, shot
19 sits 10 seconds later, and only shots 1 to 4 and shot 20 are where they were.
Eleven was counted by hand, in a paragraph that ends by telling the reader to
check the arithmetic rather than trust it, which is the whole reason that
instruction is there.

The cause was in `SCRIPT.md` rather than here. Counting spoken words per block
instead of only in total showed the limits block asking for 204 words in 60
seconds. Nothing else in the video was close: the next fastest block wants 124
and the average across the whole script is 99. The average was what everyone had
been reading, and flow A at 50 words a minute was holding it down, so the
unspeakable block never showed up in the aggregate.

Shot 4 gave 10 seconds and shot 6 gave 10, which is flow A from 90 down to 70.
Shot 19 gave 10, which is the close from 60 to 50. Shot 18 took all 30 and went
from 60 to 90, which puts the limits narration at 136 words a minute. Shot 5,
the rover driving, was deliberately left alone: it is the one silence in flow A
that the script defends by name.

Check the arithmetic rather than trusting this paragraph. Every row's start plus
its length must equal the next row's start, and shot 20 must end at 9:40.

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

### Superseded 15 August 2026: the toolchain does work, and the card is animated

Everything above this line is left as written because it records what was true
when it was measured. It is no longer true. Two of its statements were wrong.

**The install failure was an artefact of how it was invoked.** `npx hyperframes`
without `--yes` prompts, and a non-interactive shell cancels the prompt, which
is exactly the error quoted above. With the flag it installs and runs:

```
npx --yes hyperframes@0.7.109 check
```

The wider habit is worth naming, because it is the same one that produced three
other wrong claims this week: a tool was run once, it failed, and the failure
was written down as a property of the environment rather than of the command.

**All three named results now exist**, plus the current gate that replaced them:

```
lint                    0 errors, 0 warnings                                EXIT=0
validate                No console errors, 22 text elements pass WCAG AA    EXIT=0
inspect --samples 15    0 layout issues across 15 sample(s)                 EXIT=0
check                   Check passed (Lint 0/0, Runtime 0/0, Layout 0 across
                        9 samples, Motion 0/0, Contrast 21/21 WCAG AA)      EXIT=0
```

`validate` and `inspect` are both deprecated in favour of `check`. They are run
because this document named them; `check` is run because it is current.

Shot 1 is now an animated card rendered to
`docs/ca2/intro/renders/kodro-intro.mp4`: h264, 1920x1080, 30fps, 360 frames,
exactly 12.000000s, 774768 bytes, sha256
`dd12a3b4ee020284f52d82a5b036de400bbe5fc10816c56013ab35313d8f161a`.

Every determinism rule listed above is met, and how each one is met is written
out element by element in the composition's own comments. Motion is confined to
`opacity`, `y` and `scaleX`, all of which are compositor properties, so no
layout dimension is animated. The last element settles at 3.60s and the card
then holds still for the remaining 8.4s while the cold open is spoken over it.
It does not dissolve out: the straight-cut rule above still governs, so shot 1
simply ends.

Two caveats that are part of the record. The eases are GSAP's `power2.out` and
`power3.out`, which approximate the product's `cubic-bezier(0.22,0.61,0.36,1)`
without matching it. And `Snapshots disabled` in the check output is not a pass;
there is no committed baseline for this composition.

Full account, including a font-substitution defect that the green gates hid and
two layout defects that only showed up on an extracted frame:
`.kodro/ca2-evidence/2026-08-15-ca2-intro-composition.md`.

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
