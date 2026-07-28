/* ============================================================================
   KODRO - Parsons problems, generated from the verified worked answers.

   A Parsons problem hands the pupil the correct lines of a program in the
   wrong order and asks them to arrange them. The evidence for them is strong
   and specific: they teach program CONSTRUCTION about as well as writing from
   scratch in roughly half the time, because the pupil spends every minute on
   ordering and structure rather than on typing and syntax.

   Kodro gets them for free, and provably correct, because every lesson already
   ships a worked answer that a gate runs through both marking engines at 100
   out of 100 on every change (tests/unit/test_lesson_solutions.py). The lines
   being reordered are never an approximation of the answer; they ARE the
   answer, including for lessons a teacher authored in the Studio, whose answers
   pass the same Check gate.

   Indentation is given, not asked for. That is the deliberate "with indentation"
   variant: this audience is learning ORDER (what must happen before what), and
   making them fight leading spaces in a reorder UI would test motor control,
   not understanding. The indentation stays attached to each line, so the shape
   of a block is visible while its position is the puzzle.

   Plain JS, no React, so scripts/qa_parsons.mjs can drive every branch in a
   bare vm. Exposes window.KodroParsons.
   ========================================================================== */
(function () {
  'use strict';

  // Deterministic PRNG (mulberry32). Runs must be reproducible: the same
  // lesson and seed always deal the same shuffle, so a teacher can put the
  // same puzzle in front of a whole class, and the QA gate can assert exact
  // behaviour instead of retrying until luck cooperates.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Build a Parsons problem from a program.
   *
   * Returns {lines, order, solvable} where `lines` is the dealt (shuffled)
   * list and `order` maps each dealt position to its correct position, or
   * null when the program has too few distinct lines to make a real puzzle:
   * shuffling two lines is a coin toss, not a problem, and offering it would
   * waste the pupil's click.
   */
  function deal(source, seed) {
    var lines = String(source || '').replace(/\r\n?/g, '\n').split('\n')
      .filter(function (ln) { return ln.trim() !== ''; });
    if (lines.length < 3) return null;
    // A program whose lines are all identical (three move_forward(1) calls)
    // cannot be mis-ordered; every arrangement is correct. Refuse rather than
    // present a puzzle the Check button would have to always pass.
    var distinct = {};
    for (var i = 0; i < lines.length; i++) distinct[lines[i]] = true;
    if (Object.keys(distinct).length < 3) return null;

    var idx = lines.map(function (_, i) { return i; });
    var rand = rng((seed === undefined ? 1 : seed) || 1);
    // Fisher-Yates, then a guarantee: if the deal happens to be the solved
    // order (likely on short programs), rotate by one. A Parsons problem that
    // arrives already solved teaches only that Check can be clicked.
    for (var j = idx.length - 1; j > 0; j--) {
      var k = Math.floor(rand() * (j + 1));
      var tmp = idx[j]; idx[j] = idx[k]; idx[k] = tmp;
    }
    var solved = idx.every(function (v, i) { return v === i; });
    if (solved) idx.push(idx.shift());

    return {
      lines: idx.map(function (i) { return lines[i]; }),
      order: idx.slice(),
      total: lines.length,
      solvable: true,
    };
  }

  /**
   * Check an arrangement. `arrangement` is the pupil's current list of lines.
   *
   * Returns {correct, firstWrong} where firstWrong is the 1-based position of
   * the first line that is out of place, or null when correct. Only the FIRST
   * wrong position is reported, deliberately: naming every wrong line is an
   * answer key, naming the first is a nudge, and the difference is whether the
   * pupil still has a problem to solve afterwards.
   *
   * Compared by TEXT, not by index, so two identical lines (a repeated
   * move_forward) are interchangeable and the pupil is never marked wrong for
   * an arrangement that produces the identical program.
   */
  function check(source, arrangement) {
    var want = String(source || '').replace(/\r\n?/g, '\n').split('\n')
      .filter(function (ln) { return ln.trim() !== ''; });
    var got = (arrangement || []).slice();
    if (got.length !== want.length) {
      // The reorder UI cannot change the number of lines, so this branch only
      // fires on a malformed caller. Point at the first position that cannot
      // match rather than pretending to a more precise diagnosis.
      return { correct: false, firstWrong: Math.min(got.length, want.length) + 1 };
    }
    for (var i = 0; i < want.length; i++) {
      if (got[i] !== want[i]) return { correct: false, firstWrong: i + 1 };
    }
    return { correct: true, firstWrong: null };
  }

  window.KodroParsons = {
    deal: deal,
    check: check,
  };
})();
