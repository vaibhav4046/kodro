"""Lesson YAML schema validation tests (Task 8)."""

from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from robolearn.engine.terrain import Terrain
from robolearn.lessons.schema import (
    DEFAULT_LIBRARY_DIR,
    HintRules,
    Lesson,
    SuccessCriterion,
    WorldDef,
    load_lesson,
    load_library,
)

# ---------------------------------------------------------------------------
# Minimum valid lesson construction
# ---------------------------------------------------------------------------


def _minimal_lesson_payload() -> dict:  # type: ignore[type-arg]
    return {
        "id": "test_lesson",
        "title": "Test lesson",
        "key_stage": "KS3",
        "ct_concepts": ["sequence"],
        "curriculum_refs": [],
        "prereqs": [],
        "terrain": "earth",
        "intro": "Hello.",
        "starter_code": "move_forward(1)",
        "allowed_constructs": ["function_call"],
        "max_lines": 8,
        "world": {"base": [1.0, 1.0]},
    }


def test_minimum_payload_validates() -> None:
    lesson = Lesson.model_validate(_minimal_lesson_payload())
    assert lesson.id == "test_lesson"
    assert lesson.key_stage == "KS3"
    assert lesson.terrain is Terrain.EARTH
    assert lesson.success_criteria == []
    assert isinstance(lesson.hints, HintRules)


def test_terrain_string_is_coerced_to_enum() -> None:
    for name in ("earth", "mars", "underwater", "space"):
        payload = _minimal_lesson_payload()
        payload["terrain"] = name
        lesson = Lesson.model_validate(payload)
        assert lesson.terrain is Terrain(name)


def test_extra_keys_are_forbidden() -> None:
    payload = _minimal_lesson_payload()
    payload["lol"] = "no"
    with pytest.raises(ValidationError):
        Lesson.model_validate(payload)


def test_missing_required_field_rejected() -> None:
    payload = _minimal_lesson_payload()
    del payload["title"]
    with pytest.raises(ValidationError):
        Lesson.model_validate(payload)


def test_invalid_key_stage_rejected() -> None:
    payload = _minimal_lesson_payload()
    payload["key_stage"] = "Reception"
    with pytest.raises(ValidationError):
        Lesson.model_validate(payload)


def test_invalid_ct_concept_rejected() -> None:
    payload = _minimal_lesson_payload()
    payload["ct_concepts"] = ["telepathy"]
    with pytest.raises(ValidationError):
        Lesson.model_validate(payload)


def test_empty_ct_concepts_rejected() -> None:
    payload = _minimal_lesson_payload()
    payload["ct_concepts"] = []
    with pytest.raises(ValidationError):
        Lesson.model_validate(payload)


def test_negative_max_lines_rejected() -> None:
    payload = _minimal_lesson_payload()
    payload["max_lines"] = 0
    with pytest.raises(ValidationError):
        Lesson.model_validate(payload)


def test_world_with_negative_obstacle_radius_rejected() -> None:
    payload = _minimal_lesson_payload()
    payload["world"]["obstacles"] = [{"x": 1.0, "y": 1.0, "r": -0.5}]
    with pytest.raises(ValidationError):
        Lesson.model_validate(payload)


def test_world_with_extra_field_rejected() -> None:
    payload = _minimal_lesson_payload()
    payload["world"]["wormhole"] = True
    with pytest.raises(ValidationError):
        Lesson.model_validate(payload)


def test_success_criteria_parsed_as_one_key_dicts() -> None:
    payload = _minimal_lesson_payload()
    payload["success_criteria"] = [
        {"samples_collected": 3},
        {"max_battery_used": 60.0},
        {"no_collisions": True},
        {"uses_construct": "while"},
    ]
    lesson = Lesson.model_validate(payload)
    assert len(lesson.success_criteria) == 4
    assert lesson.success_criteria[0].samples_collected == 3
    assert lesson.success_criteria[1].max_battery_used == 60.0
    assert lesson.success_criteria[2].no_collisions is True
    assert lesson.success_criteria[3].uses_construct == "while"


def test_success_criterion_extra_field_rejected() -> None:
    payload = _minimal_lesson_payload()
    payload["success_criteria"] = [{"wibble": 1}]
    with pytest.raises(ValidationError):
        Lesson.model_validate(payload)


def test_success_criterion_invalid_construct_name_rejected() -> None:
    payload = _minimal_lesson_payload()
    payload["success_criteria"] = [{"uses_construct": "telepathy"}]
    with pytest.raises(ValidationError):
        Lesson.model_validate(payload)


def test_hints_default_to_empty_lists() -> None:
    lesson = Lesson.model_validate(_minimal_lesson_payload())
    assert lesson.hints.on_failure == []
    assert lesson.hints.on_success == []


# ---------------------------------------------------------------------------
# Library loader
# ---------------------------------------------------------------------------


def test_load_lesson_round_trips_through_file(tmp_path: Path) -> None:
    payload = _minimal_lesson_payload()
    import yaml as _yaml

    p = tmp_path / "one.yaml"
    p.write_text(_yaml.safe_dump(payload), encoding="utf-8")
    lesson = load_lesson(p)
    assert lesson.id == "test_lesson"


def test_load_lesson_missing_file_raises(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        load_lesson(tmp_path / "nope.yaml")


def test_load_library_reads_every_yaml_in_directory(tmp_path: Path) -> None:
    import yaml as _yaml

    for i, ident in enumerate(("a", "b", "c"), start=1):
        payload = _minimal_lesson_payload()
        payload["id"] = ident
        payload["max_lines"] = i
        (tmp_path / f"{i:02d}_{ident}.yaml").write_text(_yaml.safe_dump(payload), encoding="utf-8")
    lessons = load_library(tmp_path)
    assert [lsn.id for lsn in lessons] == ["a", "b", "c"]
    assert [lsn.max_lines for lsn in lessons] == [1, 2, 3]


def test_load_library_missing_directory_raises(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        load_library(tmp_path / "nope")


# ---------------------------------------------------------------------------
# Bundled library
# ---------------------------------------------------------------------------


def test_bundled_library_has_thirteen_lessons() -> None:
    lessons = load_library()
    assert len(lessons) == 13


def test_bundled_library_ids_match_filename_prefix() -> None:
    lessons = load_library()
    expected = [
        "01_hello_rover",
        "02_move_turn",
        "03_sequence",
        "04_selection",
        "05_iteration",
        "06_functions",
        "07_sensors",
        "08_pathfinding",
        "09_recursion",
        "10_optimisation",
        "11_decomposition",
        "12_abstraction",
        "13_nested_loops",
    ]
    assert [lsn.id for lsn in lessons] == expected


def test_default_library_dir_resolves_to_library_folder() -> None:
    assert DEFAULT_LIBRARY_DIR.is_dir()
    assert DEFAULT_LIBRARY_DIR.name == "library"


@pytest.mark.parametrize(
    ("lesson_id", "expected_terrain", "expected_ks"),
    [
        ("01_hello_rover", Terrain.EARTH, "KS3"),
        ("05_iteration", Terrain.MARS, "KS3"),
        ("07_sensors", Terrain.UNDERWATER, "KS3"),
        ("09_recursion", Terrain.SPACE, "KS4"),
        ("10_optimisation", Terrain.MARS, "KS4"),
        ("11_decomposition", Terrain.MARS, "KS4"),
        ("12_abstraction", Terrain.UNDERWATER, "KS4"),
        ("13_nested_loops", Terrain.SPACE, "KS4"),
    ],
)
def test_each_bundled_lesson_has_expected_terrain_and_key_stage(
    lesson_id: str, expected_terrain: Terrain, expected_ks: str
) -> None:
    lessons = {lsn.id: lsn for lsn in load_library()}
    lesson = lessons[lesson_id]
    assert lesson.terrain is expected_terrain
    assert lesson.key_stage == expected_ks


def test_bundled_recursion_lesson_allows_recursion_construct() -> None:
    lessons = {lsn.id: lsn for lsn in load_library()}
    assert "recursion" in lessons["09_recursion"].allowed_constructs


def test_world_def_constructs_directly() -> None:
    world = WorldDef(base=(2.0, 3.0))
    assert world.base == (2.0, 3.0)
    assert world.width == 10.0


def test_success_criterion_constructs_directly() -> None:
    sc = SuccessCriterion(samples_collected=5)
    assert sc.samples_collected == 5
    assert sc.max_battery_used is None
