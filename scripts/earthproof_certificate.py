"""Shareable EarthProof certificate from the audited comparison report.

Reads the comparison report (default below) and writes a standalone
HTML certificate plus a Markdown version. No new math: every number
comes from the report. Classroom scaling is an explicit estimate.

Usage:
    python scripts/earthproof_certificate.py
    python scripts/earthproof_certificate.py --students 30
    python scripts/earthproof_certificate.py --report <report.json>
        --out <cert.html> --md <cert.md>

Classroom box: students * prototypes_each * material central.
Labelled scenario estimate, never measured savings. CO2e never invented.
"""

from __future__ import annotations

import argparse
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = ROOT / "docs" / "eval" / "earthproof-comparison-report.json"

LOOP = "Design -> Simulate -> Prove -> EarthProof -> Build"


def _fmt(value: object, unit: str = "") -> str:
    if value is None:
        return "not claimed"
    if isinstance(value, dict):
        low = value.get("low")
        central = value.get("central")
        high = value.get("high")
        suffix = f" {unit}" if unit else ""
        return f"{low:.4f} / {central:.4f} / {high:.4f}{suffix} (low/high)"
    return str(value)


def _classroom(metrics: dict, students: int, prototypes_each: int) -> tuple[str, str]:
    if students <= 0 or prototypes_each <= 0:
        return "", ""
    mat = metrics.get("scenario_material_avoided_kg") or {}
    per_unit = float(mat.get("central", 0.0)) if isinstance(mat, dict) else 0.0
    total = students * prototypes_each * per_unit
    intro = f"{students} students x {prototypes_each} prototype(s) each x {per_unit:.2f} kg"
    html_box = (
        '<section class="classroom">'
        "<h2>Classroom scenario (estimate)</h2>"
        f"<p><strong>{intro}</strong> = <strong>{total:.1f} kg</strong> "
        "scenario material avoidance. Scenario estimate from "
        "user-supplied assumptions, not measured savings. "
        "No CO2e claimed.</p></section>"
    )
    md_box = (
        "\n## Classroom scenario (estimate)\n\n"
        f"{intro} = **{total:.1f} kg** scenario material avoidance. "
        "Scenario estimate, not measured savings. No CO2e claimed.\n"
    )
    return html_box, md_box


def build_certificate(report: dict, students: int = 0, prototypes_each: int = 0) -> tuple[str, str]:
    comp = report["comparison"]
    metrics = report["metrics"]
    limitations = report["limitations"]
    fingerprint = report.get("fingerprint_sha256", "")
    scenario_name = report.get("scenario", {}).get("name", "")
    baseline = comp["baseline_operating_energy_kwh"]
    candidate = comp["candidate_operating_energy_kwh"]
    change = comp["central_operating_energy_change_percent"]
    classroom_html, classroom_md = _classroom(metrics, students, prototypes_each)

    lim_html = "\n".join(f"<li>{html.escape(str(x))}</li>" for x in limitations)
    lim_md = "\n".join(f"- {x}" for x in limitations)
    short_fp = str(fingerprint)[:12]
    boundary = html.escape(str(comp["claim_boundary"]))
    base_str = f"{baseline['central']:.3f} kWh"
    cand_str = f"{candidate['central']:.3f} kWh"
    change_str = f"{change:.0f}%"

    css = "\n".join(
        [
            "body{font-family:system-ui,sans-serif;",
            "background:#0b1220;color:#e8eef7;",
            "margin:0;padding:32px}",
            ".card{max-width:760px;margin:auto;",
            "background:#111c33;border:1px solid #2dd4bf;",
            "border-radius:16px;padding:28px}",
            ".pill{display:inline-block;background:#2dd4bf;",
            "color:#06281f;font-weight:800;font-size:12px;",
            "letter-spacing:.1em;padding:4px 12px;",
            "border-radius:999px;text-transform:uppercase}",
            ".flow{display:flex;gap:12px;align-items:center;",
            "margin:16px 0;flex-wrap:wrap}",
            ".metric{background:#0b1220;",
            "border:1px solid #334155;border-radius:12px;",
            "padding:12px 16px;min-width:150px}",
            ".metric strong{font-size:22px;display:block}",
            ".delta{font-size:28px;font-weight:800;color:#2dd4bf}",
            ".boundary{background:#3b2f04;",
            "border:1px solid #f59e0b;border-radius:10px;",
            "padding:10px 14px;font-size:14px}",
            "code{background:#0b1220;padding:2px 6px;",
            "border-radius:6px;font-size:12px}",
            "table{width:100%;border-collapse:collapse;",
            "margin-top:12px;font-size:14px}",
            "td,th{border:1px solid #334155;padding:8px;text-align:left}",
            "h1{margin:12px 0 4px}h2{margin-top:20px}",
            ".classroom{margin-top:16px;",
            "border:1px dashed #2dd4bf;border-radius:10px;",
            "padding:12px 14px}",
            ".small{color:#94a3b8;font-size:13px}",
        ]
    )

    parts = [
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,',
        'initial-scale=1">',
        f"<title>Kodro EarthProof Certificate — {html.escape(scenario_name)}</title>",
        "<style>",
        css,
        "</style>",
        "</head>",
        "<body>",
        '<div class="card">',
        '<span class="pill">EarthProof · NextStep 2026</span>',
        "<h1>Evidence before hardware</h1>",
        f"<p>{LOOP}. Prove the build before you buy the hardware.</p>",
        '<div class="flow">',
        '<div class="metric"><span>Baseline</span>'
        f"<strong>{base_str}</strong>"
        "<small>central operating energy</small></div>",
        "<span>→</span>",
        '<div class="metric"><span>Candidate</span>'
        f"<strong>{cand_str}</strong>"
        "<small>central operating energy</small></div>",
        f'<span class="delta">{change_str}</span>',
        "</div>",
        f'<p class="boundary"><strong>{boundary}</strong> '
        "CO2e not claimed — illustrative scenario, "
        "not measured impact.</p>",
        "<table>",
        "<tr><th>Metric</th><th>Value</th></tr>",
        "<tr><td>Baseline operating energy (kWh)</td>"
        f"<td>{html.escape(_fmt(baseline, 'kWh'))}</td></tr>",
        "<tr><td>Candidate operating energy (kWh)</td>"
        f"<td>{html.escape(_fmt(candidate, 'kWh'))}</td></tr>",
        "<tr><td>Battery capacity (Wh)</td>"
        f"<td>{html.escape(_fmt(metrics.get('battery_capacity_wh'), 'Wh'))}</td></tr>",
        "<tr><td>Operational CO2e</td><td>not claimed (null)</td></tr>",
        "<tr><td>Scenario material avoided (kg)</td>"
        f"<td>{html.escape(_fmt(metrics.get('scenario_material_avoided_kg'), 'kg'))}"
        "</td></tr>",
        "</table>",
        "<h2>Limitations (always shown)</h2>",
        f"<ul>{lim_html}</ul>",
        classroom_html,
        f'<p class="small">Method {html.escape(str(report.get("method", "")))} · '
        f"Schema {html.escape(str(report.get('schema', '')))} · "
        f"Fingerprint <code>evidence {html.escape(short_fp)}</code> "
        f"({html.escape(str(fingerprint))})</p>",
        '<p class="small">Reproduce: <code>python -m kodro.earthproof '
        "docs/eval/earthproof-scenario.json "
        "--baseline docs/eval/earthproof-baseline.json</code></p>",
        "</div>",
        "</body>",
        "</html>",
    ]
    html_doc = "\n".join(p for p in parts if p != "") + "\n"

    md_lines = [
        f"# Kodro EarthProof Certificate — {scenario_name}",
        "",
        "**EarthProof · NextStep 2026 — Evidence before hardware**",
        "",
        f"{LOOP}. Prove the build before you buy the hardware.",
        "",
        f"- Baseline: **{base_str}** central operating energy",
        f"  ({_fmt(baseline, 'kWh')})",
        f"- Candidate: **{cand_str}** central operating energy",
        f"  ({_fmt(candidate, 'kWh')})",
        f"- Change: **{change_str}** central operating-energy scenario",
        "- CO2e: **not claimed** — illustrative scenario,",
        "  not measured impact.",
        "",
        f"> {comp['claim_boundary']}",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Baseline operating energy (kWh) | {_fmt(baseline, 'kWh')} |",
        f"| Candidate operating energy (kWh) | {_fmt(candidate, 'kWh')} |",
        f"| Battery capacity (Wh) | {_fmt(metrics.get('battery_capacity_wh'), 'Wh')} |",
        "| Operational CO2e | not claimed (null) |",
        "| Scenario material avoided (kg) | "
        f"{_fmt(metrics.get('scenario_material_avoided_kg'), 'kg')} |",
        "",
        "## Limitations (always shown)",
        "",
        lim_md,
        classroom_md,
        f"Method {report.get('method', '')} · "
        f"Schema {report.get('schema', '')} · "
        f"Fingerprint `evidence {short_fp}` ({fingerprint})",
        "",
        "Reproduce: `python -m kodro.earthproof "
        "docs/eval/earthproof-scenario.json "
        "--baseline docs/eval/earthproof-baseline.json`",
        "",
    ]
    md_doc = "\n".join(md_lines)
    return html_doc, md_doc


def main(argv: list[str] | None = None) -> int:
    """Generate the certificate files."""
    parser = argparse.ArgumentParser(description="Generate a shareable EarthProof certificate.")
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument(
        "--out",
        type=Path,
        default=ROOT / "site" / "earthproof-certificate.html",
    )
    parser.add_argument(
        "--md",
        type=Path,
        default=ROOT / "docs" / "eval" / "earthproof-certificate.md",
    )
    parser.add_argument("--students", type=int, default=0)
    parser.add_argument("--prototypes-each", type=int, default=0)
    args = parser.parse_args(argv)

    report = json.loads(args.report.read_text(encoding="utf-8"))
    html_doc, md_doc = build_certificate(report, args.students, args.prototypes_each)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(html_doc, encoding="utf-8")
    args.md.parent.mkdir(parents=True, exist_ok=True)
    args.md.write_text(md_doc, encoding="utf-8")
    print(f"wrote {args.out} ({len(html_doc)} bytes)")
    print(f"wrote {args.md} ({len(md_doc)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
