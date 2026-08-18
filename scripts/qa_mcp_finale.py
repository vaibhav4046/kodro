#!/usr/bin/env python3
"""Pin the CA2 MCP demonstration to the live server.

``docs/ca2/MCP_DEMO_PROMPT.md`` writes down the eleven calls of the recorded MCP
finale and, next to each one, the value that will be visible on screen when it
runs: a score of 40, a battery of 96.44, three reasons quoted word for word. Those
numbers are spoken aloud over a screen recording. A drifted one is not a failing
test, it is a wrong sentence in a submitted video, and nothing else in the
repository would catch it, because the document is prose and the server is code.

This script drives the real server as a subprocess and asserts every one of those
documented values against the response it actually returns. It is meant to be run
on the recording day, immediately before capture, which is what
``docs/ca2/CLAIM_LEDGER.md`` asks for in general terms and this covers for the MCP
block in particular.

It therefore does the opposite of ``scripts/smoke_mcp.py``, on purpose. That
script refuses to write counts down, because a smoke test asserting "8 tools"
has to be edited whenever a tool is added and the edit that keeps it passing
looks exactly like the edit that hides a regression. The reasoning is right for a
smoke test and wrong here: the count is already written down, in a document, and
the only useful question is whether the document is still true. So the numbers
are hardcoded deliberately. If a tool is added and this fails, the fix is to
update the document and then this file, in that order, not to relax the check.

Usage::

    python scripts/qa_mcp_finale.py

Exit status is 0 only if every documented value matched.
"""

from __future__ import annotations

import itertools
import json
import subprocess
import sys

FAILED: list[str] = []
_IDS = itertools.count(1)


def ok(cond, label, got=""):
    print(("PASS  " if cond else "FAIL  ") + label + (f"  -> {str(got)[:90]}" if got != "" else ""))
    if not cond:
        FAILED.append(label)


proc = subprocess.Popen(
    [sys.executable, "-m", "robolearn.mcp.server"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.DEVNULL,
    text=True,
    encoding="utf-8",
    bufsize=1,
)


def rpc(method, params=None):
    payload = {"jsonrpc": "2.0", "id": next(_IDS), "method": method, "params": params or {}}
    proc.stdin.write(json.dumps(payload) + "\n")
    proc.stdin.flush()
    return json.loads(proc.stdout.readline())


def tool(name, args):
    """Return (payload, isError). Payload is the parsed JSON body of the text blocks."""
    result = rpc("tools/call", {"name": name, "arguments": args})["result"]
    text = "".join(c.get("text", "") for c in result.get("content", []))
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        payload = text
    return payload, bool(result.get("isError"))


# 1. initialize
init = rpc(
    "initialize",
    {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "ca2-finale", "version": "0"},
    },
)["result"]
info = init["serverInfo"]
ok(
    info["name"] == "kodro" and info["version"] == "2.1.0",
    "1  initialize -> kodro 2.1.0",
    info["name"] + " " + info["version"],
)
proc.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n")
proc.stdin.flush()

# 2. tools/list -> 8, resources/list -> 25
tools = rpc("tools/list")["result"]["tools"]
ok(len(tools) == 8, "2  tools/list -> 8 tools", len(tools))
resources = rpc("resources/list")["result"]["resources"]
ok(len(resources) == 25, "   resources/list -> 25 resources", len(resources))

# 3. list_lessons concept=debug
p, _ = tool("list_lessons", {"concept": "debug"})
raw = p["lessons"] if isinstance(p, dict) and "lessons" in p else p
ids = [item["id"] if isinstance(item, dict) else item for item in raw]
ok(
    ids == ["00d_fix_the_turn", "04a_fix_the_condition"],
    "3  list_lessons concept=debug -> the two debugging lessons",
    ids,
)

# 4. get_lesson
p, _ = tool("get_lesson", {"lessonId": "00d_fix_the_turn"})
ok(p.get("keyStage") == "KS2", "4  get_lesson -> KS2", p.get("keyStage"))
ok(p.get("title") == "Fix the Broken Program", "   title", p.get("title"))
ok(len(p.get("successCriteria", [])) == 3, "   3 criteria", len(p.get("successCriteria", [])))
ok(p.get("hasSolution") is True, "   hasSolution true", p.get("hasSolution"))
note = p.get("solutionNote", "")
ok(
    "withheld" in note and "turn_left(" not in json.dumps(p),
    "   solution withheld, no program leaked",
    note[:60],
)
starter = p.get("starterCode", "")
body = [line for line in starter.splitlines() if line.strip()]
ok(len(body) == 3, "   starter of 3 lines", len(body))
BROKEN = starter

# 5. run_program on the broken starter
p, _ = tool("run_program", {"lessonId": "00d_fix_the_turn", "source": BROKEN})
ok(p["execution"]["success"] is True, "5  run_program success true", p["execution"]["success"])
fin = p["finalState"]
sig = (fin["x"], fin["y"], fin["headingDeg"], fin["collisions"], fin["batteryPct"])
ok(
    sig == (2.0, 0.0, 270.0, 1, 96.44),
    "   ends x=2.0 y=0.0 heading=270.0 collisions=1 battery=96.44",
    sig,
)
ok(len(p.get("events", [])) == 3 and p["eventCount"] == 3, "   3 events", p["eventCount"])

# 6. grade_program on the broken starter -> 40, three reasons word for word
p, _ = tool("grade_program", {"lessonId": "00d_fix_the_turn", "source": BROKEN})
g = p["verdict"]
ok(g["passed"] is False, "6  grade_program passed false", g["passed"])
ok(g["score"] == 40, "   score 40", g["score"])
EXPECT = [
    "The program does not call move_forward(), turn_left(), move_forward(), in that order.",
    "Travelled 2.0 m (minimum 3.0 m).",
    "Recorded 1 collision(s); none were expected.",
]
ok(g["reasons"] == EXPECT, "   three reasons word for word", g["reasons"])

# 7. check_api
p, _ = tool("check_api", {})
fns = p.get("functions", p if isinstance(p, list) else [])
ok(len(fns) == 24, "7  check_api -> 24 callable functions", len(fns))
p, _ = tool("check_api", {"nameContains": "turn"})
filtered = p.get("functions", p if isinstance(p, list) else [])
names = sorted(f["name"] if isinstance(f, dict) else f for f in filtered)
ok(names == ["turn_left", "turn_right"], "   filtered on turn -> exactly two", names)

# 8. grade_program on the one-token edit -> 100
FIXED = BROKEN.replace("turn_right", "turn_left")
p, _ = tool("grade_program", {"lessonId": "00d_fix_the_turn", "source": FIXED})
g = p["verdict"]
ok(g["passed"] is True, "8  edited program passed true", g["passed"])
ok(g["score"] == 100, "   score 100", g["score"])
ok(not g["reasons"], "   no reasons", g["reasons"])
fin = p["finalState"]
ok(
    (fin["x"], fin["y"], fin["collisions"]) == (2.0, 3.0, 0),
    "   ends x=2.0 y=3.0 collisions=0",
    (fin["x"], fin["y"], fin["collisions"]),
)

# 9. sandbox escape -> score 0, and not a protocol error
p, is_err = tool("grade_program", {"lessonId": "00d_fix_the_turn", "source": "import os\n"})
ok(not is_err, "9  sandbox escape is not a protocol error", is_err)
ex = p["execution"]
ok(ex["success"] is False, "   execution.success false", ex["success"])
ok(ex["errorKind"] == "sandbox", "   errorKind=sandbox", ex["errorKind"])
ok(ex["errorLine"] == 1, "   line 1", ex["errorLine"])
ok(
    p["verdict"]["score"] == 0,
    "   score 0, not 60 for a program that never ran",
    p["verdict"]["score"],
)

# 10. near-miss lesson id -> isError naming the miss
p, is_err = tool("get_lesson", {"lessonId": "00d_fix_the_turnn"})
ok(
    is_err and "00d_fix_the_turnn" in str(p),
    "10 near-miss id -> isError naming it",
    str(p)[:80],
)

# 11. prove_contracts runs:0 -> refusal, not a silent default
p, is_err = tool("prove_contracts", {"runs": 0})
ok(
    is_err and "'runs' must be at least 1." in str(p),
    "11 runs:0 refused rather than defaulted to 1",
    str(p)[:80],
)

proc.stdin.close()
proc.wait(timeout=20)
print("")
print(
    "CHAIN CLEAN: every documented value matches the live server"
    if not FAILED
    else "DRIFTED: " + "; ".join(FAILED)
)
sys.exit(1 if FAILED else 0)
