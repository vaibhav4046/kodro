# Kodro: handoff for Keith Dures

Prepared 27 July 2026. Everything below was measured at commit `466d2c4`.

## What this is

Kodro is an offline robot design and simulation studio for UK Computing,
Key Stage 1 to Key Stage 4. A pupil designs a robot from real parts, writes
Python to drive it, watches it run in a 3D world, and gets marked on that run.
It runs in a browser with no install, no account, no server and no API calls.

Live: https://vaibhav4046.github.io/robolearn/
Repository: https://github.com/vaibhav4046/robolearn

## Is it ready

The software is ready. The evidence that it teaches anybody anything is not,
and I am not going to pretend otherwise.

### Ready and verified

Every number here reproduces by checking out the tagged commit and running the
named command. Nothing is estimated.

| What | Result | Command |
|---|---|---|
| Python test matrix | 1,223 pass, 1 skip, 87.80% branch coverage against an 85% gate | `pytest tests/` |
| Interpreter harness | 180 of 180 | `node scripts/qa_interpreter.mjs` |
| Grader parity (browser vs Python) | 38 of 38 | `node scripts/qa_grader.mjs` |
| Construct liveness | 27 of 27 | `node scripts/qa_construct_liveness.mjs` |
| Browser behaviour, real bundle in headless Chrome | 33 of 33 | `node scripts/qa_ui.mjs --suite=behaviour` |
| Web boot and privacy | 5 of 5 | `node scripts/qa_web.mjs` |
| Renderer, three samples per tier | median 145.8 FPS on the integrated GPU, 37.6 FPS under forced software rasterisation | `node scripts/qa_performance.mjs` |

The 18 lessons map to named DfE programme of study statements and BCS
computational thinking concepts. Each lesson states its success criteria on
screen before the pupil runs anything.

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

3. **One lesson does not check the concept it teaches.** `08_pathfinding`
   teaches selection but is marked only on reaching the samples without
   collisions. I could add a `uses_construct: if` criterion in a minute, but I
   could not write a solution that passes it, and shipping a criterion I cannot
   demonstrate would be exactly the kind of unproven claim I spent this week
   removing. It is documented rather than papered over.

4. **The simulation is not validated against a physical robot.** It uses a
   kinematic model with published battery and motion constants. It has never
   been checked against a real rover. The app states this where it reports
   results.

5. **Accessibility has been checked by automated tools and by me, not by a
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

## What I would like from you

1. Sit with the first three lessons as though you were a pupil. Do not read the
   code. Tell me where you stalled and what you expected to happen instead.
2. Tell me whether the marking feedback is the kind a teacher would accept.
3. Tell me whether the DfE and BCS mapping is defensible or whether it reads as
   decoration.
4. If you think a classroom trial is worth doing, tell me what the ethics route
   looks like and how small a trial could still be meaningful.

## Twenty second version

Open the link. You get three doors: learn to code, design a robot, or free
play. Pick the first. Lesson one gives you a working program, a goal, and a
robot that drives when you press Run. Change the number, press Run, watch what
happens, read what it says you still need to do.
