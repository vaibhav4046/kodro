"""Judge-facing NextStep surfaces must stay tied to the audited EarthProof evidence."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "src" / "kodro" / "assets" / "web" / "app.jsx"
README = ROOT / "README.md"
AUDIT = ROOT / "NEXTSTEP_2026.md"
SUBMISSION = ROOT / "NEXTSTEP_SUBMISSION.md"
REPORT = ROOT / "docs" / "eval" / "earthproof-comparison-report.json"


def test_build_surface_exposes_the_audited_earthproof_comparison() -> None:
    """A judge reaching Build must see EarthProof and the canonical demo values."""
    app = APP.read_text(encoding="utf-8")
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    comparison = report["comparison"]

    baseline = comparison["baseline_operating_energy_kwh"]["central"]
    candidate = comparison["candidate_operating_energy_kwh"]["central"]
    change = comparison["central_operating_energy_change_percent"]

    assert 'data-earthproof-nextstep="comparison"' in app
    assert "EarthProof" in app
    assert f"{baseline:.3f} kWh" in app
    assert f"{candidate:.3f} kWh" in app
    assert f"{change:.0f}%" in app
    assert "CO2e not claimed" in app
    assert "illustrative scenario, not measured impact" in app


def test_build_surface_preserves_the_report_claim_boundary() -> None:
    """The visual demo must never turn an energy delta into a carbon claim."""
    app = APP.read_text(encoding="utf-8")
    report = json.loads(REPORT.read_text(encoding="utf-8"))

    boundary = report["comparison"]["claim_boundary"]
    assert boundary in app
    assert report["claims"]["carbon"]["status"] == "not claimed"
    assert report["metrics"]["operational_emissions_kgco2e"] is None


def test_repository_first_impression_names_the_nextstep_innovation() -> None:
    """A cold judge opening GitHub should understand EarthProof above the fold."""
    top = README.read_text(encoding="utf-8")[:5000]

    assert "Kodro EarthProof" in top
    assert "NextStep Hacks 2026" in top
    assert "hardware decision point" in top
    assert "Design -> Simulate -> Prove -> EarthProof -> Build" in top
    assert "NEXTSTEP_SUBMISSION.md" in top


def test_core_pitch_frames_earthproof_as_the_prebuild_decision_gate() -> None:
    """The submission must make EarthProof the decision mechanism, not a green add-on."""
    submission = SUBMISSION.read_text(encoding="utf-8").lower()

    assert "pre-build evidence gate" in submission
    assert "justify building this version" in submission
    assert "not a sustainability dashboard" in submission


def test_nextstep_audit_describes_the_final_visible_judge_path() -> None:
    """The audit must describe the final baseline comparison and in-product surface."""
    audit = AUDIT.read_text(encoding="utf-8")

    assert "earthproof-baseline.json" in audit
    assert "earthproof-comparison-report.json" in audit
    assert "EarthProof card" in audit
    assert "0.040" in audit and "0.020" in audit and "-50%" in audit


def test_submission_demo_leads_with_the_in_product_earthproof_surface() -> None:
    """The pitch should show the shipped Build experience before dropping to CLI evidence."""
    submission = SUBMISSION.read_text(encoding="utf-8")

    assert "Open **Build**" in submission
    assert "EarthProof card" in submission
    assert "show the in-product evidence before the terminal" in submission
    assert submission.index("Open **Build**") < submission.index("Run the comparison command")
