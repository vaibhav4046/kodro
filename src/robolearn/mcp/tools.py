"""Tool and resource handlers for the Kodro MCP server.

This is the domain half of the server: what an assistant may ask for and what
comes back. :mod:`robolearn.mcp.server` owns the JSON-RPC wire format and knows
nothing about lessons; this module owns the lessons and knows nothing about
JSON-RPC. Handlers return plain JSON-serialisable dicts.

Two deliberate limits, stated here rather than discovered later:

* ``get_lesson`` does not return the worked solution unless the caller asks for
  it explicitly. Every lesson ships one, and an assistant that hands it over on
  a vague "help me with lesson 3" has replaced the learning with a transcript.
  The flag makes revealing it a decision somebody made on purpose.
* Only the bundled library is served. Teacher-authored lessons live behind
  :func:`robolearn.ui.lesson_editor.load_custom_lessons`, which imports Tk, and
  importing Tk here would stop the server starting in a headless process.
"""

from __future__ import annotations

import inspect
import json
import math
from difflib import get_close_matches
from pathlib import Path
from typing import Any, Final

from robolearn import rover_api
from robolearn.lessons.schema import Lesson, load_library
from robolearn.memory.store import DEFAULT_DB_PATH, Store
from robolearn.runtime.session import RunOutcome, run_against_lesson
from robolearn.runtime.tracer import Event

#: Largest pupil program the server will accept, in characters. Lessons cap at
#: a few dozen lines; anything past this is not a lesson attempt and does not
#: need to reach the sandbox to be refused.
MAX_SOURCE_CHARS: Final[int] = 20_000

#: Cap on events returned by ``run_program``. A runaway loop can emit thousands
#: before the timeout fires, and an assistant reading the tail learns nothing a
#: truncation note does not already tell it.
MAX_EVENTS_RETURNED: Final[int] = 200

#: Seeds per contract in ``prove_contracts``. Matches the value CI records in
#: the committed manifest, so a verdict from this tool is comparable with it.
DEFAULT_CONTRACT_RUNS: Final[int] = 5

_LESSON_CACHE: list[Lesson] | None = None


def _library() -> list[Lesson]:
    """Return the bundled lesson library, loaded once per process."""
    global _LESSON_CACHE
    if _LESSON_CACHE is None:
        _LESSON_CACHE = list(load_library())
    return _LESSON_CACHE


def _find_lesson(lesson_id: str) -> Lesson:
    """Look up a lesson by id, or raise :class:`ToolError` naming the near misses."""
    wanted = (lesson_id or "").strip()
    for lesson in _library():
        if lesson.id == wanted:
            return lesson
    lowered = wanted.lower()
    close = [lsn.id for lsn in _library() if lowered and lowered in lsn.id.lower()]
    hint = f" Did you mean: {', '.join(close[:5])}?" if close else ""
    raise ToolError(f"No lesson with id {wanted!r}.{hint} Call list_lessons for the full list.")


class ToolError(Exception):
    """A tool failed in a way the caller should see and can act on.

    Distinct from an unexpected exception: this is a bad lesson id or an
    oversized program, not a bug, so the server reports it as tool-level
    ``isError`` content rather than a JSON-RPC internal error.
    """


# --- serialisation ---------------------------------------------------------


def _jsonable(value: Any) -> Any:
    """Coerce a tracer value into something ``json.dumps`` will accept.

    Tracer results carry whatever the rover API returned -- floats, colour
    tuples, bools -- and a non-finite float (which ``read_distance`` can yield
    as its no-obstacle sentinel) is not valid JSON. Those become ``None`` here
    rather than emitting ``Infinity``, which strict JSON parsers reject.
    """
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, (str, int, bool)) or value is None:
        return value
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    return str(value)


def _event_dict(event: Event) -> dict[str, Any]:
    """Flatten one tracer event for the wire."""
    return {
        "frame": event.frame,
        "tsMs": event.ts_ms,
        "kind": str(getattr(event.kind, "value", event.kind)),
        "name": event.name,
        "args": [_jsonable(arg) for arg in event.args],
        "result": _jsonable(event.result),
    }


def _lesson_summary(lesson: Lesson) -> dict[str, Any]:
    """One row of the curriculum index."""
    return {
        "id": lesson.id,
        "title": lesson.title,
        "keyStage": str(getattr(lesson.key_stage, "value", lesson.key_stage)),
        "terrain": str(getattr(lesson.terrain, "value", lesson.terrain)),
        "concepts": [str(getattr(c, "value", c)) for c in lesson.ct_concepts],
        "prereqs": list(lesson.prereqs),
        "maxLines": lesson.max_lines,
        "readingAge": lesson.reading_age,
        "curriculumRefs": list(lesson.curriculum_refs),
    }


def _outcome_dict(outcome: RunOutcome, *, include_events: bool) -> dict[str, Any]:
    """Serialise a completed run: how it ended, where it ended, what it did."""
    final = outcome.final
    payload: dict[str, Any] = {
        "execution": {
            "success": outcome.execution.success,
            "errorKind": outcome.execution.error_kind,
            "errorMessage": outcome.execution.error_message,
            "errorLine": outcome.execution.error_line,
            "durationMs": outcome.execution.duration_ms,
        },
        "verdict": {
            "passed": outcome.verdict.passed,
            "score": outcome.verdict.score,
            "reasons": list(outcome.verdict.reasons),
        },
        "finalState": {
            "x": round(final.x, 4),
            "y": round(final.y, 4),
            "headingDeg": round(final.heading_deg, 2),
            "batteryPct": round(final.battery_pct, 3),
            "samplesHeld": final.samples_held,
            "samplesCollected": final.samples_collected,
            "collisions": final.collisions,
            "distanceTravelledM": round(final.distance_travelled_m, 4),
        },
        "eventCount": len(outcome.events),
    }
    if include_events:
        shown = outcome.events[:MAX_EVENTS_RETURNED]
        payload["events"] = [_event_dict(e) for e in shown]
        if len(outcome.events) > len(shown):
            payload["eventsTruncated"] = len(outcome.events) - len(shown)
    return payload


# --- tool handlers ---------------------------------------------------------


def list_lessons(params: dict[str, Any]) -> dict[str, Any]:
    """Return the curriculum index, optionally filtered by key stage or concept."""
    key_stage = str(params.get("keyStage") or "").strip().lower()
    concept = str(params.get("concept") or "").strip().lower()
    rows = [_lesson_summary(lesson) for lesson in _library()]
    if key_stage:
        rows = [r for r in rows if r["keyStage"].lower() == key_stage]
    if concept:
        rows = [r for r in rows if any(concept in c.lower() for c in r["concepts"])]
    return {"count": len(rows), "lessons": rows}


def get_lesson(params: dict[str, Any]) -> dict[str, Any]:
    """Return one lesson in full: brief, starter code, criteria, glossary."""
    lesson = _find_lesson(str(params.get("lessonId") or ""))
    payload = _lesson_summary(lesson)
    payload.update(
        {
            "intro": lesson.intro,
            "starterCode": lesson.starter_code,
            "allowedConstructs": [str(getattr(c, "value", c)) for c in lesson.allowed_constructs],
            "glossary": dict(lesson.glossary),
            "successCriteria": [
                json.loads(criterion.model_dump_json()) for criterion in lesson.success_criteria
            ],
            "world": {
                "width": lesson.world.width,
                "height": lesson.world.height,
                "base": list(lesson.world.base),
                "samples": [list(s) for s in lesson.world.samples],
                "obstacles": [{"x": o.x, "y": o.y, "r": o.r} for o in lesson.world.obstacles],
            },
            "hasSolution": lesson.solution_code is not None,
        }
    )
    if params.get("includeSolution"):
        payload["solutionCode"] = lesson.solution_code
    else:
        payload["solutionNote"] = (
            "Worked solution withheld. Pass includeSolution=true only when the pupil has "
            "already exhausted the hints; handing it over earlier replaces the learning."
        )
    return payload


def _validated_source(params: dict[str, Any]) -> str:
    """Pull ``source`` out of the params, refusing anything oversized."""
    source = params.get("source")
    if not isinstance(source, str):
        raise ToolError("'source' must be a string containing the pupil's program.")
    if len(source) > MAX_SOURCE_CHARS:
        raise ToolError(
            f"Program is {len(source)} characters; the limit is {MAX_SOURCE_CHARS}. "
            "Lesson attempts are a few dozen lines."
        )
    return source


def run_program(params: dict[str, Any]) -> dict[str, Any]:
    """Run a program against a lesson world and report what the rover did."""
    lesson = _find_lesson(str(params.get("lessonId") or ""))
    source = _validated_source(params)
    outcome = run_against_lesson(lesson, source)
    payload = _outcome_dict(outcome, include_events=True)
    payload["lessonId"] = lesson.id
    return payload


def grade_program(params: dict[str, Any]) -> dict[str, Any]:
    """Run a program and return the marking verdict, criterion by criterion.

    Identical physics to :func:`run_program` -- same reference rover, same
    grader the desktop app and the browser both call -- so a score reported
    here is the score the pupil sees, not an approximation of it.
    """
    lesson = _find_lesson(str(params.get("lessonId") or ""))
    source = _validated_source(params)
    outcome = run_against_lesson(lesson, source)
    payload = _outcome_dict(outcome, include_events=False)
    payload["lessonId"] = lesson.id
    payload["criteria"] = [
        json.loads(criterion.model_dump_json()) for criterion in lesson.success_criteria
    ]
    return payload


def check_api(params: dict[str, Any]) -> dict[str, Any]:
    """List the rover API the sandbox exposes to pupil code.

    Read out of :data:`robolearn.rover_api.__all__` with :mod:`inspect` rather
    than transcribed, so this can never describe a function the sandbox does
    not actually provide.
    """
    name_filter = str(params.get("nameContains") or "").strip().lower()
    functions: list[dict[str, Any]] = []
    for name in rover_api.__all__:
        func = getattr(rover_api, name, None)
        if func is None or not callable(func):
            continue
        if name_filter and name_filter not in name.lower():
            continue
        doc = inspect.getdoc(func) or ""
        functions.append(
            {
                "name": name,
                "signature": f"{name}{inspect.signature(func)}",
                "summary": doc.split("\n\n")[0].replace("\n", " ").strip(),
            }
        )
    return {"count": len(functions), "functions": functions}


def validate_robot_spec(params: dict[str, Any]) -> dict[str, Any]:
    """Validate an exported KRS robot spec and report what the simulator derives.

    Accepts the JSON the Robot Lab's ``exportKrs()`` writes, either inline as
    ``spec`` or as a path in ``path``. Reports the derived mass, wheel count and
    degrees of freedom, and whether the optional URDF exporter is installed --
    it lives behind the ``interop`` extra, so its absence is a fact to report,
    not a failure.
    """
    from robolearn.interop.urdf_io import kodro_spec_from_krs

    raw = params.get("spec")
    if raw is None:
        path_str = str(params.get("path") or "").strip()
        if not path_str:
            raise ToolError("Pass either 'spec' (the parsed KRS object) or 'path' to a .krs file.")
        path = Path(path_str)
        if not path.is_file():
            raise ToolError(f"No such file: {path}")
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ToolError(f"Could not read {path} as JSON: {exc}") from exc
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ToolError(f"'spec' is a string but not valid JSON: {exc}") from exc
    if not isinstance(raw, dict):
        raise ToolError("'spec' must be a JSON object (the parsed .krs file).")

    try:
        spec = kodro_spec_from_krs(raw)
    except (TypeError, ValueError) as exc:
        raise ToolError(f"KRS spec rejected: {exc}") from exc

    try:
        import yourdfpy  # noqa: F401

        urdf_available = True
    except ImportError:
        urdf_available = False

    warnings: list[str] = []
    if spec.mass_kg <= 0:
        warnings.append("Mass is zero or negative; the drain model needs a positive mass.")
    if spec.wheel_count == 1:
        warnings.append("One wheel cannot steer: the diff-drive model needs two or more.")
    if spec.wheel_radius_m is None and spec.wheel_count:
        warnings.append("No wheel radius in the drive block; top speed falls back to the default.")

    return {
        "name": spec.name,
        "massKg": spec.mass_kg,
        "linkCount": spec.link_count,
        "jointCount": spec.joint_count,
        "actuatedJointCount": spec.actuated_joint_count,
        "wheelCount": spec.wheel_count,
        "wheelRadiusM": spec.wheel_radius_m,
        "degreesOfFreedom": spec.degrees_of_freedom,
        "looksLikeRover": spec.looks_like_rover,
        "looksLikeArm": spec.looks_like_arm,
        "warnings": warnings,
        "urdfExportAvailable": urdf_available,
        "urdfExportNote": (
            "URDF export is available."
            if urdf_available
            else "URDF export needs the optional 'interop' extra (pip install robolearn[interop])."
        ),
    }


def prove_contracts(params: dict[str, Any]) -> dict[str, Any]:
    """Re-run the physics contracts and report the manifest verdict.

    The contracts are the engine's own regression evidence: fixed seeds, fixed
    controllers, recorded metrics. Running them from here lets an assistant
    answer "did the physics change?" with the same artefact CI uses.
    """
    from robolearn.prove import build_manifest, load_contracts

    contracts = load_contracts()
    wanted = str(params.get("contractId") or "").strip()
    if wanted:
        contracts = tuple(c for c in contracts if c.contract_id == wanted)
        if not contracts:
            raise ToolError(f"No contract with id {wanted!r}.")
    # ``params.get("runs") or DEFAULT`` would be wrong: 0 is falsey, so an
    # explicit ``runs: 0`` would silently become 5 runs and the guard below
    # could never fire. Absent and zero are different requests and one of them
    # is a mistake the caller needs told about.
    raw_runs = params.get("runs")
    if raw_runs is None:
        runs = DEFAULT_CONTRACT_RUNS
    else:
        try:
            runs = int(raw_runs)
        except (TypeError, ValueError) as exc:
            raise ToolError(f"'runs' must be a whole number, got {raw_runs!r}.") from exc
    if runs < 1:
        raise ToolError("'runs' must be at least 1.")
    manifest = build_manifest(contracts, runs=runs)
    rows = manifest.get("contracts", [])
    return {
        "verdict": manifest.get("verdict"),
        "engine": manifest.get("engine", {}),
        "runsPerContract": runs,
        "contractCount": len(rows),
        "contracts": [
            {
                "contractId": row["contract_id"],
                "title": row["title"],
                "verdict": row["aggregate"]["verdict"],
                "passRate": row["aggregate"]["pass_rate"],
                "meanDistanceM": row["aggregate"]["mean_distance_m"],
                "meanCollisions": row["aggregate"]["mean_collisions"],
                "meanBatteryPct": row["aggregate"]["mean_battery_pct"],
                "maxGoalErrorM": row["aggregate"]["max_goal_error_m"],
            }
            for row in rows
        ],
        "evidenceBoundary": manifest.get("evidence_boundary"),
    }


def pupil_progress(params: dict[str, Any]) -> dict[str, Any]:
    """Summarise local progress: attempts, passes and per-concept strength.

    Reads the same SQLite file the desktop app writes, on this machine only.
    A fresh install has no database yet; that is reported as "no submissions",
    not as an error.
    """
    from robolearn.memory.pupil_model import get_strengths

    db_path = Path(str(params["dbPath"])) if params.get("dbPath") else DEFAULT_DB_PATH
    if not db_path.exists():
        return {
            "dbPath": str(db_path),
            "exists": False,
            "note": "No pupil database on this machine yet. Nothing has been submitted.",
            "pupils": [],
        }
    store = Store(db_path)
    pupils = store.list_pupils()
    wanted = str(params.get("pupilId") or "").strip()
    if wanted:
        pupils = [p for p in pupils if p.id == wanted]
        if not pupils:
            raise ToolError(f"No pupil with id {wanted!r} in {db_path}.")

    rows: list[dict[str, Any]] = []
    for pupil in pupils:
        submissions = store.list_submissions(pupil_id=pupil.id)
        passed_ids = sorted({s.lesson_id for s in submissions if s.passed})
        rows.append(
            {
                "pupilId": pupil.id,
                "displayName": pupil.display_name,
                "attempts": len(submissions),
                "lessonsPassed": len(passed_ids),
                "passedLessonIds": passed_ids,
                "bestScore": max((s.score for s in submissions), default=None),
                "conceptStrengths": [
                    {"concept": s.concept, "score": round(s.score, 3)}
                    for s in get_strengths(store, pupil.id)
                ],
            }
        )
    return {"dbPath": str(db_path), "exists": True, "pupils": rows}


# --- tool registry ---------------------------------------------------------

#: Every tool the server advertises, in the shape ``tools/list`` returns.
#: ``handler`` is stripped before the descriptor goes on the wire.
TOOLS: Final[tuple[dict[str, Any], ...]] = (
    {
        "name": "list_lessons",
        "description": (
            "List Kodro's bundled lessons with their key stage, computational-thinking "
            "concepts, prerequisites and line limit. Start here to find a lesson id."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "keyStage": {
                    "type": "string",
                    "description": "Optional key-stage filter, e.g. 'KS3'.",
                },
                "concept": {
                    "type": "string",
                    "description": "Optional substring filter on the CT concepts.",
                },
            },
        },
        "handler": list_lessons,
    },
    {
        "name": "get_lesson",
        "description": (
            "Full detail for one lesson: the pupil-facing brief, the starter code, the "
            "success criteria the grader checks, the arena layout and the glossary. The "
            "worked solution is withheld unless includeSolution is set."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "lessonId": {"type": "string", "description": "Lesson id from list_lessons."},
                "includeSolution": {
                    "type": "boolean",
                    "description": (
                        "Reveal the worked solution. Only after the pupil has used every hint."
                    ),
                },
            },
            "required": ["lessonId"],
        },
        "handler": get_lesson,
    },
    {
        "name": "run_program",
        "description": (
            "Run a pupil's program against a lesson's world in the sandboxed interpreter "
            "and return how it terminated, where the rover ended up, and the trace of "
            "every command it executed. Use this to debug a program that misbehaves."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "lessonId": {"type": "string", "description": "Lesson id from list_lessons."},
                "source": {"type": "string", "description": "The pupil's Python program."},
            },
            "required": ["lessonId", "source"],
        },
        "handler": run_program,
    },
    {
        "name": "grade_program",
        "description": (
            "Mark a program against a lesson's success criteria and return the pass/fail "
            "verdict, the 0-100 score and one reason per failed criterion. Same grader "
            "and same reference rover the pupil's own Run button uses."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "lessonId": {"type": "string", "description": "Lesson id from list_lessons."},
                "source": {"type": "string", "description": "The pupil's Python program."},
            },
            "required": ["lessonId", "source"],
        },
        "handler": grade_program,
    },
    {
        "name": "check_api",
        "description": (
            "List the rover functions pupil code may call, with signatures and one-line "
            "summaries, read live from the sandbox's own allow-list. Check here before "
            "suggesting a function exists."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "nameContains": {
                    "type": "string",
                    "description": "Optional substring filter, e.g. 'read'.",
                }
            },
        },
        "handler": check_api,
    },
    {
        "name": "validate_robot_spec",
        "description": (
            "Validate a robot exported from the Robot Lab (.krs JSON) and report the mass, "
            "wheel count and degrees of freedom the simulator derives from it, plus any "
            "warnings that would make it behave oddly."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "spec": {
                    # Declared as a union because the handler genuinely accepts
                    # both, and assistants routinely send the file's contents as
                    # a string rather than re-parsing it. Advertising
                    # object-only would make the schema a lie the validator then
                    # enforced.
                    "type": ["object", "string"],
                    "description": "The parsed .krs object, or its JSON as a string.",
                },
                "path": {"type": "string", "description": "Path to a .krs file instead."},
            },
        },
        "handler": validate_robot_spec,
    },
    {
        "name": "prove_contracts",
        "description": (
            "Re-run Kodro's physics contracts on fixed seeds and report whether the engine "
            "still produces the recorded metrics. Answers 'did the simulation change?'."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "contractId": {
                    "type": "string",
                    "description": "Optional single contract to run.",
                },
                "runs": {
                    "type": "integer",
                    "description": "Seeds per contract (default 5, matching CI).",
                },
            },
        },
        "handler": prove_contracts,
    },
    {
        "name": "pupil_progress",
        "description": (
            "Summarise progress from the local pupil database on this machine: attempts, "
            "lessons passed and per-concept strength. Nothing leaves the machine."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "pupilId": {"type": "string", "description": "Optional single pupil."},
                "dbPath": {"type": "string", "description": "Optional non-default database."},
            },
        },
        "handler": pupil_progress,
    },
)

#: Tool descriptors as they go on the wire, handler stripped.
TOOL_DESCRIPTORS: Final[tuple[dict[str, Any], ...]] = tuple(
    {k: v for k, v in tool.items() if k != "handler"} for tool in TOOLS
)

_HANDLERS: Final[dict[str, Any]] = {tool["name"]: tool["handler"] for tool in TOOLS}

_SCHEMAS: Final[dict[str, dict[str, Any]]] = {
    tool["name"]: tool["inputSchema"] for tool in TOOLS
}

#: JSON Schema type names mapped to what Python accepts for them, with the
#: phrasing used in the error. ``bool`` is excluded from the numeric rows by the
#: check itself: ``isinstance(True, int)`` is true in Python, and silently
#: marking a program with ``runs: true`` meaning one run is the sort of
#: coincidence that produces a wrong answer nobody questions.
_JSON_TYPES: Final[dict[str, tuple[tuple[type, ...], str]]] = {
    "string": ((str,), "a string"),
    "integer": ((int,), "a whole number"),
    "number": ((int, float), "a number"),
    "boolean": ((bool,), "true or false"),
    "object": ((dict,), "an object"),
    "array": ((list, tuple), "an array"),
}


def _type_name(value: Any) -> str:
    """Name a received value's type in the caller's vocabulary, not Python's."""
    if isinstance(value, bool):
        return "a true/false value"
    if isinstance(value, str):
        return "a string"
    if isinstance(value, int):
        return "a whole number"
    if isinstance(value, float):
        return "a number"
    if isinstance(value, dict):
        return "an object"
    if isinstance(value, (list, tuple)):
        return "an array"
    return f"{type(value).__name__}"


def _validate_params(name: str, schema: dict[str, Any], params: dict[str, Any]) -> None:
    """Check ``params`` against the tool's advertised ``inputSchema``.

    The schemas were published to clients from the start but nothing enforced
    them, and the two failure modes that produced were both silent. A misspelled
    optional filter (``keyStages`` for ``keyStage``) was dropped on the floor and
    the tool answered with the *unfiltered* library, so an assistant that asked
    for the KS3 lessons got all 24 back and had no way to tell. A missing
    required argument fell through to a downstream lookup and came back as
    ``No lesson with id ''``, which describes neither the mistake nor the fix.

    Both now fail loudly at the boundary, naming the argument and listing the
    ones the tool accepts. Handlers keep their own value-level guards; this only
    covers presence, spelling and declared type.
    """
    if not isinstance(params, dict):
        raise ToolError(f"{name!r} takes an arguments object, got {_type_name(params)}.")
    properties: dict[str, Any] = schema.get("properties") or {}
    accepted = ", ".join(sorted(properties)) if properties else "none"

    # Spelling is checked before presence on purpose. A caller who sent
    # ``lessonID`` has both an unknown argument and a missing required one, and
    # "did you mean lessonId" points at the fix where "requires lessonId" only
    # restates the schema.
    for key, value in params.items():
        if key not in properties:
            close = get_close_matches(key, properties, n=1, cutoff=0.6)
            hint = f" Did you mean {close[0]!r}?" if close else ""
            raise ToolError(
                f"{name!r} has no argument {key!r}.{hint} Accepted arguments: {accepted}."
            )
        if value is None:
            continue
        declared = properties[key].get("type")
        names = (declared,) if isinstance(declared, str) else tuple(declared or ())
        if not names or any(n not in _JSON_TYPES for n in names):
            # An undeclared or unrecognised type is skipped rather than refused,
            # which is the safe direction for a schema this module does not own
            # outright. ``test_every_tool_schema_is_enforceable`` fails the
            # moment a tool relies on that, so it cannot go unnoticed.
            continue
        allowed = tuple(t for n in names for t in _JSON_TYPES[n][0])
        wrong_bool = isinstance(value, bool) and not {"boolean"} & set(names)
        if wrong_bool or not isinstance(value, allowed):
            wanted = " or ".join(dict.fromkeys(_JSON_TYPES[n][1] for n in names))
            raise ToolError(f"{key!r} must be {wanted}, got {_type_name(value)}.")

    for key in schema.get("required") or ():
        if params.get(key) is None:
            raise ToolError(f"{name!r} requires {key!r}. Accepted arguments: {accepted}.")


def call_tool(name: str, params: dict[str, Any]) -> dict[str, Any]:
    """Dispatch to a tool handler by name, after checking its declared schema."""
    handler = _HANDLERS.get(name)
    if handler is None:
        known = ", ".join(sorted(_HANDLERS))
        raise ToolError(f"Unknown tool {name!r}. Available: {known}")
    _validate_params(name, _SCHEMAS[name], params)
    return handler(params)  # type: ignore[no-any-return]


# --- resources -------------------------------------------------------------

#: Static resources. Lesson resources are enumerated from the library so the
#: list cannot fall behind a lesson somebody adds to the YAML directory.
_API_REFERENCE_URI: Final[str] = "kodro://api/reference"


def list_resources() -> list[dict[str, Any]]:
    """Enumerate readable resources: the API reference and every lesson brief."""
    resources: list[dict[str, Any]] = [
        {
            "uri": _API_REFERENCE_URI,
            "name": "Rover API reference",
            "description": "Every function pupil code may call, with signatures.",
            "mimeType": "application/json",
        }
    ]
    resources.extend(
        {
            "uri": f"kodro://lessons/{lesson.id}",
            "name": lesson.title,
            "description": f"{lesson.key_stage} lesson brief and success criteria.",
            "mimeType": "application/json",
        }
        for lesson in _library()
    )
    return resources


def read_resource(uri: str) -> dict[str, Any]:
    """Read one resource by URI."""
    if uri == _API_REFERENCE_URI:
        return check_api({})
    prefix = "kodro://lessons/"
    if uri.startswith(prefix):
        return get_lesson({"lessonId": uri[len(prefix) :]})
    raise ToolError(f"Unknown resource {uri!r}. Call resources/list for the readable set.")
