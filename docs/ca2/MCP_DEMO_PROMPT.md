# MCP demonstration: the prompt, the expected chain, and the fallback

What to type during the MCP block, what should come back, and what to do when it
does not. Installation itself is documented in `docs/mcp.md`; this file is only
the demonstration.

Every number in this file was measured on 17 August 2026 at commit `f92f92f`, by
driving the real `kodro-mcp` process over stdio: 17 request/response pairs,
exit 0. The driver source and the verbatim output are in
`.kodro/ca2-evidence/2026-08-17-mcp-live-agent-chain.md`. If a number on the day
disagrees with a number here, the run on the day is the true one and this file
is stale: say the measured number and fix the file afterwards.

## Which client, and why it cannot be the web app

Kodro's server is local stdio. It is a process the client launches on this
machine and talks to over standard input and output. That rules out claude.ai in
a browser: a web page cannot spawn a local process, and Kodro publishes no
hosted endpoint for one to connect to instead. The finale is Claude Code in a
terminal, or Codex in a terminal, on this machine.

This is not a limitation worth apologising for on camera, and it is also not
worth hiding. One sentence covers it if anyone asks: the server is local by
design because the whole product is, and a hosted MCP endpoint would be a
network service that the offline claim does not survive.

## Setup, off camera

| Client | Example file | Key |
|---|---|---|
| Claude Code | `.mcp.json` (checked in) | `mcpServers.kodro` |
| Codex | `.codex/config.toml.example` | `[mcp_servers.kodro]` |
| Generic MCP client | `.mcp.json.example` | `mcpServers.kodro` |

Do not edit a global configuration that belongs to something else. Copy the
example, point it at this checkout, and leave unrelated servers alone.

**Register the server before you start the client, not during.** Clients read
their MCP configuration at startup. A server added to `.mcp.json` while a
session is already running does not appear in that session, and the failure
looks like the server being broken rather than the client being stale. If the
tools are not there, quit the client and start it again.

Verify before recording:

```bash
python scripts/smoke_mcp.py
```

Expected last line:

```
== MCP SMOKE: 2 of 2 entry points clean ==
```

## The prompt

One prompt. Paste it, do not type it: the block is 75 seconds in the cut and
typing 90 words eats a third of that.

> Use the kodro MCP server for everything here. Find the Key Stage 2 lesson
> about debugging and read it without the worked solution. Run its starter
> program, grade it, and tell me exactly which checks failed and by how much.
> Work out the smallest edit that would pass, confirm the function you want is
> one Kodro actually allows, apply it, and grade it again. Then show me three
> things the server refuses: a program that does `import os`, the lesson id
> `00d_fix_the_turnn`, and a determinism check with the run count set to zero.
> Do not guess a number from the lesson text. Get every one off the server.

Two phrases in there are doing work and should not be trimmed for brevity.
"Key Stage 2 lesson about debugging" names no id, so the client has to filter
the library rather than recall an id from the transcript: `concept=debug`
returns two lessons and only one of them is KS2. "Get every one off the server"
is the whole point of the block, because a model that reads the lesson text and
paraphrases a score looks identical on screen to one that called the grader.

## What should come back

Eleven calls, six of the eight tools, in roughly this order. The counts are what
a correct run produces.

| # | Call | What it returns |
|---|---|---|
| 1 | `initialize` | `kodro 2.1.0` |
| 2 | `tools/list` | 8 tools |
| 3 | `list_lessons` `concept=debug` | `00d_fix_the_turn` (KS2), `04a_fix_the_condition` (KS3) |
| 4 | `get_lesson` `00d_fix_the_turn` | KS2, "Fix the Broken Program", 3 criteria, `hasSolution: true` with the solution itself withheld, starter of 3 lines |
| 5 | `run_program` | `success: true`, ends `x=2.0 y=0.0 heading=270.0 collisions=1 battery=96.44`, 3 events |
| 6 | `grade_program` | `passed: false`, **score 40**, three reasons |
| 7 | `check_api` | 24 callable functions; filtered on `turn`, exactly `turn_left` and `turn_right` |
| 8 | `grade_program` on the edit | `passed: true`, **score 100**, no reasons, ends `x=2.0 y=3.0 collisions=0` |
| 9 | `grade_program` with `import os` | not a protocol error. `execution.success: false`, `kind=sandbox`, `line 1`, **score 0** |
| 10 | `get_lesson` `00d_fix_the_turnn` | `isError`, and the message names the near miss |
| 11 | `prove_contracts` `runs: 0` | `isError`, `'runs' must be at least 1.` |

The three failing reasons at step 6, verbatim:

```
The program does not call move_forward(), turn_left(), move_forward(), in that order.
Travelled 2.0 m (minimum 3.0 m).
Recorded 1 collision(s); none were expected.
```

Every value in that table, and the three reasons above word for word, are checked
against the live server by:

```bash
python scripts/qa_mcp_finale.py
```

Run it on the recording day, before capture. It drives the same eleven calls
through a real server subprocess and exits non-zero naming the row that moved.
Nothing else in the repository can catch a stale number here, because this file
is prose and the server is code, so the two can disagree indefinitely without any
gate noticing. It passed clean on 17 August, 30 of 30. The counts in it are
hardcoded on purpose, which is the opposite of what `scripts/smoke_mcp.py`
argues for and correct for a different reason: the numbers are already written
down in this document, and the only question worth asking is whether the document
is still true. If a tool is added, update this table first and the script second.

The edit at step 8 is one token: `turn_right` becomes `turn_left`. If the client
proposes a bigger rewrite that also passes, keep the take. A larger correct edit
is a fair answer to "the smallest edit that would pass" being a judgement call,
and arguing with it on camera costs more than it is worth.

## What to point at while it scrolls

Four things, in the order they appear.

**Eight tools and twenty-five resources, off the handshake.** Counted from what
the client received, not from a README that could have drifted from the code.

**Forty, then a hundred, on the same lesson the web app just graded.** This is
the parity point and it is the reason the MCP block sits last rather than first:
the marker has already watched that exact lesson go from failing to passing in
the product, so seeing the same two numbers arrive from outside it means
something. Say the number, do not just let it scroll.

**Zero for the sandbox escape, and why zero rather than sixty.** A program that
never ran left a trace of nothing behind, and a grader marking that trace would
credit "no collisions" because nothing moved. Sixty out of a hundred for a
program that did not run is a worse failure than a crash, because it is a
plausible number. This was a real defect in the server and it was fixed on 17
August; the two regression tests that pin it are in
`tests/unit/test_mcp_server.py`.

**Two refusals rather than two silent defaults.** `runs: 0` could quietly become
1 and `00d_fix_the_turnn` could quietly become the nearest match. Both would be
convenient and both would be worse, because the agent then reasons confidently
about the answer to a different question. If asked where the zero is caught, the
answer is the handler at `tools.py:379`, not the schema: no `inputSchema` in the
server declares a `minimum`. Saying so is more honest than implying the schema
catches it, and it is the kind of detail a Q&A question lands on.

## Two tools the prompt does not exercise

`pupil_progress` and `validate_robot_spec` are in the handshake count and are
not called by this chain. Do not imply eight tools ran. "Eight tools, and this
uses six of them" is accurate and takes the same breath. Both have unit
coverage in `tests/unit/test_mcp_server.py`; neither has a place in a
seventy-five second block.

## Fallback: the harness session

Use this if the client will not connect on the day. It exercises the same server
process over the same stdio protocol, driven by a test harness instead of an
agent.

```bash
python scripts/smoke_mcp.py
```

Point at these four lines as they scroll:

```
PASS  initialize -> kodro 2.1.0
PASS  tools/list -> 8 tools (check_api, get_lesson, grade_program, list_lessons, prove_contracts, pupil_progress, run_program, validate_robot_spec)
PASS  resources/list -> 25 resources
PASS  tools/call with a misspelled argument -> isError
```

Say plainly what it is: "this is the server driven by a test harness rather than
by an agent, because the client would not connect". Then carry on. That sentence
costs a few seconds. Editing around the failure and implying a client was
involved is the thing that cannot be recovered from in the Q&A.

## What must not be claimed

Say "a real stdio JSON-RPC session against the server" for the harness. Only say
"a real client handshake" and "it is launching the server itself" if the client
is what actually ships in the video, with the client visible on screen. The
difference is small and a marker who asks about it will notice which one the
evidence supports. See `CLAIM_LEDGER.md`.

Do not claim remote or hosted MCP support. What exists is local stdio. There is
no authenticated remote path, so there is nothing to demonstrate and nothing to
say about it beyond that.

Do not say the numbers matched the web app "exactly" unless you mean the scores.
The scores and the reason counts agree across surfaces. The wording of a sandbox
rejection does not, because the browser and the Python runtime are different
interpreters: Python says `line 1: import 'os' is not allowed` and the browser
grader says `syntax: Unexpected token "os".` Same verdict, same score, different
sentence, and claiming identical wording is a claim the evidence does not carry.

## Revision note

This file described four separate prompts until 17 August 2026, when the MCP
block moved from the middle of the video to the finale and grew to 75 seconds.
Four prompts do not fit in 75 seconds and, more to the point, four small prompts
demonstrate that the tools answer individually, which was never in doubt. One
prompt that forces a chain demonstrates that they compose, which is the harder
claim and the one worth filming. The old Option A and Option B split is gone:
the client is now the primary and the harness is the fallback, which is what
`CAPTURE_MANIFEST.md` already said.
