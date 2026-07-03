# Persona Panel: Adversarial Evaluation of Kodro v2.0

## This is a simulated evaluation, not a human study

Thirty AI personas were simulated to stress-test Kodro v2.0 from
different builder mindsets: a skeptical hardware teacher cross-checking
against datasheets, a pupil importing their first robot, a competition
builder chasing top speed, a physics tutor reading the fidelity badges
literally, and so on. Each persona was asked to try to break the tool
and to distrust every number it printed. Their reported issues were then
put through an adversarial verification pass against the shipped source,
and only defects that could be reproduced end to end against the real
code survived.

Read the method plainly before reading the results:

- **These are large language model personas, not people.** No human sat
  in front of Kodro. The personas are a structured way to surface
  plausible failure modes quickly and cheaply, nothing more.
- **This does not substitute for the human user study.** A simulated
  panel cannot measure real confusion, real learning outcomes, real
  time on task, or the things a teacher actually notices in a classroom.
  It cannot license claims about usability, accessibility, or teaching
  value. Those still require the human study described in the
  dissertation plan.
- **A simulated panel does not license a perfect score.** The right
  reading of this document is "an adversarial LLM sweep still found
  real, reproducible defects," not "the tool passed." Nothing here
  supports a 100 percent, flawless, or fully validated claim, and this
  document must never be cited as if it did.

The value of this pass is narrow and honest: it is a cheap adversarial
net that caught concrete, reproducible bugs before a human ever had to.
It caught four.

## Method

- **N personas simulated:** 30
- **Verification:** every reported issue was reproduced against the
  shipped `motion-model.js`, `specschema.js`, `RobotLab.jsx`, and
  `verify.jsx`, using an ordinary educational rover as the stress input
  (0.9 kg, 200 rpm no-load motor, 3.3 cm wheel radius, 4 x 0.35 Nm
  motors, 2200 mAh 7.4 V). Issues that could not be reproduced were
  dropped.
- **Deduplication:** many personas independently hit the same
  underlying fault (the top-speed badge). Overlapping reports were
  merged into a single confirmed defect and ranked by severity.
- **Survivors:** 4 unique confirmed defects after dedup and adversarial
  verification.

## Severity summary

| Severity | Count | Confirmed defects |
|----------|-------|-------------------|
| HIGH     | 1     | Verification report prints the clamped sim speed under a HONOURED badge with a formula that yields a different number |
| MEDIUM   | 3     | Hardcoded HONOURED top-speed badge in the live readout; no-load speed badged as achievable top speed; implausible acceleration / max-slope / runtime magnitudes |
| LOW      | 0     | none survived verification |

The one HIGH and the top-ranked MEDIUM are the same root cause on two
different surfaces (the live Robot Lab readout and the exported
verification report): a build whose real top speed falls outside the
simulable band is clamped to a different speed, and both surfaces label
that clamped number "honoured" anyway. The shipped demo fixture is tuned
to sit inside the band, so the demo never exposes it; a user importing
their own robot hits it immediately.

## Confirmed defects (prioritized, deduplicated)

- [HIGH] Verification report prints the clamped sim speed but labels its derivation with a formula that yields a different number, under a HONOURED badge
  evidence: verify.jsx:41-44 sets the 'Top speed' row value to phys.vMaxSimCmPerS (the CLAMPED sim speed) and its fidelity tier to (phys.vMaxSimCmPerS !== undefined ? 'honoured' : 'approximated') -- keyed only on presence of a physical build, never on phys.badges.topSpeed. The derivation string is the constant 'v = rpm/60 * 2*pi*r from the imported motor'. Reproduced with the same 0.9 kg / 200 rpm / 3.3 cm rover: the report row shows Value=0.94 m/s, Fidelity=HONOURED, Derivation='v = rpm/60 * 2*pi*r from the imported motor'. But rpm/60*2*pi*r = 0.69 m/s, not 0.94. The printed number was never produced by the cited formula, and the exported HTML report (the artifact a skeptical builder is told to 'keep') asserts it as HONOURED. This is a second, independent surface with the same overclaim as the live readout.
  fix: In verify.jsx use phys.badges.topSpeed for the tier, and when vMaxSimCmPerS != vMaxCmPerS either print the real motor-derived value with the formula label, or change the derivation string to disclose the clamp (e.g. 'motor-derived 0.69 m/s clamped to the 0.94 m/s simulable floor').

- [MEDIUM] Top-speed fidelity badge is hardcoded HONOURED and ignores the schema's own 'approximated' downgrade when the sim speed is clamped
  evidence: specschema.js:364-377 (deriveFromPhysical) correctly detects when a build's real top speed falls outside the simulable band, sets out.badges.topSpeed='approximated', substitutes a DIFFERENT sim speed (vMaxSimCmPerS), and pushes a warning ('...simulated FASTER at 0.94 m/s'). But the live Robot Lab readout at RobotLab.jsx:495 renders the top-speed cell with a hardcoded literal Badge('honoured') and never reads d.phys.badges.topSpeed. Reproduced end-to-end against the shipped motion-model.js + specschema.js with a completely ordinary educational rover (0.9 kg, 200 rpm no-load motor, 3.3 cm wheel radius, 4x0.35 Nm motors, 2200 mAh 7.4 V): validate() ok, deriveFromPhysical() returns vMaxCmPerS=69.1 (real 0.69 m/s), vMaxSimCmPerS=93.8 (sim 0.94 m/s), badges.topSpeed='approximated', warning 'Top speed 0.69 m/s is below the simulable floor; simulated FASTER at 0.94 m/s'. The DOM cell rendered by line 495 is <b>0.94 m/s</b> ... <span class="fid-badge fid-honoured">HONOURED</span>. So the most common real drivetrain in education (a 200-rpm TT gearmotor) is simulated 36% faster than the real hardware while the badge asserts the number is 'Honoured exactly by the simulation' (TIER_TITLE at RobotLab.jsx:302). The shipped cap.html fixture (noLoadRpm 300 x 3.25 cm = 1.02 m/s) is tuned to sit inside the band, so the demo never exposes this; a user importing their own robot hits it immediately.
  fix: At RobotLab.jsx:495 render the badge from the derived tier, e.g. Badge((d.phys && d.phys.badges && d.phys.badges.topSpeed) || 'honoured'), instead of the hardcoded Badge('honoured'), and surface d.phys.warnings for the clamp near the stat. The schema already computes the correct tier and warning; the UI just needs to consume them.

- [MEDIUM] 'Top speed' is the motor no-load free-run speed, badged HONOURED as the robot's achievable top speed
  evidence: motion-model.js:126-128 physTopSpeedCmPerS(noLoadRpm, wheelRadiusCm) = (noLoadRpm/60)*2*pi*r -- the free-running speed with zero load. The FIDELITY.honoured table (specschema.js:67-68) and the report/lab both present this as the robot's 'Top speed ... HONOURED'. A real robot under its own weight, drivetrain drag and payload never reaches no-load rpm; achievable top speed is materially lower (typically 20-40% below no-load for small geared DC motors). So even for an in-band build correctly badged 'honoured', the honoured number overstates real top speed. This is internally consistent (no clamp contradiction), which is why it ranks below the two badge-plumbing defects, but from a physics-honesty standpoint the 'HONOURED, calibrated from motor rpm and wheel radius' claim conflates no-load speed with top speed.
  fix: Either relabel the quantity as 'no-load top speed' wherever it is shown/badged, or apply a load-derated estimate and disclose the derating factor; do not badge the no-load number as the honoured achievable top speed.

- [MEDIUM] Acceleration and max-slope numbers are physically implausible; a max-slope figure is surfaced while slopes are declared not-simulated
  evidence: motion-model.js:147-151 physAccelCmPerS2 uses the STALL force held constant across the whole ramp (a=(F_stall-Crr*m*g)/m). For the standard 0.9 kg / 4x0.35 Nm / 3.3 cm rover this yields 46 m/s^2 = 4.7 g, and verify.jsx:47 reports 0-to-top in 0.02 s; even the shipped Reference Rover fixture computes 16.8 m/s^2 = 1.7 g. Real geared rovers accelerate at well under 0.5 g over ~0.3-1 s. Separately, physMaxSlopeDeg (motion-model.js:194-200) is grip-capped at atan(brakeMu)=atan(0.7)=35.0 deg, so essentially every torquey build reports exactly 35 deg; this number is shown in the Robot Lab (RobotLab.jsx:513) and verify report (verify.jsx:78-80) even though STAT_TIER.slope='notSimulated' (specschema.js:102) and FIDELITY.notSimulated states 'Slopes and terrain height (worlds are flat planes)'. Runtime is also optimistic: the same rover derives ~236 min from a 13 Wh pack because drive power at the low sim speed is ~1.8 W and the model omits motor electrical/stall losses (a real 0.9 kg rover draws ~8-25 W, ~30-90 min). These carry APPROXIMATED/NOT-SIMULATED badges so they are partially disclosed, hence MEDIUM, but the derived magnitudes are far enough from reality to mislead a builder cross-checking against datasheets.
  fix: Cap/derate acceleration to a physically plausible band (model force falloff with speed, not constant stall force), and disclose that runtime ignores motor copper/stall losses. For max slope, either stop surfacing a per-build number given slopes are not-simulated, or clearly mark it as a torque/grip static estimate independent of the (flat) sim world so it isn't read as a simulated capability.

## Honest read

The cluster of defects the panel found all point the same way: Kodro's
fidelity-badge system is genuinely well designed in the schema layer
(the code already computes the right tier, the right clamp warning, and
the right direction of error), but the UI and the exported report do not
consistently consume it, and the underlying physics is more optimistic
than a datasheet-literate builder will accept. The most damaging pattern
is a HONOURED badge sitting on top of a number the simulation did not
actually honour, on the single most common educational drivetrain, on
both the live readout and the "keep this" verification artifact. That is
a trust bug, not a cosmetic one, and it is exactly the kind of thing a
simulated panel is good at catching cheaply and a real user study is
better at judging the consequences of. None of this licenses a clean
bill of health; it is a short, verified list of things to fix, and the
right next step remains the human study, not a self-awarded score.

## Resolution (all four fixed)

Every confirmed defect was debugged and fixed after this pass, and the
offline gates were re-run to green (interpreter 156/156, UI smoke
6/6 flows and 24/24 behaviour asserts and 12/12 modals, world sweep
61/61, Python 869 passed). The fixes were deliberately honesty fixes,
not physics rewrites: the gated motion model and its golden traces were
left untouched, because the panel's finding was that the UI and the
report were not consuming the fidelity tier the schema already computes
correctly.

- **HIGH (verification report).** The top-speed row now reads
  `phys.badges.topSpeed` for its tier instead of assuming HONOURED, so a
  clamped build prints APPROXIMATED. Its derivation string no longer
  prints a formula that yields a different number: when the sim speed is
  clamped it now reads "motor no-load X m/s (v = rpm/60 * 2*pi*r),
  clamped to the Y m/s simulable band" (`verify.jsx`).
- **MEDIUM (live readout).** The Robot Lab top-speed cell now renders
  `Badge(d.phys.badges.topSpeed)` instead of a hardcoded HONOURED badge,
  and the blanket HONOURED badge on the measured-build banner header was
  removed, since a measured build is a mix of tiers and each stat now
  carries its own (`RobotLab.jsx`).
- **MEDIUM (no-load vs achievable).** The quantity is relabelled
  "top speed (no-load)" everywhere it is shown or badged, with the
  fidelity annex line stating plainly that the sim cruises at exactly
  this value but real speed under load is lower (`RobotLab.jsx`,
  `verify.jsx`, `specschema.js`).
- **MEDIUM (implausible magnitudes).** The acceleration row is relabelled
  "0 to top speed (best case)" and disclosed as a lower bound
  (stall torque held constant, no falloff, so real hardware is slower);
  the max-slope row is relabelled "max grade (static estimate)" and
  disclosed as a grip-capped constant that most torquey builds share and
  that the flat sim worlds never drive; the runtime disclosure now names
  the omitted motor copper/stall losses that make it optimistic
  (`verify.jsx`, `specschema.js`).

This closes the four confirmed defects. It does not turn the pass into a
perfect score: the fixes make the tool honest about what it was already
computing, and the human study remains the right instrument for judging
whether builders actually trust and learn from the result.

## Round 2: re-testing the fixed build

The obvious risk with a find-and-fix pass is that it converges on one
area and calls the whole product done. To guard against that, a second
panel of 28 fresh personas re-tested the already-fixed build, deliberately
aimed away from the top-speed badge and at surfaces the first panel barely
touched: a keyboard-only user, a screen-reader user, a colour-contrast
auditor, an offline-guarantee auditor, a KRS import fuzzer, an interpreter
adversary, a determinism auditor, a teardown/leak hunter, a prompt-injection
tester, a security auditor, a mobile user, a reduced-motion user, an i18n
auditor, a battery-ledger auditor, and more. Each was told that an empty
findings list was the honest and expected answer for a build that had
already had a fix pass, and every reported issue was again put through
adversarial code-verification, defaulting to not-real unless it reproduced
end to end against the source.

It did not come back empty. After verification and dedup it produced
**13 new confirmed defects** (5 HIGH, 7 MEDIUM, 1 LOW), all distinct from
round 1 and all reproduced against the shipped code. That a second pass on
a build that had just been fixed still found thirteen real defects is the
strongest single argument that this method is not a rubber stamp, and it is
also a plain reminder that a green test suite is not the same as a sound
product. The most serious were:

- **Persistent boot-brick from a corrupt project file (HIGH).** A
  hand-edited or corrupted `.kodro` whose spec carried a non-array
  `actuators`/`sensors` was persisted raw and then threw
  `TypeError: forEach is not a function` at module init on every
  subsequent reload, bricking the app until localStorage was manually
  cleared. The project loader now coerces those list fields and the
  derive path defends itself with `Array.isArray`.
- **Stacked-modal focus trap (HIGH).** The focus-trap effect keyed on a
  single "any modal open" boolean, so opening a second modal over an open
  one never moved focus into it and Tab stayed trapped in the occluded
  dialog. It now keys on each modal's own open-state.
- **NPC motion ignored prefers-reduced-motion (HIGH).** Pedestrians and
  traffic animated regardless of the setting, against WCAG 2.3.3 and the
  codebase's own reduced-motion contract. The agent simulation is now
  frozen under reduced motion, keeping the display and the collision test
  consistent.
- **Grader battery drain was speed-blind (HIGH).** The validator drained
  at a fixed nominal figure while the live run recomputes drain at the
  driven speed, so a program near the energy budget could pass validation
  and then go flat mid-move on the live run. The grader now recomputes at
  the actual speed and traction.
- **Primary CTA clipped off-screen at 375px (HIGH).** The Robot Lab
  footer did not wrap, pushing the "Build and test" button past the right
  edge with no horizontal scroll. It now wraps on small viewports.

The seven MEDIUM and one LOW findings were: an unguarded deep-recursion
`RangeError` in the interpreter (now a wrapped, line-numbered error); the
Design Check computing obstacle stopping distance from the raw no-load top
speed instead of the throttled speed the live tick drives at (a false WARN
the live run never earns); three fidelity-badge colour-contrast failures
against WCAG AA (one on-screen, two in the exported report); two non-ASCII
filename-slug collisions; and a cramped five-column archetype grid on
phones. All 13 were fixed and the offline gates re-run green (interpreter
156/156, UI 6/6 flows and 24/24 behaviour asserts and 12/12 modals, world
sweep 61/61, Python 868 passed).

Across both rounds, 58 simulated personas found and drove the fix of 17
distinct, code-verified defects. The honest read does not move: this is a
cheap, repeatable adversarial net that keeps finding real bugs, which is
exactly why it is worth running and exactly why it cannot be read as a
clean bill of health. It measures the code, not a learner. The human study
remains the right next step, and nothing in this document licenses a
perfect or fully validated score.

## Round 3: the deep sweep

Rounds 1 and 2 were almost entirely about the web front end. Round 3
pointed thirty fresh personas at the surfaces those rounds never reached:
the Python engine (executor, sandbox, scorer, rover, tracer), the two
engines cross-checked constant by constant, the desktop bridge, the AI
grounding path, the memory store, determinism, packaging, and a full
accessibility regression pass. Sixteen of the thirty lenses came back
clean; the other fourteen produced, after adversarial verification and
dedup, **16 new confirmed defects** (2 HIGH, 13 MEDIUM, 1 LOW), all
distinct from the first two rounds.

That the deep sweep found more, not fewer, is the honest and expected
result of finally testing under-tested code, and the two HIGH findings
were both real correctness bugs in the grading layer that the whole
teaching product rests on:

- **The grader counted commanded distance, not travelled distance
  (HIGH).** A rover ordered to drive five metres into a wall travels far
  less, but the grader summed the command arguments, so a program could
  pass a "travel at least three metres" lesson the rover never physically
  completed. The rover already tracked true distance; the fix carries it
  onto the trace snapshot and grades from that, with a regression test that
  pins the wall-clamped case to a fail.
- **The grader hardcoded the environment sensors (HIGH).** Gravity,
  temperature and light were fixed at Earth values in the validator, so a
  Mars or underwater or space program that branched on gravity() or
  temperature() was graded on the wrong planet. The grader now reports the
  scenario world's real environment, matching the live run.

The thirteen MEDIUM and one LOW findings spread across the areas the sweep
was built to probe: a sandbox that let a pupil allocate gigabytes with a
single oversized literal (now rejected at parse time, with the
runtime-computed case documented as a residual that needs an
out-of-process executor); three interpreter-versus-Python divergences in
string multiplication and an unseeded random() that broke reproducible
grading; a startup path that showed a raw traceback instead of the native
failure dialog when a bundled asset was corrupt; a browser-mode Ask that
promised grounded answers it could not provide; a memory import that
reported success after a partial, quota-failed save; contrast failures on
the tertiary text tokens across all eight alternate themes; two missing
accessible names; eight unguarded storage reads that could crash the app
on load; a leaked AI chat job on cancel; and three megabytes of build-only
tooling shipped inside the executable. All sixteen were fixed and the
gates re-run green.

Across three rounds, 88 simulated personas found and drove the correction
of 33 distinct, code-verified defects, and the fraction of lenses that
came back clean rose from none in round one to more than half in round
three. That trend is the closest thing to a convergence signal this method
can give, and it is still not a clean bill of health: it says the code got
more robust under an adversarial net, not that a learner is well served.
The read is unchanged. This is a bug-finding instrument, not validation;
it measures the code and not a person; and it does not license a perfect
score. The human study remains the right next step.
