"""First-run welcome wizard.

Section 8.2 of the spec asks for a four-step intake dialog on first
launch: pupil display name, age band, key stage, and starting terrain.
The wizard exposes its result as a :class:`WizardResult` dataclass so
the parent UI can persist the answers to ``~/.robolearn/config.toml``.

Implemented in Task 18 of the build plan.
"""

from __future__ import annotations

import tkinter as tk
from collections.abc import Callable
from dataclasses import dataclass
from tkinter import ttk

from robolearn.engine.terrain import Terrain

#: Step identifiers used by :class:`WelcomeWizard`.
StepId = int  # 0..3 -- mapped to the four labelled frames

#: Age bands offered on the first step. Maps to dropdown values.
AGE_BANDS: tuple[str, ...] = ("11-12", "13-14", "15-16", "17-18")

#: Key stages offered on the third step.
KEY_STAGES: tuple[str, ...] = ("KS3", "KS4")


@dataclass(slots=True)
class WizardResult:
    """The four answers the pupil submits."""

    display_name: str
    age_band: str
    key_stage: str
    terrain: Terrain


class WelcomeWizard:
    """Modal first-run wizard."""

    def __init__(
        self,
        parent: tk.Misc,
        *,
        on_complete: Callable[[WizardResult], None] | None = None,
    ) -> None:
        """Build the wizard."""
        self._on_complete = on_complete
        self._window = tk.Toplevel(parent)
        self._window.title("Welcome to RoboLearn")
        self._window.transient(parent.winfo_toplevel())
        self._result: WizardResult | None = None
        self._step: StepId = 0

        self._name_var = tk.StringVar(master=self._window, value="")
        self._age_var = tk.StringVar(master=self._window, value=AGE_BANDS[0])
        self._stage_var = tk.StringVar(master=self._window, value=KEY_STAGES[0])
        self._terrain_var = tk.StringVar(master=self._window, value=Terrain.EARTH.value)

        self._frames: list[ttk.Frame] = []
        self._buttons: dict[str, ttk.Button] = {}
        self._build_ui()
        self._show_step(0)

    # --- public API ---------------------------------------------------------

    @property
    def step(self) -> StepId:
        """Return the current step index."""
        return self._step

    @property
    def result(self) -> WizardResult | None:
        """Return the wizard result, or ``None`` until :meth:`finish` runs."""
        return self._result

    def set_display_name(self, name: str) -> None:
        """Programmatically set the display-name field (used by tests)."""
        self._name_var.set(name)

    def set_age_band(self, band: str) -> None:
        """Programmatically set the age-band field (used by tests)."""
        self._age_var.set(band)

    def set_key_stage(self, stage: str) -> None:
        """Programmatically set the key-stage field (used by tests)."""
        self._stage_var.set(stage)

    def set_terrain(self, terrain: Terrain | str) -> None:
        """Programmatically set the terrain field (used by tests)."""
        value = terrain.value if isinstance(terrain, Terrain) else terrain
        self._terrain_var.set(value)

    def next_step(self) -> None:
        """Advance to the next step (or finish on the last step)."""
        if self._step >= len(self._frames) - 1:
            self.finish()
            return
        self._show_step(self._step + 1)

    def back_step(self) -> None:
        """Return to the previous step (no-op on the first step)."""
        if self._step <= 0:
            return
        self._show_step(self._step - 1)

    def finish(self) -> None:
        """Capture the answers and fire ``on_complete``."""
        self._result = WizardResult(
            display_name=self._name_var.get().strip() or "Pupil",
            age_band=self._age_var.get(),
            key_stage=self._stage_var.get(),
            terrain=Terrain(self._terrain_var.get()),
        )
        if self._on_complete is not None:
            self._on_complete(self._result)
        self.destroy()

    def cancel(self) -> None:
        """Close the wizard without producing a result."""
        self._result = None
        self.destroy()

    def destroy(self) -> None:
        """Close the wizard window."""
        self._window.destroy()

    # --- private ------------------------------------------------------------

    def _build_ui(self) -> None:
        outer = ttk.Frame(self._window, padding=12)
        outer.pack(fill=tk.BOTH, expand=True)
        self._frames = [
            self._build_step_name(outer),
            self._build_step_age(outer),
            self._build_step_stage(outer),
            self._build_step_terrain(outer),
        ]
        nav = ttk.Frame(outer)
        nav.pack(side=tk.BOTTOM, fill=tk.X, pady=(8, 0))
        back = ttk.Button(nav, text="Back", command=self.back_step)
        back.pack(side=tk.LEFT)
        next_btn = ttk.Button(nav, text="Next", command=self.next_step)
        next_btn.pack(side=tk.RIGHT)
        cancel = ttk.Button(nav, text="Cancel", command=self.cancel)
        cancel.pack(side=tk.RIGHT, padx=(0, 4))
        self._buttons = {"back": back, "next": next_btn, "cancel": cancel}

    def _build_step_name(self, parent: ttk.Frame) -> ttk.Frame:
        frame = ttk.Frame(parent)
        ttk.Label(frame, text="What should the simulator call you?").pack(anchor=tk.W)
        entry = ttk.Entry(frame, textvariable=self._name_var, width=32)
        entry.pack(fill=tk.X, pady=4)
        ttk.Label(
            frame,
            text="(Your name stays on this machine. No accounts. No cloud.)",
            foreground="#8b949e",
        ).pack(anchor=tk.W)
        return frame

    def _build_step_age(self, parent: ttk.Frame) -> ttk.Frame:
        frame = ttk.Frame(parent)
        ttk.Label(frame, text="Which age band are you in?").pack(anchor=tk.W)
        for band in AGE_BANDS:
            ttk.Radiobutton(frame, text=band, value=band, variable=self._age_var).pack(anchor=tk.W)
        return frame

    def _build_step_stage(self, parent: ttk.Frame) -> ttk.Frame:
        frame = ttk.Frame(parent)
        ttk.Label(frame, text="Which key stage best matches your learning?").pack(anchor=tk.W)
        for stage in KEY_STAGES:
            ttk.Radiobutton(frame, text=stage, value=stage, variable=self._stage_var).pack(
                anchor=tk.W
            )
        return frame

    def _build_step_terrain(self, parent: ttk.Frame) -> ttk.Frame:
        frame = ttk.Frame(parent)
        ttk.Label(frame, text="Where would you like to start?").pack(anchor=tk.W)
        for terrain in Terrain:
            ttk.Radiobutton(
                frame,
                text=terrain.value.capitalize(),
                value=terrain.value,
                variable=self._terrain_var,
            ).pack(anchor=tk.W)
        return frame

    def _show_step(self, index: StepId) -> None:
        for frame in self._frames:
            frame.pack_forget()
        self._frames[index].pack(fill=tk.BOTH, expand=True)
        self._step = index
        on_last = index == len(self._frames) - 1
        self._buttons["next"].configure(text="Finish" if on_last else "Next")
        self._buttons["back"].configure(state=("disabled" if index == 0 else "normal"))
