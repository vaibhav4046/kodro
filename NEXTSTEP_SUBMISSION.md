# NextStep Hacks 2026 submission pack

## Project name

Kodro EarthProof

## Tagline

Evidence before hardware: design, prove and compare a robot before deciding what to build.

## One-line pitch

Kodro EarthProof is a virtual-first robotics workflow that moves early failure into deterministic simulation, then makes the energy, battery and material assumptions behind the physical-build decision inspectable instead of hiding them behind a green score.

## The problem

Robotics education and early prototyping have a waste problem that starts before the bin. Learners and makers can buy motors, batteries, sensors and structural parts before they know whether a design behaves as intended. A failed iteration can mean another build, another battery cycle, more material, more cost and more inaccessible learning for students who cannot buy hardware repeatedly.

The environmental question is not simply "how green is this robot?" It is: **can we move more design failure into software, and can we make the sustainability assumptions behind the eventual build decision auditable?**

## What it does

Kodro already lets a learner or maker design a robot, program it, run it in a visual world and replay deterministic seeded proof contracts before deciding what to build. AI may assist, but it does not own proof verdicts.

EarthProof is the new NextStep layer. It accepts low / central / high scenario inputs, calculates operating-energy and battery-capacity ranges, and can compare a candidate robot with an explicit baseline. If a user states an assumed number of avoided prototypes and a material-mass range, EarthProof can calculate that scenario too.

EarthProof deliberately ships **no default grid-carbon or embodied-impact coefficient**. No supplied factor means no CO2e claim. A supplied environmental factor without a source is flagged. Every report records its assumptions, limitations and a SHA-256 evidence fingerprint.

The result is one coherent decision loop:

**Design -> Simulate -> Prove -> EarthProof -> Build**

## Why this is Earth Forward

The goal is not to claim simulation magically saves the planet. The goal is to reduce avoidable physical iteration and make resource-use reasoning visible before hardware is purchased or assembled.

EarthProof addresses resource depletion and waste reduction at the prototyping decision point. It is especially relevant in robotics education, where repeated hardware purchases can create both environmental waste and an access barrier.

## How I built it

Kodro's pre-existing stack includes Python 3.12, pygame-ce, Pymunk, React, Three.js, a sandboxed pupil-language interpreter, deterministic proof contracts, optional local Ollama assistance and a local MCP server.

For NextStep I built `kodro.earthproof`, a deterministic pure-Python evidence engine using non-negative low / central / high intervals. Scenario inputs and reports are JSON so every number can be inspected and reproduced. The NextStep tests cover calculations, unsupported-claim refusal, provenance warnings, invalid inputs, zero baselines, deterministic fingerprints, cross-platform byte reproducibility and the judge-facing baseline comparison.

The comparison CLI makes the final demo reproducible in one command:

```bash
python -m kodro.earthproof docs/eval/earthproof-scenario.json \
  --baseline docs/eval/earthproof-baseline.json
```

The committed illustrative example produces a -50% central operating-energy change between the explicit baseline and candidate scenario. **That is an energy comparison only, not a carbon or lifecycle-impact claim.** The demonstration data is illustrative and must not be presented as measured user savings.

## What existed before NextStep

Kodro itself predates NextStep and is an MSc research project. Before the hackathon it already included robot design, programming, kinematic simulation, deterministic seeded proof contracts, evidence manifests, lessons, local AI options, MCP support and browser/desktop delivery.

## What I built during NextStep

During NextStep Hacks 2026 I added:

- the EarthProof environmental evidence engine;
- transparent interval-based energy and battery calculations;
- explicit scenario-only material assumptions;
- refusal to generate unsupported carbon claims;
- factor provenance warnings;
- baseline-vs-candidate energy comparison;
- a judge-facing comparison CLI;
- reproducible scenario, baseline and report artifacts;
- SHA-256 evidence fingerprints;
- dedicated EarthProof tests and cross-platform reproducibility checks;
- the Earth Forward methodology, claim-boundary audit and submission package.

I am not claiming that pre-existing Kodro was built during NextStep.

## Challenges

The hardest challenge was deciding what **not** to claim. A hard-coded CO2 number or single sustainability score would look impressive but could hide location, hardware and lifecycle assumptions. I built the opposite: unsupported claims fail closed. Carbon remains `null` without an explicit factor; prototype avoidance remains labelled as a scenario assumption; and the energy comparison refuses to call itself a carbon saving.

A second challenge was reproducibility. The report is byte-reproducible across operating systems and fingerprinted so an edited input produces different evidence.

## Accomplishments

- Turned Earth Forward from a marketing claim into a deterministic evidence layer.
- Preserved Kodro's working Design -> Prove -> Build product instead of replacing it with a hackathon mockup.
- Made the new work independently inspectable and reproducible.
- Added a baseline-vs-candidate decision moment without inventing lifecycle impact.
- Kept uncertainty explicit with low / central / high ranges.
- Made missing environmental evidence visible instead of filling gaps with assumptions.
- Verified the integrated repository across Linux, Windows and macOS before merging the first EarthProof release.

## What I learned

Environmental software is as much about claim discipline as arithmetic. A mathematically correct calculation can still be misleading if its activity data, factor provenance, system boundary or uncertainty is hidden. EarthProof therefore treats assumptions and limitations as first-class output.

I also learned that AI and sustainability evidence need the same architectural rule: assistance can be probabilistic, but the verdict presented as evidence should be deterministic and replayable.

## What's next

The next milestone is validation, not a bigger green score. I want classroom and maker studies that measure whether virtual-first design changes physical iteration count, component purchases and discarded parts. Measured outcomes can then replace scenario assumptions where evidence exists.

## Judge demo: 3 minutes 40 seconds

**0:00-0:20 | Problem**  
Show a small pile / image of motors, batteries, sensors and chassis parts. Say: "In robotics, we often spend hardware before we have evidence the design works. Kodro moves early failure into software."

**0:20-0:45 | The loop**  
Open Kodro and state the five-step loop once: **Design -> Simulate -> Prove -> EarthProof -> Build.** Explicitly say that Kodro itself predates NextStep and EarthProof is the hackathon contribution.

**0:45-1:25 | Design + simulation**  
Show the existing robot specification and controller. Run it in the 3D environment. Do not tour menus.

**1:25-1:55 | Deterministic proof**  
Show a seeded proof contract and its pass/fail evidence. State: "AI can help with code, but AI cannot change this verdict. The proof is deterministic and replayable."

**1:55-2:35 | EarthProof before/after**  
Run the comparison command. Point directly to baseline energy, candidate energy and the -50% central scenario difference. Immediately state: "This is an illustrative energy comparison, not measured carbon savings."

**2:35-3:00 | The anti-greenwashing moment**  
Point to the `null` CO2e field. Say: "Kodro does not invent the missing number. No sourced carbon factor, no carbon claim."

**3:00-3:25 | Reproducibility**  
Show the assumptions, limitations and SHA-256 fingerprint, plus the dated NextStep pull request. Explain that changing evidence changes the fingerprint.

**3:25-3:40 | Close**  
"Kodro EarthProof makes robotics more accessible and gives learners one more reason to test before they buy or build: evidence. Design it. Prove it. EarthProof it. Then build."

## Judge questions to be ready for

**Did Kodro exist before the hackathon?**  
Yes. Kodro is an MSc research project. The Devpost disclosure and dated Git history identify the EarthProof engine, tests, evidence artifacts, comparison CLI and submission audit as the NextStep work.

**Are you claiming Kodro reduces emissions by 50%?**  
No. The committed demonstration shows a -50% *central operating-energy difference between two illustrative scenarios*. It is not a carbon or lifecycle claim and is not measured user impact.

**Why not use a standard carbon factor automatically?**  
Because grid intensity, component embodied impact and lifecycle boundaries vary. EarthProof requires the factor to be supplied and makes missing provenance visible.

**Does simulation prove a real robot is safe?**  
No. Kodro's proof is kinematic simulation evidence, not physical-safety certification. Hardware still requires competent mechanical and electrical review.

**What is technically new in this hackathon contribution?**  
A deterministic environmental evidence layer that combines uncertainty ranges, explicit provenance, unsupported-claim refusal, baseline comparison, reproducible JSON and evidence fingerprints with Kodro's existing virtual-first robotics workflow.

## Built with

Python, pygame-ce, Pymunk, React, Three.js, JavaScript, JSON, pytest, GitHub Actions, optional Ollama, Model Context Protocol.

## Submission checklist

- Use **Kodro EarthProof** and the tagline above consistently.
- Put **Design -> Simulate -> Prove -> EarthProof -> Build** in the first 45 seconds.
- Include `NEXTSTEP_2026.md` as the technical deep link.
- Link the dated NextStep PRs / commits as before-vs-during evidence.
- Include the live Kodro application link.
- Keep the video under 5 minutes; target 3:40.
- State the before/during disclosure prominently in Devpost.
- Show the baseline comparison and the `null` CO2e field.
- Never present illustrative scenario numbers as measured environmental savings.
- Do not spend demo time listing every Kodro feature.
