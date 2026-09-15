# Kodro EarthProof: NextStep Hacks 2026 contribution

This document separates the pre-existing Kodro research project from the work
created for NextStep Hacks 2026. It is also the reproducibility and claim-boundary
record for the Earth Forward submission.

## Submission position

**Problem.** Robotics learning and early prototyping can require buying or
assembling hardware before a design has been exercised. Failed or unnecessary
physical iterations can consume components, materials, battery energy, money and
classroom time.

**NextStep contribution.** EarthProof adds a transparent environmental evidence
layer to Kodro's existing Design -> Prove -> Build workflow. It calculates
scenario ranges for operating energy and battery capacity, can compare two robot
designs by energy, and can quantify material or emissions scenarios only when the
user explicitly supplies the assumptions or impact factors.

**Claim boundary.** EarthProof is not lifecycle-assessment software and does not
claim that simulation automatically prevents a physical prototype. It provides
auditable scenario evidence so a learner, teacher or maker can compare designs
before deciding what to build.

## Before vs during the hackathon

### Before NextStep Hacks 2026

Kodro already existed as an MSc research project. Before this contribution it
already included robot design, Python/blocks programming, kinematic 3D simulation,
deterministic seeded proof contracts, evidence manifests, curriculum lessons,
offline/local AI options, an MCP server, browser/desktop delivery and a substantial
automated QA suite.

### Built during NextStep Hacks 2026

The dated NextStep branches and pull requests add:

1. `src/kodro/earthproof.py`: the deterministic EarthProof evidence engine and baseline comparison CLI.
2. `tests/unit/test_earthproof.py`, `tests/unit/test_earthproof_validation.py` and `tests/unit/test_nextstep_judge_surface.py`: calculation, validation, reproducibility and judge-surface coverage.
3. `docs/eval/earthproof-scenario.json` and `docs/eval/earthproof-baseline.json`: explicitly illustrative candidate and baseline inputs.
4. `docs/eval/earthproof-report.json` and `docs/eval/earthproof-comparison-report.json`: reproducible machine-readable outputs.
5. The in-product EarthProof card at the Build decision point, plus this disclosure, methodology, demo plan and judging audit.

No claim is made that pre-existing Kodro was built during NextStep.

NextStep's public requirements explicitly say that continued old projects are
allowed when the Devpost submission specifies what was completed before and
during the hackathon:
https://nextstep2026.devpost.com/

## Methodology

EarthProof uses non-negative low / central / high intervals. For the core
calculations:

```text
operating energy (kWh) = average power (W) * runtime (hours) / 1000
battery capacity (Wh) = voltage (V) * capacity (Ah)
operational emissions (kgCO2e) = operating energy (kWh) * supplied grid factor
scenario material avoided (kg) = prototypes assumed avoided * supplied prototype mass
scenario embodied impact avoided = prototypes assumed avoided * supplied embodied factor
```

The engine ships **no default grid-carbon or embodied-impact coefficient**. If no
factor is supplied, the corresponding CO2e result is `null` and the report says
that no carbon claim was produced. If an environmental factor is supplied without
an evidence source, the report records a limitation.

Prototype avoidance is never inferred from a simulation pass. The number of
physical prototypes assumed avoided is always an explicit scenario input and is
labelled as such.

Every report can receive a SHA-256 fingerprint over canonical JSON. Identical
evidence produces an identical fingerprint; an edited input changes it.

## Reproduce the evidence

From the repository root:

```bash
python -m kodro.earthproof docs/eval/earthproof-scenario.json \
  --baseline docs/eval/earthproof-baseline.json \
  --out /tmp/earthproof-comparison-report.json
python -m pytest tests/unit/test_earthproof.py tests/unit/test_nextstep_judge_surface.py -q --cov-fail-under=0
```

Compare `/tmp/earthproof-comparison-report.json` with
`docs/eval/earthproof-comparison-report.json`. The illustrative scenario intentionally
contains no carbon or embodied-impact factor, so the correct report makes no
CO2e claim.

## Illustrative scenario, not a measured outcome

The committed scenario demonstrates the method only:

- average power range: 18 to 24 W, central 20 W
- runtime range: 0.75 to 1.5 h, central 1 h
- one physical prototype assumed avoided
- prototype material mass range: 0.8 to 1.2 kg, central 1 kg
- battery range: 11.0 to 11.2 V and 2.0 to 2.4 Ah
- no grid-carbon factor
- no embodied-impact factor

Its output therefore calculates 0.0135 to 0.036 kWh operating energy and
0.8 to 1.2 kg of **scenario** material avoidance, while refusing to produce a
CO2e number.

These figures must not be presented as measured environmental savings from
Kodro users.

## NextStep judging audit

The official judging dimensions are Originality, Adherence to Track, Completion,
Learning, Design and Technology.

| Criterion | Evidence presented to judges | Residual risk |
| --- | --- | --- |
| Originality | Kodro combines offline robot design, coding, simulation and deterministic proof; EarthProof adds inspectable environmental evidence instead of a generic sustainability score. | Do not claim the individual ideas of simulation or energy calculation are new. |
| Adherence to Track | EarthProof directly addresses resource use in physical prototyping and makes the environmental assumptions reviewable. | Environmental benefit remains scenario-based until user studies measure real avoided builds. |
| Completion | The new engine has a CLI, deterministic JSON output, example evidence and automated tests. Existing Kodro remains a working browser/desktop product. | Judge demo must use the tested path and not imply industrial certification. |
| Learning | The hackathon contribution introduces uncertainty ranges, claim boundaries, factor provenance and reproducibility into a robotics project. | Explain what was learned rather than pretending all of Kodro was new. |
| Design | The existing product already has a Design -> Prove -> Build user journey; this change deliberately avoids a rushed visual redesign. | The Build-stage EarthProof card makes the canonical comparison visible in-product; authoring arbitrary EarthProof scenarios remains a source/CLI workflow in this research release. |
| Technology | Deterministic interval calculations, provenance warnings, evidence fingerprints and comparisons sit alongside Kodro's existing simulation/proof/test stack. | Keep the demo focused; listing every subsystem will dilute the technical story. |

## Three-minute judge demo

1. **0:00-0:25 - problem.** Show the choice a learner faces before purchasing
   hardware: which robot design should be built?
2. **0:25-1:10 - existing Kodro.** Design a robot, run a program and show a seeded
   proof/evidence manifest. State clearly that this is pre-existing Kodro.
3. **1:10-2:00 - NextStep work.** Run EarthProof on a scenario and open the JSON
   evidence. Point out the uncertainty range and the `null` carbon result.
4. **2:00-2:30 - compare.** Explain that two candidate designs can be compared by
   operating energy without turning that result into an unsupported lifecycle claim.
5. **2:30-3:00 - why Earth Forward.** Virtual-first iteration can inform a lower-waste
   build decision; EarthProof makes the sustainability reasoning inspectable instead
   of hiding it behind an unexplained green score.

## What not to say in the submission

Do not say:

- "Kodro eliminates e-waste."
- "Every simulation avoids a prototype."
- "Kodro reduces carbon by X%" unless X comes from a disclosed scenario with cited
  factors and is clearly labelled as an estimate.
- "Kodro is a lifecycle assessment tool."
- "Kodro was created during NextStep Hacks 2026."

Prefer:

> Kodro lets learners and makers exercise robot designs virtually before deciding
> what to build. EarthProof, created for NextStep Hacks 2026, adds transparent
> scenario evidence for energy, battery capacity and user-supplied material or
> emissions assumptions, with uncertainty and limitations kept visible.

## Release gate

Before submission, all of the following must be true:

- focused EarthProof tests pass
- repository CI passes on the pull request
- the committed example report reproduces byte-for-byte from its scenario
- no UI regression is introduced by this backend-only contribution
- Devpost includes the before/during disclosure above
- demo video is 3 to 5 minutes and visibly runs the product
- repository and live product links work in a logged-out browser
- no environmental number is presented without its assumption/provenance

## Final judge surface

The live Build stage now includes an **EarthProof card** tied by regression tests to the canonical comparison report. It shows the illustrative central operating-energy comparison **0.040 kWh -> 0.020 kWh (-50%)**, labels the result as **illustrative scenario, not measured impact**, and states **CO2e not claimed**. The exact boundary remains: **Energy comparison only; it is not a carbon or lifecycle-impact claim.**

This closes the judge-comprehension gap without turning EarthProof into a marketing score. The product-level story is now **Design -> Simulate -> Prove -> EarthProof -> Build** while the editable environmental scenario workflow remains deliberately auditable in JSON/CLI form.
