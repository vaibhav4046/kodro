"""Pupil code reaches the DOM through dangerouslySetInnerHTML. It must be inert.

``Editor.jsx`` renders the syntax highlighter's output with
``dangerouslySetInnerHTML``, and the highlighter's input is whatever a pupil
types or an imported project carries. That is a raw-HTML sink fed by untrusted
text, which is the classic shape of a stored XSS in a product used by children.

The highlighter is safe today: every branch either passes the text through
``esc()`` or emits a word matched by ``[A-Za-z_][A-Za-z0-9_]*``, which cannot
carry markup. That safety is a property of the branch structure and is asserted
nowhere, so a token type added later without ``esc()`` would ship silently.

The fixture extracts the real functions out of ``Editor.jsx`` rather than
copying them, so this fails when the shipped highlighter changes, not when a
copy drifts. Skips where Node is absent.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "src" / "kodro" / "assets" / "web"
FIXTURE = ROOT / "tests" / "fixtures" / "editor_highlight_xss.cjs"
EDITOR = WEB / "Editor.jsx"
_NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(_NODE is None, reason="Node.js not available")


@pytest.fixture(scope="module")
def highlighted() -> dict:
    proc = subprocess.run(
        [str(_NODE), str(FIXTURE), str(WEB)],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout.strip().splitlines()[-1])
    assert "error" not in payload, payload.get("error")
    return payload


def test_the_harness_really_runs_the_highlighter(highlighted: dict) -> None:
    """Guard the guard: an extraction that silently did nothing would pass."""
    sanity = highlighted["sanity"]
    assert sanity["highlighterProducesSpans"], (
        "the extracted highlighter emitted no token spans, so it is not running"
    )
    assert sanity["detectorCatchesForeignTags"], (
        "the leak detector does not flag foreign markup, so it proves nothing"
    )


def test_no_payload_survives_as_live_markup(highlighted: dict) -> None:
    escaped = {
        attack: outcome["leaked"]
        for attack, outcome in highlighted["results"].items()
        if not outcome["safe"]
    }
    assert not escaped, (
        "the highlighter emitted markup it did not author, which lands in the DOM "
        f"through dangerouslySetInnerHTML: {escaped}"
    )


def test_every_dangerous_sink_in_the_editor_is_the_known_one() -> None:
    """A second raw-HTML sink in this file would not be covered by the test above."""
    text = EDITOR.read_text(encoding="utf-8")
    sinks = [
        line.strip()
        for line in text.splitlines()
        if "dangerouslySetInnerHTML" in line or ".innerHTML" in line
    ]
    assert len(sinks) == 1, (
        f"Editor.jsx now has {len(sinks)} raw-HTML sinks rather than the one this "
        f"test covers. Each needs its input proven inert: {sinks}"
    )
    assert "highlighted" in sinks[0], (
        f"the raw-HTML sink no longer renders the highlighter output: {sinks[0]}"
    )
