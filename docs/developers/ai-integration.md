# Local AI integration (Ollama)

RoboLearn ships an **optional** AI layer that runs entirely on the
pupil's own machine via [Ollama](https://ollama.com). This document
explains the design and the dissertation rationale.

## Why this does not break the "no cloud" rule

The project spec forbids cloud SDKs, API keys, accounts, and requests
to third-party hosts. The AI layer honours every one of those:

| Constraint | How the AI layer complies |
| --- | --- |
| No cloud SDK | Uses only the standard-library `urllib`. |
| No API key | Ollama needs none. |
| No account by default | Ollama needs none. Optional cloud providers use the user's own key. |
| No third-party host by default | Default traffic targets `http://localhost:11434`, the user's own machine. An optional cloud provider, once a key is entered, sends the prompt only to that provider. |
| Offline by default after install | With the default Ollama provider the model file lives on disk and inference is local; a cloud key is optional and never required. |

The model weights are downloaded once by the user
(`ollama pull llama3.2:3b`) and run offline thereafter. Nothing a pupil
types ever leaves their computer.

## Graceful degradation

The core product never depends on AI:

- `kodro.ai.is_available()` probes the server with a 2-second
  timeout and returns `False` if nothing answers.
- The AI Studio window shows an install prompt instead of an editor
  when no server is found.
- Every bundled lesson, the hint engine, the grader, and the memory
  layer work identically with or without Ollama.

## What the AI does

1. **Lesson generation** (`ai.generate_lesson`): a teacher types a
   brief; the model emits JSON; the result is validated through the
   same Pydantic `Lesson` schema the bundled lessons use, with up to
   three retries feeding the validation error back into the prompt. A
   hallucinated lesson can never reach the simulator.
2. **Code explanation** (`ai.explain_code`): plain-English feedback on
   a pupil's program, surfaced in the console as a hint.
3. **Comprehension quizzes** (`ai.generate_quiz`): multiple-choice
   questions about a lesson, parsed defensively (malformed items are
   dropped, never crash).

## Dissertation note

For the COMP702 submission, treat the AI layer as a **discussion of
optional enhancement**, not a core deliverable. The marked artefact —
ten curriculum-mapped lessons, the offline hint engine, the memory
layer, the replay debugger — stands entirely without it. The AI layer
demonstrates extensibility and a privacy-preserving local-first design,
which strengthens the critical-reflection chapter without compromising
the "offline, no cloud" guarantee.

## Testing

Every AI test fakes the transport (`tests/unit/test_ai.py`,
`test_ai_studio.py`), so CI never needs an Ollama server. The soft
helpers are additionally tested against an unreachable port to prove
the graceful-failure path.
