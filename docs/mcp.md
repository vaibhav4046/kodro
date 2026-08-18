# Connect an assistant to Kodro (MCP)

Kodro ships a Model Context Protocol server. Point a coding assistant at it and
the assistant can read the lesson library, run a pupil's program in the same
sandboxed interpreter the Run button uses, and mark it with the same grader.
Answers come from the running product rather than from the assistant's
impression of it, which is the whole point: an assistant guessing at Kodro's
rover API invents functions that do not exist, and an assistant that can call
`check_api` does not.

Everything runs locally over stdin and stdout. There is no account, no key and
no network call.

This page is the setup guide. For how the server is built and why, see
[MCP internals](developers/mcp-server.md).

## Install

The server is part of the `robolearn` package, so installing the project
installs it:

```bash
pip install -e .
```

That also generates the `kodro-mcp` console script. It is created at install
time, so a checkout that was installed before the entry point existed will not
have it. Rerunning the command above is enough. Check:

```bash
kodro-mcp --list-tools
```

If that prints a tool list, you are ready to register it with a client.

## Register it with a client

Two example files are in the repository. Copy them; do not edit your global
configuration by hand if you can avoid it, because a typo there breaks every
server you have registered, not just this one.

### Claude Code

Copy `.mcp.json.example` to `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "kodro": {
      "command": "kodro-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

### Codex

Copy the block from `.codex/config.toml.example` into `~/.codex/config.toml`:

```toml
[mcp_servers.kodro]
command = "kodro-mcp"
args = []
```

### If `kodro-mcp` is not on PATH

Name the module instead. This needs no reinstall, but it hardcodes an
interpreter, so point it at the environment Kodro is installed into:

```json
{
  "mcpServers": {
    "kodro": {
      "command": "python",
      "args": ["-m", "kodro.mcp"]
    }
  }
}
```

Use `kodro.mcp`, not `kodro.mcp.server`. Both start the server and both
keep the protocol stream clean, but the second emits a `RuntimeWarning` on
stderr, because the package has already imported the module by the time runpy
executes it as `__main__`. Harmless, and a strict client will still log it as an
error and send you hunting a fault that is not there.

## Verify it

Registering a server tells you nothing about whether it works. A client that
cannot start it usually shows an empty tool list and no reason. Run the smoke
test instead, which starts the server as a real subprocess and performs the same
handshake a client does:

```bash
python scripts/smoke_mcp.py
```

Or through the platform wrapper, which finds a working interpreter first:

```powershell
.\scripts\smoke_mcp.ps1
```

```bash
./scripts/smoke_mcp.sh
```

It checks fourteen things per entry point, including the two that matter most
and are easiest to get wrong: that a bad argument fails loudly rather than being
dropped, and that non-ASCII survives the pipe in both directions. It exits
non-zero if any of them fails.

The tool and resource counts it reports are read from the server's own replies,
not written into the test, so adding a tool does not require editing it.

## What the assistant can call

Eight tools. Arguments marked `*` are required.

| Tool | Arguments | What it does |
|---|---|---|
| `list_lessons` | `keyStage`, `concept` | Lists the bundled lessons with key stage, concepts, prerequisites and line limit. Start here to find a lesson id. |
| `get_lesson` | `lessonId*`, `includeSolution` | Full brief, world, success criteria. The worked solution is opt-in. |
| `run_program` | `lessonId*`, `source*` | Runs the program in the lesson's world and returns how it terminated, where the rover stopped and every command it executed. |
| `grade_program` | `lessonId*`, `source*` | Marks against the lesson's criteria. Same grader and same reference rover as the pupil's Run button. |
| `check_api` | `nameContains` | The rover functions pupil code may call, with signatures, read live from the sandbox allow-list. |
| `validate_robot_spec` | `spec`, `path` | Validates a `.krs` robot spec and reports what the physics model will do with it. |
| `prove_contracts` | `contractId`, `runs` | Runs the property-based contract checks and returns the verdict per contract. |
| `pupil_progress` | `pupilId`, `dbPath` | Summarises local attempts, passes and per-concept strength from this machine's pupil database. |

Resources are the lesson library and the API reference, one URI each, all
`application/json`:

```
kodro://lessons/<lesson-id>
kodro://api/reference
```

They are generated from the authoritative YAML lessons and the live allow-list,
so a resource cannot drift from what the product actually does.

To confirm the current counts on your machine rather than trusting this page:

```bash
kodro-mcp --list-tools
python scripts/smoke_mcp.py
```

## What it will not do

Worth being precise about, because "an assistant can drive my machine" is a
reasonable thing to be nervous about.

- **No shell execution.** The server has no `subprocess` call and no `eval` of
  caller-supplied text. Pupil programs run in Kodro's existing sandboxed
  interpreter against an allow-list of rover functions, not in Python.
- **No network.** No `urllib`, no `requests`, no sockets anywhere in the
  package. It cannot phone home because it has nothing to phone with.
- **A named, small file surface.** Two tools touch the filesystem, both only at
  a path the caller supplies: `validate_robot_spec` reads a `.krs` file as JSON,
  and `pupil_progress` opens a SQLite pupil database. There is no general file
  read tool and no write tool. Point `pupil_progress` at a path that is not a
  Kodro database and you will get an error, not a useful answer, so treat
  `dbPath` as the pupil database it is documented to be.
- **No silent defaults.** Arguments are checked against the schema the server
  advertises. An undeclared argument is refused with a suggestion rather than
  ignored, and a missing required one names itself. This is not decoration: an
  assistant that asked for the KS3 lessons and got the whole library back
  because a filter was misspelled has no way to notice the answer is wrong.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `kodro-mcp: command not found` | The console script was never generated, or the environment is not active. | `pip install -e .` in the right environment. |
| Client shows the server as connected but lists no tools | Usually the client started a different interpreter than the one Kodro is installed in. | Run `python scripts/smoke_mcp.py` to confirm the server itself is fine, then use the absolute path to the correct interpreter in the client config. |
| `RuntimeWarning: found in sys.modules` on stderr | The config names `kodro.mcp.server`. | Change it to `kodro.mcp`. |
| Accented characters come back as `?` or `�` | The client launched the server with a non-UTF-8 stdio encoding. | Set `PYTHONUTF8=1` in the server's `env` block. The smoke test covers this case. |
| A tool answers with more rows than you asked for | An argument name is wrong. | The server now refuses these, so upgrade if you see it. `check_api` filters on `nameContains`, not `name`; `list_lessons` on `keyStage`, not `keyStages`. |

## See also

- [MCP internals](developers/mcp-server.md) for the protocol behaviours, the
  stdlib-only decision and the separation between the JSON-RPC layer and the
  tool layer.
- `tests/unit/test_mcp_server.py` for the dispatch-level tests.
- `scripts/smoke_mcp.py` for the process-level test.
