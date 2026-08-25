# KODRO hardening mission

Single source of truth for the push toward an evidence-backed engineering
release. Every number here was measured on this repository, not carried over
from an earlier document. Where something was not measured, it says so.

Status: **in progress**. See [Remaining blockers](#remaining-blockers).

## Baseline, re-measured

Measured at `8e37e26`, working tree clean.

| Property | Value | How |
| --- | --- | --- |
| Tests | 1,737 passed, 1 skipped | `python -m pytest -q` |
| Coverage | 90.76% against an 85% gate | same run |
| CI | green on windows, macos, ubuntu | GitHub Actions |
| Live site | 200 at `https://vaibhav4046.github.io/kodro/` | `curl` |
| Old Pages URL | 404 permanently | `curl`, see note below |
| TODO/FIXME/HACK in `src`, `tests`, `scripts` | 9 | `git grep` |
| Skip markers | 25, all `skipif` on Node availability | `git grep` |

No skipped test hides a failure: every marker is an environment guard for
Node.js, and CI provides Node on all three runners.

The old Pages URL cannot be restored. GitHub redirects a renamed repository's
git and web URLs but not its project Pages URL. A stub repository at the freed
slug would revive that link at the cost of breaking the git redirect, which is
the worse trade. Recorded in `reference_github_rename_pages`.

## The weakness this mission targets

Six defects were found in a single session against a suite of more than 1,600
passing tests. Every one was found by feeding the product hostile input, and
every one was invisible to the existing suite because that suite feeds
well-formed input almost exclusively.

The mission is therefore not "add more tests". It is "attack the input
surfaces, and convert each defect class into something that cannot silently
recur".

## Defect ledger

Severity uses the mission definitions: P0 data loss or security or fundamentally
wrong grading; P1 broken common workflow, serious nondeterminism, sustained
leak, severe cross-runtime disagreement.

| ID | Sev | Defect | Root cause | Why tests missed it | Fix | Regression test |
| --- | --- | --- | --- | --- | --- | --- |
| K-1 | P1 | `execute()` raised `RecursionError` from a function documented never to raise | `except SyntaxError` around `ast.parse` | suite only fed well-formed programs | widen guard | `test_unreadable_input_is_refused.py` |
| K-2 | P1 | `is_safe()` raised instead of answering | same narrow guard | same | widen guard | same |
| K-3 | P1 | Deep-nested project file crashed the desktop importer; **the browser handled the same file correctly** | `except json.JSONDecodeError` | no cross-runtime hostile-input test | widen guard | same |
| K-4 | P1 | Lesson grader raised on deep nesting, so a pupil's score depended on parser stack depth | narrow guard in `_calls_in_order`, `_source_uses` | grading tests used valid programs | widen guard | same |
| K-5 | P1 | Hint engine raised into a Run | narrow guard in `_parse` | same | widen guard | same |
| K-6 | P1 | One malformed line killed the whole MCP session instead of failing one request | `except json.JSONDecodeError` in the read loop | no malformed-line test | widen guard, answer `-32700`, keep reading | same |
| K-7 | P1 | `turn_right(nan)` turned the rover 3600 degrees, and `+Infinity` resolved to the **negative** bound so an overflowing `turn_left` turned **right** | `_clamp_finite` mapped non-finite to `low`, which is 0.0 for unsigned ranges but -3600.0 for a signed one | no non-finite numeric tests; an existing test pinned the buggy behaviour | non-finite resolves to the nearest no-op, in both runtimes | `test_rover_api_nonfinite.py`, `test_web_interpreter.py` |
| K-8 | P1 | `prove_contracts` accepted `runs: 1000000000` and started executing it, about eleven days of compute with the MCP session dead and no cancel | bounded below (`runs >= 1`) with no upper bound; the lower edge had a comment explaining it, the upper edge was never considered | no test sent a large value; the adversarial harness that found it hung for eight minutes before being killed and bisected | cap at 1000, measured from the linear ~1 ms/seed cost, and advertise `minimum`/`maximum` in the JSON schema | `test_mcp_runs_is_bounded.py` |
| K-9 | P2 | Every numeric success criterion could have its comparison inverted without any test noticing: battery, steps, distance and returns-to-base | boundary cases were never asserted; a pupil exactly on a limit is the untested case | grading tests used values comfortably inside or outside each limit, never on it | tests at the exact boundary, constructed rather than simulated | `test_criterion_boundaries.py` |

Nine defects, eight P1 and one P2, all fixed and pinned. No P0 found so far.

Defect classes now fenced structurally rather than case by case:

- **Narrow parse guards.** `test_unreadable_input_is_refused.py` scans the
  untrusted-input modules for a parse call inside a `try` whose `except` omits
  `RecursionError`. It found two sites in `web/app.py` that a manual sweep had
  missed, one of them the KRS robot-spec importer.
- **Cross-runtime numeric divergence.** The non-finite contract is now asserted
  on both `rover_api._clamp_finite` and `RoverLang.clampNum`.

## Hypotheses tested and found clean

Negative results, recorded because an untested assumption and a tested one are
not the same thing.

| Hypothesis | Result | Evidence |
| --- | --- | --- |
| Grading is nondeterministic across repeats | clean | 24 lessons x 25 repeats, plus an ordering test and the empty submission, one distinct outcome each. `test_grading_is_deterministic.py` |
| State leaks between submissions via module-level actives | clean | grading lesson Z after lesson A matches Z alone |
| Long sessions leak in the interpreter | clean | 5,000 programs, 85,000 events, 0 errors, heap 3.6 to 4.0 MB, flat across samples |
| Long sessions leak in the Python executor | clean | 1,500 runs, 0 failures, traced heap +0.06 MB, live objects 31238 to 31236 to 31236. `test_no_leak_over_a_long_session.py` |
| Listeners and timers are not cleaned up | clean | `addEventListener`/`removeEventListener` balanced in every app source: `app.jsx` 16/16, `Viewport3D` 9/9, `tweaks-panel` 8/8. The one outlier, `voice.js`, is a page-lifetime singleton |
| The saved-project importer crashes on corrupt input | clean | 39 hostile payloads, zero crashes, zero round-trip breaks |
| Size caps are declared but not enforced | clean | 200 KB program dropped with a warning; 5,000-entry list capped at 60 |
| Pupil code reaches the DOM unescaped | clean | 15 XSS payloads through the real highlighter, all inert. `test_editor_highlight_is_xss_safe.py` |

The XSS check deserves a note. `Editor.jsx` renders the syntax highlighter
through `dangerouslySetInnerHTML`, and its input is pupil-typed or imported
code. The highlighter escapes on every branch, but that was an unasserted
property of its structure. The new test extracts the real functions from source
and was validated by sabotage: removing `esc()` from the operator branch, which
handles `<`, `>` and `&`, makes it fail; removing `esc()` from the fallthrough,
which cannot receive those characters, correctly does not.

## Mutation testing on the grader

Coverage says a line ran. It does not say an assertion would notice the line
being wrong. Measured with a harness that verifies its baseline against git HEAD
before starting, after two earlier runs produced numbers measured against a
baseline an interrupted run had already rewritten. Both of those were discarded.

| Test set | Score |
| --- | --- |
| Before any mutant-killing tests | 55.7% (49 of 88) |
| After `test_grader_boundaries.py` | 78.4% (69 of 88) |
| After `test_criterion_boundaries.py` | 84.1% (74 of 88) |
| After `test_construct_detection.py` | 87.5% (77 of 88) |

Every survivor has now been classified against pristine source. The 11 that
remain are equivalent mutants, not gaps: four dataclass `frozen=True, slots=True`
decorator flips; three field defaults never reached in production, because the
aggregates are always fully populated from the trace; a filter made redundant by
the all-int-constant guard on the line above it; and two negative-step range
branches that are unreachable, because a negative literal is an `ast.UnaryOp` and
disqualifies the whole range analysis at that same guard. Flipping any of the 11
changes nothing a test could observe, so every mutant that changes behaviour is
now caught.

The three real holes the last pass found and closed were in the construct
detector: the `_is_live` catch-all that credits while/if/return/arithmetic/
logical constructs, the tuple-and-subscript assignment target, and a `_has_recursion`
`and` whose flip made the grader raise on a method-style call. Each was verified
by reintroducing the mutant and confirming the new test fails.

One survivor turned out to be unkillable for an interesting reason. The
returns-to-base tolerance is 0.4 and every shipped lesson base is a value like
1.0, and `1.0 + 0.4 - 1.0` is 0.3999999999999999 in binary floating point. No
lesson has a base from which a point at exactly the tolerance is representable,
so the `<=` to `<` flip is equivalent for the product as it ships. The test
states the intended semantics using a synthetic origin-based lesson, and carries
a guard-the-guard assertion so it cannot go vacuous if that ever changes.

## Remaining blockers

Honest list of what stands between here and a defensible 10/10.

1. **React full-app soak is not closed.** The engines are proven clean over long
   sessions. The React UI is not. A browser probe in a hidden pane produces
   throttled `setTimeout` and paused `requestAnimationFrame`, so its numbers are
   an artifact rather than a measurement.
2. **Mutation testing covers the grader only.** Every behavioural grader mutant
   is killed (87.5%, 11 equivalent). The interpreter and the simulator have not
   been measured.
3. ~~**No accessibility audit tool** has been run against the shipped build;
   structural checks only.~~ **Closed.** See [Accessibility audit](#accessibility-audit).
4. **Browser matrix is Chromium only.** *Partially closed:* the accessibility
   audit now runs on Chromium, Firefox and WebKit. The functional QA harnesses
   (`qa_ui.mjs`, `qa_web.mjs`, `qa_worlds.mjs`, `qa_performance.mjs`,
   `qa_interpreter.mjs`) are still Chromium only.
5. **No human has used the product.** Zero teachers, zero pupils.

## Accessibility audit

Real axe-core 4 against the built app, not a structural approximation. Eight
views, reached by actually clicking into them, because the landing overlay is a
modal front door and an audit that only ever sees the front door says nothing
about the product behind it. Three engines: Chromium, Firefox, WebKit.

Only normative tags are counted as violations (`wcag2a`, `wcag2aa`, `wcag21a`,
`wcag21aa`, `wcag22aa`). `best-practice` is reported separately, because calling
a best-practice finding a WCAG failure would overstate the claim in one
direction and ignoring it would understate the product in the other.

| | Before | After |
| --- | --- | --- |
| WCAG 2.2 AA violations | 2 rules, 3 nodes | 0 |
| axe best-practice | 4 rules, 12 nodes | 0 |
| views audited | 1 (the overlay) | 8 |
| engines | 1 | 3 |

What was actually wrong:

- **`target-size`** (serious, SC 2.5.8). The two arena-size inputs in the lesson
  studio rendered at 74x19 CSS px against a 24x24 minimum. The rule set a width
  and left height to the user agent, and width was never the failing dimension.
- **`nested-interactive`** (serious, SC 4.1.2). The arena map SVG carried
  `role="img"` while containing rocks, flags and a base that each have
  `role="button"`, `tabIndex=0` and a key handler. ARIA defines `img` as
  presenting its children, so focusable descendants are a spec violation.
  Measured honestly: on Chromium's accessibility tree those buttons were still
  exposed under `img`, so this was a correctness and portability defect rather
  than a confirmed break, and the fix does not depend on one engine being
  lenient.
- Four landmark findings, all best-practice: a duplicate `main` and duplicate
  `banner` while the home overlay was open, and the `sr-only` `h1` sitting
  outside every landmark on all eight views. The overlay was already
  `role="dialog" aria-modal="true"`, so a conforming screen reader ignored the
  shell behind it; the duplicates were wrong in the DOM regardless.

One finding was raised and then refuted rather than reported: WebKit emits an
uncaught page error for the localhost Ollama probe that Chromium and Firefox do
not. A three-case experiment (`.catch()`, `try`/`await`, and a deliberately
uncaught control) showed WebKit reports the failure that way **even when the
rejection is handled**, and the product does handle it. Engine reporting
behaviour, not a defect.

## Score

Not scored yet. A score before the blockers above are addressed would be a
guess presented as a measurement.

What can be said now: seven P1 defects found, fixed and pinned; no P0 found; and
eight hypotheses tested and recorded clean with reproducible evidence.

## Honest boundaries

Two categories cannot be manufactured by any amount of engineering here, and
must never be implied:

- **Classroom validation.** No teacher or pupil has used KODRO. The evaluation
  in the dissertation reports simulated personas and labels them as synthetic.
- **Physical-hardware fidelity.** KODRO is a kinematic simulator with disclosed
  fidelity tiers. It does not claim to predict a physical robot to deployment
  tolerance and must not start claiming it.

The best honest outcome of this mission is an engineering release with
classroom and hardware validation explicitly pending, which is worth more than
a dishonest claim of universal completeness.
