"""URDF import/export.

Import path uses ``yourdfpy`` (fast, lenient, no ROS install needed); the
ROS-parity check re-parses the same document with ``urdf_parser_py`` (the
reference ROS parser) so a file Kodro accepts is also a file ROS accepts.

Round-trip contract (asserted by ``tests/unit/test_urdf_io.py``): for a
standard URDF, ``load_urdf`` -> ``export_urdf`` -> ``load_urdf`` preserves the
structural signature (link names, joint names/types/topology, inertial
masses). Geometry primitives and joint limits survive serialisation because
export delegates to yourdfpy's writer rather than re-emitting by hand.

Meshes referenced by standard URDFs are NOT loaded (``load_meshes=False``):
Kodro's 2D physics tier only needs masses, topology and wheel geometry, and
mesh files are typically absent when a bare ``.urdf`` is shared.
"""

from __future__ import annotations

import logging
import math
import re
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

#: Joint types that transmit actuation in a URDF document.
_ACTUATED_JOINT_TYPES: frozenset[str] = frozenset({"revolute", "continuous", "prismatic"})

#: KRS schema version emitted by :func:`krs_from_urdf` (specschema.js SCHEMA_VERSION).
_KRS_SCHEMA_VERSION: int = 1

#: Upper bound of the KRS ``drive.motorCount`` range (specschema.js RANGES).
_KRS_MAX_MOTOR_COUNT: int = 8

#: Substrings that mark a link/joint as a wheel in common URDF naming schemes.
_WHEEL_NAME_HINTS: tuple[str, ...] = ("wheel", "tyre", "tire", "caster")

_MISSING_YOURDFPY = (
    "yourdfpy is required for URDF import/export. Install the interop extra: "
    "pip install kodro[interop]"
)
_MISSING_ROS_PARSER = (
    "urdf_parser_py is required for the ROS parity check. Install the interop "
    "extra: pip install kodro[interop]"
)


def _require_yourdfpy() -> Any:
    try:
        import yourdfpy
    except ImportError as exc:  # pragma: no cover - exercised only without extra
        raise ImportError(_MISSING_YOURDFPY) from exc
    return yourdfpy


@dataclass(frozen=True, slots=True)
class KodroRobotSpec:
    """The Kodro-relevant parameters extracted from a URDF robot.

    These are the quantities the simulation actually consumes (see
    ``RobotLab.derive`` on the web side): total mass drives battery drain,
    motor count and wheel radius drive top speed, degrees of freedom tell the
    UI whether the robot is a rover, an arm, or something it cannot simulate
    yet.
    """

    name: str
    mass_kg: float
    link_count: int
    joint_count: int
    actuated_joint_count: int
    wheel_count: int
    wheel_radius_m: float | None
    degrees_of_freedom: int

    @property
    def looks_like_rover(self) -> bool:
        """True when the robot has at least two wheels to drive."""
        return self.wheel_count >= 2

    @property
    def looks_like_arm(self) -> bool:
        """True for a wheel-less kinematic chain with actuated joints."""
        return self.wheel_count == 0 and self.actuated_joint_count >= 2


@dataclass(frozen=True, slots=True)
class UrdfStructure:
    """Structural signature used to assert lossless round-trips."""

    name: str
    link_names: tuple[str, ...]
    joint_signature: tuple[tuple[str, str, str, str], ...]
    masses: tuple[tuple[str, float], ...]


def load_urdf(path: str | Path) -> Any:
    """Parse ``path`` into a ``yourdfpy.URDF`` model without loading meshes.

    Raises ``FileNotFoundError`` for a missing file and ``ValueError`` for a
    file that does not parse as URDF.
    """
    yourdfpy = _require_yourdfpy()
    file_path = Path(path)
    if not file_path.is_file():
        raise FileNotFoundError(f"URDF file not found: {file_path}")
    try:
        model = yourdfpy.URDF.load(
            str(file_path),
            load_meshes=False,
            load_collision_meshes=False,
            build_scene_graph=False,
            build_collision_scene_graph=False,
        )
    except Exception as exc:
        raise ValueError(f"not a parseable URDF document: {file_path}") from exc
    return model


def export_urdf(model: Any, path: str | Path) -> Path:
    """Serialise a ``yourdfpy.URDF`` model to ``path`` and return the path."""
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    model.write_xml_file(str(file_path))
    return file_path


def structure_of(model: Any) -> UrdfStructure:
    """Extract the structural signature of a parsed URDF model."""
    robot = model.robot
    link_names = tuple(sorted(link.name for link in robot.links))
    joint_signature = tuple(
        sorted((joint.name, joint.type, joint.parent, joint.child) for joint in robot.joints)
    )
    masses = tuple(
        sorted(
            (link.name, round(float(link.inertial.mass), 9))
            for link in robot.links
            if link.inertial is not None and link.inertial.mass is not None
        )
    )
    return UrdfStructure(
        name=robot.name,
        link_names=link_names,
        joint_signature=joint_signature,
        masses=masses,
    )


def ros_parity_structure(path: str | Path) -> UrdfStructure:
    """Parse ``path`` with ``urdf_parser_py`` (the ROS reference parser).

    Returning the same :class:`UrdfStructure` shape as :func:`structure_of`
    lets tests assert that what yourdfpy read is what ROS would read.
    """
    try:
        from urdf_parser_py import urdf as ros_urdf
    except ImportError as exc:  # pragma: no cover - exercised only without extra
        raise ImportError(_MISSING_ROS_PARSER) from exc

    file_path = Path(path)
    if not file_path.is_file():
        raise FileNotFoundError(f"URDF file not found: {file_path}")
    try:
        robot = ros_urdf.URDF.from_xml_string(file_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError(f"ROS parser rejected URDF document: {file_path}") from exc

    link_names = tuple(sorted(link.name for link in robot.links))
    joint_signature = tuple(
        sorted((joint.name, joint.type, joint.parent, joint.child) for joint in robot.joints)
    )
    masses = tuple(
        sorted(
            (link.name, round(float(link.inertial.mass), 9))
            for link in robot.links
            if link.inertial is not None and link.inertial.mass is not None
        )
    )
    return UrdfStructure(
        name=robot.name,
        link_names=link_names,
        joint_signature=joint_signature,
        masses=masses,
    )


def _is_wheel_name(name: str) -> bool:
    lowered = name.lower()
    return any(hint in lowered for hint in _WHEEL_NAME_HINTS)


def _wheel_radius_from_link(link: Any) -> float | None:
    """Best-effort wheel radius: first cylinder or sphere geometry on the link."""
    for geom_holder in (*link.collisions, *link.visuals):
        geometry = geom_holder.geometry
        if geometry is None:
            continue
        if geometry.cylinder is not None:
            return float(geometry.cylinder.radius)
        if geometry.sphere is not None:
            return float(geometry.sphere.radius)
    return None


def _wheel_joints(robot: Any) -> list[Any]:
    """Actuated joints whose own name or child link name looks like a wheel."""
    actuated = [joint for joint in robot.joints if joint.type in _ACTUATED_JOINT_TYPES]
    return [
        joint for joint in actuated if _is_wheel_name(joint.name) or _is_wheel_name(joint.child)
    ]


def spec_from_urdf(model: Any) -> KodroRobotSpec:
    """Reduce a URDF model to the parameters Kodro's simulation consumes."""
    robot = model.robot
    links_by_name = {link.name: link for link in robot.links}

    mass_kg = sum(
        float(link.inertial.mass)
        for link in robot.links
        if link.inertial is not None and link.inertial.mass is not None
    )

    actuated = [joint for joint in robot.joints if joint.type in _ACTUATED_JOINT_TYPES]
    wheel_joints = _wheel_joints(robot)

    wheel_radius_m: float | None = None
    for joint in wheel_joints:
        child = links_by_name.get(joint.child)
        if child is None:
            continue
        radius = _wheel_radius_from_link(child)
        if radius is not None:
            wheel_radius_m = radius
            break

    spec = KodroRobotSpec(
        name=robot.name,
        mass_kg=round(mass_kg, 9),
        link_count=len(robot.links),
        joint_count=len(robot.joints),
        actuated_joint_count=len(actuated),
        wheel_count=len(wheel_joints),
        wheel_radius_m=wheel_radius_m,
        degrees_of_freedom=len(actuated),
    )
    logger.debug("extracted %s from URDF '%s'", spec, robot.name)
    return spec


def build_urdf_from_spec(
    spec: KodroRobotSpec,
    *,
    chassis_length_m: float = 0.4,
    chassis_width_m: float = 0.3,
    chassis_height_m: float = 0.15,
) -> str:
    """Generate a differential-drive URDF document for a Kodro robot build.

    The output is a plain-primitive URDF (boxes and cylinders, no meshes) so
    it opens in any ROS/RViz/Gazebo toolchain. Wheel count below 2 still
    emits 2 wheels: a diff-drive body cannot exist with fewer.
    """
    if spec.mass_kg <= 0:
        raise ValueError(f"robot mass must be positive, got {spec.mass_kg}")
    wheel_count = max(2, spec.wheel_count)
    wheel_radius = spec.wheel_radius_m if spec.wheel_radius_m else 0.05
    if wheel_radius <= 0:
        raise ValueError(f"wheel radius must be positive, got {wheel_radius}")

    wheel_mass = round(0.05 * spec.mass_kg, 6)
    chassis_mass = round(spec.mass_kg - wheel_count * wheel_mass, 6)
    if chassis_mass <= 0:
        chassis_mass = round(spec.mass_kg * 0.5, 6)
        wheel_mass = round(spec.mass_kg * 0.5 / wheel_count, 6)

    def _box_inertia(mass: float, x: float, y: float, z: float) -> tuple[float, float, float]:
        return (
            round(mass / 12.0 * (y * y + z * z), 9),
            round(mass / 12.0 * (x * x + z * z), 9),
            round(mass / 12.0 * (x * x + y * y), 9),
        )

    def _cylinder_inertia(mass: float, radius: float, length: float) -> tuple[float, float, float]:
        lateral = round(mass * (3 * radius * radius + length * length) / 12.0, 9)
        axial = round(mass * radius * radius / 2.0, 9)
        return (lateral, lateral, axial)

    ixx, iyy, izz = _box_inertia(chassis_mass, chassis_length_m, chassis_width_m, chassis_height_m)
    wheel_len = round(wheel_radius * 0.4, 6)
    wixx, wiyy, wizz = _cylinder_inertia(wheel_mass, wheel_radius, wheel_len)
    chassis_box = f"{chassis_length_m} {chassis_width_m} {chassis_height_m}"

    parts: list[str] = [
        f'<robot name="{spec.name}">',
        '  <link name="base_link">',
        "    <inertial>",
        f'      <mass value="{chassis_mass}"/>',
        f'      <inertia ixx="{ixx}" ixy="0" ixz="0" iyy="{iyy}" iyz="0" izz="{izz}"/>',
        "    </inertial>",
        "    <visual>",
        f'      <geometry><box size="{chassis_box}"/></geometry>',
        "    </visual>",
        "    <collision>",
        f'      <geometry><box size="{chassis_box}"/></geometry>',
        "    </collision>",
        "  </link>",
    ]

    half_width = chassis_width_m / 2.0
    for index in range(wheel_count):
        side = 1.0 if index % 2 == 0 else -1.0
        rank = index // 2
        pair_count = max(1, math.ceil(wheel_count / 2))
        x_offset = round(
            (chassis_length_m * 0.6) * (rank / max(1, pair_count - 1) - 0.5)
            if pair_count > 1
            else 0.0,
            6,
        )
        y_offset = round(side * (half_width + wheel_len / 2.0), 6)
        axle_z = -chassis_height_m / 2.0
        parts += [
            f'  <link name="wheel_{index}_link">',
            "    <inertial>",
            f'      <mass value="{wheel_mass}"/>',
            f'      <inertia ixx="{wixx}" ixy="0" ixz="0" iyy="{wiyy}" iyz="0" izz="{wizz}"/>',
            "    </inertial>",
            "    <visual>",
            f'      <geometry><cylinder radius="{wheel_radius}" length="{wheel_len}"/></geometry>',
            "    </visual>",
            "    <collision>",
            f'      <geometry><cylinder radius="{wheel_radius}" length="{wheel_len}"/></geometry>',
            "    </collision>",
            "  </link>",
            f'  <joint name="wheel_{index}_joint" type="continuous">',
            '    <parent link="base_link"/>',
            f'    <child link="wheel_{index}_link"/>',
            f'    <origin xyz="{x_offset} {y_offset} {axle_z}" rpy="-1.5707963 0 0"/>',
            '    <axis xyz="0 0 1"/>',
            "  </joint>",
        ]

    parts.append("</robot>")
    return "\n".join(parts) + "\n"


def _safe_urdf_name(raw: str) -> str:
    """A URDF-safe robot name: letters, digits, underscores; never empty."""
    cleaned = re.sub(r"[^0-9A-Za-z_]+", "_", str(raw or "").strip()).strip("_")
    return cleaned or "kodro_robot"


def kodro_spec_from_krs(data: Mapping[str, Any]) -> KodroRobotSpec:
    """Convert an exported Kodro KRS spec (parsed JSON) into a KodroRobotSpec.

    Consumes exactly the fields the studio's exportKrs() writes: ``name``,
    ``massKg`` (or the ``derived.massG`` fallback) and the ``drive`` block's
    ``motorCount`` / ``wheelRadiusCm``. Everything the URDF needs is derived
    from those, so a build exported from the Robot Lab becomes a diff-drive
    URDF the user can open in ROS / RViz / Gazebo without rebuilding by hand.
    """
    derived = data.get("derived") if isinstance(data.get("derived"), Mapping) else {}
    mass_kg = data.get("massKg")
    if mass_kg is None:
        mass_g = derived.get("massG") if isinstance(derived, Mapping) else None
        mass_kg = (float(mass_g) / 1000.0) if mass_g else 0.9
    mass_kg = float(mass_kg)

    drive = data.get("drive") if isinstance(data.get("drive"), Mapping) else {}
    # Explicit None check: motorCount 0 is a real "no drive motors" (an arm),
    # not a missing field, so it must NOT default to 2 (`0 or 2` would).
    motor_count = drive.get("motorCount") if isinstance(drive, Mapping) else None
    wheel_count = max(0, int(motor_count)) if motor_count is not None else 2
    wr_cm = drive.get("wheelRadiusCm") if isinstance(drive, Mapping) else None
    wheel_radius_m = (float(wr_cm) / 100.0) if wr_cm else None

    return KodroRobotSpec(
        name=_safe_urdf_name(data.get("name") or "kodro_robot"),
        mass_kg=mass_kg,
        link_count=1 + wheel_count,
        joint_count=wheel_count,
        actuated_joint_count=wheel_count,
        wheel_count=wheel_count,
        wheel_radius_m=wheel_radius_m,
        degrees_of_freedom=wheel_count,
    )


def _joint_origin_xyz(joint: Any) -> tuple[float, float, float] | None:
    """Translation of a joint origin, or None when the matrix is unreadable.

    yourdfpy stores ``joint.origin`` as a 4x4 homogeneous matrix (translation
    in column 3); a missing ``<origin>`` tag is treated as the identity.
    """
    origin = getattr(joint, "origin", None)
    if origin is None:
        return (0.0, 0.0, 0.0)
    try:
        return (float(origin[0][3]), float(origin[1][3]), float(origin[2][3]))
    except (TypeError, IndexError, ValueError):
        return None


def _wheelbase_cm(wheel_joints: list[Any]) -> float | None:
    """Track width between exactly two same-parent wheel joints, in cm.

    Only the unambiguous case is derived: two wheel joints hanging off the
    same parent link, where the distance between their origins IS the track.
    Anything else (4+ wheels, mixed parents, unreadable origins) returns None
    so the caller records the omission instead of guessing.
    """
    if len(wheel_joints) != 2:
        return None
    first, second = wheel_joints
    if first.parent != second.parent:
        return None
    a = _joint_origin_xyz(first)
    b = _joint_origin_xyz(second)
    if a is None or b is None:
        return None
    separation_m = math.dist(a, b)
    if separation_m <= 0.0:
        return None
    return round(separation_m * 100.0, 6)


def krs_from_urdf(path: str | Path) -> dict[str, Any]:
    """Convert a URDF file into a KRS v1 physical-spec dict for the Robot Lab.

    The inverse bridge of :func:`build_urdf_from_spec`: a real robot described
    as URDF becomes an importable Kodro Robot Spec. Only quantities the URDF
    actually carries are emitted (mass from inertials, wheel radius from wheel
    geometry, motor count from actuated wheel joints, track width from wheel
    joint origins). Everything a bare URDF cannot express - motor rpm, torque
    and voltage, battery, sensors - is named in the ``declared`` notes list
    instead of being papered over with invented numbers. Without a
    ``drive.motor`` block specschema.js still validates the spec, and the Lab
    shows its honest "pick a motor" state.

    The ``declared`` key is a Python-side honesty record only: KRS reserves
    top-level ``declared`` for the {maxSpeedMps, runtimeMin} object, so the
    desktop bridge strips this list before handing the JSON to the web
    validator (an array there fails specschema.js validate()).

    Raises ``FileNotFoundError`` for a missing file, ``ValueError`` for a file
    that does not parse as URDF, and ``ImportError`` without the interop extra.
    """
    model = load_urdf(path)
    spec = spec_from_urdf(model)
    declared: list[str] = []

    krs: dict[str, Any] = {
        "kodroSpec": _KRS_SCHEMA_VERSION,
        "name": spec.name,
        "type": "rover",
    }

    if spec.mass_kg > 0:
        krs["massKg"] = spec.mass_kg
    else:
        declared.append("massKg: the URDF carries no inertial masses.")

    if spec.wheel_count >= 2:
        motor_count = spec.wheel_count
        if motor_count > _KRS_MAX_MOTOR_COUNT:
            declared.append(
                f"drive.motorCount: {motor_count} wheel joints found; "
                f"capped at the KRS maximum of {_KRS_MAX_MOTOR_COUNT}."
            )
            motor_count = _KRS_MAX_MOTOR_COUNT
        drive: dict[str, Any] = {"kind": "differential", "motorCount": motor_count}
        if spec.wheel_radius_m is not None:
            drive["wheelRadiusCm"] = round(spec.wheel_radius_m * 100.0, 6)
        else:
            declared.append("drive.wheelRadiusCm: no cylinder or sphere geometry on a wheel link.")
        wheelbase_cm = _wheelbase_cm(_wheel_joints(model.robot))
        if wheelbase_cm is not None:
            drive["wheelbaseCm"] = wheelbase_cm
        else:
            declared.append(
                "drive.wheelbaseCm: not derivable from wheel joint origins "
                "(needs exactly two wheel joints on the same parent link)."
            )
        krs["drive"] = drive
        declared.append(
            "drive.motor: a URDF carries no noLoadRpm/stallTorqueNm/nominalV; "
            "pick a motor in the Robot Lab."
        )
    else:
        declared.append("drive: fewer than two wheel joints found, so no drive block was emitted.")

    declared.append("battery: a URDF describes no battery (mAh/voltage).")
    declared.append("sensors: a bare URDF carries no Kodro sensor entries.")
    krs["declared"] = declared
    logger.debug("converted URDF '%s' to KRS: %s", spec.name, krs)
    return krs
