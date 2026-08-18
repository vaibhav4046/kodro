"""The desktop app and the website must agree on what a ``.kodro`` file means.

Two implementations of one file format is a promise that decays: the browser's
``assets/web/project.js`` and Python's :mod:`kodro.interop.kodro_project`
can drift apart the moment either is edited, and the failure mode is silent --
a pupil's project opens on one half of the ecosystem and quietly loses its
programs on the other.

So the parity tests here do not assert against a hand-copied expectation. They
run the REAL ``project.js`` in Node against the same inputs and diff the two
answers, in both directions. If Node is not installed the parity tests skip
(and say so); the semantic tests below still run, because they are the ones
that catch a bad refactor of the Python side on its own.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from kodro.interop import kodro_project as kp

WEB_DIR = Path(__file__).resolve().parents[2] / "src" / "kodro" / "assets" / "web"
PROJECT_JS = WEB_DIR / "project.js"

#: Node driver: loads project.js the way the browser does (a bare IIFE against
#: a window shim with a localStorage stub) and prints validate()'s verdict.
NODE_DRIVER = """
const fs = require('fs');
// argv is [node, thisScript, projectJs, candidate] -- argv[1] is the driver itself.
const src = fs.readFileSync(process.argv[2], 'utf8');
const store = new Map();
const win = {
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  },
};
new Function('window', src)(win);
const text = fs.readFileSync(process.argv[3], 'utf8');
const out = win.KodroProject.validate(text);
process.stdout.write(JSON.stringify({
  ok: !!out.ok,
  errors: out.errors || [],
  warnings: out.warnings || [],
  fileName: out.ok ? win.KodroProject.fileName(out.doc) : null,
}));
"""


def _node() -> str | None:
    return shutil.which("node")


def _validate_in_node(tmp_path: Path, text: str) -> dict:
    """Run the browser's own validate() over ``text`` and return its verdict."""
    driver = tmp_path / "driver.cjs"
    driver.write_text(NODE_DRIVER, encoding="utf-8")
    doc = tmp_path / "candidate.kodro"
    doc.write_text(text, encoding="utf-8")
    proc = subprocess.run(
        # Fixed argv, no shell, test-local paths.
        [str(_node()), str(driver), str(PROJECT_JS), str(doc)],
        capture_output=True,
        text=True,
        # Node writes UTF-8; Windows would otherwise decode it as cp1252 and
        # mangle any non-Latin robot name on the way back.
        encoding="utf-8",
        timeout=60,
        check=False,
    )
    assert proc.returncode == 0, f"node driver failed: {proc.stderr}"
    return json.loads(proc.stdout)


#: The one sentence the two engines cannot say identically: the text after
#: "Not valid JSON: " comes from the host parser (CPython's json vs V8), and
#: neither is ours to rewrite. Parity is asserted on the stem -- the part the
#: pupil reads as an explanation -- not on the parser's positional detail.
_PARSER_STEM = "Not valid JSON: "


def _comparable(errors: list[str]) -> list[str]:
    return [_PARSER_STEM if e.startswith(_PARSER_STEM) else e for e in errors]


needs_node = pytest.mark.skipif(
    _node() is None, reason="node is not installed; parity unverifiable"
)


# --- what the format means -------------------------------------------------


def test_a_document_written_by_python_reads_back_identically() -> None:
    doc = kp.new_document(program="move_forward(2)\nturn_left(90)", tab="drive", world="mars")
    result = kp.read_text(kp.to_json(doc))
    assert result.ok
    assert result.document is not None
    assert result.document.program() == "move_forward(2)\nturn_left(90)"
    assert result.document.world == "mars"


def test_refusals_use_the_same_sentences_as_the_browser() -> None:
    assert kp.read_text("").errors == ("Empty project file.",)
    assert kp.read_text("{not json").errors[0].startswith("Not valid JSON: ")
    assert kp.read_text("[]").errors == ("Project file must be a JSON object.",)
    assert kp.read_text('{"kodroProject": 2}').errors == (
        'Not a Kodro project file (missing "kodroProject": 1).',
    )
    assert kp.read_text("x" * (kp.MAX_TEXT + 1)).errors == ("Project file is larger than 2 MB.",)


def test_a_wrong_typed_field_is_reset_rather_than_fatal() -> None:
    result = kp.read_text(json.dumps({"kodroProject": 1, "world": 42, "tod": "x" * 200}))
    assert result.ok
    assert result.document is not None
    assert result.document.world == "earth"
    assert result.document.tod == "noon"
    assert any('"world"' in w for w in result.warnings)
    assert any('"tod"' in w for w in result.warnings)


def test_an_oversized_or_non_text_program_is_dropped_not_loaded() -> None:
    result = kp.read_text(
        json.dumps(
            {
                "kodroProject": 1,
                "programs": {"drive": "x" * (kp.MAX_PROGRAM + 1), "arm": 7, "blocks": "ok"},
            }
        )
    )
    assert result.ok
    assert result.document is not None
    assert result.document.programs == {"blocks": "ok"}
    # Each dropped buffer is named, so a pupil can tell which of their tabs was
    # lost and why -- an unexplained empty editor is the failure to avoid here.
    assert 'program "drive" exceeds 100 KB; dropped.' in result.warnings
    assert 'program "arm" is not text; dropped.' in result.warnings


def test_a_broken_actuators_field_cannot_brick_the_studio() -> None:
    # A hand-edited file with "actuators": {} used to be persisted raw and then
    # throw at module init on the next load. Both halves coerce it instead.
    result = kp.read_text(
        json.dumps({"kodroProject": 1, "spec": {"name": "Rover", "actuators": {}, "sensors": None}})
    )
    assert result.ok
    assert result.document is not None
    assert result.document.spec is not None
    assert result.document.spec["actuators"] == []


def test_a_structurally_impossible_physical_block_is_an_error() -> None:
    result = kp.read_text(json.dumps({"kodroProject": 1, "spec": {"physical": "heavy"}}))
    assert not result.ok
    assert result.errors == ('"spec.physical" must be an object (a measured KRS block).',)


def test_lists_are_capped_and_the_loss_is_reported() -> None:
    result = kp.read_text(
        json.dumps(
            {
                "kodroProject": 1,
                "memory": {"reflections": [{"n": i} for i in range(kp.MAX_LIST + 5)]},
            }
        )
    )
    assert result.ok
    assert result.document is not None
    assert len(result.document.reflections) == kp.MAX_LIST
    assert any("reflections" in w for w in result.warnings)


def test_the_file_name_survives_a_non_latin_robot_name() -> None:
    doc = kp.read_text(json.dumps({"kodroProject": 1, "spec": {"name": "Марсоход 3"}})).document
    assert doc is not None
    assert kp.file_name(doc) == "марсоход-3.kodro"
    assert kp.file_name(None) == "kodro-project.kodro"


def test_a_stale_tab_pointer_still_finds_the_only_program() -> None:
    stale = {"kodroProject": 1, "tab": "arm", "programs": {"drive": "go"}}
    result = kp.read_text(json.dumps(stale))
    assert result.document is not None
    assert result.document.program() == "go"


def test_writing_and_reading_a_file_round_trips(tmp_path: Path) -> None:
    doc = kp.new_document(program="wait(1)", world="underwater")
    written = kp.write_file(tmp_path / "sub" / "rover.kodro", doc)
    assert written.exists()
    back = kp.read_file(written)
    assert back.ok
    assert back.document is not None
    assert back.document.program() == "wait(1)"


def test_a_missing_file_is_an_error_not_a_crash(tmp_path: Path) -> None:
    result = kp.read_file(tmp_path / "nope.kodro")
    assert not result.ok
    assert result.errors and "Could not read" in result.errors[0]


# --- parity with the browser implementation --------------------------------

#: Inputs chosen for where the two implementations could plausibly disagree:
#: type coercion, the caps, the version gate, and Unicode naming.
PARITY_CASES: list[tuple[str, str]] = [
    ("empty", ""),
    ("not-json", "{oh no"),
    ("array", "[]"),
    ("wrong-version", json.dumps({"kodroProject": 2})),
    ("no-version", json.dumps({"hello": "world"})),
    ("minimal", json.dumps({"kodroProject": 1})),
    ("typed-wrong", json.dumps({"kodroProject": 1, "world": 42, "quality": ["high"]})),
    ("long-field", json.dumps({"kodroProject": 1, "theme": "x" * 65})),
    ("bad-actuators", json.dumps({"kodroProject": 1, "spec": {"name": "R", "actuators": {}}})),
    ("bad-physical", json.dumps({"kodroProject": 1, "spec": {"physical": "heavy"}})),
    (
        "bad-mass",
        json.dumps({"kodroProject": 1, "spec": {"physical": {"massKg": -3, "drive": "x"}}}),
    ),
    ("bad-programs", json.dumps({"kodroProject": 1, "programs": {"drive": 7}})),
    ("programs-not-object", json.dumps({"kodroProject": 1, "programs": []})),
    ("overflow-list", json.dumps({"kodroProject": 1, "runReports": [{"i": i} for i in range(70)]})),
    ("junk-in-list", json.dumps({"kodroProject": 1, "scenarioReports": [1, "two", {"ok": 1}]})),
    ("unicode-name", json.dumps({"kodroProject": 1, "spec": {"name": "Марсоход 3"}})),
    ("symbol-name", json.dumps({"kodroProject": 1, "spec": {"name": "!!! ??? ---"}})),
    # JSON null is not the same as an absent key, and JavaScript can tell them
    # apart where a naive dict.get() cannot. These four are the cases that
    # caught the Python side collapsing the distinction.
    ("null-string-field", json.dumps({"kodroProject": 1, "world": None, "theme": None})),
    ("null-lists", json.dumps({"kodroProject": 1, "runReports": None, "scenarioReports": None})),
    ("null-memory", json.dumps({"kodroProject": 1, "memory": None})),
    ("empty-memory", json.dumps({"kodroProject": 1, "memory": {}})),
    ("null-programs", json.dumps({"kodroProject": 1, "programs": None})),
]


@needs_node
@pytest.mark.parametrize("label,text", PARITY_CASES, ids=[c[0] for c in PARITY_CASES])
def test_python_and_the_browser_reach_the_same_verdict(
    tmp_path: Path, label: str, text: str
) -> None:
    """The same file is accepted or refused by both engines, for the same reasons."""
    web = _validate_in_node(tmp_path, text)
    native = kp.read_text(text)
    assert native.ok == web["ok"], f"{label}: python ok={native.ok} web ok={web['ok']}"
    assert _comparable(list(native.errors)) == _comparable(web["errors"]), label
    assert sorted(native.warnings) == sorted(web["warnings"]), label
    if native.ok:
        assert kp.file_name(native.document) == web["fileName"], label


@needs_node
def test_a_file_written_by_the_desktop_opens_in_the_browser(tmp_path: Path) -> None:
    """The direction that matters for a pupil taking their work home."""
    doc = kp.new_document(program="move_forward(3)\nturn_right(90)", world="mars", tab="drive")
    web = _validate_in_node(tmp_path, kp.to_json(doc))
    assert web["ok"], web["errors"]
    # The desktop has no KRS spec to write, so the browser says it is keeping
    # the build already on screen. That is the correct outcome, not a defect:
    # the pupil's program crosses over, their web-side robot is left alone.
    assert web["warnings"] == ["No robot spec in the project; the current build is kept."]
