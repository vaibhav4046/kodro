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

2. **Confirm the gates still pass on this exact state.** The short set, timed
   twice on 15 August at 4.5 and 3.9 seconds, of which the MCP smoke run was 3.4
   both times because it spawns two real server subprocesses. The other four are
   a tenth of a second each. This line used to say "about four minutes", which
   was never timed; there is no reason to skip a check this cheap:

```bash
node scripts/qa_secrets.mjs && node scripts/qa_honesty.mjs && node scripts/qa_interpreter.mjs && node scripts/qa_voice.mjs && python scripts/smoke_mcp.py
```

3. **Clear the frame.** Work through the "must not appear in frame" list in
   `STORYBOARD.md`. Four of the files on that list are load-bearing and must not
   be deleted to tidy a shot: `cap.html`, `harness.html`, `harness_bundle.js` and
   `studio_harness.html`, which between them are read by six QA scripts. This
   step used to name the `_a11y_probe*.html` and `_perf_probe.html` files as the
   harness-referenced ones, and that is backwards. Nothing in `scripts/` opens
   them; the only "probe" the harnesses know about is a hidden div they inject at
   run time, which is a different thing with a similar name. Keep everything on
   the list out of frame rather than moving any of it on capture day.

4. **Set the terminal up.** Short prompt with no user name in it, 16 pt or
   larger, dark background to match the product, no unrelated scrollback.

5. **Disable notifications and set the display to 1920 by 1080.** A toast
   sliding in over the verdict panel means recording that block again.

## Launch commands

| Surface | Command |
|---|---|
| Desktop app | `python -m robolearn` |
| Web app in a desktop window | `python -m robolearn.web` |
| MCP server, stable entry point | `kodro-mcp` |
| MCP server, documented fallback | `python -m robolearn.mcp` |
| MCP smoke harness, for the on-camera session | `python scripts/smoke_mcp.py` |

`kodro` now points at the application in `pyproject.toml`, and `kodro-bench` is
the batch runner it used to shadow. A console script is only written at install
time, though, so an environment installed before that change still runs the old
mapping. Check before trusting it:

```bash
python -c "import importlib.metadata as m; print([(e.name, e.value) for e in m.distribution('robolearn').entry_points if e.group == 'console_scripts'])"
```

If `kodro` still reports `robolearn.bench:main`, do not type `kodro` on camera.
Use `python -m robolearn` from the table instead. Measured on 15 August, that is
the live state: the installed distribution maps `kodro` to `robolearn.bench:main`
and does not carry `kodro-bench` at all, so the name of the product still starts
the batch runner in this environment. `kodro-mcp` is installed and correct at
`robolearn.mcp.server:main`, which is why the MCP block can use it.

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

## Recording order

Risky first, safe last.

| Order | Block | Shots | Why here |
|---|---|---|---|
| 1 | MCP session | 14 | A live subprocess session is the most likely thing to misbehave on camera |
| 2 | Voice | 15 | Depends on a microphone and a model load, both external to the product |
| 3 | Failure and refine | 10 to 13 | The block that carries the most marks, so it gets a fresh recording session |
| 4 | Classroom loop | 7 to 9 | Long, several steps, easy to fumble the order |
| 5 | Design and run | 4 to 6 | Stable, mostly mouse work |
| 6 | Evidence | 16, 17 | Static files and terminal output, near zero risk |
| 7 | Orientation and hub | 2, 3, 19 | Cannot fail |
| 8 | Limits narration | 18 | Audio-led, re-recordable at any point |
| 9 | Title and end card | 1, 20 | Last, because the date on the card should match the recording |

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
| MCP session | Record the smoke harness output scrolling in a plain terminal. It is the same evidence and it cannot fail interactively |
| Voice | Show the typed intent path only, and say plainly that the spoken path is demonstrated in the local benchmark rather than live. Do not fake a transcript |
| Failure and refine | Two still frames, the 40 verdict and the 100 verdict, with the edit shown as a diff. Weaker, but true. This row said 80 until 15 August, which is not a score the shipped grader can return for this lesson; see `CLAIM_LEDGER.md` |
| Classroom loop | Cut the export step. It is the least load-bearing part of the block |
| Design and run | Cut the parameter edit and show a pre-built robot running. Say so |
| Evidence | Screenshot the artefact instead of scrolling it |
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
