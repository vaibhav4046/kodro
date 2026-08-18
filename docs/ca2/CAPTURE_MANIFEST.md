# CA2 capture manifest

The order the takes are recorded in, the exact state the machine must be in
before each one, and the fallback for every block. Recording order is not the
same as the edit order in `STORYBOARD.md`, and it is deliberate: the takes that
can fail are recorded first, while there is still time to record them again.

## Before anything is recorded

Run this in order. Nothing has been recorded yet, so no claim is made here about
what these steps have caught in practice; this line used to say three of the five
had caught something on camera, which is not measurable before a capture exists.
What is measurable is that steps 1 and 2 are cheap and step 3 is the one that has
carried a wrong instruction, so read it rather than skimming it.

1. **Confirm the branch and a clean tree.**

```bash
git status --porcelain && git log --oneline -1
```

A dirty tree means the thing on camera is not the thing in the repository.

2. **Confirm the gates still pass on this exact state.** The short set runs in
   under four seconds. Timed three times on 15 August with a millisecond clock:
   3.874, 3.868 and 3.912 seconds. Almost all of that is the MCP smoke run, which
   took 3.282 and 3.292 seconds on its own two timings because it spawns two real
   server subprocesses. The four Node gates together account for 0.638 of a
   second: `qa_secrets` 0.295, `qa_interpreter` 0.155, `qa_honesty` 0.102 and
   `qa_voice` 0.086. This line used to say "about four minutes", which was never
   timed; there is no reason to skip a check this cheap:

```bash
node scripts/qa_secrets.mjs && node scripts/qa_honesty.mjs && node scripts/qa_interpreter.mjs && node scripts/qa_voice.mjs && python scripts/smoke_mcp.py
```

   Those figures replace "4.5 and 3.9 seconds ... the other four are a tenth of a
   second each", which was written on 14 August. The total and the smoke run were
   close enough, but the per-gate line was wrong: `qa_secrets` reads 478 files and
   takes 0.295 of a second, three times the tenth it was credited with, and the
   other three are the ones that actually sit near a tenth. The first timing
   attempt on 15 August produced no numbers at all because it was written with
   `bc`, which is not installed in this shell, so every figure printed as an empty
   string while the gates themselves returned `EXIT=0`. A command that fails on a
   missing tool and still exits through the success path of the surrounding script
   is exactly how an unmeasured number gets written down as a measured one.

3. **Clear the frame.** Work through the "must not appear in frame" list in
   `STORYBOARD.md`. Four of the files on that list are load-bearing and must not
   be deleted to tidy a shot: `cap.html`, `harness.html`, `harness_bundle.js` and
   `studio_harness.html`, which between them are read by seven scripts under
   `scripts/`, only five of which are named `qa_*`. The full list is
   `qa_ui.mjs`, `qa_worlds.mjs`, `qa_web.mjs`, `qa_performance.mjs`,
   `qa_interpreter.mjs`, `build_screenshot_harness.cjs` and `build_web.cjs`. This
   step used to say "six QA scripts", which was wrong on both halves: the count is
   seven, and two of the seven are build scripts rather than gates, which matters
   because deleting one of these files would break the web build and not only a
   test. It also used to name the `_a11y_probe*.html` and `_perf_probe.html` files
   as the harness-referenced ones, and that is backwards. Nothing in `scripts/`
   opens them; the only "probe" the harnesses know about is a hidden div they
   inject at run time, which is a different thing with a similar name. Keep
   everything on the list out of frame rather than moving any of it on capture
   day.

   Counting this correctly needs one guard worth writing down, because getting it
   wrong the first time is what produced the six. A plain search for `harness.html`
   also matches inside `studio_harness.html`, so the two files inflate each
   other's totals. The measurement behind the numbers above anchors each name with
   a negative lookbehind for a word character or underscore and counts occurrences
   per file.

4. **Set the terminal up.** Short prompt with no user name in it, 16 pt or
   larger, dark background to match the product, no unrelated scrollback.

5. **Disable notifications and set the display to 1920 by 1080.** A toast
   sliding in over the verdict panel means recording that block again.

## Launch commands

| Surface | Command |
|---|---|
| Desktop app | `python -m robolearn` |
| Web app in a desktop window | `python -m kodro.web` |
| MCP server, stable entry point | `kodro-mcp` |
| MCP server, documented fallback | `python -m kodro.mcp` |
| MCP smoke harness, for the on-camera session | `python scripts/smoke_mcp.py` |

`kodro` now points at the application in `pyproject.toml`, and `kodro-bench` is
the batch runner it used to shadow. A console script is only written at install
time, though, so an environment installed before that change still runs the old
mapping. Check before trusting it:

```bash
python -c "import importlib.metadata as m; print([(e.name, e.value) for e in m.distribution('kodro').entry_points if e.group == 'console_scripts'])"
```

If `kodro` still reports `kodro.bench:main`, do not type `kodro` on camera.
Use `python -m robolearn` from the table instead. Measured on 15 August, that is
the live state: the installed distribution maps `kodro` to `kodro.bench:main`
and does not carry `kodro-bench` at all, so the name of the product still starts
the batch runner in this environment. `kodro-mcp` is installed and correct at
`kodro.mcp.server:main`, which is why the MCP block can use it.

This paragraph used to add that reinstalling was impossible because the build
backend "is not present offline on this machine". That reason is false and was
already corrected once in `.kodro/autonomy/STATE.md`. It is true that
`hatchling` does not import in this interpreter, but `pip download hatchling`
succeeds and fetched 1.32.0 when it was tested, and the wheel has been built and
exercised in a clean virtual environment. The offline constraint binds Kodro the
product, not the toolchain that packages it. The honest reason to type the module
command instead is narrower: a reinstall changes the environment being filmed, so
if the entry point is going to be fixed it happens before the capture freeze, and
after the freeze the module command is the one known to work on the state that is
on camera.

**The name typed on camera will not be Kodro.** That follows from the paragraph
above and was not stated in it, which is worth fixing here because it is visible
in frame rather than only in a config file. Five console scripts resolve on this
machine, all with an `.exe` shim present under `Python313\Scripts`: `kodro`,
`kodro-mcp`, `kodro-prove`, `kodrobench` and `robolearn`. This paragraph said
three until 15 August, listing `kodro`, `robolearn` and `kodro-mcp` and omitting
`kodro-prove` and `kodrobench`. The omission does not change the conclusion,
because neither omitted script reaches the application either: `kodro-prove` runs
`kodro.prove`, the deterministic contract evidence stage, and `kodrobench`
runs `kodro.kodrobench`, which measures how well an LLM writes grounded robot
control code and is therefore the one command in the list that cannot run under
the offline constraint at all. It is corrected anyway, because a count stated as
a measurement is a measurement, and the same paragraph is the one telling the
reader what will be visible in frame.

The first draft of this correction called `kodrobench` the batch runner, guessing
from the name. It is not; `kodro` is, through `kodro.bench`. Two commands
whose names both contain "bench" do different jobs, and the guess was caught only
because each module's docstring was read instead of trusted. The five entry
points and what they resolve to:

```
kodro         kodro.bench:main        headless batch runner
kodro-mcp     kodro.mcp.server:main   MCP server over stdio
kodro-prove   kodro.prove:main        contract evidence
kodrobench    kodro.kodrobench:main   LLM code-generation benchmark
robolearn     kodro.__main__:main     the application
```

`kodro-mcp` is correct, so the MCP block types the product name. The application
is the problem: `kodro` points at the batch runner, and the two commands that do
reach it, `robolearn` and `python -m robolearn`, both carry the package name. So
there is no command in this environment that starts the application under the
product's own name.

Do not paper over that with a shell alias made for the camera. An alias is a
prop, and it would put a command in frame that does not exist on the machine.
Either fix it before the capture freeze by reinstalling, accepting that the
filmed environment then differs from the verified one, or type the module command
and answer the question if it is asked. `Q_AND_A.md` carries that answer.

## Recording order

Risky first, safe last.

| Order | Block | Shots | Why here |
|---|---|---|---|
| 1 | MCP finale | 18 | A live agent session driving a live subprocess is the most likely thing to misbehave on camera. It is the last shot in the cut and the first one recorded |
| 2 | Voice | 14 | Depends on a microphone and a model load, both external to the product |
| 3 | Failure and refine | 10 to 13 | The block that carries the most marks, so it gets a fresh recording session |
| 4 | Classroom loop | 7 to 9 | Long, several steps, easy to fumble the order |
| 5 | Design and run | 4 to 6 | Stable, mostly mouse work |
| 6 | Evidence | 15, 16 | Static files and terminal output, near zero risk |
| 7 | Orientation and hub | 2, 3, 19 | Cannot fail |
| 8 | Limits narration | 17 | Audio-led, re-recordable at any point |
| 9 | Title and end card | 1, 20 | Last, because the date on the card should match the recording |

Shot numbers in that table moved on 17 August when the MCP block became the
finale. The recording order did not: it is ordered by risk, and moving a block
in the cut does not make it safer to film. See the restructure note in
`STORYBOARD.md` for the old numbering.

**Record order 1 and order 3 in the same sitting, order 3 first.** The finale
grades `00d_fix_the_turn`, the same lesson the failure-and-refine block fixes on
screen, and it reads the score back off the server. If the two are recorded days
apart the presenter has to remember which lesson was on camera. Filming the web
fix first and the agent grading it second also means the 40 and the 100 in the
terminal are being checked against a verdict the viewer watched ten seconds of
video earlier.

### The three expansion inserts

Record these only if the 15 minute cap is confirmed, and record them in this
order, which is not the order they appear in the cut. Until 15 August this
section did not exist: the two tables in this file covered master shots 1 to 20
and stopped, while the heading below still promised a fallback for every block.
The inserts became real content when their narration was written and nothing
here moved with them.

There were four until 17 August. EXPAND-3 was a second MCP insert covering
`resources/read` and the `runs: 0` refusal, recorded back to back with the old
shot 14 so a single launch covered both. The finale now has the room to carry
both beats itself, so the insert is gone and its recording note is gone with it.

| Order | Insert | Goes with | Why here |
|---|---|---|---|
| 1a | EXPAND-1 | Web app, ending in the terminal | Ends with a `.krs` validated over MCP, so it wants the terminal already set up. Record it in the same sitting as order 1, while the server and the font size are still configured. Its web beats are low risk; the MCP beat is not |
| 4a | EXPAND-2 | Web app, after orders 3 and 4 | Has a state prerequisite, below. It cannot be recorded before the register has been filled |
| 6a | EXPAND-4 | Editor, then terminal | Regenerates a file on camera and diffs it. Low risk, but the diff has to land, so give it room |

**EXPAND-2 state prerequisite.** The heatmap renders rows only from graded
attempts already on the machine being filmed. In browser mode there is no Python
store: `app.jsx:1907-1910` records a lesson's concepts into
`window.KodroPupilStore` after each graded attempt, pass or fail, and
`bridge.js:222-227` reads that same store back for the dashboard. An untouched
register renders the empty state, not a heatmap. So grade at least the flow B
lesson and `00d_fix_the_turn` on the capture machine first, which is what orders
3 and 4 already do. `00d_fix_the_turn` contributes `sequence` and `debugging`
(`ct_concepts` in its YAML, exported as `concepts` in `lessons.json`), so those
two columns are guaranteed to be there.

Do not seed the register by hand to make the grid look fuller. A three column
heatmap that came from the three lessons in the video is worth more than a wide
one that came from nowhere, and the wide one invites the one question with no
good answer.

## File naming

`ca2_<order>_<block>_take<n>.mp4`, for example `ca2_01_mcp_take2.mp4`. Keep
every take. Do not overwrite a take that had one flaw; the flawed take is the
fallback if the retake introduces a worse one.

Store under `.kodro/ca2-evidence/captures/`. That directory is outside the
packaged application and is already the location the verification logs use.

## Fallback for every block

Each row is the answer to "the live take failed twice, now what".

| Block | Fallback |
|---|---|
| MCP finale | Run `python scripts/smoke_mcp.py` in a plain terminal instead of the agent client, and say on camera that this is the server driven by a test harness rather than by an agent, because the client would not connect. Same JSON-RPC frames, same tool list, same refusals, no interactive risk. Do not say "a real client" over a harness. If the client connects but one tool call misbehaves, keep the take and narrate what happened rather than cutting to a clean rerun |
| Voice | Show the typed intent path only, and say plainly that the spoken path is demonstrated in the local benchmark rather than live. Do not fake a transcript |
| Failure and refine | Two still frames, the 40 verdict and the 100 verdict, with the edit shown as a diff. Weaker, but true. This row said 80 until 15 August, which is not a score the shipped grader can return for this lesson; see `CLAIM_LEDGER.md` |
| Classroom loop | Cut the export step. It is the least load-bearing part of the block |
| Design and run | Cut the parameter edit and show a pre-built robot running. Say so |
| Evidence | Screenshot the artefact instead of scrolling it |
| EXPAND-1 | Cut the closing MCP validation beat and end on the requirements check showing the unresolved payload row. The refusal and the disclaimer are the point of the block; the `.krs` round trip is already covered by shot 18 |
| EXPAND-2 | Cut to the two CSV downloads and the on-screen one-combined-record line. If the register is empty and there is no time to fill it, drop the insert entirely rather than showing an empty state and talking over it |
| EXPAND-4 | Show the committed lesson export and the recorded hash side by side instead of regenerating. Weaker, because the point of the block is that regeneration reproduces the file byte for byte, so say that is what is being shown |
| Any insert | Every one of the three is droppable by construction: each lands on a master shot boundary and none is referenced by the master narration. If an insert will not record cleanly, cut it and lose 70 to 80 seconds rather than filming a bad minute |
| Any block | If nothing works, say on camera that the block is being described rather than shown. That costs a little. Faking it costs everything |

## After capture

Log the result of each block in `.kodro/ca2-evidence/` with the take that was
used and the takes that were rejected. If a fallback was used anywhere, that
fact belongs in the final report and in the Q&A preparation, because the first
question a marker asks about a described-not-shown block is why.

## What is not covered here

Submission. The upload, the format, and the deadline mechanics are student
actions and are outside this manifest. See `BRIEF_VERIFIED.md` for what is still
unconfirmed about them.
