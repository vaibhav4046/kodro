# Verification log: test-suite artefact and the "final source state" anchor

Date 2026-08-14. Branch `agent/kodro-ca2-candidate`. Closes audit HIGH 2 and
annotates MEDIUM 5 through 9.

## What was wrong

`docs/eval/test_suite.json` recorded a run taken at commit `139a2c8`. HEAD was
`aa174cf`, eight commits later, and two test files and seven source files had
changed in between. The dissertation quoted that artefact's headline figures in
four places and described them as measured "at the final source state", which
was a phrase that stops being true the moment anybody commits anything. The
count itself predated the MCP and voice work the same document describes.

The audit offered two fixes: re-run the suite at HEAD and update the numbers, or
change the phrase to name the commit the artefact actually records. Both were
applied. Route one alone would go stale on the next commit, exactly as `139a2c8`
had. Route two alone would leave the document quoting a count from before the
subsystems it describes existed.

## The run

Clean tree, verified before starting: `git status --porcelain` empty, no
untracked files, so the counts are reproducible by checking out the commit.

```
1638 passed, 1 skipped in 170.54s (0:02:50)
Required test coverage of 85% reached. Total coverage: 90.90%
```

Every field in the regenerated artefact was read out of the run's own outputs
rather than transcribed by eye:

```
junit attrs: {'errors': '0', 'failures': '0', 'skipped': '1',
              'tests': '1639', 'time': '170.527'}
cov totals:  covered_lines 6546, num_statements 7062,
             percent_covered 90.90288833295429, missing_lines 516,
             num_branches 1732, num_partial_branches 206
```

There is no generator script for this artefact. `git grep -ln "test_suite.json"
-- scripts tools src` returns nothing, so the schema was preserved field by
field by hand and the `note`, `measures` and `coverageFloorDisclosure` strings
were carried across verbatim. Only `provenanceNote` was rewritten, to say what
the replaced artefact was and why it no longer described the tree.

Two things were deliberately not copied out of the raw outputs. The JUnit XML
carries `hostname='vaibhav'`, and the skip message carries the full local Tcl
path. Neither belongs in a published artefact, and the existing elision
"(host Tcl path elided)" was kept.

Coverage did not move. 90.90288833295429 rounds to the same 90.90 the document
already printed, so no coverage figure needed editing anywhere. The thirteen new
tests added lines and covered them.

## What changed in the text

Seven edits removed the phrase "at the final source state" from the
dissertation entirely and replaced the four headline figures:

| Location | Was | Now |
| --- | --- | --- |
| `.tex:150` | "the test files added since the tag" | "the working-tree status at that commit ... \texttt{aa174cf}" |
| `.tex:160` | "At the final source state ... 1,626 ... 1,625" | "At commit \texttt{aa174cf} ... 1,639 ... 1,638" |
| `.tex:633` | "At the final source state ... 1,626 ... 1,625" | "At commit \texttt{aa174cf} ... 1,639 ... 1,638" |
| `.tex:633` | "belongs to the final state" | "belongs to that commit" |
| `.tex:641` | "were re-run at the final source state" | "were re-run on 14 August 2026" |
| `.tex:850` | "The 1,626-test ... at the final source state" | "The 1,639-test ... at the commit recorded in" |
| `.tex:908` | "At the final source state ... 1,625 of 1,626" | "At the commit recorded in ... 1,638 of 1,639" |

`.tex:490` also matches "final state" and was left alone: it is the unrelated
sense, "rather than jumping to a final state", about robot motion.

`docs/ca2/CLAIM_LEDGER.md` took the same three corrections, plus the commit in
its header line.

## Compile

Two passes into the existing `_build` directory, which holds 109 tracked files
and was not deleted:

```
PASS1 EXIT=0
PASS2 EXIT=0
Output written on ..._build\Kodro_Dissertation.pdf (59 pages, 1111967 bytes).
Overfull: 0 | Float too large: 0 | Undefined: 0
LaTeX Warning: Citation: 0 | LaTeX Warning: Reference: 0
```

The tracked PDF was refreshed from that build, sha256
`5344b0aa344d72f9bbc7fcb4c8e8b6addcfd97f5f0680c158832adac0c1003be`.

Proof that the rendered PDF carries the new figures and not the old ones, by
`pdftotext Kodro_Dissertation.pdf -` and counting occurrences:

```
1,639                4
1,638                3
1,626                0
1,625                0
aa174cf              3
final source state   0
```

Absence is what mattered here, so it was measured rather than assumed.

## Gates

```
PASS  honesty: 121 passed, 0 failed
10 passed (406 files, 100 protected characters)          # qa_encoding
```

No source file changed, so the bundle, voice and interpreter gates were not
re-run.

## The honest limit on this fix

Naming a commit is stable in a way that "the final source state" was not, but it
is not a promise that HEAD will stay where it is. Any later commit touching
`src/` or `tests/` invalidates the count in exactly the same way. The only safe
procedure before submission is to re-run the suite and regenerate the artefact
one final time on the tree that ships, and then check that the four figures in
the `.tex` and the row in the claim ledger still match it.

## Audit sweep in the same pass

MEDIUM 5 through 9 were verified at HEAD rather than assumed from memory, and
their entries in the audit were annotated with what closed them:

- **5**, false claim in the evidence transcript: `qa_gate_runs_2026-08-14.md`
  now carries "The artefact-tracking gap, now closed" with its `git log` proof.
- **6**, undercount: `.tex:150` now says "Seven artefacts" and lists all seven.
- **7**, wrong figure and table count in a source comment: comment now says
  "2 figures and 11 tables"; measured 2, 11 and 3 lstlistings at HEAD.
- **8**, citation key contradicting its label: key is `huang2025` at `.tex:964`
  and at both call sites, zero undefined citations in the compile. The DOI is
  still unverified, because this machine is offline, and stays labelled so.
- **9**, untracked evidence files: thirteen files now tracked, including the ten
  clips. `git status --porcelain docs/eval scripts` is clean at HEAD.

Checking 9 surfaced one thing worth its own line. The clips are synthesised, five
commands through `Microsoft David Desktop` and `Microsoft Zira Desktop` via
`System.Speech.Synthesis.SpeechSynthesizer`. The dissertation already says "ten
synthesised clips" at `.tex:559`. `docs/ca2/CLAIM_LEDGER.md` did not, so a
reader of the ledger alone would have taken 0.25 word error rate for a field
measurement on human speech. A row and a paragraph were added there saying the
audio is synthetic and that the figure is therefore a floor on error.

A "Status after the release pass" table was added to the audit's bottom line
covering all fourteen findings. Ten are resolved. HIGH 4, LOW 11 and LOW 13 are
open and are author actions that cannot be closed from an offline machine; none
of the three is a fabrication risk, all three are a refusal to assert something
unverified. LOW 14 was never a defect.
