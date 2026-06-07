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


def _drive_prints(src: str) -> list:
    """Drive a program and return its print outputs (for control-flow tests)."""
    harness = f"""
      global.window = {{}};
      const fs = require('fs');
      eval(fs.readFileSync({json.dumps(str(INTERP))}, 'utf8'));
      const host = {{ sensor() {{ return 0; }} }};
      const out = [];
      try {{
        for (const ev of global.window.RoverLang.compile({json.dumps(src)}).run(host)) {{
          if (ev.type === 'print') out.push(ev.text);
        }}
        process.stdout.write(JSON.stringify({{ error: null, prints: out }}));
      }} catch (e) {{
        const msg = (e && e.message) || String(e);
        process.stdout.write(JSON.stringify({{ error: msg, prints: out }}));
      }}
    """
    proc = subprocess.run(
        [str(_NODE), "-e", harness], capture_output=True, text=True, timeout=30, check=False
    )
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def test_nested_if_else_links_inner_else() -> None:
    """A nested if/else inside an if-body must execute (was 'Unknown statement')."""
    src = (
        "if 1 > 0:\n"
        "    if 2 > 1:\n"
        '        print("a")\n'
        "    else:\n"
        '        print("b")\n'
        '    print("c")\n'
        "else:\n"
        '    print("d")'
    )
    r = _drive_prints(src)
    assert r["error"] is None, r["error"]
    assert r["prints"] == ["a", "c"]


def test_nested_if_else_takes_inner_else_branch() -> None:
    src = (
        "if 1 > 0:\n"
        "    if 2 < 1:\n"
        '        print("a")\n'
        "    else:\n"
        '        print("b")\n'
        "else:\n"
        '    print("d")'
    )
    r = _drive_prints(src)
    assert r["error"] is None, r["error"]
    assert r["prints"] == ["b"]


def test_user_function_returns_value_in_expression() -> None:
    """A pure helper called in an expression returns its value (was NameError)."""
    r = _drive_prints("def double(x):\n    return x * 2\n\narea = double(5)\nprint(area)")
    assert r["error"] is None, r["error"]
    assert r["prints"] == ["10"]


def test_recursive_function_returns_value() -> None:
    r = _drive_prints(
        "def fact(n):\n"
        "    if n < 2:\n"
        "        return 1\n"
        "    return n * fact(n - 1)\n"
        "\n"
        "print(fact(5))"
    )
    assert r["error"] is None, r["error"]
    assert r["prints"] == ["120"]


def test_function_without_return_yields_none() -> None:
    r = _drive_prints("def noop():\n    return\n\nx = noop()\nprint(x)")
    assert r["error"] is None, r["error"]
    assert r["prints"] == ["None"]


def test_python_style_equality() -> None:
    """== matches CPython: True==1, False==0, list element-wise, int==float."""
    r = _drive_prints(
        "print(True == 1)\n"
        "print(False == 0)\n"
        "print([1, 2] == [1, 2])\n"
        "print(2 == 2.0)\n"
        "print(1 != 2)"
    )
    assert r["error"] is None, r["error"]
    assert r["prints"] == ["True", "True", "True", "True", "True"]


def test_nested_if_else_inside_loop() -> None:
    """Nested if/elif/else inside a for-loop (the autopilot's control shape)."""
    src = (
        "for i in range(3):\n"
        "    if i > 0:\n"
        "        if i > 1:\n"
        '            print("big")\n'
        "        else:\n"
        '            print("one")\n'
        "    else:\n"
        '        print("zero")'
    )
    r = _drive_prints(src)
    assert r["error"] is None, r["error"]
    assert r["prints"] == ["zero", "one", "big"]


def test_nonfinite_distance_via_power_clamps_to_lower_bound() -> None:
    """``10 ** 400`` -> Infinity is the only infinity a pupil can actually type
    (the tokenizer lexes ``1e308`` as the name ``e308``). A non-finite magnitude
    clamps to the lower bound -- matching the Python engine's
    ``rover_api._clamp_finite`` -- and, being finite, can never overflow
    app.jsx's animation duration to Infinity and soft-hang the UI."""
    r = _drive("rover.forward(10 ** 400)")
    assert r["error"] is None
    assert r["moveDist"] == 0

    r = _drive("move_forward(10 ** 400)")
    assert r["error"] is None
    assert r["moveDist"] == 0


def test_adversarial_turn_magnitude_is_clamped() -> None:
    """A huge turn clamps to +/-3600 deg (10 full turns) so animateTurn, which
    has no collision early-exit, cannot spin for hours (turn_left(1e9) was
    ~1000 h). Non-finite -> lower bound, exactly as Python turn_left/right do."""
    assert abs(_drive("turn_left(10 ** 400)")["turnDeg"]) == 3600
    assert abs(_drive("turn_right(999999999)")["turnDeg"]) == 3600


def _frame_progress() -> dict:
    """Evaluate ``RoverLang.frameProgress`` -- the frame-loop guard shared with
    app.jsx ``frames()`` -- under Node across pathological and normal durations.
    Inf/NaN cannot cross JSON, so the cases are built in JS."""
    harness = f"""
      global.window = {{}};
      const fs = require('fs');
      eval(fs.readFileSync({json.dumps(str(INTERP))}, 'utf8'));
      const fp = global.window.RoverLang.frameProgress;
      process.stdout.write(JSON.stringify({{
        infinite: fp(0, Infinity),
        nan: fp(0, NaN),
        zero: fp(0, 0),
        negative: fp(0, -5),
        hugeElapsed: fp(1e308 * 10, 100),
        midway: fp(50, 100),
        past_end: fp(999, 100),
      }}));
    """
    proc = subprocess.run(
        [str(_NODE), "-e", harness], capture_output=True, text=True, timeout=30, check=False
    )
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def test_frame_progress_always_terminates() -> None:
    """frames() reschedules until p>=1, so the guard must yield 1 for any
    non-finite or non-positive duration -- otherwise the ~60fps loop wedges at
    p=0 forever (the original forward(<huge>) soft-hang). Finite durations
    advance normally and saturate at 1 past the end."""
    fp = _frame_progress()
    assert fp["infinite"] == 1
    assert fp["nan"] == 1
    assert fp["zero"] == 1
    assert fp["negative"] == 1
    assert fp["hugeElapsed"] == 1
    assert fp["midway"] == 0.5
    assert fp["past_end"] == 1
