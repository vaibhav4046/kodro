# Dissertation integrity audit — 17 July 2026

> **STALE as of 14 August 2026. Do not quote any figure in this file as the
> current state of the project.** Every number below was measured against
> commit `2645af9` and a 49-page PDF. The document and the test matrix have both
> moved a long way since. What this file is still good for is the research-
> integrity reasoning: which claims were treated as established, which were
> treated as not established, and why. The superseding-figures table immediately
> below records what has changed; the rest of the file is left unedited as a
> record of the 17 July state.
>
> | Surface | This file (17 Jul, `2645af9`) | Current, and where the current figure comes from |
> | --- | --- | --- |
> | Python matrix | 1,081 passed, 0 skipped, 89.00% branch coverage | 1,488 passed, 1 host Tk skip, 90.97% branch coverage against an 85% gate. Emitted by the run itself into `docs/eval/test_suite.json`, which records its own commit and working-tree status — read the figure there, not here. |
> | Final PDF | 49 A4 pages | 58 pages total; body runs Chapter 1 to the end of the References at page 47, Appendix A opens at 48. The 50-page limit applies to the body, so the current margin is 3 pages. |
> | LaTeX log | "no overfull box, unresolved reference or unresolved citation warning" | Unresolved references and citations: still none. **Overfull and underfull boxes: 19.** The clean-log half of that sentence no longer holds and should not be repeated. |
> | Headless UI matrix | 6 render flows, 39 behaviour assertions, 12 modal checks | 40 behaviour and 13 modal checks, per `docs/HANDOFF_KEITH.md` measured at commit `b33e5b8`. Not re-run for this note. |
> | Bibliography | "checked item by item", 23 entries | 25 entries. Two are unchecked and are logged as VERIFY in the addendum to `REFERENCE_AUDIT_2026-07-17.md`. One of them, `bcscode`, carries a deliberate visible verification marker inside the PDF. |
>
> Two verdicts in this file have **not** changed and are the ones most worth
> carrying forward: no human participant study has been run, so nothing about
> usability or learning is established; and the simulation has never been
> calibrated against a physical robot, so nothing about physical predictive
> validity is established. Both are still stated in the dissertation itself.

## Scope and source lock

- Canonical source: `Kodro_Dissertation.tex`
- Evaluated product commit: `2645af9`
- Evaluation artefacts: `docs/eval/persona_eval_results.json` and
  `docs/eval/performance_eval.json`
- Final PDF: 49 A4 pages

## Evidence checks

| Claim surface | Evidence checked | Verdict |
| --- | --- | --- |
| Python correctness | Repository environment with all declared `dev`, `interop` and `rl` extras: 1,081 passed, zero skipped, 89.00% branch-aware coverage | Supported |
| Shipped interpreter | `node scripts/qa_interpreter.mjs`: 180 passed | Supported |
| Static web boot and privacy | `node scripts/qa_web.mjs`: 5/5 | Supported |
| Honesty and claim boundaries | `node scripts/qa_honesty.mjs`: 107/107 | Supported |
| Contrast and responsive rules | `node scripts/qa_contrast.mjs`: 61 passed over ten themes | Supported |
| World, robot, tier and site identity matrix | `node scripts/qa_worlds.mjs`: 61/61 | Supported |
| Current full headless UI matrix | 6 of 6 render flows, 39 of 39 behaviour assertions and 12 of 12 modal checks | Supported |
| Local persona-task benchmark | 40/40 cells under the committed model digest, seed, prompts and deterministic execution gates | Supported only for the stated task set |
| Human usability or learning | No human participant study was run | Not established |
| 240 FPS | Measured SwiftShader tiers reached 32.4 FPS low and 27.2 FPS high; both missed the 4.17 ms work budget | Not established and not claimed |
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
All 49 pages were rendered through Poppler. Full contact sheets and the revised
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
