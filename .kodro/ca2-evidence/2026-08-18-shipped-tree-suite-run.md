# Verification log: the suite at the shipped tree, after the merge

Date 2026-08-18. Branch `main`, commit `cc5fb3c`.

This log exists because `docs/ca2-demo-script.md` speaks its numbers over the
running product, and the numbers it spoke came from `66e8632`, twelve commits
behind what actually ships. The commits in between added tests. The script would
have had the presenter say 1,642 while the screen said 1,649.

## The tree measured here is the tree that ships

`cc5fb3c` is the merge commit for PR 4. It has two parents, so a tree comparison
is worth doing rather than assuming:

```
git diff --stat 7855355 cc5fb3c
(no output)
```

Identical. The run below was executed at `7855355` with a clean working tree, so
it measures the shipped content exactly.

## The run

Windows, Python 3.13.3, clean tree, full suite, no subset flags:

```
python -m pytest -q --basetemp=<fresh empty dir>
```

```
TOTAL                                     7065    520   1734    205    91%
Required test coverage of 85% reached. Total coverage: 90.85%
1649 passed in 361.62s (0:06:01)
```

Exit 0. 1,649 collected, 1,649 passed, 0 skipped, 0 failed, 90.85 percent
against the 85 percent gate.

`--basetemp` points at a fresh empty directory because the default pytest temp
root under `%LOCALAPPDATA%\Temp` carries a host ACL defect. That is a
machine fault, not a suite fault, and it is recorded in
`2026-08-15-suite-reproduction-and-tempdir-defect.md`.

## What changed against the previous release run

| | `66e8632` | `cc5fb3c` |
|---|---|---|
| collected | 1,642 | 1,649 |
| passed | 1,641 | 1,649 |
| skipped | 1 | 0 |
| coverage | 90.78 percent | 90.85 percent |

Seven tests were added across the twelve commits: teacher-materials coverage in
`38b5380` and `1fd7932`, and the documentation-link containment check in
`7855355`.

The skip is gone. That is worth stating carefully, because the same skip has
appeared and vanished before and it says nothing either way about the Tk
intermittency discussed in `docs/ca2/CLAIM_LEDGER.md`. One clean run is one
clean run.

## The coverage figure collides with an unrelated one

90.85 percent is also the figure `docs/eval/test_suite.json` pins for `e70b98b`.
That is a coincidence of rounding on a different tree with a different test
count (1,641 there, 1,649 here), and the two must not be read as the same
measurement. `test_suite.json` stays pinned to `e70b98b` for the reasons given
in `2026-08-18-release-run-and-artefact-divergence.md`.

## The other gates, same day, same tree

Run locally at `7855355`, all exit 0:

```
qa_interpreter        180 passed, 0 failed
qa_honesty            122 passed, 0 failed
qa_secrets             42 passed (490 of 797 tracked files read, 13 rules)
qa_vibe               8/8 through the interpreter, model kodro-coder:latest
node scripts/build_web.cjs --check     bundle.js is up to date
python -m mkdocs build --strict        exit 0, 0 warnings
python -m mypy src/kodro           no issues in 73 source files
ruff check / ruff format --check       clean, 171 files
```

`qa_ui` and `qa_worlds` print SKIP locally without a static server on `:8099`.
They are not skipped in CI: run 32103728626 on `main` ran them as four separate
steps, `UI paint gate`, `UI behaviour gate`, `UI layout gate` and `UI modal
gate`, all four success on the Linux leg.

`qa_vibe` rewrites `docs/eval/vibe_eval.json` on every run. It was restored to
its committed content afterwards. The pass rate and the model digest were
identical; only the timestamp and the model's per-prompt wording differed, and
`docs/dissertation/DIAGNOSTIC_2026-08-14.md` line 495 cites that timestamp.

## Linux CI reports different numbers, and both are true

The same tree on the Linux leg of run 32103728626 gives 1,616 passed, 20
skipped, 88.85 percent. Different platform, different skip set. Neither figure
supersedes the other. No document was edited to make them agree.
