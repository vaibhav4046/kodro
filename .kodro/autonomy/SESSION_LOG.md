# Kodro session log (milestones only)

- e1df641 baseline (release packaging + acceptance + conftest).
- 5d1f2ce 5 demo bugs. 2b3a4ab durable Vibe chat. 5069a85 memory graph.
- df08e30 chat-builds-world. 157950a round-2 (direction/motion + 12 audited bugs).
- a159e24 light-theme HUD readability + docs/CODEX_HANDOFF.md.
- 303077b Ollama auto-start+warm on desktop launch. e801511 mypy-posix fix.
- (this session) .kodro/autonomy/ handoff area created; judge+scout pass running.
- e679bb1 autonomy handoff area. 61d019b doc-honesty (scout: docs undersold code).
- c6375bc adversarial-judge round: F1 interpreter alloc cap, F2 list-repeat parity,
  F3 README telemetry claim, F4 sandbox bignum-bomb + honest timeout doc, F5 vacuous
  lesson-10 goal. qa_interpreter 163, pytest 1040, CI green 3 OSes, deployed, live 200.
  F6 (dead TweaksPanel) deferred P3. Local qa_ui/qa_worlds flaked on chrome-spawn
  ETIMEDOUT (thermal load after hours of builds) -- CI gates authoritative.
- 4514112 product-direction release: Design -> Prove -> Build shell, simplified
  editor/design/prove controls, deterministic hosted Build brief, actionable
  Companion modes, product-direction research, and cross-thread Store cleanup.
- 93fec95 CI portability correction: removed an optional pytest plugin setting
  that strict CI could not recognise. CI 29537982283 green on all 3 OSes; Pages
  29538259855 green; public bundle and CSS hashes exactly match committed assets.
  Exhaustive local headless UI harness remains disclosed as timed out on the
  degraded SwiftShader host, not passed.
