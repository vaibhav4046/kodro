# Dissertation Traceability — CA1 feedback, BCS criteria, evidence

Dissertation source: `docs/dissertation/Kodro_Dissertation.tex`
PDF: `docs/dissertation/Kodro_Dissertation.pdf`
Module: COMP702 MSc Project, University of Liverpool. Student 201979723
(Vaibhav Lalwani). Supervisor: Keith Dures. Dissertation weight 70%.

## A. CA1 marker feedback -> dissertation resolution

The CA1 Specification & Design Proposal received a real supervisor grade in the
B band. The substantive criticisms and how the dissertation resolves each:

| CA1 feedback / weakness | Change in the dissertation | Evidence in the .tex | Status |
|-------------------------|----------------------------|----------------------|--------|
| Prose read as AI-generated / over-smooth; use plain, specific, critical English | Rewritten in a disciplined, project-specific student voice; concrete Kodro detail replaces generic phrasing; house rule: zero em/en dashes | whole document; dash count 0 verified at build | RESOLVED |
| BCS project criteria not addressed as such | A dedicated "The BCS project criteria" section maps each expectation (practical+analytical application, real need, synthesis, self-management, critical self-evaluation) to concrete artefacts | \section{The BCS project criteria} (Professional Issues chapter) | RESOLVED |
| Ethics folded into other sections, not standalone | A separate "Ethics" section states data category A0 / participant category 2, no human participants, GenAI-use acknowledgement, and the consent/safeguarding plan for any future study | \section{Ethics} (Professional Issues chapter) | RESOLVED |
| Evaluation must not overclaim; simulated study is not human data | Evaluation chapter frames the persona panel strictly as automated scenario-based evaluation; Professional Issues chapter explicitly "declines to report validation that has not happened"; the 5-8 teacher study is stated as future work under ethics | evaluation chapter + \chapter{Professional Issues} | RESOLVED |
| Literature must be used critically, not name-dropped | Related-work engages hallucination (Huang 2023), grounding (Lewis 2020), constrained feedback (Jacobs & Jaschke 2024), self-evolution limits (Tao 2024), multi-agent failure (Cemri 2025) and ties each to a design decision | related-work / background chapter | RESOLVED |

## B. Honesty guardrails applied (per completion directive)

- Automated personas are described ONLY as automated scenario-based evaluation,
  never as real participants. No fabricated teacher/pupil study, statistics, or
  ethics approval. The planned 5-8 teacher study is a stated LIMITATION / future
  evaluation.
- No literal "0% Turnitin" claim. Turnitin was not run here; if referenced, it is
  "not measured". A local originality/citation audit substitutes.
- Every gate count, live URL, commit hash and bundle SHA-256 in the evidence
  ledger is measured, not asserted.
- GenAI assistance is acknowledged in the Declaration per University guidance;
  authorship, direction and verification are the student's.

## C. BCS honours-project outcomes -> evidence map

| BCS outcome | Evidence (code + tests + this repo) |
|-------------|-------------------------------------|
| Practical + analytical application of the degree | recursive-descent Python-subset interpreter (interpreter.js, qa_interpreter 180); shared closed-form kinematics locked across JS+Python engines (motion-model.js / motion_model.py, golden-trace 4); property + coverage-gated Python suite |
| Real need in a real context | zero-cost, fully offline classroom design+simulation studio; privacy-zero-external gate; no accounts/cloud |
| Innovation / synthesis beyond routine | spec import + tiered fidelity disclosure + sandboxed sim gate + offline self-refinement combined into one verified artefact |
| Self-management of a substantial project | solo build, version-controlled, CI on 3 OSes, supervisor-steered ("build the working system first"); 12+ adversarial QA rounds recorded in FINDINGS.jsonl |
| Critical self-evaluation | evaluation + discussion chapters report defects found, state what simulated evaluation can/cannot claim, and decline unrun validation |

## D. Dissertation build status

- Page count target: the established ~50-page design (no larger target set by the
  brief); content optimised rather than padded.
- Build: pdflatex clean, 0 em/en dashes, verified at the last build.
- Screenshots/figures: real, from the working build.
- Re-verify page count + clean build at final convergence before submission.
