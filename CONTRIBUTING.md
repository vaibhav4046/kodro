# Contributing to Kodro

Thank you for your interest. This project is part of a UK honours-year
dissertation and is graded on code quality, so contributions are held to a high
standard.

If you are working here with an AI assistant, read [AGENTS.md](AGENTS.md) first.
It carries the operating rules and the traps in this codebase that have already
cost real time, and it applies to human contributors too.

## Local setup

```bash
python -m venv .venv
. .venv/Scripts/activate  # Windows
# or: . .venv/bin/activate  (macOS / Linux)
pip install -e ".[dev]"
pre-commit install
```

## Quality bar

Before opening a pull request, every one of these must pass:

```bash
ruff check .
ruff format --check .
mypy src/kodro
pytest --cov=src/kodro
```

CI runs the same checks on Ubuntu, macOS and Windows.

### Two Windows-only pytest gotchas

If `pytest` fails at *setup* on roughly 200 tests with
`PermissionError: [WinError 5] Access is denied`, the culprit is the default
temp root, not the tests: `%TEMP%\pytest-of-<user>` can be left with an ACL the
current user cannot traverse (a stale directory from an elevated run does it).
Point pytest somewhere it definitely owns:

```bash
pytest --basetemp=.pytest-tmp
```

Do **not** pass `--no-cov` to speed a run up. `tests/conftest.py` applies
pytest-cov's `no_cover` marker to the node-subprocess suites, and with coverage
disabled that marker's context manager has nothing to pause, so pytest-cov 7.1
raises `AttributeError: 'NoneType' object has no attribute 'pause'` and three
tests in `tests/unit/test_web_bundle.py` fail for reasons unrelated to the code.
To relax only the gate, use `--cov-fail-under=0` and leave coverage running.

Note that the same `conftest.py` skips coverage for those subprocess suites on
Windows + Python >= 3.13 outside CI, so a local coverage percentage is a
conservative floor: CI measures higher, never lower.

## Style guide

- **Procedural Python.** The public surface area (`rover_api`, the lesson
  schema, the memory store) is procedural. Classes are reserved for engine
  internals where state genuinely benefits from encapsulation.
- **Type hints on every public function.** Use PEP 604 unions (`int | None`).
- **Docstrings.** Every public function gets a one-line summary plus an
  `Args`/`Returns` block if non-trivial.
- **Tests first.** Write the pytest case before the implementation.
- **Files under 400 lines, functions under 50.** Refactor before exceeding.

## Commit style

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(engine): add per-terrain friction
fix(ui): correct dark-theme contrast on console
test(memory): cover hint engine while_no_progress rule
docs(teachers): expand curriculum mapping for KS4
chore: bump pymunk to 6.7
```

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
