"""KRS -> URDF export: the 'graduate to ROS' bridge (offline, dependency-light)."""

from __future__ import annotations

import xml.etree.ElementTree as ET

from robolearn.interop.urdf_io import build_urdf_from_spec, kodro_spec_from_krs


def _krs(**over: object) -> dict[str, object]:
    base: dict[str, object] = {
        "kodroSpec": "2.0",
        "name": "My Rover 2",
        "type": "rover",
        "massKg": 1.2,
        "drive": {"motorCount": 4, "wheelRadiusCm": 3.5},
    }
    base.update(over)
    return base


def test_krs_converts_to_spec_with_expected_fields() -> None:
    spec = kodro_spec_from_krs(_krs())
    assert spec.name == "My_Rover_2"  # sanitised: no spaces
    assert spec.mass_kg == 1.2
    assert spec.wheel_count == 4
    assert spec.wheel_radius_m == 0.035  # cm -> m
    assert spec.looks_like_rover is True


def test_build_urdf_is_wellformed_and_has_the_wheels() -> None:
    spec = kodro_spec_from_krs(_krs())
    urdf = build_urdf_from_spec(spec)
    root = ET.fromstring(urdf)  # raises on malformed XML
    assert root.tag == "robot"
    assert root.attrib["name"] == "My_Rover_2"
    links = [ln.attrib["name"] for ln in root.findall("link")]
    joints = root.findall("joint")
    assert "base_link" in links
    assert len([n for n in links if n.startswith("wheel_")]) == 4
    assert len(joints) == 4
    assert all(j.attrib["type"] == "continuous" for j in joints)


def test_massless_spec_falls_back_to_default_mass() -> None:
    spec = kodro_spec_from_krs({"name": "x", "drive": {"motorCount": 2}})
    assert spec.mass_kg == 0.9  # documented fallback
    assert build_urdf_from_spec(spec)  # still builds


def test_wheelless_build_is_not_a_rover() -> None:
    spec = kodro_spec_from_krs(_krs(drive={"motorCount": 0}))
    assert spec.wheel_count == 0
    assert spec.looks_like_rover is False
