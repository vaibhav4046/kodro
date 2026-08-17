# CA2 script

Master runtime 9:40, built to fit a 10 minute cap. Three expansion blocks are
marked `[EXPAND-n]`; dropping all three in takes the runtime to 13:30 for a 15
minute cap. Which cap applies is not settled, see `BRIEF_VERIFIED.md`.

Every number spoken here has a row in `CLAIM_LEDGER.md`. If a line is changed,
change the ledger too or cut the number.

Until 15 August the expansion blocks were stage directions with no narration
written, and this header still offered the longer cut as if it were a thing you
could record. It was 290 seconds of an assessed video with nothing written to
say, in a file whose next sentence is the rule above. Taking that cut would have
meant improvising the exact minutes the ledger exists to prevent improvising.
All of them are now written out, and verifying them against the product first
cost three of them a claim: see the notes under EXPAND-1, EXPAND-2, and the MCP
finale, which is where EXPAND-3 ended up.

Spoken text is in quotes. Everything else is a stage direction.

---

## 0:00 to 0:35, cold open (35s)

Screen: the animated title card is the first frame of the video. Nothing
precedes it, no slate, no black. It runs for the first twelve seconds and then
cuts straight to the Kodro hub, already open, nothing loading. The card is
`intro/renders/kodro-intro.mp4` and it is exactly 12.000000s, so the hub appears
at 0:12 and the narration runs across the cut. This direction said "the Kodro
hub" alone until 15 August and did not mention the card at all, which
contradicted `STORYBOARD.md` shot 1 and would have cost twelve seconds of
narration timing on the first take.

> "A school wants pupils to design a robot, program it, and find out whether the
> design works before anyone spends money on parts. The usual answer is a
> simulator that needs an install, a login, and a graphics card. Kodro is the
> offline version of that answer. It runs on the machine in front of you, with
> no account and no network, from Key Stage 1 to Key Stage 4."

Do not say "world class", "revolutionary", or "solves". State what it is.

---

## 0:35 to 1:00, orientation (25s)

Screen: hover the three stage links in the top bar. Design, Test, Prototype.

> "Three stages. Design the robot, test it in a world, take a concept brief to a
> prototype. Desktop app and browser app both have all three, and they share the
> lesson library, the grader and the physics model, so a pupil at home and a
> pupil in a lab get the same result."

---

## 1:00 to 2:10, flow A: design, program, run, inspect (70s)

Screen: Design stage. Pick a chassis, change one parameter that visibly matters
(wheel size or motor power). Move to Test. Type a short program. Run it.

> "I change the wheel size here. The specification updates, and so does the
> motion model, because the model reads the specification rather than a hardcoded
> constant."

Run the program. Let the rover drive. Do not talk over the first two seconds of
motion; the marker needs to see it move.

> "While it runs, the telemetry panel records distance, battery use and the
> closest obstacle. These are recorded values from this run, not a preset."

Open the telemetry panel and point at one value that changed because of the
parameter edit.

> "That number moved because the wheel changed. This is the whole point of the
> tool: change the design, see the consequence, before anything is built."

`[EXPAND-1]` +70s. Use this only if 15 minutes is confirmed.

Screen: Robot Lab. Take the ultrasonic off the build, go back to Test, and ask
the assistant for obstacle avoidance.

> "One registry decides which commands a build may use. With no ultrasonic
> fitted, distance is not in the palette, and the assistant refuses to write
> obstacle avoidance rather than generating a program around a sensor that is
> not there. It names the missing part and leaves the code alone."

Fit the sensor, make the same request, and let it succeed. Then open the
requirements check and give it a brief asking for a two kilogram payload.

> "Where the model cannot answer, it says so instead of guessing. Ask for a two
> kilogram payload and the requirement comes back unresolved, with the reason on
> screen: payload capacity is not modelled, so Kodro cannot claim this
> constraint. Runtime and battery sizing refuse on the same grounds."

Export the build and validate it over MCP.

> "The build saves as a dot krs file, plain JSON, and the MCP server validates
> that same file, reporting the mass, the wheel count and the degrees of freedom
> the simulator derives from it."

This block read "the sensor gate refusing a sensor the chassis cannot carry"
until 15 August. There is no chassis-capacity gate to film. The gate refuses a
command whose part is not fitted, `bundle.js:15221`, and `RobotLab.jsx:936` says
in the product's own words that payload capacity is not modelled. Demonstrating
a capacity refusal would have meant staging one on camera. The disclaimer is the
stronger shot anyway: a tool that names its own blind spot is worth more here
than one more thing working.

---

## 2:10 to 3:35, flow B: the classroom loop (85s)

Screen: Home, then the lesson list. Pick a Key Stage 2 lesson.

> "Twenty-four lessons ship with it. Three at Key Stage 1, four at Key Stage 2,
> nine at Key Stage 3, eight at Key Stage 4."

Open the lesson. The lesson text, the starter program and the world load
together.

> "The lesson brings its own world and its own starter program. The program on
> screen is the program that runs, and the run that just happened is the run that
> gets graded. There is no second hidden execution."

Run it. Let it finish. Grade it.

> "The verdict comes from the trace of that run. Each failed check costs twenty
> points, and the grader names which check failed and why, so a pupil gets a
> reason rather than a score."

Open the explanation. Then export the evidence.

> "The teacher keeps the evidence: the program, the world, the trace and the
> verdict, exported as one file that opens without Kodro installed."

`[EXPAND-2]` +80s. Use this only if 15 minutes is confirmed.

Screen: More tools, then Teacher progress. Opening it switches the app into
classroom mode on its own; let that happen on camera rather than setting it up
beforehand.

> "Classroom mode adds the pupil register and the teacher dashboard: a
> concept-strength heatmap, one column per concept, every cell carrying its own
> score and its own colour. This hosted version keeps one combined record for
> this browser and says so on screen; separate pupil records are a desktop
> feature. Both tables download as CSV, because a register that cannot leave the
> browser is no use to a department. Nothing is uploaded, because there is
> nowhere to upload it to."

This block said "any cell drills down to the pupil and the attempts behind it"
and "every figure comes from a database file on this machine" until 15 August.
Neither is true of the app that is in frame. `panels.jsx:280-421` renders a
summary strip, the heatmap table, a legend and two CSV buttons, and that is the
whole modal: the cells are plain `<td>` carrying a tooltip, nothing calls
`getPupilSummary`, and there are five click handlers in the component, none of
them on a cell. The drill-down is real, but it is in the legacy Tk dashboard,
`teacher_dashboard.py:183-190`, reachable only through
`src/robolearn/app.py:171`, written in full because a bare `app.py` also matches
`src/robolearn/web/app.py`, whose line 171 is an unrelated field. And in the
browser the register is not a database file: it is the localStorage key
`kodro_pupils_v1` holding one implicit learner named "This device",
`pupil-store.js`. The claim was sourced to `docs/implementation-status.md`
rather than to code, which is how it survived this long. Filming it would have
meant hunting for a click target that does not exist, live, in an assessed take.

Back to the lesson list. Point at a lesson carrying an age chip.

> "Seven of the twenty-four lessons declare a reading age. Where one is declared
> it does more than print a badge: the error explanations read it, so a six year
> old and a fifteen year old are not handed the same sentence about the same
> mistake."

Turn on the readable-text setting.

> "And one setting switches the reading surfaces to a larger hyperlegible face
> with wider letter and word spacing, across the lesson text, the code editor
> and the explanations together, without disturbing the layout around them."

---

## 3:35 to 4:35, flow C: failure, then refinement (60s)

This is the strongest sixty seconds of product in the video. Do not rush it.

Screen: open lesson `00d_fix_the_turn`. Run the given program. It fails.

> "This is a lesson that ships broken on purpose."

Point at the verdict: `✗ Not yet · 40/100`.

> "Forty out of a hundred, and the grader names all three checks it failed. The
> rover turned right instead of left, so the sequence is wrong, it covered two
> metres of the three the lesson asks for, and it drove into the rock."

Change the one word. `turn_right(90)` becomes `turn_left(90)`. Run again. Grade
again.

> "One word. Left instead of right, and all three checks clear together."

Point at `✓ Complete · 100/100`.

Three things in this block were wrong until 15 August, and this is the block
the marker is most likely to be watching closely. The verdict was written as
`80/100`. The grader returns 40: the lesson carries three success criteria, the
broken starter fails all three, and at twenty points a failure that is forty.
Eighty would mean exactly one check failed, which is not what the shipped
lesson does. The block also said "the grader says which check failed",
singular, and it named the bug as the wrong angle. The angle is ninety in both
versions. The direction is what is broken, which is what the lesson's own hint
says. Measured through the shipped grader on 15 August, driven over MCP against
the real server: 40 with three reasons, then 100 with none.

> "That loop, fail, read the reason, change one thing, verify, is the thing being
> taught. The tool exists to make that loop fast enough to be worth doing."

Remember this lesson. The finale grades the same one, from outside the product.

---

## 4:35 to 5:20, voice (45s)

Screen: the voice panel with the transcript visible.

> "Voice does not click buttons. Speech becomes a transcript, the transcript
> becomes a typed intent, and the intent runs the same action a keyboard would."

Speak a command. Show the transcript. Then type the identical text and show the
identical result.

> "Spoken and typed parse the same, because they go through the same parser.
> Every voice action leaves a transcript, so nothing happens without a record."

Say "stop". Show it taking priority.

> "Stop always wins, and the product is fully usable with voice switched off."

---

## 5:20 to 6:10, evidence (50s)

Screen: `docs/eval/test_suite.json`, then a terminal with the gate output.

> "The test suite artefact records the commit, a clean working tree, and the
> counts read from the run's own output rather than typed in by hand. One
> thousand six hundred and thirty-nine tests collect, one thousand six hundred and
> thirty-eight pass, and the skip is a desktop-toolkit startup failure on this
> machine that a fixture degrades to a skip, not a product failure. Branch-aware
> coverage is ninety point nine percent against an eighty-five percent gate."

Stop at that sentence on the skip. Two things in this block were wrong until 15
August. It said "one thousand six hundred and twenty-six" collecting and
"twenty-five" passing, and no other document says that: the artefact, the ledger,
the checklist, the Q&A and four places in the dissertation all say 1,639 and
1,638. Spoken over a screenshot of the artefact, that pair would have been the
worst error available here. It also named a cause, "a missing display library",
and there is no missing library: the toolkit installs and reports 8.6.15, the
recorded error is that it cannot find its initialisation script, and why that is
intermittent has not been established. `CLAIM_LEDGER.md` forbids offering a cause
on camera for exactly this reason. If a marker asks, `Q_AND_A.md` has the answer
and the list of what has been ruled out.

> "The honesty gate is the one worth naming. A hundred and twenty-one checks
> whose only job is to stop the product claiming something the evidence does not
> support."

`[EXPAND-4]` +80s. Use this only if 15 minutes is confirmed.

Screen: stay on `docs/eval/test_suite.json`, moving from the counts to the
coverage figure. This insert lands at 6:10, directly on the end of the evidence
block, so it continues that sentence rather than opening a new subject.

> "That coverage number is a floor rather than a ceiling, and the reason is
> specific: on this host the harness drops the coverage contribution of the tests
> that run in a node subprocess while still running them, so the true figure is
> at least the reported one. The artefact says that in those words rather than
> rounding up."

Regenerate the lesson export and diff it against the committed file.

> "Generated files are checked against their sources rather than trusted.
> Regenerating the lesson export from the twenty-four lesson files reproduces
> the committed file byte for byte, the same sha two five six, twenty-two
> thousand two hundred and fifty-five bytes. If a lesson changed and the export
> did not, that comparison is what catches it, rather than someone noticing
> later."

This block opened "Ninety point nine percent, against a gate of eighty-five"
until 15 August. The evidence block it attaches to ends on the words "coverage
is ninety point nine percent against an eighty-five percent gate", and the
insert goes in on that block's last frame. In the longer cut the same figure
would have been spoken twice with nothing between the two. It was not wrong,
which is why the ledger never caught it: a claims ledger checks whether a number
is true, not whether it has already been said. Checking the inserts against the
master narration rather than only against the product is what found it, and it
is the only overlap of the set.

---

## 6:10 to 7:40, limits (90s)

Do not soften any of this. It is the part that earns the marks.

> "What this is not. No teacher trial and no pupil study have been run, so there
> is no usability result to report. No robot has been built, so nothing here is
> validated against hardware. It is not a replacement for Gazebo, Webots or Isaac
> Sim, and the fidelity boundaries are written into the product rather than into a
> footnote."

> "One privacy exception. The browser's built-in dictation sends the audio off
> the machine, to a service belonging to whoever made the browser rather than to
> Kodro. It is off by default, it is opt-in, and the notice is in the product and
> says exactly that, because the shipped desktop build renders in the platform
> web view and naming one company would be wrong on most of them. The local
> speech path is the one I demonstrated, and it runs on this machine: a second
> and six tenths to load, a median of nine tenths of a second per command with a
> worst case of one and a third, and a quarter of words wrong on ten synthesised
> clips. Synthesised, so that error rate is a floor and not a classroom
> measurement. It makes the path usable for a fixed command vocabulary and not
> for dictation."

Say "median" and say "synthesised". Both words are required by
`CLAIM_LEDGER.md` and this block carried neither until 15 August: it said "under
a second per command", which the benchmark's own worst case of 1.339 seconds
contradicts, and it called the clips a ten-clip benchmark without saying they
came out of a speech synthesiser rather than a microphone.

The load time read "one and a half seconds" until later the same day. The
measurement is 1.587 s, so that rounded the only figure in the sentence that
was rounded in the product's favour, while the three beside it tracked the
artefact to the digit: nine tenths for 0.885, one and a third for 1.339, a
quarter for 0.25. `CLAIM_LEDGER.md:127`, `Q_AND_A.md:109` and
`docs/eval/stt_bench.md:35` all carry 1.587, so this line was the single place
the number was said loosely, and it was said out loud. It now reads "a second
and six tenths", which rounds the other way, and it is deliberately the same
seven words so the limits block stays at 204 words. If asked on the day: that
1.587 s is itself a warm-cache figure, recorded in `stt_bench.md` under "Cold
and warm", and a genuinely cold disk would be slower.

---

## 7:40 to 8:55, MCP finale (75s)

The last demonstration, and the only one where something other than a human
drives the product. Everything before this was Kodro being used. This is Kodro
being used by an agent that was not written for it.

Screen: Claude Code in a terminal, full frame, 16 pt minimum, inside the
repository. `.mcp.json` is committed at the project root, so the server is
already configured; the client launches it. Show the tool-call lines as they
appear. Do not scroll past them to get to the prose.

It has to be the terminal client, not the claude.ai web app. Kodro's server is
local stdio, so a browser tab cannot launch it, and there is no hosted endpoint
to point at. Say "on this machine" and the question does not come up. Do not
imply the web app is doing this. `MCP_DEMO_PROMPT.md` has the exact prompt.

> "Last one. Kodro also exposes itself to a coding agent over MCP, on this
> machine, over standard input and output. This is a real client, and it is
> launching the server itself."

Type the prompt. Let the handshake land.

> "Eight tools, twenty-five resources, counted off the handshake rather than off
> a README. Watch the tool calls rather than the prose: every number after this
> came back from the server."

The agent finds the lesson, reads it without the worked solution, runs the
starter, grades it.

> "Same lesson you just watched me fix, graded from outside the product. Forty
> out of a hundred, the same three reasons. It changes one word and gets a
> hundred."

Then the refusals. This is the part worth the seconds.

> "And the failures. A program that breaks the sandbox scores zero, not partial
> marks for the checks it never reached. A run count of zero is refused instead
> of quietly becoming the default. A misspelt lesson id comes back as an error
> naming the near miss. A tool that silently accepts a wrong argument is worse
> than one that fails, because the agent then reasons about the answer to a
> different question."

If the client will not connect on the day, fall back to `python scripts/smoke_mcp.py`
and change one sentence: say "this is the server driven by a test harness rather
than by an agent, because the client would not connect". Then carry on. Do not
say "a real client" over a harness. Nothing else in the block changes; the same
numbers come out of the same server.

This block used to sit at 4:45, between flow C and voice, at 60 seconds, with a
60 second EXPAND-3 behind it. It was moved here on 17 August and the expansion
was folded into it, which is why the expansion numbering now skips 3. The
argument for the old position was that MCP is a technical aside and the video
should end on the product. The argument that won is that the video ends on the
limits and the close either way, and putting MCP last makes it the last thing
demonstrated rather than a detour on the way to the voice panel. It also lets
flow C hand off to it directly: the finale grades the same lesson the pupil just
fixed, which is a stronger claim than either block makes alone, and it is only
available if the two are adjacent in that order.

The sandbox-scores-zero line is new on 17 August and it is new because the
product was wrong until that day. `grade_program` was returning 60 out of 100
for a program rejected at line 1: the grader is pure over the trace, an empty
trace satisfies a "no collisions" criterion for free, and three criteria minus
two failures at twenty points each is sixty. Every other surface already
returned zero. The fix is in `runtime/session.py` with two regression tests, and
the figure spoken above was read off the wire after it. Do not record this beat
against a build from before that commit.

---

## 8:55 to 9:40, close (45s)

> "Who it is for: a Computing teacher with no lab budget, no reliable network and
> a class that needs to see cause and effect. Who it is not for: anyone who needs
> physical accuracy, a certified wiring plan, or a multi-user cloud platform.
> Those are different products and pretending otherwise would waste your time and
> mine."

> "The next step is measurement with real pupils, which is exactly the thing that
> has not been done, and it is the first thing I would do with a term of access to
> a classroom."

End on a static frame of the hub. No music sting, and no second run of the logo
animation: it is the first frame of the video and it is not the last.

---

## Delivery notes

- Do not read this word for word. Say it. Rehearse until the numbers are
  automatic, because the numbers are the part that must not be improvised.
- If something breaks on camera, say what broke and continue. A recovered
  failure reads better than an obvious cut.
- Silence during motion is deliberate. Let the rover drive.
- Plain speech, not written English read aloud. Short sentences. If a line does
  not survive being said out loud once, rewrite it rather than practising it.
- The master cut is 1,034 spoken words, from the 86 quoted lines outside the
  `[EXPAND-n]` blocks, counted on 17 August. The file holds 122 quoted lines in
  total; the other 36 are the 407 words of expansion narration, timed separately
  below. Those figures read 953, 79, 124 and 514 before the 17 August
  restructure, and 122, 43 and 501 before 15 August: they were correct when
  written and went stale within hours both times. Recount rather than trusting
  this figure after any edit to a `>` line, and use a counter that excludes the
  expansion blocks: they are quoted lines sitting inside the `##` blocks, so a
  naive count charges their words to a span in which nobody speaks them.
  Across 580 seconds that is 106 words a minute, under conversational pace, and
  the gap is not slack in the script: it is the rover driving, the terminal
  scrolling and the verdict landing. Do not fill it. If a take runs long, cut
  from the orientation block first and the limits block last.

- The aggregate is the wrong number to trust on its own, and trusting it once
  hid a block that could not be delivered. Per block, as the file now stands:

  | block | span | words | wpm |
  |---|---|---|---|
  | cold open | 35s | 70 | 120 |
  | orientation | 25s | 53 | 127 |
  | flow A | 70s | 75 | 64 |
  | flow B | 85s | 120 | 85 |
  | flow C | 60s | 92 | 92 |
  | voice | 45s | 63 | 84 |
  | evidence | 50s | 103 | 124 |
  | limits | 90s | 204 | 136 |
  | MCP finale | 75s | 163 | 130 |
  | close | 45s | 91 | 121 |

  No block sits above 136 words a minute. That ceiling was set on 15 August,
  when the limits block was found asking for 204 words in 60 seconds, which is
  not a pace, it is a disclaimer read at auction. The average had been hiding
  it: flow A runs at 64 because the rover is driving through it, and that was
  holding the mean down to 99.

- Restructured 17 August 2026. The MCP block moved from 4:45 to the finale at
  7:40 and grew from 60s to 75s by absorbing EXPAND-3. Three blocks paid for it
  inside the same 9:40 master runtime, so nothing downstream of the cap changes:
  orientation 30s to 25s, flow B 90s to 85s, close 50s to 45s. The orientation
  narration was cut from 59 words to 53 in the same edit, because 59 words in
  25 seconds is 142 a minute and would have broken the ceiling above. Flow C
  gained a one-line handoff to the finale, 92 words to 103. `STORYBOARD.md` and
  `CAPTURE_MANIFEST.md` carry the same change and every shot number after the
  old MCP position moved with it.

- Re-run the arithmetic rather than eyeballing it. The block spans must be
  contiguous, must sum to 580, and no block should need more than about 140 wpm.
  The three `[EXPAND-n]` blocks add 70, 80 and 80 seconds, which is 230, and
  580 plus 230 is 810, the 13:30 quoted at the top of this file.

- The expansions carry narration and were paced the same way:

  | block | span | words | wpm |
  |---|---|---|---|
  | EXPAND-1 | 70s | 131 | 112 |
  | EXPAND-2 | 80s | 159 | 119 |
  | EXPAND-4 | 80s | 117 | 88 |

  407 words across 230 seconds, 106 wpm. The master cut's blocks run from 64 to
  136 wpm, so all three sit inside that range, and the fastest of them, EXPAND-2
  at 119, is still slower than the limits block at 136. EXPAND-4 is the slowest
  at 88 because a file is regenerated on screen mid-block and the diff has to
  land. The numbering skips 3 because EXPAND-3 was folded into the MCP finale on
  17 August rather than deleted; `CLAIM_LEDGER.md` still refers to it by that
  name for claims it carried, and renumbering EXPAND-4 would have falsified
  those references to save one digit.

  None of these words existed before 15 August; all of the blocks were stage
  directions, which is the defect recorded in the header. Two of them moved
  again later the same day, after the narration was checked against the master
  rather than only against the product: EXPAND-2 rose from 139 words to 159 when
  it was rewritten around what the web dashboard actually renders, and EXPAND-4
  fell from 124 to 117 when its opening stopped restating a figure the master
  speaks in the preceding frame. Both corrections are recorded under their
  blocks.
