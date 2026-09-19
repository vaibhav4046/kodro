# Kodro EarthProof Certificate — Illustrative classroom rover scenario

**EarthProof · NextStep 2026 — Evidence before hardware**

Design -> Simulate -> Prove -> EarthProof -> Build. Prove the build before you buy the hardware.

- Baseline: **0.040 kWh** central operating energy (0.0252 / 0.0400 / 0.0540 kWh (low/central/high))
- Candidate: **0.020 kWh** central operating energy (0.0135 / 0.0200 / 0.0360 kWh (low/central/high))
- Change: **-50%** central operating-energy scenario
- CO2e: **not claimed** — illustrative scenario, not measured impact.

> Energy comparison only; it is not a carbon or lifecycle-impact claim.

| Metric | Value |
|---|---|
| Baseline operating energy (kWh) | 0.0252 / 0.0400 / 0.0540 kWh (low/central/high) |
| Candidate operating energy (kWh) | 0.0135 / 0.0200 / 0.0360 kWh (low/central/high) |
| Battery capacity (Wh) | 22.0000 / 24.4200 / 26.8800 Wh (low/central/high) |
| Operational CO2e | not claimed (null) |
| Scenario material avoided (kg) | 0.8000 / 1.0000 / 1.2000 kg (low/central/high) |

## Limitations (always shown)

- Results are scenario estimates, not lifecycle-assessment certification.
- Virtual validation does not prove that a physical prototype would have been built or avoided.
- Real hardware safety, mechanical fit and electrical protection still require competent review.
- No grid-carbon factor supplied; no operational CO2e estimate was produced.
- No prototype embodied-impact factor supplied; no embodied CO2e avoidance was claimed.

## Classroom scenario (estimate)

30 students x 1 prototype(s) each x 1.00 kg = **30.0 kg** scenario material avoidance. Scenario estimate, not measured savings. No CO2e claimed.

Method transparent-range-arithmetic/v1 · Schema kodro-earthproof/v1 · Fingerprint `evidence 11b6238e6236` (11b6238e6236acc14225e45b847f5e36b633d2ea441ba71db4f4adb45c1ab42f)

Reproduce: `python -m kodro.earthproof docs/eval/earthproof-scenario.json --baseline docs/eval/earthproof-baseline.json`
