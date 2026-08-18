/* ============================================================================
   KODRO - saying what went wrong in words a child can act on.

   A six year old on the first lesson who types `move_forward(3` was being shown

       syntax: Expected ")". (line 1)

   and a pupil who typed `move_foward(2)` was shown

       runtime: Name "move_foward" is not defined. (line 1)

   Both are accurate. Neither tells a child what to do, and the second one is
   the crueller of the two: the pupil has made a one letter typo and the app
   knows exactly which command they meant, and says nothing.

   Every lesson already declares a `reading_age`, so the product knew the pupil
   was six and reported an interpreter's internal vocabulary anyway.

   WHY THIS IS A HAND WRITTEN TABLE, not a model. Leinonen et al. (UKICER 2024,
   106 participants, six programs, three message conditions) found hand written
   expert explanations beat both GPT-4 generated explanations and the standard
   compiler message on time to fix and on satisfaction, and that GPT-4 beat the
   plain compiler message in only one of six tasks. A lookup table is the
   evidenced design here, not a compromise forced by the offline constraint.

   It is also a small surface on purpose. The sandbox bans imports, f-strings,
   dictionaries and input(), so the set of things a pupil can actually hit is
   finite and enumerable, which is why this file can be complete rather than
   best effort.

   HONESTY RULE: an explanation must never assert something the app has not
   checked. Where the cause is genuinely ambiguous the wording says so ("this
   usually means") rather than inventing a specific diagnosis, and the original
   message is always still available, because a teacher looking over a shoulder
   needs the real text.

   Exposes window.KodroPupilErrors.
   ========================================================================== */
(function () {
  'use strict';

  //: Every name a pupil is allowed to call, so a misspelling can be matched
  //: against what they probably meant. Kept here rather than imported from the
  //: interpreter because this list is the PUPIL's vocabulary (the documented
  //: API in docs/pupils/api-cheatsheet.md), not the interpreter's full set of
  //: internal builtins, and suggesting an internal name would be worse than
  //: suggesting nothing.
  var PUPIL_API = [
    'move_forward', 'move_backward', 'turn_left', 'turn_right', 'set_speed', 'wait',
    'read_distance', 'read_colour', 'read_heading', 'read_battery',
    'obstacle_ahead', 'sample_detected', 'at_base', 'scan',
    'collect_sample', 'drop_sample', 'beep', 'log', 'say', 'led',
    'pen_down', 'pen_up', 'place', 'clear_props',
    'range', 'len', 'int', 'float', 'str', 'abs', 'round', 'min', 'max', 'print',
    'True', 'False', 'None', 'and', 'or', 'not', 'if', 'else', 'elif',
    'for', 'while', 'def', 'return', 'break', 'continue', 'in',
  ];

  // Levenshtein distance, iterative two-row. Small strings only, so the simple
  // implementation is the right one.
  function distance(a, b) {
    a = String(a); b = String(b);
    if (a === b) return 0;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)
        );
      }
      for (j = 0; j <= b.length; j++) prev[j] = cur[j];
    }
    return prev[b.length];
  }

  // The closest pupil-API name, or null when nothing is close enough to be
  // worth suggesting. The threshold scales with length so `led` does not get
  // "corrected" to `len`, and a long wrong word is allowed more slack.
  function nearestCommand(name) {
    var word = String(name || '');
    if (word.length < 3) return null;
    var limit = word.length <= 4 ? 1 : (word.length <= 8 ? 2 : 3);
    var best = null, bestD = Infinity;
    for (var i = 0; i < PUPIL_API.length; i++) {
      var d = distance(word.toLowerCase(), PUPIL_API[i].toLowerCase());
      if (d < bestD) { bestD = d; best = PUPIL_API[i]; }
    }
    if (bestD > limit) return null;
    if (best === word) return null;
    return best;
  }

  //: Under this reading age the wording avoids clauses and jargon entirely.
  //: Lessons declare reading_age; when a lesson does not, the neutral wording
  //: is used, which is written to be readable either way.
  var YOUNG = 9;

  // The table. Each entry: a matcher against the interpreter's own message, and
  // a builder returning {text, hint}. `hint` is the actionable half and is
  // allowed to be empty when there is nothing honest to suggest.
  var RULES = [
    {
      // `move_forward(3`  -- by far the most common first-week error.
      test: /Expected "\)"/i,
      build: function () {
        return {
          text: 'A bracket is missing.',
          hint: 'Every ( needs a ) to close it. Check the end of this line.',
        };
      },
    },
    {
      test: /Unexpected token "\)"/i,
      build: function () {
        return {
          text: 'There is one ) too many here.',
          hint: 'Count the brackets: each ( needs exactly one ).',
        };
      },
    },
    {
      // `if True` with no colon. The interpreter names the keyword, so the
      // explanation can too, which makes it specific rather than generic.
      test: /expected ":" at the end of this "([a-z]+)" line/i,
      build: function (m) {
        var kw = m[1];
        return {
          text: 'This ' + kw + ' line needs a colon at the end.',
          hint: 'Type a : after the ' + kw + ' line, then indent the lines that belong to it.',
        };
      },
    },
    {
      test: /Unexpected end of expression/i,
      build: function () {
        return {
          text: 'This line stops before it is finished.',
          hint: 'Something is missing after the last symbol on the line.',
        };
      },
    },
    {
      // The big one. The pupil almost always meant a real command.
      test: /Name "([A-Za-z_][A-Za-z0-9_]*)" is not defined/i,
      build: function (m, opts) {
        var name = m[1];
        var near = nearestCommand(name);
        if (near) {
          return {
            text: 'Kodro does not know a command called ' + name + '.',
            hint: 'Did you mean ' + near + '?',
          };
        }
        // No close match. Do NOT guess: say plainly what happened and where to
        // look. Claiming a specific cause here would be inventing one.
        return {
          text: 'Kodro does not know a command called ' + name + '.',
          hint: (opts && opts.readingAge && opts.readingAge < YOUNG)
            ? 'Check the spelling, or look at the list of commands.'
            : 'Check the spelling, or open the command list to see what is available.',
        };
      },
    },
    {
      test: /is not a function|is not callable/i,
      build: function () {
        return {
          text: 'That name is not something you can call with brackets.',
          hint: 'Only commands take brackets, like move_forward(2).',
        };
      },
    },
    {
      test: /division by zero/i,
      build: function () {
        return {
          text: 'Something was divided by zero, which has no answer.',
          hint: 'Check the number you are dividing by is never 0.',
        };
      },
    },
    {
      test: /loop ran too long|too many steps|MAX_STEPS/i,
      build: function () {
        return {
          text: 'The program was still going after a very long time, so it was stopped.',
          hint: 'A loop is probably never finishing. Check that something inside it changes what the loop is waiting for.',
        };
      },
    },
    {
      test: /indent/i,
      build: function () {
        return {
          text: 'The spaces at the start of this line do not line up.',
          hint: 'Lines inside an if or a loop all need the same indent, usually four spaces.',
        };
      },
    },
    {
      test: /method calls .* not supported|\.[a-z]+\(\) is not supported/i,
      build: function () {
        return {
          text: 'That way of calling something is not available in Kodro.',
          hint: 'Kodro runs a small part of Python. Use the commands from the command list.',
        };
      },
    },
    {
      test: /the drive stalled/i,
      build: function () {
        return {
          text: 'The motors could not move the robot on this ground.',
          hint: 'The robot may be too heavy for its motors, or the ground too rough. Try the Design stage.',
        };
      },
    },
    {
      test: /battery ran flat/i,
      build: function () {
        return {
          text: 'The battery ran out before the program finished.',
          hint: 'Drive a shorter route, or fit a bigger battery in the Design stage.',
        };
      },
    },
  ];

  /**
   * Turn an interpreter message into something a pupil can act on.
   *
   * Returns {text, hint, original, matched}. `matched` is false when nothing in
   * the table applied, in which case `text` is the original message unchanged:
   * showing the real error is always better than showing a vague invention.
   *
   * @param {string} message the interpreter's own message
   * @param {{readingAge?: number}} [opts]
   */
  function explain(message, opts) {
    var raw = String(message == null ? '' : message);
    // Strip a leading "kind: " prefix if the caller has already formatted one,
    // so the table matches whether or not the message has been decorated.
    var body = raw.replace(/^(syntax|runtime|name|type|value|zero)\s*:\s*/i, '');
    for (var i = 0; i < RULES.length; i++) {
      var m = RULES[i].test.exec(body);
      if (m) {
        var built = RULES[i].build(m, opts || {});
        return {
          matched: true,
          text: built.text,
          hint: built.hint || '',
          original: raw,
        };
      }
    }
    return { matched: false, text: raw, hint: '', original: raw };
  }

  /** One line, for a console or a toast: the explanation plus its hint. */
  function explainLine(message, opts) {
    var r = explain(message, opts);
    return r.hint ? r.text + ' ' + r.hint : r.text;
  }

  window.KodroPupilErrors = {
    explain: explain,
    explainLine: explainLine,
    nearestCommand: nearestCommand,
    PUPIL_API: PUPIL_API,
    RULE_COUNT: RULES.length,
  };
})();
