# Dissertation revision tracking

## Paper information

| Field | Value |
| --- | --- |
| Title | Kodro: An Offline, Grounded Platform for Designing Robots and Testing Their Behaviour in Disclosed-Fidelity Simulation |
| Revision round | Candidate release alignment |
| Date | 18 July 2026 |
| Source of review | Unified final mandate and shipped-evidence audit |
| Canonical source | `Kodro_Dissertation.tex` |

## Revision tracking table

| # | Type | Issue | Resolution | Location | Status |
| ---: | --- | --- | --- | --- | --- |
| 1 | Major | Dissertation described an obsolete four-stage interface | Reframed the primary journey as Design, Prove and Build, with More Tools and mobile bottom navigation | Sections 4.4 and 9.1 | RESOLVED |
| 2 | Major | Stage responsibilities were described in prose but lacked an explicit systems model | Added an input-process-output table for all three primary stages | Section 4.4.1, Table 4.2 | RESOLVED |
| 3 | Critical | Evaluation did not include the new deterministic proof authority and reproducibility record | Added four contracts, twenty seeded runs, canonical manifest fields, baseline comparison, byte-identical replay and broken-controller failure | Abstract and Sections 6.1, 6.2, 6.11, 9.1 | RESOLVED |
| 4 | Critical | Several future studies did not match the approved scope and could diffuse the research question | Replaced them with one bounded ethics-pending pilot comparing deterministic evidence with the raw console across three diagnosis missions | Section 6.9 and `docs/study` | RESOLVED |
| 5 | Major | Professional issues were too compressed | Kept Ethics separate and expanded BCS alignment, safety, privacy, accessibility, security, intellectual property and sustainability | Chapter 8 | RESOLVED |
| 6 | Major | Test, browser and renderer figures referred to an older source state | Replaced them with the 18 July candidate measurements and retained the negative renderer result | Abstract, Sections 6.2, 6.3, 6.11 and 9.1 | RESOLVED |
| 7 | Editorial | Contents page joined a chapter title and page number | Added consistent chapter leaders through the existing `titletoc` package | Contents pages | RESOLVED |
| 8 | Deliberate limitation | No human participant result exists | Study remains `ETHICS_PENDING`; no recruitment, participant row or outcome is reported | Declaration, Sections 6.9, 8.1 and 9.3 | DELIBERATE_LIMITATION |
| 9 | Deliberate limitation | Simulation cannot certify physical behavior or safety | Preserved the kinematic boundary in the Abstract, Prove report, limitations and conclusion | Abstract, Chapters 6, 7 and 9 | DELIBERATE_LIMITATION |
| 10 | Deliberate limitation | Experience memory has no causal efficacy result | Retained objective O6 as incomplete and moved any study of this mechanism to future work | Sections 1.3.1, 4.12, 7.7 and 9.1 | DELIBERATE_LIMITATION |

## Final checks

- [x] Canonical LaTeX builds twice without undefined references or overfull boxes.
- [x] Final PDF is no more than 50 pages.
- [x] Changed pages were rendered and visually inspected.
- [x] No Unicode dash appears in the canonical source.
- [x] No new literature citation was introduced by this revision.
- [x] Every numerical product claim in the revised passages has a repeatable command or committed evidence artifact.
- [x] No human study result, physical equivalence, safety certification or guaranteed frame rate is claimed.
