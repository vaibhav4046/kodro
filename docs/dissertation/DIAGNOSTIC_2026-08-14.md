# Dissertation diagnostic — Kodro / COMP702

> **STALE. Do not act on the line numbers or the build figures below without re-running
> them.** This diagnostic was taken against an 879-line `.tex` that compiled to 51 pages.
> The source is now 1066 lines and compiles to 59 pages, so every `:NNN` reference in this
> file points at the wrong line and the build block is superseded. The *findings* mostly
> still hold and the rubric analysis in Part 7 is unaffected by line drift, but each one
> must be re-located in the current source before it is fixed. Superseded by
> `CA2_INTEGRITY_AUDIT_2026-08-14.md` where the two overlap.
>
> **Three classes of finding below are closed, not merely drifted.** First, every
> bibliography finding: this file records 25 entries with `trinket2026` and
> `bcscode` unchecked, and a visible `[VERIFY VERSION, URL AND ACCESS DATE
> BEFORE SUBMISSION]` placeholder in the PDF. The bibliography now holds 26
> entries, all 26 were checked against a live registrar record or a fetched page
> on 15 August 2026, and the placeholder is gone because the check behind it was
> done. See `.kodro/ca2-evidence/2026-08-15-bibliography-verification.md` and
> `.kodro/ca2-evidence/2026-08-15-bcs-citations-and-aux-shadowing.md`. The
> reason this file gives for why those entries could not be checked, that no
> external record could be fetched, was an inference from `WebFetch` failing
> rather than a measurement; `curl` through the Bash tool has network access on
> this host.
>
> Second, the sentence a few lines below that the module limit is 50 pages
> excluding the appendix. That is stated here as settled and it is not. Which
> page count the brief means is an open author action, recorded in
> `docs/ca2/FINAL_CHECKLIST.md` and as HIGH 4 in
> `CA2_INTEGRITY_AUDIT_2026-08-14.md`, and it stays open. Do not quote the page
> arithmetic in this file as a compliance verdict.
>
> Third, every Python test count here is superseded. This file reasons
> throughout from 1,489 collected and 1,488 passed at 90.97 percent, measured
> against a smaller suite, including in the Part 7 grade table. The artefact
> `docs/eval/test_suite.json` now records 1,639 collected and 1,638 passed at
> 90.90 percent against an 85 percent gate, pinned to commit `aa174cf` on a
> clean tree. The grade reasoning does not turn on which of the two is current,
> but do not quote either figure out of this file.

Produced 14 August 2026 against `Kodro_Dissertation.tex` (879 lines) at working-tree
commit `02dd047` (dirty). No text in the `.tex` has been changed. This document is the
diagnostic the brief requires before any rewriting begins.

**Evidence rule applied throughout.** Every number below is either read out of the `.tex`,
read out of a machine-generated evidence file, or measured by a command run today. Claims I
could not verify are marked `VERIFY`. Nothing is estimated and nothing is invented.

**Build state, measured today:**

```
pdflatex ×2, PASS2_EXIT=0
Output written on Kodro_Dissertation.pdf (51 pages, 1053251 bytes)
15 Overfull/Underfull warnings
```

ToC page map: Ch1 p1 · Ch2 p5 · Ch3 p8 · Ch4 p11 · Ch5 p18 · Ch6 p24 · Ch7 p34 · Ch8 p37 ·
Ch9 p38 · **Appendix A p42** · Appendix B p43. Front matter roman ii–v.

**Body = pages 1–41.** The module limit is 50 pages *excluding the appendix*. There is
roughly 9 pages of real headroom. Earlier working notes in this project said "50/50, zero
headroom" — that counted the appendix and was wrong. The strategic consequence is large:
this document has room to **add** missing analysis. It does not need cutting.

---

## Part 1 — Dissertation research map

| Element | What the document actually says | Status |
|---|---|---|
| **Problem** | `:156–162` Three linked failures: (a) the idea→hardware gap is expensive and physically risky; (b) LLM-written control code is plausible and wrong in a way beginners cannot detect; (c) a simulator reporting a tidy number without disclosing trust invites the same misplaced confidence. | Clear and well-argued. The strongest prose in the document. |
| **Problem statement** | `:167` "How can a free, offline-first application let a builder import a robot specification, or a non-expert design one from a catalogue, and test that design in an agent-populated simulation before buying hardware, while stating the fidelity of every figure and rejecting generated code that exceeds the active build's capabilities?" | This is an **engineering feasibility question**, not a research question. It asks *can this be built*, which is answerable by building it. It is not falsifiable. |
| **Research question(s)** | None. There is no sentence anywhere in Ch1–Ch3 labelled or functioning as an RQ. | **MISSING.** Biggest single structural hole. |
| **Gap** | `:239` "Within the products reviewed for this project, none combined a user-entered physical specification, explicit per-figure fidelity labels, lessons, build-aware code generation and deterministic rejection in an offline-first interface." | This is a **product-feature gap**, not a knowledge gap. It is honestly hedged as "a bounded market observation, not proof". No gap anywhere in the document is derived from the literature. |
| **Aim** | `:172` A working offline proving ground where a build is validated before purchase, every figure carried at a stated fidelity. | Coherent. Matches the artefact. |
| **Core objectives** | `:178–183` O1 specification-driven behaviour · O2 three-tier fidelity disclosure · O3 sandboxed execution and scoring · O4 randomised multi-seed validation · O5 grounded local assistance with deterministic fallback · O6 refinement from memory without retraining. | O1–O5 each carry a testable *Done when*. **O6 is declared incomplete in its own text** (`:183`). |
| **Secondary objectives** | `:190–193` O7 two editors one meaning · O8 one shared motion model · O9 legible realism on a laptop · O10 an honest record. | Only **O8** has a *Done when*. O7, O9, O10 have none. O9's criterion is "read as believable in a screenshot" — unmeasurable as written. |
| **Contribution** | `:213` "The contribution is not a new algorithm… an implemented combination of specification import, three-tier fidelity disclosure, shared closed forms, build-aware generation and deterministic rejection in one early design and learning tool." | Honestly stated and correctly modest. But it is a *systems integration* contribution asserted against a market survey, not positioned against a research literature. See Part 2 §W2. |
| **Methodology** | Not named as a methodology anywhere. In practice: design-and-build (artefact-centred), evaluated by automated verification, seeded benchmark runs, LLM-simulated persona inspection and an adversarial review panel. | **No methodology chapter and no named research method.** The word "methodology" does not head any section. |
| **Evidence base** | Automated test matrix, interpreter/grader/worlds/web harnesses, KodroBench seeded runs, renderer timing, LLM persona panels, adversarial defect panel. | Machine evidence is genuinely strong. Human evidence is **zero** and the document says so. |
| **Findings** | Ch6 `:494–675`. Deterministic gates pass; a deliberately broken controller fails; own fine-tunes scored 0.00 success / 1.00 invention; software-rasterised renderer target "Not met"; a latent collision-grader bug found. | Mixture of pass-reporting and genuine negative findings. The negative findings are the credible part. |
| **Limitations** | Ch7 `:676–711`. No physical validation, no human study, O6 unproven, performance floor missed. | Present and honest, but omits the four threats listed in Part 2 §W4. |
| **Rubric coverage** | See Part 7. | Grounded in the real supervisor marking profile recovered today. |

### The document's own internal contradiction

`:175` — "These define the artefact. **The platform must achieve all of them to count as a
working system.**"

`:183` — O6 — "*Status at the evaluated build:* storage and retrieval are implemented, but
**the causal efficacy criterion has not been demonstrated**."

By the document's own rule, the system does not count as working. This is a self-inflicted
wound: an examiner who reads Ch1 carefully has been handed the sentence that fails the
project. It costs one clause to fix.

---

## Part 2 — The biggest weaknesses, ranked

### W1 — Synthetic-persona labelling holds in prose and collapses in every table
**Severity: highest. This is an academic-integrity exposure, not a presentation nit.**

`:716`, inside the **Ethics** section, states: "The evaluation personas are language-model
constructs, not people. **The text labels them as simulated wherever they appear.**"

That sentence is false as written, and it is checkable in ninety seconds by anyone marking
the document:

| Location | What the table shows | What a reader sees |
|---|---|---|
| `:512–513` | "Persona review \| Whole-product usability across user types \| **Done**" | An unqualified completed usability study |
| `:566–572` | Columns "Personas / Mean (/10)", n = 50, 12, 50, 50, 8 | A 50-participant rating study |
| `:613` | Rows "Low-vision and EAL **10/10**", "Beginner and younger learner **10/10**" | An accessibility study with 100% completion by low-vision participants |
| `:663` | "a single analyst simulated every persona" | Reads as human role-play, not LLM generation |

Tables are read out of order and quoted out of context. A claim of universal labelling that
is contradicted by four tables in the same chapter is worse than no claim, because it
converts an honest limitation into a verifiable inaccuracy sitting in the ethics section.

**Fix:** make `:716` true. Either label every table at point of use, or change `:716` to
state precisely where the labelling appears. Do both. This is the single highest-value edit
in the document and it is cheap.

### W2 — Most of the shipped product is undeclared: the schools half has no chapter, no section, and no evaluation row
**Severity: joint-highest. This reads as undeclared work, which is costlier than a weak section.**

`:254` states the school pupil is "its third and now largest user" and that the lesson
library, marking, hints and reading-age handling "**now constitute most of the product**".

Verified by grep against the built `.toc` and the `.tex` today:

```
Kodro_Dissertation.toc — headings matching lesson|curricul|pupil|teacher|school|mark : 0
Kodro_Dissertation.tex — "curricul" 0 · "DfE" 0 · "programme of study" 0
                         "markbook"  0 · "Lesson Studio" 0 · "Parsons" 0
                         ("lesson" appears 30× in prose, never as a heading)
```

So the thing the document calls *most of the product* has **zero** presence in the contents
page and **zero** presence in the design or implementation structure. Chapter 4 gives
sections to KRS import (4.5) and fidelity tiers (4.6); Chapter 5 gives one to KRS import
(5.3) and none to the grader, the lesson schema or the Lesson Studio.

What exists in the code archive and is never named in the dissertation:

- `src/kodro/lessons/library/*.yaml` — 24 lessons carrying `curriculum_refs`
  (**DfE-00171-2013** cited verbatim), `key_stage`, `reading_age`, `ct_concepts`
- `assets/web/markbook.js` — `markbookCsv()` / `strengthsCsv()`, SIMS/Arbor export
- `assets/web/lesson-studio.js` (28.7 KB) + `.jsx` (32 KB); `lesson-grader.jsx` (52 KB)
- `ui/teacher_dashboard.py`, `lesson_editor.py`, `lessons/grader.py`, `lessons/schema.py`
- 13 teacher documents at `docs/teachers/`, including `curriculum-mapping.md` and
  `scheme-of-work.md` — never cited

And the evaluation chapter cites **2 of 9** `docs/eval/` artefacts and **1 of 27**
`scripts/qa_*.mjs` harnesses. The uncited ones include the strongest classroom evidence in
the repository: `qa_grader` (dual-engine parity and solvability), `qa_lesson_studio` (79/79),
`qa_markbook`, `qa_pupilstore`, `qa_pupil_errors`, `qa_parsons`, `qa_construct_liveness`,
`qa_fuzz` (cross-engine grading parity), `qa_scenario_parity`.

An examiner diffing the PDF against the code archive finds a curriculum-mapped 24-lesson
product with a Lesson Studio, a teacher markbook and fourteen marking gates that the
dissertation does not acknowledge. **The evidence is already measured and already passing.
It simply is not in the document.** That makes this the highest-return fix available: it adds
marks in Design, Implementation, Evaluation and Testing simultaneously, and the 9 pages of
headroom exist to hold it.

Compounding contradiction, verified by direct read: `:253` "Kodro is built for **two** related
users" — then `:254`, one line later and *inside the who-it-is-not-for paragraph*, introduces
"its **third** and now largest user". A largest user introduced in a not-for paragraph, after
the section declares two, reads as a patch rather than a design.

### W3 — No research question, and the gap is commercial rather than scholarly
There is no RQ. The problem statement is a feasibility question. The gap at `:239` is a
feature-matrix gap over *products*, not a gap in *knowledge*, and no gap anywhere is derived
from a cited source. Consequence: the literature review does not motivate the work, the work
does not answer a question, and the evaluation therefore cannot be judged against anything
except "did the software get built". This is what caps an artefact-strong project at a B.

### W4 — Citations are concentrated in one 29-line chapter; five whole chapters have none
Measured density, key instances per chapter:

```
Ch1 Introduction        0     Ch2 Background         23
Ch3 Requirements        0     Ch4 Design             0
Ch5 Implementation      0     Ch6 Evaluation         3
Ch7 Discussion          0     Ch8 Professional       0
Ch9 Conclusion          0
```

88% of citations sit in Ch2. **Ch4 Design and Architecture is 109 lines with zero
citations** — every architectural rationale is asserted. **Ch7 Discussion frames its
limitations against no literature at all.** And `:723` invokes "the BCS criteria" with **no
citation to the BCS Code of Conduct or any professional standard** — in the exact category
the supervisor already graded **D**.

### W5 — Threats to validity omits the four threats that actually bite
Ch7 covers no physical validation, no human study, O6 unproven, performance floor missed. It
does not mention:

1. **Automated verification is author-written against the author's own specification.** 1,488
   passing tests demonstrate internal consistency, not correctness against an external
   standard. Nowhere stated.
2. **The adversarial panel's 85 defects came from unreproducible session notes** (`:630`).
   Not listed as a validity threat.
3. **Self-selected metrics.** Every measure was chosen by the person the measures assess.
4. **No blinding, no pre-registration, no ecological validity** for any persona result.

An examiner who spots these before the document admits them reads the omission as a lack of
critical self-awareness — which is a scored rubric category.

### W6 — Two conclusion sentences overreach, one contradicting Ch6 directly
`:754` — "a learner can acquire the programming and robotics concepts needed to test an
idea."

`:663` — "**None of these methods measures learning.**"

These cannot both stand. `:754` is an unevidenced learning-outcome claim in the closing
statement, which is the paragraph most likely to be read closely. `:732` — "The simulation
reduces early design uncertainty" — is stated flatly with no hedge and no supporting
measurement; the correct form is the one used 22 lines later at `:754`, "the strongest
justified claim is that Kodro reduces uncertainty".

*(Six, not five. The brief asked for five; the drift audit surfaced W2 after the other five
were written and it outranks most of them. Cutting one to hit the number would be dishonest
prioritisation, so all six stand, ranked.)*

---

## Part 3 — The five strongest elements

### S1 — Negative results are reported, unhedged, in the body
Software rasterisation target "Not met" (`:548–549`). Own fine-tuned models scored **0.00
success / 1.00 invention** (`:648–649`). A latent collision-grader bug disclosed (`:626`).
O6 marked incomplete in the objective itself. Most student dissertations bury these. This
one leads with them, and it is the most examiner-persuasive quality in the document.

### S2 — `:630` — "a passing test suite is not the same thing as a sound product"
A single sentence that correctly frames the limit of the entire evidence base. Keep it,
promote it, and build the missing threats-to-validity section around it.

### S3 — The evidence chain is machine-generated and self-disclosing
`docs/eval/test_suite.json` carries its own provenance warning:

```
workingTreeClean: false
untrackedTestFiles: [test_kodrobench_cli.py, test_prove_cli.py, test_urdf_io.py,
                     test_web_bridge_export.py, test_web_startup.py]
provenanceWarning: "This run was taken on the working tree, not on a tagged commit…
                    the counts below include them and are NOT reproducible by
                    checking out a tag."
```

A results file that warns the reader about its own reproducibility is a genuinely unusual
piece of research hygiene.

> **Qualified, later the same day.** The strength is real but it currently stops at the disk.
> This exact file has never been committed, so a reader who clones the repository does not get
> the provenance warning quoted above — they get no file at all. See "The Declaration calls
> four artefacts committed" in Part 5. S3 stands as a description of how the artefacts are
> *built*; it does not yet describe what an examiner can *reach*.

### S4 — The negative control is real
An intentionally broken controller is run and fails (`:528`). Very few student evaluations
include a deliberate failure case.

### S5 — Scope discipline
`:196–197` out-of-scope and `:254` "who it is not for" are specific, unflattering and
correct. `:213` "The contribution is not a new algorithm" is exactly the right register — it
pre-empts the examiner's first objection rather than inviting it.

---

## Part 4 — Missing evidence and research

**Evidence gaps (things no amount of writing can fix):**

| Gap | Can it be closed before 11 Sep? | Note |
|---|---|---|
| Any human user, of any kind | **No** — needs ethics approval | Already disclosed. Leave disclosed. |
| Physical robot validation | **No** — no hardware | Already disclosed. |
| O6 memory-efficacy ablation | **Possibly** — it is a machine experiment, no humans needed | This is the one incomplete core objective. An ablation over repeated related tasks with memory on/off is runnable offline. If it runs, O6 closes and W-contradiction §1 dissolves. If it runs and shows no effect, report that — a measured null is worth more than an open objective. |
| A negative control for the 40/40 behaviour funnel (`:589–592`) | **Yes, cheaply** | Prove already has a deliberately broken controller. The behaviour suite has no equivalent. 40/40 with no negative control is weak evidence; 40/40 plus a known-bad case that fails is strong. |
| Round 5's mean fall 7.36 → 6.40 (`:571–572`) | **Yes** — it is already measured | The only downward data point in the document is never mentioned in prose. Explaining a regression is the most credible thing an evaluation chapter can do. Currently it looks avoided. |

**Evidence you already have and never cited.** This is the cheapest set of marks in the
project. The evaluation chapter cites 2 of 9 `docs/eval/` artefacts and 1 of 27 QA harnesses.
Everything below is already measured, already passing, already in the repository:

| Artefact / harness | What it evidences | Currently cited? |
|---|---|---|
| `qa_grader` (55/55) | Dual-engine marking parity and lesson solvability | No |
| `qa_lesson_studio` (79/79) | Lesson Studio document + store correctness | No |
| `qa_fuzz` | Cross-engine grading parity under fuzzing | No |
| `qa_markbook` | CSV export traps against a seeded register | No |
| `qa_pupilstore` | EMA parity between JS and Python pupil stores | No |
| `qa_pupil_errors` | Interpreter errors → actionable pupil-facing text | No |
| `qa_construct_liveness` (30/30) | Taught constructs are live in the interpreter | No |
| `qa_scenario_parity`, `qa_parsons`, `qa_honesty`, `qa_contrast`, `qa_physics` | Various | No |
| `ui_eval.json` (65/65, verdict PASS) | Browser behaviour, layout, modals on the real bundle | No |
| `persona_eval_results.json`, `prove_baseline.json`, `prove_report.md`, `performance_eval*.json` | — | No |

**Research gaps (reading that must happen):**

1. **Counter-positions to constructionism.** `:223` rests the entire learning-science warrant
   on Papert (1980) and nothing else. The minimal-guidance critique literature is the
   standard counter and its absence is conspicuous.
2. **Post-1980 empirical education research.** There is none. One 46-year-old monograph
   carries every claim about how people learn.
3. **Sim-to-real beyond domain randomisation.** `:226` cites Tobin et al. only. System
   identification, real-to-sim and differentiable simulation are the obvious neighbours.
4. **The BCS Code of Conduct itself.** Cited nowhere, invoked at `:723`.
5. **`khati2026` and `lee2025` are in the bibliography but not cited at `:633`**, which is
   exactly where the interface-hallucination novelty claim is made. Free win.

---

## Part 5 — Citation risks

Full inventory, **recounted on 14 August against the current `.tex`: 25 `\bibitem` entries,
26 `\citep`/`\citet` commands, 25 distinct bibliography keys, 25 distinct cited keys.**
Cited-but-missing: **0**. Listed-but-uncited: **0**. No duplicate keys. The key sets match
exactly, which the build corroborates independently — two `pdflatex` passes report zero
undefined references or citations.

> **Corrected.** An earlier draft of this section reported 24 entries, 25 `\cite` commands
> and 24 distinct keys. All three were wrong. The count missed `bcscode`, and the scan
> pattern looked for `\cite{`, which this document never uses — every in-body citation is
> `\citep` or `\citet` (natbib), and every bibliography entry carries an optional
> `\bibitem[Label]{key}` argument that a naive `\bibitem{` pattern skips. The figures above
> come from a corrected scan that handles both forms.

### Source quality — this is the risk

Re-derived over all 25 entries, classified by the venue each entry actually prints:

| Class | Count | Share |
|---|---|---|
| Peer-reviewed papers (ACM TOIS, NeurIPS ×2, ICRA, IROS) | 5 | 20.0% |
| Scholarly book (`papert1980`) | 1 | 4.0% |
| **arXiv preprints, no peer-reviewed venue printed** | **13** | **52.0%** |
| Vendor / product documentation | 5 | 20.0% |
| Professional-body code of practice (`bcscode`) | 1 | 4.0% |
| **Non-peer-reviewed total** | **19** | **76.0%** |

Three quarters of the reference list is not peer reviewed. For a category the supervisor
grades explicitly ("References"), that is the exposure. Note that the arXiv share is
partly a citation choice rather than a hard fact about the literature: `ahn2022` (SayCan)
and `wang2023` (Voyager) are both cited from arXiv here. If either has since appeared at a
peer-reviewed venue, citing that venue instead would move it out of the 13 at no cost to
the argument — but **that has not been checked in this session and must not be assumed**;
network verification was unavailable (see below).

### Per-entry defects found

- `papert1980` — the only entry with **no DOI, URL or ISBN**.
- `trinket2026` — **no venue at all**, a bare self-published URL, and it is the sole support
  for the offline-first architectural argument at `:243`.
- `lewis2020` — prints an **arXiv DOI under a NeurIPS venue**. Mismatch.
- `huang2023` — key says 2023, entry is a **2025** ACM TOIS publication.
- `webots2026` — label "Webots", author "Cyberbotics", and **mis-sorted after `wu2025`**.
- `bcscode` — carries a **visible `\textbf{[VERIFY VERSION, URL AND ACCESS DATE BEFORE
  SUBMISSION]}` marker that renders inside the PDF**, and has **no access date**. This is
  the one defect a marker sees without looking for it. It is deliberate and must not be
  silently deleted: removing the marker without doing the check would convert an honest
  flag into a false claim of verification. Only the author can close it, by opening the BCS
  page, recording the version and the date it was read, and then removing the marker.
- **Eight 2026-dated entries** — `dossantos2026`, `gazebo2026`, `khati2026`,
  `openroberta2026`, `trinket2026`, `vex2026`, `wang2026`, `webots2026`. (An earlier draft
  of this line said "six" and then listed seven; the machine count is eight.) Network access
  is unavailable in this session, so **none of their content has been verified**. Status:
  `VERIFY`. They are not fabricated as far as I can tell — they resolve to real keys used
  consistently — but I have not read them and will not say I have.

**Network verification was retried on 14 August and is still unavailable.** Both `WebFetch`
and `WebSearch` fail with the same error:

```
There's an issue with the selected model (auto/best-free).
It may not exist or you may not have access to it.
```

That is a broken local gateway, not a property of the sources. It means `bcscode` and
`trinket2026` could not be closed out in this session by any means short of inventing an
access date, which the brief forbids. **Both remain open, and both need the author.**

### Load-bearing claims resting on unverified or absent sources

| Line | Claim | Support | Status |
|---|---|---|---|
| `:231` | "hallucination is **intrinsic** to these models rather than a defect that a future version will simply remove" | `huang2023` alone | `VERIFY` — a strong universal claim on one survey |
| `:223` | "the durable finding that people learn most deeply when they build something external" | `papert1980` alone | `VERIFY` — entire learning warrant, one 1980 source |
| `:243` | Trinket "used across a great many United Kingdom Key Stage 3 and GCSE teaching resources" | **none** | `UNSUPPORTED` — and it carries the offline-first argument |
| `:158` | Professional simulators "assume a workstation, a graphics card, an internet connection… and accounts" | **none at point of use** | `PARTIAL` — backed 83 lines later at `:241` |
| `:633` | "General benchmarks of interface hallucination… involve no robot" | **none** | `UNSUPPORTED` — the novelty claim itself is the uncited one |
| `:723` | "The BCS criteria call for…" | **none** | `UNSUPPORTED` — in the D-graded category |

### One contradiction resolved today

`docs/dissertation/INTEGRITY_AUDIT_2026-07-17.md` records **1,081 tests passed, 89.00%
coverage**. The dissertation at `:732` records **1,488 of 1,489**. Both cannot be true.

Measured today:

```
1488 passed, 1 skipped in 163.48s
TOTAL 6380 466 1496 181 91%
Total coverage: 90.97%
```

and `docs/eval/test_suite.json` (generated `2026-08-14T01:14:43Z`):

```
tests: {collected: 1489, passed: 1488, failed: 0, errors: 0, skipped: 1}
coverage: {percentCovered: 90.97, gate: 85, branchMode: true}
```

**The dissertation is correct. The July audit file is stale.** No action needed in the
`.tex`; the stale audit file should be dated or retired so it stops contradicting the
submission.

### One audit-file integrity defect worth knowing about

`REFERENCE_AUDIT_2026-07-17.md` opened by claiming it "covers every item in the canonical
LaTeX bibliography". Its table has **25 key-naming rows against a bibliography of 25**, but
two of those rows were **added today, not on 17 July**. The audit as found covered **23 of
the 25 entries**. The two it never checked were `trinket2026` — no venue, the most
perishable URL, and the sole support for the offline-first argument — and `bcscode`, the
one carrying a visible verification marker inside the PDF. The two entries that most needed
checking were the two the audit had skipped.

> **Corrected, twice over.** An earlier draft of this paragraph said "23 rows, not 24" and
> named `trinket2026` as the single omission. Both halves were wrong, for the same reason
> Part 5 was wrong: the scan behind it counted 24 bibliography entries when there are 25,
> so it also missed that **two** entries were unaudited, not one. The count was re-derived
> by machine (`\bibitem(?:\[[^\]]*\])?\{`) and every one of the 25 keys is now named in the
> audit file. What closed the gap was **writing the two missing rows today**, both marked
> `**VERIFY**` rather than `Verified`, because neither could be checked in this session —
> see the network failure recorded above. The audit's own header now states the 23-of-25
> coverage rather than claiming completeness.

### Numeric-claim cross-check — every figure in the abstract traced back to its artefact

The bibliography recount above caught this diagnostic quoting three wrong numbers about
itself. That is a reason to distrust the *other* unchecked figures, not a reason to stop, so
every quantitative claim in the abstract (`:160`) and the corresponding rows of Chapter 6
was read back out of the committed JSON under `docs/eval/` by script rather than by eye.

| Claim in the `.tex` | Artefact field | Agrees |
| --- | --- | --- |
| 1,489 collected, 1,488 passed, one skip, 90.97% against an 85% gate | `test_suite.json` → `tests {collected:1489, passed:1488, failed:0, errors:0, skipped:1}`, `coverage {percentCovered:90.97, gate:85, branchMode:true}` | yes |
| coverage figure is "a floor" because node-subprocess coverage is dropped locally but not in CI | `coverageFloorDisclosure`, which says exactly that in the artefact's own words | yes |
| four Prove contracts, twenty seeded runs, all pass | `prove_baseline.json` → 4 contracts × 5 runs = 20, every `pass_rate` 1, `verdict` "pass", `seed_root` 4046 | yes |
| six rendered flows, 40 behaviours, six layouts, 13 modal surfaces | `ui_eval.json` groups: flows 6/6, behaviour 40/40, layout 6/6, modals 13/13 — summing to the file's own total of 65 | yes |
| "eight of eight prompts … against a 60 percent floor" | `vibe_eval.json` 8/8 at 100%; the floor is real and lives in `scripts/qa_vibe.mjs:131`, `if (pass < Math.ceil(PROMPTS.length * 0.6)) process.exit(1)` | yes |
| 40 persona cells complete | `persona_eval_results.json` → `cellCount` 40, `cells.length` 40, funnel compiled/ran/safe/taskComplete all 40, eight personas × five tasks | yes |
| software floor "median 18.7 FPS Low, 17.1 High" | `performance_eval.json` → low `[18.5, 18.7, 20.0]`, high `[16.9, 17.1, 18.2]`; medians 18.7 and 17.1; `glMode` "software" | yes |
| hardware "median 144.5 FPS Low, 128.2 High" | `performance_eval_hardware.json` → low `[144.5, 144.9, 116.8]`, high `[127.0, 143.3, 128.2]`; medians 144.5 and 128.2; `glMode` "hardware" | yes |
| budget "met in all six samples" on hardware, "all six miss it" under software | `highRefreshSubmissionReady` is `true` in all six hardware samples and `false` in all six software samples | yes |
| Table~\ref{tab:renderer} P95 columns are "the median of the three per-sample P95 readings" | software Low frame `[88.8, 77.2, 64.7]` → 77.2 as printed; submission `[23.7, 38.9, 20.3]` → 23.7 as printed; software High 77.6 and 30.4 likewise | yes |

**Nothing failed this check.** Ten claims, ten agreements, including the two that would have
been easiest to round in the product's favour — the software-rasterised floor and the
budget-miss count.

Two provenance notes, neither an error:

- **The "24 percent spread" at `:635` is computed against the lower reading, not the
  higher.** The three hardware Low samples are 144.5, 144.9 and 116.8 FPS; 28.1 over 116.8
  is 24.1 percent, while 28.1 over 144.9 is 19.4 percent. Both are defensible readings of
  "spread"; the sentence does not say which base it uses. It is quoted as evidence that a
  single frame-rate reading is not repeatable, and it supports that either way.
- **The "temperature zero" claim at `:682` is checkable from the harness source, not from
  the artefact.** `persona_eval_results.json` records model, base seed, turn limit and cell
  count but no temperature; the zero comes from `scripts/qa_personas.mjs:122`. Section 6.1
  at `:617` describes the artefact's contents accurately and does not claim otherwise, so
  this is a gap in the artefact rather than a false statement in the text. If the artefact
  is ever regenerated, adding `options` to it would close the last hand-traced link in the
  persona figures.

### The Declaration calls four artefacts committed. Two of them have never been committed.

This is the most serious defect found today, and it sits in the Declaration rather than in a
results table, which is what makes it serious. `:150` reads:

> Four artefacts postdate the tag because their harnesses were re-run after it, namely the
> synthetic-persona evaluation, the software-rasterised renderer run, the local-model
> generation run and the full Python test suite; **each carries its generation timestamp
> inside the committed file**.

Measured. `v2.0-submission` is `ab8cdb1`, 27 July 2026, and all four artefacts do postdate it:

| Named in `:150` | File | `generatedAt` | Postdates tag | In git |
| --- | --- | --- | --- | --- |
| synthetic-persona evaluation | `persona_eval_results.json` | 2026-07-28T12:33:40Z | yes | **yes** |
| software-rasterised renderer run | `performance_eval.json` | 2026-07-28T12:46:46Z | yes | **yes** |
| local-model generation run | `vibe_eval.json` | 2026-08-14T00:49:11Z | yes | **no** |
| full Python test suite | `test_suite.json` | 2026-08-14T01:14:43Z | yes | **no** |

`ui_eval.json`, which `:617` presents as an evidence artefact and which holds the 65-of-65
interface figure, is also untracked. The evidence, run at the repository root:

```
git ls-files docs/eval/
  performance_eval.json  performance_eval_hardware.json  persona_eval_results.json
  prove_baseline.json    prove_report.md                          (5 of 10 files present)

git log --oneline --all -- docs/eval/test_suite.json   → no commits
git log --oneline --all -- docs/eval/ui_eval.json      → no commits
git log --oneline --all -- docs/eval/vibe_eval.json    → no commits
control:
git log --oneline --all -- docs/eval/prove_baseline.json
  → 6d3b9cb Finish deterministic proving and submission release
```

`--all` means no branch anywhere contains them; they were never committed and later removed,
they were simply never added. The control line proves the query works.

**Three refutations attempted, all fail.** *Maybe "committed" is loose for "written to disk."*
The same paragraph contrasts these files against gates that "emit no artefact" and whose lines
are "transcribed", and the Declaration opens by grounding the whole document in a version
controlled repository checked against a named tag. In that setting "committed file" means in
the repository. *Maybe the Canvas Code Archive supplies them.* `:150` says committed, not
archived, and an archive cut from a commit or a clone would not contain an untracked file.
*Maybe they were tracked and got ignored later.* Only `ui_eval_behaviour.json` is ignored;
`git check-ignore` reports the other three as not-ignored, so nothing was stopping them.

**The fix is to commit them, not to weaken the sentence.** Every one of these files exists,
was produced by the harness the text names, and carries its own timestamp. Softening the
Declaration would under-claim something that is one command away from being true:

```bash
git add docs/eval/test_suite.json docs/eval/ui_eval.json docs/eval/vibe_eval.json
```

That is left for you. Nothing in this session has staged or committed anything. If you decide
**not** to track them, then `:150` and `:617` have to change instead, because as written they
assert something a reader can disprove in one command — and a disprovable sentence in an
integrity declaration costs more than the figures it was protecting.

### `.gitignore:76` is correct, and the dissertation was wrong about it

An earlier note in this session called the ignore rule at `.gitignore:76`
(`docs/eval/ui_eval_*.json`) over-broad, on the grounds that it swallowed
`ui_eval_behaviour.json`, a file the dissertation names. That was wrong, and the correction
matters because it moves the defect from the repository to the text.

`scripts/qa_ui.mjs:78` decides the filename:

```javascript
const OUT = path.join(REPO, 'docs', 'eval', SUITE === 'all' ? 'ui_eval.json' : `ui_eval_${SUITE}.json`);
```

with `behaviour` in `VALID_SUITES` at line 67. So the full run writes `ui_eval.json` and
nothing else; `ui_eval_behaviour.json` can only ever be the output of a narrowed
`--suite=behaviour` run. It is partial-run scratch by construction, and the ignore rule
excludes exactly what its comment says it excludes.

One precision, since the line number is quoted above: that rule is itself an **uncommitted**
addition sitting in the working tree, not yet in `HEAD` (`git diff .gitignore` shows it as an
added block). At `HEAD` the file is not ignored — it is merely untracked, like the other
three. This changes nothing about the conclusion, but the `.gitignore:76` reference is a
working-tree line number and will move once the change is committed.

The error was in the dissertation, which listed it beside `ui_eval.json` as though the two
were peers in the evidence chain. `:617` has been corrected today:

> The interface gates write `ui_eval.json` on the same pattern; a narrowed `--suite=` run
> writes its own per-suite file alongside it, and those partial files are deliberately kept
> out of version control so that a narrowed local run cannot be mistaken for the full one.

Rebuilt after the edit: both passes exit 0, `Output written on Kodro_Dissertation.pdf (58
pages, 1092722 bytes)`, zero undefined references, Appendix A still at 48 and B at 49, so the
body is unchanged at 47 pages and the three pages of headroom under the 50-page limit survive.

### The 303-check classroom claim is now measured rather than assumed

`:783` says the ten classroom harnesses "assert 303 checks" and that "every row was executed
rather than transcribed". Until today that was the largest figure in the document with no run
behind it in this session. All ten were run from the repository root; all ten exited 0:

| Harness | Printed line | Table value |
| --- | --- | --- |
| `qa_grader` | `== RESULT: 55 passed, 0 failed ==` | 55 |
| `qa_lesson_studio` | `79 passed` | 79 |
| `qa_construct_liveness` | `30 passed` | 30 |
| `qa_markbook` | `16 passed` | 16 |
| `qa_pupilstore` | `PASS  pupil-store: 23 passed, 0 failed` | 23 |
| `qa_pupil_errors` | `42 passed` | 42 |
| `qa_parsons` | `13 passed` | 13 |
| `qa_learning_annotations` | `28 passed` | 28 |
| `qa_scenario_parity` | `PASS  scenario collision parity: 8 passed, 0 failed` | 8 |
| `qa_fuzz` | `9 passed (parity 120 cases across 3 lessons, 120 junk, 30 storage rounds)` | 9 |

55 + 79 + 30 + 16 + 23 + 42 + 13 + 28 + 8 + 9 = 303. Ten for ten, no drift from the printed
table. The lines are now recorded in `docs/eval/qa_gate_runs_2026-08-14.md` so a reader has
somewhere to check them other than this file.

---

## Part 6 — Chapter-by-chapter improvement plan

Scored /10, deliberately conservative. Calibration note: a simulated five-marker panel scored
CA1 in the A band (~74); the real supervisor mark was a **B**. Simulated marking on this
project has historically overestimated by roughly a grade, so these scores are set low
rather than optimistic.

| Ch | Score | Dominant defect | Priority actions |
|---|---|---|---|
| **1 Introduction** | 6/10 | No RQ; zero citations; self-defeating `:175`; `:169` names four words, three of which are absent from `:167` | **P1** Add explicit RQs. **P1** Soften `:175` to "the core objectives define the artefact" so O6 does not fail the project. **P2** Cite in the motivation. **P3** Fix the four-words paragraph. |
| **2 Background** | 5/10 | Name-dropping, not synthesis. `:233` stacks nine citations across six sentences. **No two sources are shown disagreeing anywhere.** ~5 of 24 refs genuinely engaged | **P1** Restructure by theme and by *disagreement*. **P1** Add the minimal-guidance counter-position. **P2** Add post-1980 education evidence. **P2** Derive the gap from the literature, not the market. |
| **3 Requirements** | 6/10 | The pupil is named "the third and now largest user" at `:254` but **F1–F11 (`:266–276`) contain no lesson, marking, hint or reading-age requirement**. `:252` still says "two related users". NFRs use "smoothly", "legible", "fail toward safety" with no thresholds | **P1** Add pupil-facing functional requirements. **P1** Fix the two/three user contradiction. **P2** Put numbers on the NFRs. |
| **4 Design** | 5/10 | 109 lines, **zero citations**; every rationale asserted; **no section for the lesson/marking/curriculum design that `:254` calls most of the product** | **P1** Add a design section for the lesson schema, the dual marking engines and the curriculum mapping. **P1** Cite design precedent for the layered architecture and the sandbox gate. **P2** Show one rejected alternative per major decision. |
| **5 Implementation** | 6/10 | Strong technical writing, but 5.1–5.16 has no section for the grader, the lesson schema or the Lesson Studio — 112 KB of shipped source with no write-up | **P1** Add implementation sections for the grader and Lesson Studio. **P3** Frame two or three decisions as trade-offs rather than narration. |
| **6 Evaluation** | 4/10 | **W1 persona labelling.** **W2: none of the 14 classroom gates appear in the strategy table.** No negative control on the 40/40 funnel. Round-5 regression unexplained | **P1** Label every persona table at point of use. **P1** Add the lesson/marking gates to the strategy table — they are already passing. **P1** Explain the 7.36→6.40 fall. **P2** Add a behaviour-suite negative control. **P2** Run the O6 ablation. |
| **7 Discussion** | 5/10 | Zero citations; the four real validity threats absent | **P1** Add a proper threats-to-validity section (the four in Part 2 §W4). **P2** Discuss limitations against literature. |
| **8 Professional Issues** | 6/10 | BCS section exists — good, this was the **D** category — but is one uncited assertion paragraph. `:716` carries the false labelling claim | **P1** Fix `:716`. **P1** Cite the BCS Code of Conduct. **P2** Map criteria to concrete evidence rather than asserting them. |
| **9 Conclusion** | 6/10 | `:754` learning claim contradicts `:663`; `:732` uncertainty claim unhedged | **P1** Remove or evidence the learning claim. **P1** Hedge `:732` to match `:754`'s "strongest justified claim" framing. |

### Template and front-matter defects (all cheap, all scored)

1. **No anonymous title page.** Required by the official COMP702 structure. Grep for
   "anonymous" returns nothing. **This is a structural omission a marker checks first.**
2. **Statement of Ethical Compliance is buried** as `\paragraph{Ethics.}` inside the
   Declaration (`:128`) instead of standing as its own front-matter section — against the
   official structure, and brushing directly against the CA1 criticism "ethics should be
   separate".
3. **References has no ToC entry.** No `\addcontentsline{toc}{chapter}{References}` anywhere.
4. **The abstract is 779 words** (`:132–136`), several times a normal MSc abstract, and its
   third paragraph is a wall of roughly fifteen metrics.
5. **`:113` states "Word count excludes the title page, contents, references and
   appendices"** — the document gives no word count and the module has none. Delete it.
6. **`:143–144` omits the lists of figures and tables "to keep the document inside the
   fifty-page limit."** The body ends at p41. The stated reason is no longer true.

---

## Part 7 — Rubric gap analysis

**Grounded in the real marking profile.** The source is the returned CA1 *Specification and
Design* feedback sheet, marked by the project supervisor, overall grade **B**. Caveat stated
plainly: this is the CA1 rubric, not confirmed as the CA3 dissertation rubric. It is the same
supervisor and the same category vocabulary, so it is the best available evidence — but if
you can get the actual CA3 criteria from Canvas, this table should be re-run against them.

Recorded CA1 profile: everything **B** except **Ethical Considerations C**, **BCS Project
Criteria D**, **User Interface Mockup C**, **Project plan C**.

Verbatim marker comments, quoted from the returned feedback sheet: "Some aspects still read
as AI-generated." · "clarity of use case and
the UI/UX need clarifying to assist the I/O scenarios." · "There is no BCS consideration and
ethics should be separate." · Formative: "Develop the working first draft then look at
enhancements."

| Category | CA1 | Current state in the dissertation | Priority |
|---|---|---|---|
| **BCS Project Criteria** | **D** | Ch8 §`:722` now exists and addresses the criteria directly. **Materially improved.** But it is one uncited paragraph of assertion. | **P1** — worst prior grade; cite the Code of Conduct and map each criterion to evidence. Largest available gain. |
| **Ethical Considerations** | **C** | Ch8 §Ethics is a proper separate section — the criticism is answered *in the body*. But the front-matter Statement is still a `\paragraph` inside the Declaration, and `:716` contains a false claim. | **P1** — promote the Statement to its own section; fix `:716`. |
| **User Interface Mockup / UI-UX clarity** | **C** | Drift audit resolves this. The `.tex` *does* describe the current Simple/Expert journey (`:732`). But the entire pupil-facing surface — Lesson Studio, grader, markbook, teacher dashboard — has no design section, so the UI the examiner opens is not the UI the document explains. The supervisor's exact CA1 words were "clarity of use case and the UI/UX need clarifying". **The use case is now split across two products and only one is written up.** | **P1** — this is W2. Fixing W2 fixes this row. |
| **Project plan** | **C** | A dissertation has no plan section; the equivalent is Future Work `:740–751`, which is a strong ordered ten-item roadmap. | **P3** — likely already answered. |
| **Key Literature and Background** | B | See W2/W3. No synthesis, no disagreement, 75% non-peer-reviewed. | **P1** — the clearest B→A route. |
| **Evaluation** | B | See W1. Strong machine evidence undercut by unlabelled persona tables. | **P1**. |
| **Testing** | B | Genuinely strong: 1,488/1,489, 90.97% branch coverage, multiple independent harnesses, self-disclosing provenance. | **P3** — defend it, don't change it. |
| **References** | B | 24 entries, no orphans, but 75% non-peer-reviewed and six defects listed in Part 5. | **P2**. |
| **Fluency / Succinctness** | B | "Some aspects still read as AI-generated" is unresolved. The 779-word abstract and the metric-wall paragraph are exactly the texture that triggers that reaction. | **P2** — cut the abstract hard. |
| **Coherence** | B | Severe terminology drift: *platform / proving ground / tool / product / application / design studio / the Lab*, and *maker / non-expert / builder / user / learner / pupil / beginner*. | **P2** — pick one term per concept and enforce it. |
| **Project originality** | B | `:213` correctly claims integration, not novelty. Weakened by the gap being commercial rather than scholarly. | **P2** — tie to W2. |

---

## Part 8 — First actions you should personally complete

These are yours, not mine. Several are decisions only the author can make, and the rest are
inputs I cannot obtain.

0. **Decide whether the three untracked evidence artefacts get committed.** `test_suite.json`,
   `ui_eval.json` and `vibe_eval.json` are named in the dissertation, exist on disk, and have
   never been in version control — `git log --all` returns nothing for any of them. The
   Declaration at `:150` says two of them carry their timestamps "inside the committed file".
   Either run `git add docs/eval/test_suite.json docs/eval/ui_eval.json
   docs/eval/vibe_eval.json` and commit, or the Declaration has to be reworded. This is
   numbered zero because it is the cheapest item on the list and the only one that currently
   makes a sentence in your integrity declaration disprovable. Full working in Part 5.
1. **Get the actual CA3 marking criteria off Canvas.** No dissertation rubric exists anywhere
   on this machine. I searched the repository docs tree and the local folder holding the
   returned coursework PDFs, and neither carries a CA3 rubric. Part 7 is currently grounded
   in the CA1 rubric, which is a reasonable proxy and not the real thing.
2. **Write the research questions yourself.** Two or three, falsifiable, derived from the
   problem you already state well at `:156–162`. This is the load-bearing intellectual act of
   the whole document and it must be yours. I can critique them; I should not author them.
3. **Decide O6.** Either run the memory ablation (offline, no humans, closes the one
   incomplete core objective) or reclassify O6 as secondary and soften `:175`. Both are
   defensible. Leaving it as-is means Ch1 states the project fails its own test.
4. **Decide the learning claim.** `:754` says a learner can acquire concepts; `:663` says
   nothing measures learning. Pick one. Recommendation: delete the claim — the document is
   stronger without it.
5. **Read `:716` and confirm you agree it is currently false.** I am not editing the ethics
   section on my own reading of it.
6. **Choose your vocabulary.** One word for the artefact, one for the primary user. You are
   the only person who can decide which.
7. **Confirm the eight 2026-dated references are real and that you have read them.** They are
   `dossantos2026`, `gazebo2026`, `khati2026`, `openroberta2026`, `trinket2026`, `vex2026`,
   `wang2026` and `webots2026` — machine-listed, after an earlier draft of this list said six
   and named seven. I could not verify any of them: no network this session. If any is a
   placeholder, tell me and it comes out. I will not present an unread source as checked.

---

## Academic-integrity log (brief §14)

Started 14 August 2026. This diagnostic itself is AI-assisted analysis and is logged as such.

| Date | Activity | Nature of assistance | Author's role |
|---|---|---|---|
| 2026-08-14 | Structural, argument, citation and evaluation audit of the existing draft | Analysis and critique only. **No dissertation text written or altered.** | Author commissioned the audit and retains all decisions |
| 2026-08-14 | Verification runs (`pdflatex` ×2, pytest, evidence-file reads) | Commands executed, output reported verbatim | Author's codebase and evidence |
| 2026-08-14 | Request to integrate `guillaumemeyer/watermarks-remover` into the dissertation workflow | **Declined, and declined again when the request was repeated.** The tool strips AI provenance marks (C2PA/SynthID/metadata). Not used, not installed, not referenced, and no substitute was suggested. | Recorded here because the log should show what was refused as well as what was done |
| 2026-08-14 | Staleness banners added to four dated documents in `docs/dissertation/` | Text written by the assistant. Every superseding figure in the banners was measured in-session or read from a committed artefact; the two that were not re-run are attributed and marked as not re-run. | Author's evidence; author decides whether the banners stay |
| 2026-08-14 | Thirteen QA harnesses executed and their printed output recorded | Commands executed, output transcribed verbatim into `docs/eval/qa_gate_runs_2026-08-14.md`. No figure was inferred, rounded or carried over from an earlier run. | Author's codebase and evidence |
| 2026-08-14 | Five factual edits to `Kodro_Dissertation.tex` (see the change log at the end of this file) | Text written by the assistant, under the author's instruction to close pending blockers. Four of the five edits weaken or narrow a claim the author's own document was making; none strengthens one. | Author retains the decision on all wording and can revert any of it |
| 2026-08-14 | Machine recount of the bibliography, and a machine cross-check of every numeric claim in the abstract against `docs/eval/*.json` | Scripts written and run by the assistant; the results corrected **this diagnostic's own figures** in three places (bibliography totals, the count of 2026-dated entries, and the reference-audit coverage claim) and confirmed all ten dissertation figures unchanged. Corrections are shown in place rather than silently applied. | Author's evidence; the `.tex` needed no change from this pass |
| 2026-08-14 | Two rows added to `REFERENCE_AUDIT_2026-07-17.md` for the entries it had never covered, and a coverage banner added to its header | Text written by the assistant. Both new rows are marked `**VERIFY**`, not `Verified`, because neither source could be reached in this session. Nothing was recorded as checked that was not checked. | Author must perform the two verifications; the assistant recorded only the gap |
| 2026-08-14 | Git audit of the ten files in `docs/eval/`, checking each against `git ls-files`, `git log --all` and `git check-ignore` | Commands executed by the assistant. The audit **contradicted the dissertation's own Declaration** and also contradicted an earlier claim made by the assistant in this same session about `.gitignore:76`; both corrections are written up in place rather than quietly applied. No file was staged, added or committed — the remedy is stated as a command for the author to run. | Author's repository; the decision to track the three artefacts is the author's alone |
| 2026-08-14 | A full `qa_ui` run, plus the ten classroom QA harnesses executed to check the 303-check figure at `:783` | Commands executed; eleven printed lines transcribed verbatim into `docs/eval/qa_gate_runs_2026-08-14.md` and into Part 5 here. All eleven reproduced their existing figures exactly; had any not, the mismatch would be reported here instead. `qa_ui` regenerated `docs/eval/ui_eval.json`, which changed that file on disk. | Author's codebase and evidence |
| 2026-08-14 | One source change to `scripts/qa_worlds.mjs`: an opt-in `--strict` mode | Code written by the assistant, then exercised in all three invocation forms with the fixture stopped; the real output is pasted in `docs/eval/qa_gate_runs_2026-08-14.md` rather than summarised. Default behaviour is unchanged, so no existing figure is affected. | Author's codebase; the change is a test-harness guard, not a product or results change |

The existing disclosure at `:126` already names the generative systems used and assigns
responsibility to the author. That disclosure remains accurate and should stay.

---

## Submission-hygiene items (not marks, but they can cost you)

1. **Nothing is pinned.** The `.tex`, the `.pdf` and the code are all uncommitted
   working-tree modifications against HEAD `02dd047`. The PDF currently on disk was built
   from a `.tex` that has since changed. **The submitted PDF and the Canvas code archive
   (318857) would not correspond to one commit.** Tag a submission commit and rebuild the
   PDF from it.

   > **Half closed on 15 August 2026.** The working tree is no longer dirty and the
   > documents are no longer out of step with each other. `Kodro_Dissertation.tex`,
   > `Kodro_Dissertation.pdf` and `_build/Kodro_Dissertation.pdf` were all last modified
   > by the same commit, `498f509`, on branch `agent/kodro-ca2-candidate`, and no later
   > commit touches the `.tex`. The PDF was checked against the source rather than
   > assumed to match it: `pdftotext` over the committed PDF returns zero occurrences of
   > `VERIFY VERSION` and renders the BCS citation as `(BCS, no date)` with
   > `Accessed: 15 August 2026`, which is the 15 August source edit, so the PDF is the
   > current `.tex` and not an older build. The `.tex` is also no longer 879 lines; it is
   > 1,092, which is why the line numbers throughout this file must be re-located.
   >
   > **The tag half is still open and is not an agent action.** `git tag --points-at HEAD`
   > returns nothing on the candidate branch. No submission tag exists for this state, so
   > the recommendation to tag a submission commit and archive from it stands as written.
2. **`docs/HANDOFF_KEITH.md` contradicts itself and the code.** Line 7 says "The 18 lessons
   span Key Stage 1 to Key Stage 4… 1 at KS1, 2 at KS2, 8 at KS3, 7 at KS4"; lines 46, 56 and
   65 of the same file say twenty-four. The repository has **24** lessons split 3/4/9/8,
   verified three ways (24 YAML files, 24 entries in `lessons.json`, and the `.tex` at `:254`
   agrees). This document goes to your supervisor with a wrong number in its opening
   paragraph. **Corrected today — see the change log at the end of this file.**
3. **`INTEGRITY_AUDIT_2026-07-17.md` is stale** (1,081 tests / 89.00%) and now contradicts
   the submission. Date it or retire it. **Done — it now opens with a dated staleness banner
   and a five-row superseding-figures table. The body is left unedited on purpose, because
   the file's value is the research-integrity reasoning, not its numbers.**
4. **`REFERENCE_AUDIT_2026-07-17.md` claims full bibliography coverage and has 23 of 24
   rows.** Fix the claim or add `trinket2026`. **Done, and it was worse than this item
   says: the bibliography is 25 entries, not 24, and two of them are unchecked. The coverage
   claim now reads "23 of the 25", and a 14 August addendum logs `trinket2026` and `bcscode`
   as VERIFY with the specific check each one needs. Neither was verified — no source was
   opened, because no external record could be fetched this session.**
5. **Two more dated files had the same defect and were found while fixing 3 and 4.**
   `VERIFICATION_REVIEW_2026-07-18.md` recommends submission of a 49-page document that no
   longer exists, and `REVISION_TRACKING_2026-07-18.md` points at a section that has moved
   and a cross-reference that does not exist. Both now carry banners. `README.md` was quoting
   1,087 tests at 88.21% and now quotes the measured 1,488 at 90.97%.

---

## Changes made today

| File | Change | Why |
|---|---|---|
| `docs/dissertation/DIAGNOSTIC_2026-08-14.md` | Created (this file) | The diagnostic the brief requires |
| `docs/HANDOFF_KEITH.md` | `18 lessons … 1/2/8/7` → `24 lessons … 3/4/9/8` | Unambiguous factual error, contradicted by the same file three times over and by the repository. Not a judgement call. |
| `docs/dissertation/REFERENCE_AUDIT_2026-07-17.md` | Coverage claim corrected from "every item" to "23 of the 25"; 14 August addendum logging `trinket2026` and `bcscode` as VERIFY | The file claimed to have checked a bibliography two entries larger than it checked |
| `docs/dissertation/INTEGRITY_AUDIT_2026-07-17.md` | Dated staleness banner with a five-row superseding-figures table | Every figure in it was measured against a 49-page PDF and a 1,081-test matrix |
| `docs/dissertation/VERIFICATION_REVIEW_2026-07-18.md` | Dated banner listing four changed presentation facts and the two sections the review never saw | It recommends submitting a document that no longer exists in that form |
| `docs/dissertation/REVISION_TRACKING_2026-07-18.md` | Dated banner: 6.9 → 6.10, the dead 1.3.1 reference, and two final checks that no longer pass as phrased | A closed change log should not read as a current-state document |
| `docs/dissertation/README.md` | 1,087 tests at 88.21% → 1,488 with one host Tk skip at 90.97%; artefact links added; both July audits relabelled as snapshots | The figures were stale and the file is the entry point to the folder |
| `docs/eval/qa_gate_runs_2026-08-14.md` | Created | The nine gates named below emit no JSON. Without this the figures would have no repeatable command attached to them. |
| `scripts/qa_worlds.mjs` | Added an opt-in `--strict` / `KODRO_QA_WORLDS_REQUIRED=1` mode so a missing fixture fails instead of skipping | A green exit covered both "61 checks passed" and "nothing ran". The default is unchanged, so a GPU-less box still skips; only a run being read by exit code alone opts in. The variable name matches `qa_ui.mjs`'s existing `KODRO_QA_UI_REQUIRED`. Verified for real in all three forms, output pasted in the eval log. |

## Changes made to `Kodro_Dissertation.tex`

The go-ahead to close pending blockers was given after this diagnostic was delivered, so the
"no text modified" position no longer holds. Five edits were made, all of them factual
rather than stylistic. Every figure added was measured in this session and is recorded in
`docs/eval/qa_gate_runs_2026-08-14.md`.

| Location | Change | Why |
|---|---|---|
| Declaration | "each harness writes a committed artefact" → most do; a small group of offline gates print to standard output and are transcribed by hand into a named file that says so | The original sentence became false the moment a stdout-only figure entered the document. It is an integrity statement, so it cannot be left approximately true. |
| Automated verification, opening paragraph | "Every figure … none is transcribed by hand" → "Almost every figure …; the two exceptions are named at the end of this paragraph", with the eight stdout gates added as the first exception alongside the existing adversarial-panel exception | Same reason. The paragraph already carried one exception, so the structure was there. |
| Automated verification, new paragraph | Nine previously unnamed gates named with their measured counts: physics 25/25, interpreter regressions 13/13, parts 40/40, memory graph 22/22, project storage 16/16, quality-tier classifier 46/46, browser model facade 51/51, honesty 121/121, grammar constraint 4/4 offline with the live half not run | 16 of 27 harnesses were unnamed in the document. These nine are the ones that were actually re-run, so these are the only ones a count could honestly be asserted for. |
| Abstract-level summary paragraph | "a world sweep of 61 combinations" → "a world sweep of 61 checks" | The sweep is 36 world-by-robot combinations plus tier, site and preset checks totalling 61. Calling 61 the combination count overstates the breadth by naming the wrong unit, and the same figure is described correctly in Chapter 6. |
| `:617`, evidence-provenance paragraph | "The interface gates write `ui_eval.json` and `ui_eval_behaviour.json` on the same pattern" → `ui_eval.json` alone, with the per-suite files described as deliberately untracked partial runs | `scripts/qa_ui.mjs:78` only ever writes `ui_eval_behaviour.json` for a narrowed `--suite=behaviour` run, and `.gitignore:76` excludes it on purpose. The sentence presented a partial-run scratch file as a peer of the full-run artefact. |

Four figures already in the document were re-run and reproduced exactly: the interpreter at
180 of 180, the static web gate at 5 of 5, the contrast gate at 61 over ten themes, and the
world sweep at 61 of 61. Nothing was changed on their account. That four separate figures
measured in July reproduce to the digit in August, on a source tree that has moved
considerably since, is itself a reproducibility result. The world sweep was run to completion
twice, independently, and both runs printed 61 of 61 with exit 0.

**One caveat found while testing the new `--strict` flag, and recorded rather than buried:**
two deliberately truncated probes of the world sweep, cut off after 75 and 90 seconds, each
surfaced a single transient `no screenshot written (page never painted)` failure — at
`city x arm` in one and `room x default` in the other. The failure moves between runs, so it
reports machine contention rather than a product defect, and it is the same sensitivity
`qa_ui.mjs` already documents. Both *complete* runs were clean. This is written into
`docs/eval/qa_gate_runs_2026-08-14.md` because "both complete runs passed" is a weaker and
more honest claim than "the gate is deterministic", and the document should not imply the
stronger one.

**`qa_ui` was run after all**, once the machine was free: a full run, exit 0, zero FAIL lines,
`== UI ALL: 6/6 flows clean · 46/46 behaviour or layout asserts pass · 13/13 modals render ==`,
regenerating `docs/eval/ui_eval.json` at 65 of 65. The ten classroom harnesses behind the
303-check table were run too, and all ten reproduced their printed totals exactly. Both are
recorded in `docs/eval/qa_gate_runs_2026-08-14.md`.

**Still not run, and therefore not quoted as fresh anywhere:** `qa_personas` and `qa_vibe`,
both of which need a local Ollama server that was not running. Their figures in the document
come from `persona_eval_results.json` and `vibe_eval.json` on disk. The first of those is
tracked in git; the second is not, which is the defect written up in Part 5.

The build after these edits: two `pdflatex` passes, both exit 0, 58 pages total, Appendix A
still opening at page 48 so the body is still 47 against the 50-page limit, zero undefined
references or citations, and the same 19 overfull and underfull box warnings as before. The
edits did not cost a page. Verbatim from the final build:

```
PASS1_EXIT=0
PASS2_EXIT=0
Output written on Kodro_Dissertation.pdf (58 pages, 1092722 bytes).
boxes=19
undefined=0
\contentsline {chapter}{\numberline {A}Glossary and Abbreviations}{48}{appendix.A}%
\contentsline {chapter}{\numberline {B}The Command Surface and a First Program}{49}{appendix.B}%
```
