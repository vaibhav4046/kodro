"""Gymnasium environments over the kodro engine.

Importing this package registers ``kodro/KodroEnv-v0`` with Gymnasium
(the registration is guarded, so importing twice never raises). The core
:mod:`kodro` package never imports this subpackage, so a base install
without the ``rl`` extra keeps working; importing :mod:`kodro.envs`
without gymnasium raises a clear :class:`ImportError` naming the extra.
"""

from __future__ import annotations

from kodro.envs.kodro_env import ENV_ID, KodroEnv, register_env

register_env()

__all__ = ("ENV_ID", "KodroEnv", "register_env")
