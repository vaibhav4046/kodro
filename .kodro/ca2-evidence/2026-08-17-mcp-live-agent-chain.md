# MCP live agent chain, measured 17 August 2026

Every number quoted in `docs/ca2/MCP_DEMO_PROMPT.md` came off this run. It is
not a smoke test. It walks the chain a capable client actually walks when asked
to audit a lesson end to end, because the question worth answering is whether
the eight tools compose, not whether each one answers on its own.

- Commit: `f92f92f`
- Entry point: `kodro-mcp` resolved off `PATH`, launched as a separate process
- Transport: real pipes, line-delimited JSON-RPC. Nothing imports the server
- Result: exit 0, 17 request/response pairs

## Why it was re-run

The first version of this chain was driven on 17 August before
`src/robolearn/runtime/session.py` was fixed, and it is what found the defect:
a program the sandbox refused was scoring 60 out of 100, because `grade()` is
pure over the tracer and a program that never moved trivially satisfied "no
collisions". The run below is after the fix, so step 10 reads 0.

## Verbatim stdout

The final line of the real output named a scratchpad path under the machine's
user directory and has been removed here rather than published. Nothing else is
edited.

```
========================================================================
KODRO MCP -- complex agent workflow over a real stdio session
========================================================================

[1] handshake      kodro 2.0.0
    tools          8: check_api, get_lesson, grade_program, list_lessons, prove_contracts, pupil_progress, run_program, validate_robot_spec
    resources      25

[2] library        KS3 lessons: 9
    concept=debug  ['00d_fix_the_turn', '04a_fix_the_condition']

[3] lesson         00d_fix_the_turn  (KS2)
    title          Fix the Broken Program
    criteria       3
    hasSolution    True  withheld: True
    note           Worked solution withheld. Pass includeSolution=true only when the pupil has alre
    starter        3 lines: ['move_forward(1)', 'turn_right(90)', 'move_forward(2)']

[4] run starter    execution.success=True
    final state    x=2.0 y=0.0 heading=270.0 collisions=1 battery=96.44
    events         3: ['move_forward', 'turn_right', 'move_forward']

[5] grade starter  passed=False score=40
    reason         The program does not call move_forward(), turn_left(), move_forward(), in that order.
    reason         Travelled 2.0 m (minimum 3.0 m).
    reason         Recorded 1 collision(s); none were expected.

[6] check_api      24 callable: at_base, beep, clear_props, collect_sample, drop_sample, led, log, move_backward, move_forward, obstacle_ahead, pen_down, pen_up, place, read_battery, read_colour, read_distance, read_heading, sample_detected, say, scan, set_speed, turn_left, turn_right, wait
    filter 'turn'  ['turn_left', 'turn_right']

[7] grade fixed    one token changed: turn_right -> turn_left
    passed=True score=100 reasons=[]
    final state    x=2.0 y=3.0 collisions=0

[8] prove_contracts runs=3 -> {"verdict": "pass", "engine": {"id": "kodro-python-rover", "version": "2.0.0", "source_sha256": "1f6ea92dbd57bfd393dbf6be9c448507d299ee7df47ef53ab303597963a204ae"}, "runsPerContract": 3, "contractCount": 4, "contracts":
    runs=0         isError=True :: 'runs' must be at least 1.
    runs='five'    isError=True :: 'runs' must be a whole number, got a string.

[9] resource       kodro://lessons/00d_fix_the_turn
    parses as JSON keys: ['allowedConstructs', 'concepts', 'curriculumRefs', 'glossary', 'hasSolution', 'id', 'intro', 'keyStage']
    id matches tool: True

[10] bad lesson id  isError=True :: No lesson with id '00d_fix_the_turnn'. Call list_lessons for the full list.
     sandbox escape isError=False (a graded outcome, not a protocol error)
                    execution.success=False kind=sandbox line=1
                    line 1: import 'os' is not allowed
                    verdict passed=False score=0

exit 0, 17 request/response pairs
```

## Separate probe, run immediately after

`concept=debug` returns two lessons and the demo prompt says "Key Stage 2", so
the filter has to actually disambiguate. It does:

```
00d_fix_the_turn | KS2 | Fix the Broken Program
04a_fix_the_condition | KS3 | Fix the Backwards Test
KS2 count: 4
all lessons: 24
exit 0
```

## Driver

Reproduce by saving this outside the repository and running it with
`kodro-mcp` on `PATH`. It reuses `ServerProcess` and `request` from
`scripts/smoke_mcp.py` so the transport is the same code the smoke test uses.
The transcript-writing tail of the original has been dropped here because it
only wrote a local file.

```python
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

REPO = Path("D:/project/robolearn")
sys.path.insert(0, str(REPO / "scripts"))

from smoke_mcp import ServerProcess, request  # noqa: E402

TRANSCRIPT: list[dict] = []


def call(server: ServerProcess, rid: int, method: str, params: dict) -> dict:
    server.send(request(rid, method, params))
    reply = server.read()
    TRANSCRIPT.append({"id": rid, "method": method, "params": params, "reply": reply})
    return reply


def tool(server: ServerProcess, rid: int, name: str, args: dict) -> dict:
    return call(server, rid, "tools/call", {"name": name, "arguments": args})


def structured(reply: dict) -> dict:
    return reply["result"].get("structuredContent", {})


def is_error(reply: dict) -> bool:
    return bool(reply.get("result", {}).get("isError"))


def text_of(reply: dict) -> str:
    content = reply.get("result", {}).get("content") or []
    return content[0]["text"] if content else ""


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    exe = shutil.which("kodro-mcp")
    if not exe:
        print("FAIL kodro-mcp not on PATH")
        return 1
    server = ServerProcess([exe])
    rid = 0

    def nxt() -> int:
        nonlocal rid
        rid += 1
        return rid

    reply = call(
        server,
        nxt(),
        "initialize",
        {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "kodro-complex-driver", "version": "1"},
        },
    )
    info = reply["result"]["serverInfo"]
    print(f"\n[1] handshake      {info['name']} {info['version']}")

    reply = call(server, nxt(), "tools/list", {})
    tools = reply["result"]["tools"]
    reply = call(server, nxt(), "resources/list", {})
    resources = reply["result"]["resources"]
    print(f"    tools          {len(tools)}: {', '.join(sorted(t['name'] for t in tools))}")
    print(f"    resources      {len(resources)}")

    reply = tool(server, nxt(), "list_lessons", {"keyStage": "KS3"})
    ks3 = structured(reply)["lessons"]
    reply = tool(server, nxt(), "list_lessons", {"concept": "debug"})
    debug_lessons = structured(reply)["lessons"]
    print(f"\n[2] library        KS3 lessons: {len(ks3)}")
    print(f"    concept=debug  {[lsn['id'] for lsn in debug_lessons]}")

    target = "00d_fix_the_turn"

    reply = tool(server, nxt(), "get_lesson", {"lessonId": target})
    lesson = structured(reply)
    starter = lesson["starterCode"]
    criteria = lesson["successCriteria"]
    print(f"\n[3] lesson         {target}  ({lesson['keyStage']})")
    print(f"    title          {lesson['title']}")
    print(f"    criteria       {len(criteria)}")
    print(f"    hasSolution    {lesson['hasSolution']}  withheld: {'solution' not in lesson}")
    print(f"    note           {lesson['solutionNote'][:80]}")
    print(f"    starter        {len(starter.splitlines())} lines: {starter.strip().splitlines()}")

    reply = tool(server, nxt(), "run_program", {"lessonId": target, "source": starter})
    run = structured(reply)
    fs = run["finalState"]
    print(f"\n[4] run starter    execution.success={run['execution']['success']}")
    print(f"    final state    x={fs['x']} y={fs['y']} heading={fs['headingDeg']} "
          f"collisions={fs['collisions']} battery={fs['batteryPct']}")
    print(f"    events         {run['eventCount']}: "
          f"{[e['name'] for e in run['events']]}")

    reply = tool(server, nxt(), "grade_program", {"lessonId": target, "source": starter})
    graded = structured(reply)
    verdict = graded["verdict"]
    print(f"\n[5] grade starter  passed={verdict['passed']} score={verdict['score']}")
    for r in verdict["reasons"]:
        print(f"    reason         {r if isinstance(r, str) else json.dumps(r)}")

    reply = tool(server, nxt(), "check_api", {})
    api = structured(reply)
    fns = api.get("functions") or api.get("api") or []
    names = sorted(f["name"] if isinstance(f, dict) else str(f) for f in fns)
    print(f"\n[6] check_api      {len(names)} callable: {', '.join(names)}")
    reply = tool(server, nxt(), "check_api", {"nameContains": "turn"})
    turn_fns = structured(reply).get("functions") or []
    print(f"    filter 'turn'  {[f['name'] if isinstance(f, dict) else f for f in turn_fns]}")

    fixed = starter.replace("turn_right", "turn_left")
    reply = tool(server, nxt(), "grade_program", {"lessonId": target, "source": fixed})
    fixed_graded = structured(reply)
    fv = fixed_graded["verdict"]
    ffs = fixed_graded["finalState"]
    print(f"\n[7] grade fixed    one token changed: turn_right -> turn_left")
    print(f"    passed={fv['passed']} score={fv['score']} reasons={fv['reasons']}")
    print(f"    final state    x={ffs['x']} y={ffs['y']} collisions={ffs['collisions']}")

    reply = tool(server, nxt(), "prove_contracts", {"runs": 3})
    contracts = structured(reply)
    print(f"\n[8] prove_contracts runs=3 -> {json.dumps(contracts)[:220]}")

    reply = tool(server, nxt(), "prove_contracts", {"runs": 0})
    print(f"    runs=0         isError={is_error(reply)} :: {text_of(reply)[:100]}")
    reply = tool(server, nxt(), "prove_contracts", {"runs": "five"})
    print(f"    runs='five'    isError={is_error(reply)} :: {text_of(reply)[:100]}")

    lesson_uris = [r["uri"] for r in resources if target in r["uri"]]
    if lesson_uris:
        reply = call(server, nxt(), "resources/read", {"uri": lesson_uris[0]})
        body = reply["result"]["contents"][0]["text"]
        parsed = json.loads(body)
        print(f"\n[9] resource       {lesson_uris[0]}")
        print(f"    parses as JSON keys: {sorted(parsed)[:8]}")
        print(f"    id matches tool: {parsed.get('id') == lesson.get('id')}")

    reply = tool(server, nxt(), "get_lesson", {"lessonId": target + "n"})
    print(f"\n[10] bad lesson id  isError={is_error(reply)} :: {text_of(reply)[:90]}")
    reply = tool(server, nxt(), "grade_program",
                 {"lessonId": target, "source": "import os\nos.system('echo pwned')\n"})
    esc = structured(reply)
    print(f"     sandbox escape isError={is_error(reply)} (a graded outcome, not a protocol error)")
    print(f"                    execution.success={esc['execution']['success']} "
          f"kind={esc['execution']['errorKind']} line={esc['execution']['errorLine']}")
    print(f"                    {esc['execution']['errorMessage']}")
    print(f"                    verdict passed={esc['verdict']['passed']} score={esc['verdict']['score']}")

    code = server.close()
    print(f"\nexit {code}, {len(TRANSCRIPT)} request/response pairs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

## What this does not show

`pupil_progress` and `validate_robot_spec` are in the handshake count of eight
and are not called by this chain. Their coverage is in
`tests/unit/test_mcp_server.py`, not here, and
`docs/ca2/MCP_DEMO_PROMPT.md` says so rather than letting "eight tools" imply
eight calls.

The wording of a sandbox rejection is not identical across surfaces and this run
does not claim it is. Python returns `line 1: import 'os' is not allowed`; the
browser grader returns `syntax: Unexpected token "os".` They are different
interpreters. The score and the single-reason shape agree, which is the claim
the fix was for.
