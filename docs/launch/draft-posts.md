# Draft community posts

Status: DRAFT ONLY. These posts have not been published.

## ROS Discourse draft

### Title

Kodro: an offline-first disclosed-fidelity robot design and learning environment

### Body

I built Kodro for an MSc project after repeatedly seeing the same early-stage barrier: a learner or maker wants to test an idea before buying hardware, but established robotics simulators can be intimidating and the output of a language model can look more trustworthy than it is.

Kodro uses a small programming surface, a catalogue or measured robot specification, a client-side 3D world, and an optional local Ollama assistant. Deterministic validation retains authority. Four declarative contracts run over controlled seeds and emit a canonical manifest with code, engine, conditions, metrics and verdict. Repeating a seed is checked for byte-identical output.

This is a kinematic early-design tool, not a digital twin, ROS replacement, hardware safety check or deployment validator. I would value technical criticism of the contract format, capability gating and the proposed path to a higher-fidelity simulator bridge.

Repository: [add repository link after submission]

Live build: [add tagged build link after submission]

## r/robotics draft

### Title

I built a free offline robot proving ground for learners and cash-limited makers

### Body

Kodro lets you assemble or import a robot specification, write a small Python-like program, and test it in a disclosed kinematic simulation before buying parts. The workflow is deliberately simple: Design, Prove, Build.

The interesting part is evidence rather than visual polish. A five-seed proof produces an exportable manifest, regression comparison and a deterministic PASS or FAIL. An optional local Ollama model can explain or draft code, but it cannot change the verdict. Invalid generated commands are withheld when they exceed the active build's capabilities.

Limits: it does not certify real-world behaviour, electrical safety, purchasing choices or a universal frame rate. The current human evaluation is an ethics-pending pilot protocol, so I am not claiming usability or learning efficacy.

I would especially welcome reproducible bug reports and feedback on the evidence view.

Links: [add after submission]

## Hacker News draft

### Title

Show HN: Kodro, an offline-first robot design tool with reproducible simulation evidence

### Body

Kodro is an MSc project for people who want to test a robot idea without first buying a kit or paying for a cloud service. It combines a measured or catalogue robot specification, a restricted programming surface, a lightweight 3D simulation and an optional local Ollama assistant.

The main design rule is that generated prose never owns truth. Deterministic code validates capabilities and scores four declarative contracts over controlled seeds. A run emits a canonical manifest and the same source, contract and seed must reproduce byte for byte. A deliberately broken controller fails in CI.

The model is kinematic and the result is not physical validation or safety certification. The build path produces a provisional requirements brief, not wiring or purchasing advice.

Repository and live demo: [add after submission]
