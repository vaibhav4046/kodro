"""Gymnasium environment over the robolearn engine (OPP-3).

:class:`KodroEnv` wraps the SAME deterministic engine that
:mod:`robolearn.bench` drives headlessly: the world comes from
``robolearn.bench._world_for_seed`` (the seeded obstacle-field domain
randomisation), motion goes through :class:`robolearn.engine.rover.Rover`,
and the forward proximity reading comes from
:func:`robolearn.engine.sensors.lidar_distance`. Nothing about physics,
battery drain, or collision handling is reimplemented here.

Action space (``Discrete(4)``), granularity derived from what bench programs
actually do (metre-scale moves, 90 degree turns) scaled down to per-step size:

* ``0`` noop, ``1`` forward :data:`FORWARD_STEP_M` metres (two steps cover
  bench's default 0.5 m pass distance), ``2`` turn left and ``3`` turn right
  by :data:`TURN_STEP_DEG` degrees (six steps make one bench-style 90 turn).

Observation (``Box(5,)`` float64, all values read from real engine state):
``[x_m, y_m, heading_deg, battery_pct, forward_proximity_m]`` where proximity
is the closed-form LIDAR distance capped at its maximum range.

Reward mirrors :func:`robolearn.bench.run_seed`'s success criterion (travel
distance, zero collisions): each step earns the distance actually travelled in
metres minus :data:`COLLISION_PENALTY` per collision registered that step. The
episode terminates when the battery is depleted; truncation at
:data:`MAX_EPISODE_STEPS` comes from the ``TimeLimit`` wrapper attached at
registration time.

Determinism contract: ``reset(seed=s)`` rebuilds the seed-``s`` bench world
and a fresh rover at its base, so the same seed always yields the identical
initial observation, and ``step`` is a pure function of (state, action).

KodroBench integration note: a later KodroBench layer can drive this exact
environment by id, ``gymnasium.make("robolearn/KodroEnv-v0")``, after
importing :mod:`robolearn.envs` (which registers the id); no change to
:mod:`robolearn.kodrobench` is required for that.
"""

from __future__ import annotations

import math
from typing import Any, SupportsFloat

try:
    import gymnasium as gym
    import numpy as np
    from gymnasium import spaces
    from numpy.typing import NDArray
except ImportError as exc:  # pragma: no cover - exercised only without the extra
    raise ImportError(
        "robolearn.envs requires the optional 'gymnasium' dependency (which "
        "brings numpy). Install it with: pip install 'robolearn[rl]'"
    ) from exc

from robolearn.bench import _world_for_seed
from robolearn.engine.rover import Rover
from robolearn.engine.sensors import LIDAR_MAX_RANGE_M, lidar_distance

#: Registered environment id (``gymnasium.make(ENV_ID)``).
ENV_ID: str = "robolearn/KodroEnv-v0"

#: Metres driven per forward action. Half of bench's default 0.5 m
#: ``min_distance`` pass threshold, so success-scale movement takes two steps.
FORWARD_STEP_M: float = 0.25

#: Degrees rotated per turn action. One sixth of the 90 degree turns the
#: bench's canned programs use, fine enough for stepwise control.
TURN_STEP_DEG: float = 15.0

#: Reward subtracted per collision registered during a step, mirroring the
#: bench criterion that a single collision fails a run.
COLLISION_PENALTY: float = 1.0

#: Step budget enforced by the ``TimeLimit`` wrapper added at registration.
MAX_EPISODE_STEPS: int = 200

#: Discrete action ids, in ``action_space`` order.
ACTION_NOOP: int = 0
ACTION_FORWARD: int = 1
ACTION_TURN_LEFT: int = 2
ACTION_TURN_RIGHT: int = 3

#: Human-readable action names, indexed by action id.
ACTION_MEANINGS: tuple[str, str, str, str] = ("noop", "forward", "turn_left", "turn_right")

#: Default world seed used when ``reset`` has never been given one.
_DEFAULT_SEED: int = 0


class KodroEnv(gym.Env[NDArray[np.float64], int | np.integer[Any]]):
    """Discrete-action Gymnasium wrapper around the bench obstacle-field world.

    Each ``reset(seed=s)`` rebuilds the exact world :mod:`robolearn.bench`
    would use for seed ``s`` and places a fresh :class:`Rover` at its base
    station. See the module docstring for spaces, reward, and the
    determinism contract. No render modes are offered; the base class default
    ``metadata`` already says so.
    """

    def __init__(self) -> None:
        """Build the action and observation spaces from real engine bounds."""
        bounds = _world_for_seed(_DEFAULT_SEED).bounds
        self.action_space: spaces.Space[int | np.integer[Any]] = spaces.Discrete(
            len(ACTION_MEANINGS)
        )
        self.observation_space: spaces.Space[NDArray[np.float64]] = spaces.Box(
            low=np.zeros(5, dtype=np.float64),
            high=np.array(
                [bounds.width, bounds.height, 360.0, 100.0, LIDAR_MAX_RANGE_M],
                dtype=np.float64,
            ),
            dtype=np.float64,
        )
        self._world_seed: int = _DEFAULT_SEED
        self._rover: Rover | None = None

    def reset(
        self,
        *,
        seed: int | None = None,
        options: dict[str, Any] | None = None,
    ) -> tuple[NDArray[np.float64], dict[str, Any]]:
        """Rebuild the seeded bench world and return the initial observation.

        Args:
            seed: World seed. The same seed always produces the identical
                initial state. When ``None``, the most recent seed is reused
                (initially :data:`_DEFAULT_SEED`), keeping replays exact.
            options: Unused, accepted for Gymnasium API compatibility.

        Returns:
            The initial observation and an info dict of engine state.
        """
        super().reset(seed=seed, options=options)
        if seed is not None:
            self._world_seed = seed
        world = _world_for_seed(self._world_seed)
        self._rover = Rover(world)
        return self._observation(self._rover), self._info(self._rover)

    def step(
        self, action: int | np.integer[Any]
    ) -> tuple[NDArray[np.float64], SupportsFloat, bool, bool, dict[str, Any]]:
        """Apply one discrete action through the real engine.

        Args:
            action: One of :data:`ACTION_NOOP`, :data:`ACTION_FORWARD`,
                :data:`ACTION_TURN_LEFT`, :data:`ACTION_TURN_RIGHT`.

        Returns:
            The Gymnasium ``(observation, reward, terminated, truncated,
            info)`` tuple. Reward is metres actually travelled this step
            minus :data:`COLLISION_PENALTY` per collision registered this
            step. The episode terminates when the battery is depleted.

        Raises:
            RuntimeError: If called before :meth:`reset`.
            ValueError: If ``action`` is outside the action space.
        """
        rover = self._require_rover()
        if not self.action_space.contains(action):
            raise ValueError(f"invalid action {action!r}; expected 0..{len(ACTION_MEANINGS) - 1}")
        state = rover.state
        distance_before = state.distance_travelled_m
        collisions_before = state.collisions

        act = int(action)
        if act == ACTION_FORWARD:
            rover.move(FORWARD_STEP_M)
        elif act == ACTION_TURN_LEFT:
            rover.turn(TURN_STEP_DEG)
        elif act == ACTION_TURN_RIGHT:
            rover.turn(-TURN_STEP_DEG)
        # ACTION_NOOP deliberately changes nothing.

        progress_m = state.distance_travelled_m - distance_before
        new_collisions = state.collisions - collisions_before
        reward = progress_m - COLLISION_PENALTY * new_collisions
        terminated = state.battery_pct <= 0.0
        return self._observation(rover), reward, terminated, False, self._info(rover)

    # --- internals ------------------------------------------------------------

    def _require_rover(self) -> Rover:
        if self._rover is None:
            raise RuntimeError("KodroEnv.step() called before reset(); call reset(seed=...) first")
        return self._rover

    def _observation(self, rover: Rover) -> NDArray[np.float64]:
        """Read ``[x, y, heading, battery, forward proximity]`` off the engine."""
        state = rover.state
        proximity = lidar_distance(rover)
        if math.isinf(proximity):
            proximity = LIDAR_MAX_RANGE_M
        return np.array(
            [
                state.x,
                state.y,
                state.heading_deg,
                state.battery_pct,
                min(proximity, LIDAR_MAX_RANGE_M),
            ],
            dtype=np.float64,
        )

    def _info(self, rover: Rover) -> dict[str, Any]:
        """Mirror the engine quantities bench reports per run."""
        state = rover.state
        return {
            "seed": self._world_seed,
            "collisions": state.collisions,
            "distance_m": state.distance_travelled_m,
            "battery_pct": state.battery_pct,
        }


def register_env() -> None:
    """Register :data:`ENV_ID` with Gymnasium; safe to call more than once."""
    if ENV_ID in gym.registry:
        return
    gym.register(
        id=ENV_ID,
        entry_point="robolearn.envs.kodro_env:KodroEnv",
        max_episode_steps=MAX_EPISODE_STEPS,
    )
