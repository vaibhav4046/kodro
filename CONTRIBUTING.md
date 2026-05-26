# Contributing to RoboLearn

Thank you for your interest. This project is part of a UK honours-year
dissertation and is graded on code quality, so contributions are held to a high
standard.

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
mypy src/
pytest --cov=src/robolearn
```

CI runs the same checks on Ubuntu, macOS and Windows.

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
