# Dissertation integrity audit - 13 August 2026

## Scope lock

- Canonical source: `Kodro_Dissertation.tex`
- Evaluated product commit: `0559257b17ee2b3899bdffa0455c49c984050640`
- Candidate branch: `agent/kodro-2-1-completion`
- Final PDF: 50 A4 pages; approximately 20,005 words across the nine body chapters
  - Annotation added 18 August 2026, the 13 August figure above is left as it
    was recorded. "50 A4 pages" there counted arabic-numbered pages only. The
    CA3 brief counts front matter into the limit and excludes only appendices,
    so the operative figure is total sheets minus appendix sheets, under which
    the same document was 58. It has since been reduced to 61 sheets with
    appendices A to G on sheets 51 to 61, so 50 of 50. See `HUMAN_TODO.md`
    section 6 and section 2 of `docs/ca2/BRIEF_VERIFIED.md`.
- Product baseline: 24 lessons (3 KS1, 4 KS2, 9 KS3 and 8 KS4)

## Claim-to-evidence checks

| Claim surface | Evidence | Verdict |
| --- | --- | --- |
| Python correctness | Local Python 3.13: 1,239 passed and 140 Tcl/Tk skips; CI owns the full Python 3.12 Linux/Xvfb run and 85% threshold | Supported with host boundary stated |
| Interpreter | `qa_interpreter`: 180 passed | Supported |
| Lesson grading | `qa_grader`: 55 passed; all 24 worked answers pass both graders | Supported |
| Deterministic browser/unit gates | 19 JavaScript gates pass; exact counts are in `.kodro/autonomy/EVIDENCE.json` | Supported |
| Static browser boot/privacy | `qa_web`: 5/5, including zero app-originated external requests | Supported |
| Product honesty | `qa_honesty`: 121 passed | Supported |
| Windows packaging | Both executables built; sizes and SHA-256 values are in `EVIDENCE.json` | Supported as local candidate artefacts |
| Human learning/usability | No participant study was run | Not established and not claimed |
| Physical prediction/safety | First-order simulation; no calibration or certification study | Not established and not claimed |
| Universal accessibility | Automated checks only; no disabled-user study | Not established and not claimed |
| Similarity score | No Turnitin submission was made | Not measured and not claimed |

## Research-integrity gate

- The Declaration retains the required disclosure of generative-AI/tool use and
  the student's responsibility for the submitted work.
- Historical persona, local-model and renderer evidence is labelled as such and
  is not presented as current human or physical validation.
- The 14-round release ledger records 56 accepted defects, all marked fixed. It
  did not produce two consecutive zero-finding rounds, so the dissertation does
  not claim mathematical convergence or a flawless product.
- Negative findings remain visible, including the measured renderer shortfall,
  absent participant evidence and absent physical validation.
- No fabricated reference, result, ethics approval, signing result or external
  submission receipt was found.
- No Unicode en dash or em dash remains in the canonical LaTeX source.

## Bibliography and build

- All 26 citation keys resolve to 26 bibliography entries.
- Every bibliography entry is cited; no orphaned reference remains.
- The BCS record was corrected to its official January 2020 publication date.
- Three direct `pdflatex` passes produce a 50-page PDF with no unresolved
  references/citations, no duplicate destination and no overfull box warning.
- Text extraction finds no blank page; all 50 pages were rendered and visually
  inspected in five contact sheets, with the title, abstract, evaluation,
  professional-issues table, bibliography and appendices inspected separately.

## External boundaries

The student must still read and approve the final text, confirm administrative
details, and submit through the official university service. Any participant
study requires prior ethics approval. Signing/notarisation and Turnitin results
require their respective external services and cannot be truthfully generated
inside this repository.

## AI assistance disclosure

OpenAI Codex assisted with source comparison, test execution, document revision,
reference checking and PDF inspection. The source, commands, commit hashes and
audit records are the evidence; the student remains responsible for the work.
