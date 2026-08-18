# Verification log: renderer table evidence

Date 2026-08-14. Branch `agent/kodro-ca2-candidate`. Closes audit CRITICAL 1 and
annotates MEDIUM 10.

## What was wrong

The dissertation's renderer table printed software rows that no artefact in the
repository supported. The committed `docs/eval/performance_eval.json` had one
sample per tier while the table and two method sentences claimed three, and the
prose said the hardware and software runs were "captured a day apart" when the
artefacts are 18 days apart.

Part of this had already been corrected before this pass: the four numbers had
been updated to a 19:59 re-run and the "day apart" sentence replaced by the two
capture dates. Two things were still open, and both were checked rather than
assumed.

## What was checked, and what it found

**The caption's method claim held.** `samplesPerTier` is 3 in both artefacts, and
every P95 cell in the table is the median of that tier's three per-sample
readings. Verified cell by cell against the `runs` arrays:

```
software low   frame [35.7, 48, 50.7]   median 48     submission [12.5, 9.1, 4.7]  median 9.1
software high  frame [47.5, 50.8, 54.9] median 50.8   submission [34, 6.2, 13.9]   median 13.9
hardware low   frame [7.4, 7.5, 8.1]    median 7.5    submission [1.8, 1.9, 2.5]   median 1.9
hardware high  frame [8.5, 7.5, 7.8]    median 7.8    submission [3.1, 2.4, 2.9]   median 2.9
```

The caption's budget claim holds in the strong form it states: all six hardware
submission readings are under 4.17 ms, all six software readings are over it.

**The provenance claim did not hold.** The 19:59 artefact pinned
`bundleSha256 0084a2d2...`, but commit `3c2a851` regenerated `bundle.js` for the
dictation-notice fix later the same day, so the artefact measured a bundle that
no longer existed. The sentence at `.tex:648` says each artefact records the hash
of the bundle it measured, which was true, but the reader would take the software
row as current evidence and it was not.

## What was done

`node scripts/qa_performance.mjs --gl=software --repeat=3` was re-run:

```
low   across 3 samples: 25.3 to 32.2 fps, median 25.7
high  across 3 samples: 23.3 to 25 fps, median 24.4
verdict MEASURED; wrote D:\project\robolearn\docs\eval\performance_eval.json
EXIT=0
```

The artefact now carries
`bundleSha256 17c8d98582b431807fb4971b6a43743f0f3d48040380e72aea4b40035b48c174`,
which is byte-for-byte the SHA-256 of `src/kodro/assets/web/bundle.js` at
this commit, and `harnessSha256 50681bdc...`, which matches
`scripts/qa_performance.mjs`. Table rows 659 and 660, the summary figures at
`.tex:160`, and the ledger row in `docs/ca2/CLAIM_LEDGER.md` were updated to the
medians this run produced. The sentence at `.tex:648` now says which of the two
artefacts pins the current bundle.

## The numbers are noisy and the text should not oversell them

Software medians on this host, all under CPU rasterisation: 18.7 and 17.1 at
`f01767e`, 22.2 and 21.1 at 12:21, 25.7 and 24.4 at 21:21. The last run's own Low
samples were 25.3, 25.7 and 32.2, a 27 percent spread across three consecutive
samples on one machine. This is a floor measured on a loaded laptop, which is
what the dissertation says it is. No claim was strengthened on the back of the
higher figure.

`docs/design/REQUESTS.md` carried a standing request to compare against a clean
baseline of 34.4 Low and 28.4 High. Both of today's runs sit under it, and that
was recorded there rather than left silent, together with the reason it is not
evidence that the glass costs frames: the gap is inside the spread this host
produces, and neither run was on a quiet machine. That baseline now exists only
in that paragraph, since the committed artefact has been overwritten since.

## Compile

Two passes, from the existing `_build` directory, which was not deleted:

```
PASS1 EXIT=0
PASS2 EXIT=0
Output written on ..._build\Kodro_Dissertation.pdf (59 pages, 1111900 bytes).
Overfull: 0
Float too large: 0
Undefined: 0
LaTeX Warning: Citation: 0
LaTeX Warning: Reference: 0
```

The tracked PDF was refreshed from that build, sha256
`93cbd04775573443c1b15d15b9b360ecb9e0f467f12e5f31525fec5b3f2e3b97`.

Audit MEDIUM 10 recorded two overfull boxes and one oversized float. All three
compiles run today report zero of each. Both overfull boxes were in paragraphs
this pass and the previous one rewrote, so the fix is a side effect of correcting
numbers, not a typographic change anybody aimed at. It can regress the moment
either paragraph is edited, so the audit entry says to re-check the log before
submission rather than trust the annotation.

## Gates

```
PASS  honesty: 121 passed, 0 failed
10 passed (406 files, 100 protected characters)          # qa_encoding
```

No source file changed in this pass, so the bundle and voice gates were not
re-run; the bundle hash equality above is the check that mattered.
