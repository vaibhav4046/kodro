# Getting started for teachers

Kodro is a robot coding and kinematic simulation app for pupils aged 5 to
16. Pupils choose a robot, edit a program, and watch it run in a visual test
world. Kodro supports practice and early design comparison. It does not
certify a physical robot.

## Open Kodro

Choose one route:

- Browser: open <https://vaibhav4046.github.io/robolearn/>. The first load
  needs internet access. The app can then use its cached files offline.
- Cloned repository: run `python scripts/demo.py`.
- Windows release: run `Kodro-windows.exe`. If WebView2 is unavailable, use
  `robolearn-windows-tk.exe`.
- macOS release: unpack `robolearn-macos.zip`.
- Installed source checkout: run `python -m robolearn.web` for the current
  web interface in a desktop window.

## What pupils see first

The current onboarding has three steps:

1. Select `Start building`.
2. Describe a robot or choose Rover, Self-driving car, Personal robot,
   Robotic arm, or Custom build.
3. Review the `Recommended world`, then select `Enter studio`.

The hosted page does not ask for a pupil name, age band, key stage, or
terrain during onboarding.

## Prepare a 45-minute lesson

1. Allow 5 minutes to open `More Tools` > `Lessons` and choose a mission.
2. Use 5 minutes to demonstrate the lesson goal, code editor, and `Run`.
3. Give pupils 20 minutes to edit, run, read the feedback, and try again.
4. Use 10 minutes for pairs to compare one change and its result.
5. Use the final 5 minutes for a recap. Open `More Tools` >
   `Teacher progress` to review practice saved on that device.

Settings > `Studio or Classroom mode` > `Classroom` opens the classroom
view. In Classroom mode, Settings also contains `Export progress report`.

## Current lesson limitation

In the build audited on 26 July 2026, the animated lesson world and the
lesson PASS or NOT YET verdict can use different world state. A visible
collision can disagree with the no-collision tick. Treat lesson scores as
practice feedback only, not assessment evidence, until the two runs are
unified.

## Storage and AI

Lesson practice and teacher progress are saved in the current browser on
the current device. They are not a predicted grade and are not combined
across pupil devices.

Core design, coding, simulation, and lessons do not require AI. Local
Ollama requests stay on the same computer. If a user deliberately selects
a cloud provider, prompts are sent to that provider.

## Related pages

- [Curriculum mapping](curriculum-mapping.md)
- [Classroom setup](classroom-setup.md)
- [Known limitations](../known-limitations.md)
