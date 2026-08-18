"""URDF round-trip and honest-conversion edge cases (kodro.interop.urdf_io).

The module docstring promises a round-trip contract (load -> export -> load
preserves the structural signature) and that ``krs_from_urdf`` never invents a
number it cannot read off the document. test_urdf_import.py and
test_urdf_export.py cover the happy paths on synthetic two-wheel robots; this
file covers the round trip, the ROS-parity parser, and the branches where the
document does not give the converter what it wants.

The corpus under tests/fixtures/urdf/ is real ROS robot description files, so
these also guard against a regression that only shows up on non-toy input.
"""

from __future__ import annotations

import importlib.util
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

from kodro.interop.urdf_io import (
    _joint_origin_xyz,
    _wheelbase_cm,
    build_urdf_from_spec,
    export_urdf,
    kodro_spec_from_krs,
    krs_from_urdf,
    load_urdf,
    ros_parity_structure,
    spec_from_urdf,
    structure_of,
)

FIXTURES = Path("tests/fixtures/urdf")

requires_yourdfpy = pytest.mark.skipif(
    importlib.util.find_spec("yourdfpy") is None,
    reason="yourdfpy is not installed (interop extra)",
)
requires_ros_parser = pytest.mark.skipif(
    importlib.util.find_spec("urdf_parser_py") is None,
    reason="urdf_parser_py is not installed (interop extra)",
)

MASSLESS_URDF = """<robot name="massless_rover">
  <link name="base_link"/>
  <link name="left_wheel_link">
    <visual><geometry><cylinder radius="0.04" length="0.02"/></geometry></visual>
  </link>
  <link name="right_wheel_link">
    <visual><geometry><cylinder radius="0.04" length="0.02"/></geometry></visual>
  </link>
  <joint name="left_wheel_joint" type="continuous">
    <parent link="base_link"/><child link="left_wheel_link"/>
    <origin xyz="0 0.1 0"/><axis xyz="0 1 0"/>
  </joint>
  <joint name="right_wheel_joint" type="continuous">
    <parent link="base_link"/><child link="right_wheel_link"/>
    <origin xyz="0 -0.1 0"/><axis xyz="0 1 0"/>
  </joint>
</robot>
"""

BOX_WHEEL_URDF = """<robot name="box_wheel_rover">
  <link name="base_link">
    <inertial>
      <mass value="2.0"/>
      <inertia ixx="0.01" ixy="0" ixz="0" iyy="0.01" iyz="0" izz="0.01"/>
    </inertial>
  </link>
  <link name="left_wheel_link">
    <visual><geometry><box size="0.06 0.02 0.06"/></geometry></visual>
  </link>
  <link name="right_wheel_link">
    <visual><geometry><box size="0.06 0.02 0.06"/></geometry></visual>
  </link>
  <joint name="left_wheel_joint" type="continuous">
    <parent link="base_link"/><child link="left_wheel_link"/>
    <origin xyz="0 0.1 0"/><axis xyz="0 1 0"/>
  </joint>
  <joint name="right_wheel_joint" type="continuous">
    <parent link="base_link"/><child link="right_wheel_link"/>
    <origin xyz="0 -0.1 0"/><axis xyz="0 1 0"/>
  </joint>
</robot>
"""

SPHERE_WHEEL_URDF = """<robot name="ball_caster_rover">
  <link name="base_link">
    <inertial>
      <mass value="2.0"/>
      <inertia ixx="0.01" ixy="0" ixz="0" iyy="0.01" iyz="0" izz="0.01"/>
    </inertial>
  </link>
  <link name="left_wheel_link">
    <visual><geometry><sphere radius="0.035"/></geometry></visual>
  </link>
  <link name="right_wheel_link">
    <visual><geometry><sphere radius="0.035"/></geometry></visual>
  </link>
  <joint name="left_wheel_joint" type="continuous">
    <parent link="base_link"/><child link="left_wheel_link"/>
    <origin xyz="0 0.1 0"/><axis xyz="0 1 0"/>
  </joint>
  <joint name="right_wheel_joint" type="continuous">
    <parent link="base_link"/><child link="right_wheel_link"/>
    <origin xyz="0 -0.1 0"/><axis xyz="0 1 0"/>
  </joint>
</robot>
"""

SPLIT_PARENT_URDF = """<robot name="split_parent_rover">
  <link name="base_link">
    <inertial>
      <mass value="2.0"/>
      <inertia ixx="0.01" ixy="0" ixz="0" iyy="0.01" iyz="0" izz="0.01"/>
    </inertial>
  </link>
  <link name="boom_link"/>
  <link name="left_wheel_link">
    <visual><geometry><cylinder radius="0.04" length="0.02"/></geometry></visual>
  </link>
  <link name="right_wheel_link">
    <visual><geometry><cylinder radius="0.04" length="0.02"/></geometry></visual>
  </link>
  <joint name="boom_joint" type="fixed">
    <parent link="base_link"/><child link="boom_link"/>
  </joint>
  <joint name="left_wheel_joint" type="continuous">
    <parent link="base_link"/><child link="left_wheel_link"/>
    <origin xyz="0 0.1 0"/><axis xyz="0 1 0"/>
  </joint>
  <joint name="right_wheel_joint" type="continuous">
    <parent link="boom_link"/><child link="right_wheel_link"/>
    <origin xyz="0 -0.1 0"/><axis xyz="0 1 0"/>
  </joint>
</robot>
"""

COINCIDENT_WHEEL_URDF = """<robot name="coincident_rover">
  <link name="base_link">
    <inertial>
      <mass value="2.0"/>
      <inertia ixx="0.01" ixy="0" ixz="0" iyy="0.01" iyz="0" izz="0.01"/>
    </inertial>
  </link>
  <link name="left_wheel_link">
    <visual><geometry><cylinder radius="0.04" length="0.02"/></geometry></visual>
  </link>
  <link name="right_wheel_link">
    <visual><geometry><cylinder radius="0.04" length="0.02"/></geometry></visual>
  </link>
  <joint name="left_wheel_joint" type="continuous">
    <parent link="base_link"/><child link="left_wheel_link"/><axis xyz="0 1 0"/>
  </joint>
  <joint name="right_wheel_joint" type="continuous">
    <parent link="base_link"/><child link="right_wheel_link"/><axis xyz="0 1 0"/>
  </joint>
</robot>
"""


def _many_wheel_urdf(wheel_count: int) -> str:
    parts = [
        '<robot name="many_wheel_rover">',
        '  <link name="base_link">',
        '    <inertial><mass value="4.0"/>'
        '<inertia ixx="0.01" ixy="0" ixz="0" iyy="0.01" iyz="0" izz="0.01"/></inertial>',
        "  </link>",
    ]
    for index in range(wheel_count):
        parts += [
            f'  <link name="wheel_{index}_link">'
            '<visual><geometry><cylinder radius="0.04" length="0.02"/></geometry></visual>'
            "</link>",
            f'  <joint name="wheel_{index}_joint" type="continuous">'
            '<parent link="base_link"/>'
            f'<child link="wheel_{index}_link"/>'
            f'<origin xyz="{index * 0.1} 0.1 0"/><axis xyz="0 1 0"/></joint>',
        ]
    parts.append("</robot>")
    return "\n".join(parts) + "\n"


def _write(tmp_path: Path, name: str, text: str) -> Path:
    path = tmp_path / name
    path.write_text(text, encoding="utf-8")
    return path


# ---- KRS -> spec -> URDF, no parser required --------------------------------


def test_unusable_krs_name_falls_back_to_a_valid_urdf_name() -> None:
    # A URDF robot name must be an identifier; the studio lets users type
    # anything, so a name of pure punctuation must not produce '<robot name="">'.
    assert kodro_spec_from_krs({"name": "!!! ???"}).name == "kodro_robot"
    assert kodro_spec_from_krs({"name": "Rover #3 (v2)"}).name == "Rover_3_v2"


def test_mass_falls_back_to_derived_grams_when_mass_kg_is_absent() -> None:
    spec = kodro_spec_from_krs({"name": "x", "derived": {"massG": 1500}})
    assert spec.mass_kg == 1.5


def test_zero_mass_build_is_rejected_rather_than_emitting_a_massless_robot() -> None:
    spec = kodro_spec_from_krs({"name": "x", "massKg": 0})
    with pytest.raises(ValueError, match="robot mass must be positive"):
        build_urdf_from_spec(spec)


def test_negative_wheel_radius_is_rejected() -> None:
    spec = kodro_spec_from_krs({"name": "x", "massKg": 1.0, "drive": {"wheelRadiusCm": -3.0}})
    with pytest.raises(ValueError, match="wheel radius must be positive"):
        build_urdf_from_spec(spec)


def test_wheel_heavy_build_rebalances_instead_of_emitting_a_negative_chassis_mass() -> None:
    # 20 wheels at the nominal 5% of body mass each would leave the chassis at
    # exactly zero, which URDF consumers reject; the builder splits 50/50.
    spec = kodro_spec_from_krs({"name": "x", "massKg": 1.0, "drive": {"motorCount": 20}})
    root = ET.fromstring(build_urdf_from_spec(spec))

    masses = {
        link.attrib["name"]: float(link.findall("inertial/mass")[0].attrib["value"])
        for link in root.findall("link")
    }
    assert masses["base_link"] == 0.5
    assert all(mass > 0 for mass in masses.values())
    assert sum(masses.values()) == pytest.approx(1.0)


# ---- round trip and ROS parity ----------------------------------------------


@requires_yourdfpy
@pytest.mark.parametrize("fixture", ["turtlebot", "kuka_iiwa", "cartpole"])
def test_round_trip_preserves_the_structural_signature(fixture: str, tmp_path: Path) -> None:
    original = load_urdf(FIXTURES / f"{fixture}.urdf")
    before = structure_of(original)

    # A nested target also proves export creates its parent directory.
    exported = export_urdf(original, tmp_path / "out" / f"{fixture}.urdf")

    assert exported.is_file()
    assert structure_of(load_urdf(exported)) == before


@requires_yourdfpy
@requires_ros_parser
@pytest.mark.parametrize("fixture", ["turtlebot", "kuka_iiwa", "cartpole"])
def test_ros_reference_parser_reads_the_same_structure(fixture: str) -> None:
    # What Kodro accepts must be what ROS accepts, link for link and joint for
    # joint; a lenient-parser divergence here would ship an unusable export.
    path = FIXTURES / f"{fixture}.urdf"
    assert ros_parity_structure(path) == structure_of(load_urdf(path))


@requires_ros_parser
def test_ros_parity_reports_a_missing_file(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="URDF file not found"):
        ros_parity_structure(tmp_path / "absent.urdf")


@requires_ros_parser
def test_ros_parity_reports_a_document_the_reference_parser_rejects(tmp_path: Path) -> None:
    path = _write(tmp_path, "broken.urdf", "<robot name='x'><link")
    with pytest.raises(ValueError, match="ROS parser rejected URDF document"):
        ros_parity_structure(path)


@requires_yourdfpy
def test_load_urdf_reports_a_missing_file(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="URDF file not found"):
        load_urdf(tmp_path / "absent.urdf")


# ---- krs_from_urdf: what the document cannot say is declared, not invented ---


@requires_yourdfpy
def test_two_wheel_rover_derives_the_track_width() -> None:
    krs = krs_from_urdf(FIXTURES / "turtlebot.urdf")
    assert krs["drive"]["motorCount"] == 2
    assert krs["drive"]["wheelbaseCm"] == 23.0


@requires_yourdfpy
def test_four_wheel_rover_declares_the_track_width_it_cannot_derive() -> None:
    krs = krs_from_urdf(FIXTURES / "r2d2.urdf")
    assert krs["drive"]["motorCount"] == 4
    assert "wheelbaseCm" not in krs["drive"]
    assert any("drive.wheelbaseCm" in note for note in krs["declared"])


@requires_yourdfpy
def test_wheels_on_different_parents_yield_no_track_width(tmp_path: Path) -> None:
    krs = krs_from_urdf(_write(tmp_path, "split.urdf", SPLIT_PARENT_URDF))
    assert "wheelbaseCm" not in krs["drive"]
    assert any("drive.wheelbaseCm" in note for note in krs["declared"])


@requires_yourdfpy
def test_coincident_wheel_origins_yield_no_track_width(tmp_path: Path) -> None:
    # Both wheel joints omit <origin>, so their separation is zero: a 0 cm
    # track would be a garbage number, not a measurement.
    krs = krs_from_urdf(_write(tmp_path, "coincident.urdf", COINCIDENT_WHEEL_URDF))
    assert "wheelbaseCm" not in krs["drive"]
    assert any("drive.wheelbaseCm" in note for note in krs["declared"])


@requires_yourdfpy
def test_urdf_without_inertials_declares_the_missing_mass(tmp_path: Path) -> None:
    krs = krs_from_urdf(_write(tmp_path, "massless.urdf", MASSLESS_URDF))
    assert "massKg" not in krs
    assert any(note.startswith("massKg:") for note in krs["declared"])


@requires_yourdfpy
def test_wheel_without_round_geometry_declares_the_missing_radius(tmp_path: Path) -> None:
    krs = krs_from_urdf(_write(tmp_path, "boxwheel.urdf", BOX_WHEEL_URDF))
    assert "wheelRadiusCm" not in krs["drive"]
    assert any("drive.wheelRadiusCm" in note for note in krs["declared"])


@requires_yourdfpy
def test_spherical_wheel_geometry_still_yields_a_radius(tmp_path: Path) -> None:
    # Ball casters are modelled as spheres, not cylinders; the radius is
    # readable either way and must not be declared as missing.
    krs = krs_from_urdf(_write(tmp_path, "sphere.urdf", SPHERE_WHEEL_URDF))
    assert krs["drive"]["wheelRadiusCm"] == 3.5
    assert not any("drive.wheelRadiusCm" in note for note in krs["declared"])


@requires_yourdfpy
def test_wheel_count_above_the_krs_maximum_is_capped_and_declared(tmp_path: Path) -> None:
    # specschema.js caps drive.motorCount at 8; emitting 10 would fail import
    # validation on the web side.
    krs = krs_from_urdf(_write(tmp_path, "many.urdf", _many_wheel_urdf(10)))
    assert krs["drive"]["motorCount"] == 8
    assert any("capped at the KRS maximum of 8" in note for note in krs["declared"])


@requires_yourdfpy
def test_arm_urdf_is_classified_as_an_arm_and_gets_no_drive_block() -> None:
    spec = spec_from_urdf(load_urdf(FIXTURES / "kuka_iiwa.urdf"))
    assert spec.wheel_count == 0
    assert spec.actuated_joint_count == 7
    assert spec.looks_like_arm is True
    assert spec.looks_like_rover is False

    krs = krs_from_urdf(FIXTURES / "kuka_iiwa.urdf")
    assert "drive" not in krs
    assert any(note.startswith("drive:") for note in krs["declared"])


# ---- joint origin guard ------------------------------------------------------


@dataclass
class _StubJoint:
    origin: Any


def test_joint_origin_of_an_unreadable_matrix_is_none_not_a_crash() -> None:
    # A model whose origin is not a 4x4 matrix must degrade to "unknown" so
    # the caller declares the omission instead of raising mid-conversion.
    assert _joint_origin_xyz(_StubJoint(origin="ab")) is None
    assert _joint_origin_xyz(_StubJoint(origin=[[0, 0, 0, "x"], [0], [0]])) is None


def test_joint_without_an_origin_is_treated_as_the_identity() -> None:
    assert _joint_origin_xyz(_StubJoint(origin=None)) == (0.0, 0.0, 0.0)


@dataclass
class _StubWheelJoint:
    parent: str
    origin: Any


def test_wheelbase_of_two_wheels_with_unreadable_origins_is_none() -> None:
    # Two same-parent wheels is the one case the converter WILL measure, so
    # the origin guard has to hold there too rather than raising on bad data.
    pair = [
        _StubWheelJoint(parent="base_link", origin="not a matrix"),
        _StubWheelJoint(parent="base_link", origin="not a matrix"),
    ]
    assert _wheelbase_cm(pair) is None
