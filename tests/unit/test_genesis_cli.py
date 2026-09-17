"""CLI coverage for the Genesis experiment tool (kodro.genesis).

test_genesis.py covers the library surface (ranking, determinism,
diagnosis, budgets). This file covers the ``main()`` entry point: file
outputs, exit codes, and the validation paths that must fail loudly
rather than silently run a meaningless batch.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from kodro.genesis import main

GOOD_SOURCE = "move_forward(3)\n"
BROKEN_SOURCE = Path("tests/fixtures/broken_controller.py").read_text(encoding="utf-8")
FAST = ["--contract", "straight_transit", "--runs", "1", "--seed-root", "4046"]


def _write(path: Path, text: str) -> str:
    path.write_text(text, encoding="utf-8")
    return str(path)


def test_cli_names_winner_and_writes_manifest_and_report(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    good = _write(tmp_path / "good.py", GOOD_SOURCE)
    broken = _write(tmp_path / "broken.py", BROKEN_SOURCE)
    manifest = tmp_path / "experiment.json"
    report = tmp_path / "report.md"
    code = main(
        [
            "--candidate",
            f"good={good}",
            "--candidate",
            f"broken={broken}",
            "--manifest",
            str(manifest),
            "--report",
            str(report),
            *FAST,
        ]
    )
    assert code == 0
    assert "Winner: **good**" in capsys.readouterr().out
    experiment = json.loads(manifest.read_text(encoding="utf-8"))
    assert experiment["schema"] == "kodro.genesis-experiment/1"
    assert experiment["winner"] == "good"
    assert "Kinematic simulation evidence only" in report.read_text(encoding="utf-8")


def test_cli_exits_one_when_the_winner_fails(tmp_path: Path) -> None:
    broken = _write(tmp_path / "broken.py", BROKEN_SOURCE)
    assert main(["--candidate", f"broken={broken}", *FAST]) == 1


def test_cli_rejects_an_unknown_contract(tmp_path: Path) -> None:
    good = _write(tmp_path / "good.py", GOOD_SOURCE)
    with pytest.raises(SystemExit) as exc:
        main(["--candidate", f"good={good}", "--contract", "not_a_contract", *FAST])
    assert exc.value.code == 2


def test_cli_requires_at_least_one_candidate() -> None:
    with pytest.raises(SystemExit) as exc:
        main([*FAST])
    assert exc.value.code == 2


def test_cli_rejects_a_missing_candidate_file(tmp_path: Path) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--candidate", f"ghost={tmp_path / 'ghost.py'}", *FAST])
    assert exc.value.code == 2
