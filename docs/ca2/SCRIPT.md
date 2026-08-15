# CA2 script

Master runtime 9:40, built to fit a 10 minute cap. Four expansion blocks are
marked `[EXPAND-n]`; dropping all four in takes the runtime to roughly 14:30 for
a 15 minute cap. Which cap applies is not settled, see `BRIEF_VERIFIED.md`.

Every number spoken here has a row in `CLAIM_LEDGER.md`. If a line is changed,
change the ledger too or cut the number.

Spoken text is in quotes. Everything else is a stage direction.

---

## 0:00 to 0:35, cold open (35s)

Screen: the Kodro hub, already open, nothing loading.

> "A school wants pupils to design a robot, program it, and find out whether the
> design works before anyone spends money on parts. The usual answer is a
> simulator that needs an install, a login, and a graphics card. Kodro is the
> offline version of that answer. It runs on the machine in front of you, with
> no account and no network, from Key Stage 1 to Key Stage 4."

Do not say "world class", "revolutionary", or "solves". State what it is.

---

## 0:35 to 1:05, orientation (30s)

Screen: hover the three stage links in the top bar. Design, Test, Prototype.

> "Three stages. Design the robot, test it in a world, and take a concept brief
> to a prototype. The same three stages exist in the desktop app and in the
> browser app, and they share the lesson library, the grader and the physics
> model, so a pupil at home and a pupil in a lab see the same result."

---

## 1:05 to 2:35, flow A: design, program, run, inspect (90s)

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

`[EXPAND-1]` +70s. Open the robot specification, show the sensor gate refusing a
sensor the chassis cannot carry, and show the KRS file that stores it. Use this
only if 15 minutes is confirmed.

---

## 2:35 to 4:05, flow B: the classroom loop (90s)

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

`[EXPAND-2]` +80s. Open the teacher dashboard, show progress across a class,
show the reading-age chip and the accessibility mode. Use this only if 15
minutes is confirmed.

---

## 4:05 to 5:05, flow C: failure, then refinement (60s)

This is the strongest sixty seconds in the video. Do not rush it.

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

---

## 5:05 to 6:05, MCP (60s)

Screen: a terminal. Run the smoke harness so the JSON-RPC session is visible.

> "Kodro also exposes itself to a coding agent over MCP, locally, over standard
> input and output."

Show the initialize response, then tools/list.

> "The server is Kodro two point zero. Eight tools and twenty-five resources,
> counted from the running server, not from a README."

Show one successful call, then one refused call.

> "A valid call returns a structured result. A misspelled argument is refused by
> name rather than quietly defaulted, which is the failure mode that makes agent
> tooling untrustworthy."

> "That was a real stdio JSON-RPC session against the server process."

Say "real client handshake" only if a named client is on screen doing it. See
`CLAIM_LEDGER.md`.

`[EXPAND-3]` +60s. Read one resource, show the URI and MIME type coming from the
authoritative lesson source, and show the schema rejecting an out-of-range run
length. Use this only if 15 minutes is confirmed.

---

## 6:05 to 6:50, voice (45s)

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

## 6:50 to 7:40, evidence (50s)

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

`[EXPAND-4]` +80s. Show the coverage-floor disclosure and explain why the real
figure is at least this high, then regenerate the lesson export and show the
hash matching. Use this only if 15 minutes is confirmed.

---

## 7:40 to 8:40, limits (60s)

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
> speech path is the one I demonstrated, and it runs on this machine: one and a
> half seconds to load, a median of nine tenths of a second per command with a
> worst case of one and a third, and a quarter of words wrong on ten synthesised
> clips. Synthesised, so that error rate is a floor and not a classroom
> measurement. It makes the path usable for a fixed command vocabulary and not
> for dictation."

Say "median" and say "synthesised". Both words are required by
`CLAIM_LEDGER.md` and this block carried neither until 15 August: it said "under
a second per command", which the benchmark's own worst case of 1.339 seconds
contradicts, and it called the clips a ten-clip benchmark without saying they
came out of a speech synthesiser rather than a microphone.

---

## 8:40 to 9:40, close (60s)

> "Who it is for: a Computing teacher with no lab budget, no reliable network and
> a class that needs to see cause and effect. Who it is not for: anyone who needs
> physical accuracy, a certified wiring plan, or a multi-user cloud platform.
> Those are different products and pretending otherwise would waste your time and
> mine."

> "The next step is measurement with real pupils, which is exactly the thing that
> has not been done, and it is the first thing I would do with a term of access to
> a classroom."

End on a static frame of the hub. No music sting, no logo animation.

---

## Delivery notes

- Do not read this word for word. Say it. Rehearse until the numbers are
  automatic, because the numbers are the part that must not be improvised.
- If something breaks on camera, say what broke and continue. A recovered
  failure reads better than an obvious cut.
- Silence during motion is deliberate. Let the rover drive.
- Total spoken words come to 953, counted from the 79 quoted lines in this file
  on 15 August. This note used to say "roughly 1,150", which was never counted,
  and then 925, which was counted correctly at commit `2836f85` and went stale
  three commits later: `0ef8436` rewrote the failure-and-refine narration to say
  40 rather than 80 and to name all three failed checks, which added one quoted
  line and 28 words. Recount rather than trusting this figure after any edit to a
  `>` line. Across 580 seconds that is 99 words a minute, well under conversational pace,
  and the gap is not slack in the script: it is the rover driving, the terminal
  scrolling and the verdict landing. Do not fill it. If a take runs long, cut
  from the orientation block first and the limits block last.
