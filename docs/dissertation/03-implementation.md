# 4. Implementation

This chapter covers how the design was realised, the notable techniques, and
the engineering challenges met along the way. It is grounded in the codebase
and the [test evidence](../developers/test-evidence.md); the challenges are
drawn from the real commit history, which makes them honest material for the
critical-reflection part of the dissertation.

## 4.1 Technology choices

- **Python 3.12/3.13** — the language pupils write, so the implementation
  language matches the teaching language.
- **Pygame-CE + Pymunk** for the simulation/physics; **Pydantic v2** for
  lesson validation; **SQLite** (stdlib) for storage.
- **User interface — two front-ends over one engine.** The original UI is
  **Tkinter + ttk**; it ships with Python and renders on any machine, and it
  remains the guaranteed-offline fallback. After user-evaluation feedback
  that the Tk chrome read as dated, a second front-end was added: the
  **pywebview** desktop window rendering an offline-vendored HTML/CSS/React
  design (Edge WebView2 on Windows, WebKit/WebKitGTK elsewhere). Both
  front-ends drive the *same* engine, grader, lesson library and store — see
  §4.8 for the rationale, the bridge contract, and the dual-interpreter risk.
- **Process and quality:** `pytest` + `pytest-cov` + Hypothesis;
  `ruff` (lint + format); `mypy --strict`; PyInstaller for the desktop
  binary; GitHub Actions for CI. Conventional Commits throughout.

## 4.2 Engineering discipline

Each unit of work closed only when the full gate passed — tests with branch
coverage, lint, format check and strict typing — after which it was committed,
pushed, verified green on CI and tagged. The coverage gate ratcheted upward
as the codebase matured and settled at a minimum of 85% (actual: 92.5%). This
discipline is itself a contribution: the [decision log](../developers/decision-log.md)
and [test evidence](../developers/test-evidence.md) give a defensible audit
trail for the report.

## 4.3 Key implementation techniques

- **Trace-driven everything.** Implementing grading, hinting and replay on
  top of one `Tracer` avoided three parallel representations of "what the
  rover did". The grader consumes aggregates; the hint engine consumes the
  same events plus the grade; replay consumes the serialised form.
- **Purity at the boundaries.** The grader, hint engine, accessibility
  settings and the progress report are all written to be free of Tk and of
  wall-clock/randomness, so they unit-test deterministically without a
  display. Side-effecting wrappers (file writes, dialogs) are thin shells
  over these pure cores.
- **Animation by tweening.** Run playback walks the recorded events and
  quintic-eases the rover between states on the canvas, so the pupil sees
  smooth motion, draining battery bars and disappearing samples rather than
  an instantaneous jump.
- **Graceful degradation.** The optional local AI tutor, the sound effects
  and the achievement toasts are all best-effort: each is hard-guarded so
  that an absent Ollama server, a machine with no audio device, or a
  headless environment produces a silent no-op instead of an error.

## 4.4 Challenges and how they were solved

These are real defects found and fixed; they make strong reflection points.

- **A procedural API over a stateful engine.** Resolved with the
  module-level binding (§3.3), which also enabled headless testing.
- **The open learning loop.** An early build executed pupil code but never
  responded to it. The fix wired grading, hinting, persistence, rewards and
  a verdict banner into a single `_finish_run` step at the end of every Run.
- **A silently detached tracer.** While fixing the loop, the active tracer
  could be detached between runs, so a Run recorded *zero* events and some
  integration tests passed *vacuously*. The fix re-asserts the tracer and
  engine bindings at the start of every world reset, and the tests were
  strengthened to prove real movement (battery only drains if the rover
  actually moved).
- **CI hangs and headless GUI fragility.** A modal error dialog
  (`messagebox.showerror`) blocked forever on the headless runners, once
  burning a job to the six-hour ceiling. A per-test timeout was added so any
  hang fails fast *with a traceback*, which then pinpointed further headless
  issues: an achievement-toast `Toplevel` and the event-loop pump deadlocked
  on the macOS runner, and creating Toplevels there could segfault. The
  resolution was to make the macOS CI leg *informational* (Linux under
  `xvfb` and Windows remain hard gates), since this is a test-environment
  limitation, not a product defect.
- **Small-model AI robustness.** The optional lesson generator coerces
  near-miss enum values from small local models so generation succeeds
  without a cloud LLM.

## 4.5 Packaging and distribution

PyInstaller bundles the interpreter, Tcl/Tk, Pygame and the lesson library
into a single ~26 MB Windows executable, so deployment is one download with
no Python install. The build is reproducible from `robolearn.spec`, and each
release is tagged (`v0.x.0`).

## 4.6 Testing strategy in detail

- **Unit tests** pin every pure subsystem (API clamping, physics constants,
  sensor geometry, grader criteria, hint rules, store CRUD, the report and
  accessibility logic).
- **Property-based tests** (Hypothesis) assert invariants on the sensors
  (e.g. distances never exceed their ceiling; readings stay valid for any
  rover pose).
- **Headless integration tests** build the entire wired application and
  drive it through its callbacks, asserting the end-to-end Run → grade →
  hint → persist → reward flow — the evidence that the loop genuinely closes.

## 4.7 Representative code listings

These short excerpts illustrate the design principles in §3. The grader and
hint-rule listings are verbatim from the working source as of tag
`v0.51.0`; the pupil-API excerpt is paraphrased for brevity (the real
function adds the warning log). *Add one screenshot of the running
application alongside them when you typeset the report.*

**The grader is pure** — lesson + trace + source in, a structured result
out — which is what makes it testable with synthetic traces
(`lessons/grader.py`):

```python
@dataclass(frozen=True, slots=True)
class GradeResult:
    passed: bool
    reasons: list[str]   # one pupil-facing line per failed criterion
    score: int           # 0-100

def grade(lesson: Lesson, tracer: Tracer, source: str = "") -> GradeResult:
    aggregates = _compute_aggregates(tracer.events())
    reasons: list[str] = []
    for criterion in lesson.success_criteria:
        reason = _check_criterion(criterion, aggregates, lesson, source)
        if reason is not None:
            reasons.append(reason)
    score = max(0, 100 - SCORE_PENALTY_PER_FAILURE * len(reasons))
    return GradeResult(passed=not reasons, reasons=reasons, score=score)
```

**Hints are declarative rules** over a context built from the same trace
plus the grade (`memory/hint_engine.py`):

```python
HintRule(
    name="empty_submission",
    when=lambda c: c.step_count == 0 and not c.passed,
    say="Your code didn't call any rover functions. Try `move_forward(5)` to start.",
)
```

**The pupil API never raises** — every function clamps non-finite or
out-of-range input to a safe default and logs a warning, so a beginner's
slip is a gentle correction rather than a stack trace (`rover_api.py`,
paraphrased):

```python
def move_forward(distance: float) -> None:
    safe = _clamp_finite(distance, low=0.0, high=MAX_STEP, name="move_forward")
    _engine().move(safe)   # via the module-level binding
```

Together these three excerpts show the project's recurring shape: a small,
safe, procedural surface; pure decision logic over a single trace; and
declarative data (criteria, rules, lessons) rather than bespoke code per
lesson.

## 4.8 Re-platforming the UI: a web front-end over the same engine

### Motivation

The Tkinter UI met every functional and pedagogical requirement, but
formative user-evaluation (a panel of simulated personas — see §5)
consistently scored its *visual modernity* low: ttk's widget set has no
border-radius, no compositing, no GPU animation, and a mid-2000s default
aesthetic. For a tool whose audience benchmarks "good software" against
web and mobile apps, this is a genuine adoption risk, not vanity.

Rather than fight the toolkit, a second front-end was introduced built in
the medium the reference design was authored in — HTML/CSS/React — while
preserving the project's hard constraints (100 % offline, no cloud, no
accounts, no paid services) and its existing, well-tested Python engine.

### Decision record (ADR-style)

- **Context.** A polished React/CSS rover-simulator prototype existed as a
  design artefact. The Tk UI could approximate its palette but not its
  fidelity.
- **Decision.** Vendor the prototype verbatim under
  `src/robolearn/assets/web/` and render it in a **pywebview** desktop
  window (`python -m robolearn.web`). Keep Tkinter (`python -m robolearn`)
  as the fallback for machines without a WebView2/WebKit runtime.
- **Offline compliance.** React 18, ReactDOM and Babel-standalone are
  vendored as local minified files; the three webfonts (Cormorant Garamond,
  Inter Tight, JetBrains Mono — 14 TTFs) are downloaded once at build time
  and referenced by a rewritten `vendor/fonts.css`. `index.html` loads
  **only** local assets; a runtime audit confirms no non-localhost request
  on the hot path. The sole networked module remains the optional local
  Ollama tutor (`localhost:11434`), unchanged.
- **Bridge.** `robolearn.web.app.BridgeAPI` is exposed to JavaScript as
  `window.pywebview.api.*` and wrapped by `assets/web/bridge.js` as
  `window.RoboLearn.*`. On a graded run the React app calls
  `submitAttempt(lessonId, source)`, and the **Python** side rebuilds the
  lesson world, records a `Tracer`, executes the source in the existing
  sandbox (`runtime.executor`), grades it against the lesson's
  `success_criteria` (`lessons.grader`), resolves a hint
  (`memory.hint_engine`) and persists the submission (`memory.store`) —
  i.e. the design is *only* the view; the trace-driven engine remains the
  single source of truth. The contract is locked by `tests/unit/
  test_web_bridge.py` (lesson listing, grade-and-persist, runtime-error
  path, unknown-lesson, hint shape).

### Known risk: the dual interpreter

The vendored design ships its own small JavaScript interpreter
(`interpreter.js`) for instant in-browser animation, whose surface
(`rover.forward()`) differs from the Python pupil API (`move_forward()`).
This is a deliberate, documented trade-off: the JS interpreter gives
zero-latency visual feedback, while **grading, persistence and hints run
exclusively through the canonical Python engine** via the bridge, so the
assessment of correctness is never delegated to the browser. The planned
convergence (future work) is to replace `interpreter.js` with a thin RPC
that streams real `Tracer` events from Python and animates from them,
eliminating the second interpreter and guaranteeing semantic parity.

### Packaging note

The web front-end requires a system WebView runtime: **Edge WebView2** on
Windows (pre-installed on Windows 11; a bootstrapper ships for Windows 10),
**WKWebView** on macOS (system framework), and **WebKitGTK** on Linux
(`gir1.2-webkit2-4.1`). When absent, the application degrades to the
Tkinter front-end with no loss of function. `pywebview>=5.4` is pinned in
`pyproject.toml`, and `assets/web/**` is force-included in the wheel.
