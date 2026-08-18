# A tracked personal-data leak the secret gate could not see, 15 August 2026

Six tracked files in a public repository carried the local Windows account
name. `scripts/qa_secrets.mjs` exists to catch exactly that, had a rule written
for exactly that, and printed `PASS` over them for as long as they had been in
the tree. The reason is a one-word assumption in how it read files.

This note records the leak, the gate defect underneath it, the fix, and two
earlier evidence claims that the same encoding problem falsified.

## The leak

```
docs/dissertation/compile1.txt
docs/dissertation/compile2.txt
docs/dissertation/doi_compile1.txt
docs/dissertation/doi_compile2.txt
docs/dissertation/final_compile1.txt
docs/dissertation/final_compile2.txt
```

All six are `pdflatex` console captures. Each contains `C:/Users/<account>/...`
on 20 distinct paths by the gate's own `HOME_PATH` rule, all of them MiKTeX
font and package locations. `git ls-files` confirmed all six were tracked.

This violates the release rule against committing private paths or local
usernames, and the repository is public, so the disclosure is real rather than
theoretical.

## Why the gate did not catch it

`.gitignore:90-99` already documents this exact hazard. The author had hit it
before, with nine `.log` files, and wrote both the ignore rule and the gate in
response. The comment there is precise about the mechanism: the pdflatex log
"embeds the absolute MiKTeX install path on whichever machine built it, which
means it carries a local username."

Two things let these six through anyway.

**The ignore patterns are narrower than the hazard.** The rules are
`docs/dissertation/**/*.log` and `docs/dissertation/pass*.txt`. A compile
redirected to `compile1.txt` is the same bytes under a name that matches
neither.

**The gate decodes every file as UTF-8.** PowerShell redirection writes
UTF-16LE. Read as UTF-8, `C:\Users\<account>\` is stored as those characters
with a NUL between each one, so the scanner sees `C\0:\0\\0U\0s\0e\0r\0s\0...`
and no rule matches anything. The file reports clean.

Measured directly, same regex, same file, two decodings:

```
docs/dissertation/compile1.txt         utf8     HOME_PATH matches =   0
docs/dissertation/compile1.txt         utf16le  HOME_PATH matches =  20 account='<account>'
docs/dissertation/final_compile2.txt   utf8     HOME_PATH matches =   0
docs/dissertation/final_compile2.txt   utf16le  HOME_PATH matches =  20 account='<account>'
```

This is the more serious half of the finding. The gate's green line was being
read as evidence that no tracked file names an account, and for any UTF-16 file
it never meant that. Its thirteen credential rules were equally blind: an AWS
key id in a UTF-16 file would have passed too.

## The fix

**Gate.** `scripts/qa_secrets.mjs` now determines the encoding from the bytes
instead of assuming. A byte-order mark settles it outright; without one,
UTF-16 is recognised by half the bytes being NUL on a single parity, which does
not happen in UTF-8 text. Six checks were added, and the last of them asserts
that the old UTF-8-only read *would* have missed the leak, so the guard cannot
quietly become decoration.

```
before:  PASS  secrets: 27 passed (477 of 779 tracked files read, 13 credential rules)
after :  qa_secrets: 1 failed, 32 passed
         FAIL  no tracked file contains a home path naming an account
               -> docs/dissertation/compile1.txt:7 ... and 524 more
```

534 findings across the six files, from a gate that had reported clean.

**Ignore rule.** `.gitignore` gained `docs/dissertation/*compile*.txt` with the
mechanism written down, so the next redirected compile does not repeat this.

**Tracking.** The six were removed from the index with `git rm --cached`. They
remain on disk untouched. This matches what the author already did for the nine
`.log` files; the precedent and its reasoning are in `.gitignore:95-98`.

**Verification after the fix.**

```
PASS  secrets: 33 passed (471 of 773 tracked files read, 13 credential rules)
EXIT=0
```

Six fewer tracked files, six more checks, green for a reason this time.

A sweep of the whole tree with the gate's own binary filter applied confirms
nothing else was hiding behind the encoding:

```
non-binary tracked files scanned = 471 | UTF-16 text files = 0
```

The 131 files that trip a naive BOM/NUL heuristic are all `.png`, `.wav` and
`.ttf`, which the gate skips by extension.

## What is not fixed, and is the author's decision

**The history still contains them.** `git rm --cached` stops the next push from
republishing these files; it does not remove them from commits already pushed to
a public remote. Rewriting published history is irreversible, it invalidates
every existing clone and the open PR, and it is not an agent decision. Flagging
it rather than doing it.

The disclosed value is a Windows account name, not a credential. Nothing here
needs rotating. If the author decides the history is not worth rewriting for
that, saying so explicitly and closing the item is a legitimate outcome.

## Two earlier claims this falsifies

Both are in `.kodro/ca2-evidence/2026-08-15-bcs-citations-and-aux-shadowing.md`.
Per this repository's convention that a dated evidence file records what was
measured at the time, neither is edited there. Both are superseded here.

### The compile warning count was wrong

That file, at line 142, records:

```
PASS1 EXIT=0   PASS2 EXIT=0
warnings: none | Overfull 0 | Undefined control 0
```

`warnings: none` was never measured. It was produced by grepping a UTF-16 log
with a byte-oriented tool, which finds nothing in such a file regardless of
what it contains. Decoded properly, the same log held three:

```
compile2.txt:        h-float warnings=3  overfull=0  undefined=0
final_compile2.txt:  h-float warnings=3  overfull=0  undefined=0
```

All three are ``` `h' float specifier changed to `ht' ```, which is cosmetic
and not a defect. The defect is the reporting: a zero that came from a broken
read was written down as a measurement. The exit codes, the overfull count and
the undefined counts in that block were independently correct.

Current state, after the `reza2025` title fix and a fresh two-pass compile:

```
PASS1 EXIT=0   PASS2 EXIT=0
LaTeX warnings: 7 (all "`h' float specifier changed to `ht'")
Overfull: 0 | Undefined citations: 0 | Undefined references: 0
```

### The PDF hash is stale

That file at lines 150-156, and `.kodro/autonomy/CA2_RECONCILIATION.md:109`,
both record:

```
Kodro_Dissertation.pdf   pages= 59 bytes=1115505 sha256=294103b92657dcd2...
```

That was correct when written. The `reza2025` bibliography fix changed the
document afterwards. Measured now:

```
Kodro_Dissertation.pdf             pages= 59 bytes=1115217 sha256=217e7a978d60f573ded832d8a57fcaa255b79d0697f4b4df845e7aecea4553da
_build/Kodro_Dissertation.pdf      pages= 59 bytes=1115217 sha256=217e7a978d60f573ded832d8a57fcaa255b79d0697f4b4df845e7aecea4553da
```

Still 59 pages, still byte-identical between the source directory and `_build`.
`.kodro/autonomy/EVIDENCE.json` has been updated to the current hash, since it
is a live state file rather than a dated record.

## The pattern worth keeping

Three separate defects this week came from the same shape: a claim recorded
without the measurement that would support it.

- Four documents asserted the bibliography could not be checked "because this
  machine is offline by design." Nobody had tried `curl`. It works.
- An evidence file recorded `warnings: none` from a grep that could not have
  found a warning if there had been one.
- A secret gate printed `PASS` over 471 files while six of them named an
  account, because it never checked what encoding it was reading.

In each case the tool did not lie. It answered a different question than the one
the write-up claimed it answered. The check that catches this is asking, before
writing a result down, which command produced it and whether that command could
have returned the opposite.

## Reproducing

```bash
node scripts/qa_secrets.mjs
```

To see the blind spot on any UTF-16 file:

```bash
node -e "const{readFileSync}=require('fs');const f=process.argv[1];
for(const e of ['utf8','utf16le'])console.log(e,(readFileSync(f,e).match(/Users[\\\\/]([A-Za-z0-9._-]+)[\\\\/]/g)||[]).length)" <file>
```

---

## Appended 15 August 2026: a second blind spot, found by this file failing the gate

Everything above is left as it was written. It recorded a true measurement and
then, within hours, described a tree that no longer existed. This section says
why, and what the gate does about it now.

### This file broke the gate it was documenting

The write-up above quoted the leaked account name four times while explaining
the leak. It was committed without re-running the gate afterwards. The next run
failed on it:

```
qa_secrets: 1 failed, 32 passed
FAIL  no tracked file contains a home path naming an account
      -> .kodro/ca2-evidence/2026-08-15-secret-gate-utf16-blind-spot.md:22
       | .kodro/ca2-evidence/2026-08-15-secret-gate-utf16-blind-spot.md:46
```

That is the same shape as the defect described in "The pattern worth keeping":
a result written down that the state no longer supports. The difference is that
this one was introduced by the write-up rather than found by it.

### The gate could only see two of the eight

The failure named two lines. A repo-wide search for the token found eight
tracked occurrences across four files:

```
.kodro/ca2-evidence/2026-08-15-secret-gate-utf16-blind-spot.md   4
.kodro/autonomy/EVIDENCE.json                                    2
.kodro/autonomy/STATE.md                                         1
(the fourth is the second EVIDENCE.json occurrence)
```

The `HOME_PATH` rule matches an account name *inside a path*. The two it caught
were `C:/Users/<account>/...`. The six it could not see were not paths:

```
pytest-of-<account>          a host note about the pytest temp root
account='<account>'          the measurement lines in this very file
```

Same disclosed value, a shape the rule was never written for. A rule that
matches by shape cannot catch a value that has no shape.

### What changed

**Redaction.** All eight replaced with `<account>`, in this file, in
`.kodro/autonomy/EVIDENCE.json` and in `.kodro/autonomy/STATE.md`. Every
measurement survives unchanged: `utf8 = 0` against `utf16le = 20` still reads
exactly as it was taken. Only the value is gone. This is not a retro-edit of a
measurement, and it does not touch history already pushed.

**A rule that matches by value.** `scripts/qa_secrets.mjs` now derives the
account running the scan from `os.userInfo().username` at run time and flags it
as a bare token. Deriving it at run time is the point: the gate never stores a
name, so the tracked script still contains no account. The boundary is
alphanumeric rather than `\b`, so `pytest-of-<name>` is caught while a longer
word that merely contains the name is not. Names under four characters and
shared CI accounts (`runner`, `user`, and the rest of the existing placeholder
set) are declined.

**What this rule honestly is.** Publisher-side, not universal. It catches the
leak the machine running it can create, which is the only one it is in a
position to prevent. It is inactive when there is no usable local account name,
so the summary line now states which:

```
PASS  secrets: 42 passed (480 of 787 tracked files read, 13 credential rules, bare-name rule live)
EXIT=0
```

Nine more checks than the 33 recorded above. The file counts differ from
471 of 773 because that is a different tree, not a different reading of the
same one.

### The rule was proved live, not assumed

A green line from a rule that never fired is the failure this whole file is
about, so the rule was exercised. A probe containing `pytest-of-` plus the real
account was written and `git add -N`'d so the tracked-set scan would see it:

```
qa_secrets: 1 failed, 41 passed
FAIL  no tracked file contains the account name of the machine running the scan
      -> .kodro/_ruleprobe.txt:1  local account name
EXIT=1
```

Probe then removed from the index and from disk, tree confirmed clean, gate back
to `42 passed`. Eight self-checks were also added inside the script, all against
the fabricated account `jdoe` so the assertions read the same on any machine and
the file still names nobody. One of them asserts that `HOME_PATH` does *not*
match `pytest-of-jdoe` while the new rule does, so the new rule cannot quietly
become a duplicate of the old one.

### Still the author's decision

Unchanged from the section above. `git rm --cached` and these redactions stop
the next push from republishing. Neither removes anything from commits already
pushed to a public remote. That is `HUMAN_TODO.md` section 7, "Decide whether to
rewrite published history for a leaked account name". It was numbered 6 when this
was written, at which point the file had two sections numbered 6; it was
renumbered to 7 on 15 August 2026 to remove the ambiguity.
