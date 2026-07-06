"""Export the bundled lesson library to a static JSON file for the web build.

The desktop app hands the React shell its lessons over the pywebview bridge
(``window.pywebview.api.list_lessons`` / ``get_lesson``). The zero-install
static web build has no pywebview, so classroom mode would be an empty shell.
This script ships the same lessons as a plain JSON file the browser can
``fetch('./lessons.json')``.

The serialised shape MUST match ``BridgeAPI.list_lessons()`` byte-for-byte in
its per-lesson fields, so the browser and desktop paths present identical
lessons. To guarantee that, this script reuses the *same* serialiser the bridge
uses: :meth:`robolearn.web.app.BridgeAPI._lesson_to_dict`. If that shape ever
changes, this export changes with it, and the parity test
(``tests/unit/test_lessons_export.py``) fails until ``lessons.json`` is
re-exported.

The output is deterministic: keys are sorted, indentation is fixed, newlines are
LF, and a trailing newline is written. Running the script twice on the same
lesson library produces byte-identical output.

Usage::

    python scripts/export_lessons.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT: Path = Path(__file__).resolve().parent.parent
SRC: Path = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

# Imported after sys.path is primed so the script runs from a bare checkout
# (no editable install required), matching the other scripts in this directory.
from robolearn.lessons.schema import load_library  # noqa: E402
from robolearn.web.app import BridgeAPI  # noqa: E402

#: Where the shipped web build looks for the lessons (served next to index.html).
OUTPUT_PATH: Path = SRC / "robolearn" / "assets" / "web" / "lessons.json"


def build_lessons_payload() -> list[dict[str, object]]:
    """Serialise every bundled lesson with the exact bridge shape.

    Returns:
        A list of plain dicts, one per lesson, in the library's stable order
        (sorted by YAML file name, as :func:`load_library` returns them). Each
        dict is produced by the same serialiser ``BridgeAPI`` uses, so the
        browser payload matches what the desktop bridge returns.
    """
    lessons = load_library()
    return [BridgeAPI._lesson_to_dict(lesson) for lesson in lessons]


def render_json(payload: list[dict[str, object]]) -> str:
    """Render the payload as deterministic, stable-ordered JSON text.

    Sorting keys and fixing indentation makes the output idempotent: the same
    lesson library always renders to byte-identical text, so a re-export is a
    no-op unless the lessons actually changed. A trailing newline is appended so
    the file is POSIX-clean.
    """
    return json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def export_lessons(output_path: Path = OUTPUT_PATH) -> Path:
    """Write ``lessons.json`` with LF newlines and return the path written.

    The text is encoded to UTF-8 and written in binary so no platform newline
    translation runs: the ``\n`` in the rendered text is preserved verbatim on
    Windows too (never ``\r\n``), keeping the output byte-identical across
    operating systems and Python versions.
    """
    data = render_json(build_lessons_payload()).encode("utf-8")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(data)
    return output_path


def main() -> int:
    """Export the lessons and report where they were written."""
    path = export_lessons()
    count = len(build_lessons_payload())
    sys.stdout.write(f"wrote {count} lessons ({path.stat().st_size} bytes) to {path}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
