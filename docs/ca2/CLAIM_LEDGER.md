# Claim ledger

Every factual claim the CA2 video is allowed to make, with the artefact that
supports it and the exact command that produced the artefact. If a sentence is
not in this table, it does not get said on camera.

The second half of this file is the list of things that must not be said. That
half matters more. A demonstration loses more marks for one unsupported claim
than it gains from three extra features.

Measured on 14 August 2026 unless a date is given. The Python suite artefact was
re-run on 17 August at commit `e70b98b`, working tree clean, and the Testing
section below carries that run; it stood at `aa174cf` until then. The Node
gates, the lint and type gates and both MCP smoke scripts re-run at `2222e1e`.

**Re-run the gate rows on the recording day rather than reading them off this
page.** Two rows in the quality-gates table went stale between 14 and 15 August
without anyone noticing: the encoding row named a file count that has since
moved, and the secrets row quoted an output line from before the bare-name rule
was added, so it read `27 passed (477 of 779 ...)` against an actual
`42 passed (480 of 787 ..., bare-name rule live)`. Both were corrected on 15
August by re-running the gates, and the encoding row no longer carries a file
count in the claim column, because a count stated as a claim goes stale silently
while a count quoted as output at least declares what produced it.

Then the secrets row went stale a second time, later on the same day, which is
the best argument on this page for the instruction above. It read
`42 passed (478 of 785 ...)` at that point, two fewer of each. The cause is not a
change to the gate and not a new finding: commit `2836f85` untracked
`docs/dissertation/Kodro_Dissertation.lof` and `.lot`, the generated list-of-figures
and list-of-tables files, which `.gitignore:96` does not name among the build files
that stay tracked. The tracked set fell from 787 to 785 and the read set from 480
to 478 with it. Any commit that adds or removes a tracked file moves this number.
It is a denominator, not a result, and the pass count of 42 is the part that
carries the claim.

It then moved a third time, which is the point at which chasing it stops being
useful. Commit `ca82788` added one tracked file,
`.kodro/ca2-evidence/2026-08-15-suite-reproduction-and-tempdir-defect.md`, and
the gate reads Markdown, so both halves went up by one: `479 of 786`, measured on
15 August 2026. That is what the row below now quotes. Nothing about the gate or
its findings changed on any of the three occasions. Treat the parenthetical as
the gate reporting its own scope rather than as a figure this page is asserting,
and treat `42 passed, 0 failed` as the row's actual claim. Every prose sentence
about this count on this page is deliberately past tense and dated for that
reason: the row is meant to be re-run, not read.

The
re-measured values on 15 August: honesty 121, interpreter 180, voice 108,
learning annotations 28, grader 55, MCP unit 66, web lesson parity 52, MCP smoke
2 of 2 entry points with 8 tools and 25 resources. Every one of those matched
its row.

## Claims with evidence

### Testing

| Claim | Evidence | Command |
|---|---|---|
| At commit `e70b98b`, 1,641 Python tests collect, all 1,641 pass, none skip | `docs/eval/test_suite.json` | `git checkout e70b98b`, then `python -m pytest --cov-report=json --junitxml=...` |
| At that commit, 90.85 percent branch-aware coverage against an 85 percent gate | same | same |
| At the release commit `66e8632`, 1,642 collect, 1,641 pass, 1 skips, 90.78 percent | `.kodro/ca2-evidence/2026-08-18-release-run-and-artefact-divergence.md` | the same pytest command, run at HEAD |
| The extra collected test is one added test, not padding | `tests/unit/test_splash_and_main.py::test_splash_shows_package_version` | `git diff e70b98b..HEAD -- tests/` |
| Neither a run with a skip nor a run without one says anything about the Tk intermittency | `source.provenanceNote` in the artefact, and the skip section of the 18 August log | same |
| The counts are reproducible from a clean checkout | `source.workingTreeClean: true`, recorded at `e70b98b` and captured again at `66e8632` | `git status --porcelain` before the run |
| The counts and coverage are machine-read, not transcribed | `scripts/gen_test_suite_json.py` reads the run's JUnit XML and coverage JSON | `python scripts/gen_test_suite_json.py --check ...` |

Updated 17 August, and the change of subject matters more than the change of
number. Until now this section told you how to talk about a skip. There is no
skip in the current run, so it now tells you how to talk about its absence,
which is the harder job: a clean run invites the claim that the problem went
away, and that claim is not supported.

The skip count is not stable on this host. Four full runs have been taken. Three
of the same 1,639 tests gave 1, then 2, then 0, and the current 1,641-test run
gave 0. Thirteen test files open a Tk window in a fixture that catches
`tk.TclError` and skips instead of failing, and 169 collected tests sit behind
those guards, so a bad run takes a whole file with it and a good one proves only
that the toolkit started that time. The recorded reason, when it does fire, is
"Can't find a usable init.tcl". Why it is intermittent is not established:
`tk.Tk()` succeeds on demand in both the base interpreter and a fresh venv, test
order is deterministic, and nothing in the repository touches `chdir`,
`TCL_LIBRARY` or `TK_LIBRARY`. The defensible sentence is that a fixture
degrades a local Tk startup failure into a skip so a desktop-UI dependency
cannot mask a product regression. Do not offer a cause on camera. If asked why
it is intermittent, the honest answer is that it has not been root-caused.

`skipDetail` is an empty array in the current artefact, so there is nothing to
read out of it. Do not describe that as the earlier problem being fixed. The
earlier problem was that the block paired a test name with a reason string
belonging to a different file, carried across by hand at a regeneration instead
of being re-read from the run. That pair was never reconciled. It is gone
because this run produced no skip to describe, and the artefact's
`provenanceNote` says exactly that rather than letting the empty array imply a
repair. What did change is that the field can no longer be hand-edited into
existence: `scripts/gen_test_suite_json.py` writes it straight from the run's
JUnit XML, so if a later run skips again, the name and the reason both come from
that run.

The coverage figure is a conservative floor, not a ceiling. `tests/conftest.py`
drops the coverage contribution of node-subprocess tests on this exact host
combination while still running them. That disclosure is in the artefact and
should be said out loud if coverage comes up in the Q&A.

Updated 18 August, and this time the table gained a row rather than changing
one. The release commit `66e8632` bumps the package to 2.1.0 and, in doing so,
becomes the first commit since the artefact was generated to touch Python
source: `src/robolearn/ui/splash.py` stopped carrying a hardcoded `v2.0.0` and
now reads the version from package metadata, with one regression test pinning
that. `FINAL_CHECKLIST.md` says to regenerate the artefact when that happens.
It has not been regenerated, deliberately, and the reasoning is in
`.kodro/ca2-evidence/2026-08-18-release-run-and-artefact-divergence.md`. The
short version is that every site quoting the artefact names commit `e70b98b`,
every claim about `e70b98b` is still true and still reproducible, and
regenerating would move five figures inside the dissertation and force a rebuild
of a sixty-page PDF in order to replace true statements with different true
statements.

What that costs is a second pair of numbers to keep straight, which is why they
are separate rows above rather than one row with a caveat. Say the pinned pair
when the artefact is on screen. Say the release pair if asked what the shipped
commit does. The difference between them is one added test and one skip, and
both are accounted for. The one thing that must not be said is the old row as it
stood until today, "1,641 collect, all 1,641 pass, none skip" with a bare
`pytest` as its command, because at the release commit that command returns
1,642, 1,641 and one skip, and a claim that fails its own verification command
is worse than no claim.

The skip in the release run is the same host intermittency described above, and
it was checked rather than assumed: the test passes three times out of three in
isolation and only skips inside a full-process run. That is one more data point
for "not root-caused", not a new fact. The count of full runs on this host is
now five: 1 skip, then 2, then 0, then 0, then 1.

### Lessons

| Claim | Evidence | Command |
|---|---|---|
| 24 lessons ship, 3 at KS1, 4 at KS2, 9 at KS3, 8 at KS4 | the lesson library YAML | `python scripts/export_lessons.py` |
| The exported lesson JSON matches the authoritative library byte for byte | SHA-256 `f1167f28...` matched on regeneration | `python scripts/export_lessons.py` twice, hashes compared |
| Web and desktop grade the same lesson identically | `RESULT: 55 passed, 0 failed`; the JS grader's lesson table is re-extracted from every YAML and the reason strings are matched against `grader.py` | `node scripts/qa_grader.mjs` |
| Every lesson's starter runs name-error-free in both runtimes, and every lesson is reachable by voice | 52 passed | `python -m pytest tests/unit/test_web_lesson_parity.py` |
| A failed check costs 20 points | `SCORE_PENALTY_PER_FAILURE = 20` in the grader | source |

### MCP

| Claim | Evidence | Command |
|---|---|---|
| The server is `kodro` version 2.1.0 | initialize response | `python scripts/smoke_mcp.py` |
| It exposes 8 tools and 25 resources | tools/list and resources/list, counted at run time | same |
| Both entry points work: the console script and `python -m robolearn.mcp` | 2 of 2 entry points clean | same |
| Bad input is refused, not silently defaulted | four negative cases pass: bad lesson id, unknown tool, misspelled argument, bad URI | same |
| A malformed frame returns `-32700` and the session survives | that check passes | same |
| Non-ASCII round trips byte-exact | `café-90°-naïve-✓` check passes | same |
| 68 unit tests cover the server | 68 passed in 18.74s | `python -m pytest tests/unit/test_mcp_server.py` |
| A program the sandbox refuses scores 0 over MCP, not partial credit | live session: `grade_program` on `00d_fix_the_turn` with `import os` returned `isError=False` (a graded outcome, not a protocol error), `execution.success=False`, `errorKind=sandbox`, `errorLine=1`, and `verdict.score=0` with the error string as its single reason | `kodro-mcp` driven over stdin, 17 August; regression tests in `tests/unit/test_mcp_server.py` |
| The zero is for a crash, not for any failure | same lesson, empty program: it runs cleanly, so it is still marked on its criteria and returns 60 with two reasons | same |
| Reading a lesson resource returns `application/json` generated from the lesson YAML | live session: `resources/read kodro://lessons/00d_fix_the_turn` returned `application/json`, 2312 bytes, keys including `allowedConstructs`, `concepts`, `curriculumRefs`, `glossary` | `python -m robolearn.mcp.server` driven over stdin, 15 August |
| `prove_contracts` refuses `runs: 0` rather than defaulting it | live session returned `isError=True`, `'runs' must be at least 1.` The handler comment at `tools.py:367` records why: `params.get("runs") or DEFAULT` would make an explicit 0 silently become 5 | same session |
| `prove_contracts` refuses a non-numeric `runs` by type | live session returned `isError=True`, `'runs' must be a whole number, got a string.` | same session |
| The **zero** refusal is in the handler, not the schema | `tools.py:379`, `if runs < 1`. No `inputSchema` in the server declares a `minimum` or a `maximum`; `runs` is declared as `{"type": "integer"}` and nothing more | source |
| The **type** refusal is the other way round: it comes from the schema | `_validate_params` at `tools.py:654` checks the declared `integer` against `_JSON_TYPES` and phrases the received type through `_type_name` at `tools.py:637`, which is where the words `a string` come from. The handler's own type guard at `tools.py:378` would have said `got 'five'.` and never fires for this input, because validation runs first | source, 17 August |
| The Windows and Unix smoke scripts both pass 14 checks per entry point | `== MCP SMOKE: 2 of 2 entry points clean ==`, exit 0 on both, no `--entry` restriction | `.\scripts\smoke_mcp.ps1`, `bash scripts/smoke_mcp.sh` |
| The `kodro-mcp` console script is installed exactly as `pyproject.toml` declares it | `kodro-mcp -> robolearn.mcp.server:main` in the installed entry points, and the smoke run drives it | `python -c "from importlib.metadata import entry_points; ..."` then the smoke scripts above |

One distinction the video must keep. What has been verified is a **real
subprocess JSON-RPC handshake against the server**, driven by the smoke
harness. That is stronger than a mock and weaker than a named client. Say "it
survives a real client handshake" only if a named client is actually shown doing
it on camera in the take that ships. Otherwise say "a real stdio JSON-RPC
session", which is what the evidence supports.

The finale is written for a named client, so that sentence is now a condition
the take has to meet rather than a warning about wording. If Claude Code is on
screen launching the server and printing its own tool-call lines, "a real client"
is accurate. If the fallback runs instead, the narration changes with it;
`SCRIPT.md` and `CAPTURE_MANIFEST.md` both carry the substitute line.

**The last six rows moved here on 17 August.** They were under "The expansion
blocks" below, because they were EXPAND-3, which only ran if the 15 minute cap
was confirmed. The MCP block is now the finale of the master cut and carries
them, so they are claims the video makes every time it is played rather than
claims it might make. The evidence did not change; only which cut speaks it did.
The 0-for-a-crash rows are new: they are a defect found and fixed on 17 August,
not a re-labelled old row.

### Voice

| Claim | Evidence | Command |
|---|---|---|
| The voice layer has 108 passing checks | `PASS voice: 108 passed, 0 failed` | `node scripts/qa_voice.mjs` |
| Speech and typing go through the same intent parser | that gate covers it | same |
| Local speech-to-text loads in 1.587 s | `docs/eval/stt_bench.md` and `.json`, 10 clips | the bench script in that document |
| The 10 clips are synthesised, 5 commands through 2 Windows voices | `docs/eval/stt_clips/`, filenames name the voice | `python scripts/bench_stt.py --synthesize` |
| Median latency 0.885 s, median real-time factor 0.371 | same | same |
| Worst-case latency 1.339 s | `worst_latency_seconds` in the same artefact. Quote it whenever the median is quoted: the median alone reads as a cap and it is not one | same |
| Peak RAM 367.5 MB | same | same |
| Aggregate word error rate 0.25 across the clip set | same | same |
| GPU acceleration was unavailable on this machine | recorded verbatim: `RuntimeError: Library cublas64_12.dll is not found or cannot be loaded` | same |

The word error rate is 0.25 on ten clips. That is a small sample and it is a
quarter of words wrong. Present it as "usable for a fixed command vocabulary,
not as dictation", which is what the number actually says.

Say "synthesised speech" out loud when the benchmark comes up. The clips come
out of the Windows speech engine, not out of a microphone: no room noise, no
accent, no hesitation, no clipping. That makes 0.25 a floor on error rather than
a field measurement, and it makes the latency and real-time factor optimistic
for the same reason. Presenting these as what a pupil in a classroom would get
would be the one unsupported claim in an otherwise clean voice section.

### Other gates

| Claim | Evidence | Command |
|---|---|---|
| The honesty gate passes 122 checks | `PASS  honesty: 122 passed, 0 failed`, 18 August. It read 121 on 15 August, which is what the dated prose earlier on this page records; the count rises as claims are added to the gate, so re-run the command rather than reading the number off this page | `node scripts/qa_honesty.mjs` |
| The interpreter gate passes 180 checks | `180 passed, 0 failed` | `node scripts/qa_interpreter.mjs` |
| Encoding is clean across the files the gate reads | `10 passed (411 files, 100 protected characters)` | `node scripts/qa_encoding.mjs` |
| No tracked file carries a credential, a key file or a local account name | `PASS  secrets: 42 passed (479 of 786 tracked files read, 13 credential rules, bare-name rule live)`, 15 August. The two counts are the gate's scope and move with the tracked set; `42 passed, 0 failed` is the claim | `node scripts/qa_secrets.mjs` |
| Learning annotations pass 28 checks | 28 passed | `node scripts/qa_learning_annotations.mjs` |
| Software rasterisation is the disclosed floor and misses the 240 Hz work budget | medians 18.1 low quality, 13.9 high, three samples per tier, 17 August, on the shipped bundle. Do not say "mid twenties" on camera: this host has read 34.4, 22.2, 25.7, 16.4 and 18.1 at Low for the same scene across five runs, so the only safe spoken claim is that software rasterisation misses the budget and is the disclosed no-GPU floor | `node scripts/qa_performance.mjs --gl=software --repeat=3`, verdict MEASURED |

| The streamed city scenery is proven scenery by 43 checks | `CITY STREAM QA: 43 passed, 0 failed`. The gate asserts the streamed chunks never reach `terrain.obstacles`, never reach `KodroAgents`, rebuild byte-identically when the pupil drives back, and free their pooled geometry exactly once at teardown | `node scripts/qa_city_stream.mjs` |

### The failure-and-refine story

Lesson `00d_fix_the_turn` grades `✗ Not yet · 40/100`, one word changes from
`turn_right(90)` to `turn_left(90)`, it regrades `✓ Complete · 100/100`. This is
a real lesson in the shipped library and both verdicts were driven through the
running server on 15 August rather than recalled. The failing run returns three
reasons: the call order is not `move_forward`, `turn_left`, `move_forward`; it
travelled 2.0 m against a 3.0 m minimum; and it recorded one collision. It is
the strongest thing in the demonstration because it shows the loop rather than
describing it.

This entry said `80/100` until 15 August, and so did `SCRIPT.md` and
`STORYBOARD.md`. It was never measured. The lesson YAML carries three success
criteria, the starter fails all three, and `SCORE_PENALTY_PER_FAILURE` is 20,
so 40 is the only score it can produce; 80 would mean one failed check. The
same three criteria and the same penalty constant are in the JavaScript grader,
so the web verdict panel reads 40 as well. Do not say eighty on camera.

### The expansion blocks

These blocks only run if the 15 minute cap is confirmed. Until 15 August they
had no narration, so they had no rows here either, and the header of `SCRIPT.md`
was offering a 14:30 cut whose extra 290 seconds nobody had written a word for.
Writing them cost three of them a claim: see the cut claims under the table.

There were four blocks and there are three since 17 August. EXPAND-3 was all
MCP, and when the MCP block moved to the end of the video it grew by 15 seconds
and absorbed both of EXPAND-3's beats. Its four rows moved up to the MCP section
unchanged. Nothing was cut and nothing was re-measured; a claim that used to be
conditional on a cap is now unconditional, which is the direction that helps.

| Claim | Evidence | Command |
|---|---|---|
| One registry decides which commands a build may use | `window.KodroCommands` in `RobotLab.jsx`, compiled to `bundle.js:15218`; `check()` gates on whether the part is fitted and `availability()` feeds the palette, the cards and the assistant grounding from the same table | source |
| With no ultrasonic fitted, `distance()` is refused with a readable reason | `bundle.js:15235` builds "This robot has no Ultrasonic range, so distance() is not available. Fit an Ultrasonic range in the Robot Lab to use it." The label is `SENSORS.ultrasonic.name`, `bundle.js:14762`; read the panel on the day rather than quoting this row, since the label is data | source |
| The assistant refuses to generate obstacle avoidance without a distance sensor | `app.jsx:1548` refuses the request rather than emitting code for a missing part | source |
| A payload requirement comes back unresolved, not answered | `RobotLab.jsx:936`: "Payload capacity is not modelled, so Kodro cannot claim this constraint." Runtime and battery requirements carry the same `unresolved` status with their own reasons | source |
| The build exports as a `.krs` file and MCP validates that same file | `validate_robot_spec` "Validate a robot exported from the Robot Lab (.krs JSON) and report the mass, wheel count and degrees of freedom the simulator derives from it" | `tools.py:552` |
| The web teacher dashboard is a concept-strength heatmap, one column per concept, every cell carrying its own score and colour | `panels.jsx:369-407` is the `<table className="heatmap-table">`: a `<th>` per concept at `:373`, the percentage printed at `:400`, the hue computed at `:384` and applied as the cell background at `:399`. Reachable at `app.jsx:2582` via More tools, Teacher progress, which forces classroom mode on the way in | source |
| The web dashboard exports two CSVs | `panels.jsx:337` gates both buttons on browser mode and `window.KodroMarkbook`: `kodro-markbook.csv` at `:346` and `kodro-concept-strengths.csv` at `:356`. The desktop register exports from Python's SQLite instead, `panels.jsx:330-336` | source |
| The per-pupil drill-down is in the legacy Tk dashboard only, not in the web app | `teacher_dashboard.py:183-190` builds the pupil listbox and its `<<ListboxSelect>>` handler, and `_refresh_drill_down` at `:243-272` prints the submissions and strengths. Constructed only at `src/robolearn/app.py:171`, written in full because a bare `app.py` also matches `src/robolearn/web/app.py`, whose line 171 is an unrelated `displayName` field. `panels.jsx:280-421` has no cell handler and never calls `getPupilSummary` | source |
| The hosted build holds one combined record for this browser, and says so on screen | `panels.jsx:414`: "This hosted version keeps one combined record for this browser. Use the desktop app for separate pupil records." `pupil-store.js` stores it under the localStorage key `kodro_pupils_v1` with a single learner named "This device" | source |
| Nothing is uploaded from the dashboard | Browser: `pupil-store.js` makes no network call, and the `privacy-zero-external` gate holds the whole web build to that. Desktop: `pupil_progress` reads "the local pupil database on this machine ... Nothing leaves the machine." | `tools.py:597`, `node scripts/qa_web.mjs` |
| 7 of the 24 lessons declare a reading age | `reading_age` present in 7 of 24 lesson YAMLs: `000_watch_it_go` 5, `00_first_drive` 6, `00a_turn_the_corner` 6, `00b_repeat_square` 9, `00c_look_first` 10, `00d_fix_the_turn` 7, `16_variables` 9 | `git grep -n '^reading_age:' -- 'src/robolearn/lessons/library/*.yaml'`, which prints those 7 lines and nothing else. An earlier version of this row cited `src/robolearn/lessons/*.yaml`, which matches no file: the library sits one directory down, under `library/`. The claim was right and only the way to check it was broken, which on a ledger whose entire purpose is "here is how to check me" is the more dangerous of the two. |
| The reading age drives the error explanations, not just a badge | `app.jsx:1740` publishes `KODRO_READING_AGE` for the explanation path; the badge at `app.jsx:3126` is the older use | source |
| The readable-text setting enlarges the reading surfaces without moving the layout | `styles.css:1179` sets Atkinson Hyperlegible with Comic Sans and Verdana fallbacks, wider letter and word spacing, "Scoped to the reading + code surfaces so the fixed app grid is unaffected" | source |

Three claims were cut from these blocks rather than filmed.

**"the sensor gate refusing a sensor the chassis cannot carry"** was in EXPAND-1
until 15 August. No such gate exists. The command gate refuses a command whose
part is not fitted; nothing anywhere gates on what a chassis can carry, and
`RobotLab.jsx:936` says in the product's own voice that payload capacity is not
modelled. Searches for `max_sensors`, `sensor_slots`, `sensor_limit`,
`allowed_sensors`, `supports_sensor`, `payload`, `can_carry` and
`compatib` across the package return nothing that gates on capacity. Filming it
would have meant staging a refusal the product does not perform.

**"any cell drills down to the pupil and the attempts behind it"** and **"every
figure comes from a database file on this machine"** were both in EXPAND-2 until
15 August, over a shot whose source is the web app. The web modal,
`panels.jsx:280-421`, has five click handlers and none of them is on a cell;
`getPupilSummary` is exported by `bridge.js:214` and called from nowhere in the
UI. The drill-down is real and it is in `teacher_dashboard.py`, which only the
Tk app opens. The database is real too, and only the desktop has it: in the
browser the register is a localStorage key. Three other rows cite a file under
`docs/` and they are fine, because a generated evidence record is a measurement:
`test_suite.json` is what the suite emitted, `stt_bench` is what the benchmark
emitted, `stt_clips/` is the data itself. This row cited hand-written prose,
`docs/implementation-status.md:26`, which is a claim wearing the costume of
evidence. The other row this file has had to correct, the ultrasonic refusal
above, failed the same way in miniature: it quoted a plausible sentence instead
of reading the one the code builds. The status doc has been corrected too.

**"the schema rejecting an out-of-range run length"** was in EXPAND-3 until 15
August, and was wrong twice: no schema declares a bound, and `run_program` has
no run-length parameter to be out of range. The two real refusals that replaced
it are in the MCP section above, and the narration says where the guard actually
lives. EXPAND-3 itself stopped existing on 17 August; this paragraph stays
because the correction is what shaped the narration the finale now speaks.

## Claims that must not be made

These are ordered by how much damage each one does.

1. **No human evaluation.** No teacher trial, no pupil study, no usability
   session, no participant count, no satisfaction score. None happened. The
   synthetic-persona harness is not a user study and must never be described as
   one.
2. **No physical validation.** No robot was built, driven, or measured. Nothing
   in the simulator has been checked against hardware. Do not say "validated",
   "accurate", or "matches the real robot".
3. **Not a replacement for Gazebo, Webots, or Isaac Sim.** The honest framing is
   an offline-first learning and early-design test studio with disclosed
   fidelity boundaries. Saying otherwise invites a Q&A question that cannot be
   answered.
4. **Do not present the July hardware GPU figures as current.** The 144.5 and
   128.2 FPS medians come from a 27 July artefact on a different graphics path
   and were not re-measured. If frame rate comes up, quote the software
   rasteriser numbers, which were measured in this pass.
5. **`qa_personas` and `qa_vibe` are not passes.** Both exit 0 without a local
   model present, and produce no data. They are honest skips. Reporting exit 0
   as a pass would be the exact kind of green-by-default claim the honesty gate
   exists to prevent.
6. **Do not claim browser dictation is private.** It uses the browser's own
   speech API, which sends the audio off the machine to a service belonging to
   whoever made the browser. It is opt-in, off by default, and the notice in the
   product says exactly that. Do not name a company either: the desktop build
   renders in the platform web view rather than in Chrome, so the recogniser
   comes from whichever engine is hosting, and `qa_voice.mjs` now fails if the
   notice names one vendor. If the offline claim is made on camera, this
   exception must be named in the same breath, and the local speech-to-text path
   is the one to demonstrate.
7. **Do not claim deployment, signing, release, or a Turnitin result.** None
   exist.
8. **Do not state the page limit or the video duration as settled.** See
   `BRIEF_VERIFIED.md`. Both are open and both are the student's to confirm.

9. **Do not call the city an open world, infinite, procedural, or GTA-like.**
   The 3D city streams scenery chunks around the rover so the skyline stops
   ending at a visible wall. Those chunks are painted, not simulated:
   `qa_city_stream.mjs` proves they never enter the collidable obstacle set,
   never enter the agent list, and never reach the grader, so nothing streamed
   can be driven into, sensed by `distance()`, or scored. The ring is five by
   five chunks, not endless: the streamed footprint measures 476.8 by 484.7
   units against a 90 unit authored core, and city fog is set to 60 near and
   220 far, so the camera cannot see to the edge of it anyway. The strongest
   honest sentence is that the city continues past what the camera can see.

## Rule for anything not listed

If a claim is not in the first half, either find the artefact that supports it
and add a row, or cut the sentence. There is no third option, and "it obviously
works" is not an artefact.
