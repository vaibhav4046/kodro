/* Kodro Learning Annotations
 *
 * Deterministic, local-first explanations for a selected line or code range.
 * The language model may help rewrite code later, but it never supplies the
 * facts shown here: claims come from the selected source, the recorded run,
 * and the grader result passed by the App.
 *
 * The same module also owns the on-device learning notebook and the guarded
 * "change only this section" splice. Keeping these operations pure makes them
 * cheap to test without a browser or model.
 */
(function () {
  'use strict';

  var STORE_KEY = 'kodro_learning_notebook_v1';
  var STORE_CAP = 100;

  function text(value) {
    return String(value == null ? '' : value);
  }

  function hash(source) {
    var s = text(source);
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  function lineAt(source, offset) {
    return text(source).slice(0, Math.max(0, offset)).split('\n').length;
  }

  function lineStart(source, line) {
    var s = text(source);
    var at = 0;
    for (var n = 1; n < line; n++) {
      var next = s.indexOf('\n', at);
      if (next < 0) return s.length;
      at = next + 1;
    }
    return at;
  }

  function lineEnd(source, line) {
    var s = text(source);
    var start = lineStart(s, line);
    var next = s.indexOf('\n', start);
    return next < 0 ? s.length : next;
  }

  function normaliseSelection(source, raw) {
    var s = text(source);
    var start = Math.max(0, Math.min(s.length, Number(raw && raw.start) || 0));
    var end = Math.max(start, Math.min(s.length, Number(raw && raw.end) || start));
    // A caret-only action means "this line". Selected text keeps its exact
    // offsets so a later scoped edit cannot touch an adjacent character.
    if (start === end) {
      var caretLine = lineAt(s, start);
      start = lineStart(s, caretLine);
      end = lineEnd(s, caretLine);
    }
    var startLine = lineAt(s, start);
    // A selection ending exactly after a newline belongs to the preceding
    // line, matching what people see highlighted in a textarea.
    var endProbe = end > start && s.charAt(end - 1) === '\n' ? end - 1 : end;
    var endLine = lineAt(s, endProbe);
    return {
      start: start,
      end: end,
      startLine: startLine,
      endLine: endLine,
      text: s.slice(start, end),
    };
  }

  function indentOf(line) {
    var m = text(line).match(/^[ \t]*/);
    return (m ? m[0] : '').replace(/\t/g, '    ').length;
  }

  function codeLabel(startLine, endLine) {
    return startLine === endLine ? 'Line ' + startLine : 'Lines ' + startLine + '–' + endLine;
  }

  function literal(value) {
    if (typeof value === 'string') return JSON.stringify(value.length > 80 ? value.slice(0, 77) + '…' : value);
    if (Array.isArray(value)) {
      var shown = value.slice(0, 8).map(literal);
      if (value.length > 8) shown.push('…');
      return '[' + shown.join(', ') + ']';
    }
    if (value === null) return 'None';
    if (value === true) return 'True';
    if (value === false) return 'False';
    if (typeof value === 'number' && Number.isFinite(value)) return String(Math.round(value * 1000) / 1000);
    return text(value);
  }

  function safeVars(vars) {
    var out = {};
    if (!vars || typeof vars !== 'object' || Array.isArray(vars)) return out;
    Object.keys(vars).sort().slice(0, 24).forEach(function (name) {
      if (!/^[A-Za-z_]\w*$/.test(name) || name.indexOf('__') === 0) return;
      var value = vars[name];
      if (typeof value === 'function' || (value && typeof value === 'object' && !Array.isArray(value))) return;
      out[name] = literal(value);
    });
    return out;
  }

  function semanticClaim(line, number, allLines) {
    var raw = text(line);
    var t = raw.trim();
    var source = 'Source · line ' + number;
    if (!t || t.charAt(0) === '#') return null;

    var m;
    if ((m = t.match(/^if\s+(.+):$/))) {
      var baseIndent = indentOf(raw);
      var after = null;
      for (var i = number; i < allLines.length; i++) {
        var candidate = allLines[i];
        if (!candidate.trim() || candidate.trim().charAt(0) === '#') continue;
        if (indentOf(candidate) <= baseIndent) { after = i + 1; break; }
      }
      return {
        text: 'This tests ' + m[1] + '. Only the more-indented lines beneath it belong to the if block.'
          + (after ? ' Line ' + after + ' is back at the same indentation, so it runs after the decision rather than only inside it.' : ''),
        source: source,
      };
    }
    if ((m = t.match(/^elif\s+(.+):$/))) {
      return { text: 'This alternative condition is tested only when the earlier if/elif conditions were false: ' + m[1] + '.', source: source };
    }
    if (/^else\s*:$/.test(t)) {
      return { text: 'This branch runs only when none of the preceding if/elif conditions in the same chain were true.', source: source };
    }
    if ((m = t.match(/^for\s+([A-Za-z_]\w*)\s+in\s+(.+):$/))) {
      return { text: 'This repeats the indented block once for each value from ' + m[2] + ', storing the current value in ' + m[1] + '.', source: source };
    }
    if ((m = t.match(/^while\s+(.+):$/))) {
      return { text: 'This repeats its indented block while ' + m[1] + ' is true. Kodro stops a runaway loop instead of letting the page hang.', source: source };
    }
    if ((m = t.match(/^def\s+([A-Za-z_]\w*)\s*\((.*)\):$/))) {
      return { text: 'This defines ' + m[1] + '(' + m[2] + '). Its indented body does not run until the function is called.', source: source };
    }
    if ((m = t.match(/^([A-Za-z_]\w*)\s*(\+=|-=|\*=|\/=)\s*(.+)$/))) {
      return { text: 'This updates ' + m[1] + ' using its previous value and ' + m[3] + '.', source: source };
    }
    if ((m = t.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/))) {
      return { text: 'This evaluates ' + m[2] + ' and stores the result in ' + m[1] + '.', source: source };
    }
    if ((m = t.match(/^(move_forward|move_backward)\s*\(([^)]*)\)/))) {
      return { text: 'This asks the robot to move ' + (m[1] === 'move_forward' ? 'forward' : 'backward') + ' by ' + (m[2] || 'the default distance') + ' metres in the lesson API.', source: source };
    }
    if ((m = t.match(/^(turn_left|turn_right)\s*\(([^)]*)\)/))) {
      return { text: 'This turns the robot ' + (m[1] === 'turn_left' ? 'left' : 'right') + ' by ' + (m[2] || '90') + ' degrees.', source: source };
    }
    if (/^(distance|read_distance|obstacle_ahead)\s*\(/.test(t)) {
      return { text: 'This reads the fitted distance sensor. The recorded-run evidence below shows the value Kodro actually used.', source: source };
    }
    if (/^return\b/.test(t)) {
      return { text: 'This ends the current function call and sends its value back to the caller.', source: source };
    }
    if (/^[A-Za-z_]\w*\s*\(/.test(t)) {
      return { text: 'This calls a command or function. Its recorded execution, if any, is listed below.', source: source };
    }
    return { text: 'This statement is evaluated in sequence after the statement above it, unless a surrounding branch, loop or function changes that flow.', source: source };
  }

  function create(options) {
    var opts = options || {};
    var source = text(opts.code);
    var selection = normaliseSelection(source, opts.selection || {});
    var allLines = source.split('\n');
    var label = codeLabel(selection.startLine, selection.endLine);
    var claims = [];

    for (var n = selection.startLine; n <= selection.endLine && claims.length < 8; n++) {
      var claim = semanticClaim(allLines[n - 1] || '', n, allLines);
      if (claim) claims.push(claim);
    }

    var trace = Array.isArray(opts.trace) ? opts.trace : [];
    var observed = trace.filter(function (step) {
      return step && Number(step.line) >= selection.startLine && Number(step.line) <= selection.endLine;
    });
    if (observed.length) {
      claims.push({
        text: label + ' produced ' + observed.length + ' recorded trace ' + (observed.length === 1 ? 'step' : 'steps')
          + ' in the last run. The first was “' + text(observed[0].desc || 'evaluated') + '”'
          + (observed.length > 1 ? ' and the last was “' + text(observed[observed.length - 1].desc || 'evaluated') + '”.' : '.'),
        source: 'Recorded run · steps ' + observed[0].n + (observed.length > 1 ? '–' + observed[observed.length - 1].n : ''),
      });
    } else if (trace.length) {
      claims.push({
        text: label + ' did not produce a recorded step in the last run. It may be a definition, a branch that was not taken, or code after the program stopped.',
        source: 'Recorded run · no matching step',
      });
    } else {
      claims.push({
        text: 'There is no recorded run for this exact program yet. Static control-flow claims are shown, but runtime values are deliberately not guessed.',
        source: 'Run evidence · unavailable',
      });
    }

    var latestVars = {};
    var latestVarStep = null;
    observed.forEach(function (step) {
      var vars = safeVars(step.vars);
      Object.keys(vars).forEach(function (name) { latestVars[name] = vars[name]; });
      if (Object.keys(vars).length) latestVarStep = step.n;
    });
    var values = Object.keys(latestVars).map(function (name) {
      return { name: name, value: latestVars[name], source: 'Recorded run · step ' + latestVarStep };
    });

    if (opts.action === 'failure') {
      if (opts.failure) {
        claims.push({ text: text(opts.failure), source: text(opts.failureSource || 'Grader result · last attempt') });
      } else {
        claims.push({ text: 'No failure is recorded for the current program and setup. Run it first, then ask again so Kodro can cite the actual result.', source: 'Grader result · unavailable' });
      }
    }
    if (opts.action === 'hint') {
      if (opts.hint) {
        claims.push({ text: text(opts.hint), source: text(opts.hintSource || 'Active lesson · authored hint') });
      } else {
        claims.push({ text: 'Trace this selection once, compare its last recorded state with the goal, and change only one value or condition before running again.', source: 'Kodro learning strategy · deterministic' });
      }
    }

    var title = opts.action === 'values' ? 'Values for ' + label
      : opts.action === 'failure' ? 'Why the last attempt failed'
        : opts.action === 'hint' ? 'Hint for ' + label
          : 'Explanation of ' + label;
    return {
      id: 'note-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      title: title,
      action: opts.action || 'explain',
      selection: selection,
      excerpt: selection.text,
      claims: claims,
      values: values,
      lessonId: opts.lessonId || null,
      context: opts.context || 'Current program',
      programHash: hash(source),
      createdAt: Date.now(),
      note: '',
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && typeof item === 'object' && typeof item.title === 'string' && Array.isArray(item.claims);
      }).slice(0, STORE_CAP);
    } catch (e) {
      return [];
    }
  }

  function write(entries) {
    var clean = (Array.isArray(entries) ? entries : []).slice(0, STORE_CAP);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(clean)); } catch (e) { void e; }
    try { window.dispatchEvent(new CustomEvent('kodro-annotations', { detail: { count: clean.length } })); } catch (e2) { void e2; }
    return clean;
  }

  function save(entry, note) {
    if (!entry || !Array.isArray(entry.claims)) return load();
    var copy = Object.assign({}, entry, { note: text(note == null ? entry.note : note), savedAt: Date.now() });
    var entries = load().filter(function (item) { return item.id !== copy.id; });
    entries.unshift(copy);
    return write(entries);
  }

  function remove(id) {
    return write(load().filter(function (entry) { return entry.id !== id; }));
  }

  function updateNote(id, note) {
    return write(load().map(function (entry) {
      return entry.id === id ? Object.assign({}, entry, { note: text(note), savedAt: Date.now() }) : entry;
    }));
  }

  function clear() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { void e; }
    try { window.dispatchEvent(new CustomEvent('kodro-annotations', { detail: { count: 0 } })); } catch (e2) { void e2; }
    return [];
  }

  function makeEditScope(source, rawSelection) {
    var code = text(source);
    var sel = normaliseSelection(code, rawSelection || {});
    return {
      start: sel.start,
      end: sel.end,
      startLine: sel.startLine,
      endLine: sel.endLine,
      selected: code.slice(sel.start, sel.end),
      before: code.slice(0, sel.start),
      after: code.slice(sel.end),
      programHash: hash(code),
      code: code,
    };
  }

  function stripFences(proposal) {
    var p = text(proposal).trim();
    var m = p.match(/^```(?:python)?\s*\n?([\s\S]*?)\n?```$/i);
    return (m ? m[1] : p).replace(/\r\n?/g, '\n');
  }

  function applyScopedEdit(currentSource, scope, proposal) {
    var current = text(currentSource);
    if (!scope || current !== scope.code || hash(current) !== scope.programHash) {
      return { ok: false, error: 'The program changed after this selection was made. Select the section again so Kodro cannot overwrite newer work.' };
    }
    var p = stripFences(proposal);
    var candidate;
    var replacement;
    // A model is asked for the complete program. Accept it only when the
    // text outside the selected range is byte-for-byte unchanged.
    var beforeMatches = !scope.before || p.slice(0, scope.before.length) === scope.before;
    var afterMatches = !scope.after || p.slice(p.length - scope.after.length) === scope.after;
    if (beforeMatches && afterMatches) {
      candidate = p;
      replacement = p.slice(scope.before.length, scope.after.length ? p.length - scope.after.length : p.length);
    } else {
      // A short answer is treated as a replacement fragment. The splice itself
      // makes changing an unselected character impossible.
      replacement = p;
      candidate = scope.before + replacement + scope.after;
    }
    try {
      if (window.RoverLang && window.RoverLang.compile) window.RoverLang.compile(candidate);
    } catch (e) {
      return { ok: false, error: 'The scoped result does not compile: ' + ((e && e.message) || text(e)) };
    }
    return {
      ok: true,
      code: candidate,
      replacement: replacement,
      startLine: scope.startLine,
      endLine: scope.endLine,
      unchangedBefore: candidate.slice(0, scope.before.length) === scope.before,
      unchangedAfter: candidate.slice(candidate.length - scope.after.length) === scope.after,
    };
  }

  window.KodroAnnotations = {
    STORE_KEY: STORE_KEY,
    hash: hash,
    normaliseSelection: normaliseSelection,
    create: create,
    load: load,
    save: save,
    remove: remove,
    updateNote: updateNote,
    clear: clear,
    makeEditScope: makeEditScope,
    applyScopedEdit: applyScopedEdit,
  };
})();
