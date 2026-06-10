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
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import webview

from robolearn.engine.rover import Rover
from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, World
from robolearn.lessons.grader import grade
from robolearn.lessons.schema import Lesson, load_library
from robolearn.memory.hint_engine import HintContext, find_first_hint
from robolearn.memory.store import Store
from robolearn.runtime.binding import set_active_rover, set_active_world
from robolearn.runtime.executor import execute as run_pupil_code
from robolearn.runtime.tracer import RoverSnapshot, Tracer, set_active, set_state_provider

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
        """Return the active pupil's display name + recent score summary."""
        pupil = next((p for p in self._store.list_pupils() if p.id == self._pupil_id), None)
        return {
            "id": self._pupil_id,
            "displayName": pupil.display_name if pupil else "Pupil",
        }

    # --- multi-pupil (shared-machine identity) ----------------------------

    def list_pupils(self) -> list[dict[str, Any]]:
        """Return every pupil on this machine + which one is active."""
        return [
            {"id": p.id, "displayName": p.display_name, "active": p.id == self._pupil_id}
            for p in self._store.list_pupils()
        ]

    def create_pupil(self, display_name: str = "") -> dict[str, Any]:
        """Create a pupil, make them active, and return them."""
        name = (display_name or "").strip() or "Pupil"
        pupil = self._store.create_pupil(name)
        self._pupil_id = pupil.id
        LOG.info("created + selected pupil %s (%s)", pupil.id, name)
        return {"ok": True, "id": pupil.id, "displayName": pupil.display_name}

    def select_pupil(self, pupil_id: str) -> dict[str, Any]:
        """Switch the active pupil (so the right person's progress is recorded)."""
        if any(p.id == pupil_id for p in self._store.list_pupils()):
            self._pupil_id = pupil_id
            LOG.info("selected pupil %s", pupil_id)
            return {"ok": True, "id": pupil_id}
        return {"ok": False, "reason": f"unknown pupil: {pupil_id}"}

    def rename_pupil(self, pupil_id: str, display_name: str) -> dict[str, Any]:
        """Rename a pupil."""
        name = (display_name or "").strip() or "Pupil"
        self._store.set_display_name(pupil_id, name)
        return {"ok": True, "id": pupil_id, "displayName": name}

    def submit_attempt(
        self, lesson_id: str, source: str, trace_json: str | None = None
    ) -> dict[str, Any]:
        """Run the source through the Python engine, grade it, return verdict + hint.

        The React shell is the UI; this method is the trace-driven Python
        engine the dissertation actually claims. We rebuild the lesson world,
        bind a fresh tracer / rover, execute the source in the existing
        sandbox, grade against the lesson's success_criteria, and surface
        the first matching hint -- all the same code paths the Tk app uses.
        """
        _ = trace_json  # currently unused; reserved for client-side trace
        lesson = self._find_lesson(lesson_id)
        if lesson is None:
            return {"ok": False, "reason": f"unknown lesson: {lesson_id}"}

        world = _world_from_lesson(lesson)
        rover = Rover(world)
        tracer = Tracer()
        set_active(tracer)
        set_active_rover(rover)
        set_active_world(world)
        set_state_provider(lambda: _snapshot(rover))

        result = run_pupil_code(source or "", timeout_s=5.0)
        events = tracer.events()

        # Even on a runtime error we grade against whatever the tracer
        # captured -- the design's React console can still show partial
        # progress.
        verdict = grade(lesson, tracer, source or "")
        ctx = HintContext(
            lesson=lesson,
            source=source or "",
            events=tuple(events),
            grade_result=verdict,
        )
        hint = find_first_hint(ctx)
        if not result.success:
            error_reason = f"{result.error_kind}: {result.error_message} (line {result.error_line})"
            # Do NOT persist a 0-score row for a syntax/runtime error: a pupil
            # iterating on a typo would otherwise flood their history with 0s
            # and skew the pupil model. Matches the Tk app, which returns before
            # grading on an execution error.
            return {
                "ok": True,
                "lessonId": lesson_id,
                "graded": True,
                "passed": False,
                "score": 0,
                "reasons": [error_reason],
                "hint": _hint_to_dict(hint),
                "events": _events_to_dicts(events),
            }

        self._store.record_submission(
            pupil_id=self._pupil_id,
            lesson_id=lesson.id,
            code=source or "",
            passed=verdict.passed,
            score=verdict.score,
            reasons=list(verdict.reasons),
            duration_ms=result.duration_ms,
            battery_used=ctx.battery_used,
            collisions=ctx.collisions,
        )
        return {
            "ok": True,
            "lessonId": lesson_id,
            "graded": True,
            "passed": verdict.passed,
            "score": verdict.score,
            "reasons": list(verdict.reasons),
            "hint": _hint_to_dict(hint),
            "events": _events_to_dicts(events),
        }

    def get_hint(
        self, lesson_id: str, source: str, error_kind: str | None = None
    ) -> dict[str, str] | None:
        """Return the first matching hint for ``source`` against ``lesson_id``."""
        _ = error_kind
        lesson = self._find_lesson(lesson_id)
        if lesson is None:
            return None
        world = _world_from_lesson(lesson)
        rover = Rover(world)
        tracer = Tracer()
        set_active(tracer)
        set_active_rover(rover)
        set_active_world(world)
        set_state_provider(lambda: _snapshot(rover))
        run_pupil_code(source or "", timeout_s=5.0)
        events = tuple(tracer.events())
        verdict = grade(lesson, tracer, source or "")
        hint = find_first_hint(
            HintContext(lesson=lesson, source=source or "", events=events, grade_result=verdict)
        )
        return _hint_to_dict(hint)

    def export_report(self) -> dict[str, Any]:
        """Write the pupil's HTML progress report next to the database."""
        from robolearn.memory.report import export_progress_report

        path = DEFAULT_DB_PATH.parent / "progress-report.html"
        try:
            out = export_progress_report(self._store, self._pupil_id, path, lessons=self._lessons)
            LOG.info("exported progress report to %s", out)
            return {"ok": True, "path": str(out)}
        except Exception as exc:  # pragma: no cover - defensive
            LOG.warning("export_report failed: %s", exc)
            return {"ok": False, "reason": str(exc)}

    def log(self, level: str, msg: str) -> dict[str, bool]:
        """Forward a JS-side log line to the Python logger."""
        getattr(LOG, level if level in {"info", "warning", "error", "debug"} else "info")(
            "[ui] %s", msg
        )
        return {"ok": True}

    # --- AI vibe coding (local Ollama only; graceful when absent) ----------

    #: Installed-model preference for code generation. Qwen's coder models
    #: are best-in-class locally; Gemma is the common school-laptop fallback.
    _AI_MODEL_PREFERENCE = ("qwen2.5-coder", "qwen", "codegemma", "gemma", "llama")

    _AI_SYSTEM_PROMPT = (
        "You write Python programs for RoboLearn, an educational rover simulator. "
        "Use ONLY these functions: move_forward(metres), move_backward(metres), "
        "turn_left(degrees), turn_right(degrees), set_speed(percent), beep(times), "
        "log(text), say(text), led(colour), scan(), wait(seconds), read_distance(), "
        "obstacle_ahead(), collect_sample(), sample_detected(), at_base(), "
        "pen_down(), pen_up(). Plain procedural Python only: for/while/if, "
        "simple variables, def with no classes or imports. The pupil is a child: "
        "keep it short, add a one-line # comment per step. "
        "Reply with ONLY the Python code. No markdown fences, no prose."
    )

    def _pick_ai_model(self, installed: list[str]) -> str | None:
        for pref in self._AI_MODEL_PREFERENCE:
            for name in installed:
                if name.lower().startswith(pref):
                    return name
        return installed[0] if installed else None

    def ai_status(self) -> dict[str, Any]:
        """Report whether a local Ollama server is up and which model we'd use."""
        from robolearn.ai.ollama_client import OllamaClient

        client = OllamaClient()
        if not client.available():
            return {"available": False, "models": [], "model": None}
        installed = client.models()
        return {
            "available": True,
            "models": installed,
            "model": self._pick_ai_model(installed),
        }

    def ai_generate(self, prompt: str, lesson_id: str | None = None) -> dict[str, Any]:
        """Generate rover Python from a natural-language prompt via local Ollama.

        The code is returned for the pupil to review and Run -- it is never
        executed automatically, and when it IS run it goes through the same
        sandbox as hand-typed code.
        """
        from robolearn.ai.ollama_client import OllamaClient, OllamaError

        text = (prompt or "").strip()
        if not text:
            return {"ok": False, "reason": "Describe what the rover should do first."}
        if len(text) > 2000:
            text = text[:2000]
        client = OllamaClient()
        if not client.available():
            return {
                "ok": False,
                "reason": "AI is offline. Start Ollama (ollama serve) and pull a model "
                "such as qwen2.5-coder:3b or gemma3.",
            }
        model = self._pick_ai_model(client.models())
        if model is None:
            return {
                "ok": False,
                "reason": "Ollama is running but has no models. Try: ollama pull qwen2.5-coder:3b",
            }
        user_prompt = text
        lesson = self._find_lesson(lesson_id) if lesson_id else None
        if lesson is not None:
            user_prompt = (
                f"Lesson: {lesson.title}. Goal: {lesson.intro.strip()[:400]}\nPupil request: {text}"
            )
        try:
            raw = client.generate(
                user_prompt, system=self._AI_SYSTEM_PROMPT, model=model, temperature=0.4
            )
        except OllamaError as exc:
            return {"ok": False, "reason": f"AI generation failed: {exc}"}
        code = _strip_code_fences(raw)
        if not code.strip():
            return {"ok": False, "reason": "The model returned no code. Try rephrasing."}
        return {"ok": True, "code": code, "model": model}

    def speak(self, text: str) -> dict[str, Any]:
        """Speak ``text`` aloud with the OS's offline TTS voice (fire-and-forget)."""
        snippet = (text or "").strip()[:200]
        if not snippet:
            return {"ok": False, "reason": "nothing to say"}
        try:
            _speak_async(snippet)
            return {"ok": True}
        except Exception as exc:  # pragma: no cover - depends on host TTS
            return {"ok": False, "reason": str(exc)}

    # --- private helpers --------------------------------------------------

    def _find_lesson(self, lesson_id: str) -> Lesson | None:
        for lesson in self._lessons:
            if lesson.id == lesson_id:
                return lesson
        return None

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
            "readingAge": lesson.reading_age,
            "glossary": dict(lesson.glossary),
        }


def _world_from_lesson(lesson: Lesson) -> World:
    """Build a fresh :class:`World` from the lesson's ``WorldDef``."""
    from robolearn.engine.world import Obstacle, Sample

    wd = lesson.world
    return World(
        terrain=Terrain(lesson.terrain),
        base=tuple(wd.base),  # type: ignore[arg-type]
        samples=[Sample(s[0], s[1]) for s in wd.samples],
        obstacles=[Obstacle(o.x, o.y, o.r) for o in wd.obstacles],
        bounds=ArenaBounds(width=wd.width, height=wd.height),
    )


def _snapshot(rover: Rover) -> RoverSnapshot:
    """Capture the rover's current state for tracer events."""
    s = rover.state
    return RoverSnapshot(
        x=s.x,
        y=s.y,
        heading_deg=s.heading_deg,
        battery_pct=s.battery_pct,
        samples_held=s.samples_held,
        samples_collected=s.samples_collected,
        collisions=s.collisions,
    )


def _hint_to_dict(hint: Any) -> dict[str, str] | None:
    """Serialise a :class:`Hint` (or ``None``) for the JS bridge."""
    if hint is None:
        return None
    return {"ruleName": hint.rule_name, "message": hint.message}


def _events_to_dicts(events: Any) -> list[dict[str, Any]]:
    """Serialise tracer events as plain dicts for the JS bridge."""
    out: list[dict[str, Any]] = []
    for ev in events:
        out.append(
            {
                "frame": ev.frame,
                "kind": ev.kind,
                "name": ev.name,
                "args": list(ev.args) if ev.args else [],
                "result": ev.result,
            }
        )
    return out


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
    )
    return WebApp(window=window, api=api)


def _strip_code_fences(raw: str) -> str:
    """Strip markdown code fences a model may wrap around its code."""
    text = raw.strip()
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1 :]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return text.strip() + "\n"


def _speak_async(text: str) -> None:
    """Speak ``text`` with the OS's built-in offline TTS, without blocking.

    On Windows this uses SAPI through PowerShell (no extra dependency, fully
    offline). Elsewhere it is a silent no-op -- voice is a Windows-app perk;
    the simulator itself never depends on it.
    """
    if not sys.platform.startswith("win"):
        return
    import subprocess
    import threading

    # SAPI rejects no markup here; text is passed as a single argument to
    # PowerShell -EncodedCommand-free form with quoting hardened by replacing
    # quotes (the snippet is <=200 chars of pupil say() text).
    safe = text.replace("'", " ").replace('"', " ")
    script = (
        "Add-Type -AssemblyName System.Speech; "
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        f"$s.Speak('{safe}')"
    )

    def run() -> None:
        with contextlib.suppress(Exception):
            subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
                capture_output=True,
                timeout=30,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                check=False,
            )

    threading.Thread(target=run, daemon=True).start()


def _startup_failure_message(exc: BaseException) -> str:
    """Human-readable guidance for a pywebview start failure."""
    return (
        "RoboLearn could not open its window.\n\n"
        "This usually means the Microsoft Edge WebView2 Runtime is missing. "
        "It is free and installs in under a minute:\n\n"
        "    https://developer.microsoft.com/microsoft-edge/webview2/\n\n"
        "Install it, then start RoboLearn again. (You can also use the classic "
        "interface with:  python -m robolearn)\n\n"
        f"Technical details: {type(exc).__name__}: {exc}"
    )


def _report_startup_failure(exc: BaseException) -> None:
    """Show a friendly native dialog instead of a silent crash / raw traceback."""
    message = _startup_failure_message(exc)
    LOG.error("web UI failed to start: %s", exc)
    if sys.platform.startswith("win"):
        with contextlib.suppress(Exception):
            import ctypes

            # MB_OK | MB_ICONERROR | MB_SETFOREGROUND
            ctypes.windll.user32.MessageBoxW(0, message, "RoboLearn", 0x10 | 0x10000)
            return
    sys.stderr.write(message + "\n")


def launch(*, db_path: Path | None = None, debug: bool = False) -> None:
    """Build and enter the pywebview main loop. Blocks until the window closes."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    with contextlib.suppress(Exception):
        _ = json  # keep json imported (used implicitly by pywebview)
    build_app(db_path=db_path)
    try:
        webview.start(debug=debug)
    except Exception as exc:  # e.g. WebView2 runtime missing
        # Tell the user what to do (native dialog) rather than crash silently
        # with a raw traceback in the packaged, windowed .exe.
        _report_startup_failure(exc)
        raise SystemExit(1) from exc
