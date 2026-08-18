# Bibliography verification against live sources, 15 August 2026

Every one of the 26 entries in `docs/dissertation/Kodro_Dissertation.tex` was
checked against a live source. One real defect was found and fixed. The rest
matched.

This was run as a citation check, not a link check. A 200 response only proves
a URL resolves; it does not prove the page is the work the entry names. So for
every DOI the registrar's own metadata was pulled and its title, first author
and year compared against what the `.tex` claims, and for every URL-only entry
the page was fetched and read.

## Why this could be done now

The `CA2_INTEGRITY_AUDIT_2026-08-14.md` entries for MEDIUM 8 and LOW 11 both
said the check was impossible offline. That was wrong for the same reason the
BCS items were wrong: `WebFetch` and `WebSearch` fail on this host, and the
conclusion "therefore no network" was inferred from that rather than measured.
`curl` through the Bash tool has full network access. See
`2026-08-15-bcs-citations-and-aux-shadowing.md` for the first instance of this
same mistake.

## The one defect found

`reza2025` carried a title with two words that are not in the paper.

```
DOI  : 10.48550/arXiv.2506.05925
LIVE : Small Models, Big Support: A Local LLM Framework for
       Educator-Centric Content Creation and Assessment with RAG and CAG
TEX  : Small models, big support: a local LLM framework for
       teacher-centric content creation and assessment using RAG and CAG
```

`teacher-centric` should be `educator-centric` and `using RAG and CAG` should
be `with RAG and CAG`. Both were fixed at `Kodro_Dissertation.tex:1004`. The
sentence-casing is deliberate house style, applied to every article title in
this bibliography, and was left alone.

The author list was checked separately and was already correct:

```
DataCite creators: Reza, Zarreen | Mazur, Alexander | Dugdale, Michael T. | Ray-Chaudhuri, Robin
.tex             : Reza, Z., Mazur, A., Dugdale, M.T. and Ray-Chaudhuri, R.
```

The two body citations of `reza2025`, at `.tex:289` and `.tex:371`, describe
the paper as showing locally deployable models with retrieval to be feasible on
institutional hardware. That is what the paper is. Neither claim needed
changing.

## Registrar note

The `10.48550/arXiv.*` prefix is registered with **DataCite**, not Crossref.
`api.crossref.org` does not serve those DOIs. The arXiv Atom API
(`export.arxiv.org`) rate-limits this host hard: it returned `Rate exceeded.`
for every batch even at 5 IDs per call with 3.5 s spacing and exponential
backoff, and later timed out at 45 s. `https://api.datacite.org/dois/{doi}`
answered all 14 first time. Anyone repeating this check should go straight to
DataCite for arXiv and Crossref for everything else.

## Full result, 26 of 26

| key | source checked | code | title vs `.tex` |
|---|---|---|---|
| ahn2022 | DataCite | 200 | match |
| bcs2020 | https://www.bcs.org/media/11ofljxo/course-accreditation-guidelines.pdf | 200 | PDF, 798,814 bytes |
| bcscode | bcs.org code of conduct page | 200 | h1 `BCS Code of Conduct` |
| cemri2025 | DataCite | 200 | match |
| chen2021 | DataCite | 200 | match |
| dossantos2026 | DataCite | 200 | match |
| gazebo2026 | gazebosim.org/libs/sim | 200 | page reads `Gazebo Sim : A Robotic Simulator` |
| hu2023 | DataCite + amrl.cs.utexas.edu/codebotler | 200 / 200 | match |
| huang2025 | Crossref `10.1145/3703155` | 200 | match |
| khati2026 | DataCite | 200 | match |
| lee2025 | DataCite | 200 | match |
| lewis2020 | DataCite | 200 | match |
| liang2023 | Crossref | 200 | match |
| openroberta2026 | lab.open-roberta.org | 200 | title `Open Roberta Lab` |
| papert1980 | none | n/a | print book, no URL in the entry, nothing to check online |
| reza2025 | DataCite | 200 | **was a mismatch, fixed, now matches** |
| shinn2023 | proceedings.neurips.cc | 200 | page title is the entry title verbatim |
| sun2025 | DataCite | 200 | match |
| tao2024 | DataCite | 200 | match |
| tobin2017 | Crossref | 200 | match |
| trinket2026 | trinket.io/announcement | 200 | h1 `Update about the future of Trinket` |
| vex2026 | education.vex.com lesson page | 200 | h1 `Lesson 1: Getting Started with VEXcode VR` |
| wang2023 | DataCite | 200 | match |
| wang2026 | DataCite | 200 | match |
| webots2026 | cyberbotics.com/doc/guide/foreword | 200 | see the note below |
| wu2025 | DataCite | 200 | match |

Totals: 14 arXiv DOIs through DataCite, 3 Crossref DOIs, 9 URL fetches (one
entry, `hu2023`, has both a DOI and a project site), 1 print source. Every DOI
title matched its `.tex` title exactly after the `reza2025` fix.

### The Webots entry, stated precisely

`https://www.cyberbotics.com/doc/guide/foreword` returns 200 but the served
HTML is a shell; the guide text is fetched client-side, so `curl` sees only the
navigation. The foreword itself was confirmed from its source instead:

```
https://raw.githubusercontent.com/cyberbotics/webots/master/docs/guide/foreword.md
HTTP=200 SIZE=653
## Foreword
Webots is an open-source three-dimensional mobile robot simulator.
```

So the cited document exists and is what the entry says it is. What was *not*
done is a rendered-page read at the cited URL. Recording that distinction
rather than letting a 200 stand in for it.

## The Trinket claim, checked line by line

This is the source audit LOW 11 was waiting for. `.tex:296` makes four factual
claims about the Trinket shutdown. The announcement page supports all four.

| claim at `.tex:296` | page text |
|---|---|
| "will shut down on 31 August 2026" | "Trinket will be shutting down on August 31, 2026." |
| "publishing the source does not preserve the service" | "We have released the Trinket software as open source. We want to be clear about what this means: The trinket.io website will shut down. Open source does not mean the site stays online." |
| "every pupil loses saved work not exported before the deadline" | "Please download anything you want to keep before the shutdown." |
| "That date falls eleven days before this dissertation is due" | 31 August to 11 September is eleven days. Arithmetic, not a source claim |

The entry records an access date of 27 July 2026. That is when the author read
it and is left as is. This check was run on 15 August 2026 and the page still
carries the same announcement.

## What this does not close

The page limit. That is audit HIGH 4 and it needs the current Canvas brief, not
a web fetch. `docs/ca2/CLAIM_LEDGER.md` item 8 still forbids stating either the
page limit or the video duration as settled, and that stands.

## Reproducing this

The scripts live in the session scratchpad, not in the repo, because they are a
one-off audit rather than a gate. The method is three commands:

```bash
curl -sS "https://api.datacite.org/dois/10.48550/arXiv.2506.05925"
curl -sS "https://api.crossref.org/works/10.1145/3703155"
curl -sS -L -A "Mozilla/5.0" -o page.tmp -w "%{http_code} %{content_type} %{size_download}\n" <url>
```

Two things to know if you rebuild the extractor. In this bibliography an
article title is plain text between the year and the italic venue, while a book
or web page puts its title inside `\textit{}`; pulling `\textit{}`
unconditionally returns the venue and produces false mismatches. And Windows
`curl.exe` cannot write to `/dev/null`, so `-o` needs a real temp file or every
check fails with `curl: (23) client returned ERROR on write`.
