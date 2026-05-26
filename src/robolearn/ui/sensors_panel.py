"""Live sensors readout: distance, battery, heading, colour, LIDAR sweep.

The :class:`SensorsPanel` is a passive widget; the parent UI calls
:meth:`update_from_rover` after each engine step. No timers, no
background threads -- this keeps the panel trivial to test headlessly.

Implemented in Task 14 of the build plan.
"""

from __future__ import annotations

import math
import tkinter as tk
from dataclasses import dataclass
from tkinter import ttk

from robolearn.engine.rover import Rover
from robolearn.engine.sensors import IMUReading, imu_reading, lidar_distance


@dataclass(slots=True)
class _SensorRows:
    """Tk variables backing each labelled readout row."""

    heading: tk.StringVar
    battery: tk.StringVar
    distance: tk.StringVar
    colour: tk.StringVar
    samples: tk.StringVar


class SensorsPanel(ttk.Frame):
    """Right-hand sensors strip: heading, battery, LIDAR distance, colour."""

    def __init__(self, parent: tk.Misc) -> None:
        """Build the panel widgets."""
        super().__init__(parent)
        self._rows = self._build_rows()

    # --- public API ---------------------------------------------------------

    def update_from_rover(self, rover: Rover) -> None:
        """Refresh every readout from ``rover``'s current state."""
        state = rover.state
        self._rows.heading.set(f"{state.heading_deg:6.1f}°")
        self._rows.battery.set(f"{state.battery_pct:6.1f}%")
        distance = lidar_distance(rover)
        self._rows.distance.set("∞" if math.isinf(distance) else f"{distance:6.2f} m")
        reading: IMUReading = imu_reading(rover)
        _ = reading  # currently displayed via heading row; reserved for future
        self._rows.samples.set(f"{state.samples_collected}")
        # Colour readout is the under-tile colour; lazy-evaluate here so the
        # panel never queries the world directly.
        from robolearn.engine.sensors import colour_under

        r, g, b = colour_under(rover)
        self._rows.colour.set(f"#{r:02x}{g:02x}{b:02x}")

    def clear(self) -> None:
        """Blank every readout (used between missions)."""
        self._rows.heading.set("--")
        self._rows.battery.set("--")
        self._rows.distance.set("--")
        self._rows.colour.set("--")
        self._rows.samples.set("--")

    # --- private ------------------------------------------------------------

    def _build_rows(self) -> _SensorRows:
        title = ttk.Label(self, text="Sensors", font=("TkDefaultFont", 10, "bold"))
        title.pack(side=tk.TOP, anchor=tk.W, padx=4, pady=2)
        heading = self._row("Heading")
        battery = self._row("Battery")
        distance = self._row("LIDAR")
        colour = self._row("Colour")
        samples = self._row("Samples")
        return _SensorRows(
            heading=heading,
            battery=battery,
            distance=distance,
            colour=colour,
            samples=samples,
        )

    def _row(self, label: str) -> tk.StringVar:
        var = tk.StringVar(master=self, value="--")
        row = ttk.Frame(self)
        row.pack(side=tk.TOP, fill=tk.X, padx=4, pady=1)
        ttk.Label(row, text=label, width=10).pack(side=tk.LEFT)
        ttk.Label(row, textvariable=var).pack(side=tk.LEFT, padx=4)
        return var
