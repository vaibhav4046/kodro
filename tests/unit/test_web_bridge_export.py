"""The bridge's file-export surface: what it refuses, and why it says so.

``export_urdf`` is the one place a Kodro build leaves Kodro for a real robotics
toolchain. That makes its refusals load-bearing in a way an ordinary validation
error is not: a URDF that opens in ROS but does not describe the build the pupil
made is worse than no URDF at all, because the toolchain will happily simulate
it. The method's docstring commits to refusing an armless or wheel-less build
"with a reason rather than emitting a misleading diff-drive body it cannot
physically be", and nothing tested that commitment.

Every assertion here stops at the save-dialog boundary. ``webview.windows`` is
empty under pytest, so a spec that IS acceptable returns the dialog layer's
``no window`` rather than a path -- which is itself the signal being asserted:
reaching the dialog means the conversion was attempted, and any other reason
means it was rejected before that point.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pytest

from robolearn.lessons.schema import load_library
from robolearn.memory.store import Store
from robolearn.web.app import BridgeAPI

# A wheeled build, in the shape the studio's exportKrs() writes.
ROVER_KRS: dict[str, object] = {
    "name": "test rover",
    "massKg": 1.2,
    "drive": {"motorCount": 2, "wheelRadiusCm": 3.5},
}

# The same document with the drive motors removed: a manipulator, not a rover.
ARM_KRS: dict[str, object] = {
    "name": "test arm",
    "massKg": 0.8,
    "drive": {"motorCount": 0},
}

# "Reached the save dialog" -- the furthest a headless test can get, and proof
# that everything before the dialog (parse, convert, generate) succeeded.
REACHED_DIALOG = "no window"


@pytest.fixture
def api(tmp_path: Path) -> Iterator[BridgeAPI]:
    store = Store(tmp_path / "pupil.db")
    try:
        yield BridgeAPI(store=store, lessons=list(load_library()))
    finally:
        store.close()


def test_urdf_export_refuses_text_that_is_not_json(api: BridgeAPI) -> None:
    """A truncated paste must be named as such, not crash the bridge."""
    result = api.export_urdf("{not json at all")
    assert result["ok"] is False
    assert result["reason"] == "robot spec is not valid JSON"


def test_urdf_export_refuses_json_that_is_not_an_object(api: BridgeAPI) -> None:
    """Valid JSON is not a valid spec: a bare array has no build in it."""
    result = api.export_urdf("[1, 2, 3]")
    assert result["ok"] is False
    assert result["reason"] == "robot spec is not an object"


def test_urdf_export_refuses_a_wheel_less_build_rather_than_inventing_wheels(
    api: BridgeAPI,
) -> None:
    """The docstring's central promise, and the only one with a safety cost.

    ``kodro_spec_from_krs`` derives the wheel count from ``drive.motorCount``,
    and 0 is a real answer (an arm), not a missing field. If that ever silently
    defaulted to 2 the exporter would emit a diff-drive body for a robot that
    cannot drive, and the refusal below would turn into a plausible-looking URDF.
    """
    result = api.export_urdf(json.dumps(ARM_KRS))
    assert result["ok"] is False
    assert "no wheels" in result["reason"]
    assert "URDF export is for wheeled" in result["reason"]


def test_urdf_export_converts_a_wheeled_build_and_reaches_the_save_dialog(
    api: BridgeAPI,
) -> None:
    """The positive control: without it, the refusals prove only that it refuses.

    Getting as far as ``no window`` means the spec parsed, converted to a
    ``KodroRobotSpec``, passed ``looks_like_rover`` and generated a URDF whose
    text was non-empty and under the size cap -- every step except the host
    dialog, which no headless test can supply.
    """
    result = api.export_urdf(json.dumps(ROVER_KRS))
    assert result["ok"] is False
    assert result["reason"] == REACHED_DIALOG, (
        f"a wheeled build should have reached the save dialog; got {result['reason']}"
    )


def test_urdf_export_defaults_to_a_rover_when_the_drive_block_is_absent(
    api: BridgeAPI,
) -> None:
    """A spec with no ``drive`` block at all is treated as the two-wheel default.

    This is the documented asymmetry with ``motorCount: 0`` above -- absent means
    "unspecified, assume the common case", zero means "explicitly none" -- and
    it is worth pinning because collapsing the two would silently re-enable the
    misleading export the previous test forbids.
    """
    result = api.export_urdf(json.dumps({"name": "bare", "massKg": 1.0}))
    assert result["reason"] == REACHED_DIALOG


def test_urdf_export_names_the_field_when_the_spec_will_not_convert(
    api: BridgeAPI,
) -> None:
    """A well-formed object can still hold an unconvertible value.

    ``massKg`` goes through ``float()``, so a string there raises inside the
    converter rather than at the JSON boundary. The bridge has to catch that and
    say which layer refused, otherwise the UI reports "not valid JSON" about a
    document that parsed perfectly well.
    """
    result = api.export_urdf(json.dumps({"name": "bad mass", "massKg": "heavy"}))
    assert result["ok"] is False
    assert result["reason"].startswith("cannot read the robot spec:")


def test_urdf_export_refuses_a_massless_build(api: BridgeAPI) -> None:
    """The last refusal, raised by the generator rather than the bridge.

    A zero mass converts fine and looks like a rover, so it clears every earlier
    guard and only fails inside ``build_urdf_from_spec`` -- which is exactly why
    the bridge wraps that call too. A URDF with a zero-mass link makes physics
    engines produce nonsense rather than an error.
    """
    spec = dict(ROVER_KRS, massKg=0)
    result = api.export_urdf(json.dumps(spec))
    assert result["ok"] is False
    assert "mass must be positive" in result["reason"]


def test_spec_export_refuses_empty_text(api: BridgeAPI) -> None:
    """Saving nothing writes a zero-byte file the user then has to diagnose."""
    result = api.export_robot_spec("   \n  ")
    assert result["ok"] is False
    assert result["reason"] == "nothing to save"


def test_spec_export_refuses_content_over_the_size_cap(api: BridgeAPI) -> None:
    """The cap is what stops a paste-bomb from being written to the user's disk.

    Measured in BYTES, not characters, so the payload below is deliberately
    ASCII: a multi-byte string would pass the cap at this length and hide a
    len()-vs-encode() mix-up.
    """
    oversized = "x" * (BridgeAPI._SPEC_MAX_BYTES + 1)
    result = api.export_robot_spec(oversized)
    assert result["ok"] is False
    assert result["reason"] == "content too large"


def test_spec_export_accepts_content_exactly_at_the_cap(api: BridgeAPI) -> None:
    """The cap is inclusive. An off-by-one here rejects a legal spec."""
    at_limit = "x" * BridgeAPI._SPEC_MAX_BYTES
    result = api.export_robot_spec(at_limit)
    assert result["reason"] == REACHED_DIALOG


def test_verification_report_export_shares_the_same_guards(api: BridgeAPI) -> None:
    """Three exports, one dialog helper: the guards must not be per-call-site."""
    assert api.save_verification_report("")["reason"] == "nothing to save"
    assert api.save_verification_report("a real report line")["reason"] == REACHED_DIALOG
