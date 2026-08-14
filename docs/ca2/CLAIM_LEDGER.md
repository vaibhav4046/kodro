# Claim ledger

Every factual claim the CA2 video is allowed to make, with the artefact that
supports it and the exact command that produced the artefact. If a sentence is
not in this table, it does not get said on camera.

The second half of this file is the list of things that must not be said. That
half matters more. A demonstration loses more marks for one unsupported claim
than it gains from three extra features.

Measured on 14 August 2026 unless a date is given. Commit `139a2c8` for the
suite artefact, working tree clean; the rest re-run at `13c0997`.

## Claims with evidence

### Testing

| Claim | Evidence | Command |
|---|---|---|
| 1,626 Python tests collect, 1,625 pass, 1 skips | `docs/eval/test_suite.json` | `python -m pytest --cov-report=json --junitxml=...` |
| 90.90 percent branch-aware coverage against an 85 percent gate | same | same |
| The one skip is a Tk display dependency, not a product failure | `skipDetail` in the same file | same |
| The counts are reproducible from a clean checkout | `source.workingTreeClean: true` at commit `139a2c8` | `git status --porcelain` before the run |

The coverage figure is a conservative floor, not a ceiling. `tests/conftest.py`
drops the coverage contribution of node-subprocess tests on this exact host
combination while still running them. That disclosure is in the artefact and
should be said out loud if coverage comes up in the Q&A.

### Lessons

| Claim | Evidence | Command |
|---|---|---|
| 24 lessons ship, 3 at KS1, 4 at KS2, 9 at KS3, 8 at KS4 | the lesson library YAML | `python scripts/export_lessons.py` |
| The exported lesson JSON matches the authoritative library byte for byte | SHA-256 `f1167f28...` matched on regeneration | `python scripts/export_lessons.py` twice, hashes compared |
| Web and desktop grade the same lesson identically | 52 passed | `python -m pytest tests/unit/test_web_lesson_parity.py` |
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
| The Windows and Unix smoke scripts both pass 14 checks | exit 0 both | `.\scripts\smoke_mcp.ps1 -Entry module`, `bash scripts/smoke_mcp.sh --entry module` |

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
| Median latency 0.885 s, median real-time factor 0.371 | same | same |
| Peak RAM 367.5 MB | same | same |
| Aggregate word error rate 0.25 across the clip set | same | same |
| GPU acceleration was unavailable on this machine | recorded verbatim: `RuntimeError: Library cublas64_12.dll is not found or cannot be loaded` | same |

The word error rate is 0.25 on ten clips. That is a small sample and it is a
quarter of words wrong. Present it as "usable for a fixed command vocabulary,
not as dictation", which is what the number actually says.

### Other gates

| Claim | Evidence | Command |
|---|---|---|
| The honesty gate passes 121 checks | `PASS honesty: 121 passed, 0 failed` | `node scripts/qa_honesty.mjs` |
| The interpreter gate passes 180 checks | `180 passed, 0 failed` | `node scripts/qa_interpreter.mjs` |
| Encoding is clean across 406 files | 10 passed | `node scripts/qa_encoding.mjs` |
| No tracked file carries a credential, a key file or a local account name | `PASS secrets: 27 passed (473 of 775 tracked files read, 13 credential rules)` | `node scripts/qa_secrets.mjs` |
| Learning annotations pass 28 checks | 28 passed | `node scripts/qa_learning_annotations.mjs` |
| Software-rasterised rendering holds the mid twenties in FPS | medians 25.7 low quality, 24.4 high, over three samples per tier | `node scripts/qa_performance.mjs --gl=software --repeat=3`, verdict MEASURED |

### The failure-and-refine story

Lesson `00d_fix_the_turn` grades `✗ Not yet · 80/100`, one word changes to
`turn_left(90)`, it regrades `✓ Complete · 100/100`. This is a real lesson in
the shipped library and the two verdicts are what the grader actually returns.
It is the strongest thing in the demonstration because it shows the loop rather
than describing it.

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
