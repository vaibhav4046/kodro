# CA2 Q&A preparation

Questions a marker is likely to ask, with the honest answer. Where the honest
answer is a weakness, it is written as a weakness. A rehearsed defence of a
claim the evidence does not support is worse than a straight admission, because
the follow-up question always arrives.

Answers are short on purpose. Say the short version, then stop and let them ask
for more.

---

**"Why not just use Gazebo or Webots?"**

Because they solve a different problem. They are physics-accurate simulators for
people who already have a robotics environment, a machine that can run them, and
the time to learn them. Kodro is for a Key Stage 2 classroom with no install
rights and no network. It is not competing on fidelity and it would lose. It
competes on the cost of getting a pupil from nothing to a graded run.

---

**"How accurate is the physics?"**

Not accurate enough to design hardware from, and the product says so. It is a
kinematic motion model shared between the web and desktop runtimes, with the
fidelity boundaries disclosed in the interface rather than buried in
documentation. Nothing in it has been checked against a physical robot, because
no robot was built.

---

**"Did you test it with teachers or pupils?"**

No. That is the single biggest gap in the work and I am not going to dress it up.
There is a synthetic-persona harness which is a design aid, not a study: it has
no participants, no ethics approval, and no external validity. The first thing a
term of classroom access would buy is the measurement that is missing.

---

**"You quote ninety percent coverage. Coverage of what?"**

Lines and branches of the Python package, under a branch-aware measurement,
against an eighty-five percent gate. It says the test suite reaches most of the
code. It says nothing about whether the product is useful or usable, and the
artefact states that in those words. It is also a floor rather than a ceiling:
on this host the harness drops the coverage contribution of the node-subprocess
tests while still running them, so the true figure is at least what is reported.

---

**"One test skips. Why?"**

The graphics toolkit cannot open a display on this machine. The test is a
studio-availability check that needs a live window. It runs and passes where a
display exists. Reporting it as a skip rather than folding it into the pass count
is deliberate.

---

**"What is actually novel here?"**

Three things, and I would not claim more. First, the same lesson, world, grader
and motion model drive both a desktop application and a browser application, and
there is a parity test that fails if they diverge. Second, grading works from the
trace of the run the user just watched, not from a separate hidden execution, so
the verdict and the demonstration cannot disagree. Third, the whole thing is
addressable by a coding agent over MCP locally, which is what lets a teacher
generate and check material without a cloud account.

---

**"Why offline? Every school has internet."**

Not reliably, and not with install rights on the machines pupils actually use.
Offline also removes the account, the data-protection conversation, and the
per-seat cost, which are the three things that stop tools like this getting past
a school's IT policy. It is a constraint that turned out to be a feature.

---

**"Voice control. Where does the audio go?"**

The path I demonstrated runs locally: about one and a half seconds to load the
model, under a second per command, peak memory under four hundred megabytes, and
a quarter of words wrong on a ten-clip benchmark. That word error rate is why it
is scoped to a fixed command vocabulary and not offered as dictation. There is a
second path, the browser's own dictation API, which does send audio to Google.
It is off by default, it is opt-in, and the notice is in the product. I would not
claim the product is fully offline without naming that exception.

---

**"Why does voice not just click the buttons?"**

Because DOM-click automation breaks the moment the interface changes and it
gives no record of what happened. Speech becomes a transcript, the transcript
becomes a typed intent, the intent runs the same action a keyboard would. Spoken
and typed input parse identically because they use the same parser, high-impact
actions require a confirmation, and stop always takes priority.

---

**"Why an MCP server? Is that not a gimmick?"**

It is the answer to teacher workload. Authoring a lesson, checking a pupil's
program, or validating a robot specification are the things that take time, and
they are exactly the things an agent can do if it can reach the real grader
rather than guessing. The server exposes eight tools and twenty-five resources
over local stdio, with strict schemas, bounded runs, no shell execution and no
unrestricted file access. Invalid input is refused by name rather than silently
defaulted.

---

**"Can several pupils use it at once? Can a teacher see a class?"**

There is a teacher view over locally stored progress. There is no multi-user
server, no accounts, and no cloud. That was a deliberate scope decision and it is
on the frozen list rather than the roadmap for this release.

---

**"What is the weakest part of the work?"**

The absence of human evaluation, followed by the physics fidelity, followed by
the fact that a quarter of spoken words come back wrong. In that order. All three
are stated in the dissertation rather than left for a marker to find.

---

**"How much of this was written with AI assistance?"**

Substantially. The disclosure is in the dissertation, it names the tools, and it
was written to the university's requirement rather than around it. The claims in
the video are all traceable to artefacts in the repository that can be
regenerated, which is the check that matters: the code either passes its gates or
it does not, regardless of who typed it.

---

**"Your test numbers. How do I know they are real?"**

The artefact records the commit, the working-tree state, and the counts read
from the run's own machine-readable output rather than typed in by hand. It was
taken on a clean tree, so it reproduces from a checkout of that commit. There is
also a gate whose only job is to fail when the product claims something the
evidence does not support.

---

**"What would you do differently?"**

Get it in front of a class in month two instead of month eight. Every design
decision after that point would have had evidence behind it instead of judgment,
and the one thing I cannot show you today is the one thing that would have made
the rest of it defensible.

---

## Two questions to be careful with

**Anything about the page limit or the video length.** Both are unconfirmed from
this environment. Say what is measured rather than what is assumed. See
`BRIEF_VERIFIED.md`.

**Anything inviting a comparison to a commercial product.** The answer is always
the same shape: different problem, different constraints, and here is the
boundary. Do not be drawn into claiming parity with a tool that has a physics
team behind it.
