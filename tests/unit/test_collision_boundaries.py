"""Collision detection at the exact boundary: a rover touching a rock.

``segment_circle_hit`` decides whether a move ends in a crash. Its own source
comment records that this function already caused one real bug: blocking
unconditionally when the segment starts inside the grown circle "trapped a
touching rover forever: every later move, including one pointed straight AWAY
from the obstacle, reported an immediate hit".

Mutation testing showed the fix for that bug was never pinned. Six comparison
boundaries in this function could all be flipped without a single test noticing,
including the one that distinguishes "moving away from the rock I am touching"
from "moving into it".

Every case below is constructed so the quantity under test lands EXACTLY on the
boundary, which is the only place a `<` and a `<=` differ. Each carries the
mutation it kills.
"""

from __future__ import annotations

import pytest

from kodro.engine.motion_model import segment_circle_hit

# A circle at the origin. Radius 5 keeps every construction below in exact
# binary floating point, so "exactly on the boundary" really is exact.
CX, CY, R = 0.0, 0.0, 5.0


def test_the_constructions_really_are_exact() -> None:
    """Guard the guard: if these are not exact, every test below tests nothing."""
    # A point at (5, 0) is exactly on the circle: c = fx^2 + fy^2 - r^2 == 0.
    assert 5.0 * 5.0 + 0.0 * 0.0 - R * R == 0.0
    # The tangent construction below gives a discriminant of exactly zero.
    dx, fx, fy = 20.0, -10.0, 5.0
    a = dx * dx
    c = fx * fx + fy * fy - R * R
    b = 2.0 * (fx * dx)
    assert b * b - 4.0 * a * c == 0.0


def test_a_touching_rover_may_move_tangentially() -> None:
    """Kills `b < 0.0` -> `b <= 0.0`, and `c <= 0.0` -> `c < 0.0`.

    Start exactly on the grown circle and move at right angles to the radius,
    so the move neither approaches nor retreats: b is exactly 0. This is the
    regression the source comment describes. Under either mutant the rover is
    reported as hitting a rock it is merely sliding along, and a pupil whose
    rover once brushed an obstacle can never move again.
    """
    assert segment_circle_hit(5.0, 0.0, 5.0, 1.0, CX, CY, R) is None


def test_a_touching_rover_may_reverse_away() -> None:
    """The other half of the same fix: retreating is free."""
    assert segment_circle_hit(5.0, 0.0, 6.0, 0.0, CX, CY, R) is None


def test_a_touching_rover_moving_inward_hits_immediately() -> None:
    """And the case that must still register: driving further in."""
    assert segment_circle_hit(5.0, 0.0, 4.0, 0.0, CX, CY, R) == pytest.approx(0.0)


def test_a_zero_length_move_from_inside_reports_contact() -> None:
    """Kills `a <= 1e-12` -> `a < 1e-12`.

    A move whose squared length is exactly the degeneracy threshold must take
    the degenerate path. Started from inside the circle, that path reports
    contact at t=0; the quadratic path below it would instead compute b == 0
    and report no contact at all, so a rover sitting inside a rock would be
    told it is clear.
    """
    # dx = 1e-6 so a = dx*dx = 1e-12 exactly, and the start point is inside.
    assert segment_circle_hit(0.0, 0.0, 1e-6, 0.0, CX, CY, R) == pytest.approx(0.0)


def test_a_tangent_path_counts_as_contact() -> None:
    """Kills `disc < 0.0` -> `disc <= 0.0`.

    A segment that grazes the circle at exactly one point has a discriminant of
    exactly zero. That is a touch, not a miss. Under the mutant the rover glides
    through the one point where it should have stopped.
    """
    hit = segment_circle_hit(-10.0, 5.0, 10.0, 5.0, CX, CY, R)
    assert hit is not None, "a tangent path must register contact, not slip through"
    assert hit == pytest.approx(0.5), "contact is at the midpoint of this segment"


def test_a_clear_path_still_reports_no_contact() -> None:
    """Guard the guard: the function must not simply say 'hit' to everything."""
    assert segment_circle_hit(-10.0, 50.0, 10.0, 50.0, CX, CY, R) is None
    assert segment_circle_hit(20.0, 0.0, 30.0, 0.0, CX, CY, R) is None


def test_a_zero_length_move_exactly_on_the_rim_reports_contact() -> None:
    """Kills the degenerate branch's `c <= 0.0` -> `c < 0.0`.

    A zero-length move starting exactly ON the grown circle, so both `a` and `c`
    are exactly zero at once. The rover is touching, so the honest answer is
    contact. Under the mutant a rover parked against a rock reports clear.
    """
    assert segment_circle_hit(5.0, 0.0, 5.0, 0.0, CX, CY, R) == pytest.approx(0.0)


def test_contact_exactly_at_the_end_of_the_move_still_counts() -> None:
    """Kills `t1 > 1.0` -> `t1 >= 1.0`.

    A move that arrives exactly at the rim on its final step has t1 of exactly
    1.0. That is a contact at the end of the move, not a miss. Under the mutant
    the rover finishes the step embedded in the obstacle with no collision
    recorded, which is the one outcome the swept test exists to prevent.
    """
    hit = segment_circle_hit(-10.0, 0.0, -5.0, 0.0, CX, CY, R)
    assert hit is not None, "arriving exactly at the rim is contact"
    assert hit == pytest.approx(1.0)
