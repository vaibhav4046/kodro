# Verification log: dictation recipient claim

Date 2026-08-14. Branch `agent/kodro-ca2-candidate`.

## What was wrong

`DICTATION_NOTICE` in `src/kodro/assets/web/voice.js` told the user the
recorded audio was sent to Google. Nothing in the code establishes that. The
recogniser is whatever the runtime exposes:

```js
return window.SpeechRecognition || window.webkitSpeechRecognition || null;
```

There is no browser detection anywhere in the voice layer, and the shipped
desktop surface is not Chrome. `src/kodro/web/app.py` renders the interface
in the platform web view, which is Edge WebView2 on Windows, WebKit on macOS and
WebKitGTK on Linux. So the notice named the wrong recipient on the product's own
primary surface.

The product was already vendor-neutral in the two sibling strings at
`panels.jsx:998` and `panels.jsx:1018`, both of which say "the browser speech
service". The notice was the only outlier.

> Line-number correction, 2026-08-15. Those two line numbers were right on
> 2026-08-14 and are wrong now. Commit `cacf51e` (15 August) grew a comment
> inside `TeacherModal` from three lines to seven, which pushed everything below
> it in `panels.jsx` down by four. The two strings are unchanged and now sit at
> `:1002` and `:1022`. The dated figures above are left as written, because a
> verification log records what was measured on its date; this note records the
> drift rather than hiding it.

## What the notice says now

It states the part that holds on every engine: the recording leaves the machine,
the service receiving it belongs to whoever made the browser rather than to
Kodro, Kodro can neither choose it nor observe it, and typing does the same job
with nothing sent. No company is named, because none can be identified from the
code. Naming a specific wrong recipient is a worse failure of consent than
naming none.

Chrome to Google, Edge to Microsoft and Safari to Apple were deliberately NOT
written into any shipped string or gate. None of those mappings is verifiable
from this environment, and asserting them would repeat the class of error the
fix exists to remove.

## Regression test

`scripts/qa_voice.mjs` gained five assertions in place of the one that checked
for a named recipient, including a denylist:

```js
ok(!/\b(Google|Microsoft|Apple)\b/.test(V.DICTATION_NOTICE),
  'the dictation notice names no single vendor as the recipient, since the engine decides');
```

The assertions were proven to fire by planting the old notice back into the real
source file and running the gate:

```
planted the old vendor-naming notice
--- gate against the regression ---
FAIL  the dictation notice says Kodro neither picks nor can inspect the recipient
FAIL  the dictation notice names no single vendor as the recipient, since the engine decides
FAIL  voice: 106 passed, 2 failed
EXIT=1
--- restore ---
PASS  voice: 108 passed, 0 failed
EXIT=0
```

## Gate results after the full sweep

```
PASS  voice: 108 passed, 0 failed
PASS  honesty: 121 passed, 0 failed
10 passed (406 files, 100 protected characters)          # qa_encoding
PASS  secrets: 27 passed (474 of 776 tracked files read, 13 credential rules)
bundle.js is up to date.                                  # build_web.cjs --check
7 passed in 4.66s                                         # test_web_bundle + test_web_offline
```

The Python subset run reports `FAIL Required test coverage of 85% not reached.
Total coverage: 2.00%`. That is the project coverage gate reacting to running
two files out of the suite, not a test failure. All 7 tests passed.

## Dissertation recompile

Two passes from a clean `_build`, after the privacy paragraph and the assertion
count were rewritten:

```
PASS1 EXIT=0
PASS2 EXIT=0
Output written on ..._build\Kodro_Dissertation.pdf (59 pages, 1111577 bytes).
Overfull: 0
Float too large: 0
Undefined: 0
LaTeX Warning: Citation: 0
LaTeX Warning: Reference: 0
```

Dash audit of the source: 0 em dashes, 0 en dashes, 0 LaTeX `---`. The two
remaining `--` sequences are command-line flags inside `\texttt{}`
(`--suite=` and `--repeat=3`), not punctuation.

`docs/dissertation/Kodro_Dissertation.pdf` was refreshed from that clean build so
the tracked PDF matches its source, sha256
`8f6a5022dcd6dbf98d4e8cdcfca5153a205681a5c9144a745413112aaab6fa3e`.

## Note on the build directory

The clean-build step removed `docs/dissertation/_build`, which turned out to hold
109 tracked files rather than scratch output. All 109 were restored from HEAD
immediately and verified: the only remaining modifications in that directory are
the four artefacts the recompile legitimately regenerated. Untracked build
detritus in that directory matched the `.gitignore` patterns for LaTeX logs and
is regenerable, but it cannot be proven that nothing untracked was lost, so it is
recorded here rather than claimed clean.

## Documents brought into line

`docs/ca2/SCRIPT.md`, `docs/ca2/Q_AND_A.md`, `docs/ca2/CLAIM_LEDGER.md` and
`docs/eval/stt_bench.md` all named Google in the same way and were rewritten to
the same position. `CLAIM_LEDGER.md` also moved the voice check count from 104 to
108. A repository-wide search now finds the string only inside the `qa_voice.mjs`
comment that records why the claim was removed.
