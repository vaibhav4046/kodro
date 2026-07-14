"""URDF -> KRS import gate (OPP-5): golden URDF maps to expected KRS fields.

Companion to test_urdf_export.py (KRS -> URDF direction). The converter must
be honest: only quantities the URDF actually carries appear in the KRS dict,
and everything it cannot express (motor rpm/torque, battery) is named in the
``declared`` notes list, never invented.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from robolearn.interop.urdf_io import krs_from_urdf
from robolearn.web.app import BridgeAPI

pytest.importorskip("yourdfpy")

GOLDEN_URDF = """<robot name="golden_bot">
  <link name="base_link">
    <inertial>
      <mass value="1.5"/>
      <inertia ixx="0.01" ixy="0" ixz="0" iyy="0.01" iyz="0" izz="0.01"/>
    </inertial>
    <visual><geometry><box size="0.2 0.15 0.08"/></geometry></visual>
    <collision><geometry><box size="0.2 0.15 0.08"/></geometry></collision>
  </link>
  <link name="left_wheel_link">
    <visual><geometry><cylinder radius="0.03" length="0.02"/></geometry></visual>
    <collision><geometry><cylinder radius="0.03" length="0.02"/></geometry></collision>
  </link>
  <link name="right_wheel_link">
    <visual><geometry><cylinder radius="0.03" length="0.02"/></geometry></visual>
    <collision><geometry><cylinder radius="0.03" length="0.02"/></geometry></collision>
  </link>
  <joint name="left_wheel_joint" type="continuous">
    <parent link="base_link"/>
    <child link="left_wheel_link"/>
    <origin xyz="0 0.075 0" rpy="0 0 0"/>
    <axis xyz="0 1 0"/>
  </joint>
  <joint name="right_wheel_joint" type="continuous">
    <parent link="base_link"/>
    <child link="right_wheel_link"/>
    <origin xyz="0 -0.075 0" rpy="0 0 0"/>
    <axis xyz="0 1 0"/>
  </joint>
</robot>
"""

ARM_URDF = """<robot name="golden_arm">
  <link name="base_link">
    <inertial>
      <mass value="0.8"/>
      <inertia ixx="0.01" ixy="0" ixz="0" iyy="0.01" iyz="0" izz="0.01"/>
    </inertial>
  </link>
  <link name="upper_arm_link"/>
  <link name="forearm_link"/>
  <joint name="shoulder_joint" type="revolute">
    <parent link="base_link"/>
    <child link="upper_arm_link"/>
    <axis xyz="0 0 1"/>
    <limit lower="-1.57" upper="1.57" effort="1" velocity="1"/>
  </joint>
  <joint name="elbow_joint" type="revolute">
    <parent link="upper_arm_link"/>
    <child link="forearm_link"/>
    <axis xyz="0 0 1"/>
    <limit lower="-1.57" upper="1.57" effort="1" velocity="1"/>
  </joint>
</robot>
"""


@pytest.fixture
def golden_urdf(tmp_path: Path) -> Path:
    path = tmp_path / "golden_bot.urdf"
    path.write_text(GOLDEN_URDF, encoding="utf-8")
    return path


def test_golden_urdf_maps_mass_and_drive(golden_urdf: Path) -> None:
    krs = krs_from_urdf(golden_urdf)
    assert krs["kodroSpec"] == 1
    assert krs["name"] == "golden_bot"
    assert krs["type"] == "rover"
    assert krs["massKg"] == 1.5
    drive = krs["drive"]
    # specschema.js DRIVE_KINDS accepts 'differential' (not 'diff'); emitting
    # the canonical token avoids a coercion warning on every import.
    assert drive["kind"] == "differential"
    assert drive["wheelRadiusCm"] == 3.0
    assert drive["motorCount"] == 2
    # Top speed derives from noLoadRpm x wheelRadiusCm in the Lab; the URDF
    # provides the radius, the missing motor is what keeps top speed honest.


def test_wheelbase_derived_from_two_same_parent_wheel_origins(golden_urdf: Path) -> None:
    krs = krs_from_urdf(golden_urdf)
    # Wheel joints sit at y = +0.075 and y = -0.075 on base_link: 0.15 m track.
    assert krs["drive"]["wheelbaseCm"] == 15.0


def test_motor_and_battery_absent_but_named_in_declared(golden_urdf: Path) -> None:
    krs = krs_from_urdf(golden_urdf)
    assert "motor" not in krs["drive"]
    assert "battery" not in krs
    declared = krs["declared"]
    assert isinstance(declared, list)
    assert any("drive.motor" in note for note in declared)
    assert any("battery" in note for note in declared)
    # Never invent numbers: outside the declared notes (which NAME the missing
    # keys on purpose), none of the motor/battery keys may appear anywhere.
    blob = json.dumps({key: value for key, value in krs.items() if key != "declared"})
    for invented in ("noLoadRpm", "stallTorqueNm", "nominalV", "mAh"):
        assert invented not in blob


def test_wheelless_urdf_omits_drive_and_declares_it(tmp_path: Path) -> None:
    path = tmp_path / "golden_arm.urdf"
    path.write_text(ARM_URDF, encoding="utf-8")
    krs = krs_from_urdf(path)
    assert krs["massKg"] == 0.8
    assert "drive" not in krs
    assert any(note.startswith("drive:") for note in krs["declared"])


def test_unparseable_urdf_raises_value_error(tmp_path: Path) -> None:
    path = tmp_path / "broken.urdf"
    path.write_text("<robot name='x'><link", encoding="utf-8")
    with pytest.raises(ValueError, match="not a parseable URDF"):
        krs_from_urdf(path)


# ---- desktop bridge payload (app.py import_robot_spec .urdf branch) --------


def test_bridge_payload_matches_json_import_shape(golden_urdf: Path) -> None:
    result = BridgeAPI._urdf_spec_payload(golden_urdf)
    assert result["ok"] is True
    assert result["name"] == "golden_bot.urdf"
    spec = json.loads(result["text"])
    assert spec["massKg"] == 1.5
    assert spec["drive"]["wheelRadiusCm"] == 3.0
    # The honesty notes stay Python-side: top-level `declared` is reserved by
    # specschema.js for the {maxSpeedMps, runtimeMin} object, and an array
    # there fails validate() and sinks the import.
    assert "declared" not in spec


def test_bridge_payload_reports_parse_failure(tmp_path: Path) -> None:
    path = tmp_path / "broken.urdf"
    path.write_text("not xml at all", encoding="utf-8")
    result = BridgeAPI._urdf_spec_payload(path)
    assert result["ok"] is False
    assert "URDF" in result["reason"]
