"""Interoperability layer: URDF import/export and other robotics exchange formats.

This subpackage is researcher-facing rather than pupil-facing, so unlike
:mod:`robolearn.rover_api` it raises on invalid input instead of clamping.
Third-party parsers (``yourdfpy``, ``urdf_parser_py``) are imported lazily so
the core offline app keeps working when the ``interop`` extra is not
installed.
"""

from .urdf_io import (
    KodroRobotSpec,
    UrdfStructure,
    build_urdf_from_spec,
    export_urdf,
    load_urdf,
    ros_parity_structure,
    spec_from_urdf,
    structure_of,
)

__all__ = (
    "KodroRobotSpec",
    "UrdfStructure",
    "build_urdf_from_spec",
    "export_urdf",
    "load_urdf",
    "ros_parity_structure",
    "spec_from_urdf",
    "structure_of",
)
