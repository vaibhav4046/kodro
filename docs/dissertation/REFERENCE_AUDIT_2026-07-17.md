# Reference integrity audit — 17 July 2026

> **Superseded in part. Read the addendum at the foot of this file before
> relying on the coverage claim below.** The table dated 17 July 2026 covers 23
> of the 25 entries now in the canonical bibliography. Two entries were added
> after this audit ran and have not been checked against a primary record:
> `trinket2026` and `bcscode`.

This audit covered every item that was in the canonical LaTeX bibliography on
17 July 2026. Titles, authors, dates, venues and persistent identifiers were
checked against a publisher, proceedings, project-owner or arXiv record. Search
snippets were not treated as evidence where a primary record was available.

| Key | Authoritative record checked | Result |
| --- | --- | --- |
| `ahn2022` | [arXiv 2204.01691](https://arxiv.org/abs/2204.01691) | Verified |
| `cemri2025` | [arXiv 2503.13657](https://arxiv.org/abs/2503.13657) | Verified |
| `chen2021` | [arXiv 2107.03374](https://arxiv.org/abs/2107.03374) | Verified |
| `dossantos2026` | [arXiv 2601.19510](https://arxiv.org/abs/2601.19510) | Verified |
| `gazebo2026` | [Gazebo Sim documentation](https://gazebosim.org/libs/sim/) | Verified |
| `hu2023` | [arXiv 2311.11183](https://arxiv.org/abs/2311.11183) and [CodeBotler project](https://amrl.cs.utexas.edu/codebotler/) | Verified |
| `huang2023` | [ACM TOIS record](https://doi.org/10.1145/3703155) | Corrected to the 2025 journal publication, volume 43(2), article 42 and the ACM DOI |
| `khati2026` | [arXiv 2601.19106](https://arxiv.org/abs/2601.19106) | Verified |
| `lee2025` | [arXiv 2504.20799](https://arxiv.org/abs/2504.20799) | Verified |
| `lewis2020` | [NeurIPS 2020 proceedings](https://proceedings.neurips.cc/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html) | Verified |
| `liang2023` | [IEEE DOI 10.1109/ICRA48891.2023.10160591](https://doi.org/10.1109/ICRA48891.2023.10160591) | Corrected from the arXiv DOI to the peer-reviewed ICRA record and pages 9493–9500 |
| `openroberta2026` | [Open Roberta Lab](https://lab.open-roberta.org/) and [Fraunhofer project page](https://www.open-roberta.org/about/) | Verified |
| `papert1980` | [WorldCat record](https://search.worldcat.org/title/1036709966) | Verified |
| `reza2025` | [arXiv 2506.05925](https://arxiv.org/abs/2506.05925) | Corrected the title to “Teacher-Centric” |
| `shinn2023` | [NeurIPS 2023 proceedings](https://proceedings.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html) | Corrected the author list; the proceedings name Gopinath rather than Berman |
| `sun2025` | [arXiv 2501.15134](https://arxiv.org/abs/2501.15134) | Verified |
| `tao2024` | [arXiv 2404.14387](https://arxiv.org/abs/2404.14387) | Verified |
| `tobin2017` | [IEEE DOI 10.1109/IROS.2017.8202133](https://doi.org/10.1109/IROS.2017.8202133) | Corrected from the arXiv DOI to the peer-reviewed IROS record |
| `vex2026` | [VEXcode VR lesson](https://education.vex.com/stemlabs/cs/cs-level-1-vexcode-vr-blocks/introduction-and-fundamentals/lesson-1-getting-started-with-vexcode-vr) | Verified |
| `wang2023` | [arXiv 2305.16291](https://arxiv.org/abs/2305.16291) | Verified |
| `wang2026` | [arXiv 2604.10929](https://arxiv.org/abs/2604.10929) | Verified |
| `wu2025` | [arXiv 2510.16079](https://arxiv.org/abs/2510.16079) | Verified |
| `webots2026` | [Webots user guide](https://www.cyberbotics.com/doc/guide/foreword) | Verified |

## Changes made

Four bibliography records required substantive correction: Huang et al.,
Liang et al., Reza et al. and Tobin et al. The Shinn et al. author list also
required correction. No unverified citation was retained as a factual support.

## AI assistance disclosure

OpenAI Codex assisted with locating and comparing records. The committed URLs
above are the evidence trail; the author remains responsible for checking the
records and the final bibliography.

---

## Addendum — 14 August 2026

The bibliography has grown from 23 entries to 25 since the audit above was run.
The two new entries are recorded here as **unchecked**, not as verified. Neither
could be checked in the session that produced this addendum, because no external
record could be fetched from it; the rows below were produced by diffing the
`\bibitem` keys in `Kodro_Dissertation.tex` against the table above, not by
opening any source.

| Key | Status | What still has to be done before submission |
| --- | --- | --- |
| `trinket2026` | **VERIFY** | Cited in Chapter 2 for a load-bearing factual claim about a third party: that Trinket announced a shutdown on 31 August 2026, that publishing the source does not preserve the service, and that unexported pupil work is lost at the deadline. The entry carries an access date of 27 July 2026, which is after this audit ran, so the author may already have read it; there is no evidence trail either way. Re-open <https://trinket.io/announcement>, confirm the shutdown date and the three specific consequences the dissertation attributes to the announcement, and archive a copy, because a shutdown notice is exactly the kind of page that disappears once the shutdown happens. |
| `bcscode` | **VERIFY** | Cited in the ethics chapter for the four duties of the BCS Code of Conduct. The bibliography entry deliberately carries a visible `[VERIFY VERSION, URL AND ACCESS DATE BEFORE SUBMISSION]` marker inside the PDF. The version year (2022), the URL and the access date are all unconfirmed. Fetch the current code from bcs.org, confirm the four duty headings quoted in the text, then replace the marker with the real version and access date. **Do not delete the marker without doing the check** — it is there so that an unverified citation cannot pass as a verified one. |

No other bibliography entry changed. The 23 rows in the table above still stand
as audited on 17 July 2026 and were not re-checked here.
