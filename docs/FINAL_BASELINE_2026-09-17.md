# Final baseline — 2026-09-17

Frozen reference for the `release/astra-final-2026-09-17` candidate. Numbers
below were measured in-session on 2026-09-17 (Windows, Python 3.13.3,
`PYTHONPATH=src`). Anything older is labelled with its source.

## Frozen state

- HEAD at measurement: `87d38e7` ("Harden public AI runtime and Astra disclosure").
- Branch: `release/astra-final-2026-09-17`, tracking `origin/main`.
- In-flight uncommitted work at baseline time: Genesis loop
  (`src/kodro/genesis.py`, `tests/unit/test_genesis.py`,
  `tests/unit/test_genesis_cli.py`, `docs/genesis.md`, `kodro-genesis`
  entry in `pyproject.toml`) plus the cloud-copy truthfulness fix
  (`panels.jsx`, `bundle.js` rebuild, `README.md`, `docs/mcp.md`,
  `test_web_offline.py` guard, CHANGELOG `[Unreleased]`).

## Measured gate results (this session)

| Gate | Command | Result |
|---|---|---|
| Full Python suite | `pytest -rf --timeout=120 --timeout-method=thread --cov-fail-under=0` | **1905 passed, 0 failed**, total coverage 92%, 302 s |
| Ruff lint | `ruff check .` | clean |
| Ruff format | `ruff format --check .` | 194 files clean |
| Types | `mypy src/kodro` | 76 files, no issues |
| Node QA battery | 25× `node scripts/qa_*.mjs` | 25/25 exit 0, no SKIP lines |
| Astra zero-cost contract | `node scripts/qa_astra_provider.mjs` | 32 passed, 0 failed |
| MCP smoke | `python scripts/smoke_mcp.py` | 2 of 2 entry points clean |
| MCP finale pin | `python scripts/qa_mcp_finale.py` | CHAIN CLEAN (8 tools, 25 resources) |
| Web boot + privacy | `node scripts/build_web.cjs --static` + `node scripts/qa_web.mjs` | 5/5 (mount, paint, zero external requests, clean console) |
| Bundle freshness | `node scripts/build_web.cjs --check` | up to date; rebuild byte-deterministic |
| Docs build | `python -m mkdocs build -f docs/mkdocs.yml --strict` | built in 6.02 s |
| Secrets | `node scripts/qa_secrets.mjs` (staged tree) | 42 passed, 534 of 839 tracked files read |

## Architecture facts (verified, not assumed)

- Shipped web AI runtime: local Ollama on `localhost:11434` only. No
  `fetch` to any remote AI host in shipped provider files; enforced by
  `tests/unit/test_web_offline.py` and `scripts/qa_astra_provider.mjs`.
- Astra in the webpage: one unavailable option that throws on `generate()`
  and issues zero requests. No OpenAI key in browser storage (legacy key
  literals are delete-only).
- MCP surface: exactly 8 tools (see `docs/mcp.md`), all deterministic over
  the same rover/grader the pupil sees; `run_program` executes inside the
  restricted sandbox (`src/kodro/runtime/sandbox.py`).
- `import kodro` on this machine resolves to the editable install at
  `D:\project\robolearn\src` (kodro 2.1.0) unless `PYTHONPATH=<repo>\src`
  is set. Every number above was produced with `PYTHONPATH` pointed at
  this repo; bare-`pytest` results from this host must be discarded.
- Absent from this environment: Codex CLI, Vercel CLI, Ollama binary.
  Present: `gh` authenticated as `vaibhav4046` (identity only, no secret).

## Known non-defects (do not "fix")

- `qa_web`/`qa_ui` browser gates are Linux-only in CI by Windows/macOS
  headless-GL flake decision (see `ci.yml`); the local 5/5 above is bonus
  evidence, not a gate change.
- Dated records under `docs/ca1`, `docs/ca2`, `dissertation`, `.kodro/`
  disagree with today's numbers by design; they were not touched.
