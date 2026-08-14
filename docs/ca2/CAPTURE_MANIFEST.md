# CA2 capture manifest

The order the takes are recorded in, the exact state the machine must be in
before each one, and the fallback for every block. Recording order is not the
same as the edit order in `STORYBOARD.md`, and it is deliberate: the takes that
can fail are recorded first, while there is still time to record them again.

## Before anything is recorded

Run this in order. It is not optional; three of the five steps have caught a
problem that would have been visible on camera.

1. **Confirm the branch and a clean tree.**

```bash
git status --porcelain && git log --oneline -1
```

A dirty tree means the thing on camera is not the thing in the repository.

2. **Confirm the gates still pass on this exact state.** The short set, about
   four minutes:

```bash
node scripts/qa_honesty.mjs && node scripts/qa_interpreter.mjs && node scripts/qa_voice.mjs && python scripts/smoke_mcp.py
```

3. **Clear the frame.** Work through the "must not appear in frame" list in
   `STORYBOARD.md`. The development probe files in the served asset directory
   are referenced by the QA harnesses, so check the references before moving any
   of them, and do not delete them to tidy a shot.

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

Do not type `kodro` on camera. That console script is currently wired to the
benchmark tool, not to the application, and the mismatch is a question you do
not want to answer mid-demonstration. Use the two commands in the table.

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
| Failure and refine | Two still frames, the 80 verdict and the 100 verdict, with the edit shown as a diff. Weaker, but true |
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
