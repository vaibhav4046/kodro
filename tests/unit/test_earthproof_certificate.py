"""Certificate must reuse audited evidence without inventing impact."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "docs" / "eval" / "earthproof-comparison-report.json"

sys.path.insert(0, str(ROOT / "scripts"))

from earthproof_certificate import build_certificate


def test_certificate_reuses_audited_numbers() -> None:
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    html_doc, md_doc = build_certificate(report)

    comp = report["comparison"]
    assert f"{comp['baseline_operating_energy_kwh']['central']:.3f} kWh" in html_doc
    assert f"{comp['candidate_operating_energy_kwh']['central']:.3f} kWh" in html_doc
    assert f"{comp['central_operating_energy_change_percent']:.0f}%" in html_doc
    assert "CO2e not claimed" in html_doc
    assert "illustrative scenario, not measured impact" in html_doc
    assert comp["claim_boundary"] in html_doc
    assert report["fingerprint_sha256"][:12] in html_doc
    assert "not claimed (null)" in html_doc
    assert md_doc.count("not claimed") >= 2


def test_certificate_classroom_box_stays_scenario_estimate() -> None:
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    html_doc, _ = build_certificate(report, students=30, prototypes_each=1)

    assert "30 students" in html_doc
    assert "Scenario estimate" in html_doc or "scenario estimate" in html_doc
    assert "No CO2e claimed" in html_doc


def test_committed_certificate_matches_generator() -> None:
    """Committed static copy must match what the script generates (Rule 6)."""
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    html_doc, md_doc = build_certificate(report, students=30, prototypes_each=1)

    committed_html = ROOT / "src" / "kodro" / "assets" / "web" / "earthproof-certificate.html"
    committed_md = ROOT / "docs" / "eval" / "earthproof-certificate.md"
    assert committed_html.read_text(encoding="utf-8") == html_doc
    assert committed_md.read_text(encoding="utf-8") == md_doc
