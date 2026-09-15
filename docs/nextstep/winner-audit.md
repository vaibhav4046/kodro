# NextStep 2026 winner audit

Status: **candidate release audit**. This document separates implemented evidence from submission work that still requires a human action such as recording the demo or completing Devpost fields.

## Positioning

**Kodro: prove a robot before you build it.**

Kodro is an offline-first robotics learning and early-design studio. A learner can choose a robot, program it, run controlled proofs, inspect evidence, and carry assumptions into a provisional build brief. For NextStep's Earth Forward theme, EarthProof adds transparent energy/material scenario evidence so environmental reasoning becomes part of the engineering decision instead of a marketing claim.

## Prior-work disclosure

Kodro predates NextStep 2026 and is an MSc research project. Do not claim the whole product was built during the hackathon.

NextStep-specific work on branch `nextstep-earthproof`:

- EarthProof evidence engine
- deterministic evidence hashing
- transparent design comparison
- optional sourced electricity-factor calculation
- explicit environmental claims boundary
- unit contract covering calculations and invalid evidence
- methodology and submission audit

This disclosure is important because NextStep permits existing work when prior and new work are identified.

## Rubric audit

### Earth Forward adherence

**Evidence:** EarthProof connects robot simulation to energy, material-scenario and design-comparison evidence.

**Boundary:** material values are counterfactual scenarios, not measured waste reduction. Carbon is absent unless a factor and source are supplied.

**Assessment:** strong theme fit without greenwashing.

### Completion

**Existing product evidence:** Kodro already ships Design -> Prove -> Build, offline programming, visual simulation, deterministic proof manifests, lessons, local AI options and downloadable builds.

**NextStep evidence:** EarthProof is implemented as an isolated Python module with deterministic JSON-compatible output and validation.

### Technology

- Python dataclasses and standard-library-only evidence engine
- deterministic canonical JSON + SHA-256 evidence identity
- explicit numeric validation including NaN/infinity rejection
- seeded proof-success evidence compatible with Kodro's deterministic proof philosophy
- no mandatory cloud dependency

### Originality

The novelty is not "AI + sustainability". The differentiator is joining early robotics design, executable proof and an honest environmental evidence boundary in an offline-first educational workflow. EarthProof deliberately refuses to invent a composite green score.

### Learning

The submission can show a learner comparing two robot configurations and reasoning from energy, mass, battery and proof reliability instead of treating sustainability as an unexplained label.

### Design

No NextStep-only visual redesign was introduced. Judges see the existing Kodro product rather than a hackathon skin. EarthProof evidence is repository-verifiable and can be demonstrated from Python or incorporated into exported evidence later.

## Judge demo spine

1. **Problem (20 s):** learners often buy/build before they have evidence that a robot design and controller work. Failed iterations cost time and components.
2. **Design (30 s):** choose/modify a robot and show its physical envelope and battery assumptions.
3. **Prove (45 s):** run the controller and deterministic multi-seed proof. Show that Kodro can reject a broken controller.
4. **EarthProof (45 s):** compare two candidate designs with the same workload. Show run energy and mass directly; show the scenario label and claims boundary.
5. **Build (30 s):** export the provisional build evidence and state what Kodro does *not* certify.
6. **Close (10 s):** "Kodro helps students prove more before they physically build more."

## Claims approved for submission

- "offline-first robotics learning and early-design studio"
- "deterministic multi-seed proof"
- "environmental engineering evidence with explicit assumptions"
- "no built-in carbon factor"
- "no account or mandatory network call for core workflows"
- "counterfactual prototype/material scenarios are labelled as scenarios"

## Claims prohibited unless separately evidenced

- exact e-waste saved in real classrooms
- exact carbon avoided by Kodro
- proven classroom learning improvement
- industrial-grade physics validation
- hardware safety certification
- lifecycle assessment
- guaranteed competition outcome

## Release gate

Before submission, all of the following must be true:

- [ ] EarthProof unit contract passes
- [ ] full Python suite passes at repository coverage gate
- [ ] existing JS/interpreter QA remains green
- [ ] repository diff contains no unrelated UI changes
- [ ] Devpost clearly discloses pre-existing Kodro and NextStep-specific EarthProof work
- [ ] demo uses only claims in the approved list or provides additional evidence
- [ ] demo visibly shows a failed proof as well as a successful proof
- [ ] no submission text says simulated material is measured real-world waste saved

## Current audit conclusion

The engineering direction is suitable for a high-quality NextStep submission because it strengthens the theme fit without weakening Kodro's existing evidence discipline. Final readiness depends on CI/full-suite results and the human-recorded submission/demo; this document must not be used as proof that those future actions already passed.
