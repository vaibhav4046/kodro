"""Rule-based, offline hint engine.

Each rule is a :class:`HintRule` whose ``when`` predicate consumes a
:class:`HintContext` (the lesson, the pupil source, the recorded events,
and the grader's verdict). The first matching rule in :data:`RULES`
yields the hint shown to the pupil.

Section 7.3 of the build spec requires at least twenty real rules; this
module ships twenty-four, each covered by three unit tests in
``tests/unit/test_hint_engine.py``.
"""

from __future__ import annotations

import ast
from collections.abc import Callable, Iterable
from dataclasses import dataclass

from kodro.lessons.grader import GradeResult
from kodro.lessons.schema import Lesson
from kodro.runtime.tracer import Event

# ---------------------------------------------------------------------------
# AST helpers (mirrors the table in lessons.grader so the two stay in sync)
# ---------------------------------------------------------------------------

_CONSTRUCT_NODE_TYPES: dict[str, tuple[type[ast.AST], ...]] = {
    "while": (ast.While,),
    "for": (ast.For,),
    "if": (ast.If,),
    "function_def": (ast.FunctionDef, ast.AsyncFunctionDef),
    "function_call": (ast.Call,),
    "comparison": (ast.Compare,),
    "arithmetic": (ast.BinOp,),
    "assignment": (ast.Assign, ast.AugAssign),
    "logical": (ast.BoolOp,),
    "return": (ast.Return,),
}


def _parse(source: str) -> ast.AST | None:
    try:
        return ast.parse(source)
    except SyntaxError:
        return None


def _has_construct(source: str, construct: str) -> bool:
    tree = _parse(source)
    if tree is None:
        return False
    if construct == "recursion":
        return _has_recursion(tree)
    node_types = _CONSTRUCT_NODE_TYPES.get(construct)
    if node_types is None:
        return False
    return any(isinstance(node, node_types) for node in ast.walk(tree))


def _has_recursion(tree: ast.AST) -> bool:
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            for inner in ast.walk(node):
                if isinstance(inner, ast.Call):
                    func = inner.func
                    if isinstance(func, ast.Name) and func.id == node.name:
                        return True
    return False


def _line_count(source: str) -> int:
    return sum(1 for line in source.splitlines() if line.strip())


def _calls_move_forward_with_negative(source: str) -> bool:
    """True if the source calls ``move_forward`` with a negative literal.

    The rover clamps distances to >= 0 before emitting the event, so a
    negative distance never survives into ``c.events``; detect it from the
    source instead, so the "use move_backward" hint can still fire.
    """
    tree = _parse(source)
    if tree is None:
        return False
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "move_forward"
            and node.args
        ):
            arg = node.args[0]
            if isinstance(arg, ast.UnaryOp) and isinstance(arg.op, ast.USub):
                return True
            if (
                isinstance(arg, ast.Constant)
                and isinstance(arg.value, (int, float))
                and not isinstance(arg.value, bool)
                and arg.value < 0
            ):
                return True
    return False


def _uses_disallowed_construct(source: str, allowed: Iterable[str]) -> bool:
    tree = _parse(source)
    if tree is None:
        return False
    allowed_set = set(allowed)
    for construct, node_types in _CONSTRUCT_NODE_TYPES.items():
        if construct in allowed_set:
            continue
        if any(isinstance(node, node_types) for node in ast.walk(tree)):
            return True
    return False


def _has_unused_function(source: str) -> bool:
    tree = _parse(source)
    if tree is None:
        return False
    defined: set[str] = set()
    called: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            defined.add(node.name)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            called.add(node.func.id)
    return bool(defined - called)


# ---------------------------------------------------------------------------
# Event helpers
# ---------------------------------------------------------------------------

_MOVE_NAMES: frozenset[str] = frozenset({"move_forward", "move_backward"})
_TURN_NAMES: frozenset[str] = frozenset({"turn_left", "turn_right"})
_SENSOR_NAMES: frozenset[str] = frozenset(
    {
        "read_distance",
        "read_colour",
        "read_heading",
        "read_battery",
        "obstacle_ahead",
        "sample_detected",
        "at_base",
    }
)


def _move_count(events: Iterable[Event]) -> int:
    return sum(1 for event in events if event.name in _MOVE_NAMES)


def _turn_count(events: Iterable[Event]) -> int:
    return sum(1 for event in events if event.name in _TURN_NAMES)


def _uses_any_sensor(events: Iterable[Event]) -> bool:
    return any(event.name in _SENSOR_NAMES for event in events)


# ---------------------------------------------------------------------------
# Context
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class HintContext:
    """Inputs every :class:`HintRule` matcher receives."""

    lesson: Lesson
    source: str
    events: tuple[Event, ...]
    grade_result: GradeResult

    # --- derived metrics ----------------------------------------------------

    @property
    def step_count(self) -> int:
        """Number of recorded events."""
        return len(self.events)

    @property
    def collisions(self) -> int:
        """Highest collision count recorded on the rover snapshots.

        Collisions accumulate on the rover state, not as ``kind="collision"``
        events (which are never emitted), so read the running max from the
        snapshots the same way the grader does.
        """
        return max(
            (e.rover_state.collisions for e in self.events if e.rover_state is not None),
            default=0,
        )

    @property
    def samples_collected(self) -> int:
        """Number of successful ``collect_sample`` calls."""
        return sum(1 for e in self.events if e.name == "collect_sample" and e.result is True)

    @property
    def distance_moved(self) -> float:
        """Actual distance the rover travelled, from the snapshots.

        Not the sum of commanded move arguments: a move clamped short by a wall
        or obstacle travels less than commanded, so summing the arguments
        over-counts. The engine accumulates true travel, so the running max over
        the snapshots is the total (matches the grader).
        """
        return max(
            (e.rover_state.distance_travelled_m for e in self.events if e.rover_state is not None),
            default=0.0,
        )

    @property
    def battery_used(self) -> float:
        """Maximum battery percentage drained across all recorded snapshots."""
        max_used = 0.0
        for event in self.events:
            if event.rover_state is not None:
                max_used = max(max_used, 100.0 - event.rover_state.battery_pct)
        return max_used

    @property
    def last_action(self) -> str | None:
        """Name of the most recent ``call`` / ``sample`` event, or ``None``."""
        for event in reversed(self.events):
            if event.kind in ("call", "sample"):
                return event.name
        return None

    @property
    def passed(self) -> bool:
        """Whether the grader judged this submission passing."""
        return self.grade_result.passed

    @property
    def has_loop(self) -> bool:
        """True when the source code contains a ``for`` or ``while`` loop."""
        return _has_construct(self.source, "for") or _has_construct(self.source, "while")


# ---------------------------------------------------------------------------
# Rule + Hint dataclasses
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class HintRule:
    """One pattern → hint rule.

    Attributes:
        name: stable identifier (snake_case).
        when: callable returning True when the hint should fire.
        say: human-readable hint message displayed to the pupil.
    """

    name: str
    when: Callable[[HintContext], bool]
    say: str


@dataclass(frozen=True, slots=True)
class Hint:
    """A surfaced hint (rule name + the message displayed to the pupil)."""

    rule_name: str
    message: str


# ---------------------------------------------------------------------------
# The twenty-four rules
# ---------------------------------------------------------------------------

RULES: tuple[HintRule, ...] = (
    HintRule(
        name="empty_submission",
        when=lambda c: c.step_count == 0 and not c.passed,
        say="Your code didn't call any rover functions. Try `move_forward(5)` to start.",
    ),
    HintRule(
        name="starter_code_unchanged",
        when=lambda c: c.source.strip() == c.lesson.starter_code.strip() and not c.passed,
        say="You submitted the starter code unchanged. Edit it to solve the mission.",
    ),
    HintRule(
        name="while_no_progress",
        when=lambda c: (
            _has_construct(c.source, "while") and c.distance_moved == 0.0 and not c.passed
        ),
        say="Your while loop didn't move the rover. Did you forget move_forward inside it?",
    ),
    HintRule(
        name="while_true_no_break",
        when=lambda c: "while True" in c.source and "break" not in c.source,
        say="`while True:` runs forever. Add a `break` so the loop can exit.",
    ),
    HintRule(
        name="multiple_collisions",
        when=lambda c: c.collisions > 1,
        say="Multiple collisions recorded -- shrink your move_forward distance until none happen.",
    ),
    HintRule(
        name="overshoot",
        when=lambda c: c.collisions > 0 and c.last_action in _MOVE_NAMES and not c.passed,
        say="You collided right after a move. Try smaller step sizes inside the loop.",
    ),
    HintRule(
        name="battery_drained",
        when=lambda c: c.battery_used > 90.0,
        say="Battery is almost empty. Can you reach the goal with fewer or shorter moves?",
    ),
    HintRule(
        name="negative_move_argument",
        when=lambda c: _calls_move_forward_with_negative(c.source),
        say="You passed a negative distance to move_forward. Use `move_backward(...)` instead.",
    ),
    HintRule(
        name="excessive_turn",
        when=lambda c: any(
            e.name in _TURN_NAMES and e.args and abs(float(e.args[0])) > 359 for e in c.events
        ),
        say="One of your turn calls exceeds 359 degrees -- a single turn rarely needs that much.",
    ),
    HintRule(
        name="needs_iteration_construct",
        when=lambda c: "iteration" in c.lesson.ct_concepts and not c.has_loop and not c.passed,
        say="This lesson is about iteration. Try a `for` or `while` loop.",
    ),
    HintRule(
        name="needs_selection_construct",
        when=lambda c: (
            "selection" in c.lesson.ct_concepts
            and not _has_construct(c.source, "if")
            and not c.passed
        ),
        say="This lesson is about selection. Use an `if` statement to choose between actions.",
    ),
    HintRule(
        name="needs_function_def",
        when=lambda c: (
            "functions" in c.lesson.ct_concepts
            and not _has_construct(c.source, "function_def")
            and not c.passed
        ),
        say="This lesson asks you to define a function with `def my_function():`.",
    ),
    HintRule(
        name="needs_recursion",
        when=lambda c: (
            "recursion" in c.lesson.ct_concepts
            and not _has_construct(c.source, "recursion")
            and not c.passed
        ),
        say="Make your function call itself with a smaller argument -- that's recursion.",
    ),
    HintRule(
        name="missing_collect_sample",
        when=lambda c: (
            any(
                crit.samples_collected is not None and crit.samples_collected > 0
                for crit in c.lesson.success_criteria
            )
            and c.samples_collected == 0
            and not c.passed
        ),
        say="The mission needs samples. Call `collect_sample()` once the rover is over a patch.",
    ),
    HintRule(
        name="only_moves_no_turns",
        when=lambda c: (
            c.step_count >= 3
            and _move_count(c.events) > 0
            and _turn_count(c.events) == 0
            and not c.passed
        ),
        say="You only drive in a straight line. Try `turn_left(...)` or `turn_right(...)`.",
    ),
    HintRule(
        name="only_turns_no_moves",
        when=lambda c: (
            c.step_count >= 3 and _move_count(c.events) == 0 and _turn_count(c.events) > 0
        ),
        say="You only turn -- add `move_forward(...)` so the rover actually goes somewhere.",
    ),
    HintRule(
        name="very_few_steps",
        when=lambda c: 0 < c.step_count < 3 and not c.passed,
        say="The rover only ran a few API calls. Have you completed the whole mission?",
    ),
    HintRule(
        name="distance_zero",
        when=lambda c: c.step_count > 0 and c.distance_moved == 0.0 and not c.passed,
        say="The rover never moved. Add at least one `move_forward(...)` call.",
    ),
    HintRule(
        name="exceeded_max_lines",
        when=lambda c: _line_count(c.source) > c.lesson.max_lines,
        say="Your code is longer than the lesson's `max_lines`. Try to express it in fewer lines.",
    ),
    HintRule(
        name="disallowed_construct_used",
        when=lambda c: _uses_disallowed_construct(c.source, c.lesson.allowed_constructs),
        say="Your code uses a construct outside `allowed_constructs`. Stick to the listed ones.",
    ),
    HintRule(
        name="forgot_at_base_check",
        when=lambda c: (
            any(crit.returns_to_base for crit in c.lesson.success_criteria)
            and "at_base" not in c.source
            and not c.passed
        ),
        say="The mission asks you to return to base. Use `at_base()` to know when you've arrived.",
    ),
    HintRule(
        name="defined_but_not_called",
        when=lambda c: _has_unused_function(c.source) and not c.passed,
        say="You defined a function but never called it.",
    ),
    HintRule(
        name="no_sensor_reads_when_sensors_required",
        when=lambda c: (
            "abstraction" in c.lesson.ct_concepts
            and not _uses_any_sensor(c.events)
            and not c.passed
        ),
        say="This lesson is about reading sensors. Try `read_distance()` or `obstacle_ahead()`.",
    ),
    HintRule(
        name="last_action_was_collision_prone",
        when=lambda c: c.last_action in _MOVE_NAMES and c.collisions > 0 and not c.passed,
        say=(
            "The rover crashed during its last move. Slow down -- shorter steps prevent collisions."
        ),
    ),
)


# ---------------------------------------------------------------------------
# Public matchers
# ---------------------------------------------------------------------------


def find_first_hint(
    context: HintContext,
    rules: Iterable[HintRule] | None = None,
) -> Hint | None:
    """Return the first :class:`Hint` whose rule matches the context.

    Args:
        context: The submission to inspect.
        rules: Optional override list (default: :data:`RULES`).

    Returns:
        A :class:`Hint` carrying the rule name and the user-facing message,
        or ``None`` if no rule matches.
    """
    iterable: Iterable[HintRule] = rules if rules is not None else RULES
    for rule in iterable:
        if rule.when(context):
            return Hint(rule_name=rule.name, message=rule.say)
    return None


def find_all_hints(
    context: HintContext,
    rules: Iterable[HintRule] | None = None,
) -> list[Hint]:
    """Return *every* matching hint, in rule order. Useful for the dashboard."""
    iterable: Iterable[HintRule] = rules if rules is not None else RULES
    return [Hint(rule_name=r.name, message=r.say) for r in iterable if r.when(context)]
