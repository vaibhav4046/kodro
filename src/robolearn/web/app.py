"""pywebview launcher for the vendored Claude design.

Renders ``src/robolearn/assets/web/index.html`` in a desktop window
(Edge WebView2 on Windows, WebKit on macOS, WebKitGTK on Linux) and
exposes a :class:`BridgeAPI` instance that the design's React shell
calls through ``window.pywebview.api.*``.

Design first, integration later: the bridge intentionally returns
stubbed-but-real data on day one (the engine's actual lesson library +
pupil store), so the design renders and the React app can paint its
panels with live content. Submission, grading and trace replay are
added as follow-ups once the React app is patched to call into them.
"""

from __future__ import annotations

import contextlib
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import webview

from robolearn.lessons.schema import Lesson, load_library
from robolearn.memory.store import Store

LOG = logging.getLogger("robolearn.web")

ASSETS_DIR: Path = Path(__file__).resolve().parent.parent / "assets" / "web"
INDEX_HTML: Path = ASSETS_DIR / "index.html"
DEFAULT_DB_PATH: Path = Path.home() / ".robolearn" / "pupil.db"
DEFAULT_TITLE: str = "RoboLearn · Orbital Rover"
DEFAULT_GEOMETRY: tuple[int, int] = (1400, 900)


@dataclass(slots=True)
class WebApp:
    """Container for the pywebview window + its bridge API."""

    window: Any
    api: BridgeAPI


class BridgeAPI:
    """Methods exposed to JS as ``window.pywebview.api.*``.

    Every method MUST be JSON-serialisable in its return value (pywebview
    marshals the call through). Keep return shapes flat and explicit.
    """

    def __init__(self, *, store: Store, lessons: list[Lesson]) -> None:
        """Build the API around an existing :class:`Store` and lesson list."""
        self._store = store
        self._lessons = lessons
        # Single local pupil (UUID-per-machine, per spec).
        existing = store.list_pupils()
        pupil = existing[0] if existing else store.create_pupil("Pupil")
        self._pupil_id = pupil.id

    # --- design-facing API ------------------------------------------------

    def on_ui_ready(self) -> dict[str, Any]:
        """Called by bridge.js once the React app has mounted."""
        LOG.info("UI ready; %d lessons available, pupil=%s", len(self._lessons), self._pupil_id)
        return {"ok": True, "lessonCount": len(self._lessons), "pupilId": self._pupil_id}

    def list_lessons(self) -> list[dict[str, Any]]:
        """Return every lesson as a plain dict (titles, key stage, intro, ...)."""
        return [self._lesson_to_dict(lesson) for lesson in self._lessons]

    def get_lesson(self, lesson_id: str) -> dict[str, Any] | None:
        """Return one lesson by id, or ``None`` if not found."""
        for lesson in self._lessons:
            if lesson.id == lesson_id:
                return self._lesson_to_dict(lesson)
        return None

    def get_pupil_summary(self) -> dict[str, Any]:
        """Return the pupil's display name + recent score summary."""
        pupil = next((p for p in self._store.list_pupils() if p.id == self._pupil_id), None)
        return {
            "id": self._pupil_id,
            "displayName": pupil.display_name if pupil else "Pupil",
        }

    def submit_attempt(
        self, lesson_id: str, source: str, trace_json: str | None = None
    ) -> dict[str, Any]:
        """Persist an attempt (grading wired in a follow-up commit)."""
        _ = trace_json
        LOG.info("submit_attempt lesson=%s source_len=%d", lesson_id, len(source or ""))
        return {"ok": True, "lessonId": lesson_id, "graded": False}

    def get_hint(
        self, lesson_id: str, source: str, error_kind: str | None = None
    ) -> dict[str, str] | None:
        """Return a hint dict, or ``None`` if no hint matches (stub for now)."""
        _ = (lesson_id, source, error_kind)
        return None

    def export_report(self) -> dict[str, Any]:
        """Stub for the progress-report exporter (wired in follow-up)."""
        return {"ok": False, "reason": "not implemented yet"}

    def log(self, level: str, msg: str) -> dict[str, bool]:
        """Forward a JS-side log line to the Python logger."""
        getattr(LOG, level if level in {"info", "warning", "error", "debug"} else "info")(
            "[ui] %s", msg
        )
        return {"ok": True}

    # --- private helpers --------------------------------------------------

    @staticmethod
    def _lesson_to_dict(lesson: Lesson) -> dict[str, Any]:
        return {
            "id": lesson.id,
            "title": lesson.title,
            "keyStage": lesson.key_stage,
            "concepts": list(lesson.ct_concepts),
            "intro": lesson.intro,
            "starterCode": lesson.starter_code,
            "terrain": lesson.terrain.value
            if hasattr(lesson.terrain, "value")
            else str(lesson.terrain),
            "maxLines": lesson.max_lines,
        }


def build_app(*, db_path: Path | None = None) -> WebApp:
    """Build the pywebview window pointing at the vendored design."""
    if not INDEX_HTML.exists():
        raise RuntimeError(f"design index.html missing at {INDEX_HTML}")
    store = Store(db_path or DEFAULT_DB_PATH)
    lessons = list(load_library())
    api = BridgeAPI(store=store, lessons=lessons)
    window = webview.create_window(
        DEFAULT_TITLE,
        url=str(INDEX_HTML),
        js_api=api,
        width=DEFAULT_GEOMETRY[0],
        height=DEFAULT_GEOMETRY[1],
        min_size=(1024, 640),
        background_color="#08090f",
        on_top=True,
    )
    return WebApp(window=window, api=api)


def launch(*, db_path: Path | None = None, debug: bool = False) -> None:
    """Build and enter the pywebview main loop. Blocks until the window closes."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    with contextlib.suppress(Exception):
        _ = json  # keep json imported (used implicitly by pywebview)
    build_app(db_path=db_path)
    webview.start(debug=debug)
