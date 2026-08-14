# MCP demonstration: prompts and expected output

What to type during the MCP block, what should come back, and what to do when it
does not. Installation itself is documented in `docs/mcp.md`; this file is only
the demonstration.

## Setup, off camera

Copy the example configuration for whichever client is being shown.

| Client | Example file | Key |
|---|---|---|
| Codex | `.codex/config.toml.example` | `[mcp_servers.kodro]` |
| Generic MCP client | `.mcp.json.example` | `mcpServers.kodro` |

Do not edit a global configuration that belongs to something else. Copy the
example, point it at this checkout, and leave unrelated servers alone.

Verify before recording:

```bash
python scripts/smoke_mcp.py
```

Expected last line:

```
== MCP SMOKE: 2 of 2 entry points clean ==
```

## Option A, the harness session, lowest risk

This is the fallback in `CAPTURE_MANIFEST.md` and it is also a perfectly good
primary take. It exercises the real server process over stdio.

```bash
python scripts/smoke_mcp.py
```

Point at these four lines as they scroll:

```
PASS  initialize -> kodro 2.0.0
PASS  tools/list -> 8 tools (check_api, get_lesson, grade_program, list_lessons, prove_contracts, pupil_progress, run_program, validate_robot_spec)
PASS  resources/list -> 25 resources
PASS  tools/call with a misspelled argument -> isError
```

The last one is the interesting one. Say why: a tool that silently accepts a
misspelled argument and defaults it is worse than one that fails, because the
agent then reasons about a result that answers a different question.

## Option B, a live client, higher risk and better evidence

Only do this if the client is genuinely connected and has been tested in the
same session. Four prompts, in this order.

**Prompt 1, discovery.**

> List the Kodro tools you can see, and tell me what each one does in one line.

Expect eight tools named. If the client reports fewer, it has cached an older
handshake; restart it rather than talking around the discrepancy.

**Prompt 2, a real read.**

> Using the Kodro tools, get the lesson `00d_fix_the_turn` and show me its
> success criteria.

Expect the lesson content to come back from the authoritative library, not a
paraphrase invented by the model. Point out that the resource URI is stable and
comes from the same YAML the application reads.

**Prompt 3, a real run.**

> Run this program in Kodro and tell me the verdict.

Then paste the failing program from the lesson. Expect a structured result and a
verdict that matches what the application shows for the same program. This is
the parity point and it is worth stating out loud.

**Prompt 4, the refusal.**

> Get the lesson `00d_fix_the_turnn`.

Expect an error naming the bad id. Say the sentence about silent defaulting
here if you did not say it earlier.

## What must not be claimed

Say "a real stdio JSON-RPC session against the server" for Option A. Only say
"a real client handshake" if Option B is what actually ships in the video, with
the client visible on screen. The difference is small and a marker who asks
about it will notice which one the evidence supports. See `CLAIM_LEDGER.md`.

Do not claim remote or hosted MCP support. What exists is local stdio. There is
no authenticated remote path, so there is nothing to demonstrate and nothing to
say about it beyond that.

## If the client will not connect on the day

Fall back to Option A and say so plainly: "this is the server driven by a test
harness rather than by an agent, because the client would not connect". Then
carry on. That sentence costs a few seconds. Editing around the failure and
implying a client was involved is the thing that cannot be recovered from in the
Q&A.
