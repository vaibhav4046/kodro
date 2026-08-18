# Verification log: the 2.1.0 release run, and why the pinned artefact stays pinned

Date 2026-08-18. Branch `agent/kodro-ca2-candidate`, commit `66e8632`.

This log exists because the version bump to 2.1.0 broke the one condition
`FINAL_CHECKLIST.md` attaches to `docs/eval/test_suite.json`, and the fix the
checklist recommends is the wrong fix three weeks before a graded submission.
Both halves are recorded here: the run, and the decision not to regenerate.

## Why the condition broke

The checklist says the pinned artefact stays correct "only while nothing under
`tests/` or the Python source changes after the run", and gives the test:

```
git diff e70b98b..HEAD -- tests/ 'src/kodro/**/*.py'
```

That diff was empty across the entire sixty-one-commit candidate branch up to
`bc49376`. Every commit on the branch was documentation, tooling, web assets or
evidence. The bump commit is the first thing to touch Python source since the
artefact was generated, and it touches exactly two files:

```
 src/kodro/ui/splash.py           | 5 ++++-
 tests/unit/test_splash_and_main.py   | 21 +++++++++++++++++
```

`splash.py` swapped a hardcoded `v2.0.0` for the package metadata lookup every
other surface already used, and the test pins that behaviour so a future bump
cannot silently leave the splash behind. Neither change alters what any other
test exercises. The diff is non-empty all the same, so the condition is broken
whether or not the change is material.

## The run

Pre-state captured before the run, on a clean tree, and read back afterwards
rather than re-measured:

```json
{
  "commit": "66e86321b750c068ddeab31f1426393097b80aaf",
  "describe": "v2.0-submission-93-g66e8632",
  "workingTreeClean": true,
  "capturedAt": "2026-08-18T01:37:14+00:00"
}
```

JUnit root attributes, machine-read:

```
errors="0" failures="0" skipped="1" tests="1642" time="159.469"
timestamp="2026-08-18T02:37:23.458276+01:00"
```

Coverage totals:

```
covered_lines      6539
num_statements     7065
missing_lines       526
num_branches       1734
num_partial_branches 205
percent_covered    90.7830435276736
```

So: 1,642 collected, 1,641 passed, 1 skipped, 0 failed, 0 errors, 159.47s,
exit 0, 90.78 percent branch-aware coverage against the 85 percent gate.

Read the count change carefully, because the obvious reading is wrong. The
baseline at `e70b98b` was 1,641 collected and 1,641 passed. This run collected
1,642, which is the baseline plus the one test added above, and passed 1,641.
Nothing regressed. One previously-passing test skipped.

## A stale coverage file almost put the wrong number in the record

The run's coverage JSON, read at the path it was written to, reported 7,064
statements, 520 missing and 90.85 percent, with `meta.timestamp` of
`2026-08-17T14:23:47`. The same run's terminal output said 7,065 statements,
526 missing and 90.78 percent, and its JUnit said `2026-08-18T02:37:23`.

The JSON was a leftover from the previous day that survived at the target path,
and its figures matched the `e70b98b` artefact exactly, which is what made it
plausible. Regenerating from the live `.coverage` data file settled it:

```
python -m coverage json -o cov_fresh.json
-> 7065 statements, 526 missing, 6539 covered, 1734 branches,
   205 partial, 90.7830435276736 percent
```

Two independent sources now agree on 90.78. Anyone re-running this must delete
the coverage JSON target before the run or cross-check its `meta.timestamp`
against the JUnit timestamp. A coverage artefact that silently reports the
previous run is the most dangerous kind of stale file here, because the number
it reports is a real number from a real run and nothing about it looks wrong.

## The skip

```
tests/unit/test_ai_studio.py::test_studio_generate_saves_lesson
SKIPPED - Tk unavailable: Can't find a usable tk.tcl
```

Characterised rather than assumed. Two things are worth recording.

The error text is misleading. `ttk/treeview.tcl` and the rest of the Tcl
library are present on this host; the message names a file that exists. The
recorded reason in earlier runs was "Can't find a usable init.tcl" and this run
said `tk.tcl`, which is the same class of failure with a different file named.

It is intermittent, not deterministic. Run alone, three times:

```
1 passed in 1.19s
1 passed in 0.89s
1 passed in 0.88s
```

It only skips inside a full-process run, after other Tk roots have been created
and destroyed. That matches the history `CLAIM_LEDGER.md` already records for
this host: four full runs gave 1 skip, then 2, then 0, then 0. This run makes
five, and the fifth gave 1. The cause is still not established, so nothing here
should be read as one, and none of it is a reason to re-run until the number
looks better.

## The decision: disclose, do not regenerate

Regenerating `docs/eval/test_suite.json` at `66e8632` is one command. The
consequences are not.

Twenty-nine sites quote either the artefact's commit or its figures. Twenty are
numeric, spread across `GPT_HANDOFF.md`, `HANDOFF_MASTER_PROMPT.md`,
`ca2-demo-script.md`, `CLAIM_LEDGER.md`, `FINAL_CHECKLIST.md`, `SCRIPT.md` and
`Kodro_Dissertation.tex`. Nine more are spelled out as spoken words in
`SCRIPT.md` and `FINAL_CHECKLIST.md`, where no numeric grep can see them. Five
of the numeric sites are in the dissertation itself, one in the declaration and
one in the abstract, and moving them means rebuilding a sixty-page PDF that has
already been proofread.

Against that: every one of those sites names commit `e70b98b`, and every claim
they make about `e70b98b` is still true and still reproducible. Checking out
`e70b98b` and running the suite gives 1,641 collected, 1,641 passed, 0 skipped,
90.85 percent, exactly as the artefact says. The artefact was designed to be
commit-pinned for precisely this reason.

So the artefact stays at `e70b98b`, and the divergence is disclosed instead.
The surfaces that speak in the present tense or get read aloud on camera move to
the release-run figures, because those are the ones that would otherwise assert
something false about the shipped commit. The dissertation and its PDF do not
move, because what they say about `e70b98b` remains true.

The cost of this route is one more thing a marker can ask about, and the answer
is written down. The cost of the other route is five edits inside a graded
document and a PDF rebuild, to replace true statements with different true
statements. Path chosen accordingly.

## Where the release figures now appear

- `docs/ca2/CLAIM_LEDGER.md`, Testing section: rows split so the pinned-artefact
  claims and the release-commit claims are separately sourced.
- `docs/ca2/FINAL_CHECKLIST.md`: the artefact item records the divergence, the
  test that detects it, and this decision.
- `docs/ca2-demo-script.md` line 5 and its source note.
- `docs/ca2/SCRIPT.md`: the spoken figures in the evidence block.
- This file, as the committed source the spoken figures point at.
