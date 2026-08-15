# Claim ledger

Every factual claim the CA2 video is allowed to make, with the artefact that
supports it and the exact command that produced the artefact. If a sentence is
not in this table, it does not get said on camera.

The second half of this file is the list of things that must not be said. That
half matters more. A demonstration loses more marks for one unsupported claim
than it gains from three extra features.

Measured on 14 August 2026 unless a date is given. Commit `aa174cf` for the
Python suite artefact, working tree clean; the Node gates, the lint and type
gates and both MCP smoke scripts re-run at `2222e1e`.

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
the best argument on this page for the instruction above. It now reads
`42 passed (478 of 785 ...)`, two fewer of each. The cause is not a change to the
gate and not a new finding: commit `2836f85` untracked
`docs/dissertation/Kodro_Dissertation.lof` and `.lot`, the generated list-of-figures
and list-of-tables files, which `.gitignore:96` does not name among the build files
that stay tracked. The tracked set fell from 787 to 785 and the read set from 480
to 478 with it. Any commit that adds or removes a tracked file moves this number.
It is a denominator, not a result, and the pass count of 42 is the part that
carries the claim.

The
re-measured values on 15 August: honesty 121, interpreter 180, voice 108,
learning annotations 28, grader 55, MCP unit 66, web lesson parity 52, MCP smoke
2 of 2 entry points with 8 tools and 25 resources. Every one of those matched
its row.

## Claims with evidence

### Testing

| Claim | Evidence | Command |
|---|---|---|
| 1,639 Python tests collect, 1,638 pass, 1 skips | `docs/eval/test_suite.json` | `python -m pytest --cov-report=json --junitxml=...` |
| 90.90 percent branch-aware coverage against an 85 percent gate | same | same |
| The skip is a local Tk startup failure, not a product failure | `skipDetail` in the same file | same |
| The counts are reproducible from a clean checkout | `source.workingTreeClean: true` at commit `aa174cf` | `git status --porcelain` before the run |

Say "the skip", not "the one skip", and do not name a test or offer a cause on
camera. The skip count is not stable on this host: three runs of the same 1,639
tests gave 1, then 2, then 0. Thirteen test files open a Tk window in a fixture
that catches `tk.TclError` and skips instead of failing, and 169 collected tests
sit behind those guards, so a bad run takes a whole file with it. The recorded
reason is "Can't find a usable init.tcl". Why it is intermittent is not
established: `tk.Tk()` succeeds on demand in both the base interpreter and a
fresh venv, test order is deterministic, and nothing in the repository touches
`chdir`, `TCL_LIBRARY` or `TK_LIBRARY`. The defensible sentence is that a
fixture degrades a local Tk startup failure into a skip so a desktop-UI
dependency cannot mask a product regression. If asked why it is intermittent,
the honest answer is that it has not been root-caused.

Do not read the test name out of `skipDetail` on camera either. That block pairs
a test name with a reason string that belongs to a different file, because the
string was carried across by hand at the last regeneration instead of being
re-read from the run. The artefact now flags the pair as unverified in its own
`provenance` field. If it comes up, the answer is that the counts and coverage
are machine-read, that one field was not, and that the file says so rather than
having been quietly patched to look consistent.

The coverage figure is a conservative floor, not a ceiling. `tests/conftest.py`
drops the coverage contribution of node-subprocess tests on this exact host
combination while still running them. That disclosure is in the artefact and
should be said out loud if coverage comes up in the Q&A.

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
| The server is `kodro` version 2.0.0 | initialize response | `python scripts/smoke_mcp.py` |
| It exposes 8 tools and 25 resources | tools/list and resources/list, counted at run time | same |
| Both entry points work: the console script and `python -m robolearn.mcp` | 2 of 2 entry points clean | same |
| Bad input is refused, not silently defaulted | four negative cases pass: bad lesson id, unknown tool, misspelled argument, bad URI | same |
| A malformed frame returns `-32700` and the session survives | that check passes | same |
| Non-ASCII round trips byte-exact | `café-90°-naïve-✓` check passes | same |
| 66 unit tests cover the server | 66 passed in 9.80s | `python -m pytest tests/unit/test_mcp_server.py` |
| The Windows and Unix smoke scripts both pass 14 checks per entry point | `== MCP SMOKE: 2 of 2 entry points clean ==`, exit 0 on both, no `--entry` restriction | `.\scripts\smoke_mcp.ps1`, `bash scripts/smoke_mcp.sh` |
| The `kodro-mcp` console script is installed exactly as `pyproject.toml` declares it | `kodro-mcp -> robolearn.mcp.server:main` in the installed entry points, and the smoke run drives it | `python -c "from importlib.metadata import entry_points; ..."` then the smoke scripts above |

One distinction the video must keep. What has been verified is a **real
subprocess JSON-RPC handshake against the server**, driven by the smoke
harness. That is stronger than a mock and weaker than a named client. Say "it
survives a real client handshake" only if a named client is actually shown doing
it on camera in the take that ships. Otherwise say "a real stdio JSON-RPC
session", which is what the evidence supports.

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
| The honesty gate passes 121 checks | `PASS honesty: 121 passed, 0 failed` | `node scripts/qa_honesty.mjs` |
| The interpreter gate passes 180 checks | `180 passed, 0 failed` | `node scripts/qa_interpreter.mjs` |
| Encoding is clean across the files the gate reads | `10 passed (411 files, 100 protected characters)` | `node scripts/qa_encoding.mjs` |
| No tracked file carries a credential, a key file or a local account name | `PASS  secrets: 42 passed (478 of 785 tracked files read, 13 credential rules, bare-name rule live)` | `node scripts/qa_secrets.mjs` |
| Learning annotations pass 28 checks | 28 passed | `node scripts/qa_learning_annotations.mjs` |
| Software-rasterised rendering holds the mid twenties in FPS | medians 25.7 low quality, 24.4 high, over three samples per tier | `node scripts/qa_performance.mjs --gl=software --repeat=3`, verdict MEASURED |

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

These four blocks only run if the 15 minute cap is confirmed. Until 15 August
they had no narration, so they had no rows here either, and the header of
`SCRIPT.md` was offering a 14:30 cut whose extra 290 seconds nobody had written
a word for. Writing them cost two of them a claim: see the last two rows.

| Claim | Evidence | Command |
|---|---|---|
| One registry decides which commands a build may use | `window.KodroCommands` in `RobotLab.jsx`, compiled to `bundle.js:15218`; `check()` gates on whether the part is fitted and `availability()` feeds the palette, the cards and the assistant grounding from the same table | source |
| With no ultrasonic fitted, `distance()` is refused with a readable reason | `bundle.js:15235` builds "This robot has no Ultrasonic range, so distance() is not available. Fit an Ultrasonic range in the Robot Lab to use it." The label is `SENSORS.ultrasonic.name`, `bundle.js:14762`; read the panel on the day rather than quoting this row, since the label is data | source |
| The assistant refuses to generate obstacle avoidance without a distance sensor | `app.jsx:1548` refuses the request rather than emitting code for a missing part | source |
| A payload requirement comes back unresolved, not answered | `RobotLab.jsx:936`: "Payload capacity is not modelled, so Kodro cannot claim this constraint." Runtime and battery requirements carry the same `unresolved` status with their own reasons | source |
| The build exports as a `.krs` file and MCP validates that same file | `validate_robot_spec` "Validate a robot exported from the Robot Lab (.krs JSON) and report the mass, wheel count and degrees of freedom the simulator derives from it" | `tools.py:552` |
| The teacher dashboard is a class concept-strength heatmap with per-pupil drill-down and CSV export | `docs/implementation-status.md:26`, reachable at `app.jsx:2582` via More tools, Teacher progress, which forces classroom mode on the way in | source |
| Dashboard figures come from a local database and nothing is uploaded | `pupil_progress`: "Summarise progress from the local pupil database on this machine ... Nothing leaves the machine." Corroborated by the `privacy-zero-external` gate | `tools.py:597`, `node scripts/qa_web.mjs` |
| 7 of the 24 lessons declare a reading age | `reading_age` present in 7 of 24 lesson YAMLs: `000_watch_it_go` 5, `00_first_drive` 6, `00a_turn_the_corner` 6, `00b_repeat_square` 9, `00c_look_first` 10, `00d_fix_the_turn` 7, `16_variables` 9 | grep of `src/robolearn/lessons/*.yaml` |
| The reading age drives the error explanations, not just a badge | `app.jsx:1740` publishes `KODRO_READING_AGE` for the explanation path; the badge at `app.jsx:3126` is the older use | source |
| The readable-text setting enlarges the reading surfaces without moving the layout | `styles.css:1179` sets Atkinson Hyperlegible with Comic Sans and Verdana fallbacks, wider letter and word spacing, "Scoped to the reading + code surfaces so the fixed app grid is unaffected" | source |
| Reading a lesson resource returns `application/json` generated from the lesson YAML | live session: `resources/read kodro://lessons/00d_fix_the_turn` returned `application/json`, 2312 bytes, keys including `allowedConstructs`, `concepts`, `curriculumRefs`, `glossary` | `python -m robolearn.mcp.server` driven over stdin, 15 August |
| `prove_contracts` refuses `runs: 0` rather than defaulting it | live session returned `isError=True`, `'runs' must be at least 1.` The handler comment at `tools.py:367` records why: `params.get("runs") or DEFAULT` would make an explicit 0 silently become 5 | same session |
| `prove_contracts` refuses a non-numeric `runs` by type | live session returned `isError=True`, `'runs' must be a whole number, got a string.` | same session |
| That guard is in the handler, not the schema | `tools.py:379`. No `inputSchema` in the server declares a `minimum` or a `maximum`; `runs` is declared as `{"type": "integer"}` and nothing more | source |

Two claims were cut from these blocks rather than filmed.

**"the sensor gate refusing a sensor the chassis cannot carry"** was in EXPAND-1
until 15 August. No such gate exists. The command gate refuses a command whose
part is not fitted; nothing anywhere gates on what a chassis can carry, and
`RobotLab.jsx:936` says in the product's own voice that payload capacity is not
modelled. Searches for `max_sensors`, `sensor_slots`, `sensor_limit`,
`allowed_sensors`, `supports_sensor`, `payload`, `can_carry` and
`compatib` across the package return nothing that gates on capacity. Filming it
would have meant staging a refusal the product does not perform.

**"the schema rejecting an out-of-range run length"** was in EXPAND-3 until 15
August, and was wrong twice: no schema declares a bound, and `run_program` has
no run-length parameter to be out of range. The two real refusals above replaced
it, and the narration now says where the guard actually lives.

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

## Rule for anything not listed

If a claim is not in the first half, either find the artefact that supports it
and add a row, or cut the sentence. There is no third option, and "it obviously
works" is not an artefact.
