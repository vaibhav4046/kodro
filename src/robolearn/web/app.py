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

import ast
import contextlib
import json
import logging
import math
import sys
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, ClassVar

import webview

from robolearn.engine.rover import BATTERY_PER_METRE, Rover
from robolearn.engine.terrain import Terrain
from robolearn.engine.world import ArenaBounds, World
from robolearn.interop.urdf_io import build_urdf_from_spec, kodro_spec_from_krs
from robolearn.lessons.grader import grade
from robolearn.lessons.schema import Lesson, load_library
from robolearn.memory.achievements import PupilContext, check_and_unlock
from robolearn.memory.hint_engine import HintContext
from robolearn.memory.hint_learning import best_hint
from robolearn.memory.pupil_model import (
    class_heatmap,
    suggest_next_lesson,
    update_on_submission,
)
from robolearn.memory.store import Store
from robolearn.runtime.binding import (
    active_engine,
    binding_lock,
    set_active_rover,
    set_active_world,
)
from robolearn.runtime.executor import execute as run_pupil_code
from robolearn.runtime.tracer import RoverSnapshot, Tracer, set_active, set_state_provider

LOG = logging.getLogger("robolearn.web")

ASSETS_DIR: Path = Path(__file__).resolve().parent.parent / "assets" / "web"
INDEX_HTML: Path = ASSETS_DIR / "index.html"
DEFAULT_DB_PATH: Path = Path.home() / ".robolearn" / "pupil.db"
DEFAULT_TITLE: str = "Kodro"
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
        # Streaming AI jobs (ai_chat_start / ai_chat_poll).
        self._ai_jobs: dict[str, dict[str, Any]] = {}
        self._ai_jobs_lock = threading.Lock()
        # Model-pick cache: /api/tags can block ~seconds behind an in-flight
        # generation, so don't pay it on every request.
        self._ai_models_cache: tuple[float, list[str]] | None = None
        # User-chosen model override (persisted to ~/.robolearn/ai_models.json),
        # honoured by both pick methods so a user can point Kodro at any local
        # model they installed (DeepSeek, Nemotron, Qwen, etc.). None = auto.
        self._ai_model_override: str | None = None
        with contextlib.suppress(Exception):
            import json as _json
            from pathlib import Path as _Path

            _p = _Path.home() / ".robolearn" / "ai_models.json"
            if _p.exists():
                self._ai_model_override = (_json.loads(_p.read_text()) or {}).get("model") or None
        # Exact-transcript response cache: a repeated request (same lesson,
        # same wording -- common in a classroom) answers instantly.
        self._ai_answer_cache: dict[str, dict[str, Any]] = {}
        # Pre-load the local model so the FIRST vibe request doesn't pay the
        # multi-second model-load cost; keep_alive holds it warm after.
        threading.Thread(target=self._warm_ai, daemon=True).start()

    def _warm_ai(self) -> None:
        """Load the preferred local model into Ollama's memory (best-effort)."""
        with contextlib.suppress(Exception):
            from robolearn.ai.ollama_client import OllamaClient

            client = OllamaClient()
            if not client.available():
                return
            installed = client.models()
            model = self._pick_ai_model(installed)
            if model is None:
                return
            client.generate(
                "hi", model=model, temperature=0.0, num_predict=1, keep_alive=self._AI_KEEP_ALIVE
            )
            LOG.info("AI model %s pre-loaded and kept warm", model)

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

    def save_scenario_run(self, report: dict[str, Any]) -> dict[str, Any]:
        """Persist a domain-randomised scenario validation report to SQLite.

        Called by the web validator (``window.RoboLearn.saveScenarioRun``) so a
        run's spread is kept on the machine for the realism dashboard and the
        assistant. Fully local; nothing leaves the device.
        """
        try:
            row_id = self._store.save_scenario_run(report or {})
            return {"ok": True, "id": row_id}
        except Exception as exc:
            return {"ok": False, "reason": str(exc)}

    def list_scenario_runs(self, limit: int = 50) -> dict[str, Any]:
        """Return saved scenario runs, newest first."""
        try:
            return {"ok": True, "runs": self._store.list_scenario_runs(limit=int(limit))}
        except Exception as exc:
            return {"ok": False, "reason": str(exc), "runs": []}

    def get_pupil_summary(self) -> dict[str, Any]:
        """Return the active pupil's display name + recent score summary."""
        pupil = next((p for p in self._store.list_pupils() if p.id == self._pupil_id), None)
        return {
            "id": self._pupil_id,
            "displayName": pupil.display_name if pupil else "Pupil",
        }

    def get_class_heatmap(self) -> dict[str, Any]:
        """Return the class concept-strength heatmap for the teacher view.

        Brings the teacher dashboard, previously only in the legacy shell,
        into the shipped web app: every pupil on this machine, every concept
        they have touched, and the rolling strength score (0 to 1) for each.
        Fully local; the data never leaves the machine.
        """
        heat = class_heatmap(self._store)
        concepts = sorted({c for row in heat.values() for c in row})
        rows = [
            {
                "id": p.id,
                "name": p.display_name,
                "active": p.id == self._pupil_id,
                "scores": heat.get(p.id, {}),
            }
            for p in self._store.list_pupils()
        ]
        return {"ok": True, "concepts": concepts, "pupils": rows}

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
        self,
        lesson_id: str,
        source: str,
        trace_json: str | None = None,
        robot_mass_factor: float | None = None,
        robot_drain_pct_per_m: float | None = None,
    ) -> dict[str, Any]:
        """Run the source through the Python engine, grade it, return verdict + hint.

        The React shell is the UI; this method is the trace-driven Python
        engine the dissertation actually claims. We rebuild the lesson world,
        bind a fresh tracer / rover, execute the source in the existing
        sandbox, grade against the lesson's success_criteria, and surface
        the first matching hint -- all the same code paths the Tk app uses.

        ``robot_mass_factor`` is the fitted build's mass factor (the client
        sends ``KODRO_ROBOT.massFactor``); it scales per-metre battery drain so
        a heavier build grades as it runs instead of spec-blind.
        ``robot_drain_pct_per_m`` is the ENERGY-TRUE per-metre drain of an
        imported measured build (the client sends phys.drainPctPerCmNominal x
        100, derived from the pack's real energyWh); when present and valid it
        WINS over the mass-factor proxy. Omitted or invalid, drain stays at the
        default (mass factor 1).
        """
        _ = trace_json  # currently unused; reserved for client-side trace
        lesson = self._find_lesson(lesson_id)
        if lesson is None:
            return {"ok": False, "reason": f"unknown lesson: {lesson_id}"}

        # Attribution is fixed at ENTRY: bridge calls run on their own threads,
        # so a select_pupil landing while this attempt is being graded must not
        # re-file the result under the newly selected pupil. The pupil who was
        # active when the attempt was submitted owns it (the client's late-grade
        # handling states and relies on exactly this rule).
        pupil_id = self._pupil_id

        drain_scale = _drain_scale_for(robot_mass_factor, robot_drain_pct_per_m)

        world = _world_from_lesson(lesson)
        rover = Rover(world, drain_scale=drain_scale)
        tracer = Tracer()
        # Hold the binding lock for the whole bind -> run -> detach window so a
        # concurrent AI-validation or swarm run on another thread cannot rebind
        # the engine mid-submission and hijack whose rover the pupil drives.
        with binding_lock:
            set_active(tracer)
            set_active_rover(rover)
            set_active_world(world)
            set_state_provider(lambda: _snapshot(rover))

            result = run_pupil_code(source or "", timeout_s=5.0)
            events = tracer.events()
            # Detach the global tracer/engine bindings now the run is captured
            # (the grader takes the tracer object directly), so a later read
            # never sees this submission's stale rover/world/tracer.
            set_active(None)
            set_active_rover(None)
            set_active_world(None)
            set_state_provider(None)

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
        if not result.success:
            # On a syntax/runtime error we don't touch the learner model (no
            # 0-score row, no hint outcome): a typo isn't a verdict on the
            # previously shown hint. Still surface the best learned hint.
            error_reason = f"{result.error_kind}: {result.error_message} (line {result.error_line})"
            return {
                "ok": True,
                "lessonId": lesson_id,
                "graded": True,
                "passed": False,
                "score": 0,
                "reasons": [error_reason],
                "hint": _hint_to_dict(best_hint(ctx, self._store)),
                "events": _events_to_dicts(events),
            }

        # Self-improving hints: this graded attempt is the verdict on whatever
        # hint we showed last time for this pupil+lesson. Score it first, so
        # the ranking below already reflects the freshest evidence.
        self._store.resolve_pending_hint(pupil_id, lesson.id, passed=verdict.passed)
        hint = best_hint(ctx, self._store)
        if not verdict.passed and hint is not None:
            self._store.set_pending_hint(pupil_id, lesson.id, hint.rule_name)

        # PRIOR history, read BEFORE recording this submission. The achievement
        # predicates take a history that EXCLUDES the current submission (they
        # append c.submission themselves, e.g. `(*c.history, c.submission)`).
        # Reading it after the record below double-counted the current pass, so
        # "three in a row" fired on only two consecutive passes.
        history = tuple(self._store.list_submissions(pupil_id=pupil_id))

        submission = self._store.record_submission(
            pupil_id=pupil_id,
            lesson_id=lesson.id,
            code=source or "",
            passed=verdict.passed,
            score=verdict.score,
            reasons=list(verdict.reasons),
            duration_ms=result.duration_ms,
            battery_used=ctx.battery_used,
            collisions=ctx.collisions,
        )

        # Keep the learner model live in the shipped web app, not only in the
        # legacy Tk shell: update concept strength so the recommender and the
        # teacher heatmap actually move, unlock achievements, and surface the
        # adaptive next-lesson pick. All local, all from this one submission.
        update_on_submission(self._store, pupil_id=pupil_id, lesson=lesson, passed=verdict.passed)
        pctx = PupilContext(
            pupil_id=pupil_id, lesson=lesson, submission=submission, history=history
        )
        achievements = [
            {"id": a.id, "title": a.title, "description": a.description, "icon": a.icon}
            for a in check_and_unlock(self._store, pctx)
        ]
        recommended = suggest_next_lesson(self._store, pupil_id, self._lessons)
        rec = None
        if recommended is not None and recommended.id != lesson.id:
            rec = {"id": recommended.id, "title": recommended.title}

        return {
            "ok": True,
            "lessonId": lesson_id,
            "graded": True,
            "passed": verdict.passed,
            "score": verdict.score,
            "reasons": list(verdict.reasons),
            "hint": _hint_to_dict(hint),
            "events": _events_to_dicts(events),
            "achievements": achievements,
            "recommended": rec,
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
        with binding_lock:
            set_active(tracer)
            set_active_rover(rover)
            set_active_world(world)
            set_state_provider(lambda: _snapshot(rover))
            run_pupil_code(source or "", timeout_s=5.0)
            events = tuple(tracer.events())
            set_active(None)
            set_active_rover(None)
            set_active_world(None)
            set_state_provider(None)
        verdict = grade(lesson, tracer, source or "")
        ctx = HintContext(lesson=lesson, source=source or "", events=events, grade_result=verdict)
        # Read-only preview: rank by learned effectiveness, no outcome recorded.
        return _hint_to_dict(best_hint(ctx, self._store))

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

    #: Installed-model preference for code generation. Keep the measured stock
    #: coder/general models ahead of the legacy Kodro fine-tunes: the latter
    #: mixed centimetres into the metre API and invented symbols in KodroBench.
    _AI_MODEL_PREFERENCE = (
        "qwen2.5-coder",
        "qwen",
        "codegemma",
        "gemma3",
        "gemma",
        "llama",
        "kodro-coder",
        "kodro-tutor",
        "robolearn",
    )

    #: Keep the model loaded between requests (the model-load is the painful
    #: multi-second cold-start) and bound how much it may generate (programs
    #: are short; an unbounded ramble is pure latency).
    _AI_KEEP_ALIVE = "30m"
    _AI_NUM_PREDICT = 420

    # Hardware-dependent calls are checked against the active Robot Lab build.
    # Other public calls (say, beep, samples, props, logging) remain available
    # because they are simulator capabilities rather than fitted sensors or
    # drive hardware.  The browser sends its canonical commandNames() list and
    # this mapping translates the Python API aliases onto those capabilities.
    _AI_HARDWARE_CAPABILITY: ClassVar[dict[str, str]] = {
        "move_forward": "move_forward",
        "move_backward": "move_backward",
        "turn_left": "turn_left",
        "turn_right": "turn_right",
        "read_distance": "distance",
        "distance": "distance",
        "obstacle_ahead": "distance",
        "scan": "distance",
        "read_heading": "heading",
        "heading": "heading",
    }

    _AI_SYSTEM_PROMPT = (
        "You write Python programs for RoboLearn, an educational rover simulator. "
        "Use ONLY these functions: move_forward(metres), move_backward(metres), "
        "turn_left(degrees), turn_right(degrees), set_speed(percent), beep(times), "
        "log(text), say(text), led(colour), scan(), wait(seconds), read_distance(), "
        "obstacle_ahead(), collect_sample(), sample_detected(), at_base(), "
        "pen_down(), pen_up(), place(kind), clear_props(). place plants a prop "
        'where the rover stands: "flag", "beacon", "person", "tree", '
        '"rock", "crate", "photo" (the pupil pictures) or "drone" - use it to BUILD scenes. '
        "All movement distances and read_distance() values are in METRES: half "
        "a metre is 0.5 and one metre is 1.0, never 50 or 100. scan() only "
        "shows a radar ping and returns no distance value. "
        "Plain procedural Python only: for/while/if, "
        "simple variables, def with no classes or imports. Define every "
        "variable before you use it. No f-strings, lists, dicts or input(). "
        "The pupil is a child: keep it short, add a one-line # comment per "
        "step. Write top-level statements that run immediately; do NOT wrap "
        "the program in a main() function. "
        "Reply with ONLY the Python code. No markdown fences, no prose."
    )

    def _pick_ai_model(self, installed: list[str]) -> str | None:
        """Pick the QUALITY model: best family first, biggest variant within it.

        Within a family prefer the largest parameter count (gemma3:4b over
        gemma3:1b) -- this is the escalation/repair model, so capability wins.
        """
        if self._ai_model_override and (not installed or self._ai_model_override in installed):
            return self._ai_model_override

        def size_of(name: str) -> float:
            import re

            m = re.search(r":(\d+(?:\.\d+)?)b\b", name.lower())
            return float(m.group(1)) if m else 0.0

        for pref in self._AI_MODEL_PREFERENCE:
            candidates = [n for n in installed if n.lower().startswith(pref)]
            if candidates:
                return max(candidates, key=size_of)
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
            "override": self._ai_model_override,
        }

    def set_ai_model(self, name: str = "") -> dict[str, Any]:
        """Choose which installed local model the assistant uses, and persist it.

        An empty name clears the override and returns to automatic selection.
        Lets a user point Kodro at any local model they have pulled (DeepSeek,
        Nemotron, Qwen, a custom fine-tune, etc.). Strictly local; no account.
        """
        choice = (name or "").strip() or None
        self._ai_model_override = choice
        self._ai_models_cache = None
        with contextlib.suppress(Exception):
            import json as _json
            from pathlib import Path as _Path

            _d = _Path.home() / ".robolearn"
            _d.mkdir(parents=True, exist_ok=True)
            (_d / "ai_models.json").write_text(_json.dumps({"model": choice}))
        return {"ok": True, "model": choice}

    _BUILD_SYSTEM = (
        "You are a friendly hardware mentor helping a student build a REAL "
        "physical robot rover on a budget, using common hobby parts (a "
        "micro:bit, an ESP32, an Arduino, small DC motors and wheels, an "
        "ultrasonic distance sensor, a battery holder, jumper wires, "
        "cardboard or a chassis). The student programmes it in MicroPython or "
        "Arduino C, which maps onto the same ideas they learned in RoboLearn "
        "(move_forward, turn, read_distance). Given a budget in US dollars, "
        "recommend the best buildable rover for that money. Reply with ONLY a "
        "JSON object, no prose, of this exact shape:\n"
        '{"tier":"short name","summary":"one sentence","parts":'
        '[{"name":"part","role":"what it does","cost":number}],'
        '"steps":["short build step", "..."],'
        '"maps":[{"robolearn":"move_forward(1)","hardware":"how to do it on this board"}],'
        '"total":number}\n'
        "Keep within the budget, use 4 to 7 parts, 4 to 6 steps and 3 maps. "
        "For a very small budget suggest a paper or cardboard rover with the "
        "cheapest microcontroller. Costs are approximate US dollars."
    )

    def budget_build(self, budget_usd: float = 30.0, goal: str = "") -> dict[str, Any]:
        """Generate a real-robot build guide for a budget, using the local model.

        Returns a structured plan (tier, parts, steps and a mapping from the
        RoboLearn API onto real hardware) that the UI renders with a schematic.
        Strictly offline; nothing is ordered or sent anywhere.
        """
        from robolearn.ai.ollama_client import OllamaClient, OllamaError

        try:
            budget = max(1.0, min(float(budget_usd), 100000.0))
        except (TypeError, ValueError):
            budget = 30.0
        client = OllamaClient()
        if not client.available():
            return {"ok": False, "reason": "AI is offline. Start Ollama to use the robot builder."}
        model = self._pick_ai_model(client.models())  # quality model: this is a one-off
        if model is None:
            return {"ok": False, "reason": "Ollama has no models. Try: ollama pull gemma3"}
        ask = f"My budget is {budget:.0f} US dollars."
        if goal.strip():
            ask += f" I want it to: {goal.strip()[:200]}."
        for attempt in range(2):
            try:
                raw = client.generate(
                    ask,
                    system=self._BUILD_SYSTEM,
                    model=model,
                    json_mode=True,
                    temperature=0.4 if attempt == 0 else 0.2,
                    num_predict=700,
                    keep_alive="10m",
                )
            except OllamaError as exc:
                return {"ok": False, "reason": f"AI failed: {exc}"}
            plan = self._parse_build_plan(raw, budget)
            if plan is not None:
                return {"ok": True, "budget": round(budget), "model": model, **plan}
        # The model could not produce a clean plan (common at tiny budgets);
        # return a sensible deterministic floor so the builder never dead-ends.
        floor = self._fallback_build(budget)
        return {"ok": True, "budget": round(budget), "model": model, "fallback": True, **floor}

    @staticmethod
    def _fallback_build(budget: float) -> dict[str, Any]:
        """A guaranteed, hand-written minimal rover scaled to the budget."""
        if budget < 20:
            return {
                "tier": "Cardboard micro-rover",
                "summary": "A cardboard rover on a cheap microcontroller with a vibration motor.",
                "parts": [
                    {
                        "name": "Cheap microcontroller (Pro Micro/ESP8266 clone)",
                        "role": "Runs the program",
                        "cost": 3.0,
                    },
                    {
                        "name": "Coin vibration motor",
                        "role": "Shuffles the rover forward",
                        "cost": 1.0,
                    },
                    {"name": "Coin cell + holder", "role": "Power", "cost": 1.0},
                    {
                        "name": "Cardboard, tape and a paperclip",
                        "role": "Chassis and skid",
                        "cost": 0.0,
                    },
                ],
                "steps": [
                    "Cut a small cardboard base and fold up two sides.",
                    "Tape the vibration motor underneath so the rover shuffles when it spins.",
                    "Wire the motor to a microcontroller pin through a transistor.",
                    "Flash a program that pulses the pin to move, and stops to turn.",
                ],
                "maps": [
                    {"robolearn": "move_forward(1)", "hardware": "Pulse the motor pin briefly."},
                    {
                        "robolearn": "turn_right(90)",
                        "hardware": "Stop one side so the rover veers.",
                    },
                    {"robolearn": "wait(1)", "hardware": "sleep one second in the program."},
                ],
                "total": 5.0,
            }
        return {
            "tier": "ESP32 starter rover",
            "summary": "A two-wheeled rover on an ESP32 with a motor driver and distance sensor.",
            "parts": [
                {"name": "ESP32 dev board", "role": "Microcontroller with WiFi", "cost": 8.0},
                {"name": "L298N or TB6612 motor driver", "role": "Drives the motors", "cost": 4.0},
                {"name": "Two TT gear motors with wheels", "role": "Movement", "cost": 10.0},
                {"name": "HC-SR04 ultrasonic sensor", "role": "Measures distance", "cost": 3.0},
                {"name": "AA battery holder and chassis", "role": "Power and body", "cost": 6.0},
            ],
            "steps": [
                "Mount the two motors and wheels on the chassis with a caster at the back.",
                "Wire the motor driver between the ESP32 and the motors.",
                "Connect the ultrasonic sensor to two ESP32 pins.",
                "Flash MicroPython and write functions for forward, turn and read_distance.",
            ],
            "maps": [
                {"robolearn": "move_forward(1)", "hardware": "Set both motor pins high briefly."},
                {"robolearn": "read_distance()", "hardware": "Trigger the HC-SR04, time the echo."},
                {"robolearn": "obstacle_ahead()", "hardware": "True when echo distance is small."},
            ],
            "total": 31.0,
        }

    @staticmethod
    def _parse_build_plan(raw: str, budget: float) -> dict[str, Any] | None:
        """Validate + normalise the model's JSON build plan; None if unusable."""
        text = raw.strip()
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1:
            return None
        try:
            data = json.loads(text[start : end + 1])
        except (json.JSONDecodeError, ValueError):
            return None
        if not isinstance(data, dict):
            return None
        parts: list[dict[str, Any]] = []
        total = 0.0
        for p in data.get("parts", [])[:8]:
            if isinstance(p, dict) and p.get("name"):
                try:
                    cost = round(float(p.get("cost", 0)), 2)
                except (TypeError, ValueError):
                    cost = 0.0
                total += cost
                parts.append(
                    {"name": str(p["name"])[:60], "role": str(p.get("role", ""))[:90], "cost": cost}
                )
        if not parts:
            return None
        steps = [str(s)[:160] for s in data.get("steps", []) if str(s).strip()][:8]
        maps = [
            {
                "robolearn": str(m.get("robolearn", ""))[:60],
                "hardware": str(m.get("hardware", ""))[:120],
            }
            for m in data.get("maps", [])
            if isinstance(m, dict)
        ][:4]
        return {
            "tier": str(data.get("tier", "Starter rover"))[:50],
            "summary": str(data.get("summary", ""))[:200],
            "parts": parts,
            "steps": steps or ["Assemble the parts and upload the program."],
            "maps": maps,
            "total": round(float(data.get("total", total)) or total, 2),
        }

    def ai_generate(
        self,
        prompt: str,
        lesson_id: str | None = None,
        allowed_commands: list[str] | None = None,
    ) -> dict[str, Any]:
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
                user_prompt,
                system=self._AI_SYSTEM_PROMPT,
                model=model,
                temperature=0.25,
                num_predict=self._AI_NUM_PREDICT,
                keep_alive=self._AI_KEEP_ALIVE,
            )
        except OllamaError as exc:
            return {"ok": False, "reason": f"AI generation failed: {exc}"}
        code = _strip_code_fences(raw)
        if not code.strip():
            return {"ok": False, "reason": "The model returned no code. Try rephrasing."}

        # Validate through the same sandbox the Run button uses, so the pupil
        # is never handed code that crashes on line 1. One self-repair round:
        # feed the error back to the model and re-validate.
        allowed = self._normalise_allowed_commands(allowed_commands)
        error = self._validate_generated(code, allowed)
        if error is not None:
            with contextlib.suppress(OllamaError):
                repaired = _strip_code_fences(
                    client.generate(
                        f"Your previous program failed with: {error}\n"
                        f"Program:\n{code}\n"
                        "Fix it. Reply with ONLY the corrected Python code.",
                        system=self._AI_SYSTEM_PROMPT,
                        model=model,
                        temperature=0.2,
                        num_predict=self._AI_NUM_PREDICT,
                        keep_alive=self._AI_KEEP_ALIVE,
                    )
                )
                if repaired.strip() and self._validate_generated(repaired, allowed) is None:
                    return {
                        "ok": True,
                        "code": repaired,
                        "model": model,
                        "repaired": True,
                        "validated": True,
                    }
        if error is not None:
            return {
                "ok": False,
                "reason": "The model's program was rejected by Kodro's safety check.",
                "validationError": error,
                "rejectedCode": code,
                "model": model,
            }
        return {"ok": True, "code": code, "model": model, "validated": True}

    def ai_review_code(
        self,
        source: str,
        lesson_id: str | None = None,
        allowed_commands: list[str] | None = None,
    ) -> dict[str, Any]:
        """Second-agent review: critique the pupil's code, suggest a safe rewrite.

        Runs the propose-then-critique reviewer on the local model. Any
        rewrite the critic proposes is accepted only after it passes the
        same sandbox validation the Run button uses, so the pupil is never
        handed code that crashes. Fully offline; degrades cleanly when the
        model is absent.
        """
        from robolearn.ai.critique import review_program
        from robolearn.ai.ollama_client import OllamaClient, OllamaError

        code = (source or "").strip()
        if not code:
            return {"ok": False, "reason": "Write some code first, then ask for a review."}
        client = OllamaClient()
        if not client.available():
            return {"ok": False, "reason": "AI is offline. Start Ollama to get a review."}
        model = self._pick_ai_model(client.models())
        if model is None:
            return {"ok": False, "reason": "Ollama has no models. Pull qwen2.5-coder:3b first."}
        lesson = self._find_lesson(lesson_id) if lesson_id else None
        goal = f"{lesson.title}. {lesson.intro.strip()[:400]}" if lesson is not None else ""
        allowed = self._normalise_allowed_commands(allowed_commands)
        try:
            review = review_program(
                code,
                goal=goal,
                client=client,
                model=model,
                validate=lambda candidate: self._validate_generated(candidate, allowed),
            )
        except OllamaError as exc:
            return {"ok": False, "reason": f"Review failed: {exc}"}
        issues = self._filter_review_issues(review.issues, code)
        return {
            "ok": True,
            "model": model,
            "issues": issues,
            "code": review.final_code,
            "revised": review.revised,
        }

    @staticmethod
    def _filter_review_issues(issues: list[str], code: str) -> list[str]:
        """Drop sensor complaints that have no supporting call in the program."""
        lower = code.lower()
        uses_distance = any(
            token in lower for token in ("read_distance(", "obstacle_ahead(", "scan(")
        )
        uses_heading = "read_heading(" in lower
        kept: list[str] = []
        for issue in issues:
            text = str(issue).strip()
            claim = text.lower()
            if ("range sensor" in claim or "distance sensor" in claim) and not uses_distance:
                continue
            if "heading sensor" in claim and not uses_heading:
                continue
            if text:
                kept.append(text)
        return kept[:3]

    def swarm_run(self, source: str, lesson_id: str | None = None, n: int = 5) -> dict[str, Any]:
        """Run the pupil's program on a fleet of rovers, an offline swarm.

        The same code is executed on several rovers, each starting from a
        different pose around the base, in the same sandbox the single rover
        uses. The returned paths are drawn as overlaid trails so a class can
        see how one decentralised program produces a coordinated pattern.
        Fully local; no model, no network.
        """
        from robolearn.runtime.swarm import SwarmProgramError, run_swarm

        code = (source or "").strip()
        if not code:
            return {"ok": False, "reason": "Write a program first, then launch the swarm."}
        lesson = self._find_lesson(lesson_id) if lesson_id else None

        def factory() -> World:
            if lesson is not None:
                return _world_from_lesson(lesson)
            # Centre of the default 10x10 arena, NOT the (0, 0) corner. The
            # fleet is spread on a ring around the base, so a corner base put
            # half the rovers at negative x/y -- outside the bounds, pinned to
            # the walls, one never moving -- while the modal captioned the plot
            # as an emergent pattern. This is the default path: free play with
            # no lesson open.
            return World(terrain=Terrain("earth"), base=(5.0, 5.0))

        try:
            raw_paths = run_swarm(code, world_factory=factory, n=int(n))
        except SwarmProgramError as exc:
            # The program never ran; say so instead of drawing stationary dots
            # under a caption claiming a pattern formed.
            return {"ok": False, "reason": f"The program did not run: {exc}"}
        except Exception as exc:  # pragma: no cover - sandbox already guards
            return {"ok": False, "reason": f"Swarm failed: {exc}"}
        paths = [[[round(x, 2), round(y, 2)] for (x, y) in p] for p in raw_paths]
        return {"ok": True, "n": len(paths), "paths": paths}

    def ai_ask(
        self,
        query: str,
        allowed_commands: list[str] | None = None,
        lesson_id: str | None = None,
    ) -> dict[str, Any]:
        """Answer a how-do-I question grounded in the lesson material.

        Retrieval is fully offline, so even with no local model the pupil
        still gets the most relevant lesson passages instead of nothing.
        When a model is present it writes a short answer constrained to
        those passages, and refuses plainly when retrieval finds nothing.
        """
        from robolearn.ai.ollama_client import OllamaClient, OllamaError
        from robolearn.ai.retrieval import build_corpus, grounded_answer, search

        q = (query or "").strip()
        if not q:
            return {"ok": False, "reason": "Ask a question about the lessons first."}
        client = OllamaClient()
        if not client.available():
            hits = search(
                q,
                build_corpus(self._lessons),
                k=2,
                preferred_source_prefix=(lesson_id + " ") if lesson_id else None,
            )
            if hits:
                return {
                    "ok": True,
                    "grounded": True,
                    "noModel": True,
                    "answer": "The AI model is offline. Here is the lesson material that matches:",
                    "sources": [{"source": h.source, "text": h.text} for h in hits],
                }
            return {"ok": False, "reason": "Nothing in the lessons matched, and the AI is offline."}
        model = self._pick_ai_model(client.models())
        if model is None:
            return {"ok": False, "reason": "Ollama has no models. Pull qwen2.5-coder:3b first."}
        try:
            out = grounded_answer(
                q,
                self._lessons,
                client=client,
                model=model,
                preferred_lesson_id=lesson_id,
            )
        except OllamaError as exc:
            return {"ok": False, "reason": f"Ask failed: {exc}"}
        answer = _normalize_rover_api(str(out.get("answer", "")))
        allowed = self._normalise_allowed_commands(allowed_commands)
        command_error = self._answer_command_error(answer, allowed)
        if command_error is not None:
            answer = (
                "That command is not available on the current robot build. "
                "Open Robot Lab to fit the required drive or sensor, then ask again."
            )
        return {
            "ok": True,
            "model": model,
            **out,
            "answer": answer,
            "answerChecked": command_error is None,
            "answerWarning": command_error,
        }

    @staticmethod
    def _normalise_allowed_commands(
        allowed_commands: list[str] | None,
    ) -> frozenset[str] | None:
        """Return a bounded command set, or None for legacy callers without a build."""
        if not isinstance(allowed_commands, list):
            return None
        clean = {
            str(name).strip()
            for name in allowed_commands[:64]
            if isinstance(name, str) and str(name).strip()
        }
        return frozenset(clean)

    @classmethod
    def _hardware_command_error(
        cls, code: str, allowed_commands: frozenset[str] | None
    ) -> str | None:
        """Reject calls that require drive/sensor hardware absent from the build."""
        if allowed_commands is None:
            return None
        try:
            tree = ast.parse(code, mode="exec")
        except SyntaxError:
            return None  # the sandbox reports the more useful syntax error
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name):
                continue
            capability = cls._AI_HARDWARE_CAPABILITY.get(node.func.id)
            if capability is not None and capability not in allowed_commands:
                return (
                    f"{node.func.id}() is not available on the current robot build "
                    f"(missing capability: {capability})."
                )
        return None

    @classmethod
    def _answer_command_error(
        cls, answer: str, allowed_commands: frozenset[str] | None
    ) -> str | None:
        """Apply the same fitted-build gate to command calls in prose answers."""
        if allowed_commands is None:
            return None
        import re

        for name, capability in cls._AI_HARDWARE_CAPABILITY.items():
            mentions_call = re.search(rf"\b{re.escape(name)}\s*\(", answer)
            if capability not in allowed_commands and mentions_call:
                return f"{name}() needs the unavailable {capability} capability."
        return None

    @classmethod
    def _validate_generated(
        cls, code: str, allowed_commands: frozenset[str] | None = None
    ) -> str | None:
        """Run AI code through the sandbox in an ISOLATED engine; return err/None.

        Binds a throwaway rover/world under the binding lock so this validation
        run can never drive (or be driven by) a live pupil submission on another
        thread. Previously it called the executor with no binding, so it ran
        against whatever engine happened to be active.
        """
        hardware_error = cls._hardware_command_error(code, allowed_commands)
        if hardware_error is not None:
            return hardware_error
        world = World(terrain=Terrain("earth"), base=(0.0, 0.0))
        with active_engine(Rover(world), world):
            result = run_pupil_code(code, timeout_s=5.0)
        if result.success:
            return None
        return f"{result.error_kind}: {result.error_message} (line {result.error_line})"

    #: Chat-mode system prompt: the model may ask ONE clarifying question
    #: (like a good pair-programmer) before committing to code.
    _AI_CHAT_SYSTEM = (
        "You are a friendly coding partner inside RoboLearn, an educational "
        "rover simulator for children. The pupil chats with you about what "
        "the rover should do.\n"
        "If the request gives NO distance, count or goal at all (like just "
        "'go forward'), you MUST reply with exactly one short clarifying "
        "question on one line, prefixed 'QUESTION: ' -- never guess. Ask at "
        "most one question per request; if the pupil has already answered "
        "one, write the code.\n"
        "Otherwise reply 'CODE:' on the first line, then the program. "
        "Use ONLY these functions: move_forward(metres), move_backward(metres), "
        "turn_left(degrees), turn_right(degrees), set_speed(percent), beep(times), "
        "log(text), say(text), led(colour), scan(), wait(seconds), read_distance(), "
        "obstacle_ahead(), collect_sample(), sample_detected(), at_base(), "
        "pen_down(), pen_up(), place(kind), clear_props(). place plants a prop "
        'where the rover stands: "flag", "beacon", "person", "tree", '
        '"rock", "crate", "photo" (the pupil pictures) or "drone" - use it to BUILD scenes. '
        "All movement distances and read_distance() values are in METRES: half "
        "a metre is 0.5 and one metre is 1.0, never 50 or 100. scan() only "
        "shows a radar ping and returns no distance value. "
        "Plain procedural Python: for/while/if, simple "
        "variables, def with no classes or imports. Define every variable before "
        "use. No f-strings, lists, dicts or input(). Write top-level statements; "
        "do NOT wrap the program in main(). One short # comment per step. "
        "No markdown fences, no prose around the code.\n"
        "Examples:\n"
        "Pupil: drive in a triangle\n"
        "You: CODE:\n"
        "for side in range(3):\n"
        "    move_forward(2)  # one side\n"
        "    turn_right(120)  # triangle corner\n"
        "Pupil: go forward\n"
        "You: QUESTION: How far should the rover drive, in metres?\n"
        "Pupil: patrol and avoid rocks by itself\n"
        "You: CODE:\n"
        "steps = 0\n"
        "while steps < 40:  # autonomous sense-think-act\n"
        "    if read_distance() < 1:\n"
        "        turn_right(90)  # dodge\n"
        "    else:\n"
        "        move_forward(0.5)\n"
        "    steps = steps + 1"
    )

    def ai_chat(
        self,
        messages: list[dict[str, str]],
        lesson_id: str | None = None,
        allowed_commands: list[str] | None = None,
    ) -> dict[str, Any]:
        """Chat-style vibe coding: the model may ask a clarifying question first.

        ``messages`` is the conversation so far: ``[{"role": "user"|"assistant",
        "text": ...}, ...]``. Returns ``{"type": "question", "text": ...}`` or
        ``{"type": "code", "code": ..., "model": ...}`` (validated + repaired
        like :meth:`ai_generate`); code is never run without the pupil's Apply.
        """
        from robolearn.ai.ollama_client import OllamaClient, OllamaError

        if not isinstance(messages, list) or not messages:
            return {"ok": False, "reason": "Say what the rover should do first."}
        client = OllamaClient()
        if not client.available():
            return {
                "ok": False,
                "reason": "AI is offline. Start Ollama and pull a model such as "
                "qwen2.5-coder:3b or gemma3.",
            }
        model = self._pick_ai_model(client.models())
        if model is None:
            return {"ok": False, "reason": "Ollama has no models. Try: ollama pull gemma3"}

        prompt = self._build_chat_prompt(messages, lesson_id)
        try:
            raw = client.generate(
                prompt,
                system=self._AI_CHAT_SYSTEM,
                model=model,
                temperature=0.25,
                num_predict=self._AI_NUM_PREDICT,
                keep_alive=self._AI_KEEP_ALIVE,
            ).strip()
        except OllamaError as exc:
            return {"ok": False, "reason": f"AI failed: {exc}"}
        allowed = self._normalise_allowed_commands(allowed_commands)
        return self._finalize_chat_reply(
            client, model, raw, prompt=prompt, allowed_commands=allowed
        )

    def _build_chat_prompt(self, messages: list[dict[str, str]], lesson_id: str | None) -> str:
        """Render the bounded conversation transcript the model completes."""
        lines: list[str] = []
        lesson = self._find_lesson(lesson_id) if lesson_id else None
        if lesson is not None:
            lines.append(f"(Current lesson: {lesson.title}. Goal: {lesson.intro.strip()[:300]})")
        for m in messages[-12:]:  # bound the transcript
            role = "Pupil" if str(m.get("role", "user")) == "user" else "You"
            text = str(m.get("text", ""))[:1000]
            lines.append(f"{role}: {text}")
        lines.append("You:")
        return "\n".join(lines)

    def _pick_fast_model(self, installed: list[str]) -> str | None:
        """Pick the fastest capable model for the streaming draft.

        Prefers the baked ``robolearn-fast`` custom model, then any ~1B-class
        model. The draft is validated + repaired and escalates to the quality
        model on failure, so a small drafter is safe -- and several times
        faster to first token.
        """
        if self._ai_model_override and (not installed or self._ai_model_override in installed):
            return self._ai_model_override
        # The 1B kodro-fast drafter gives a fast first token; the 3B kodro-coder
        # is reserved for the quality/escalation pass in _pick_ai_model.
        for name in installed:
            if name.lower().startswith("kodro-fast"):
                return name
        for name in installed:
            if name.lower().startswith("robolearn-fast"):
                return name
        for name in installed:
            if ":1b" in name.lower():
                return name
        return None

    def _finalize_chat_reply(
        self,
        client: Any,
        model: str,
        raw: str,
        escalate_model: str | None = None,
        prompt: str = "",
        allowed_commands: frozenset[str] | None = None,
    ) -> dict[str, Any]:
        """Turn a raw model reply into a question or validated+repaired code.

        On a failed validation the same model gets ONE repair round; if that
        still fails and ``escalate_model`` is set (the draft came from the
        fast model), the request is regenerated once with the quality model.
        """
        from robolearn.ai.ollama_client import OllamaError

        first_line = next((ln.strip() for ln in raw.splitlines() if ln.strip()), "")
        if first_line.upper().startswith("QUESTION:"):
            return {
                "ok": True,
                "type": "question",
                "text": first_line[9:].strip(),
                "model": model,
            }
        if raw.upper().startswith("CODE:"):
            raw = raw[5:]
        code = _strip_code_fences(raw)
        if not code.strip():
            return {"ok": False, "reason": "The model returned nothing. Try rephrasing."}
        error = self._validate_generated(code, allowed_commands)
        if error is not None:
            with contextlib.suppress(OllamaError):
                repaired = _strip_code_fences(
                    client.generate(
                        f"Your previous program failed with: {error}\nProgram:\n{code}\n"
                        "Fix it. Reply with ONLY the corrected Python code.",
                        system=self._AI_CHAT_SYSTEM,
                        model=model,
                        temperature=0.2,
                        num_predict=self._AI_NUM_PREDICT,
                        keep_alive=self._AI_KEEP_ALIVE,
                    )
                )
                repaired_error = self._validate_generated(repaired, allowed_commands)
                if repaired.strip() and repaired_error is None:
                    return {"ok": True, "type": "code", "code": repaired, "model": model}
            # One fresh draft at a different temperature before escalating --
            # the fast model is cheap and a re-roll often lands valid.
            if prompt:
                with contextlib.suppress(OllamaError):
                    raw3 = client.generate(
                        prompt,
                        system=None
                        if str(model).startswith("robolearn-fast")
                        else self._AI_CHAT_SYSTEM,
                        model=model,
                        temperature=0.55,
                        num_predict=self._AI_NUM_PREDICT,
                        keep_alive=self._AI_KEEP_ALIVE,
                    ).strip()
                    if raw3.upper().startswith("CODE:"):
                        raw3 = raw3[5:]
                    code3 = _strip_code_fences(raw3)
                    if code3.strip() and self._validate_generated(code3, allowed_commands) is None:
                        return {"ok": True, "type": "code", "code": code3, "model": model}
            if escalate_model and escalate_model != model and prompt:
                with contextlib.suppress(OllamaError):
                    # keep_alive=0: unload the big model immediately after --
                    # keeping BOTH models resident starves RAM and measurably
                    # degrades every later fast-model draft on laptop hardware.
                    raw2 = client.generate(
                        prompt,
                        system=self._AI_CHAT_SYSTEM,
                        model=escalate_model,
                        temperature=0.25,
                        num_predict=self._AI_NUM_PREDICT,
                        keep_alive="0",
                    ).strip()
                    if raw2.upper().startswith("CODE:"):
                        raw2 = raw2[5:]
                    code2 = _strip_code_fences(raw2)
                    if code2.strip() and self._validate_generated(code2, allowed_commands) is None:
                        return {"ok": True, "type": "code", "code": code2, "model": escalate_model}
        if error is not None:
            return {
                "ok": False,
                "reason": "The model's program was rejected by Kodro's safety check.",
                "validationError": error,
                "rejectedCode": code,
                "model": model,
            }
        return {"ok": True, "type": "code", "code": code, "model": model}

    # --- streaming chat (start / poll over the pywebview bridge) -----------

    def ai_chat_start(
        self,
        messages: list[dict[str, str]],
        lesson_id: str | None = None,
        allowed_commands: list[str] | None = None,
    ) -> dict[str, Any]:
        """Begin a streamed chat reply; returns a job id to poll.

        pywebview calls can't stream a return value, so the reply is generated
        on a worker thread into a buffer and the UI polls :meth:`ai_chat_poll`
        -- the pupil watches the model think in real time instead of staring
        at a spinner for the whole generation.
        """
        import time as _time

        from robolearn.ai.ollama_client import OllamaClient

        if not isinstance(messages, list) or not messages:
            return {"ok": False, "reason": "Say what the rover should do first."}
        client = OllamaClient()
        # Use the cached model list when fresh: /api/tags can block for seconds
        # behind an in-flight generation, which doubled per-request latency.
        now = _time.monotonic()
        if self._ai_models_cache is not None and now - self._ai_models_cache[0] < 120:
            installed = self._ai_models_cache[1]
        else:
            if not client.available():
                return {"ok": False, "reason": "AI is offline. Start Ollama and pull a model."}
            installed = client.models()
            self._ai_models_cache = (now, installed)
        quality = self._pick_ai_model(installed)
        if quality is None:
            return {"ok": False, "reason": "Ollama has no models. Try: ollama pull gemma3"}
        # Use the measured quality model directly. A fast draft can be
        # syntactically valid yet semantically wrong (notably centimetres in the
        # metre API), which execution validation cannot infer from the request.
        model = quality
        job_id = uuid.uuid4().hex
        allowed = self._normalise_allowed_commands(allowed_commands)
        prompt = self._build_chat_prompt(messages, lesson_id)
        cache_key = prompt + "\n[allowed:" + ",".join(sorted(allowed or ())) + "]"
        # Instant replay for an identical request (classroom-repeated asks).
        cached = self._ai_answer_cache.get(cache_key)
        if cached is not None:
            with self._ai_jobs_lock:
                self._ai_jobs[job_id] = {"text": "", "done": True, "result": dict(cached)}
            return {"ok": True, "jobId": job_id, "model": cached.get("model"), "cached": True}
        with self._ai_jobs_lock:
            # Drop any finished-but-unclaimed jobs so the dict can't grow.
            for stale in [k for k, j in self._ai_jobs.items() if j["done"]]:
                self._ai_jobs.pop(stale, None)
            self._ai_jobs[job_id] = {"text": "", "done": False, "result": None}
        threading.Thread(
            target=self._run_chat_job,
            args=(job_id, client, model, prompt, quality, allowed, cache_key),
            daemon=True,
        ).start()
        return {"ok": True, "jobId": job_id, "model": model}

    def _run_chat_job(
        self,
        job_id: str,
        client: Any,
        model: str,
        prompt: str,
        quality: str | None = None,
        allowed_commands: frozenset[str] | None = None,
        cache_key: str = "",
    ) -> None:
        from robolearn.ai.ollama_client import OllamaError

        # The baked custom model carries the system prompt in its template.
        system = None if model.startswith("robolearn-fast") else self._AI_CHAT_SYSTEM
        try:
            for chunk in client.generate_stream(
                prompt,
                system=system,
                model=model,
                temperature=0.25,
                num_predict=self._AI_NUM_PREDICT,
                keep_alive=self._AI_KEEP_ALIVE,
            ):
                with self._ai_jobs_lock:
                    job = self._ai_jobs.get(job_id)
                    if job is None:  # UI gave up; stop wasting cycles
                        return
                    job["text"] += chunk
            with self._ai_jobs_lock:
                job = self._ai_jobs.get(job_id)
                raw = job["text"].strip() if job else ""
            result = self._finalize_chat_reply(
                client,
                model,
                raw,
                escalate_model=quality,
                prompt=prompt,
                allowed_commands=allowed_commands,
            )
            if result.get("ok") and result.get("type") == "code":
                if len(self._ai_answer_cache) > 40:
                    self._ai_answer_cache.clear()
                self._ai_answer_cache[cache_key or prompt] = dict(result)
        except OllamaError as exc:
            result = {"ok": False, "reason": f"AI failed: {exc}"}
        with self._ai_jobs_lock:
            job = self._ai_jobs.get(job_id)
            if job is not None:
                job["result"] = result
                job["done"] = True

    def ai_chat_poll(self, job_id: str) -> dict[str, Any]:
        """Poll a streamed reply: live text while running, the result when done."""
        with self._ai_jobs_lock:
            job = self._ai_jobs.get(job_id)
            if job is None:
                return {"ok": False, "reason": "unknown job"}
            if not job["done"]:
                return {"ok": True, "done": False, "text": job["text"]}
            self._ai_jobs.pop(job_id, None)
            result = dict(job["result"] or {"ok": False, "reason": "no result"})
        result["done"] = True
        return result

    def pick_photo(self) -> dict[str, Any]:
        """Let the pupil choose a LOCAL image; returns it as a data URL.

        The image never leaves the machine -- it is read from disk and handed
        to the UI inline, so a pupil can put a photo of themselves (or their
        dog) into the simulated world with ``place("photo")``.
        """
        try:
            window = webview.windows[0] if webview.windows else None
            if window is None:
                return {"ok": False, "reason": "no window"}
            picked = window.create_file_dialog(
                webview.OPEN_DIALOG,
                allow_multiple=False,
                file_types=("Images (*.png;*.jpg;*.jpeg;*.gif;*.webp)",),
            )
            if not picked:
                return {"ok": False, "reason": "cancelled"}
            first = picked[0] if isinstance(picked, (list, tuple)) else picked
            path = Path(str(first))
            if path.stat().st_size > 4_000_000:
                return {"ok": False, "reason": "Image too large - pick one under 4 MB."}
            import base64

            mime = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".webp": "image/webp",
            }.get(path.suffix.lower(), "image/png")
            data = base64.b64encode(path.read_bytes()).decode("ascii")
            return {"ok": True, "dataUrl": f"data:{mime};base64,{data}", "name": path.name}
        except Exception as exc:  # pragma: no cover - host dialog dependent
            return {"ok": False, "reason": str(exc)}

    # --- KRS spec import/export (PERFECTION_PLAN SI1) -----------------------

    #: Hard cap on an imported spec file: a KRS JSON is a few KB; anything
    #: larger is not a spec (mirrors pick_photo's size guard).
    _SPEC_MAX_BYTES = 262_144

    def import_robot_spec(self) -> dict[str, Any]:
        """Open a file dialog for a KRS JSON spec or a URDF and return spec text.

        Validation happens in JS (specschema.js is the single validator for
        both the desktop and browser paths); this method only reads the file
        so the UI never needs filesystem access. A ``.urdf`` pick is converted
        to KRS JSON first, so the JS side keeps receiving the one shape it
        already validates.
        """
        try:
            window = webview.windows[0] if webview.windows else None
            if window is None:
                return {"ok": False, "reason": "no window"}
            picked = window.create_file_dialog(
                webview.OPEN_DIALOG,
                allow_multiple=False,
                file_types=("Robot spec (*.json;*.urdf)",),
            )
            if not picked:
                return {"ok": False, "reason": "cancelled"}
            first = picked[0] if isinstance(picked, (list, tuple)) else picked
            path = Path(str(first))
            if path.stat().st_size > self._SPEC_MAX_BYTES:
                return {"ok": False, "reason": "Spec file is larger than 256 KB."}
            if path.suffix.lower() == ".urdf":
                return self._urdf_spec_payload(path)
            return {"ok": True, "text": path.read_text(encoding="utf-8"), "name": path.name}
        except Exception as exc:  # pragma: no cover - host dialog dependent
            return {"ok": False, "reason": str(exc)}

    @staticmethod
    def _urdf_spec_payload(path: Path) -> dict[str, Any]:
        """Convert a picked ``.urdf`` into the same {ok, text, name} payload.

        The import stays inside this branch so a plain JSON pick never touches
        the interop module (yourdfpy itself only loads on the first convert).
        The converter's ``declared`` honesty notes are stripped before
        serialising: KRS reserves top-level ``declared`` for the
        {maxSpeedMps, runtimeMin} object, and an array there would fail
        specschema.js validate() and sink the whole import.
        """
        try:
            from robolearn.interop.urdf_io import krs_from_urdf

            krs = krs_from_urdf(path)
        except (ImportError, ValueError, OSError) as exc:
            return {"ok": False, "reason": str(exc)}
        payload = {key: value for key, value in krs.items() if key != "declared"}
        return {"ok": True, "text": json.dumps(payload, indent=2), "name": path.name}

    def export_robot_spec(
        self, json_text: str, suggested_name: str = "robot.kodro.json"
    ) -> dict[str, Any]:
        """Save the validated KRS spec (plus derived block) via a save dialog."""
        return self._save_text_dialog(
            str(json_text or ""),
            str(suggested_name or "robot.kodro.json"),
            ("Robot spec (*.json)",),
            self._SPEC_MAX_BYTES,
        )

    def export_urdf(self, json_text: str, suggested_name: str = "robot.urdf") -> dict[str, Any]:
        """Convert a validated KRS build to a diff-drive URDF and save it.

        The "graduate to ROS / Webots / Gazebo" bridge: a wheeled build becomes
        a plain-primitive URDF (boxes + cylinders, no meshes) any ROS toolchain
        opens. Offline and dependency-light -- the generator builds the document
        by hand, so no ROS install or optional extra is needed. An armless or
        wheel-less build is refused with a reason rather than emitting a
        misleading diff-drive body it cannot physically be.
        """
        try:
            data = json.loads(json_text or "{}")
        except (ValueError, TypeError):
            return {"ok": False, "reason": "robot spec is not valid JSON"}
        if not isinstance(data, dict):
            return {"ok": False, "reason": "robot spec is not an object"}
        try:
            spec = kodro_spec_from_krs(data)
        except (ValueError, TypeError, KeyError) as exc:
            return {"ok": False, "reason": f"cannot read the robot spec: {exc}"}
        if not spec.looks_like_rover:
            return {
                "ok": False,
                "reason": "URDF export is for wheeled (drivable) builds; this build has no wheels.",
            }
        try:
            urdf = build_urdf_from_spec(spec)
        except ValueError as exc:
            return {"ok": False, "reason": str(exc)}
        return self._save_text_dialog(
            urdf,
            str(suggested_name or "robot.urdf"),
            ("URDF robot (*.urdf)",),
            self._SPEC_MAX_BYTES,
        )

    def save_verification_report(
        self, html_text: str, suggested_name: str = "kodro-verification.html"
    ) -> dict[str, Any]:
        """Save the per-robot verification report ("your robot as simulated")."""
        return self._save_text_dialog(
            str(html_text or ""),
            str(suggested_name or "kodro-verification.html"),
            ("HTML report (*.html)",),
            2_000_000,
        )

    @staticmethod
    def _save_text_dialog(
        text: str, suggested_name: str, file_types: tuple[str, ...], max_bytes: int
    ) -> dict[str, Any]:
        """Shared SAVE_DIALOG writer for small text artefacts (spec, report)."""
        if not text.strip():
            return {"ok": False, "reason": "nothing to save"}
        if len(text.encode("utf-8")) > max_bytes:
            return {"ok": False, "reason": "content too large"}
        try:
            window = webview.windows[0] if webview.windows else None
            if window is None:
                return {"ok": False, "reason": "no window"}
            picked = window.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename=suggested_name,
                file_types=file_types,
            )
            if not picked:
                return {"ok": False, "reason": "cancelled"}
            first = picked[0] if isinstance(picked, (list, tuple)) else picked
            path = Path(str(first))
            path.write_text(text, encoding="utf-8")
            return {"ok": True, "path": str(path)}
        except Exception as exc:  # pragma: no cover - host dialog dependent
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
            # The worked answer. Shipped to the client because a pupil who has
            # used every hint and is still stuck needs a way forward that is not
            # "give up"; tests/unit/test_lesson_solutions.py proves each one
            # actually passes, so this is never a wrong answer presented as
            # right. The UI reveals it only after the hint bank is exhausted.
            "solutionCode": lesson.solution_code,
            "terrain": lesson.terrain.value
            if hasattr(lesson.terrain, "value")
            else str(lesson.terrain),
            "maxLines": lesson.max_lines,
            "readingAge": lesson.reading_age,
            "glossary": dict(lesson.glossary),
        }


#: The engine's baseline per-metre battery drain (mass factor 1). An imported
#: energy-true build reports its own per-metre percentage; dividing by this gives
#: the drain_scale that reproduces that measured figure through the fixed-rate
#: Rover, so grading an energy-true build matches its real endurance.
_BASELINE_DRAIN_PCT_PER_M: float = float(BATTERY_PER_METRE)


def _drain_scale_for(mass_factor: float | None, drain_pct_per_m: float | None) -> float:
    """Resolve the Rover drain_scale from the client's build numbers.

    An energy-true per-metre drain (from a measured build's real pack) wins over
    the mass-factor proxy; either is validated as a positive finite number and
    falls back to 1.0 (the pre-existing fixed drain) when absent or nonsensical.
    """
    if drain_pct_per_m is not None:
        try:
            true_pct = float(drain_pct_per_m)
            if true_pct > 0 and math.isfinite(true_pct) and _BASELINE_DRAIN_PCT_PER_M > 0:
                return true_pct / _BASELINE_DRAIN_PCT_PER_M
        except (TypeError, ValueError):
            pass
    if mass_factor is not None:
        try:
            mf = float(mass_factor)
            if mf > 0 and math.isfinite(mf):
                return mf
        except (TypeError, ValueError):
            pass
    return 1.0


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
        distance_travelled_m=s.distance_travelled_m,
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
    # Small local models may emit a normal opening fence, or omit it, and then
    # append an explanation after the closing fence. Everything after the first
    # closing delimiter is non-code in both cases.
    for marker in ("\r\n```", "\n```"):
        if marker in text:
            text = text.split(marker, 1)[0]
            break
    if text.rstrip().endswith("```"):
        text = text.rstrip()[:-3]
    return (
        _ensure_entrypoint(
            _quote_place_kinds(_normalize_rover_api(_normalize_quotes(text.strip())))
        )
        + "\n"
    )


def _quote_place_kinds(code: str) -> str:
    """Repair prop-call slips small models make, deterministically.

    Observed live: ``place(person)`` (bare name -> NameError) and invented
    helpers like ``place_person(1)``. Both have one obvious meaning; fixing
    them here beats a model repair round-trip.
    """
    import re

    code = re.sub(
        r"\bplace\(\s*(flag|beacon|person|tree|rock|crate|photo|drone)\s*([,)])",
        r'place("\1"\2',
        code,
    )
    return re.sub(
        r"\bplace_(flag|beacon|person|tree|rock|crate|photo|drone)\s*\([^)]*\)",
        r'place("\1")',
        code,
    )


def _normalize_quotes(code: str) -> str:
    """Replace typographic quotes (a small-model artifact) with ASCII ones."""
    return (
        code.replace("‘", "'")  # noqa: RUF001 - intentional typographic quote
        .replace("’", "'")  # noqa: RUF001 - intentional typographic quote
        .replace("“", '"')
        .replace("”", '"')
    )


_ROVER_API_ALIASES = {
    "forward": "move_forward",
    "backward": "move_backward",
    "left": "turn_left",
    "right": "turn_right",
}
_BARE_ROVER_NAMES = ("rover", "robot", "bot")


def _normalize_rover_api(code: str) -> str:
    """Rewrite object-method rover calls to the bare-function API, deterministically.

    The small local model strongly prefers object-method style
    (``rover.move_forward(3)``, ``rover.right(90)``, ``rover.set_speed(60)``)
    which the interpreter's bare-function surface (``move_forward``,
    ``turn_right``, ``set_speed`` ...) rejects with ``NameError``. This mirrors
    the browser path's ``normalizeApi`` in ``ai-web.jsx``: strip the
    ``rover.``/``robot.``/``bot.`` receiver and apply the
    ``forward``/``backward``/``left``/``right`` aliases, so the output runs
    however stubbornly the model writes it -- no model repair round-trip.

    It also drops a dangling bare ``rover``/``robot``/``bot`` statement on its
    own line (a standalone identifier that the JS method-call regex misses and
    that would ``NameError`` at run time), e.g. the trailing ``rover`` the model
    emits after a block of ``rover.x()`` calls.
    """
    import re

    def _to_bare(match: re.Match[str]) -> str:
        name = match.group(1)
        return f"{_ROVER_API_ALIASES.get(name, name)}("

    rewritten = re.sub(r"\b(?:rover|robot|bot)\.([A-Za-z_]\w*)\s*\(", _to_bare, code)
    kept = [line for line in rewritten.splitlines() if line.strip() not in _BARE_ROVER_NAMES]
    return "\n".join(kept)


def _ensure_entrypoint(code: str) -> str:
    """Append a call when a model wraps everything in an uncalled function.

    Observed live: gemma wrapped the whole program in ``def main():`` and never
    called it, so Run "completed" instantly with the rover never moving. If the
    program's top level consists ONLY of function definitions (plus comments /
    blank lines) the first defined function is called at the end.
    """
    lines = code.splitlines()
    first_def: str | None = None
    only_defs = True
    in_def = False
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if line[:1] not in (" ", "\t"):  # top-level statement
            if stripped.startswith("def ") and "(" in stripped:
                if first_def is None:
                    first_def = stripped[4 : stripped.index("(")].strip()
                in_def = True
            else:
                only_defs = False
                in_def = False
        elif not in_def:
            only_defs = False
    if first_def and only_defs:
        return f"{code}\n\n{first_def}()"
    return code


def _startup_failure_message(exc: BaseException) -> str:
    """Human-readable guidance for a pywebview start failure."""
    return (
        "Kodro could not open its window.\n\n"
        "This usually means the Microsoft Edge WebView2 Runtime is missing. "
        "It is free and installs in under a minute:\n\n"
        "    https://developer.microsoft.com/microsoft-edge/webview2/\n\n"
        "Install it, then start Kodro again. (You can also use the classic "
        "interface with:  python -m robolearn)\n\n"
        f"Technical details: {type(exc).__name__}: {exc}"
    )


def _report_startup_failure(exc: BaseException) -> None:
    """Show a friendly native dialog instead of a silent crash / raw traceback."""
    message = _startup_failure_message(exc)
    LOG.error("web UI failed to start: %s", exc)
    # Read through a variable so mypy (which narrows sys.platform per-OS and
    # runs on Linux/macOS in CI) doesn't mark the Windows body unreachable.
    platform: str = sys.platform
    if platform.startswith("win"):
        with contextlib.suppress(Exception):
            import ctypes

            # getattr: ctypes.windll only exists (and only type-checks) on
            # Windows; CI runs mypy on Linux/macOS too.
            windll = getattr(ctypes, "windll", None)
            if windll is not None:
                # MB_OK | MB_ICONERROR | MB_SETFOREGROUND
                windll.user32.MessageBoxW(0, message, "Kodro", 0x10 | 0x10000)
                return
    sys.stderr.write(message + "\n")


def launch(*, db_path: Path | None = None, debug: bool = False) -> None:
    """Build and enter the pywebview main loop. Blocks until the window closes."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    with contextlib.suppress(Exception):
        _ = json  # keep json imported (used implicitly by pywebview)

    # Opening Kodro also brings the local AI up: if Ollama is installed but its
    # server is down, start it and pre-load the preferred model so the first
    # Vibe reply is fast. Runs on a daemon thread so the window NEVER waits on
    # it, and failure is silent by design -- the app's normal "AI offline"
    # messaging (with install steps) already covers the not-installed case.
    def _boot_ollama() -> None:
        with contextlib.suppress(Exception):
            from robolearn.ai import ollama_client

            ollama_client.ensure_server()

    threading.Thread(target=_boot_ollama, name="ollama-autostart", daemon=True).start()
    try:
        # build_app loads the bundled lesson library and the index HTML; a
        # missing or corrupt bundled asset raises here, BEFORE webview.start.
        # Route that through the same native failure dialog rather than letting
        # a raw traceback escape the windowed, console-less .exe.
        build_app(db_path=db_path)
        webview.start(debug=debug)
    except Exception as exc:  # e.g. WebView2 runtime missing, or a bad bundle
        # Tell the user what to do (native dialog) rather than crash silently
        # with a raw traceback in the packaged, windowed .exe.
        _report_startup_failure(exc)
        raise SystemExit(1) from exc
