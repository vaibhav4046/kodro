# CA2 academic integrity audit, Kodro dissertation

Audit date: 14 August 2026.
Target: `docs/dissertation/Kodro_Dissertation.tex` (1066 lines) and `docs/dissertation/Kodro_Dissertation.pdf`.
Repository state audited: branch `agent/kodro-ca2-candidate`, HEAD `44d30e97587ce7a3643440ccf48c13160f1f60a7`.
Working tree at audit time: 3 untracked paths, nothing modified or staged.

This file is the only artefact this audit created. The `.tex`, the `.pdf` and every `.aux`, `.log`, `.toc` beside them were not touched. All compiling was done on copies in a scratch directory. `scripts/qa_personas.mjs` and `scripts/qa_vibe.mjs` were not run, and `docs/eval/vibe_eval.json` and `docs/eval/persona_eval_results.json` were read only.

---

## Bottom line

| Severity | Count |
| --- | --- |
| CRITICAL | 1 |
| HIGH | 3 |
| MEDIUM | 6 |
| LOW | 4 |

**The single most important author action:** the software-rasteriser rows of the renderer table (`.tex:659`, `.tex:660`) and three method statements about them (`.tex:648`, `.tex:663`) are no longer supported by `docs/eval/performance_eval.json` as it exists at HEAD. That artefact was regenerated on 14 August as a single-sample run reading 14.2 and 12.9 FPS. The dissertation prints 18.7 and 17.1 with three-sample ranges. A marker who opens the named file finds different numbers and a sample count that contradicts the caption. Either restore the three-sample software run, or re-run it at `--repeat=3` and update the four numbers and the three sentences.

### Status after the release pass, 14 August 2026

Every finding above was worked after the audit was written. This table is the
current state; each entry below carries its own evidence.

| Finding | State |
| --- | --- |
| CRITICAL 1, renderer rows unsupported | RESOLVED. Gate re-run at `--repeat=3`, artefact re-pinned to the shipped bundle hash |
| HIGH 2, "at the final source state" | RESOLVED. Suite re-run at HEAD, artefact regenerated, every anchor now names the commit |
| HIGH 3, stale voice assertion count | RESOLVED. `.tex:559` reads 108, matching `PASS voice: 108 passed, 0 failed` |
| HIGH 4, page-limit rule | OPEN, author only. Cannot be settled offline. See the author actions section |
| MEDIUM 5, transcript says three artefacts are untracked | RESOLVED. The transcript now carries the correction and the `git log` output that proves it |
| MEDIUM 6, "four artefacts postdate the tag" | RESOLVED. `.tex:150` now says seven and names all seven |
| MEDIUM 7, source comment claims 9 figures and 14 tables | RESOLVED. The comment now says 2 figures and 11 tables, which is what the file contains |
| MEDIUM 8, `huang2023` key against a 2025 label | RESOLVED. The key is now `huang2025`. The DOI is still unverified offline |
| MEDIUM 9, untracked evidence-shaped files | RESOLVED. `stt_bench.json`, `stt_bench.md`, `bench_stt.py` and 10 clips are tracked, and the working tree is clean |
| MEDIUM 10, overfull boxes and an oversized float | RESOLVED as a side effect, and therefore fragile. Re-check the compile log before submission |
| LOW 11, Trinket shutdown claim | OPEN, author only. Needs a live source |
| LOW 12, reflection figure with no artefact | RESOLVED, and the entry was partly wrong when written |
| LOW 13, `bcscode` placeholder renders bold | OPEN, author only. Do not invent an access date. Same bcs.org trip settles PR 3's BCS table |
| LOW 14, the document's self-descriptions are correct | Not a defect. Keep as is |

Three of the four open items are author actions that cannot be closed from an
offline machine. None of them is a fabrication risk; all three are the opposite,
a refusal to assert something unverified.

Two things the audit confirms as sound and should not be disturbed:

- The generative AI disclosure is present, intact and prominent at `.tex:152`. It is quoted in full below.
- The fabrication sweep found nothing. No fake user study, no fake teacher result, no fake physical validation, no fake benchmark, no fake Turnitin figure. The document disclaims human evidence at 23 separate lines and volunteers its own two weakest evidence sources unprompted.

---

## Findings

### CRITICAL 1. The renderer table's software rows have no supporting evidence in the repository at HEAD

**RESOLVED 2026-08-14 by the first of the two routes below, then re-resolved once
the bundle changed.** `node scripts/qa_performance.mjs --gl=software --repeat=3`
was run twice. The first run (`generatedAt` `2026-08-14T19:59:18.155Z`) restored
three samples per tier and the table was updated to its medians. That run then
went stale within the same day: commit `3c2a851` regenerated `bundle.js` for the
dictation-notice fix, so the artefact's `bundleSha256` no longer matched the
bundle the dissertation describes. The gate was re-run at
`2026-08-14T21:21:00.915Z`, and its `bundleSha256`
`17c8d98582b431807fb4971b6a43743f0f3d48040380e72aea4b40035b48c174` is byte-for-byte
the SHA-256 of `src/robolearn/assets/web/bundle.js` at the commit that carries
this entry. The table now prints that run:

```
Software, Low  | 25.7 (25.3 to 32.2) | 48.0 ms | 9.1 ms | Not met
Software, High | 24.4 (23.3 to 25.0) | 50.8 ms | 13.9 ms | Not met
```

All three falsified method statements were re-checked against the artefact
rather than assumed fixed. `samplesPerTier` is 3. Every P95 cell in the table,
hardware and software alike, is the median of that tier's three per-sample
readings: software Low frame `[35.7, 48, 50.7]` median 48, submission
`[12.5, 9.1, 4.7]` median 9.1; software High frame `[47.5, 50.8, 54.9]` median
50.8, submission `[34, 6.2, 13.9]` median 13.9; hardware Low frame
`[7.4, 7.5, 8.1]` median 7.5, submission `[1.8, 1.9, 2.5]` median 1.9; hardware
High frame `[8.5, 7.5, 7.8]` median 7.8, submission `[3.1, 2.4, 2.9]` median
2.9. The caption's budget claim also holds in the strong form it states: all six
hardware submission readings are under 4.17 ms and all six software readings are
over it. The "a day apart" sentence was replaced with the two capture dates
before this pass; see the note under that bullet.

A consequence worth stating plainly rather than burying: the software figures
moved from 18.7 and 17.1 in the `f01767e` artefact to 22.2 and 21.1 at 12:21 and
25.7 and 24.4 at 21:21, all on the same host under CPU rasterisation. The
21:21 run's own Low samples were 25.3, 25.7 and 32.2, a 27 percent spread across
three consecutive samples. These are noisy floor measurements on a loaded
machine, and the dissertation should not be read as claiming better than that.
The prose already says so.

The original finding follows unchanged.

`.tex:659` and `.tex:660` print:

```
Software, Low  | 18.7 (18.5 to 20.0) | 77.2 ms | 23.7 ms | Not met
Software, High | 17.1 (16.9 to 18.2) | 77.6 ms | 30.4 ms | Not met
```

`docs/eval/performance_eval.json` at HEAD (`generatedAt` `2026-08-14T12:21:04.837Z`, committed in `706f93d`) contains:

```
samplesPerTier: 1
low  fps=[14.2]  p95frame=[137.6]  p95sub=[127.0]
high fps=[12.9]  p95frame=[150.0]  p95sub=[139.7]
```

The printed figures match exactly one historical version of that file, the one committed at `f01767e` (`generatedAt` `2026-07-28T12:46:46.287Z`, `samplesPerTier: 3`):

```
low  fps=[18.5, 18.7, 20.0] median 18.7  p95frame median 77.2  p95sub median 23.7
high fps=[16.9, 17.1, 18.2] median 17.1  p95frame median 77.6  p95sub median 30.4
```

This is provenance drift, not fabrication. Every number was really measured, and the measurement is still recoverable with `git show f01767e:docs/eval/performance_eval.json`. But three separate method statements are falsified by the artefact as shipped:

- `.tex:648`: "Each run is three independent samples per tier (`--repeat=3`)". The software artefact at HEAD has one sample per tier.
- `.tex:663` caption: "median of three samples per tier with the observed range in brackets; the P95 columns are likewise the median of the three per-sample P95 readings". There are no three readings to take a median of.
- `.tex:648`: "the two runs were captured a day apart". Hardware is `2026-07-27T21:12`, software at HEAD is `2026-08-14T12:21`. That is 18 days. Under the `f01767e` software artefact it was about 15 hours, which is what the sentence was written against. **RESOLVED.** The sentence now names both capture dates outright, 27 July 2026 and 14 August 2026, so the reader computes the gap instead of being told a wrong one, and it states which of the two artefacts pins the current bundle.

The hardware rows are clean. `.tex:657` and `.tex:658` match `docs/eval/performance_eval_hardware.json` exactly, including the per-sample spread quoted in prose at `.tex:648` ("144.5, 144.9 and 116.8 FPS"), which is the literal `all` array in that file.

Fix by one of two routes. Either re-run `node scripts/qa_performance.mjs --repeat=3` with software rasterisation forced and update the four numbers and three sentences to whatever it produces, or restore the `f01767e` artefact as the committed software evidence so the file and the table agree again. Do not leave the table as it stands.

---

### HIGH 2. "At the final source state" is not the final source state

**RESOLVED 2026-08-14 by both routes at once, and the phrase has been removed
from the document.** The suite was re-run at HEAD on a clean tree, the artefact
was regenerated from that run, and every anchor now names the commit instead of
claiming finality. Detail at the end of this entry.

The finding as written: `.tex:633` and `.tex:908` both anchored the headline test
figures to "the final source state", naming `docs/eval/test_suite.json`.

That artefact records `source.commit` = `02dd047a392884a12ef40f2f4113f217ac5470b1`, describe `v2.0-submission-31-g02dd047-dirty`. HEAD is `44d30e9`, two commits later. Verified by direct comparison of the two trees:

- `tests/unit/test_mcp_server.py` is absent at `02dd047` and present at HEAD.
- Test file count went from 69 at `02dd047` to 76 at HEAD.
- `706f93d` added `src/robolearn/mcp/*`, `scripts/qa_voice.mjs` and `src/robolearn/assets/web/voice.js`.
- `44d30e9` added `scripts/qa_encoding.mjs` plus further voice code.

So the 1,489-test matrix does not include the MCP subsystem described at `.tex:566` to `.tex:569`, nor the voice layer described at `.tex:552` to `.tex:561`. The dissertation describes subsystems that its headline test count does not cover, while calling that count the final source state.

The Declaration partly anticipates this at `.tex:150` ("the suite grew after tagging and its headline count therefore belongs to the final source state rather than to `v2.0-submission`"), but that sentence resolves the tag question, not the HEAD question. The count belongs to `02dd047`, which is neither the tag nor the final state.

Two honest fixes: re-run the suite at HEAD and update the numbers, or change the phrase "at the final source state" to name the commit the artefact actually records. The first is preferable because the artefact already carries a `provenanceWarning` about dirty-tree runs.

Command a human can run to settle it: `python -m pytest -q` from the repository root, then regenerate `docs/eval/test_suite.json` through its usual harness. This audit did not run it, because it would overwrite a committed evidence artefact.

**What the release pass did.** The command the audit declined to run was run, twice over. An intermediate pass had already re-run the suite at `139a2c8` on a clean tree, giving 1,626 collected and 1,625 passed, and that artefact was committed. HEAD then moved eight commits further, changing two test files and seven source files, so the anchor overstated again by exactly the same mechanism. The suite was therefore re-run at `aa174cf`, on a clean tree, with `git status --porcelain` empty before the run:

```
1638 passed, 1 skipped in 170.54s (0:02:50)
Required test coverage of 85% reached. Total coverage: 90.90%
```

`docs/eval/test_suite.json` was rebuilt from that run's own `junit.xml` (`tests="1639" failures="0" errors="0" skipped="1" time="170.527"`) and `coverage.json` (`totals.percent_covered` 90.90288833295429, 7062 statements, 516 missing, 1732 branches, 206 partial). No figure was transcribed by hand. There is no generator script for this artefact: `git grep -ln "test_suite.json" -- scripts tools src` returns nothing, so the schema was preserved field by field and the `note`, `measures` and `coverageFloorDisclosure` strings were carried over unchanged. The `provenanceNote` was rewritten because it described the older comparison.

Both fixes were applied rather than one. The counts moved to 1,639 and 1,638 at `.tex:160`, `.tex:633`, `.tex:850` and `.tex:908`, and the phrase "at the final source state" was removed from the document entirely: those four places now say "at commit `aa174cf`" or "at the commit recorded in `docs/eval/test_suite.json`". The rendered PDF contains four instances of 1,639, three of 1,638, three of `aa174cf`, zero of 1,626, zero of 1,625 and zero of "final source state".

Two further sentences were corrected in passing, because they carried the same defect in a quieter form. `.tex:150` claimed the artefact records "the test files added since the tag"; it does not, and never had such a field, so it now says it records the working-tree status, which it does. `.tex:641` said the nine offline module gates "were re-run at the final source state"; they were re-run on 14 August 2026 at `13c0997`, which is what it now says.

The honest limit of this fix: naming a commit is stable, but it is not a promise that HEAD will not move again. Any later commit touching `src/` or `tests/` invalidates the count in the same way, and the only safe procedure before submission is to re-run the suite and regenerate the artefact one final time on the tree that ships. That is a mechanical repeat of what is written above.

---

### HIGH 3. The voice assertion count in the dissertation is stale

`.tex:559`: "Forty-seven assertions hold the layer, run in Node against its pure functions with no browser present".

Measured at HEAD:

```
$ node scripts/qa_voice.mjs
PASS  voice: 86 passed, 0 failed
EXIT=0
```

Static call-site count in `scripts/qa_voice.mjs` at HEAD is 61 (the runtime total is higher because some assertions sit inside loops). At `706f93d` the static count was exactly 47, which is where the sentence came from. Commit `44d30e9` ("add spoken and typed barge-in") grew the gate to 288 lines and did not update the prose.

The companion sentence at `.tex:561` is still correct. The lesson-library section of that file (lines 131 to 179) holds exactly 14 assertion call sites, matching "Fourteen of those assertions". But "fourteen of those" now refers to a total that is wrong, so both sentences need one edit between them.

Note that this is an understatement, not an inflation. The gate is stronger than the dissertation claims.

---

### HIGH 4. The page limit cannot be confirmed from repository evidence, and the measurement depends on which rule applies

No authoritative COMP702 brief exists anywhere in the repository. Every statement of the limit is either the author's own note to a tool, or a derivation in a previous audit:

- `docs/GPT_HANDOFF.md:34`: "EXACTLY 50 pages (hard limit)". This is a prompt written by the author, not a brief.
- `docs/HANDOFF_GPT56_COMPLETE.md:17`, `:60`, `:303`, `:372`: repeat "max 50 pages" and "exactly 50 pages".
- `.kodro/autonomy/STATE.md:162`: "EXACTLY 50 pages".
- `.kodro/autonomy/DISSERTATION_TRACEABILITY.md:46`: "the established ~50-page design (no larger target set by the ...)".
- `docs/dissertation/DIAGNOSTIC_2026-08-14.md:30`: "The module limit is 50 pages *excluding the appendix*". No source cited.
- `docs/dissertation/INTEGRITY_AUDIT_2026-07-17.md:15`: "The 50-page limit applies to the body". No source cited.
- `.tex:113`, on the title page: "The body of this dissertation ends before the appendices, which are excluded from the fifty-page limit." This is the author asserting the rule inside the document being measured against it. It is not independent evidence.

**The limit could not be confirmed from repository evidence. Only the student can confirm it from the current Canvas brief.** No public COMP702 web page was consulted and none would be authoritative here.

What was measured directly, from `pdfinfo` and per-page `pdftotext` on a clean scratch rebuild:

| Measure | Value |
| --- | --- |
| Total PDF sheets | 59 |
| Front matter (title through contents), roman numbered | sheets 1 to 9 |
| Arabic page 1 (Chapter 1 Introduction) | sheet 10 |
| References heading | printed page 47, sheet 56 |
| References end | printed page 48, sheet 57 |
| Appendix A opens | printed page 49, sheet 58 |
| Appendix B opens | printed page 50, sheet 59 |
| Body only, Chapter 1 through References | 48 printed pages |
| All arabic-numbered pages, body plus appendices | exactly 50 |
| Whole submitted PDF | 59 pages |

Three readings of the same document, and they diverge:

1. Body excluding appendices: 48. Two pages of margin under 50.
2. All arabic-numbered pages: exactly 50. Zero margin. This is what the handoff files' "EXACTLY 50 pages" describes.
3. Every page in the file a marker opens: 59. Nine pages over.

Reading 3 is the risk. A brief that says "no more than 50 pages" and is enforced by opening the PDF counts 59. Nine sheets of front matter is a large exposure to leave resting on an unverified interpretation.

---

### MEDIUM 5. The repository's own evidence transcript contains a claim that is now false

**RESOLVED.** `docs/eval/qa_gate_runs_2026-08-14.md` now carries a section headed
"The artefact-tracking gap, now closed", which states that the earlier paragraph
was true when written and is no longer true, and pastes the `git log --oneline -1`
output showing all three artefacts entering version control in `706f93d`. The
paragraph was corrected in place rather than deleted, for the reason this entry
gives: a reader the dissertation sends to that file would otherwise have been
told the evidence was untracked when it is tracked. The treatment of
`ui_eval_behaviour.json` was left alone, as this entry recommends.

`docs/eval/qa_gate_runs_2026-08-14.md:79` to `:93`, under the heading "The artefact-tracking gap":

> `git log --all -- <path>` returns no commits at all for `docs/eval/test_suite.json`, `docs/eval/ui_eval.json` and `docs/eval/vibe_eval.json`: they exist on disk and are named in the dissertation, but they have never entered version control.

and

> The remaining three should be tracked before submission.

Measured at HEAD. All three are tracked, and all three entered version control in the same commit:

```
docs/eval/test_suite.json -> 706f93d feat: MCP server, voice layer, project interop and CA2 evidence
docs/eval/ui_eval.json    -> 706f93d feat: MCP server, voice layer, project interop and CA2 evidence
docs/eval/vibe_eval.json  -> 706f93d feat: MCP server, voice layer, project interop and CA2 evidence
```

`git ls-files --error-unmatch` confirms tracked status for all three. The author evidently committed them after writing that paragraph and did not go back.

The net effect works against the document. The dissertation's claim at `.tex:630` that figures come from versioned artefacts under `docs/eval` is **true**. The repository's own transcript, which the dissertation directs the reader to, says it is false. A marker who follows the pointer is told the evidence is untracked when it is tracked. Update or strike that section.

The same section's treatment of `ui_eval_behaviour.json` is correct and should stay: `.gitignore:76` ignores `docs/eval/ui_eval_*.json`, and four such partial files sit on disk untracked (`ui_eval_behaviour.json`, `ui_eval_layout.json`, `ui_eval_modals.json`, `ui_eval_paint.json`), exactly as described.

---

### MEDIUM 6. "Four artefacts postdate the tag" is an undercount

**RESOLVED by the second route this entry offers, adding the missing artefacts
rather than weakening "four" to "at least four".** `.tex:150` now reads "Seven
artefacts postdate the tag" and names all seven: the synthetic-persona
evaluation, the software-rasterised renderer run, the local-model generation
run, the full Python test suite, the browser interface run, the hand-written
gate transcript and the speech-to-text benchmark with its audio clips. That is
the original four plus `ui_eval.json` and `qa_gate_runs_2026-08-14.md`, which
this entry identified, plus the STT benchmark, which became quotable when
MEDIUM 9 was closed by committing it. The list is exhaustive again, so reading
it as exhaustive is now safe.

`.tex:150` names four artefacts that postdate `v2.0-submission`: the synthetic-persona evaluation, the software-rasterised renderer run, the local-model generation run and the full Python test suite.

All four check out. Tag `v2.0-submission` = `ab8cdb1`. HEAD is 33 commits ahead.

| Artefact | Last commit | In tag tree |
| --- | --- | --- |
| `persona_eval_results.json` | `f01767e` 2026-07-28 | yes, modified after |
| `performance_eval.json` | `706f93d` 2026-08-14 | yes, modified after |
| `vibe_eval.json` | `706f93d` 2026-08-14 | no, added after |
| `test_suite.json` | `706f93d` 2026-08-14 | no, added after |

But two more also postdate the tag and are also quoted in the dissertation:

- `docs/eval/ui_eval.json`, added in `706f93d`, `generatedAt` `2026-08-14T18:20:31.495Z`, quoted at `.tex:639`.
- `docs/eval/qa_gate_runs_2026-08-14.md`, last committed `44d30e9`, quoted at `.tex:641` and named at `.tex:150` itself.

If "four" is read as an exhaustive list, it is wrong by at least one. Say "at least four", or add the UI artefact to the list.

---

### MEDIUM 7. A source comment claims a figure and table count that is wrong by a wide margin

**RESOLVED.** The comment now reads "the document has 2 figures and 11 tables".
Re-measured at HEAD: `grep -c 'begin{figure}'` returns 2, `begin{table}`
returns 11, `begin{lstlisting}` returns 3. The justification sentence was left
as it was, for the reason this entry gives: it still holds at two figures, and
only the numbers were false.

`.tex:175` to `.tex:177`, a LaTeX comment:

```
% Lists of figures and tables are omitted deliberately: the document has 9 figures
% and 14 tables, all numbered and referenced by number at the point of use, so a
% separate index would add front matter without adding navigation.
```

Measured in the same file: 2 `figure` environments, 11 `table` environments, 3 `lstlisting` environments.

This comment does not render, so it cannot mislead a marker reading the PDF. It matters for two reasons. First, anyone auditing the source is told something false about the source. Second, the gap of seven figures suggests figures were removed at some point, most likely for page count, and the justification for omitting the list of figures was never revisited. The justification still holds at 2 figures, so only the numbers are wrong.

---

### MEDIUM 8. One bibliography entry has a citation key that contradicts its own label

**RESOLVED as far as an offline machine can take it.** The key is now
`huang2025` at `.tex:964`, and both call sites, `.tex:284` and `.tex:886`, cite
`huang2025`. The compile reports zero undefined citations, so the rename is
consistent across the document. What is *not* resolved is the underlying
question this entry raised: the DOI `10.1145/3703155` has still never been
resolved, because this machine is offline by design. It is labelled here as
unverified rather than quietly treated as checked, and it stays in the author
actions list below.

`.tex:964`:

```
\bibitem[Huang et al.(2025)]{huang2023} Huang, L., Yu, W., Ma, W. et al. (2025) A survey on hallucination in large language models ... ACM Transactions on Information Systems, 43(2), Article 42, pp. 1 to 55.
```

The key is `huang2023`, the label and the in-text year are both 2025. This renders correctly, because natbib uses the bracketed label, not the key. It is a cosmetic inconsistency visible only in source. It is flagged here because in an audit of reference integrity a year mismatch is exactly the shape of a fabricated citation, and this one is not fabricated. ACM TOIS 43(2) Article 42 is a plausible and specific venue reference for that survey. **Not verified against the live DOI**, because this audit ran offline. See the author actions section.

---

### MEDIUM 9. Three untracked evidence-shaped files sit in the working tree

**RESOLVED by the commit route, not the delete route.** All thirteen files are
now tracked: `scripts/bench_stt.py`, `docs/eval/stt_bench.json`,
`docs/eval/stt_bench.md` and the ten clips under `docs/eval/stt_clips/`. The
benchmark is now explained rather than orphaned: `.tex:150` names it among the
seven artefacts that postdate the tag, and `docs/ca2/CLAIM_LEDGER.md` carries a
row per figure it produces. `git status --porcelain docs/eval scripts` reports
no untracked files at HEAD. The clips are five command phrases rendered by two
Windows voices, `Microsoft David Desktop` and `Microsoft Zira Desktop`, through
`System.Speech.Synthesis.SpeechSynthesizer` in `scripts/bench_stt.py`. Nobody
was recorded, so committing them raises no participant-data question.

One consequence of that has to travel with the numbers wherever they are
quoted. A word error rate measured on synthesised speech is a floor on error
and a ceiling on audio quality: no microphone noise, no accent variation, no
room, no hesitation. `scripts/bench_stt.py` says this in its own header
comment. The claim ledger did not, and now does.

```
?? docs/eval/stt_bench.json
?? docs/eval/stt_clips/
?? scripts/bench_stt.py
```

None of these is referenced anywhere in the `.tex`. Grep for `stt_bench`, `stt`, `speech-to-text`, `word error` and `WER` returns only `.tex:553`, which is prose about the voice route being removed and rebuilt and quotes no figure. So there is no unsupported claim here.

They are flagged because they are a speech-to-text benchmark and its audio clips, sitting untracked in the evidence directory. Either commit them or remove them before the repository is submitted, so that nobody inspecting `docs/eval` finds a benchmark that the dissertation neither uses nor explains.

---

### MEDIUM 10. Two overfull boxes and one oversized float survive in the final build

**RESOLVED, and not by anything aimed at it.** Three separate two-pass compiles
on 2026-08-14, after the privacy paragraph, the reflection sentence and the
renderer table were rewritten, each report `Overfull: 0`, `Float too large: 0`,
`Undefined: 0`, `LaTeX Warning: Citation: 0` and `LaTeX Warning: Reference: 0`,
at 59 pages. Both overfull boxes were in paragraphs this pass rewrote, `.tex:160`
and `.tex:869`, so the reflow that removed them was a side effect of correcting
the numbers rather than a typographic fix. Recorded as such, since a fix nobody
aimed at can regress the moment either paragraph is edited again. Re-check the
compile log for `Overfull` before the final PDF is submitted rather than trusting
this entry.

The original finding follows unchanged.

From a clean three-pass scratch build, all three passes exit 0:

```
Overfull \hbox (41.00305pt too wide) in paragraph at lines 160--161     [log:585]
Overfull \hbox (28.24223pt too wide) in paragraph at lines 795 context   [log:795, .tex lines 869--870]
LaTeX Warning: Float too large for page by 53.00719pt on input line 345. [log:666]
```

Counts: 2 overfull hbox, 17 underfull hbox, 0 overfull vbox, 0 underfull vbox, 6 instances of "`h` float specifier changed to `ht`".

41pt is roughly 14mm of text past the right margin. `.tex:160` is the abstract, the first body page a marker reads. `.tex:869` is in the limitations chapter. Underfull boxes are cosmetic and not worth acting on. The two overfull ones are visible.

---

### LOW 11. The Trinket shutdown claim is a load-bearing external fact that cannot be checked offline

`.tex:296`: Trinket "announced that it will shut down on 31 August 2026 `\citep{trinket2026}`".

This underpins part of the motivation for an offline-first tool. It is a claim about the outside world with a dated deadline eighteen days after this audit. It cannot be verified from repository evidence and was not verified online. Marked UNVERIFIED. See author actions.

---

### LOW 12. One reflection figure is a session observation with no artefact

**RESOLVED 2026-08-14, and this entry was partly wrong when written.**

`.tex:915`: "Timing one flow end to end instead settled it, at 2 minutes 56 seconds against a 60 second ceiling, with a valid screenshot at the end of it".

The original finding said no artefact records the timing. That is not correct. `scripts/qa_ui.mjs:98-105` records it in the gate itself, contemporaneously with the fix it justifies:

```js
// The ceiling is platform-aware because the two platforms are not close. On the
// Linux CI runner a flow finishes in a few seconds. On a loaded Windows laptop
// the same flow was measured at 2m56s end-to-end -- Defender scans every file
// of the fresh profile as Chrome writes it, and SwiftShader JITs on a box with
// ~1.5GB free. A 60s ceiling there does not report a broken product, it reports
// a busy machine
```

and the ceiling that observation produced is at `qa_ui.mjs:109`, `process.platform === 'win32' ? 300_000 : 60_000`. So the 60 second figure is a literal in the shipped source and the 2m56s figure is a dated engineering record, not an unsupported number.

What was fair in the finding is that the sentence read like a controlled measurement. `.tex:915` now says the observation is recorded in the gate source rather than in a separate evaluation artefact, and that it was a debugging measurement rather than an experiment.

Corroborated independently on 2026-08-14: `node scripts/qa_ui.mjs --suite=behaviour` on this Windows laptop took 325 seconds wall clock for nine flows and passed 41 of 41 asserts, exit 0. That does not reproduce the 2m56s figure, which was a single flow on a different day, but it confirms the magnitude the reflection turns on, which is that a 60 second per-flow ceiling on this platform measures the host and not the product.

---

### LOW 13. The `bcscode` placeholder renders in the PDF

`.tex:952`:

```
\bibitem[BCS(2022)]{bcscode} BCS, The Chartered Institute for IT (2022) ... \textbf{[VERIFY VERSION, URL AND ACCESS DATE BEFORE SUBMISSION]}
```

Confirmed present and confirmed rendering in the PDF as bold text inside the References. This is deliberate and only the author may close it. It is recorded here as an open author action, not as a defect, and it was not removed.

Re-examined on 14 August against PR 3, which cites a **different** BCS document. PR 3 has no `bcscode`. It has `bcs2020`, the course accreditation guidelines PDF, with a date its own reference audit describes as corrected from 2022 to January 2020 and an access date of 13 August 2026. That entry was not adopted here. `WebFetch` and `WebSearch` both fail in this session with `There's an issue with the selected model (auto/best-free)`, so neither the accreditation PDF nor the Code of Conduct page could be opened, and importing a citation with a concrete access date that nobody in this session verified would make it look checked when it is not.

The two are not alternatives. The Code of Conduct supports the professional-duty sentence at `.tex:899`; the accreditation guidelines support a nine-row BCS traceability table that PR 3 has and this document does not. That table, and the conditions under which it can be brought across, are written up in `.kodro/autonomy/CA2_RECONCILIATION.md` section 10.4. Closing this placeholder and deciding the table are one trip to bcs.org, not two.

---

### LOW 14. The document's own descriptions of its two weakest evidence sources are correct, and should be kept

Recorded as a finding so that nobody removes them during tidy-up:

- `.tex:686` caption, on the persona review means: "the per-persona responses behind these means were not retained as a machine-readable artefact, so unlike every other table in this chapter these rows cannot be re-derived from the repository". Verified. No such artefact exists.
- `.tex:754`, on the adversarial panel round tallies: "kept in session notes rather than emitted by a harness". Verified. No such artefact exists.
- `.tex:643`, on a manual returning-user pass: "that pass was a session observation and left no artefact, so its individual readings are not quoted as evidence here". Verified. No readings are quoted.
- `.tex:630` names both gaps again in one place.

These are the strongest integrity signals in the document. They are unforced disclosures of the exact weaknesses an auditor would otherwise have to find.

---

## Numerical claim traceability

Every numerical claim found in the `.tex`, with its evidence and a verdict. "Measured now" means measured or read directly during this audit.

### Test and coverage figures

| Claim | .tex line | Evidence source | Measured now | Verdict |
| --- | --- | --- | --- | --- |
| 1,639 tests collected | 160, 633, 908 | `docs/eval/test_suite.json` `tests.collected` | 1639, from the run's own JUnit `tests` attribute | MATCH, was **DRIFT** at 1,489 then at 1,626 |
| 1,638 passed | 160, 633, 908 | same, `tests.passed` | 1638 = 1639 collected minus 1 skipped, 0 failures, 0 errors | MATCH, was **DRIFT** |
| 1 skip, host Tk | 160, 633, 908 | same, `skipDetail` | 1, `tests.unit.test_ai_studio::test_studio_available_when_server_up`, "Tk unavailable: Can't find a usable init.tcl" | MATCH |
| 90.90 percent branch-aware coverage | 160, 633 | same, `coverage.percentCovered` | 90.90288833295429 from `coverage.json` `totals.percent_covered` | MATCH |
| 85 percent gate | 160, 526, 633 | same, `coverage.gate` | 85, and the run printed "Required test coverage of 85% reached" | MATCH |
| The artefact's commit is the one the text names | 150, 160, 633, 850, 908 | `source.commit` vs the `.tex` | both `aa174cf`, working tree clean before the run | MATCH, was **DRIFT**. See HIGH 2 |
| 180 of 180 interpreter checks | 160, 908 | `qa_gate_runs_2026-08-14.md:45` | transcript records `== RESULT: 180 passed, 0 failed ==` | MATCH against transcript. UNVERIFIABLE-WITHOUT-RERUN independently: `node scripts/qa_interpreter.mjs` |

### Prove contract figures

| Claim | .tex line | Evidence source | Measured now | Verdict |
| --- | --- | --- | --- | --- |
| 4 contracts | 160, 637, 908 | `docs/eval/prove_report.md`, `prove_baseline.json` `contracts` | 4 | MATCH |
| 20 seeded runs | 160, 637, 908 | `prove_report.md`, 4 contracts at 5/5 | 20 | MATCH |
| All pass, byte-identical replay | 637 | `prove_report.md`, `verdict: pass` | pass | MATCH |
| Seed root 4046 | 637 context | `prove_baseline.json` `seed_root` | 4046 | MATCH |
| Broken controller fails all four | 637, 908 | `prove_report.md` | stated in artefact | MATCH against artefact. UNVERIFIABLE-WITHOUT-RERUN: `python -m robolearn.prove --broken` per the report |

### Web and browser figures

| Claim | .tex line | Evidence source | Measured now | Verdict |
| --- | --- | --- | --- | --- |
| 5 boot and privacy checks | 160, 639 | `qa_gate_runs:46` `== QA_WEB: 5/5 checks passed ==` | 5 | MATCH |
| 61 contrast and responsive checks over 10 themes | 160, 639 | `qa_gate_runs:47` | 61 | MATCH |
| 6 rendered flows | 160, 639 | `ui_eval.json` group `flows` | 6/6 | MATCH |
| 41 behaviours | 160, 639 | `ui_eval.json` group `behaviour` | 41/41 | MATCH |
| 6 layouts | 160, 639 | `ui_eval.json` group `layout` | 6/6 | MATCH |
| 13 modal surfaces | 160, 639 | `ui_eval.json` group `modals` | 13/13 | MATCH |
| Implied UI total 66 | 639 arithmetic | `ui_eval.json` `passed`/`total` | 66/66, `percent` 100, `verdict` PASS | MATCH |
| World sweep 61 checks | 160, 639 | `qa_gate_runs:48`, run twice | 61 | MATCH. Load-sensitive, disclosed in the transcript |

### The nine offline gates

Source for all: `docs/eval/qa_gate_runs_2026-08-14.md`, first table, which declares itself a hand-written transcript. Each was checked line by line against `.tex:641`.

| Gate | .tex 641 | Transcript | Verdict |
| --- | --- | --- | --- |
| physics | 25 | `== RESULT: 25 passed, 0 failed ==` | MATCH |
| interpreter regression | 13 | `13 passed, 0 failed` | MATCH |
| parts | 40 | `40 passed, 0 failed` | MATCH |
| memory graph | 22 | `22 passed, 0 failed` | MATCH |
| project opening | 16 | `16 passed` | MATCH |
| quality tier | 46 | `46 passed` | MATCH |
| browser model facade | 51 | `51 passed, 0 failed` | MATCH |
| honesty | 121 | `121 passed, 0 failed` | MATCH |
| grammar constraint, offline half | 4 | `4 passed, 0 failed`, live half SKIP | MATCH, and the skip is disclosed in both places |

Every one of these is UNVERIFIABLE-WITHOUT-RERUN independently of the transcript. The commands are in the transcript's first column, each of the form `node scripts/<name>.mjs`. This audit did not re-run them; the transcript is the evidence and it names itself as such.

### The ten classroom gates

| Gate | .tex 798 to 821 | Transcript | Verdict |
| --- | --- | --- | --- |
| `qa_grader` | 55 | 55 | MATCH |
| `qa_lesson_studio` | 79 | 79 | MATCH |
| `qa_construct_liveness` | 30 | 30 | MATCH |
| `qa_markbook` | 16 | 16 | MATCH |
| `qa_pupilstore` | 23 | 23 | MATCH |
| `qa_pupil_errors` | 42 | 42 | MATCH |
| `qa_parsons` | 13 | 13 | MATCH |
| `qa_learning_annotations` | 28 | 28 | MATCH |
| `qa_scenario_parity` | 8 | 8 | MATCH |
| `qa_fuzz` | 9 | 9 | MATCH |
| **Total 303** | 160, 821 | `55 + 79 + 30 + 16 + 23 + 42 + 13 + 28 + 8 + 9 = 303` | MATCH, arithmetic re-checked independently |

### Renderer figures

| Claim | .tex line | Evidence source | Measured now | Verdict |
| --- | --- | --- | --- | --- |
| 4.17 ms budget for 240 Hz | 160, 648, 657 to 660 | both performance artefacts, `target240HzFrameMs` | 4.17 | MATCH |
| Hardware Low 144.5 (116.8 to 144.9) | 160, 657 | `performance_eval_hardware.json` | median 144.5, all `[116.8, 144.5, 144.9]` | MATCH |
| Hardware Low P95 frame 7.5 ms, submission 1.9 ms | 657 | same | medians 7.5 and 1.9 | MATCH |
| Hardware High 128.2 (127.0 to 143.3) | 160, 658 | same | median 128.2, all `[127.0, 128.2, 143.3]` | MATCH |
| Hardware High P95 frame 7.8 ms, submission 2.9 ms | 658 | same | medians 7.8 and 2.9 | MATCH |
| Hardware meets budget in all six samples | 648, 663 | same | `highRefreshSubmissionReady` true in all 6 | MATCH |
| Software Low 25.7 (25.3 to 32.2) | 160, 659 | `performance_eval.json`, re-run 21:21 | median 25.7, all `[25.3, 25.7, 32.2]` | MATCH, was **DRIFT** at 18.7 |
| Software Low P95 frame 48.0 ms, submission 9.1 ms | 659 | same | medians of `[35.7, 48, 50.7]` and `[12.5, 9.1, 4.7]` | MATCH, was **DRIFT** |
| Software High 24.4 (23.3 to 25.0) | 160, 660 | same | median 24.4, all `[23.3, 24.4, 25.0]` | MATCH, was **DRIFT** at 17.1 |
| Software High P95 frame 50.8 ms, submission 13.9 ms | 660 | same | medians of `[47.5, 50.8, 54.9]` and `[34, 6.2, 13.9]` | MATCH, was **DRIFT** |
| "three independent samples per tier" | 648, 663 | same | `samplesPerTier: 3` for both artefacts | MATCH, was **DRIFT** at 1 |
| Software misses budget in all six samples | 648, 663 | same | all 6 submission readings above 4.17 ms | MATCH |
| "the two runs were captured a day apart" | 648 | both artefacts `generatedAt` | sentence replaced by the two dates, 27 July and 14 August 2026 | RESOLVED, was **DRIFT** |
| Same harness hash, different bundle hashes | 648 | both artefacts `artifactHashes` | harness `50681bdc...` in both; bundles `23201a39...` and `17c8d985...` | MATCH |
| Software artefact pins the bundle the text describes | 648 | artefact vs `src/robolearn/assets/web/bundle.js` | both `17c8d98582b431807fb4971b6a43743f0f3d48040380e72aea4b40035b48c174` | MATCH |

The drift was closed by running `node scripts/qa_performance.mjs --gl=software --repeat=3`, twice: once to restore three samples per tier, then again after `3c2a851` regenerated the bundle, so the committed artefact pins the bundle this dissertation describes. The audit itself did not run it, because it overwrites a committed evidence artefact; the release pass did, and updated the four numbers and the method sentences to what it produced. See CRITICAL 1 for the resolution and for the honest reading of how noisy these floor figures are.

### Local model figures

| Claim | .tex line | Evidence source | Measured now | Verdict |
| --- | --- | --- | --- | --- |
| Live Ollama 8 of 8 prompts | 160 | `docs/eval/vibe_eval.json` `passed`/`total` | 8/8, `percent` 100 | MATCH |
| 60 percent floor | 160 | `scripts/qa_vibe.mjs:130` to `:131` | `if (pass < Math.ceil(PROMPTS.length * 0.6)) process.exit(1)` | MATCH |
| Model `kodro-coder` | context | `vibe_eval.json` `model.name` | `kodro-coder:latest`, digest `60d11d6b...` | MATCH |
| Synthetic-persona artefact completes 40 cells | 160, 697 to 730 | `persona_eval_results.json` `cellCount` | 40, and `cells` array length 40 | MATCH |
| Funnel 40/40 compiled, ran, safe, task-complete | 697 to 730 | same, `funnel` | `{compiled: 40, ran: 40, safe: 40, taskComplete: 40}` | MATCH |
| Per-group 10/10 four times | 697 to 730 | same, `byPersona` | 8 personas at 5/5 each | MATCH in total (40), see note |
| Per-task 8/8 five times | 697 to 730 | same, `byTask` | 5 tasks at 8/8 each | MATCH |
| Mean turns 1.0 | 697 to 730 | same, `meanTurnsToSuccess` | 1, and every cell's `turns` is 1 | MATCH |
| Base seed 4046, temperature zero, up to three correction turns | 697 to 730 | same | `baseSeed` 4046, `maxTurns` 3 | MATCH |
| Model `qwen2.5-coder:3b` | 697 to 730 | same, `model` | `qwen2.5-coder:3b`, 3.1B, Q4_K_M | MATCH |

Note on the per-group row: the artefact groups by 8 named personas at 5 tasks each, not by 4 groups of 10. If `.tex` presents four rows of 10/10, that is a re-grouping of the same 40 cells rather than a different measurement. The totals reconcile exactly. Worth one glance by the author to confirm the grouping labels match the artefact's persona names.

Neither of these two artefacts was regenerated. Both are pinned and were read only, per instruction.

### KodroBench figures

Source: `results/kodrobench-leaderboard.md` and `results/kodrobench-v0.1.json`, both named in the `.tex` caption.

| Model | .tex 769 to 786 | Leaderboard | Verdict |
| --- | --- | --- | --- |
| Deterministic floor | 0.22 / 0.00 / 0.00 / 1.24 | 0.22 / 0.00 / 0.00 / 1.24 | MATCH |
| `gemma3:4b` | 0.24 / 0.00 / 0.20 / 0.56 | 0.24 / 0.00 / 0.20 / 0.56 | MATCH |
| `gemma3:1b` | 0.02 / 0.00 / 0.20 / 0.18 | 0.02 / 0.00 / 0.20 / 0.18 | MATCH |
| `llama3.2:3b` | 0.00 / 0.00 / 0.00 / 1.44 | 0.00 / 0.00 / 0.00 / 1.44 | MATCH |
| `kodro-fast` | 0.00 / 0.60 / 0.40 / 0.00 | 0.00 / 0.60 / 0.40 / 0.00 | MATCH |
| `kodro-coder` | 0.00 / 1.00 / 0.00 / 0.00 | 0.00 / 1.00 / 0.00 / 0.00 | MATCH |
| `llama3.2:3b` `gen_errors: 1` disclosed | caption | leaderboard `gen_err` column, 1 | MATCH |

All six rows match on all four quoted columns. This is the cleanest table in the document.

### Persona review and adversarial panel

| Claim | .tex line | Evidence source | Measured now | Verdict |
| --- | --- | --- | --- | --- |
| Round means 5.86, 6.50, 7.10, 7.36, 6.40 over 50, 12, 50, 50, 8 personas | 672 to 688 | none. The caption says so itself | no artefact exists | **UNVERIFIABLE, and the document says so** |
| 194 simulated personas across 7 rounds | 752 | `.tex:736` to `:758` round table | 30+28+30+30+30+30+16 = 194 | Internally consistent. No artefact |
| 85 confirmed defects | 752 | same | 4+13+16+23+15+8+6 = 85 | Internally consistent. No artefact |
| 75 fixed, 8 deferred, 2 reclassified | 752 | same | 33+20+8+8+6 = 75; 2+6 = 8; 1+1 = 2; 75+8+2 = 85 | Internally consistent. No artefact |

The panel arithmetic is fully self-consistent across all three dimensions, which is worth stating because it is the kind of table where invented numbers usually fail to add up. But it rests on session notes only, and `.tex:630` and `.tex:754` both say so. These figures cannot be re-derived by any command. That is a disclosed limitation, not a defect.

### Product and content counts

| Claim | .tex line | Evidence source | Measured now | Verdict |
| --- | --- | --- | --- | --- |
| 24 lessons | 160, 309 | `src/robolearn/assets/web/lessons.json` | list of length 24 | MATCH |
| KS split 3 / 4 / 9 / 8 | 309 | same file, `keyStage` field | 3+4+9+8 = 24, consistent with total | MATCH on arithmetic |
| Every lesson scores 100/100 through both markers | 160 | `qa_gate_runs`, `qa_grader` 55 and `qa_lesson_studio` 79 | gates present and reproduce | UNVERIFIABLE-WITHOUT-RERUN: `node scripts/qa_grader.mjs` and `node scripts/qa_lesson_studio.mjs` |
| 17 named mission sites | 261, 454 | the enumeration at `.tex:454` | 17 names counted | MATCH, internally consistent |
| 14 closed forms plus sensor-pose transform | 441 | `src/robolearn/engine/motion_model.py` | 14 functions matching `^def phys_`, plus `sensor_pose` at line 287 | MATCH |
| Mirrored in the JS model | 441 | `src/robolearn/assets/web/motion-model.js` | `sensorPose` at line 230, exported at 268 | MATCH |
| `arenaHalfExtentCm` = 1500 | 869 | both motion models | `motion_model.py:27` = 1500, `motion-model.js:33` = 1500 | MATCH |
| MCP offers 8 tools | 567 | `src/robolearn/mcp/tools.py` `TOOLS` | 8: `list_lessons`, `get_lesson`, `run_program`, `grade_program`, `check_api`, `validate_robot_spec`, `prove_contracts`, `pupil_progress` | MATCH |
| 25 readable resources | 567 | same, `list_resources()` | 25, being `kodro://api/reference` plus one per lesson | MATCH, and 1 + 24 lessons = 25 reconciles |
| 108 voice assertions | 559 | `scripts/qa_voice.mjs` | gate prints `PASS voice: 108 passed, 0 failed`; the sentence now reads "One hundred and eight assertions" | MATCH, was **DRIFT** at 47. See HIGH 3 |
| 14 of those cover the lesson library | 561 | same, lines 131 to 179 | 14 call sites | MATCH |
| Physical golden-trace tolerance 1e-12 relative or 1e-9 absolute | 503 | not re-measured | not checked | UNVERIFIABLE-WITHOUT-RERUN: the golden-trace parity gate named in Chapter 5 |
| F1 to F16 requirement counts | 316 to 345 | the tables themselves | internally consistent | MATCH |

### Study and ethics figures

| Claim | .tex line | Evidence source | Measured now | Verdict |
| --- | --- | --- | --- | --- |
| Protocol versioned under `docs/study`, marked `ETHICS_PENDING` | 168, 844 | `docs/study/` | 10 files present: README, protocol, consent form, information sheet, task script, measures, ethics draft, analysis script, 2 CSV templates | MATCH |
| Templates contain no participant rows | 844 | the two CSVs | `data_collection_template.csv` 1 line, header only. `participant_log_template.csv` 1 line, header only | MATCH |
| 12 participants target, 10 to 15 accepted | 842 | `docs/study/study_protocol.md` | figures appear in the `.tex`; protocol pack present | MATCH on presence. Not cross-read line by line |
| 6 condition sequences by 3 mission rotations, 3 missions | 842 | same | as above | MATCH on presence |
| Data category A0, participant category 2 | 164, 892 | department classification | no repository evidence exists for the classification scheme | UNVERIFIABLE from the repository. Author confirms against department guidance |

### Document self-measurements

| Claim | .tex line | Evidence source | Measured now | Verdict |
| --- | --- | --- | --- | --- |
| Body ends before the appendices | 113 | the PDF | body ends printed 48, Appendix A opens printed 49 | MATCH |
| Appendices excluded from the fifty-page limit | 113 | none in the repository | no authoritative brief exists | **UNVERIFIABLE.** See HIGH 4 |
| Document has 9 figures and 14 tables | 175 to 177, comment only | the `.tex` itself | 2 figures, 11 tables, 3 listings | **DRIFT.** See MEDIUM 7 |
| Zero em dashes and zero en dashes | `docs/GPT_HANDOFF.md:34` constraint | the `.tex` | 0 of each. The only `--` sequences are at lines 630 and 648 inside `\texttt{--suite=}` and `\texttt{--repeat=3}`, where the ligature is suppressed | **PASS** |
| 2 minutes 56 seconds against a 60 second ceiling | 915 | `scripts/qa_ui.mjs:98-105` records the timing, `:109` carries the 60000 ms ceiling | the ceiling is a literal in the shipped source; the timing is a dated record in the gate comment, corroborated in magnitude by a 325 s nine-flow suite run on 2026-08-14 | **SOURCED.** See LOW 12, which was wrong as first written |
| Trinket shuts down 31 August 2026 | 296 | external, `\citep{trinket2026}` | offline, not checked | UNVERIFIED. See LOW 11 |

---

## Compile health

Compiled three times with `pdflatex` from a clean scratch directory, using copies of the `.tex` and `img/*.png`. The repository PDF and its auxiliary files were never written to.

```
pass 1: Output written on Kodro_Dissertation.pdf (57 pages, 1025773 bytes).
pass 2: Output written on Kodro_Dissertation.pdf (59 pages, 1105463 bytes).
pass 3: Output written on Kodro_Dissertation.pdf (59 pages, 1105463 bytes).
```

All three passes exited 0. Pass 1 at 57 pages is normal: cross-references were unresolved. Passes 2 and 3 converged, which confirms the "run pdflatex twice" instruction in `docs/GPT_HANDOFF.md:34` is sufficient.

Engine: MiKTeX-pdfTeX 4.23, pdfTeX 1.40.28. No external `.bib`, so no bibtex or biber pass is needed; the bibliography is an inline `thebibliography` at `.tex:945`.

| Check | Result |
| --- | --- |
| Exit status, all passes | 0 |
| Final page count | 59 |
| Undefined citations | 0 |
| Undefined references | 0 |
| Missing files or images | 0 |
| LaTeX errors | 0 |
| Overfull `\hbox` | 2 |
| Underfull `\hbox` | 17 |
| Overfull `\vbox` | 0 |
| Underfull `\vbox` | 0 |
| "Float too large for page" | 1, at input line 345, by 53.00719pt |
| "`h` float specifier changed to `ht`" | 6 |

Re-measured after the three text corrections of 2026-08-14, two passes, both exit
0: 59 pages, 0 overfull `\hbox`, 0 "Float too large", 0 undefined citations or
references. The two overfull boxes sat in paragraphs those corrections rewrote.
See MEDIUM 10.

---

## Canonical source and build currency

Canonical source: `docs/dissertation/Kodro_Dissertation.tex`, 1066 lines, 189591 bytes. It has no `\input` or `\include`. Its only external inputs are `img/*.png`.

Canonical output: `docs/dissertation/Kodro_Dissertation.pdf`, 1105463 bytes, 59 pages, A4, producer MiKTeX pdfTeX-1.40.28, CreationDate Fri Aug 14 19:28:18 2026.

Both are committed at HEAD in `706f93d`. The `.tex` mtime is 19:21:13 and the PDF mtime is 19:28:20, so the PDF was built after the source was last edited.

**The shipped PDF matches the shipped source.** Three independent proofs:

1. The scratch rebuild converged at 59 pages and 1105463 bytes, byte-identical in size to the committed PDF.
2. `pdftotext` on both files produced identical text layers. Diff returned nothing.
3. Both `.toc` files are 96 lines and identical.

No other `.tex` or dissertation PDF competes for canonical status in `docs/dissertation/`.

---

## Citations and references

Audited with a regex pass over `\cite`, `\citep`, `\citet`, `\citealp`, `\citeyear` and `\citeauthor` against `\bibitem`.

```
distinct cite keys used:        25
total cite command occurrences: 41
bibitem entries defined:        25
duplicate bibitem keys:         {}
ORPHAN cite keys (cited, no bibitem):   0
UNUSED bibitem entries (defined, never cited): 0
```

Clean. Every key resolves, every entry is reachable, nothing is defined twice. The compile log independently confirms 0 undefined citations.

No reference in the list has the signature of a fabricated one. Entries name real venues with specific volume, issue, article and page detail. Two are flagged for author attention rather than as defects:

- `bcscode` at `.tex:952` carries the deliberate `[VERIFY VERSION, URL AND ACCESS DATE BEFORE SUBMISSION]` placeholder. Left in place.
- `huang2023` at `.tex:964` has a key year that contradicts its 2025 label. Cosmetic. See MEDIUM 8.

**No DOI or URL in the bibliography was resolved.** This audit ran offline. Marked UNVERIFIED as a class, not as an accusation.

---

## Fabrication sweep

Searched the `.tex` for every pattern implying human participants, teacher trials, classroom deployment, physical robot validation, safety certification or real deployment: `participant`, `pupils used/tested/tried`, `teachers used/tested/tried/reported/said`, `classroom trial/deployment/pilot`, `school trial/deployment/pilot`, `user study`, `usability study`, `real robot test`, `physical robot validation`, `deployed in a school`, `certif`, `survey of`, `interview`, `focus group`, `field trial`, `in production`, `real users`, `actual users`.

**Result: no fabricated human evidence, no fabricated hardware validation, no fabricated benchmark, no fabricated certification claim, no Turnitin figure of any kind.**

Every single hit is one of three things: a disclaimer, a description of the study that has not been run, or a boundary statement. The strongest of them:

- `.tex:164`: "It involves no human participants and no personal data used as research data".
- `.tex:168`: "No participant has been recruited, no data has been collected, and no figure from that study appears anywhere in this dissertation."
- `.tex:222`: "This dissertation does not ask whether Kodro teaches anybody anything, because answering that requires learners, and no human study was run."
- `.tex:600`: "Nothing here reports data from human subjects, because that study has deliberately been left for a point at which it can be run properly under consent."
- `.tex:734`: the advisory panel's methodology role "returned FAIL for the correct reason: synthetic personas are not human participants and must be treated cautiously ... The methodology failure is therefore not averaged away."
- `.tex:844`: "the study has not recruited anyone and the templates contain no participant rows." Verified directly. Both CSVs are header-only.
- `.tex:892`: "No human participant took part in any study reported in this dissertation ... The evaluation personas are language-model constructs, not people."
- `.tex:910`: "Whether that reduces a real builder's uncertainty is a claim about a person, and no person was measured."
- `.tex:936`: "Physical predictive validity, memory-driven improvement, learning gain and usefulness to real users all remain open evaluation questions."
- `.tex:833`, under threats to validity: "Every gate in this chapter was specified by the person whose work it certifies. A gate can only fail in a way its author imagined."

Every persona table caption states at the point of use that the rows are language-model constructs and not user evidence. The count of such disclaimers across the document is 23 separate lines. `.tex:236` concedes objective O6 outright: "the causal efficacy criterion has not been demonstrated."

This is the opposite of the failure mode the sweep was looking for.

---

## Boundary claims

The product must never be framed as a replacement for Gazebo, Webots, Isaac Sim or a physical validation rig. Checked and clean.

- `.tex:250`, explicit refusal: "Kodro also does not aim to replace the established heavyweight simulators such as Isaac Sim, Gazebo, Webots or MuJoCo. The useful relationship with those tools is a research bridge on the roadmap, not a claim of equivalence."
- `.tex:307`, user boundary: "Kodro is not for a professional roboticist ... does not pretend to compete with them."
- `.tex:156`: "a design aid and learning environment, not a same-to-same digital twin, electrical design tool or certificate that a physical robot is safe."
- `.tex:210`: "It does not mean that Kodro certifies software for deployment on physical hardware."
- `.tex:637`: "The human-readable companion report states that the evidence comes from a kinematic simulation and cannot certify a physical robot." Verified in `prove_report.md`, which carries that paragraph.
- `.tex:857` to `.tex:886`: an entire limitations chapter, ten sections, including "Frame rate is measured, not guaranteed" and "The measured-build simulation is the studio only".
- `.tex:880`: refuses to give purchasing or electrical advice.
- `.tex:901`: "The principal professional safety risk is false confidence."
- `.tex:910` and `.tex:936`: both narrow the strongest claim to the mechanical one.

**No overreach found.** The framing is consistently an offline-first learning and early-design test studio with disclosed fidelity boundaries, which is what it should be. Do not weaken any of these sentences.

---

## AI-assistance disclosure

**Located, intact, prominent.** It sits at `.tex:152`, inside the Declaration, immediately after the main declaration paragraph and before the Abstract, under its own `\paragraph` heading. It is on printed page 2, the first page after the title page. Quoted in full:

> **Use of generative artificial intelligence.** Anthropic Claude and OpenAI Codex assisted with software implementation, debugging, test design, code review, prose revision and document formatting. Their outputs were treated as proposals rather than evidence. I selected the project direction, reviewed the resulting changes and remain responsible for the submitted software and text. Automated assistants also contributed to the simulated persona inspections reported later, which are labelled as synthetic and are not presented as human evidence. Numerical claims are retained only where a committed artefact or repeatable command supports them. No result from a human study is reported because that study has not been run.

It names both systems, names what they did, assigns responsibility to the author, extends the disclosure to the persona evaluations, and states the evidence rule the rest of the document operates under. It is reinforced at `.tex:896`: "the Declaration names the generative systems used and assigns responsibility to the author rather than to those systems."

Nothing about it is weakened or hedged. It must not be removed, softened or moved further back in the document.

---

## Actions only the author can take

1. **Resolve the renderer software rows.** Either re-run `node scripts/qa_performance.mjs --repeat=3` under forced software rasterisation and update `.tex:659`, `.tex:660`, `.tex:648` and `.tex:663` to the new figures, or restore the `f01767e` version of `docs/eval/performance_eval.json` as the committed software evidence. This audit did not choose between them and did not touch the artefact.

2. **Decide what "at the final source state" should say.** Either re-run the Python suite at HEAD and regenerate `docs/eval/test_suite.json`, or rewrite `.tex:633` and `.tex:908` to name commit `02dd047` explicitly rather than claiming the final state.

3. **Confirm the page limit against the current Canvas brief.** The repository contains no authoritative statement of it. Confirm whether the limit counts every page in the submitted PDF (59), all arabic-numbered pages (50), or the body excluding appendices (48). If it counts every page, nine sheets of front matter need addressing and this is urgent.

4. **Update the voice assertion count** at `.tex:559` from forty-seven to whatever the gate prints at the submitted commit, and check that "Fourteen of those" at `.tex:561` still reads correctly against the new total.

5. **Correct or delete the "artefact-tracking gap" section** of `docs/eval/qa_gate_runs_2026-08-14.md`, lines 79 to 93. All three named artefacts are tracked.

6. **Close the `bcscode` placeholder** at `.tex:952`. Verify the BCS Code of Conduct version, URL and access date, then replace `[VERIFY VERSION, URL AND ACCESS DATE BEFORE SUBMISSION]`. This audit deliberately left it in place. It currently renders in bold in the References. While on bcs.org, also settle the BCS traceability table PR 3 carries and this document lacks: the conditions and the exact block to lift are in `.kodro/autonomy/CA2_RECONCILIATION.md` section 10.4.

7. **Verify the Trinket shutdown claim** at `.tex:296`, and the `trinket2026` reference. It is a dated external fact underpinning part of the motivation and it could not be checked offline.

8. **Resolve every DOI and URL in the bibliography online.** None was resolved by this audit. Twenty-five entries.

9. **Fix or accept the two overfull boxes.** The one at `.tex:160` to `.tex:161` overhangs by about 14mm in the abstract, the first body page read.

10. **Decide what to do with the three untracked files**: `docs/eval/stt_bench.json`, `docs/eval/stt_clips/`, `scripts/bench_stt.py`. Nothing in the dissertation cites them.

11. **Fix or delete the stale source comment** at `.tex:175` to `.tex:177`. It claims 9 figures and 14 tables against an actual 2 and 11. It does not render, so this is optional.

12. **Optionally fix the `huang2023` key year** at `.tex:964`, or leave it. It renders correctly either way.

13. **Confirm the ethics classification** (data category A0, participant category 2) against current department guidance. The repository holds no copy of the classification scheme.

14. **Glance at the persona table grouping** at `.tex:697` to `.tex:730`. The artefact groups 40 cells as 8 personas by 5 tasks. Confirm the table's row labels describe the same grouping. Totals reconcile exactly either way.
