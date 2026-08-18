"""Tests for the Gymnasium KodroEnv-v0 wrapper (kodro.envs, OPP-3).

Skips cleanly when gymnasium is not installed (the ``rl`` extra), so CI
without the extra collects zero failures from this module.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest

pytest.importorskip("gymnasium")

import gymnasium as gym
import numpy as np

from kodro.envs import ENV_ID, KodroEnv, register_env
from kodro.envs.kodro_env import (
    ACTION_FORWARD,
    ACTION_MEANINGS,
    COLLISION_PENALTY,
    FORWARD_STEP_M,
)

if TYPE_CHECKING:
    from collections.abc import Sequence

    from numpy.typing import NDArray

GOLDEN_SEED = 7

# Collision-free 20-action script: three left turns (45 degrees north-east),
# a long forward run past the obstacle band, three right turns back east,
# more forward. Measured on seed 7: 13 forward steps x 0.25 m, 0 collisions.
CLEAN_SCRIPT: tuple[int, ...] = (2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 0, 1)
CLEAN_GOLDEN_RETURN = 3.25

# Colliding 20-action script: drives east from the base straight into the
# seed-7 obstacle band and keeps ramming it. Measured on seed 7: 11
# collisions, 0.6450506434557394 m travelled.
WEAVE_SCRIPT: tuple[int, ...] = (1, 1, 1, 2, 1, 1, 3, 1, 0, 1, 2, 2, 1, 1, 1, 3, 1, 1, 0, 1)
WEAVE_GOLDEN_RETURN = -10.35494935654426


def _rollout(
    seed: int, actions: Sequence[int]
) -> tuple[list[NDArray[np.float64]], float, dict[str, Any]]:
    """Drive a fresh KodroEnv through ``actions`` and collect the trajectory."""
    env = KodroEnv()
    obs, info = env.reset(seed=seed)
    observations = [obs]
    total = 0.0
    for action in actions:
        obs, reward, terminated, truncated, info = env.step(action)
        observations.append(obs)
        total += float(reward)
        if terminated or truncated:
            break
    env.close()
    return observations, total, info


def test_env_registers_and_gym_make_works() -> None:
    assert ENV_ID in gym.registry
    register_env()  # double registration must not raise
    env = gym.make(ENV_ID)
    try:
        assert isinstance(env.unwrapped, KodroEnv)
        obs, info = env.reset(seed=0)
        assert obs.shape == (5,)
        assert info["seed"] == 0
    finally:
        env.close()


def test_deterministic_episode_identical_across_envs() -> None:
    obs_a, return_a, info_a = _rollout(123, WEAVE_SCRIPT)
    obs_b, return_b, info_b = _rollout(123, WEAVE_SCRIPT)
    assert return_a == return_b
    assert info_a == info_b
    assert len(obs_a) == len(obs_b) == len(WEAVE_SCRIPT) + 1
    for step_a, step_b in zip(obs_a, obs_b, strict=True):
        assert np.array_equal(step_a, step_b)


def test_golden_return_collision_free_script() -> None:
    _, total, info = _rollout(GOLDEN_SEED, CLEAN_SCRIPT)
    assert total == CLEAN_GOLDEN_RETURN
    assert info["collisions"] == 0
    assert info["distance_m"] == CLEAN_GOLDEN_RETURN


def test_golden_return_colliding_script() -> None:
    _, total, info = _rollout(GOLDEN_SEED, WEAVE_SCRIPT)
    assert total == WEAVE_GOLDEN_RETURN
    assert info["collisions"] == 11
    assert info["distance_m"] == 0.6450506434557394


def test_spaces_contract() -> None:
    env = KodroEnv()
    try:
        assert isinstance(env.action_space, gym.spaces.Discrete)
        assert env.action_space.n == len(ACTION_MEANINGS) == 4
        assert isinstance(env.observation_space, gym.spaces.Box)
        assert env.observation_space.shape == (5,)
        obs, _ = env.reset(seed=3)
        assert env.observation_space.contains(obs)
        for action in range(4):
            obs, _, _, _, _ = env.step(action)
            assert env.observation_space.contains(obs)
    finally:
        env.close()


def test_forward_step_reward_matches_progress() -> None:
    env = KodroEnv()
    try:
        env.reset(seed=0)
        obs, reward, _, _, info = env.step(ACTION_FORWARD)
        # From the base, driving east on seed 0 is unobstructed: reward is
        # exactly the metres travelled and no collision penalty applies.
        assert float(reward) == pytest.approx(FORWARD_STEP_M)
        assert info["collisions"] == 0
        assert COLLISION_PENALTY == 1.0
        assert obs[0] == pytest.approx(FORWARD_STEP_M)
    finally:
        env.close()


def test_step_before_reset_raises() -> None:
    env = KodroEnv()
    with pytest.raises(RuntimeError, match="reset"):
        env.step(ACTION_FORWARD)
    env.close()


def test_invalid_action_raises() -> None:
    env = KodroEnv()
    try:
        env.reset(seed=0)
        with pytest.raises(ValueError, match="invalid action"):
            env.step(99)
    finally:
        env.close()
