"""The console scripts declared in pyproject.toml point where they claim to.

An entry point is only exercised at install time, so a wrong target survives
every test run and only shows up when somebody types the command. That is
exactly the wrong moment: the first person to type ``kodro`` is a new user or
a marker watching a demonstration.

Each declared target is imported and checked for a callable ``main``, so a
renamed or deleted function fails here rather than in a shell.
"""

from __future__ import annotations

import importlib
import tomllib
from pathlib import Path

import pytest

import kodro

_PYPROJECT = Path(kodro.__file__).resolve().parents[2] / "pyproject.toml"
_SCRIPTS: dict[str, str] = tomllib.loads(_PYPROJECT.read_text(encoding="utf-8"))["project"][
    "scripts"
]


def test_pyproject_is_where_this_test_thinks_it_is() -> None:
    # The path is derived from the package location, so a layout change would
    # otherwise make every assertion below vacuous.
    assert _PYPROJECT.is_file()
    assert _SCRIPTS


@pytest.mark.parametrize("script", sorted(_SCRIPTS))
def test_every_console_script_target_exists_and_is_callable(script: str) -> None:
    module_path, _, attribute = _SCRIPTS[script].partition(":")
    module = importlib.import_module(module_path)
    assert callable(getattr(module, attribute)), f"{script} -> {_SCRIPTS[script]}"


def test_the_product_name_launches_the_product() -> None:
    # Regression: `kodro` used to launch the headless batch runner, so typing
    # the name of the application started something that is not the
    # application.
    assert _SCRIPTS["kodro"] == "kodro.__main__:main"
    assert _SCRIPTS["kodro"] == "kodro.__main__:main"


def test_the_batch_runner_keeps_a_name_of_its_own() -> None:
    assert _SCRIPTS["kodro-bench"] == "kodro.bench:main"


def test_non_ui_tools_share_one_prefix() -> None:
    # kodro-bench, kodro-mcp and kodro-prove are the headless surfaces. A new
    # tool that skips the prefix makes the command set unguessable.
    non_ui = {name for name in _SCRIPTS if name not in {"kodro", "kodrobench"}}
    assert non_ui, "expected at least one headless tool"
    for name in non_ui:
        assert name.startswith("kodro-"), name
