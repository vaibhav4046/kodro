# CA2 Demo Script: the Kodro Realism Demo

A two to three minute demonstration that proves the academic objectives by
performing real actions, not by showing mocked screens. It is built into the
app as the "Demo" button (`demo.jsx`, `window.KodroDemo`); this document is the
spoken script and the rationale for each step.

Start offline, with no network and no model required. The deterministic path
runs the whole demo; a local model is optional and only enriches the wording.

## The flow

1. **Design a light rover.** Open the demo and press *Build it*. The onboarding
   agent builds a rover from the validated parts catalogue and reports its
   mass, top speed and battery, all derived from the parts. Point out that
   these are not sliders; they fall out of the build.

2. **`read_distance()` is available.** Press *Check the registry*. Because an
   ultrasonic sensor is fitted, the distance command is in the registry that
   every panel reads. Read out the available commands.

3. **Validate across five randomised seeds.** Press *Run validation*. One
   program runs five times, each with different friction, mass, sensor noise
   and obstacle placement. The aggregate reports the success rate, mean
   collisions and mean battery. Make the point that a behaviour which survives
   the spread is the one to trust, and that a low rate honestly shows a brittle
   program rather than hiding it. The report is saved to SQLite.

4. **Remove the ultrasonic sensor.** Press *Remove it and ask*. The build now
   has no range sensor, and the registry refuses `read_distance()` with a
   readable reason. This is exactly what the grounded assistant does: it will
   not write code for a part the robot does not carry. This is the safety
   argument made visible.

5. **Refit the sensor and save the skill.** Press *Refit, save, reflect*. With
   the sensor back, keep the working program as a named skill
   (`avoid_obstacle_ultrasonic`) and record a reflection. Nothing is retrained;
   the studio simply remembers what worked, in the local store.

6. **Reuse it on the next run.** Press *Retrieve memory*. On a related run the
   studio retrieves the saved skill and the reflection, so its help is shaped
   by the user's own verified work. This is the honest, system-level
   self-refinement the project claims, with no model weights changed.

## What it proves

- The robot specification drives the simulation (step 1).
- One command registry gates every surface (steps 2 and 4).
- Validation is randomised and reported as a spread, then persisted (step 3).
- The assistant refuses an unavailable command (step 4).
- The system refines from use without retraining (steps 5 and 6).

## Honesty notes

The demo fakes nothing. Every step calls the same code the studio uses
(`RobotLab`, `KodroCommands`, `KodroScenario`, `KodroMemory`). The validation
numbers are whatever the run produces. The whole demo works with the network
off and no model installed.
