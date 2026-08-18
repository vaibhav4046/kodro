# Verification log: full Python suite reproduced, and a host defect that blocks the plain command

Date 2026-08-15. Branch `agent/kodro-ca2-candidate`.

## The plain command does not run on this machine

`python -m pytest` fails at setup for every test that takes the `tmp_path`
fixture. The failure is not in the product and not in the suite. pytest's base
temporary directory on this host cannot be listed:

```
%LOCALAPPDATA%\Temp\pytest-of-<user>
```

(The local account name is redacted deliberately. This repository is public and
no tracked file carries it. That was checked with `git grep` for the account name
before this file was committed, and this file is written so it stays true.)

Measured properties of that path:

- it is an ordinary directory, not a reparse point or a junction
- `os.access` reports read, write and execute all True
- `os.listdir` raises `PermissionError: [WinError 5] Access is denied`
- `icacls` on the path is itself denied, exit code 5

So the ACL denies the owner, and even reading the ACL is denied. pytest calls
`listdir` on that base directory to garbage-collect old runs before it creates a
new `tmp_path`, which is where it dies. Repairing it needs elevation and was not
attempted, because it is a host repair and not a repository change.

## Workaround, and the reproduction it produced

Point pytest at a fresh base directory:

```
python -m pytest --basetemp=<a fresh empty dir>
```

Run on the current tree with that flag:

```
1638 passed, 1 skipped in 131.71s (0:02:11)
EXIT=0
TOTAL                                        7062    516   1732    206    91%
Required test coverage of 85% reached. Total coverage: 90.90%
```

The counts and the coverage match the recorded run in `docs/eval/test_suite.json`,
which pins commit `aa174cf`: 1638 passed, 1 skipped, 90.9 percent against the 85
gate, 7062 statements, 516 missing, 1732 branches, 206 partial. Wall time does
not match and is not expected to: that artefact records 170.53 seconds against
131.71 here. The artefact already records the `--basetemp` form of the command,
so the workaround below is not new information, it is the reason that form is
there.

The pinned file was deliberately NOT updated. It records what was measured at
the commit it names, and bumping it would destroy the only independent check
that the suite has not drifted.

## Caveats that must travel with these numbers

- The skip count is not stable on this host. Separate runs have reported 1, then
  2, then 0 skips. The pass count has been stable. Do not quote a skip count as
  a fixed property of the suite.
- 13 test files are guarded on Tk being importable, holding 169 collected tests.
  They run here. On a machine without Tk they would skip, and the totals above
  would not reproduce.
- Running a single test file on its own always exits 1, because the project
  coverage gate fails under 85 percent when only one file is collected. That is
  the gate reacting to a partial run, not a test failure. Never pass `--no-cov`
  to work around it, because that also disables the gate the suite relies on.

## Where the plain command still appears

Documents that offer `python -m pytest` as the way to reproduce the suite are
correct about the command and wrong about this machine. The `--basetemp` note
belongs next to any such instruction, because an agent or a marker who runs the
plain form here will see setup errors and may read them as product failures.
