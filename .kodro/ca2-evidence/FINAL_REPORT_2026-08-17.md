# CA2 release candidate: final report

Measured at commit `518b0dd` on 17 August 2026. Every figure below is pinned to
that commit. If the tree moves, this file is a historical record and must not be
edited to match a later state. Re-measure and write a new file instead.

## Candidate

- Branch `agent/kodro-ca2-candidate`, HEAD `518b0dd`.
- 51 commits ahead of `main` (`02dd047`). 192 files changed, 26533 insertions,
  9599 deletions.
- Working tree clean. Nothing pushed. `origin` is untouched by this work.
- Commit author throughout: `Vaibhav Lalwani
  <115102797+vaibhav4046@users.noreply.github.com>`. No co-author trailer on any
  commit.
- Three git stashes and `docs/dissertation/_build/` (107 tracked files) were
  never touched. `dist/` still holds the owner's built executables.

## What changed, by area

**Product.** The `kodro` desktop entry point launches the app rather than the
batch runner. Desktop mission bar and the dictation notice no longer name the
prototype or a recipient the code cannot know. `src/robolearn/web/app.py` grades
submitted attempts against `success_criteria` and its docstring now says so.
Project storage round trips between desktop and web. A secret-scan gate exists
and the tracked account-name leak it found was removed.

**MCP.** A local stdio server shipped from scratch: `kodro-mcp` console entry
point with `python -m` fallback, protocol on stdout and logs on stderr, strict
schemas, bounded runs, no shell execution, no unrestricted file access. Eight
tools and 25 resources (24 lessons plus one API reference), all
`application/json`, generated from the authoritative YAML at verification time
rather than hardcoded. `docs/mcp.md`, `.codex/config.toml.example` using
`[mcp_servers.kodro]`, `.mcp.json.example`, and two smoke wrappers
(`scripts/smoke_mcp.ps1`, `scripts/smoke_mcp.sh`).

**Voice.** Typed intent and schema boundary, never DOM automation. The same
transcript parses identically spoken or typed. Wake-word recognition fixed to
match what a real recogniser returns. Spoken and typed barge-in added.
Double-encoded text repaired and gated. Local STT benchmarked rather than
claimed: see the figures below.

**UI.** Behaviour, layout, modal, contrast and world suites all gate in CI.
Software-renderer performance re-pinned to the bundle actually shipped rather
than to a hardware run from July.

**Lessons.** 24 YAML lessons at `src/robolearn/lessons/library/`, split KS1 3 /
KS2 4 / KS3 9 / KS4 8, of which exactly 7 declare `reading_age`. The exported
`lessons.json` is byte-identical to a fresh regeneration, so the generated
bundle matches its source.

**Dissertation.** Integrity audit at
`docs/dissertation/CA2_INTEGRITY_AUDIT_2026-08-14.md`. Bibliography 26 entries,
all checked 15 August 2026. The AI-assistance disclosure is present and
unaltered at `Kodro_Dissertation.tex:152`. A false bundle-hash claim in the text
was corrected. The `.tex` is self-contained: 0 `\input{`, 0 `\include{`, 0
`\subfile{`.

**Media.** All eight mandated CA2 documents exist in `docs/ca2/`, plus
`DESIGN.md`. The HyperFrames intro is rendered and deterministic.

**Cross-cutting.** Thirty-one sweep passes over the documentation looking for
one defect class: an artefact asserting a state nobody re-measured. Passes 19
through 29 each found and fixed real defects. Passes 30 and 31 closed two
genuine blind spots, Markdown link targets and the contents of fenced code
blocks, and both came back clean, which is the two consecutive dry passes the
stopping rule requires.

## Verification, with the commands and what they returned

Run at `518b0dd` in this session:

```
python -m pytest -q --basetemp=.kodro/ca2-evidence/tmp-pytest-518b0dd
  1639 passed in 231.74s
  TOTAL 7062 statements, 520 missing, 1732 branches, 205 partial, 91%
  Required test coverage of 85% reached. Total coverage: 90.85%
  rc=0

node scripts/qa_secrets.mjs
  PASS secrets: 42 passed (482 of 789 tracked files read, 13 credential
  rules, bare-name rule live)
  rc=0

node scripts/qa_encoding.mjs
  10 passed (413 files, 100 protected characters)
  rc=0

node scripts/build_web.cjs --check
  bundle.js is up to date.
  rc=0

bash ./scripts/smoke_mcp.sh
  33 lines, 28 PASS, 0 FAIL
  == MCP SMOKE: 2 of 2 entry points clean ==
  rc=0

python scripts/qa_citations.py
  170 citations across 108 documents, 0 unresolvable, 0 needing review,
  44 waived (2 by line, 1 by file), 114 backticked :N not a citation
  rc=0
```

The full-suite figures moved against the previously recorded run and the deltas
are stated rather than smoothed: 1638 passed plus 1 skipped became 1639 passed;
missing 516 became 520; partial 206 became 205; coverage 90.90 per cent became
90.85 per cent; wall clock 131.71s became 231.74s. The skip count is known to be
unstable on this host and the wall clock is not a controlled measurement.

Measured 15 August 2026 and not re-run today, because none of the code they
cover changed between then and `518b0dd`:

```
qa_honesty 121, qa_contrast 61 over 10 themes, qa_grader 55,
qa_ui 66 (6 flows, 47 behaviour or layout, 13 modals, against bundle b23f6974),
qa_scenario_parity 8, qa_physics 25, qa_ai_web 51, qa_interpreter 180,
qa_worlds 61 (isolated, rc=0), qa_pupilstore 23, qa_web 5 of 5 including
privacy-zero-external, qa_parts 40, qa_memgraph 22, qa_interp_fixes 13,
qa_voice 108, MCP unit tests 66 (only with an explicit --basetemp)
```

Artefact identity at this commit: `bundle.js` 1,502,969 bytes, 36577 lines,
sha256 `b23f697456e1d7c13f2df96cff2e27d1143236768129c26b711507f57bfbb316`.
`lessons.json` regenerates to 22255 bytes, sha256
`f1167f289ac75c1efa4710eb0b695c15db0c6cbfb6fc8e3a99dbf083468f736e`, identical to
the committed file. Wheel `robolearn-2.0.0-py3-none-any.whl` 4,705,551 bytes,
sha256 `7ad56c8f...`, 200 members, 24 lesson YAMLs, 7 of 7 smoke checks, MCP
handshake 6 of 6. Dissertation PDF 1,115,334 bytes, sha256
`1d717df82e80f2bcd6d9e06f637005e07651a45a7741d0293711d737e5e28589`, from a
193,364-byte source.

Live MCP, run as a real subprocess: serverInfo name `kodro`, version `2.0.0`, 8
tools, 25 resources. Grading lesson `00d_fix_the_turn` through the server
returned `passed: False, score: 40` on the starter program and `passed: True,
score: 100` on the fixed one, which is the failure-then-refinement beat the
demonstration needs.

Local speech-to-text, benchmarked not claimed: model
`Systran/faster-whisper-base.en`, model load 1.587s, median 0.885s, worst
1.339s, peak RAM 367.5 MB, median real-time factor 0.371, mean WER 0.25, over 10
synthesised clips. GPU was unavailable on this machine: `RuntimeError: Library
cublas64_12.dll is not found or cannot be loaded`. Those are CPU figures and
must be presented as CPU figures.

## Demonstration rehearsal, and what capture assets actually exist

The rehearsal evidence in hand is the two MCP smoke wrappers and the live
handshake and grading call above. That covers flow three of the three
assessment flows.

One rendered capture asset exists:

```
docs/ca2/intro/renders/kodro-intro.mp4
  774,768 bytes, h264, 1920x1080, 30fps, 360 frames, 12.000000s
  sha256 dd12a3b4...
```

There are no screen recordings of the desktop or web application. No flow has
been filmed. `docs/ca2/CAPTURE_MANIFEST.md` and `docs/ca2/SCRIPT.md` describe
what to capture; they are a plan, not a record.

`SCRIPT.md` is a 9:40 master of 953 words across 79 quoted lines, with four
`[EXPAND-n]` blocks of 514 words across 45 quoted lines that take it to 14:30.
Which version is correct depends on a duration nobody has confirmed.

## Limitations, stated plainly

- KODRO is an offline-first learning and early-design test studio with disclosed
  fidelity boundaries. It is not a replacement for Gazebo, Webots or Isaac Sim,
  and it is not a physical validation rig. No physical robot was ever tested.
- No human participants were used. There is no user study, no teacher trial and
  no classroom result. The persona-task evaluation scored 40 of 40 in one seeded
  synthetic run, which is a synthetic result and nothing more.
- `qa_personas` and `qa_vibe` exit 0 without Ollama installed but produce no
  data in that state. Their exit codes are not passes and are not counted.
- The renderer figures that hold today are software medians 25.7 Low and 24.4
  High. The hardware figures of 144.5 and 128.2 from 27 July must never be
  presented as current.
- Manual desktop visual inspection has not happened. It cannot be done from
  here.
- The six leaked compile logs are still in the public history. They are present
  untracked on disk at
  `docs/dissertation/{compile1,compile2,doi_compile1,doi_compile2,final_compile1,final_compile2}.txt`.
- The installed `kodro.exe` on this machine still embeds `from robolearn.bench
  import main`. The repository is fixed; the installed artefact is stale until
  reinstalled.
- The pytest base temp directory on this host has an ACL that denies even its
  owner, so MCP unit tests require an explicit `--basetemp`. That is a host
  defect, not a product defect, and repairing it needs elevation.

## Open questions only the student can answer

None of these can be resolved from inside the repository, and each one can
invalidate an otherwise finished submission.

1. The exact video duration, from the current 2026 Canvas brief. The 2023 page
   says 10 minutes twice and 15 once.
2. Whether a PDF slide deck and a roughly five-page PDF report are also
   required, and whether submission is a single ZIP. Neither artefact exists.
3. Which page count the brief means. Measured: 59 sheets total, 2 unnumbered, 7
   roman, exactly 50 arabic; References printed on 47 to 48; body through
   References is 48 printed pages; excluding references, 46.
4. The submission route. The 2023 page names the Coursework Submission System,
   not Canvas, and warns that a non-ZIP container risks the work not being
   marked at all.
5. Whether to reinstall so `kodro` launches the app, or to film `python -m
   robolearn` instead. This must be settled before capture freeze.

## The next irreversible decision

Pushing `agent/kodro-ca2-candidate` to `origin`. Fifty-one commits, currently
local only. Nothing else in this candidate is irreversible, and nothing beyond
that point should happen without an instruction naming the exact action and its
target. Merging PR 3, tagging, publishing a release, rewriting public history
and submitting anything remain owner actions.
