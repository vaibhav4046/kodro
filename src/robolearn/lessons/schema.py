"""Pydantic schema and YAML loader for lesson definitions.

Each lesson lives in a YAML file under
``src/robolearn/lessons/library/``. Section 6 of the build spec defines
the schema; this module turns each YAML into a typed :class:`Lesson`
instance via :mod:`pydantic`. The :func:`load_library` function loads and
validates every YAML in the bundled library at once.

Field-level reference text (e.g. UK programme-of-study citations) is
authored in Task 19; the schema accepts it as freeform strings so that
Task 19 only needs to edit YAML, not Python.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from robolearn.engine.terrain import Terrain

#: UK key stages currently supported by the lesson library.
KeyStage = Literal["KS1", "KS2", "KS3", "KS4"]

#: Computational-thinking concepts a lesson may exercise.
CTConcept = Literal[
    "sequence",
    "selection",
    "iteration",
    "functions",
    "decomposition",
    "abstraction",
    "recursion",
    "algorithmic_efficiency",
]

#: Syntactic constructs a lesson may declare in ``allowed_constructs``.
AllowedConstruct = Literal[
    "assignment",
    "arithmetic",
    "comparison",
    "for",
    "function_call",
    "function_def",
    "if",
    "logical",
    "recursion",
    "return",
    "while",
]


class ObstacleDef(BaseModel):
    """Obstacle definition as it appears in a lesson YAML."""

    model_config = ConfigDict(extra="forbid")

    x: float
    y: float
    r: float = Field(gt=0.0, description="Obstacle radius in metres; must be positive.")


class WorldDef(BaseModel):
    """World definition embedded inside a lesson YAML."""

    model_config = ConfigDict(extra="forbid")

    base: tuple[float, float]
    samples: list[tuple[float, float]] = Field(default_factory=list)
    obstacles: list[ObstacleDef] = Field(default_factory=list)
    width: float = Field(default=10.0, gt=0.0)
    height: float = Field(default=10.0, gt=0.0)


class SuccessCriterion(BaseModel):
    """A single success-criterion entry.

    YAMLs encode the success criteria as a list of one-key mappings; each
    mapping populates exactly one of the fields below.
    """

    model_config = ConfigDict(extra="forbid")

    samples_collected: int | None = Field(default=None, ge=0)
    max_battery_used: float | None = Field(default=None, ge=0.0)
    no_collisions: bool | None = None
    uses_construct: AllowedConstruct | None = None
    returns_to_base: bool | None = None
    max_steps: int | None = Field(default=None, ge=0)
    min_distance_travelled: float | None = Field(default=None, ge=0.0)
    # The named functions must be called, in this relative order. A lesson
    # that teaches a sequence has to be able to check that sequence: without
    # this, 01_hello_rover told the pupil to call three functions in order and
    # then passed a program with two of them deleted.
    calls_in_order: list[str] | None = None

    @model_validator(mode="after")
    def _at_least_one_field(self) -> SuccessCriterion:
        if all(
            getattr(self, name) is None
            for name in (
                "samples_collected",
                "max_battery_used",
                "no_collisions",
                "uses_construct",
                "returns_to_base",
                "max_steps",
                "min_distance_travelled",
                "calls_in_order",
            )
        ):
            raise ValueError("a success criterion must set at least one field")
        return self


class HintRules(BaseModel):
    """Lesson-attached hint banks shown on success or failure."""

    model_config = ConfigDict(extra="forbid")

    on_failure: list[str] = Field(default_factory=list)
    on_success: list[str] = Field(default_factory=list)


class Lesson(BaseModel):
    """A fully validated lesson definition.

    The optional ``source_path`` field is populated by :func:`load_lesson`
    and :func:`load_library` so callers can show "this lesson lives at …"
    in the UI; it is excluded from YAML serialisation.
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    key_stage: KeyStage
    ct_concepts: list[CTConcept] = Field(min_length=1)
    curriculum_refs: list[str] = Field(default_factory=list)
    prereqs: list[str] = Field(default_factory=list)
    terrain: Terrain
    intro: str = Field(min_length=1)
    starter_code: str = Field(min_length=1)
    allowed_constructs: list[AllowedConstruct] = Field(min_length=1)
    max_lines: int = Field(gt=0)
    world: WorldDef
    success_criteria: list[SuccessCriterion] = Field(default_factory=list)
    hints: HintRules = Field(default_factory=HintRules)
    #: Optional reading-age (years) so the UI can flag age-appropriateness;
    #: KS1/KS2 lessons set this low (5-11). ``None`` = unspecified.
    reading_age: int | None = Field(default=None, ge=4, le=18)
    #: Optional plain-English glossary {term: definition} shown to younger
    #: learners so jargon (lidar, loop, sensor) is always explained in-context.
    glossary: dict[str, str] = Field(default_factory=dict)

    @field_validator("terrain", mode="before")
    @classmethod
    def _coerce_terrain(cls, value: Any) -> Terrain | Any:
        if isinstance(value, str):
            return Terrain(value)
        return value


# --- loader API ------------------------------------------------------------


#: Default directory the loader inspects when no explicit path is given.
DEFAULT_LIBRARY_DIR: Path = Path(__file__).parent / "library"


def load_lesson(path: Path | str) -> Lesson:
    """Load and validate a single lesson YAML file.

    Args:
        path: Path to the YAML file.

    Returns:
        A validated :class:`Lesson` instance.

    Raises:
        FileNotFoundError: If ``path`` does not exist.
        ValueError: If the YAML payload fails schema validation.
    """
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(p)
    payload = yaml.safe_load(p.read_text(encoding="utf-8"))
    return Lesson.model_validate(payload)


def load_library(directory: Path | str | None = None) -> list[Lesson]:
    """Load every ``*.yaml`` lesson in ``directory`` (default: bundled library).

    Lessons are returned sorted by their file name so the order matches
    the numeric prefix (``01_…``, ``02_…``).
    """
    base = Path(directory) if directory is not None else DEFAULT_LIBRARY_DIR
    if not base.is_dir():
        raise FileNotFoundError(base)
    return [load_lesson(p) for p in sorted(base.glob("*.yaml"))]
