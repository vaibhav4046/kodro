"""One-shot patch for the approved NextStep EarthProof judge surface."""

from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)


app = Path("src/kodro/assets/web/app.jsx")
text = app.read_text(encoding="utf-8")
anchor = '                  <div className="browser-build-grid">'
card = '''                  <section className="earthproof-card" data-earthproof-nextstep="comparison" aria-label="EarthProof NextStep evidence">
                    <div className="earthproof-head">
                      <div>
                        <span className="eyebrow">EarthProof · NextStep 2026</span>
                        <h3>Evidence before hardware</h3>
                      </div>
                      <span className="earthproof-status">CO2e not claimed</span>
                    </div>
                    <p className="earthproof-lede">A reproducible, illustrative scenario comparison keeps the resource-use decision visible before a physical build.</p>
                    <div className="earthproof-flow" aria-label="Illustrative operating energy comparison">
                      <div className="earthproof-metric"><span>Baseline</span><strong>0.040 kWh</strong><small>central operating energy</small></div>
                      <span className="earthproof-arrow" aria-hidden="true">→</span>
                      <div className="earthproof-metric is-candidate"><span>Candidate</span><strong>0.020 kWh</strong><small>central operating energy</small></div>
                      <strong className="earthproof-delta">-50%</strong>
                    </div>
                    <p className="earthproof-boundary">Energy comparison only; it is not a carbon or lifecycle-impact claim.</p>
                    <div className="earthproof-foot"><span>illustrative scenario, not measured impact</span><code>evidence 11b6238e6236</code></div>
                  </section>
'''
if 'data-earthproof-nextstep="comparison"' not in text:
    text = replace_once(text, anchor, card + anchor, "app")
    app.write_text(text, encoding="utf-8", newline="\n")

css = Path("src/kodro/assets/web/styles.css")
styles = css.read_text(encoding="utf-8")
css_anchor = ".browser-build-grid { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(0,0.9fr); gap:24px; }"
earth_styles = '''.earthproof-card {
  display:grid; gap:12px; padding:16px 18px; border:1px solid color-mix(in srgb,var(--cyan) 42%,var(--border));
  border-radius:var(--radius-lg); background:linear-gradient(135deg,color-mix(in srgb,var(--cyan) 8%,var(--navy-2)),var(--navy-2));
}
.earthproof-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.earthproof-head h3 { margin:4px 0 0; color:var(--fg-1); font:600 var(--text-3xl)/1.15 var(--font-display); }
.earthproof-status { padding:5px 9px; border:1px solid color-mix(in srgb,var(--warning) 55%,var(--border)); border-radius:999px; color:var(--warning); font:700 var(--text-xs)/1 var(--font-mono); white-space:nowrap; }
.earthproof-lede { margin:0; max-width:78ch; color:var(--fg-2); line-height:1.5; }
.earthproof-flow { display:grid; grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) auto; gap:10px; align-items:center; }
.earthproof-metric { min-width:0; padding:11px 13px; border:1px solid var(--border); border-radius:var(--radius-md); background:var(--void); display:grid; gap:3px; }
.earthproof-metric.is-candidate { border-color:color-mix(in srgb,var(--cyan) 42%,var(--border)); }
.earthproof-metric span,.earthproof-metric small { color:var(--fg-3); font-size:var(--text-xs); }
.earthproof-metric strong { color:var(--fg-1); font:650 var(--text-3xl)/1.1 var(--font-mono); font-variant-numeric:tabular-nums; }
.earthproof-arrow { color:var(--fg-3); font-size:var(--text-2xl); }
.earthproof-delta { color:var(--cyan); font:700 var(--text-3xl)/1 var(--font-mono); }
.earthproof-boundary { margin:0; padding:9px 11px; border-left:3px solid var(--warning); background:color-mix(in srgb,var(--warning) 7%,transparent); color:var(--fg-2); font-size:var(--text-sm); line-height:1.45; }
.earthproof-foot { display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; color:var(--fg-3); font-size:var(--text-xs); }
.earthproof-foot code { color:var(--cyan); font-family:var(--font-mono); }
@media(max-width:640px){
  .earthproof-head { flex-direction:column; }
  .earthproof-flow { grid-template-columns:1fr; }
  .earthproof-arrow { transform:rotate(90deg); width:max-content; }
  .earthproof-delta { justify-self:start; }
}
'''
if ".earthproof-card {" not in styles:
    styles = replace_once(styles, css_anchor, earth_styles + css_anchor, "styles")
    css.write_text(styles, encoding="utf-8", newline="\n")

readme = Path("README.md")
r = readme.read_text(encoding="utf-8")
readme_anchor = "![Kodro front door with four routes into learning, design, free play and lesson authoring](docs/design/kodro-home.png)\n"
readme_section = '''
## NextStep Hacks 2026 · Kodro EarthProof

**Kodro predates the hackathon; EarthProof is the NextStep Hacks 2026 contribution.** It adds auditable environmental scenario evidence at the hardware decision point instead of hiding sustainability behind a green score.

**Design -> Simulate -> Prove -> EarthProof -> Build**

The committed demonstration compares an illustrative baseline at **0.040 kWh** central operating energy with a candidate at **0.020 kWh** (**-50%**). That is an energy scenario comparison only, not measured impact, a carbon saving, or lifecycle assessment. With no sourced carbon factor, **CO2e is not claimed**.

[NextStep submission](NEXTSTEP_SUBMISSION.md) | [EarthProof audit and reproducibility](NEXTSTEP_2026.md)
'''
if "## NextStep Hacks 2026 · Kodro EarthProof" not in r:
    r = replace_once(r, readme_anchor, readme_anchor + readme_section, "README")
    readme.write_text(r, encoding="utf-8", newline="\n")

audit = Path("NEXTSTEP_2026.md")
a = audit.read_text(encoding="utf-8")
old_files = '''The `nextstep-2026-earthproof` branch adds:

1. `src/kodro/earthproof.py`: a deterministic EarthProof evidence engine.
2. `tests/unit/test_earthproof.py`: focused regression coverage for the new engine.
3. `docs/eval/earthproof-scenario.json`: an explicitly illustrative input scenario.
4. `docs/eval/earthproof-report.json`: the reproducible machine-readable output.
5. This disclosure, methodology, demo plan and judging audit.
'''
new_files = '''The dated NextStep branches and pull requests add:

1. `src/kodro/earthproof.py`: the deterministic EarthProof evidence engine and baseline comparison CLI.
2. `tests/unit/test_earthproof.py`, `tests/unit/test_earthproof_validation.py` and `tests/unit/test_nextstep_judge_surface.py`: calculation, validation, reproducibility and judge-surface coverage.
3. `docs/eval/earthproof-scenario.json` and `docs/eval/earthproof-baseline.json`: explicitly illustrative candidate and baseline inputs.
4. `docs/eval/earthproof-report.json` and `docs/eval/earthproof-comparison-report.json`: reproducible machine-readable outputs.
5. The in-product EarthProof card at the Build decision point, plus this disclosure, methodology, demo plan and judging audit.
'''
if old_files in a:
    a = a.replace(old_files, new_files, 1)
old_cmd = '''python -m kodro.earthproof docs/eval/earthproof-scenario.json \\
  --out /tmp/earthproof-report.json
python -m pytest tests/unit/test_earthproof.py -q --cov-fail-under=0'''
new_cmd = '''python -m kodro.earthproof docs/eval/earthproof-scenario.json \\
  --baseline docs/eval/earthproof-baseline.json \\
  --out /tmp/earthproof-comparison-report.json
python -m pytest tests/unit/test_earthproof.py tests/unit/test_nextstep_judge_surface.py -q --cov-fail-under=0'''
if old_cmd in a:
    a = a.replace(old_cmd, new_cmd, 1)
a = a.replace(
    "Compare `/tmp/earthproof-report.json` with\n`docs/eval/earthproof-report.json`.",
    "Compare `/tmp/earthproof-comparison-report.json` with\n`docs/eval/earthproof-comparison-report.json`.",
)
a = a.replace(
    "EarthProof is repository/CLI evidence in this release, not a new UI panel.",
    "The Build-stage EarthProof card makes the canonical comparison visible in-product; authoring arbitrary EarthProof scenarios remains a source/CLI workflow in this research release.",
)
final_section = '''
## Final judge surface

The live Build stage now includes an **EarthProof card** tied by regression tests to the canonical comparison report. It shows the illustrative central operating-energy comparison **0.040 kWh -> 0.020 kWh (-50%)**, labels the result as **illustrative scenario, not measured impact**, and states **CO2e not claimed**. The exact boundary remains: **Energy comparison only; it is not a carbon or lifecycle-impact claim.**

This closes the judge-comprehension gap without turning EarthProof into a marketing score. The product-level story is now **Design -> Simulate -> Prove -> EarthProof -> Build** while the editable environmental scenario workflow remains deliberately auditable in JSON/CLI form.
'''
if "## Final judge surface" not in a:
    a = a.rstrip() + "\n" + final_section
audit.write_text(a, encoding="utf-8", newline="\n")
