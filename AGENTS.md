# Working rules for this repository

Kodro is built with heavy AI assistance and says so in the dissertation. This
file is the other half of that disclosure: the rules the assistance runs under.
An assistant that writes code here without reading this will produce work that
fails review, because most of what gets rejected in this project is rejected on
process rather than on syntax.

Written for automated assistants first. A human reading it gets the same rules.

## What this project is

An offline-first learning and early-design robot studio. A desktop application
and a browser application share one lesson format, one world format, one grader
and one motion model, with a parity test that fails if they diverge.

It is not a replacement for Gazebo, Webots or Isaac Sim, and nothing in it has
been validated against physical hardware. Say that plainly whenever the question
comes up. There is no serial port, no GPIO, no motor driver and no hardware
abstraction layer anywhere in `src/`, so do not add an arming API, a watchdog or
a command limiter: they would describe a subsystem that does not exist, on a
submission whose honest position is that no robot was built.

## The ten rules

1. Preserve existing work. No destructive reset or checkout, no deleting
   untracked files, no dropping stashes, no overwriting a worktree to tidy it.
2. Do not fabricate a pass, a benchmark, a user study, a teacher result, a
   physical validation, a safety claim, a deployment or a screenshot.
3. Never claim parity with a physics-accurate simulator. Disclosed fidelity
   boundaries are the product's position, not a weakness to write around.
4. Do not hide AI assistance or remove a required academic-integrity disclosure.
5. Never commit secrets, tokens, credentials, private paths, local usernames,
   generated cache files or personal participant data. `scripts/qa_secrets.mjs`
   enumerates through `git ls-files`, so it never sees untracked files: stage
   before you scan or the scan proves nothing.
6. A generated bundle must match its source. A generated lesson JSON must match
   its authoritative lesson files. Generated PDFs must match their source.
7. No behavioural change without a focused regression test. No green label when
   a test skipped, timed out or collected no assertions.
8. Do not redesign the product. Preserve the existing identity and token system;
   improve the surfaces that are actually being assessed.
9. Do not start an engine rewrite, a ROS integration, a photoreal asset pipeline
   or a simulator bridge unless a current failing gate proves it is required.
10. Stop when the acceptance criteria are met. Endless autonomous work is a
    failure mode when it destabilises a finished candidate.

## Never make a gate green by changing the gate

This is the rule most likely to be broken by an assistant under pressure, and
the one that does the most damage when it is.

Do not relax a lint rule, widen an allowlist, lower a coverage floor, delete an
assertion or edit a recorded figure to make a check pass. `scripts/qa_mcp_finale.py`
states the principle in its own docstring: the numbers are hardcoded deliberately,
and when it fails the fix is to update the document and then this file, in that
order, not to relax the check.

If a gate is genuinely wrong, say so in the commit message with the evidence,
and change it as its own commit that does nothing else.

## Do not repair dated records

Several files are historical by design: evidence snapshots under
`.kodro/ca2-evidence/` and `.kodro/autonomy/`, audit documents carrying a date in
their name, night logs, recorded gate transcripts, and any paragraph that opens
by naming the date it describes. Their numbers are expected to disagree with
today's numbers. Rewriting them to agree destroys the audit trail that makes the
current figures believable.

The one exception is a line-number anchor, and only when the content it points at
is verifiably unchanged.

## Before changing code

Read the module and its tests first. Never edit a file from its name or from
memory of it.

State the observed defect, find the smallest repair that fixes the cause rather
than the symptom, and check whether anything else depends on the behaviour you
are about to change. A guard added in one caller leaves every sibling caller
broken; a guard in the shared function is both the smaller diff and the real fix.

Watch for conversions that look equivalent and are not. `os.path.dirname("b.md")`
returns an empty string and `PurePosixPath("b.md").parent` returns `"."`, so code
branching on `if here:` changes behaviour silently under a naive pathlib
migration. `scripts/qa_citations.py` uses `rpartition("/")[0]` for exactly this
reason.

## Verification

Done means exercised, not compiled. Type checking passing is not verification.

Run the command CI runs, not one that resembles it. `mypy src/kodro` reports
success over 73 files; a bare `python -m mypy` sweeps in `tests/` and reports 228
errors that are not defects. The full CI definition is `.github/workflows/ci.yml`
and it is the authority.

CI fires only on push to `main` and on pull requests. A pushed branch with no
open pull request gets no CI at all, which is how the lint gates in this repo
stayed red for 63 commits without anyone noticing. Open the pull request early.

Several gates exit 0 while printing SKIP. Parse the output; never trust the exit
code alone. An exit code read after a pipe belongs to the last command in the
pipe, so redirect to a file and then read `$?`.

Coverage artefacts are worse than they look: a leftover JSON at the target path
survives a run and reports the previous run's numbers. Cross-check its timestamp
against the JUnit XML, or regenerate from the live `.coverage`.

## Reporting

Lead with the outcome. Paste real output. If a step was skipped, say it was
skipped. If a test failed, quote the failure rather than softening it. If the
task turned out to be different from what was asked, say that instead of quietly
doing something adjacent.

Numbers in a report must come from an artefact read in the same session or a
command run in the same session. Anything older gets labelled with where it came
from and when.

## Attribution

Commits and pull requests in this repository carry no assistant attribution
trailers, no co-author lines naming a model or a vendor, and no generated-by
footers. This is deliberate and is enforced by a git hook. It is a repository
convention about commit metadata, and it does not touch the academic-integrity
disclosure in the dissertation, which stays.
