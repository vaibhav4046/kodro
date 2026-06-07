"""Contract tests for the vendored in-browser interpreter (interpreter.js).

The QA panel's #1 finding was that lesson starter code (bare verbs like
``move_forward`` / ``obstacle_ahead`` / ``collect_sample``) threw
``Name "..." is not defined`` because the design's interpreter only knew
``rover.forward``. These tests drive the real ``interpreter.js`` through
Node to prove the RoboLearn lesson API now runs and that adversarial
magnitudes are clamped. They skip cleanly where Node is unavailable.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

INTERP = (
    Path(__file__).resolve().parents[2] / "src" / "robolearn" / "assets" / "web" / "interpreter.js"
)

_NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(_NODE is None, reason="Node.js not available")


def _drive(source: str) -> dict:
    """Run ``source`` through interpreter.js under Node, return a summary dict."""
    harness = f"""
      global.window = {{}};
      const fs = require('fs');
      eval(fs.readFileSync({json.dumps(str(INTERP))}, 'utf8'));
      const RL = global.window.RoverLang;
      const SENSORS = {{distance:600,heading:0,battery:100,gravity:3.71,
                        temperature:-63,ground:0.5,light:0.8}};
      const host = {{ sensor(n) {{
        return SENSORS[n] === undefined ? 0 : SENSORS[n];
      }} }};
      const out = {{ error: null, moves: 0, prints: [], moveDist: null, turnDeg: null }};
      try {{
        let steps = 0;
        for (const ev of RL.compile({json.dumps(source)}).run(host)) {{
          if (ev.type === 'move') {{
            out.moves++; if (out.moveDist === null) out.moveDist = ev.distance;
          }}
          if (ev.type === 'turn') {{
            out.moves++; if (out.turnDeg === null) out.turnDeg = ev.deg;
          }}
          if (ev.type === 'print') out.prints.push(ev.text);
          if (++steps > 100000) {{ out.error = 'too-many-steps'; break; }}
        }}
      }} catch (e) {{ out.error = (e && e.message) || String(e); }}
      process.stdout.write(JSON.stringify(out));
    """
    proc = subprocess.run(
        [str(_NODE), "-e", harness], capture_output=True, text=True, timeout=30, check=False
    )
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def test_lesson_starter_bare_verbs_run() -> None:
    """The exact lesson-01 starter executes with no NameError."""
    r = _drive('move_forward(2)\nbeep(1)\nlog("hello rover")')
    assert r["error"] is None
    assert r["moves"] == 1
    assert "beep" in r["prints"]
    assert "hello rover" in r["prints"]


def test_square_with_loop_and_sensors() -> None:
    r = _drive(
        "set_speed(50)\n"
        "for side in range(4):\n"
        "    move_forward(1)\n"
        "    turn_right(90)\n"
        "if obstacle_ahead():\n"
        '    log("blocked")\n'
        "else:\n"
        '    log("clear")'
    )
    assert r["error"] is None
    assert r["moves"] == 8  # 4 moves + 4 turns
    assert "clear" in r["prints"]  # distance 600 > 40 -> no obstacle


def test_collect_sample_and_actions_run() -> None:
    r = _drive('scan()\ncollect_sample()\nled("cyan")\nsay("hi")')
    assert r["error"] is None
    assert "Sample collected." in r["prints"]


def test_move_metres_scaled_to_cm() -> None:
    """move_forward takes metres; the design world is cm, so it scales x100."""
    r = _drive("move_forward(2)")
    assert r["moveDist"] == 200


def test_adversarial_magnitude_is_clamped() -> None:
    """A huge but parseable distance is clamped, not left to freeze the anim."""
    r = _drive("move_forward(99999999)")
    assert r["error"] is None
    assert r["moveDist"] == 4000  # clamped (40 m world ceiling, in cm)


def test_design_rover_api_still_works() -> None:
    r = _drive("rover.forward(100)\nrover.turn_right(90)")
    assert r["error"] is None
    assert r["moves"] == 2
