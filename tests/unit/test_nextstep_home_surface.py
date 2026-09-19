"""Home landing must expose the NextStep EarthProof entry within the first screen."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOME = ROOT / "src" / "kodro" / "assets" / "web" / "home.jsx"
REPORT = ROOT / "docs" / "eval" / "earthproof-comparison-report.json"


def test_home_exposes_earthproof_entry() -> None:
    """A judge landing cold must see EarthProof without opening menus."""
    home = HOME.read_text(encoding="utf-8")

    assert 'data-earthproof-home="entry"' in home
    assert "EarthProof" in home
    for word in ("Design", "Simulate", "Prove", "EarthProof", "Build"):
        assert word in home
    assert "CO2e not claimed" in home
    assert "illustrative scenario, not measured impact" in home


def test_home_matches_audited_comparison_numbers() -> None:
    """Home teaser must never drift from the audited Build evidence."""
    home = HOME.read_text(encoding="utf-8")
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    comparison = report["comparison"]

    baseline = comparison["baseline_operating_energy_kwh"]["central"]
    candidate = comparison["candidate_operating_energy_kwh"]["central"]
    change = comparison["central_operating_energy_change_percent"]

    assert f"{baseline:.3f} kWh" in home
    assert f"{candidate:.3f} kWh" in home
    assert f"{change:.0f}%" in home
    assert comparison["claim_boundary"] in home
