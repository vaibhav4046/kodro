"""Hint-engine rule coverage tests (Task 10).

Spec override: every rule has at least three unit tests. The helpers
below build a :class:`HintContext` from kwargs so each test stays a few
lines long.
"""

from __future__ import annotations

from collections.abc import Iterable

from kodro.lessons.grader import GradeResult
from kodro.lessons.schema import Lesson, SuccessCriterion, WorldDef
from kodro.memory.hint_engine import (
    RULES,
    Hint,
    HintContext,
    HintRule,
    find_all_hints,
    find_first_hint,
)
from kodro.runtime.tracer import Event, RoverSnapshot

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _evt(
    name: str,
    args: tuple = (),
    result: object = None,
    kind: str = "call",
    rover_state: RoverSnapshot | None = None,
) -> Event:
    return Event(
        frame=0,
        ts_ms=0,
        kind=kind,  # type: ignore[arg-type]
        name=name,
        args=args,
        result=result,
        rover_state=rover_state,
    )


def _lesson(
    *,
    ct_concepts: list[str] | None = None,
    allowed_constructs: list[str] | None = None,
    max_lines: int = 10,
    starter_code: str = "move_forward(1)",
    success_criteria: list[SuccessCriterion] | None = None,
) -> Lesson:
    return Lesson(
        id="L",
        title="L",
        key_stage="KS3",
        ct_concepts=ct_concepts or ["sequence"],  # type: ignore[arg-type]
        curriculum_refs=[],
        prereqs=[],
        terrain="earth",  # type: ignore[arg-type]
        intro="hi",
        starter_code=starter_code,
        allowed_constructs=allowed_constructs or ["function_call"],  # type: ignore[arg-type]
        max_lines=max_lines,
        world=WorldDef(base=(1.0, 1.0)),
        success_criteria=success_criteria or [],
    )


def _ctx(
    *,
    lesson: Lesson | None = None,
    source: str = "",
    events: Iterable[Event] = (),
    passed: bool = False,
) -> HintContext:
    return HintContext(
        lesson=lesson or _lesson(),
        source=source,
        events=tuple(events),
        grade_result=GradeResult(passed=passed, reasons=[], score=100 if passed else 50),
    )


def _rule(name: str) -> HintRule:
    return next(r for r in RULES if r.name == name)


# ---------------------------------------------------------------------------
# Sanity tests
# ---------------------------------------------------------------------------


def test_rules_list_has_at_least_twenty_entries() -> None:
    assert len(RULES) >= 20


def test_rules_have_unique_names() -> None:
    names = [r.name for r in RULES]
    assert len(names) == len(set(names))


def test_find_first_hint_with_empty_rule_set_returns_none() -> None:
    assert find_first_hint(_ctx(), rules=[]) is None


def test_find_first_hint_returns_first_matching_rule() -> None:
    # Force the empty_submission rule by giving it nothing to do.
    hint = find_first_hint(_ctx(passed=False, events=[]))
    assert isinstance(hint, Hint)
    assert hint.rule_name == "empty_submission"


def test_find_all_hints_returns_every_matching_rule() -> None:
    # Source uses a forbidden construct AND exceeds max lines -- two rules fire.
    src = "\n".join([f"x{i} = {i}" for i in range(15)])  # 15 lines, assignments
    lesson = _lesson(max_lines=5, allowed_constructs=["function_call"])
    ctx = _ctx(lesson=lesson, source=src, passed=False)
    hints = find_all_hints(ctx)
    names = {h.rule_name for h in hints}
    assert "exceeded_max_lines" in names
    assert "disallowed_construct_used" in names


# ---------------------------------------------------------------------------
# Per-rule tests (3 each)
#
# Naming convention: `test_<rule>_<positive|negative|edge>`
# ---------------------------------------------------------------------------


# --- empty_submission ---


def test_empty_submission_positive() -> None:
    assert _rule("empty_submission").when(_ctx(events=[], passed=False))


def test_empty_submission_negative_when_passed() -> None:
    assert not _rule("empty_submission").when(_ctx(events=[], passed=True))


def test_empty_submission_negative_when_events_present() -> None:
    assert not _rule("empty_submission").when(
        _ctx(events=[_evt("move_forward", (1.0,))], passed=False)
    )


# --- starter_code_unchanged ---


def test_starter_code_unchanged_positive() -> None:
    lesson = _lesson(starter_code="move_forward(1)")
    assert _rule("starter_code_unchanged").when(
        _ctx(lesson=lesson, source="move_forward(1)", passed=False)
    )


def test_starter_code_unchanged_negative_when_modified() -> None:
    lesson = _lesson(starter_code="move_forward(1)")
    assert not _rule("starter_code_unchanged").when(
        _ctx(lesson=lesson, source="move_forward(5)\nturn_left(90)", passed=False)
    )


def test_starter_code_unchanged_negative_when_passed() -> None:
    lesson = _lesson(starter_code="move_forward(1)")
    assert not _rule("starter_code_unchanged").when(
        _ctx(lesson=lesson, source="move_forward(1)", passed=True)
    )


# --- while_no_progress ---


def test_while_no_progress_positive() -> None:
    src = "while True:\n    break\n"
    assert _rule("while_no_progress").when(
        _ctx(source=src, events=[_evt("turn_left", (90.0,))], passed=False)
    )


def test_while_no_progress_negative_no_while() -> None:
    assert not _rule("while_no_progress").when(
        _ctx(source="move_forward(1)", events=[_evt("move_forward", (1.0,))])
    )


def test_while_no_progress_negative_movement_recorded() -> None:
    src = "while x: move_forward(1)"
    assert not _rule("while_no_progress").when(
        _ctx(source=src, events=[_evt("move_forward", (1.0,), rover_state=_snap(distance=1.0))])
    )


# --- while_true_no_break ---


def test_while_true_no_break_positive() -> None:
    assert _rule("while_true_no_break").when(_ctx(source="while True:\n    pass\n"))


def test_while_true_no_break_negative_break_present() -> None:
    src = "while True:\n    if x: break\n"
    assert not _rule("while_true_no_break").when(_ctx(source=src))


def test_while_true_no_break_negative_finite_while() -> None:
    assert not _rule("while_true_no_break").when(_ctx(source="while x < 5: x += 1"))


# --- multiple_collisions ---


def test_multiple_collisions_positive() -> None:
    events = [_evt("wall", kind="collision", rover_state=_snap(collisions=2))]
    assert _rule("multiple_collisions").when(_ctx(events=events))


def test_multiple_collisions_negative_one_collision() -> None:
    events = [_evt("wall", kind="collision", rover_state=_snap(collisions=1))]
    assert not _rule("multiple_collisions").when(_ctx(events=events))


def test_multiple_collisions_negative_no_collision() -> None:
    assert not _rule("multiple_collisions").when(_ctx())


# --- overshoot ---


def test_overshoot_positive() -> None:
    events = [
        _evt("move_forward", (5.0,)),
        _evt("wall", kind="collision", rover_state=_snap(collisions=1)),
        _evt("move_forward", (1.0,)),
    ]
    assert _rule("overshoot").when(_ctx(events=events, passed=False))


def test_overshoot_negative_no_collision() -> None:
    assert not _rule("overshoot").when(_ctx(events=[_evt("move_forward", (5.0,))], passed=False))


def test_overshoot_negative_when_passed() -> None:
    events = [_evt("wall", kind="collision"), _evt("move_forward", (1.0,))]
    assert not _rule("overshoot").when(_ctx(events=events, passed=True))


# --- battery_drained ---


def _snap(battery: float = 100.0, collisions: int = 0, distance: float = 0.0) -> RoverSnapshot:
    return RoverSnapshot(0.0, 0.0, 0.0, battery, 0, 0, collisions, distance)


def test_battery_drained_positive() -> None:
    events = [_evt("move_forward", (1.0,), rover_state=_snap(5.0))]
    assert _rule("battery_drained").when(_ctx(events=events))


def test_battery_drained_negative_above_10() -> None:
    events = [_evt("move_forward", (1.0,), rover_state=_snap(50.0))]
    assert not _rule("battery_drained").when(_ctx(events=events))


def test_battery_drained_negative_no_snapshots() -> None:
    events = [_evt("move_forward", (1.0,))]
    assert not _rule("battery_drained").when(_ctx(events=events))


# --- negative_move_argument ---


def test_negative_move_argument_positive() -> None:
    # Detected from the source: the rover clamps distances to >= 0 before
    # emitting the event, so a negative never survives into c.events.
    assert _rule("negative_move_argument").when(_ctx(source="move_forward(-1)"))


def test_negative_move_argument_negative_positive_arg() -> None:
    assert not _rule("negative_move_argument").when(_ctx(source="move_forward(1)"))


def test_negative_move_argument_negative_no_move() -> None:
    assert not _rule("negative_move_argument").when(_ctx())


# --- excessive_turn ---


def test_excessive_turn_positive() -> None:
    events = [_evt("turn_left", (720.0,))]
    assert _rule("excessive_turn").when(_ctx(events=events))


def test_excessive_turn_negative_normal_turn() -> None:
    events = [_evt("turn_left", (90.0,))]
    assert not _rule("excessive_turn").when(_ctx(events=events))


def test_excessive_turn_negative_no_turn() -> None:
    assert not _rule("excessive_turn").when(_ctx())


# --- needs_iteration_construct ---


def test_needs_iteration_construct_positive() -> None:
    lesson = _lesson(ct_concepts=["iteration"])
    assert _rule("needs_iteration_construct").when(
        _ctx(lesson=lesson, source="move_forward(1)", passed=False)
    )


def test_needs_iteration_construct_negative_when_loop_present() -> None:
    lesson = _lesson(ct_concepts=["iteration"])
    src = "for i in range(3):\n    move_forward(1)"
    assert not _rule("needs_iteration_construct").when(
        _ctx(lesson=lesson, source=src, passed=False)
    )


def test_needs_iteration_construct_negative_when_not_iteration_lesson() -> None:
    lesson = _lesson(ct_concepts=["sequence"])
    assert not _rule("needs_iteration_construct").when(
        _ctx(lesson=lesson, source="move_forward(1)", passed=False)
    )


# --- needs_selection_construct ---


def test_needs_selection_construct_positive() -> None:
    lesson = _lesson(ct_concepts=["selection"])
    assert _rule("needs_selection_construct").when(
        _ctx(lesson=lesson, source="move_forward(1)", passed=False)
    )


def test_needs_selection_construct_negative_when_if_present() -> None:
    lesson = _lesson(ct_concepts=["selection"])
    assert not _rule("needs_selection_construct").when(
        _ctx(lesson=lesson, source="if True:\n    pass", passed=False)
    )


def test_needs_selection_construct_negative_when_passed() -> None:
    lesson = _lesson(ct_concepts=["selection"])
    assert not _rule("needs_selection_construct").when(
        _ctx(lesson=lesson, source="move_forward(1)", passed=True)
    )


# --- needs_function_def ---


def test_needs_function_def_positive() -> None:
    lesson = _lesson(ct_concepts=["functions"])
    assert _rule("needs_function_def").when(
        _ctx(lesson=lesson, source="move_forward(1)", passed=False)
    )


def test_needs_function_def_negative_def_present() -> None:
    lesson = _lesson(ct_concepts=["functions"])
    assert not _rule("needs_function_def").when(
        _ctx(lesson=lesson, source="def f():\n    pass\nf()", passed=False)
    )


def test_needs_function_def_negative_not_functions_lesson() -> None:
    lesson = _lesson(ct_concepts=["sequence"])
    assert not _rule("needs_function_def").when(_ctx(lesson=lesson, source="x = 1", passed=False))


# --- needs_recursion ---


def test_needs_recursion_positive() -> None:
    lesson = _lesson(ct_concepts=["recursion"])
    assert _rule("needs_recursion").when(
        _ctx(lesson=lesson, source="def f(): return 0", passed=False)
    )


def test_needs_recursion_negative_recursion_present() -> None:
    lesson = _lesson(ct_concepts=["recursion"])
    src = "def f(n):\n    if n == 0:\n        return\n    f(n - 1)\n"
    assert not _rule("needs_recursion").when(_ctx(lesson=lesson, source=src, passed=False))


def test_needs_recursion_negative_not_recursion_lesson() -> None:
    lesson = _lesson(ct_concepts=["sequence"])
    assert not _rule("needs_recursion").when(_ctx(lesson=lesson, source="x = 1", passed=False))


# --- missing_collect_sample ---


def test_missing_collect_sample_positive() -> None:
    lesson = _lesson(success_criteria=[SuccessCriterion(samples_collected=3)])
    assert _rule("missing_collect_sample").when(_ctx(lesson=lesson, passed=False))


def test_missing_collect_sample_negative_collected_one() -> None:
    lesson = _lesson(success_criteria=[SuccessCriterion(samples_collected=3)])
    events = [_evt("collect_sample", result=True, kind="sample")]
    assert not _rule("missing_collect_sample").when(
        _ctx(lesson=lesson, events=events, passed=False)
    )


def test_missing_collect_sample_negative_no_sample_criterion() -> None:
    lesson = _lesson(success_criteria=[SuccessCriterion(no_collisions=True)])
    assert not _rule("missing_collect_sample").when(_ctx(lesson=lesson, passed=False))


# --- only_moves_no_turns ---


def test_only_moves_no_turns_positive() -> None:
    events = [_evt("move_forward", (1.0,)) for _ in range(5)]
    assert _rule("only_moves_no_turns").when(_ctx(events=events, passed=False))


def test_only_moves_no_turns_negative_turn_present() -> None:
    events = [
        _evt("move_forward", (1.0,)),
        _evt("turn_left", (90.0,)),
        _evt("move_forward", (1.0,)),
    ]
    assert not _rule("only_moves_no_turns").when(_ctx(events=events, passed=False))


def test_only_moves_no_turns_negative_too_few_events() -> None:
    events = [_evt("move_forward", (1.0,))]
    assert not _rule("only_moves_no_turns").when(_ctx(events=events, passed=False))


# --- only_turns_no_moves ---


def test_only_turns_no_moves_positive() -> None:
    events = [_evt("turn_left", (90.0,)) for _ in range(5)]
    assert _rule("only_turns_no_moves").when(_ctx(events=events))


def test_only_turns_no_moves_negative_move_present() -> None:
    events = [_evt("turn_left", (90.0,)), _evt("move_forward", (1.0,)), _evt("turn_right", (90.0,))]
    assert not _rule("only_turns_no_moves").when(_ctx(events=events))


def test_only_turns_no_moves_negative_no_events() -> None:
    assert not _rule("only_turns_no_moves").when(_ctx())


# --- very_few_steps ---


def test_very_few_steps_positive() -> None:
    events = [_evt("move_forward", (1.0,))]
    assert _rule("very_few_steps").when(_ctx(events=events, passed=False))


def test_very_few_steps_negative_zero_steps() -> None:
    assert not _rule("very_few_steps").when(_ctx(events=[], passed=False))


def test_very_few_steps_negative_many_steps() -> None:
    events = [_evt("move_forward", (1.0,)) for _ in range(10)]
    assert not _rule("very_few_steps").when(_ctx(events=events, passed=False))


# --- distance_zero ---


def test_distance_zero_positive() -> None:
    events = [_evt("turn_left", (90.0,))]
    assert _rule("distance_zero").when(_ctx(events=events, passed=False))


def test_distance_zero_negative_movement_present() -> None:
    events = [_evt("move_forward", (1.0,), rover_state=_snap(distance=1.0))]
    assert not _rule("distance_zero").when(_ctx(events=events, passed=False))


def test_distance_zero_negative_no_events() -> None:
    assert not _rule("distance_zero").when(_ctx(events=[], passed=False))


# --- exceeded_max_lines ---


def test_exceeded_max_lines_positive() -> None:
    lesson = _lesson(max_lines=3)
    src = "\n".join(f"x{i} = {i}" for i in range(5))
    assert _rule("exceeded_max_lines").when(_ctx(lesson=lesson, source=src))


def test_exceeded_max_lines_negative_within_limit() -> None:
    lesson = _lesson(max_lines=10)
    src = "move_forward(1)\nturn_left(90)\n"
    assert not _rule("exceeded_max_lines").when(_ctx(lesson=lesson, source=src))


def test_exceeded_max_lines_ignores_blank_lines() -> None:
    lesson = _lesson(max_lines=2)
    src = "x = 1\n\n\ny = 2\n"
    assert not _rule("exceeded_max_lines").when(_ctx(lesson=lesson, source=src))


# --- disallowed_construct_used ---


def test_disallowed_construct_used_positive() -> None:
    lesson = _lesson(allowed_constructs=["function_call"])
    src = "for i in range(3):\n    move_forward(1)\n"
    assert _rule("disallowed_construct_used").when(_ctx(lesson=lesson, source=src))


def test_disallowed_construct_used_negative_within_allow_list() -> None:
    lesson = _lesson(allowed_constructs=["for", "function_call"])
    src = "for i in range(3):\n    move_forward(1)\n"
    assert not _rule("disallowed_construct_used").when(_ctx(lesson=lesson, source=src))


def test_disallowed_construct_used_negative_no_special_constructs() -> None:
    lesson = _lesson(allowed_constructs=["function_call"])
    src = "move_forward(1)\n"
    assert not _rule("disallowed_construct_used").when(_ctx(lesson=lesson, source=src))


# --- forgot_at_base_check ---


def test_forgot_at_base_check_positive() -> None:
    lesson = _lesson(success_criteria=[SuccessCriterion(returns_to_base=True)])
    assert _rule("forgot_at_base_check").when(_ctx(lesson=lesson, source="move_forward(1)"))


def test_forgot_at_base_check_negative_at_base_used() -> None:
    lesson = _lesson(success_criteria=[SuccessCriterion(returns_to_base=True)])
    src = "while not at_base():\n    move_forward(1)\n"
    assert not _rule("forgot_at_base_check").when(_ctx(lesson=lesson, source=src))


def test_forgot_at_base_check_negative_no_criterion() -> None:
    lesson = _lesson(success_criteria=[SuccessCriterion(no_collisions=True)])
    assert not _rule("forgot_at_base_check").when(_ctx(lesson=lesson, source="move_forward(1)"))


# --- defined_but_not_called ---


def test_defined_but_not_called_positive() -> None:
    src = "def helper():\n    move_forward(1)\nturn_left(90)\n"
    assert _rule("defined_but_not_called").when(_ctx(source=src, passed=False))


def test_defined_but_not_called_negative_called() -> None:
    src = "def helper():\n    move_forward(1)\nhelper()\n"
    assert not _rule("defined_but_not_called").when(_ctx(source=src, passed=False))


def test_defined_but_not_called_negative_no_defs() -> None:
    assert not _rule("defined_but_not_called").when(_ctx(source="move_forward(1)", passed=False))


# --- no_sensor_reads_when_sensors_required ---


def test_no_sensor_reads_when_sensors_required_positive() -> None:
    lesson = _lesson(ct_concepts=["abstraction"])
    events = [_evt("move_forward", (1.0,))]
    assert _rule("no_sensor_reads_when_sensors_required").when(
        _ctx(lesson=lesson, events=events, passed=False)
    )


def test_no_sensor_reads_when_sensors_required_negative_sensor_used() -> None:
    lesson = _lesson(ct_concepts=["abstraction"])
    events = [_evt("read_distance", (), 1.0, kind="sensor_read")]
    assert not _rule("no_sensor_reads_when_sensors_required").when(
        _ctx(lesson=lesson, events=events, passed=False)
    )


def test_no_sensor_reads_when_sensors_required_negative_not_abstraction_lesson() -> None:
    lesson = _lesson(ct_concepts=["sequence"])
    assert not _rule("no_sensor_reads_when_sensors_required").when(
        _ctx(lesson=lesson, passed=False)
    )


# --- last_action_was_collision_prone ---


def test_last_action_was_collision_prone_positive() -> None:
    events = [
        _evt("wall", kind="collision", rover_state=_snap(collisions=1)),
        _evt("move_forward", (1.0,)),
    ]
    assert _rule("last_action_was_collision_prone").when(_ctx(events=events, passed=False))


def test_last_action_was_collision_prone_negative_no_collision() -> None:
    events = [_evt("move_forward", (1.0,))]
    assert not _rule("last_action_was_collision_prone").when(_ctx(events=events, passed=False))


def test_last_action_was_collision_prone_negative_last_action_not_move() -> None:
    events = [_evt("wall", kind="collision"), _evt("turn_left", (90.0,))]
    assert not _rule("last_action_was_collision_prone").when(_ctx(events=events, passed=False))
