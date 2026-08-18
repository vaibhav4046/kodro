"""Read and write the ``.kodro`` project document from the desktop app.

The browser build already owns this format: ``assets/web/project.js`` collects
the studio's scattered ``localStorage`` keys into one JSON document (KPF v1),
validates a loaded one defensively, and writes it back. That gave the website a
save file. It did not give the *ecosystem* anything, because the desktop app
could not read a word of it -- a pupil who built a rover on the classroom
website and then opened the installed app started from nothing.

This module is the other half. It is a deliberate re-implementation of the same
document contract in Python rather than a loose "close enough" reader:

* the same version gate (``kodroProject: 1``), the same 2 MB / 100 KB / 60-entry
  caps, and the same coercions (a wrong-typed field is reset with a named
  warning, never a crash),
* the same warning and error *sentences*, so a malformed file explains itself
  identically whichever half of the ecosystem the child opened it in,
* the same ``<slug>.kodro`` file-name rule, including the Unicode-aware slug
  that keeps a non-Latin robot name from collapsing to the generic default.

``tests/unit/test_kodro_project.py`` holds the two halves to that promise by
running the real ``project.js`` in Node and diffing both directions, so this
file cannot quietly drift from the module it mirrors.

What it deliberately does NOT do: apply a document to the desktop's own state.
The desktop stores progress in SQLite and settings in ``~/.robolearn``; those
are not the studio's localStorage keys and pretending otherwise would invent a
mapping nobody asked for. What crosses the bridge is what genuinely means the
same thing on both sides -- the programs the pupil wrote, the robot they built,
and the world they were driving in.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

__all__ = [
    "MAX_LIST",
    "MAX_PROGRAM",
    "MAX_TEXT",
    "VERSION",
    "ProjectDocument",
    "ValidationResult",
    "file_name",
    "new_document",
    "read_file",
    "read_text",
    "to_json",
    "write_file",
]

#: Document version. A file that does not carry exactly this is refused rather
#: than best-effort parsed: a "version 2" we do not understand is not ours.
VERSION = 1

#: An entire project over 2 MB is not ours (mirrors project.js MAX_TEXT).
MAX_TEXT = 2 * 1024 * 1024
#: One program buffer over 100 KB is junk (mirrors project.js MAX_PROGRAM).
MAX_PROGRAM = 100 * 1024
#: Cap on reflections / skills / reports (mirrors project.js MAX_LIST).
MAX_LIST = 60

#: Defaults for the eight short string fields, in the order project.js writes
#: them. Kept as one table so both halves cannot disagree about a default.
_STRING_DEFAULTS: dict[str, str] = {
    "world": "earth",
    "tab": "drive",
    "tod": "noon",
    "weather": "clear",
    "quality": "high",
    "view3d": "1",
    "mode": "studio",
    "theme": "dark",
}

#: A short string field longer than this is treated as a wrong-typed value.
_MAX_FIELD_LEN = 64


@dataclass(frozen=True, slots=True)
class ProjectDocument:
    """One validated KPF v1 document.

    Frozen because a document is evidence of what a file said. Callers that
    want a changed one build a new one; nothing mutates a parsed document
    behind another reader's back.
    """

    # A JSON number, kept as written. project.js accepts any number here, so a
    # file carrying a fractional timestamp must survive a desktop round-trip
    # unchanged rather than being quietly truncated to whole milliseconds.
    saved_at: int | float = 0
    world: str = "earth"
    tab: str = "drive"
    tod: str = "noon"
    weather: str = "clear"
    quality: str = "high"
    view3d: str = "1"
    mode: str = "studio"
    theme: str = "dark"
    spec: dict[str, Any] | None = None
    programs: dict[str, str] = field(default_factory=dict)
    reflections: tuple[dict[str, Any], ...] = ()
    skills: tuple[dict[str, Any], ...] = ()
    scenario_reports: tuple[dict[str, Any], ...] = ()
    run_reports: tuple[dict[str, Any], ...] = ()

    @property
    def robot_name(self) -> str:
        """The saved robot's name, or ``""`` when the file carries no spec."""
        if not isinstance(self.spec, dict):
            return ""
        name = self.spec.get("name")
        return name if isinstance(name, str) else ""

    def program(self, tab: str | None = None) -> str:
        """Return one program buffer -- by default the document's active tab.

        Falls back to the only buffer present when the active tab names one
        that was dropped or never saved, because a project with exactly one
        program and a stale tab pointer clearly means that program.
        """
        key = self.tab if tab is None else tab
        if key in self.programs:
            return self.programs[key]
        if tab is None and len(self.programs) == 1:
            return next(iter(self.programs.values()))
        return ""

    def as_dict(self) -> dict[str, Any]:
        """Return the document in the on-disk JSON shape (camelCase keys)."""
        return {
            "kodroProject": VERSION,
            "savedAt": self.saved_at,
            "world": self.world,
            "tab": self.tab,
            "tod": self.tod,
            "weather": self.weather,
            "quality": self.quality,
            "view3d": self.view3d,
            "mode": self.mode,
            "theme": self.theme,
            "spec": self.spec,
            "programs": dict(self.programs),
            "memory": {
                "reflections": [dict(r) for r in self.reflections],
                "skills": [dict(s) for s in self.skills],
            },
            "scenarioReports": [dict(r) for r in self.scenario_reports],
            "runReports": [dict(r) for r in self.run_reports],
        }


@dataclass(frozen=True, slots=True)
class ValidationResult:
    """Outcome of reading a project file. Never raised, always returned.

    ``ok`` is false only for the errors that make the document unusable (not
    JSON, wrong version, a structurally impossible field). Everything a reader
    can recover from lands in ``warnings`` with the document still returned,
    because losing one malformed reflection is not a reason to refuse a child
    their programs.
    """

    ok: bool
    document: ProjectDocument | None
    errors: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()


class _Undefined:
    """Stands in for JavaScript ``undefined``.

    Python collapses "key absent" and "key present, value null" into ``None``;
    ``project.js`` does not, and the difference is observable. A missing
    ``runReports`` is silence, a ``"runReports": null`` is a warning, because
    one is a file that never had reports and the other is a file whose reports
    were corrupted on the way in. Keeping the distinction is what lets the two
    implementations produce the same warning list for the same bytes.
    """

    __slots__ = ()

    def __repr__(self) -> str:  # pragma: no cover -- debugging aid
        return "undefined"


_MISSING = _Undefined()


def _is_plain_object(value: Any) -> bool:
    """True for a JSON object (a dict), matching project.js isPlainObject."""
    return isinstance(value, dict)


def _js_truthy(value: Any) -> bool:
    """JavaScript truthiness. Note ``{}`` and ``[]`` are truthy; ``0`` and ``""`` are not."""
    if isinstance(value, _Undefined) or value is None or value is False:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value != ""
    return True


def _member(container: Any, key: str) -> Any:
    """Mirror ``obj && obj.key`` -- a falsy container yields itself, not its member."""
    if not _js_truthy(container):
        return container
    if isinstance(container, dict):
        return container.get(key, _MISSING)
    return _MISSING


def _clean_list(value: Any, warnings: list[str], label: str) -> tuple[dict[str, Any], ...]:
    """Keep the object entries of a list, capped at MAX_LIST, warning on loss."""
    if not isinstance(value, list):
        if not isinstance(value, _Undefined):
            warnings.append(f"{label} is not a list; dropped.")
        return ()
    kept = [entry for entry in value if _is_plain_object(entry)][:MAX_LIST]
    if len(kept) != len(value):
        dropped = len(value) - len(kept)
        warnings.append(f"{label}: {dropped} malformed or overflow entries dropped.")
    return tuple(kept)


def _read_string_fields(raw: dict[str, Any], warnings: list[str]) -> dict[str, str]:
    """Coerce the eight short string fields, defaulting anything wrong-typed."""
    out: dict[str, str] = {}
    for key, default in _STRING_DEFAULTS.items():
        value = raw.get(key, _MISSING)
        if isinstance(value, _Undefined):
            out[key] = default
            continue
        if not isinstance(value, str) or len(value) > _MAX_FIELD_LEN:
            warnings.append(f'"{key}" is not a short string; reset to "{default}".')
            out[key] = default
            continue
        out[key] = value
    return out


def _read_physical(physical: Any, errors: list[str], warnings: list[str]) -> Any:
    """Validate the measured (KRS) block, which the studio consumes at boot.

    A malformed block here is a persistent boot brick on the web side rather
    than a soft warning, so the block itself and its object fields are typed.
    """
    if physical is None:
        return physical
    if not _is_plain_object(physical):
        errors.append('"spec.physical" must be an object (a measured KRS block).')
        return physical
    phys = dict(physical)
    if "sensors" in phys and not isinstance(phys["sensors"], list):
        warnings.append('"spec.physical.sensors" is not a list; reset to empty.')
        phys["sensors"] = []
    for key in ("bodyCm", "drive", "battery", "declared"):
        if key in phys and not _is_plain_object(phys[key]):
            warnings.append(f'"spec.physical.{key}" is not an object; dropped.')
            del phys[key]
    mass = phys.get("massKg")
    if "massKg" in phys and (
        isinstance(mass, bool) or not isinstance(mass, (int, float)) or mass <= 0
    ):
        warnings.append('"spec.physical.massKg" is not a positive number; dropped.')
        del phys["massKg"]
    return phys


def _read_spec(
    raw: dict[str, Any], errors: list[str], warnings: list[str]
) -> dict[str, Any] | None:
    """Validate the robot spec, coercing its list fields the way project.js does."""
    value = raw.get("spec")
    if "spec" not in raw or value is None:
        warnings.append("No robot spec in the project; the current build is kept.")
        return None
    if not _is_plain_object(value):
        errors.append('"spec" must be an object.')
        return None
    spec = dict(value)
    # A hand-edited file with "actuators": {} used to be persisted raw and then
    # throw at module init on the next reload -- a boot brick until storage was
    # cleared. Guard the same two fields here.
    for key in ("sensors", "actuators"):
        if key in spec and not isinstance(spec[key], list):
            warnings.append(f'"spec.{key}" is not a list; reset to empty.')
            spec[key] = []
    if "physical" in spec:
        spec["physical"] = _read_physical(spec["physical"], errors, warnings)
    return spec


def _read_programs(raw: dict[str, Any], errors: list[str], warnings: list[str]) -> dict[str, str]:
    """Validate the tab -> source map, dropping non-text and oversize buffers."""
    programs: dict[str, str] = {}
    if "programs" not in raw:
        return programs
    value = raw["programs"]
    if not _is_plain_object(value):
        errors.append('"programs" must be an object of tab -> source.')
        return programs
    for key, source in value.items():
        if not isinstance(source, str):
            warnings.append(f'program "{key}" is not text; dropped.')
            continue
        if len(source) > MAX_PROGRAM:
            warnings.append(f'program "{key}" exceeds 100 KB; dropped.')
            continue
        programs[key] = source
    return programs


def read_text(text: Any) -> ValidationResult:
    """Validate a ``.kodro`` document from its text. Never raises.

    Mirrors ``KodroProject.validate`` in ``assets/web/project.js``, refusal
    sentences included, so the same bad file is refused the same way on both
    sides of the ecosystem.
    """
    warnings: list[str] = []
    if not isinstance(text, str) or not text.strip():
        return ValidationResult(False, None, ("Empty project file.",), ())
    if len(text) > MAX_TEXT:
        return ValidationResult(False, None, ("Project file is larger than 2 MB.",), ())
    try:
        raw = json.loads(text)
    except ValueError as exc:
        return ValidationResult(False, None, (f"Not valid JSON: {exc}",), ())
    if not _is_plain_object(raw):
        return ValidationResult(False, None, ("Project file must be a JSON object.",), ())
    if raw.get("kodroProject") != VERSION or isinstance(raw.get("kodroProject"), bool):
        return ValidationResult(
            False, None, ('Not a Kodro project file (missing "kodroProject": 1).',), ()
        )

    errors: list[str] = []
    saved_at = raw.get("savedAt")
    fields = _read_string_fields(raw, warnings)
    spec = _read_spec(raw, errors, warnings)
    programs = _read_programs(raw, errors, warnings)
    # ``raw.memory && raw.memory.reflections`` in project.js: a falsy ``memory``
    # is passed through to cleanList as itself, so ``"memory": null`` warns while
    # a missing ``memory`` is silent. _member reproduces that short-circuit.
    memory = raw.get("memory", _MISSING)
    reflections = _clean_list(_member(memory, "reflections"), warnings, "memory.reflections")
    skills = _clean_list(_member(memory, "skills"), warnings, "memory.skills")
    scenarios = _clean_list(raw.get("scenarioReports", _MISSING), warnings, "scenarioReports")
    runs = _clean_list(raw.get("runReports", _MISSING), warnings, "runReports")

    if errors:
        return ValidationResult(False, None, tuple(errors), tuple(warnings))

    document = ProjectDocument(
        saved_at=(
            saved_at if isinstance(saved_at, (int, float)) and not isinstance(saved_at, bool) else 0
        ),
        spec=spec,
        programs=programs,
        reflections=reflections,
        skills=skills,
        scenario_reports=scenarios,
        run_reports=runs,
        **fields,
    )
    return ValidationResult(True, document, (), tuple(warnings))


def read_file(path: Path | str) -> ValidationResult:
    """Read and validate a ``.kodro`` file. Unreadable files are an error, not a raise."""
    try:
        text = Path(path).read_text(encoding="utf-8")
    except OSError as exc:
        return ValidationResult(False, None, (f"Could not read {path}: {exc}",), ())
    except UnicodeDecodeError:
        return ValidationResult(
            False, None, (f"{path} is not a text file (a Kodro project is JSON text).",), ()
        )
    return read_text(text)


def to_json(document: ProjectDocument) -> str:
    """Serialise a document the way the browser writes it (2-space pretty JSON)."""
    return json.dumps(document.as_dict(), indent=2, ensure_ascii=False)


def write_file(path: Path | str, document: ProjectDocument) -> Path:
    """Write ``document`` to ``path`` as UTF-8 JSON and return the path written."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(to_json(document), encoding="utf-8")
    return target


def new_document(
    *,
    program: str = "",
    tab: str = "drive",
    world: str = "earth",
    spec: dict[str, Any] | None = None,
    saved_at: int = 0,
    **fields: str,
) -> ProjectDocument:
    """Build a document from desktop state.

    ``program`` is filed under ``tab`` so the website opens it on the same tab
    the desktop was editing. Every other field keeps its studio default, which
    is what the desktop app genuinely has to say about it -- it has no weather,
    no render quality and no 3D toggle, and inventing values for them would put
    numbers in a file that no part of the desktop ever measured.
    """
    # The catch-all is the remaining short string fields (tod, weather, quality,
    # view3d, mode, theme); mypy cannot line a **dict[str, str] up against a
    # dataclass whose other fields are not strings, so it is widened here.
    extra: Any = fields
    return ProjectDocument(
        saved_at=saved_at,
        tab=tab,
        world=world,
        spec=spec,
        programs={tab: program} if program else {},
        **extra,
    )


def file_name(document: ProjectDocument | None) -> str:
    """Suggest ``<slug>.kodro`` from the robot name, matching project.js.

    The slug keeps letters and numbers from any script, so a robot named in
    Cyrillic or Japanese gets its own file name instead of collapsing to the
    generic default and colliding with every other non-Latin name.
    """
    name = document.robot_name if document is not None else ""
    if not name:
        name = "kodro-project"
    chars = [c if (c.isalpha() or c.isnumeric()) else "-" for c in name.lower()]
    slug = "-".join(part for part in "".join(chars).split("-") if part)
    return (slug or "kodro-project") + ".kodro"
