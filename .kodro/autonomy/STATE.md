# Kodro autonomy STATE

Last updated by: Fable 5 lead agent
Repo: D:\project\robolearn | origin https://github.com/vaibhav4046/robolearn.git
Branch flow: work on `kodro-identity-pass`, ff `main`, push BOTH, CI-gated Pages deploy.

## Current objective
Execute the Codex master prompt: drive Kodro toward an honestly-accepted release
via the loop Measure -> Judge -> Reproduce -> Prioritise -> Patch -> Regress ->
Integrate -> Verify -> Rejudge -> Record. No audit-only stop.

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

EXACT RESUME STEPS when the user says "continue":
1. (optional sanity) cd /d/project/robolearn && git rev-parse --short HEAD  # expect c8118bb (or later)
2. Capture fresh evidence for the next round:
   node "<scratchpad>/capture_evidence.mjs"  (server on :8099 serving
   src/robolearn/assets/web; regenerate narrow_mobile at a TRUE 420px CDP
   viewport via scripts/lib/cdp-viewport.mjs so phone layout is judged honestly).
3. Run judge round 11 with the Workflow tool, scriptPath:
   C:\Users\lalwa\.claude\projects\D--project-robolearn\8de95992-bd5b-4a12-b04f-1b334c9f4674\workflows\scripts\kodro-judge-round-wf_08492b6b-dff.js
4. Parse accepted findings (brace-match the tool result, or reconstruct from the
   run's journal.jsonl + agent-*.jsonl like scratchpad/parse_journal10.js). For
   each accepted P0-P3: reproduce, root-fix, add/extend a gate (qa_honesty /
   qa_contrast / qa_ui), rebuild bundle (node scripts/build_web.cjs), run the
   full battery, commit (STAGE .css AND bundle.js explicitly - a *.jsx/*.js glob
   silently dropped styles.css in JR9 and reddened CI), push branch + ff main +
   push both, watch CI, watch Deploy Pages, verify live bundle sha256 ==
   committed. Record JRx items in BACKLOG.json + update this STATE.

CONVERGENCE COUNTER: 0 consecutive clean complete rounds. Rounds 4-10 all found
real defects; the trend is DOWN (R9=19 -> R10=4, all P2, no P0/P1). Need TWO
consecutive clean complete rounds (0 accepted, all 6 judges finishing) to
declare convergence, then deliver the final report (live URL + commit hashes +
committed/live bundle sha256 equal + full gate matrix + dissertation PDF at
EXACTLY 50 pages, 0 em/en dashes + current .kodro/autonomy/ + honest list of
anything deliberately not done). Do NOT launch round 11 until the user resumes.

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
  (was a stale OneDrive clone). Verify: python -c "import robolearn; print(robolearn.__file__)".
