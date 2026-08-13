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

The front page has four clear routes:

1. **Learn to code** opens the 24 guided lessons.
2. **Design a robot** opens Robot Lab and its real hobby parts.
3. **Free play** opens the coding studio without a lesson goal.
4. **Make a lesson** opens Lesson Studio for teacher-authored work.

For a first class, choose **Learn to code**. The front page does not ask for a
pupil name, age band, key stage or terrain.

## Prepare a 45-minute lesson

1. Allow 5 minutes to open `More Tools` > `Lessons` and choose a mission.
2. Use 5 minutes to demonstrate the lesson goal, code editor, and `Run`.
3. Give pupils 20 minutes to edit, run, read the feedback, and try again.
4. Use 10 minutes for pairs to compare one change and its result.
5. Use the final 5 minutes for a recap. Open `More Tools` >
   `Teacher progress` to review practice saved on that device.

Settings > `Studio or Classroom mode` > `Classroom` opens the classroom
view. In Classroom mode, Settings also contains `Export progress report`.

## What a lesson result means

In the browser (the hosted site and any copy of `site/`), a lesson is graded on
the run you just watched. The lesson's samples and obstacles are the ones on
screen, the sensors read them, and a collision you see is counted, so the
verdict and the animation describe the same run.

The installed desktop app is the exception, and says so on screen: there the
Python engine re-runs the program to grade it, because that is where the pupil
record and the adaptive hints live. The criteria and the wording are identical;
the run being measured is a second one.

Scores are practice feedback rather than assessment evidence: they say whether
a program met the lesson's stated goals, not what a pupil understands.

## When a pupil is stuck

Every lesson has a bank of hints, revealed one at a time when the pupil asks.
Once those run out, a "Still stuck? Show me one way to do it" button appears and
shows one worked answer, folded until they ask for it, with a button that puts
it in the editor so they can run it line by line.

The answers are not written loosely. Every one of them is run through both
marking engines by an automated test on every change, and has to score 100 out
of 100, stay inside the constructs that lesson has taught, and fit the line
budget the pupil is given. A lesson whose own answer does not pass will not
ship. That check is also how we know each lesson is finishable at all.

Reading a worked example is a normal way to learn to program. Being stuck with
no way forward is how people stop.

## Making your own lessons

More Tools, then "Make a lesson", opens the Lesson Studio. You draw the arena by
clicking (move the start, add flags, add rocks), choose what counts as finished,
and write the starter program and one answer that works.

You cannot save a lesson until your own answer passes it. The Check button runs
that answer through the same marker your pupils will face and shows exactly what
failed. This is the same standard the twenty-four built-in lessons are held to, and
it exists because a lesson nobody can finish sends a child round in circles.

A saved lesson sits in the lesson library beside the built-in ones, marked
"Made here" so nobody confuses it with the shipped curriculum. It is graded by
the identical code: the same goals, the same wording, the same scores.

"Save to a file" writes a `.kodrolesson` file you can email to a colleague or
put on a shared drive. They open it with "Open a lesson file". Nothing goes
through a server and no account is involved.

Lessons you make are stored in the browser on that device, like everything else.
Export anything you want to keep.

## Storage and AI

Lesson practice and teacher progress are saved in the current browser on
the current device. They are not a predicted grade and are not combined
across pupil devices.

Core design, coding, simulation, and lessons do not require AI. Local
Ollama requests stay on the same computer. If a user deliberately selects
a cloud provider, prompts are sent to that provider.

## Related pages

- [Five-minute first lesson card](first-lesson-card.md)
- [Scheme of work](scheme-of-work.md)
- [Printable Block A worksheet](worksheet-block-a-first-programs.md)
- [Printable Block B worksheet](worksheet-block-b-routes-decisions.md)
- [Printable Block C worksheet](worksheet-block-c-control-sensing.md)
- [Printable Block D worksheet](worksheet-block-d-general-solutions.md)
- [Teacher answer key](answer-key.md)
- [Curriculum mapping](curriculum-mapping.md)
- [Classroom setup](classroom-setup.md)
- [Known limitations](../known-limitations.md)
