# Facilitator task script

## Before the participant arrives

1. Confirm ethics approval is active and the materials match the approved version.
2. Prepare a clean local Kodro profile with Companion disabled and no prior run history.
3. Assign the next condition sequence and mission order from the protocol.
4. Open the correct study condition. Do not switch condition during a mission.
5. Prepare the event sheet with a pseudonymous participant code only.

## Neutral introduction

Read aloud:

> We are evaluating how the interface helps you find a fault. We are not testing
> you. Please work as you normally would and say what you are looking for if you
> feel comfortable. I cannot tell you how to fix the program. You may pause or stop
> at any time. Each mission ends after ten minutes or when the declared check passes.

## Practice task

Use a separate, functioning controller. Ask the participant to change one speed
value and run it. Explain only the controls shared by both conditions: editor, Run,
Reset and console. Do not introduce the seeded evidence controls during practice.
Discard practice measurements.

## Mission 1: Goal shortfall

- **Setup**: Earth traverse contract, rover at the declared start, supplied program
  stops before the goal marker.
- **Fault class**: Insufficient commanded distance.
- **Participant prompt**: "The rover finishes without a code error but does not
  complete the mission. Find the cause and correct the controller."
- **Acceptance**: The selected deterministic contract passes its goal, collision
  and battery criteria under all five declared seeds.
- **Console condition evidence**: Program messages and final live-run state only.
- **Evidence condition evidence**: Five-seed success count, goal metric, collisions,
  battery, regression state and downloadable manifest.

## Mission 2: Unsafe clearance

- **Setup**: City obstacle contract, supplied sensor threshold is too short for the
  commanded movement step.
- **Fault class**: Sense-then-act safety margin.
- **Participant prompt**: "The program runs, but the rover is not reliably clear of
  obstacles. Find the cause and correct the controller."
- **Acceptance**: All five declared seeds reach the goal with zero mean collisions
  and no command error.
- **Console condition evidence**: Collision or halt messages from individual runs.
- **Evidence condition evidence**: Per-seed collision, minimum clearance, success
  spread and manifest.

## Mission 3: Battery reserve

- **Setup**: Mars transit contract, supplied route contains unnecessary repeated
  movement and does not retain the declared reserve across initial-battery and
  start-delay variation.
- **Fault class**: Energy budget and redundant commands.
- **Participant prompt**: "The rover reaches the area in some runs but fails the
  mission's battery-reserve requirement. Find the cause and correct the controller."
- **Acceptance**: All five declared seeds meet distance, collision, goal-error and
  minimum-battery criteria.
- **Console condition evidence**: Battery output from individual runs.
- **Evidence condition evidence**: Mean battery use, per-seed initial battery and
  start delay, aggregate verdict and manifest.

The exact starting code and acceptance thresholds must be frozen in a versioned
mission fixture before recruitment. Run the fixture gate to confirm that each faulty
controller fails and each reference correction passes. Do not change a task after
the first participant without an approved amendment and a documented restart rule.

## Per-mission facilitator actions

1. Read the participant prompt exactly.
2. Start the timer when control is handed to the participant.
3. Count each submitted edit followed by Run or proof execution.
4. Do not answer strategy or syntax questions. You may repeat the task wording.
5. Stop at the first accepted pass or at ten minutes.
6. Record success, seconds, edits, final collisions and any protocol deviation.
7. Ask: "How confident are you that you found the cause?" from 1 to 5.
8. Ask: "Overall, how easy or difficult was this task?" from 1 to 7.

## Exit prompts

- What information did you use first?
- Was any information unclear or misleading?
- What would you remove from the screen?
- What single addition would have helped most?

Do not claim the simulator predicts real hardware. If asked, state that the tests
are kinematic simulation evidence and do not certify physical performance or safety.
