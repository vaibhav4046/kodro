# Dissertation integrity audit — 17 July 2026

## Scope and source lock

- Canonical source: `Kodro_Dissertation.tex`
- Evaluated product commit: `0ca2fa9`
- Evaluation artefacts: `docs/eval/persona_eval_results.json` and
  `docs/eval/performance_eval.json`
- Final PDF: 48 A4 pages

## Evidence checks

| Claim surface | Evidence checked | Verdict |
| --- | --- | --- |
| Python correctness | Repository environment with all declared `dev`, `interop` and `rl` extras: 1,081 passed, zero skipped, 89.00% branch-aware coverage | Supported |
| Shipped interpreter | `node scripts/qa_interpreter.mjs`: 180 passed | Supported |
| Static web boot and privacy | `node scripts/qa_web.mjs`: 5/5 | Supported |
| Contrast and responsive rules | `node scripts/qa_contrast.mjs`: 61 passed over ten themes | Supported |
| Current full headless UI matrix | Did not return on the degraded local Chrome host | Explicitly not counted |
| Local persona-task benchmark | 40/40 cells under the committed model digest, seed, prompts and deterministic execution gates | Supported only for the stated task set |
| Human usability or learning | No human participant study was run | Not established |
| 240 FPS | Both measured SwiftShader tiers missed the 4.17 ms work budget | Not established and not claimed |
| Physical predictive validity and safety | First-order simulation only; no physical calibration study | Not established |

## Research-integrity checks

- The Declaration retains the generative-AI disclosure and author
  responsibility statement.
- Synthetic personas are labelled as synthetic throughout and are not treated
  as replacements for participants.
- The methodology advisory verdict is retained as FAIL; the two advisory PASS
  verdicts are not averaged into an evidence score.
- The bibliography was checked item by item. Corrections and source URLs are in
  `REFERENCE_AUDIT_2026-07-17.md`.
- No memory-improvement, classroom-efficacy, purchasing-accuracy, physical
  transfer or universal-frame-rate result is inferred from mechanism tests.
- No en dash or em dash remains in the LaTeX source.

## Build and visual verification

The document was compiled through three direct `pdflatex` passes. The final log
contains no overfull box, unresolved reference or unresolved citation warning.
All 48 pages were rendered through Poppler. Full contact sheets and the revised
abstract, UI figures, evaluation tables and bibliography were visually
inspected at full resolution.

## Residual external work

Turnitin submission and executable signing require their external services and
credentials. A participant study requires recruitment, consent and ethics
approval. Synthetic agents cannot truthfully replace those activities.

## AI assistance disclosure

OpenAI Codex assisted with the audit, source comparison, test execution and
document revision. The committed commands, hashes, logs and source records are
the evidence; the author remains responsible for the dissertation.
