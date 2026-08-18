# Dissertation verification re-review

> **Dated snapshot, 18 July 2026. The recommendation below was made against a
> 49-page document that no longer exists in that form.** Treat "Ready for MSc
> submission" as a statement about the 18 July draft, not about the current one.
> Four presentation facts in this file have since changed and should not be
> quoted from here:
>
> - **Citations.** "All 23 in-text citation keys" is now 25. The two added
>   entries, `trinket2026` and `bcscode`, are unchecked; see the addendum to
>   `REFERENCE_AUDIT_2026-07-17.md`.
> - **Length.** "The final PDF is 49 pages" is now 58 pages, of which the body
>   is 47 against a 50-page body limit.
> - **Boxes.** "builds twice without undefined references or overfull boxes" is
>   now half true. Undefined references and citations: still none. Overfull and
>   underfull boxes: 19.
> - **One section reference has moved.** The ethics-pending human pilot was
>   Section 6.9 when this review was written; it is now Section 6.10, and 6.9 is
>   Threats to validity. The other section numbers cited in this file (4.4, 6.1,
>   6.2, 6.11, Chapter 8) still point where the review says they do.
>
> Two chapters were added to the document after this review and were therefore
> never seen by it: the lesson-path design section and the lesson-implementation
> section that cover the schools half of the product. The claim-and-evidence
> audit below does not extend to them.
>
> What has **not** changed: no human participant study has been run, the
> simulation has no physical calibration, and the four residual actions at the
> foot of this file are all still outstanding.

## Review configuration

| Field | Value |
| --- | --- |
| Field | Software engineering, robotics education and human-computer interaction |
| Work type | Design-science MSc artefact dissertation |
| Review stage | Candidate release re-review |
| Evidence inspected | Canonical LaTeX, rendered PDF, revision tracking, committed evaluation artefacts and executable gates |
| Date | 18 July 2026 |

## Recommendation

**Ready for MSc submission, subject to the university's normal administrative checks.**

The revision now presents a coherent research contribution: a free, offline-first robot design and pre-build proving environment whose deterministic layer owns execution, scoring and evidence, while model assistance is optional and advisory. The claims match the shipped source state and the negative results are retained. No critical or major dissertation issue remains from this review round.

This recommendation is not evidence of physical robot validation, safety certification, participant findings, plagiarism screening or examiner acceptance. Those decisions remain outside the artefact and are not claimed in the dissertation.

## Priority issue verification

| Priority issue | Evidence in the revision | Outcome |
| --- | --- | --- |
| Obsolete interaction model | Section 4.4 defines Design, Prove and Build, Simple and Expert modes, More Tools and mobile navigation. Section 9.1 reports the same shipped journey. | Fully addressed |
| Missing systems account of the primary journey | Table 4.2 states the input, process and output contract for each primary stage. | Fully addressed |
| Proof authority absent from the evaluation | Sections 6.1, 6.2 and 6.11 report four declarative contracts, twenty seeded runs, canonical manifests, byte-identical reruns, baseline comparison and an intentionally broken controller. | Fully addressed |
| Evaluation scope was diffuse | Section 6.9 now defines one low-risk, ethics-pending pilot with one research question, three diagnosis missions, planned measures and ten to fifteen participants. | Fully addressed |
| Professional issues were underdeveloped | Chapter 8 separates ethics from BCS-aligned professional issues and covers safety, privacy, accessibility, security, intellectual property and sustainability. | Fully addressed |
| Evidence figures were stale | The Abstract, Chapter 6 and Chapter 9 use the 18 July 2026 candidate measurements. The renderer's failure to meet the 240 Hz target is reported directly. | Fully addressed |
| Contents typography defect | The rendered contents pages use consistent dot leaders and no joined chapter title and page number was found. | Fully addressed |

## Claim and evidence audit

- The deterministic engine, not the Companion, owns metrics and pass or fail verdicts.
- The Prove evidence chain identifies the code hash, contract version, engine version, seed, metrics and verdict.
- The same contract and seed reproduce byte-identical canonical evidence.
- The deliberately broken controller exits with failure.
- The Python, interpreter, browser, contrast, world-sweep and Ollama figures correspond to executable checks or committed reports.
- The performance section preserves the measured frame rates and states that the 4.17 ms frame budget was not met.
- The human pilot is marked `ETHICS_PENDING`; it contains no participant rows or reported outcomes.
- Simulation is consistently described as a first-order, pre-build uncertainty-reduction tool, not a physical twin or safety certificate.
- Memory mechanisms are reported as implemented, while their causal efficacy remains unevaluated.

## Citation and presentation audit

- All 23 in-text citation keys resolve to bibliography entries.
- All 23 bibliography entries are cited in the text.
- No new source was introduced by this revision.
- The canonical source builds twice without undefined references or overfull boxes.
- The final PDF is 49 pages and the changed pages were visually inspected.
- No Unicode dash character occurs in the reviewed deliverables.

## Residual actions outside the artefact

1. Obtain institutional ethics approval before recruitment or data collection.
2. Run the human pilot only after approval and replace no planned result with synthetic personas.
3. Submit the final document through the university's required plagiarism and submission services.
4. Complete any executable signing only if a later distribution channel requires it.

These are external governance or future evaluation actions. They do not weaken the accuracy of the present dissertation because the document identifies each boundary explicitly.
