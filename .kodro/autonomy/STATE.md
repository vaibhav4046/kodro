# Kodro autonomy STATE

Last updated by: Fable 5 lead agent
Repo: D:\project\robolearn | origin https://github.com/vaibhav4046/robolearn.git
Branch flow (current): work on `agent/kodro-ca2-candidate`. Nothing is
fast-forwarded to `main` and nothing is deployed during the CA2 release pass.
Branch flow (historical, up to 2026-07-16): work on `kodro-identity-pass`, ff
`main`, push BOTH, CI-gated Pages deploy. Everything below the CA2 checkpoint
describes that older flow and should be read as history.

## CA2 release-candidate checkpoint (2026-08-14)

Commit `2222e1e865105e2105cce1f1c9932736c0da87f8` on
`agent/kodro-ca2-candidate`. Working tree clean at the time of writing.

What this checkpoint is for: the CA2 assessment candidate, not a deployment.
No tag was cut, no release published, no branch merged, nothing pushed to
`main`, and the Pages site still serves the July build.

Measured, not assumed:
- The gate matrix in `EVIDENCE.json` had drifted on nine of twenty rows. The
  July snapshot is kept intact and a `superseding_measurement` section was
  added beside it rather than rewriting it in place, so that a stale row is
  visibly superseded instead of quietly replaced.
- The `wheel` row had been carried as blocked with the reason "`hatchling`
  absent, cannot be fetched offline". That reason was never tested and it is
  false: `pip download hatchling` succeeds. The offline constraint binds Kodro
  the product, not the authoring toolchain. The wheel now builds, installs into
  a clean venv and passes a 7-check smoke; see `wheel_built_and_exercised` in
  `EVIDENCE.json`.
- The biggest correction: `qa_ui_local` was recorded as "timed out after 904
  seconds ... not counted as pass". It now passes for real: 325 seconds, exit
  0, nine flows PASS, 41 of 41 behaviour or layout assertions. The degraded
  headless box described further down this file recovered.
- Second correction: the lint gate was red while the artefact claimed clean.
  7 ruff errors and 4 unformatted files, all in files added or edited during
  this release pass. Fixed at `2222e1e`; the reformat of the shipped
  `src/kodro/mcp/tools.py` was proved inert by 97 passing tests and two
  real-subprocess MCP smoke runs rather than assumed inert.
- Third correction, and the one real repository defect found in this pass:
  `docs/mkdocs.yml` declared `site_dir: ../site`, the same directory
  `build_web.cjs --static` writes the Kodro Web build to and `qa_web.mjs`
  reads. `qa_web.mjs` reads that directory without building it, so it measures
  whatever wrote there last; one `mkdocs build` in between made the product's
  own privacy gate measure the documentation site and report a false
  `api.github.com` leak. It had never fired before because the docs build had
  never been run by any gate. It could not have reached Pages: both `ci.yml`
  and `deploy-pages.yml` rebuild `site/` immediately before reading or
  uploading it, on fresh runners. The blast radius was local working copies.
  Now `site_dir: ../.docs-site`, gitignored, with the reason written at the
  setting and the docs gate ordered before the web gates in CI.
- Counts that grew since July: qa_grader 34 to 55, qa_honesty 91 to 121,
  qa_physics 20 to 25, qa_ai_web 27 to 51, qa_scenario_parity 4 to 8, mypy 66
  to 73 source files, and the Python suite 1,069 to 1,641 collected, passing at
  90.85 percent against an 85 percent gate. The skip count is not stable on this
  host and an earlier version of this bullet explained it with a cause I never
  measured. Three runs of the same 1,639 tests gave 1 skip, then 2, then 0, and
  the 1,641-test run on 17 August gave 0.
  Thirteen test files open a Tk window in a fixture that catches `tk.TclError`
  and skips rather than fails, and 169 collected tests sit behind those guards,
  so a bad run takes a whole file with it; the recorded reason is "Can't find a
  usable init.tcl". A second correction on top of the first: an earlier version
  of this bullet also named `tests/unit/test_ai_studio.py` as the sole source,
  which the source tree does not support. The cause is not established. It is not the
  fixed host defect the earlier text claimed: `tk.Tk()` succeeds on demand in
  both the base interpreter and a fresh venv, test order is deterministic (no
  `pytest-randomly`, no `xdist`), and nothing in `tests/` or `src/` touches
  `chdir`, `TCL_LIBRARY` or `TK_LIBRARY`. Treat it as an intermittent local Tk
  initialisation failure that the fixture degrades into a skip. The current
  measurement at this HEAD is `1639 passed in 214.27s`, exit 0, zero skips.
  Gates that did not exist in the July matrix: qa_voice 108, qa_secrets 42,
  qa_learning_annotations 28, qa_encoding 10, 66 MCP server unit tests, and the
  docs build, gated for the first time on 15 August at
  `mkdocs build -f docs/mkdocs.yml --strict`.

The bundle SHA-256 `8c3417345b3c...` recorded in the 2026-07-16 checkpoint
below is historical, and so is
`17c8d98582b431807fb4971b6a43743f0f3d48040380e72aea4b40035b48c174`
(1,502,665 bytes), which this paragraph called the committed bundle until
15 August. The committed bundle at `dd02cd8` is
`f17ce80efc318032b70aa07a187567619cbc3c4e7df7936ad986f51d27eb06b1`
(1,502,967 bytes). The CSS has not moved:
`ac7c9050cbd7b06e2814366ed6c6cc8d868ec10a75ecdaeb0814ba789ba45e0d`
(172,179 bytes). Since nothing on this branch is deployed, no
committed-matches-live claim can be made about either file today.

Do not read a bundle hash out of this file. It goes stale every time the bundle
is rebuilt, which happened four times during the CA2 pass. Measure it:

    python -c "import hashlib;print(hashlib.sha256(open('src/kodro/assets/web/bundle.js','rb').read()).hexdigest())"

and check the source agrees with the generated file using
`node scripts/build_web.cjs --check`, which prints "bundle.js is up to date."
and exits 0 when they match.

Host conditions that will bite the next session:
- `pytest` fails with `PermissionError: [WinError 5]` on the
  `pytest-of-<account>` temp root unless `--basetemp` is passed. Harness, not
  product. Any run of a module-scoped `tmp_path_factory` fixture hits it.
- A subset pytest run always trips the 85 percent project coverage gate. That
  is expected and is not a failure of the tests being run.
- The development install on this machine carries stale entry-point metadata:
  `kodro` resolves to `kodro.bench:main` while `pyproject.toml` declares
  `kodro.__main__:main`, so typing the product name here starts the batch
  runner. That was previously recorded as unfixable because the wheel "could
  not be rebuilt offline". It is now measured rather than predicted: a clean
  venv installed from the freshly built wheel resolves `kodro ->
  kodro.__main__:main`, so it is local install staleness and it does clear
  on a real install. `kodro-mcp -> kodro.mcp.server:main` was always
  installed as declared, in both the stale install and the clean one.
- `qa_personas` and `qa_vibe` exit 0 without a local model and produce no
  data. They are honest skips and must never be counted as passes.

## Current objective

**The heading is stale, 2026-08-15.** The loop below is still the working
method and is kept for that reason, but the brief it names is not the live one.
Since the CA2 release pass opened, the governing brief is the CA2 ultimatum and
the criteria that close it are the CA2 checkpoint above plus the open rows of
`BACKLOG.json`. A resuming agent that reads the word "Current" here and starts
executing the Codex master prompt is working to a superseded objective.

Execute the Codex master prompt: drive Kodro toward an honestly-accepted release
via the loop Measure -> Judge -> Reproduce -> Prioritise -> Patch -> Regress ->
Integrate -> Verify -> Rejudge -> Record. No audit-only stop.

## Product-direction release checkpoint (2026-07-16)
- Product commit `93fec9596fe26863d88dd4674254e775757f25ae` is on both
  `main` and `kodro-identity-pass`.
- CI run 29537982283 is green on Windows, macOS, and Ubuntu. Deploy Pages run
  29538259855 succeeded.
- `FINDINGS.jsonl` now contains 80 valid JSONL records. Earlier counts below
  are preserved as historical round checkpoints, not the current total.
- Public `bundle.js` and `styles.css` match the committed files byte-for-byte:
  bundle SHA-256 `8c3417345b3c8caf220baa15d9ddcdb62856a20e12d18d0fba2999119ed3f8fb`
  (1,103,091 bytes); CSS SHA-256
  `3ca2099a24a5f5a713a2708679179e6524bca99d8d3230014f7cff5583801611`
  (121,644 bytes).
- The primary journey is now Design -> Prove -> Build. Secondary tools are
  progressively disclosed. The hosted Build stage produces a deterministic
  prototype brief and explicitly does not claim certification, supplier
  validation, ordering, or exact physical equivalence.
- Companion has deterministic Create, Explain, and Check fallbacks. A local
  model remains optional; there is no false claim of unlimited tokens or
  offline internet research.
- `Store.close()` now closes every SQLite handle owned across worker threads;
  the regression suite covers multi-thread-local handles and idempotent close.
- Full local product suite before release: 1,069 passed, 88.96% coverage;
  ResourceWarnings reduced to zero. CI is the cross-platform release authority.
- Local headless Chrome/SwiftShader remained degraded for the exhaustive
  `qa_ui`/`qa_worlds` harness. The new desktop journey was inspected directly
  in the in-app browser; CI separately passed the real-Chrome boot, studio,
  console, and zero-external-request checks. Do not describe the timed-out
  local harness as a pass.
- Dissertation revision has not started in this checkpoint. It requires the
  Academic Research Suite human checkpoint before claims are changed.

## Verified baseline at commit c93005b (CI green 3 OSes, deployed, live == build)
- git: clean tree, origin/main == origin/kodro-identity-pass == c93005b
- bundle.js fresh (build_web.cjs --check)
- CI green on ALL 3 OSes at c93005b (ubuntu/macos/windows success); Deploy Pages
  success @c93005b; live 200 and live bundle.js sha256 == committed source bundle
  (718d8352...), i.e. the deployed site is provably this commit.
- Full local QA green at c93005b: qa_interpreter 163/0 | qa_grader 34/0 |
  qa_physics 20/0 | qa_ai_web 19/0 | qa_web 4/4 | qa_parts 40/0 | qa_memgraph 22/0 |
  qa_scenario_parity 4/0 | qa_vibe 8/8 | qa_interp_fixes 13/0 | qa_worlds 61/0 |
  qa_ai_grammar 6/0 (live Ollama) | pytest 1053/0 | ruff+format+mypy clean.
- Ollama: OLLAMA_ORIGINS persisted (User env); server 200; desktop app
  auto-starts+warms it via ollama_client.ensure_server().

## What landed at c93005b (this loop)
Parallel-session work reconciled onto main (was stranded on the branch; origin/main
had sat stale at 541941d): gravity reconciliation (terrain.py), energy-true battery
grading (app.py/bridge.js), grammar-constrained generation (ai-web.jsx/RobotLab.jsx),
cited parts DB (parts-db.js), URDF export. Plus two CI-red regressions this
introduced, found and root-fixed: K-003 (ruff format on app.py), K-004
(offline-guard vs qa_parts citation-host conflict). See BACKLOG.json.

## PHASE 0 RECONCILIATION (authoritative, 2026-07-16)
This tree, D:\project\robolearn, is AUTHORITATIVE. HEAD advanced through the
shipped judge rounds: ...c8118bb(JR10) -> 19027e3 -> 75db527(JR11) ->
9b58d89(JR12) -> [JR13+sound this batch]. All pushed to origin
(github.com/vaibhav4046/robolearn), CI-verified on 3 OSes, Deploy-Pages live,
and live bundle sha256 == committed each round. The old tag e1df641/v2.0.2 IS an
ancestor here (git rev-parse e1df641 resolves). The "other inspection saw main at
e1df641/v2.0.2, could not resolve c8118bb" was the STALE clone at
`%USERPROFILE%\OneDrive\Desktop\codex fix\robolearn` (HEAD e1df641, CLEAN tree,
no un-lost user work). Nothing to integrate from OneDrive. Ledger files created:
FINDINGS.jsonl (73 findings, 72 FIXED + 1 DISCLOSED, all 54 JR fixed),
ACCEPTANCE_MATRIX.md, DISSERTATION_TRACEABILITY.md, EVIDENCE.json.

## Active slice
CONVERGENCE IN PROGRESS. Ship history: round 7 (JR7-01/02/03) at 5c38696; round
8 fix (JR8-01, scoped underwater/space verdicts) at 1bab12e - both CI-green,
deploy-verified, live sha == committed. Round 9 then ran COMPLETE (27/27
agents) on fresh evidence from live 1bab12e and accepted 19 findings (9 P2, 10
P3; 2 rejected) - the deepest round yet, judges ran live-browser probes. All 19
root-fixed as JR9-01..JR9-14 (see BACKLOG.json; two were duplicates of the
min-content root cause, one folded into the slope fix). Headlines: .app grid
min-content clipping at phone widths; battery figures contradicting the
enforced ledger ~150x (endurance now DERIVES from the ledger, JS+Python
helpers); tilt() fabricating slope on flat worlds (now 0); slope-named sites
now scope their verdicts; browser export downloads a real report; HUD glass
AA over bright skies; Editor/console render costs; Lessons discoverability.
qa_web gained a studio-mount + console-error check after this round exposed
that a broken studio component could pass the onboarding-level boot check.

Counter status: round 9 was NOT clean, so the counter reset again. The NEXT
TWO complete judge rounds must both accept zero findings to converge.

JR9 SHIPPED: fix commit 3c98ead had a bad git-add (staged *.jsx/*.js but not
styles.css), so CI qa_contrast went red and the gated deploy correctly SKIPPED
it; styles.css committed in 58699f8, CI green on 3 OSes, Deploy Pages success,
live bundle sha256 == committed (3351e673...). Lesson: `git add` globs must
include .css. narrow_mobile evidence regenerated at a TRUE 420px CDP viewport
(the --window-size capture clamps to ~482px) so the next round judges the real
phone layout, not a clamped one.

ROUND 10 ran COMPLETE (20/20 agents) on live 58699f8 and accepted 4 findings
(all P2; 10 rejected as working-as-disclosed/preference) - the lowest count and
severity yet, no P0/P1. All 4 fixed as JR10-01..04 (see BACKLOG.json):
- JR10-01: code comments were ~1.8:1 (unreadable teaching text) -> .tok-com,
  gutter, REPL placeholder now use --fg-3 (AA-verified on --void).
- JR10-02: collect/drop-sample blocks were print-stubs on the free Studio
  surface -> marked lessonOnly, hidden unless classroom mode.
- JR10-03: Mars said "held up" while 0.006 atm/-63C unsimulated -> data-driven
  thin-atmosphere scoping (pressureLabel PRESSURE + atm + pressure<0.5).
- JR10-04: catalogue "no-load top speed" scaled with motor count (physically
  wrong) -> all drive-part speed tiers = one nominal 1.0; advantage now shows in
  Mobility/endurance only; display is honest words not a per-build multiplier.
Gates: qa_honesty 63, qa_contrast 51, qa_web 5/5, qa_ui 38/38 (6/6 flows, 12/12
modals), qa_worlds 60/61 (the 1 fail = mars-x-rover chrome-spawn ETIMEDOUT
flake, confirmed rendering clean in isolation), interpreter 180, grader 34,
physics 20, ai_web 27, parts 40, pupilstore 23, memgraph 22, scenario 4,
interp_fixes 13. All 4 fixes verified end-to-end in the real product.

>>> RESERVE POINT (user stepped away, will say "continue"). Round 10 SHIPPED +
LIVE-VERIFIED at commit c8118bb: CI success (3 OSes), Deploy Pages success, live
bundle sha256 == committed (ff50659b...), live 200. main == kodro-identity-pass
== origin == c8118bb. Tree clean. This is the durable checkpoint.

SPENT, 15 August 2026. The numbered block below was written when round 10 was
the newest ship and round 11 had not run. It has since been consumed: the
CONVERGENCE COUNTER paragraph immediately underneath records rounds 11, 12 and
13 as all shipped and live-verified. Do not execute it. It is kept because the
method it describes is the one to repeat, not because the steps are pending.
Two of its instructions cannot be followed as written even in principle:

  - step 3 names an absolute path under a Claude Code session directory. That
    file does not exist. Checked on 15 August 2026:
    `find "$USERPROFILE/.claude/projects" -name "*kodro-judge-round*"` returns
    nothing, and the session UUID in the path has no `workflows` directory at
    all. A different session UUID does, holding the convergence-audit and
    dissertation-audit workflows, but not this one. Anyone cloning the repo
    never had it: it was always machine-local and outside the tree.
  - step 2 names `<scratchpad>/capture_evidence.mjs`, a placeholder for a temp
    directory that no longer exists either.

Rebuild both from the description in `docs/HANDOFF_GPT56_COMPLETE.md` section 6
rather than looking for the files.

EXACT RESUME STEPS as they stood at round 10 (historical, do not execute):
1. (optional sanity) cd /d/project/robolearn && git rev-parse --short HEAD  # expect c8118bb (or later)
2. Capture fresh evidence for the next round:
   node "<scratchpad>/capture_evidence.mjs"  (server on :8099 serving
   src/kodro/assets/web; regenerate narrow_mobile at a TRUE 420px CDP
   viewport via scripts/lib/cdp-viewport.mjs so phone layout is judged honestly).
3. Run judge round 11 with the Workflow tool, scriptPath:
   %USERPROFILE%\.claude\projects\D--project-robolearn\<session-uuid>\workflows\scripts\kodro-judge-round-wf_08492b6b-dff.js
   (gone, see the note above)
4. Parse accepted findings (brace-match the tool result, or reconstruct from the
   run's journal.jsonl + agent-*.jsonl like scratchpad/parse_journal10.js). For
   each accepted P0-P3: reproduce, root-fix, add/extend a gate (qa_honesty /
   qa_contrast / qa_ui), rebuild bundle (node scripts/build_web.cjs), run the
   full battery, commit (STAGE .css AND bundle.js explicitly - a *.jsx/*.js glob
   silently dropped styles.css in JR9 and reddened CI), push branch + ff main +
   push both, watch CI, watch Deploy Pages, verify live bundle sha256 ==
   committed. Record JRx items in BACKLOG.json + update this STATE.

CONVERGENCE COUNTER: 0 consecutive clean rounds. Trend since resume:
R9=19 -> R10=4 -> R11=2 -> R12=2 -> R13=2 (all P2/P3, no P0/P1). Rounds 11-13
ALL SHIPPED + LIVE-VERIFIED: JR11 (battery-range consistency, teacher th scope),
JR12 (assumed-wheel top-speed honesty, WCAG label-in-name), JR13 (mobile
world-switch bar dark-glass in every theme, sim-speed aria-label regression from
JR12). Live commits: 75db527(JR11) -> 9b58d89(JR12) -> dd6cbf5(JR13+sound) ->
94298da(pip wheel fix) -> 17db315(light-theme Run button contrast).

COMPLETION-DIRECTIVE WORK DONE (2026-07-16):
- Sound OFF by default (user request); Settings toggle retained. Live.
- Phase-0 reconciliation: D: authoritative; OneDrive clone stale e1df641/clean.
- Ledgers written: FINDINGS.jsonl (75), EVIDENCE.json, ACCEPTANCE_MATRIX.md,
  DISSERTATION_TRACEABILITY.md. All acceptance criteria DELIVERED (matrix).
- pip wheel build FIXED (PKG-01: redundant hatch force-include double-add);
  robolearn-2.0.0-py3-none-any.whl builds + installs + imports with assets.
- Proactive theme-contrast audit (300 runtime measurements across 10 themes x
  {1280,375}) -> exhausted the class; only the light Run button was sub-AA
  (4.43:1), FIXED (CTR-01), qa_contrast now 61 (pins --void-on--cyan AA per theme).
- Dissertation: clean pdflatex build, EXACTLY 50 pages, 0 em/en dashes.

Gate matrix (as at 2026-07-16, NOT current; for the current figure on every
gate see docs/eval/qa_gate_runs_2026-08-14.md): qa_interpreter 180, qa_grader 34, qa_physics 20,
qa_ai_web 27, qa_web 5/5, qa_parts 40, qa_memgraph 22, qa_pupilstore 23,
qa_scenario_parity 4, qa_interp_fixes 13, qa_honesty 86, qa_contrast 61,
qa_ui 6/6+38/38+12/12, qa_worlds 61 (isolate to dodge swiftshader-under-load
blank-renders), golden-trace+urdf 11. CI green 3 OSes; live 200; bundle+css
hash-verified live.

ROUND 14 (complete) accepted 2: JR14-01 (P3, skip-link #editor-main tabindex for
WCAG 2.4.1) and JR14-02 (P2, honesty: the Design Check told catalogue builds to
"fit 4 motors for grip" but JR10-04 had made motor count a pure mass penalty in
catalogue mobility -> counterproductive advice). BOTH FIXED + SHIPPED at 9877f15:
a drive gripFactor (motors2 1.0 / motors4 1.4 / servos 0.85) now models drive
torque so more motors improve mobility, matching the advice (top speed stays
count-independent, JR10-04 intact; design-check<->tick parity kept). Verified via
the real assess: motors4 out-grips motors2 on every surface. Also PKG-01 (pip
wheel double-add) and CTR-01 (light Run button 4.43:1) fixed + shipped earlier.

>>> HEADLESS ENVIRONMENT DEGRADED OVERNIGHT (honest limitation): after hours of
headless Chrome churn the swiftshader software-GL + virtual-time pipeline is
degraded on THIS box. Symptoms: qa_ui/qa_worlds ETIMEDOUT spawn failures,
blank-renders, and the Riverside City first-run demo being broadsided at spawn
by real-time cross-traffic (the rover tick and traffic animation desync under
--virtual-time-budget; progressively worse). This is NOT a product defect and
NOT a regression: the SHIPPED/live committed build fails first-run-clean
identically, it PASSED earlier this session, gripFactor cannot change city speed
(mob>warnBand->mul 1), and the LIVE site loads + runs in a real browser. CI is
authoritative for shipping and is GREEN (CI does not run qa_ui/qa_worlds).
checkFirstRunClean was made retry-tolerant (4 attempts, accepts a driven+reported
run) but the degraded box still halts at 0m. RESUME on a fresh box / after a
Chrome+machine restart: kill headless chrome, restart, and qa_ui/qa_worlds +
evidence capture recover; then continue the judge loop.

CONVERGENCE COUNTER still 0 (round 14 had a material P2). Judge findings have
thinned to ~2/round, all P2/P3, no P0/P1; the theme-contrast class is
proactively exhausted (300-measurement audit clean). NEED two consecutive clean
complete rounds. When the loop produces findings, refute any that rest on a
headless artifact (city collision / blank render) and fix only source-grounded
real defects. Deliver the final report at convergence (or at a user-set cutoff).

**Superseded, 2026-08-15. Do not quote the numbers below as current.** All
fourteen were re-checked. Seven have moved, because the gates gained checks:
qa_honesty 63 to 121, qa_contrast 51 to 61, qa_grader 34 to 55, qa_ui 38/38 to
66 (6 flows, 47 behaviour or layout, 13 modals), qa_scenario_parity 4 to 8,
qa_physics 20 to 25, qa_ai_web 27 to 51. Seven are unchanged and still hold:
qa_interpreter 180, qa_worlds 61, qa_pupilstore 23, qa_web 5/5, qa_parts 40,
qa_memgraph 22, qa_interp_fixes 13. Seven and seven accounts for the whole list,
so there is no residue of gates that were left unmeasured.

An earlier version of this paragraph said five had moved, four held and "the
rest were not re-run in the CA2 pass and are neither confirmed nor refuted".
That undercounted. It left qa_physics and qa_ai_web labelled unrefuted when both
were known to have moved, in a file whose purpose is to instruct the next agent,
which is the worst place to understate what is known.

Provenance, because a tally is only as good as the run behind it. Every figure
above was measured on 15 August 2026; none is inherited from an earlier record.
qa_physics 25, qa_ai_web 51, qa_parts 40, qa_memgraph 22, qa_interp_fixes 13 and
qa_contrast 61 (0 failed, over 10 themes) were re-run live at commit `ca91ae6`,
all rc=0. qa_honesty 121, qa_interpreter 180, qa_web 5/5, qa_grader 55,
qa_scenario_parity 8 and qa_ui 66 were run earlier in the same session.
qa_worlds 61 was
re-run under `--strict` on 15 August and is measured, not inherited, but it took
two attempts. The first returned 60 passed 1 failed on `underwater x home` with
`chrome spawn failed: spawnSync ... ETIMEDOUT`, while five other Node gates and
a Chrome sweep were running concurrently on the same box. That is the
load-related harness flake `docs/GPT_HANDOFF.md:34` warns about, on the line
beginning "Known traps to write into the prompt verbatim" ("qa_ui/qa_worlds can
flake with chrome spawn timeouts under heavy load"). Re-run alone on an idle
machine it printed `WORLD SWEEP RESULT: 61 passed, 0 failed` with `GATE_RC=0`.
No threshold was changed and no case was removed to get there; the load was.
Note also that the first run's *task* exit code was 0 while the gate itself
printed `worlds strict EXIT=1`, so read the printed RESULT line, never the
wrapper's status.

The authoritative record of what was run on what day is
`docs/eval/qa_gate_runs_2026-08-14.md`, which carries all fourteen of the
figures above verbatim in its result column, and they were checked against it
on 15 August: all fourteen agree.

`docs/eval/test_suite.json` is a different thing and does not cover these gates
at all. Its `harness` field says `pytest` and it holds one run of the Python
suite: 1641 passed, 0 skipped, 90.85 per cent coverage at commit `e70b98b`. None
of the fourteen Node gates appear in it. An earlier version of this paragraph
called it "the machine-emitted totals" while standing in a paragraph about the
Node gates, which invites the next reader to go looking there for a number that
was never in the file. The pointer was true about the file and wrong about the
scope, which is the harder kind to spot.

Earlier counts are kept below as historical round checkpoints, the same
convention used further up this file.

Gate counts at this checkpoint: qa_honesty 63, qa_contrast 51, qa_web 5/5,
qa_ui 38/38, qa_worlds 61, qa_interpreter 180, qa_grader 34, qa_physics 20,
qa_ai_web 27, qa_parts 40, qa_pupilstore 23, qa_memgraph 22, qa_scenario_parity
4, qa_interp_fixes 13. Dissertation last built at exactly 50pp/0 dashes (JR9);
re-verify at convergence (no tex change was needed for JR10).

Gates green for the JR9 fix round (before ship): qa_interpreter 180, qa_grader
34, qa_physics 20, qa_ai_web 27, qa_parts 40, qa_memgraph 22, qa_pupilstore 23,
qa_scenario_parity 4, qa_interp_fixes 13, qa_honesty 53, qa_contrast 49,
qa_web 5/5 (new studio-mount), ruff+format+mypy clean on the touched Python.
qa_ui (now +3 phone layout gates) + qa_worlds running at time of writing; ship
after they pass. Dissertation 50pp, 0 dashes (no tex change needed this round;
the JR9 fixes only strengthen claims the tex already makes). Watch items
unchanged: chrome-spawn ETIMEDOUT flakes under load (isolate to confirm);
local pytest tkinter env issue (CI authoritative); ECONNRESET can kill judge
agents (incomplete round never counts).

## Exact next command on resume
    cd /d/project/robolearn && node scripts/qa_interpreter.mjs | tail -1   # confirm green
then read .kodro/autonomy/BACKLOG.json, take the top OPEN P0/P1 with a failing
acceptance test, fix root cause, add regression, rerun its gate, ff+push.

## Worktree warnings
- After ANY .jsx/.js web edit: `node scripts/build_web.cjs` then commit bundle.js
  (CI freshness gate fails otherwise).
- cap.html is GENERATED by scripts/build_screenshot_harness.cjs (gitignored) -
  edit the generator, never cap.html.
- The `robolearn` editable install .pth must point at D:\project\robolearn\src
  (was a stale OneDrive clone). Verify: python -c "import kodro; print(kodro.__file__)".
