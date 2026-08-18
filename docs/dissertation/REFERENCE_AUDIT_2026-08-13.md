# Reference integrity audit - 13 August 2026

This is the current structural and incremental source audit for the canonical
LaTeX bibliography. The detailed item-by-item verification of the pre-existing
records remains in `REFERENCE_AUDIT_2026-07-17.md`.

## Structural result

- 26 distinct in-text citation keys
- 26 distinct `\bibitem` keys
- 0 missing bibliography entries
- 0 uncited bibliography entries
- 0 unresolved citation warnings after the final multi-pass build

## New or rechecked primary records

| Key | Primary record | Result |
| --- | --- | --- |
| `bcs2020` | [BCS course-accreditation guidelines](https://www.bcs.org/media/11ofljxo/course-accreditation-guidelines.pdf) | Verified; corrected from 2022 to the document's January 2020 date |
| `uol2026ai` | [University of Liverpool generative-AI guidance](https://www.liverpool.ac.uk/about/the-university/reports-policies-and-governance/ai-at-liverpool/policies-and-guidance/guidance-learning-teaching-and-assessment/) | Verified against the university's current guidance page |
| `trinket2026` | [Trinket shutdown announcement](https://trinket.io/announcement) | Verified against the service owner's announcement |

## Integrity rules applied

- Publisher, proceedings, project-owner, DOI or institutional records are used
  instead of search-result snippets wherever available.
- ArXiv work is labelled as arXiv work unless a peer-reviewed publication is
  cited separately.
- Sources support background and design choices; they are not used to imply an
  unrun participant study or physical validation.
- Access dates remain visible for changeable web resources.

## AI assistance disclosure

OpenAI Codex assisted with locating and comparing records. The linked primary
records and committed bibliography are the evidence trail; the student remains
responsible for final source checking.
