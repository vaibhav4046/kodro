"""Decision journal records choices; it never claims avoided impact."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from kodro.journal import log_event, main, make_event, read_all, summarize


def test_make_event_rejects_bad_inputs() -> None:
    with pytest.raises(ValueError):
        make_event("maybe", "rover v3")
    with pytest.raises(ValueError):
        make_event("deferred", "   ")
    with pytest.raises(ValueError):
        make_event("built", "rover v3", earthproof_fingerprint="xyz")


def test_log_and_summarize_round_trip(tmp_path: Path) -> None:
    log = tmp_path / "decisions.jsonl"
    log_event(
        log,
        {
            "decision": "deferred",
            "design": "rover v3",
            "proof_verdict": "pass 5/5",
            "earthproof_fingerprint": "1" * 64,
            "note": "waiting on battery stock",
        },
    )
    log_event(log, {"decision": "built", "design": "rover v2"})
    records = read_all(log)
    assert len(records) == 2
    assert records[0]["schema"] == "kodro-decision/v1"
    summary = summarize(log)
    assert summary["events"] == 2
    assert summary["by_decision"] == {
        "built": 1,
        "deferred": 1,
        "rejected": 0,
    }
    assert summary["designs_seen"] == 2
    assert summary["events_citing_earthproof"] == 1
    assert "not measured environmental savings" in str(summary["limitation"])


def test_read_all_refuses_corrupt_lines(tmp_path: Path) -> None:
    log = tmp_path / "decisions.jsonl"
    log.write_text('{"schema": "something-else"}\n', encoding="utf-8")
    with pytest.raises(ValueError):
        read_all(log)


def test_cli_log_and_summary(tmp_path: Path, capsys) -> None:
    log = tmp_path / "decisions.jsonl"
    assert (
        main(
            [
                "log",
                "--log",
                str(log),
                "--decision",
                "rejected",
                "--design",
                "arm v1",
                "--verdict",
                "fail 2/5",
            ]
        )
        == 0
    )
    out = capsys.readouterr().out
    assert json.loads(out)["decision"] == "rejected"
    assert main(["summary", "--log", str(log)]) == 0
    summary = json.loads(capsys.readouterr().out)
    assert summary["events"] == 1
    assert summary["by_decision"]["rejected"] == 1


def test_summary_of_missing_log_is_empty(tmp_path: Path) -> None:
    summary = summarize(tmp_path / "nothing-here.jsonl")
    assert summary["events"] == 0
