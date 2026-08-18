# Kodro independent experience audit

Audit branch: `codex/night-audit`

Starting `main` commit: `ceb9e6f0b899296acb9e807c6190fd6238b0ec08`

Audit date: 26 July 2026

## Scope and evidence

I tested:

- the live site at <https://vaibhav4046.github.io/robolearn/>
- a fresh local static build made with `node scripts/build_web.cjs --static`
- a clean first-session browser origin at `http://127.0.0.1:8101/`
- lessons 1 to 5 in order on the live site
- the repository's lesson engine and grader for all 18 lessons
- the current source paths that connect lesson selection, the visible simulator, and grading

I used four viewpoints:

1. a stranger giving Kodro 20 seconds
2. an 11-year-old doing lessons 1 to 5
3. a teacher planning a 45-minute lesson
4. a sceptic checking terms such as `Prove`, `Evidence`, `5-seed proof`, `Validate`, and `Realism`

This report distinguishes a reproduced behaviour from a source-review risk. Nothing is called broken only because a source file looked suspicious.

## P0: breaks or blocks a first session

### P0.1 The visible lesson run and the lesson verdict can contradict each other

**Where**

Live site, `More Tools` > `Lessons`, lessons 1 and 5.

**What I saw**

In lesson 1, `Drive to the Flag`, the supplied program visibly stopped after a collision:

> Collision with another robot at (0, 29). Robot halted.

The status summary said:

> travelled 0.3 metres

The same screen then reported:

> ✓ Complete · 100/100

It ticked both:

> Travel at least 3 m

and:

> Do not hit anything

The console also printed:

> ✓ PASS Score: 100/100

In lesson 5, `Move and turn`, the visible run again stopped after:

> Collision with another robot at (0, 206). Robot halted.

The lesson verdict was `✗ Not yet · 80/100` because it collected no sample, but it still ticked:

> Do not hit anything

The visible world contained no usable lesson sample. The hint described the supplied route:

> After your first move_forward the rover is east of the base. You need to turn left and drive again to reach (4, 4).

**Why it fails**

An 11-year-old cannot tell whether their program worked. A teacher cannot use `Complete`, ticks, or the score as evidence of learning. The first lesson teaches that an obvious crash can still earn full marks.

Source inspection explains the reproduced result:

- lesson selection changes only the generic terrain and code buffer in `src/kodro/assets/web/app.jsx`
- the visible browser host has no lesson sample or lesson-base state in `src/kodro/assets/web/hooks.jsx`
- visible `sample_detected()` always returns false and visible `collect_sample()` only prints text in `src/kodro/assets/web/interpreter.js`
- after the visible run, the program is run again inside a separate hidden lesson world in `src/kodro/assets/web/lesson-grader.jsx`

The pupil watches one simulation and receives a verdict from another.

**Minimal fix**

Use one run trace for animation and grading. Load the lesson's base, bounds, samples, and obstacles into the visible world, then grade that exact trace. Remove the second hidden rerun. Until that is done, hide browser lesson scores and `Complete` because they do not describe the run the pupil watched.

### P0.2 The first-session `Run this test` control gives no visible run

**Where**

Fresh local static build, clean onboarding, Rover, Riverside City, `Prove your robot`.

**What I saw**

I completed the three onboarding steps, selected Rover, and clicked:

> Run this test

The button remained on screen. Status remained:

> Standby

The rover did not move and no result appeared, including after three seconds.

After I clicked `Edit program`, the previously hidden console showed what the button had actually done:

> Validating across 5 randomised seeds in "Cross the street, avoid the obstacles" on Riverside City...

and:

> Validation: success 0% (0/5), mean collisions 0, mean time n/a, mean battery 12%, mean score 12. Saved.

The browser console also recorded:

> [Kodro bridge] pywebview API not ready; returning null for save_scenario_run

**Why it fails**

The first prominent Run action does not run the visible robot. A stranger reasonably concludes that nothing works. Its label also duplicates the separate `Run 5-seed proof` action while hiding the result in a console that is not on the current screen.

**Minimal fix**

Wire `Run this test` to the same visible run used by the editor's `Run` button. Show `Running`, motion, and the final result on the current screen. Keep repeated-seed checking behind one clearly named advanced action, such as `Run 5 variations`.

### P0.3 The default first program crashes at its starting position

**Where**

Fresh local static build, immediately after onboarding a Rover, `Edit program`, then the top-bar `Run`.

**What I saw**

The default `starter.py` says it looks ahead and steers around traffic. The visible run instead stopped almost immediately:

> Deployed on Riverside City.

> Collision with another robot at (0, 0). Robot halted.

The evidence rail stayed at:

> Distance driven 0.0m

**Why it fails**

This is the first complete program presented to a new user. It promises obstacle avoidance, then fails before making visible progress. It reinforces the impression that Kodro is a static scene rather than a working simulator.

**Minimal fix**

Ensure the player robot and moving agents never share a spawn envelope. Add one clean-origin smoke test that onboards a Rover, runs `starter.py`, observes distance above zero, and sees either a clean completion or an explained recoverable stop.

### P0.4 Switching lessons loses the visible verdict and mixes statuses

**Where**

Live site, after running lesson 5, switch to lesson 4, then switch back to lesson 5 with the `Lesson` selector.

**What I saw**

Before switching, lesson 5 showed:

> ✗ Not yet · 80/100

I edited its code to include an audit marker. After switching away and back:

- the edited code buffer was preserved
- the `Not yet · 80/100` verdict and its failed-goal explanation disappeared
- the top status still said `Halted`
- when lesson 4 was selected, the main status restored lesson 4's old `Mission complete` message while the top status still said `Halted`

The console retained all prior lesson output, including the lesson 1 collision and its contradictory pass.

**Why it fails**

A pupil loses the explanation they need to improve the program. The page can describe two different lessons and two different outcomes at once. A teacher cannot tell which status belongs to the selected lesson.

**Minimal fix**

On lesson change, stop any active run, reset the visible rover, set status to `Ready`, and restore the saved verdict for the selected lesson. Show only the selected lesson's latest output by default, with older runs behind `Runs`.

### P0.5 Several `Complete` scores do not test the stated learning objective

**Where**

Repository lesson engine and grader, using the same real grader exercised by `scripts/stress_test_lessons.py`.

**What I reproduced**

The following deliberately incomplete or wrong solutions received 100:

| Lesson | Stated idea | Program that still received 100 |
| --- | --- | --- |
| Drive to the Flag | Reach the flag | Move 3 m with no flag interaction |
| Make a Square | Draw a square | Draw a six-sided route using 60 degree turns |
| Look Before You Move | Ask a sensor before moving | Use `if True` and never read a sensor |
| Hello, Rover! | Move, beep, and log in sequence | Move only |
| Selection | Choose using sensed conditions | Use `if True` around a fixed route |
| Reading sensors | Read sensors | Use a fixed move and collect, with no sensor call |
| Pathfinding basics | Pathfinding | Use a fixed route with no selection or iteration |
| Optimisation | Improve route efficiency | Take a deliberate 30 m detour |
| Decomposition | Split work into useful parts | Put the whole route in one function |
| Abstraction | Use sensed information | Use `if True`, turn, and move |
| Nested loops | Use nested loops | Use separate sequential loops |
| Counting | Count with a variable | Use `while True` and hard-coded collections |
| Functions with parameters | Use parameters | Define a no-parameter function |

The first lesson world does not contain a flag or destination. The square criterion checks distance and the presence of a `for`, not shape or return to start.

**Why it fails**

The `Complete` label and score are assessment claims. They currently certify code that does not demonstrate the named concept. This blocks a teacher from using lesson completion as classroom evidence.

**Minimal fix**

Do not show `Complete` or a numerical score for a concept unless the criterion checks that concept. The quickest safe change is to rename under-checked outcomes to `Practice run recorded` and list only the facts actually checked. Then add concept-specific checks lesson by lesson.

## P1: confuses a user

### P1.1 First-run copy overstates what the simulation establishes

**Where**

Clean onboarding, steps 1 and 2.

**What I saw**

The landing asks:

> Would your robot actually work?

It then says:

> Build it from real parts

The self-driving car card says:

> Validate it among pedestrians and traffic.

The app later discloses that it is a kinematic simulation that does not validate or certify physical performance.

**Why it fails**

A stranger receives the strongest claim before seeing the limitation. `Actually work` and `Validate` imply physical evidence that the app does not produce.

**Minimal fix**

Use: `See how a robot design behaves in a visual test world.` Rename `real parts` to `example hobby parts` and `Validate it` to `Try its program`.

### P1.2 Core pupil actions use research and engineering terms

**Where**

Top navigation and the Prove screen.

**What I saw**

- `Prove`
- `Evidence`
- `Deterministic evidence`
- `Run 5-seed proof`
- `Download manifest`
- `Regression: no matching baseline yet`
- `Validate`

**Why it fails**

These labels do not tell a pupil what will happen when clicked. `Prove` can also be mistaken for physical proof even though the same screen says the simulation cannot certify physical performance.

**Minimal fix**

Use plain task labels in Simple mode:

- `Prove` to `Test`
- `Evidence` to `Results`
- `Run 5-seed proof` to `Run 5 variations`
- `Validate` to `Check program`
- hide `manifest` and `regression baseline` until Expert mode

### P1.3 The repeated-seed panel produces a failure before the visible test has run

**Where**

Fresh local Prove screen, after onboarding a Rover.

**What I saw**

`Run 5-seed proof` immediately returned:

> FAIL

> 0/5 goals reached

> 0 mean collisions

> 12% mean battery used

> Regression: no matching baseline yet.

No plain next action appeared.

**Why it fails**

The result combines a failed mission, zero crashes, battery use, and an absent baseline without saying what the pupil should change. It appears before they have seen one normal run.

**Minimal fix**

Hide repeated-seed testing until one visible run completes. Then summarise it as `Reached the goal in 0 of 5 variations` and show one next action.

### P1.4 A visible `More` button does nothing on the Prove screen

**Where**

Fresh local Prove screen.

**What I saw**

I clicked the top-bar `More` button twice. It never became expanded and no `Step`, `Reset`, or `Validate` controls appeared. The separate `More tools` button did work.

**Why it fails**

Two adjacent controls begin with `More`, but one has no visible effect on this screen.

**Minimal fix**

Hide `More` outside the code editor. Keep `More tools`, or rename it `Tools`.

### P1.5 Lesson world changes are unexplained and old status survives

**Where**

Live lessons 2, 3, and 4.

**What I saw**

- lesson 2 used Earth
- opening lesson 3 changed the world to Mars
- opening lesson 4 changed it back to Earth
- `Status: Complete` from the previous lesson remained while the new lesson had not run

The world change is intentional in the lesson data, but the interface gives no reason for it.

**Why it fails**

An 11-year-old may think the environment changed randomly or that the new lesson is already complete.

**Minimal fix**

On selection, show one short line: `Loading this lesson's Mars world`, then reset status to `Ready`. Do not carry the previous run status into a new lesson.

### P1.6 The lesson console mixes every lesson into one long log

**Where**

Live lessons 1 to 5.

**What I saw**

The lesson 5 screen still showed the complete introductions, runs, collision messages, hints, and verdicts from lessons 1 to 4.

**Why it fails**

The relevant feedback is buried. The lesson 1 collision and `PASS` contradiction remain visible during later work.

**Minimal fix**

Show only the selected lesson's latest run. Keep older output in the existing `Runs` view.

### P1.7 The command strip omits commands used by the lesson

**Where**

Live lesson 4, `Hello, Rover!`.

**What I saw**

The starter program uses:

> beep(1)

and:

> log("hello rover")

The command strip under the editor did not list `beep` or `log`.

**Why it fails**

The lesson asks a pupil to understand commands that the nearby help does not acknowledge.

**Minimal fix**

Build the command strip from the commands used by the selected lesson, or remove the strip from lesson view and link one complete command list.

### P1.8 A near miss still receives an unqualified 100

**Where**

Live lesson 3, `Look Before You Move`.

**What I saw**

The run result warned:

> only 29 cm of clearance remained. Treat this as a near miss and add more margin before calling the behaviour robust.

The same result was:

> ✓ Complete · 100/100

**Why it fails**

The warning asks for improvement while the score says there is nothing left to improve.

**Minimal fix**

Use `Pass with warning` and remove the perfect score, or make safe clearance an explicit criterion.

### P1.9 Simple mode exposes renderer diagnostics that do not help the pupil

**Where**

Fresh local build, Simple interface, `Show evidence`.

**What I saw**

The pupil-facing rail included:

- `P95 submission`
- `240 Hz work budget`
- `NOT MET HERE`
- `LOW-ADAPTIVE`

**Why it fails**

These are useful engineering diagnostics, not lesson evidence. `NOT MET HERE` looks like a robot failure.

**Minimal fix**

Move renderer diagnostics to Expert mode or a diagnostics screen. Keep pupil results to movement, battery, clearance, collision, and goal outcome.

### P1.10 The teacher dashboard sounds class-wide but is device-only

**Where**

`More Tools` > `Teacher progress`.

**What I saw**

The heading says:

> Learning on this device

The empty state says records are:

> saved in this browser on this device

No class import or cross-device view is offered on that screen.

**Why it fails**

`Teacher progress` can be read as a class dashboard. A teacher planning a 45-minute class needs to know that each device is separate before the lesson starts.

**Minimal fix**

Rename the menu item to `Progress on this device`. Put the storage boundary in the teacher guide.

### P1.11 Lesson library copy calls the world more complete than it is

**Where**

`More Tools` > `Lessons`.

**What I saw**

The library says each lesson has:

> a real simulated world

The reproduced lesson runs do not use the same visible and graded world.

**Why it fails**

The phrase hides the most important current limitation.

**Minimal fix**

Use `a visual test world`. Once the visible lesson world and grader are unified, describe exactly which state is simulated.

## P2: polish

### P2.1 Internal lesson IDs are shown to pupils

**Where**

Lesson selector and current lesson heading.

**What I saw**

Labels include:

> 00c_look_first · Look Before You Move

and:

> 02_move_turn · Move and turn

**Why it fails**

The file-style IDs add visual noise and do not help the pupil.

**Minimal fix**

Hide IDs in pupil view. Keep them in Expert mode and exported records.

### P2.2 World selectors mix codes and friendly names

**Where**

World selectors.

**What I saw**

The same list mixes `CITY`, `EARTH`, and `MARS` with `Warehouse Test Zone`, `Robotics Lab - Test Bay`, and `Nepal - Himalayan Foothills`.

**Why it fails**

The list looks like internal data rather than a pupil choice.

**Minimal fix**

Use one friendly naming style, such as `Riverside City`, `Earth field`, and `Mars field`.

### P2.3 Collision copy exposes raw coordinates and has a grammar error

**Where**

Live lesson 1 result.

**What I saw**

> Collision with another robot at (0, 29).

and:

> closest obstacle 1 centimetres

**Why it fails**

Raw coordinates do not help a young pupil, and the unit grammar is incorrect.

**Minimal fix**

Say `Collision with another robot ahead` and use singular `1 centimetre`.

## Lesson-by-lesson audit

The table below records the intended hidden lesson world and the supplied starter's result in the repository's real Python lesson engine. A failing starter is not automatically a defect. It matters when the missing action is not visible or the stated objective is not checked.

| # | Lesson | Intended world state | Supplied starter result | Audit note |
| ---: | --- | --- | --- | --- |
| 1 | Drive to the Flag | Earth, no obstacles or destination object | Pass, 100 | No flag exists; distance alone passes |
| 2 | Make a Square | Earth, no obstacles | Pass, 100 | Complete answer supplied; a hexagon also passes |
| 3 | Look Before You Move | Mars, one placed obstacle | Pass, 100 | `if True` passes without sensing |
| 4 | Hello, Rover! | Earth, no obstacles | Pass, 100 | Beep and log are not assessed |
| 5 | Move and turn | Earth, sample at (4, 4) | Not yet, 80 | Starter reaches the point but omits collection; sample is absent from visible run |
| 6 | Sequence | Earth, sample at (1, 3) | Pass, 100 | Starter demonstrates the route and collection |
| 7 | Selection | Mars, sample and obstacle | Not yet, 60 | Starter does not collect; sensor use is not required by the criterion |
| 8 | Iteration with while-loops | Mars, three samples and obstacle | Not yet, 40 | Starter uses `for` while the goal requires `while` |
| 9 | Functions | Mars, four samples | Not yet, 80 | Starter defines a function but does not collect |
| 10 | Reading sensors | Underwater, one sample | Not yet, 80 | Fixed movement can pass; sensor use is not assessed |
| 11 | Pathfinding basics | Mars, sample and central obstacle | Not yet, 40 | Hard-coded route can pass without pathfinding constructs |
| 12 | Recursion | Space, no obstacles | Pass, 100 | Recursion criterion is present |
| 13 | Optimisation | Mars, three samples | Not yet, 80 | Route efficiency is not assessed |
| 14 | Decomposition | Mars, two samples | Not yet, 80 | Any single function can satisfy the structure check |
| 15 | Abstraction | Underwater, one obstacle | Not yet, 60 | `if True` can satisfy the selection check |
| 16 | Nested loops | Space, six samples | Not yet, 80 | Separate loops can pass; nesting is not assessed |
| 17 | Counting with a variable | Earth, three samples | Not yet, 60 | A counter variable is not assessed |
| 18 | Functions with parameters | Mars, three samples | Not yet, 80 | Parameters are not assessed |

## State-switch audit

| Action | Reproduced or source-backed outcome |
| --- | --- |
| Switch lesson while idle | Reproduced: the new code and terrain load; the old top status can remain |
| Return to an edited lesson | Reproduced: the edited code buffer returns |
| Return to a previously graded lesson | Reproduced: the visible verdict and explanation do not return |
| Change lesson world | Reproduced: Earth changed to Mars and back; no reason was shown |
| Old console output | Reproduced: output from every prior lesson remained |
| Switch during an active run | Source-review risk only: `loadLesson` does not visibly abort the old generator; browser reproduction not completed |
| Switch pupil | Source-review risk only: verdicts are per pupil but lesson code buffers appear device-wide; browser reproduction not completed |

## Morning acceptance checks

The morning product fix should not be accepted until all of these are reproduced in a clean browser origin:

1. Onboard a Rover and click `Run this test`. The visible robot moves, status changes, and the result appears on the same screen.
2. Run `starter.py` in Riverside City. The robot starts without overlapping another agent and drives more than 0 m.
3. Run lesson 1. A visible collision can never produce a no-collision tick or `100/100`.
4. Run lesson 5. The visible world contains the sample used by grading, and the visible trace alone decides the verdict.
5. Switch from lesson 5 to lesson 4 and back. Code, latest verdict, failed goals, and status all belong to the selected lesson.
6. Run the assessment bypass programs listed in P0.5. They must not receive `Complete` for concepts they do not demonstrate.
7. In Simple mode, the main labels are plain actions. Renderer budgets, manifests, and regression baselines are hidden.
8. Re-run `node scripts/qa_honesty.mjs` and `python -m pytest tests/unit/test_docs_match_reality.py -q`.

## Honest boundary

Kodro is a kinematic learning simulation. It can compare programs and early design choices under stated assumptions. It cannot certify a physical robot, electrical safety, mechanical fit, classroom learning, or safe deployment. The interface should say this plainly without using `Prove` or `Validate` as broader claims.
