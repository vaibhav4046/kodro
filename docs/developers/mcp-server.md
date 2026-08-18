# MCP server

Kodro ships a Model Context Protocol server so an AI assistant can read the
lesson library, run pupil code in the real sandbox and mark it with the real
grader. The point is that an assistant helping a pupil gives the same verdict
the pupil's own Run button gives. Without this, the assistant guesses, and a
guess that contradicts the grader is worse than no help at all.

The server runs offline. No tool in it opens a socket, and there is a test that
proves it: `test_the_server_never_reaches_the_network` monkeypatches
`socket.socket` and `socket.create_connection` to raise, then calls every tool.

## Starting it

```bash
kodro-mcp
```

It speaks newline-delimited JSON-RPC 2.0 on stdin and stdout. Nothing else is
written to stdout, because a stray `print` corrupts the stream; diagnostics,
`--help` and `--list-tools` all go to stderr.

Register it with any MCP client:

```json
{"mcpServers": {"kodro": {"command": "kodro-mcp"}}}
```

If Kodro was installed from source rather than as a package, point the client at
the module instead:

```json
{"mcpServers": {"kodro": {"command": "python", "args": ["-m", "kodro.mcp"]}}}
```

`kodro.mcp`, not `kodro.mcp.server`. Both start the server and both keep
stdout clean, but naming the submodule makes runpy emit a `RuntimeWarning` on
stderr, because `robolearn/mcp/__init__.py` has already imported it by the time
runpy runs it as `__main__`. It is only noise, and a strict client logs noise on
stderr as an error.

This page covers the internals. For installation, client registration and the
smoke tests, see [Connect an assistant (MCP)](../mcp.md).

## Protocol

Implements `initialize`, `ping`, `tools/list`, `tools/call`, `resources/list`
and `resources/read`. Advertised protocol versions are `2025-06-18` (default)
and `2024-11-05`; a client asking for either gets it echoed back, anything else
gets the newer one and is free to disconnect.

Two behaviours are worth knowing because they are easy to get wrong:

- A message with no `id` is a notification and is answered with silence, even
  when the method is unknown. Replying to one desynchronises strict clients:
  they are not waiting for a frame, so the next response they read is the wrong
  one and every id after that is off by one.
- A tool that fails returns `isError: true` content, not a JSON-RPC error. The
  spec draws that line so the model reads the message and corrects itself. An
  RPC error tells the client the server is broken.

The transport is hand-rolled on the standard library rather than pulled from
PyPI. The product's claim is that it runs on a school laptop with no account and
no network; an MCP server that needed `pip install mcp` to start would put a
hole in that claim.

## Tools

| Tool | What it does |
| --- | --- |
| `list_lessons` | The bundled lessons with key stage, computational-thinking concepts, prerequisites and line limit. Start here for a lesson id. |
| `get_lesson` | One lesson in full: brief, starter code, success criteria, arena layout, glossary. The worked solution is withheld unless `includeSolution` is set. |
| `run_program` | Runs pupil code against a lesson's world in the sandboxed interpreter. Returns how it terminated, the final rover state and the command trace. |
| `grade_program` | Marks a program against the success criteria. Same grader, same reference rover as the Run button. Returns pass/fail, a 0-100 score and one reason per failed criterion. |
| `check_api` | The rover functions pupil code may call, read live from the sandbox's own allow-list. |
| `validate_robot_spec` | Validates a `.krs` build exported from the Robot Lab and reports the mass, wheel count and degrees of freedom the simulator derives from it. |
| `prove_contracts` | Re-runs the physics contracts on fixed seeds. Answers "did the simulation change?". |
| `pupil_progress` | Summarises the local pupil database: attempts, lessons passed, per-concept strength. Nothing leaves the machine. |

`check_api` matters more than its size suggests. Every model that has been asked
to help with Kodro code has, at some point, invented a rover function that does
not exist. The tool reads the allow-list the sandbox itself enforces, so the
answer cannot drift from what the interpreter accepts.

List them from the terminal without starting a session:

```bash
kodro-mcp --list-tools
```

## Resources

The API reference is exposed at `kodro://api/reference`, and every bundled
lesson at `kodro://lessons/<id>`, so a client can pull a brief into context
without a tool call.

## Tests

`tests/unit/test_mcp_server.py` covers the protocol layer and all eight tools.
The tools run against the real lesson library and the real physics rather than
mocks: a mock would happily agree with a grader that had drifted, which is the
one failure this server exists to prevent. One test asserts `grade_program`
returns the same verdict and score as calling `run_against_lesson` directly.
