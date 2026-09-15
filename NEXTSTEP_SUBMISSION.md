# NextStep Hacks 2026 submission pack

## Project name

Kodro EarthProof

## Tagline

Design, prove and compare robots virtually before deciding what hardware to build.

## One-line pitch

Kodro is an offline-first robotics design and simulation studio; EarthProof, built for NextStep Hacks 2026, adds transparent environmental scenario evidence so learners and makers can compare energy, battery and user-supplied material assumptions before committing to physical prototypes.

## Inspiration

Robotics education has a physical barrier: students often need motors, batteries, sensors and a working build before they know whether an idea behaves the way they expect. That costs money and can turn failed iterations into unused components and wasted material. Kodro already explored a virtual-first Design -> Prove -> Build workflow. For Earth Forward, I wanted to answer a harder question without greenwashing: can the sustainability reasoning behind a build decision be made inspectable too?

## What it does

Kodro lets a learner or maker design a robot, program it, run it in a visual world and replay deterministic seeded proof contracts before deciding what to build. Core paths work without an account or mandatory network call.

EarthProof adds a second evidence layer. It accepts low / central / high scenario inputs and calculates operating-energy and battery-capacity ranges. It can compare two designs by operating energy. Material avoidance is calculated only when the user explicitly states how many prototypes are assumed avoided and provides a mass range. Carbon or embodied-impact calculations are produced only when the user supplies the factor. EarthProof ships no default carbon coefficient.

The resulting JSON records its method, metrics, claims, limitations, evidence sources and a SHA-256 fingerprint. If a carbon factor is missing, the carbon result is `null`. If a factor is supplied without a citation, the report flags that limitation.

## How I built it

Kodro's existing stack includes Python 3.12, pygame-ce, Pymunk, a browser interface using React and Three.js, a sandboxed pupil-language interpreter, deterministic proof contracts, optional local Ollama assistance and a local MCP server.

The NextStep contribution is deliberately smaller and auditable rather than a rushed redesign. `kodro.earthproof` is a pure-Python deterministic evidence engine built around non-negative low / central / high intervals. Calculations use transparent range arithmetic. Scenario files and reports are JSON so judges can inspect and reproduce every input and output. Focused tests cover valid calculations, unsupported-claim refusal, provenance warnings, invalid inputs, zero baselines, deterministic fingerprints and byte-for-byte regeneration of the committed evidence report.

## What existed before NextStep

Kodro itself predates this hackathon and is an MSc research project. Before NextStep it already had robot design, programming, kinematic simulation, seeded proof contracts, evidence manifests, lessons, local AI options, MCP support and browser/desktop delivery.

## What I built during NextStep

During NextStep Hacks 2026 I added the EarthProof evidence engine, its tests, reproducible scenario/report artifacts, factor-provenance warnings, design-to-design energy comparison, evidence fingerprinting, this submission disclosure and the Earth Forward judging audit.

I am not claiming that the pre-existing Kodro codebase was created during NextStep.

## Challenges

The hardest part was resisting an easy but misleading sustainability feature. A single green score or a hard-coded CO2 number would look impressive but would hide assumptions that vary by location, hardware and lifecycle boundary. The solution was to make unsupported claims impossible by default: no supplied factor means no emissions number, and assumed prototype avoidance stays visibly labelled as a scenario rather than a measured outcome.

## Accomplishments

- Added Earth Forward relevance without discarding Kodro's existing product identity.
- Kept the new work deterministic, offline-capable and machine-readable.
- Made uncertainty explicit with low / central / high ranges.
- Kept carbon and embodied-impact coefficients user supplied rather than silently hard-coded.
- Added provenance warnings and deterministic evidence fingerprints.
- Added tests that regenerate the committed evidence report byte-for-byte.
- Preserved the existing simulation claim boundary: virtual evidence is not physical certification.

## What I learned

Environmental software is as much about claim discipline as calculation. A technically correct multiplication can still produce a misleading result if the activity data, conversion factor, system boundary or assumption is hidden. EarthProof therefore treats provenance and limitations as part of the output rather than documentation that can be ignored.

## What's next

The next research step is not a bigger green score. It is validation: classroom and maker studies that measure whether virtual-first design actually changes the number of physical iterations, component purchases and discarded parts. Only measured outcomes should move Kodro from scenario evidence toward defensible impact claims.

## Three-minute demo script

**0:00-0:25** - Show the physical-prototyping problem and the decision to build.

**0:25-1:10** - Use existing Kodro to design a robot, run its controller and show the deterministic proof result. Say explicitly that this part predates NextStep.

**1:10-2:00** - Run `python -m kodro.earthproof docs/eval/earthproof-scenario.json` and show the range-based evidence. Point to the `null` CO2e fields and explain why that is intentional.

**2:00-2:30** - Explain the baseline-vs-candidate energy comparison and the fact that it remains an energy result, not an automatic lifecycle claim.

**2:30-3:00** - End on the Earth Forward value: test virtually first, make the build decision with more evidence, and keep every environmental assumption visible.

## Built with

Python, pygame-ce, Pymunk, React, Three.js, JavaScript, JSON, pytest, GitHub Actions, optional Ollama, Model Context Protocol.

## Submission checklist

- Use the project name and tagline above consistently.
- Include `NEXTSTEP_2026.md` as the technical/audit deep link.
- Include the GitHub pull request showing the dated hackathon contribution.
- Include the live Kodro application link.
- Keep the demo between 3 and 5 minutes.
- State the before/during disclosure in the Devpost description.
- Never present the illustrative scenario as measured user impact.
