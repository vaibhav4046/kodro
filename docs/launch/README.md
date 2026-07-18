# Kodro post-submission launch kit

Status: DRAFT ONLY. Do not publish before the dissertation is submitted and the author has reviewed every claim.

This folder contains one short product loop and draft community posts. It does not turn the MSc artefact into a certified robotics tool. The public claim remains narrow:

> Kodro is a free, offline-first early design and learning environment that runs robot programs in a disclosed kinematic simulation, produces reproducible seeded evidence, and rejects defined classes of invalid generated code.

The claim excludes physical predictive validity, electrical safety, purchasing suitability, classroom efficacy, and guaranteed frame rate.

## Five-minute demonstration

1. Open the live application and choose Design.
2. Change one part and point out how mass, capability and fidelity disclosure change.
3. Move to Prove, select a scenario, and run the current program.
4. Run the five-seed proof. Show its PASS or FAIL verdict, metrics and downloadable manifest.
5. Open Simulation limits from More Tools and state that the result is kinematic simulation evidence only.
6. Move to Build and show the provisional brief. State that a competent person must check datasheets, electrical protection and mechanical fit.
7. Optional: disconnect Ollama and show that the deterministic path still works. Reconnect it and explain that the model may advise but cannot alter a verdict.

## Release checklist

- [ ] Dissertation submitted.
- [ ] Candidate commit is tagged and CI is green on all declared operating systems.
- [ ] GitHub Pages serves the same bundle hash as the tagged source.
- [ ] The five-minute demonstration has been rehearsed against the tagged build.
- [ ] The GIF below has been regenerated from that build.
- [ ] Draft posts have been reviewed for community rules and claim accuracy.
- [ ] No post describes simulation as physical validation or safety certification.

## Product loop

The loop is captured from the real application at 1366 by 768 pixels. It shows Design, Prove and Build in order.

![Kodro Design, Prove and Build loop](kodro-loop.gif)
