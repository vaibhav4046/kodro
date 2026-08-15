# Kodro: handoff for Keith Dures

Prepared 27 July 2026. Everything below was measured at commit `b33e5b8`.

## What this is

Kodro is an offline robot design and simulation studio for UK Computing. The 24
lessons span Key Stage 1 to Key Stage 4 but are weighted to the top of that
range: 3 at KS1, 4 at KS2, 9 at KS3, 8 at KS4. "KS1 to KS4" is true and
misleading on its own, so the honest description is upper KS2 through KS4 with a
KS1 taster. A pupil designs a robot from real parts, writes
Python to drive it, watches it run in a 3D world, and gets marked on that run.
It runs in a browser with no install, no account, no server and no API calls.

Live: https://vaibhav4046.github.io/robolearn/
Repository: https://github.com/vaibhav4046/robolearn

## Is it ready

The software is ready. The evidence that it teaches anybody anything is not,
and I am not going to pretend otherwise.

### Ready and verified

Every number here comes from running the named command. Nothing is estimated.
The Python row was measured on the final source state rather than on the tag,
because test files were added after tagging; that run writes its own commit and
working-tree status into `docs/eval/test_suite.json`, so check the figure there
rather than assuming a tag checkout reproduces it. The two browser rows want a
quiet machine: they drive a single-threaded dev server on wall-clock timers, so
running them alongside other harnesses can time an assert out and report a
failure that passes on its own.

| What | Result | Command |
|---|---|---|
| Python test matrix | Counts and coverage are read from `docs/eval/test_suite.json`, not repeated here: the figure in this row went stale twice. Coverage gate is 85% branch-aware. The skip count is unstable on the development host, see the note under this table | `pytest tests/` |
| Interpreter harness | 180 of 180 | `node scripts/qa_interpreter.mjs` |
| Grader parity and solvability | 55 of 55 | `node scripts/qa_grader.mjs` |
| Lesson Studio document and store | 79 of 79 | `node scripts/qa_lesson_studio.mjs` |
| Construct liveness | 30 of 30 | `node scripts/qa_construct_liveness.mjs` |
| Browser behaviour, real bundle in headless Chrome | 41 of 41 | `node scripts/qa_ui.mjs --suite=behaviour` |
| Browser paint / layout / modals | 6 of 6, 6 of 6, 13 of 13 | `node scripts/qa_ui.mjs --suite=paint` etc |
| World sweep | 61 of 61 | `node scripts/qa_worlds.mjs` |
| Web boot and privacy | 5 of 5 | `node scripts/qa_web.mjs` |

On the skip count in the Python row: it is not stable on the development host.
Three runs of the same suite gave one skip, then two, then none. Every one of
them comes from a single fixture in `tests/unit/test_ai_studio.py` that opens a
Tk window; when the toolkit fails to start, the fixture catches the error and
skips rather than fails, so a bad run skips several tests together. Why it is
intermittent has not been established, so no cause is asserted here. The
degradation itself is deliberate: a desktop-UI dependency that will not start
should not be able to mask a product regression, and it should not be folded
into the pass count either.

The 24 lessons map to named DfE programme of study statements and BCS
computational thinking concepts. Each lesson states its success criteria on
screen before the pupil runs anything.

Two things worth looking at specifically, because they are the parts I would
defend hardest:

**Every lesson is provably finishable.** Each one ships a worked answer, shown
to a pupil only after the hints run out. Those answers are not editorial. An
automated gate runs all twenty four through *both* marking engines on every change
and requires 100 out of 100, inside the constructs that lesson has taught and
inside its own line budget. A lesson whose own answer fails does not ship. That
gate is also the only thing that would ever tell us a lesson had become
impossible, and writing it found eight cases where the harness itself was wrong.

**Anyone can write a lesson.** More Tools, then "Make a lesson". You draw the
arena by clicking, choose what counts as finished, and write the starter and one
answer. You cannot save until your own answer passes, checked by the same marker
the pupils face. A saved lesson sits in the library marked "Made here" and is
graded by the identical code as the built-in twenty four. It exports to one file
you can send to a colleague. No server, no account.

### Not ready, and these are the honest gaps

1. **No human has used it except me.** There is no classroom trial, no teacher
   interview, no pupil observation. Everything I know about whether it teaches
   is inference from the design, not evidence. This is the single largest gap
   and it is the reason I want your view first.

2. **The desktop build grades differently from the browser build.** In the
   browser a lesson is marked on the run the pupil just watched. In the
   installed desktop app the Python engine re-runs the program to mark it,
   because that is where the pupil record and the adaptive hints live. The
   criteria and the wording are identical, but it is a second run. The app says
   so on screen and the teacher guide says so too. I would rather disclose it
   than quietly unify the two and risk breaking the pupil record.

3. **The simulation is not validated against a physical robot.** It uses a
   kinematic model with published battery and motion constants. It has never
   been checked against a real rover. The app states this where it reports
   results.

4. **Accessibility has been checked by automated tools and by me, not by a
   disabled user.** Contrast, keyboard paths and reduced motion all pass
   automated checks. That is not the same as being usable.

## What changed this week

Two adversarial audits found that the pupil watched one simulation and was
marked by another. The lesson's samples and obstacles existed only inside the
grader, `sample_detected()` was hard-coded to return false, roaming city
traffic that belonged to no lesson could stop the rover, and the marking engine
re-executed the program in a hidden second run. A pupil could watch the rover
hit a rock and be told there were no collisions.

That is fixed. The lesson's world is now the world on screen, the sensors read
it, and the mark comes from the run that was watched.

A third audit ran against the rebuilt version, with every finding handed to an
independent reviewer whose job was to refute it. Twenty seven of twenty eight
survived and all twenty seven are now closed. Among them:

- A program that crashed after driving far enough passed at 100 out of 100.
- `04_selection` could not be passed by the if/else it teaches, because the
  taught branch drove into the rock on its first move.
- `01_hello_rover` teaches a three step sequence and passed with two of the
  three steps deleted.
- `if 1 > 0:` satisfied every selection lesson without reading a sensor.
- `read_distance()` returned centimetres in the simulation and metres in the
  marker, so lesson 07 could not be solved the way it is taught.

The full list is in the commit message for `466d2c4`.

Since then, two more things landed. Every lesson now ships a worked answer that
is machine-checked in both engines, which also closed the last lesson that did
not check the concept it teaches (`08_pathfinding` named iteration, selection
and decomposition and checked none of them; a hard-coded route scored 100). And
the Lesson Studio, so the curriculum is no longer only whatever we decided
months ago.

## What I would like from you

1. Sit with the first three lessons as though you were a pupil. Do not read the
   code. Tell me where you stalled and what you expected to happen instead.
2. Tell me whether the marking feedback is the kind a teacher would accept.
3. Tell me whether the DfE and BCS mapping is defensible or whether it reads as
   decoration.
4. If you think a classroom trial is worth doing, tell me what the ethics route
   looks like and how small a trial could still be meaningful.

## Twenty second version

Open the link. You get four doors: learn to code, design a robot, free play, or
make a lesson. Pick the first. Lesson one gives you a working program, a goal,
and a robot that drives when you press Run. Change the number, press Run, watch
what happens, read what it says you still need to do. If you get stuck, the
hints appear, and after those the answer does.
