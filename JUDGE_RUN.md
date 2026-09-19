# JUDGE_RUN — 60-second judge path

Total: ~60 seconds. In-product evidence first, terminal second. Nothing here
requires logging in.

## The path

**Step 1 — Open the live build (10s)**
Open https://vaibhav4046.github.io/kodro/
Say: "This is live Kodro. EarthProof is the new pre-build evidence gate."

**Step 2 — Design → Simulate → Prove (15s)**
Run the robot in the 3D world, then show one seeded proof contract passing.
Say: "This Design-to-Prove workflow predates NextStep. AI can help with code,
but AI cannot change this verdict — the proof is deterministic and replayable."

**Step 3 — Build → EarthProof card (15s)**
Open **Build**, point directly at the **EarthProof card**.
Say: "EarthProof sits at the build decision. Illustrative baseline
**0.040 kWh**, candidate **0.020 kWh**, **−50% illustrative
operating-energy scenario** — and **CO2e not claimed**. This is an energy
comparison, not carbon savings."

**Step 4 — Reproduce it (20s)**
From the repository root, run:

```bash
python -m kodro.earthproof docs/eval/earthproof-scenario.json --baseline docs/eval/earthproof-baseline.json
```

## Expected outputs (check these)

- `comparison.baseline_operating_energy_kwh.central` → `0.04`
- `comparison.candidate_operating_energy_kwh.central` → `0.02`
- `comparison.central_operating_energy_change_percent` → `-50.0`
- `comparison.claim_boundary` →
  `"Energy comparison only; it is not a carbon or lifecycle-impact claim."`
- `metrics.operational_emissions_kgco2e` → `null`
- `metrics.scenario_embodied_emissions_avoided_kgco2e` → `null`
- `fingerprint_sha256` →
  `11b6238e6236acc14225e45b847f5e36b633d2ea441ba71db4f4adb45c1ab42f`
  (full value in `docs/eval/earthproof-comparison-report.json`)
- `limitations` includes "No grid-carbon factor supplied; no operational
  CO2e estimate was produced."

Byte-reproducibility check (optional, same session):

```bash
python -m kodro.earthproof docs/eval/earthproof-scenario.json --baseline docs/eval/earthproof-baseline.json --out /tmp/earthproof-comparison-report.json
```

Compare `/tmp/earthproof-comparison-report.json` with the committed
`docs/eval/earthproof-comparison-report.json` — they must match byte-for-byte.

## 5 objection handlers (say these, nothing more)

**1. "Did Kodro pre-exist the hackathon?"**
"Yes. Kodro is an MSc research project with design, simulation, and seeded
proof contracts. The NextStep contribution is the EarthProof evidence engine,
baseline comparison CLI, reproducible scenario/baseline/report artifacts,
judge-surface tests, the in-product Build card, and this disclosure —
identified by dated branches and PRs. I am not claiming pre-existing Kodro
was built during NextStep."

**2. "Are you claiming a 50% saving?"**
"No. The committed demonstration shows a −50% *central operating-energy
difference between two illustrative scenarios* — 0.040 kWh baseline vs
0.020 kWh candidate. It is not a carbon claim, not a lifecycle claim, and
not measured user impact."

**3. "Does simulation prove the robot is safe to build?"**
"No. Kodro's proof is kinematic simulation evidence, not physical-safety
certification. Real hardware still requires competent mechanical and
electrical review. What EarthProof adds is auditable resource-use reasoning
before the purchase decision."

**4. "Why no carbon factor / why is CO2e null?"**
"Because grid intensity and embodied impact vary by location, hardware, and
system boundary. EarthProof ships no default factor: no supplied factor
means `null`, no carbon claim. A supplied factor without a source is
flagged in limitations. Kodro does not invent the missing number."

**5. "Is this an LCA tool?"**
"No. EarthProof is not lifecycle-assessment software and does not claim
simulation automatically prevents a prototype. It provides scenario ranges
(low / central / high) for operating energy and battery capacity, plus
user-supplied material/emissions scenarios, with assumptions, limitations,
and a SHA-256 fingerprint on every report."
