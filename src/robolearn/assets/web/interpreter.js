/* ============================================================================
   KODRO — Python-subset interpreter
   A small tree-walking interpreter that supports enough Python to teach
   standard programming constructs: variables, arithmetic, comparisons,
   booleans, for/while loops, if/elif/else, range(), print(), and a `rover`
   object with motion methods (statements that animate) and sensor methods
   (functions that read live rover state).

   Execution is a JS generator: each executed statement yields an event
   carrying its source line, so the host can highlight code, animate motion,
   and single-step. Sensor reads call back into the host for live values.
   Loaded as a plain script (NOT through Babel). Exposes window.RoverLang.
   ========================================================================== */
(function () {
  'use strict';

  // ---- Error type that carries a 1-based line number -----------------------
  function RoverError(message, line) {
    this.name = 'RoverError';
    this.message = message;
    this.line = line || null;
  }
  RoverError.prototype.toString = function () {
    return (this.line ? 'Line ' + this.line + ': ' : '') + this.message;
  };

  // All lookup maps are NULL-PROTOTYPE objects: the `in` checks against them
  // must never see Object.prototype members, or an identifier like
  // `constructor` / `toString` / `hasOwnProperty` would resolve as a command
  // instead of raising NameError like Python does.
  const MOTION_METHODS = Object.assign(Object.create(null), {
    forward: 'move', backward: 'move',
    turn_right: 'turn', turn_left: 'turn',
    set_speed: 'speed', wait: 'wait', sleep: 'wait',
    pen_down: 'pen', pen_up: 'pen', stop: 'halt',
    led: 'led', say: 'say', scan: 'scan'
  });
  const SENSOR_METHODS = Object.assign(Object.create(null), {
    distance: 1, heading: 1, battery: 1, speed: 1, tilt: 1,
    temperature: 1, x: 1, y: 1, ground: 1, light: 1, gravity: 1, on_line: 1
  });

  // RoboLearn lesson API (bare verbs used by every lesson YAML) mapped onto
  // the design's motion/sensor handlers, so lesson starter code RUNS on
  // screen and matches what the Python grader scores. move_forward/backward
  // take METRES (the lesson + grader unit); the design world is in cm, so we
  // scale x100 below. Everything else shares units (degrees, 0-100 speed).
  const LESSON_MOTION = Object.assign(Object.create(null), {
    move_forward: 'forward', move_backward: 'backward',
    turn_left: 'turn_left', turn_right: 'turn_right',
    set_speed: 'set_speed', pen_down: 'pen_down', pen_up: 'pen_up',
    wait: 'wait', sleep: 'sleep', stop: 'stop',
    scan: 'scan', led: 'led', say: 'say'
  });
  const LESSON_SENSOR = Object.assign(Object.create(null), {
    distance: 'distance', heading: 'heading', battery: 'battery',
    gravity: 'gravity', temperature: 'temperature', ground: 'ground', light: 'light',
    // Line follower: 1 when the robot sits on the practice line, else 0.
    // Gated by the fitted Line follower part (KodroCommands), like distance().
    on_line: 'on_line',
    // Python pupil-API sensor names (lessons use these) -> design sensors.
    // read_distance() is the PYTHON pupil API and returns METRES; the design
    // dialect's distance() returns centimetres. Both used to route to the same
    // 'distance' sensor, so `if read_distance() < 1.0:` was comparing a
    // centimetre reading against a metre threshold and never fired -- lesson 07
    // could not be solved the way it is taught. They are separate sensors now.
    read_distance: 'distance_m', read_heading: 'heading', read_battery: 'battery',
    read_colour: 'ground'
  });
  // obstacle_ahead() threshold matches the Python engine's default of 0.5 m
  // (rover_api.obstacle_ahead threshold_m=0.5), so a program branching on it
  // takes the SAME branch in the browser sim and under the grader.
  const OBSTACLE_AHEAD_CM = 50;
  const AT_BASE_CM = 20;
  // Lesson-world verbs (samples, base, obstacle look-ahead). The live sim has
  // no sample/base state, so these five have built-in approximations below.
  // A host may supply lessonApi(name, args) to take them over - the browser
  // lesson grader (lesson-grader.jsx) does, giving Python-engine-faithful
  // behaviour. Hosts without lessonApi (live sim, scenario validator, QA
  // harnesses) keep the built-ins unchanged.
  const LESSON_API = Object.assign(Object.create(null), {
    obstacle_ahead: 1, sample_detected: 1, at_base: 1,
    collect_sample: 1, drop_sample: 1,
  });

  // =========================================================================
  // 1. LINE / BLOCK STRUCTURING (indentation -> nested statement lists)
  // =========================================================================
  function buildBlocks(source) {
    const rawLines = source.replace(/\r\n?/g, '\n').split('\n');
    const lines = [];
    for (let i = 0; i < rawLines.length; i++) {
      let text = rawLines[i];
      // strip comments (naive: '#' not inside a string)
      let inStr = false, q = '', out = '';
      for (let c = 0; c < text.length; c++) {
        const ch = text[c];
        if (inStr) {
          out += ch;
          // A quote closes the string unless ESCAPED - preceded by an ODD run
          // of backslashes. Checking only text[c-1] misread 'a\\' (an escaped
          // backslash, then a REAL closing quote) as still-open, which left a
          // trailing # comment inside the "string" and broke tokenization.
          if (ch === q) {
            let bs = 0, k = c - 1;
            while (k >= 0 && text[k] === '\\') { bs++; k--; }
            if (bs % 2 === 0) inStr = false;
          }
        } else if (ch === '#') {
          break;
        } else if (ch === '"' || ch === "'") {
          inStr = true; q = ch; out += ch;
        } else out += ch;
      }
      const stripped = out.replace(/\s+$/, '');
      if (stripped.trim() === '') continue; // blank line
      const indent = stripped.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
      lines.push({ indent: indent, text: stripped.trim(), line: i + 1 });
    }
    let pos = 0;
    function parseBlock(minIndent) {
      const stmts = [];
      while (pos < lines.length && lines[pos].indent >= minIndent) {
        const ln = lines[pos];
        if (stmts.length === 0) stmts.curIndent = ln.indent;
        if (ln.indent > stmts.curIndent) {
          throw new RoverError('Unexpected indentation.', ln.line);
        }
        pos++;
        // A compound header missing its ':' fell through to the expression
        // parser, which tokenised the keyword as a bare name and then tripped
        // on the NEXT token: `for i in range(3)` reported 'Unexpected token
        // "i"'. Every lesson from 00b onward needs a colon and the audience is
        // KS1-KS4, so name the actual mistake the way CPython does.
        if (!/:\s*$/.test(ln.text) && /^\s*(if|elif|else|for|while|def)\b/.test(ln.text)) {
          const kw = ln.text.trim().split(/\s+/)[0].replace(/[^a-z]/g, '');
          throw new RoverError('expected ":" at the end of this "' + kw + '" line', ln.line);
        }
        if (/:\s*$/.test(ln.text)) {
          // compound statement header
          const header = ln.text.replace(/:\s*$/, '');
          const body = parseBlock(ln.indent + 1);
          if (body.length === 0) {
            throw new RoverError('Expected an indented block after "' + header + ':".', ln.line);
          }
          stmts.push(parseCompound(header, body, ln.line));
        } else {
          stmts.push(parseSimple(ln.text, ln.line));
        }
      }
      return stmts;
    }
    const program = parseBlock(0);
    return program;
  }

  function parseCompound(header, body, line) {
    let m;
    if ((m = header.match(/^for\s+([A-Za-z_]\w*)\s+in\s+(.+)$/))) {
      return { kind: 'for', varName: m[1], iter: parseExpr(m[2], line), body: body, line: line };
    }
    if ((m = header.match(/^while\s+(.+)$/))) {
      return { kind: 'while', test: parseExpr(m[1], line), body: body, line: line };
    }
    if ((m = header.match(/^if\s+(.+)$/))) {
      return { kind: 'if', branches: [{ test: parseExpr(m[1], line), body: body }], orelse: null, line: line };
    }
    if ((m = header.match(/^elif\s+(.+)$/))) {
      return { kind: 'elif', test: parseExpr(m[1], line), body: body, line: line };
    }
    if (/^else$/.test(header)) {
      return { kind: 'else', body: body, line: line };
    }
    if ((m = header.match(/^def\s+([A-Za-z_]\w*)\s*\((.*)\)$/))) {
      const params = m[2].trim() ? m[2].split(',').map(s => s.trim()) : [];
      // Each parameter must be a simple name: "def go(x y):" or "def go(1a):"
      // used to be swallowed silently (a parameter literally named "x y"),
      // and other malformed defs surfaced as unrelated block errors. Name the
      // real problem: the parameter list (bugs D7).
      for (const p of params) {
        if (!/^[A-Za-z_]\w*$/.test(p)) {
          throw new RoverError('def ' + m[1] + '(...) has an invalid parameter list: each parameter must be a simple name, separated by commas.', line);
        }
      }
      return { kind: 'def', name: m[1], params: params, body: body, line: line };
    }
    if (/^def\b/.test(header)) {
      // A def header that did not match the shape above (unbalanced parens,
      // missing name): report it as a def problem, not "unsupported statement".
      throw new RoverError('Invalid def: expected "def name(parameters):" with a valid parameter list.', line);
    }
    throw new RoverError('Unsupported statement: "' + header + '".', line);
  }

  // Merge trailing elif/else into the preceding if (post-pass over a block).
  function linkConditionals(stmts) {
    const out = [];
    for (let i = 0; i < stmts.length; i++) {
      const s = stmts[i];
      // 'if' nodes carry `.branches` (not `.body`); recurse on either so a
      // nested if/elif/else inside an if-body is linked too (else the inner
      // 'else' survives to execution as an "Unknown statement").
      if (s.body || s.branches) linkConditionals.recurse(s);
      if (s.kind === 'elif' || s.kind === 'else') {
        const prev = out[out.length - 1];
        if (!prev || (prev.kind !== 'if')) {
          // for...else / while...else is valid Python we do not implement; give
          // an accurate diagnostic instead of the misleading "else without if".
          if (s.kind === 'else' && prev && (prev.kind === 'for' || prev.kind === 'while')) {
            throw new RoverError('loop-else is not supported', s.line);
          }
          throw new RoverError('"' + s.kind + '" without matching "if".', s.line);
        }
        if (s.kind === 'elif') prev.branches.push({ test: s.test, body: s.body });
        else prev.orelse = s.body;
      } else {
        out.push(s);
      }
    }
    return out;
  }
  linkConditionals.recurse = function (s) {
    if (s.kind === 'for' || s.kind === 'while' || s.kind === 'def') {
      s.body = linkConditionals(s.body);
    } else if (s.kind === 'if') {
      for (const b of s.branches) b.body = linkConditionals(b.body);
      if (s.orelse) s.orelse = linkConditionals(s.orelse);
    } else if (s.kind === 'elif' || s.kind === 'else') {
      s.body = linkConditionals(s.body);
    }
  };

  function parseSimple(text, line) {
    // augmented assignment
    let m = text.match(/^([A-Za-z_]\w*)\s*(\+|\-|\*|\/)=\s*(.+)$/);
    if (m && !/[<>=!]=/.test(text.slice(0, text.indexOf('=')))) {
      return { kind: 'augassign', target: m[1], op: m[2], expr: parseExpr(m[3], line), line: line };
    }
    // plain assignment (single '=', not ==)
    const eq = findAssignEq(text);
    if (eq >= 0) {
      const target = text.slice(0, eq).trim();
      if (!/^[A-Za-z_]\w*$/.test(target)) {
        // An accented or non-Latin target is an attempted identifier: name
        // the actual ASCII rule instead of the generic message (bugs D8).
        if (/[^\x00-\x7F]/.test(target)) {
          throw new RoverError('Cannot assign to "' + target + '": names must use ASCII letters (a to z, A to Z), digits and underscores.', line);
        }
        throw new RoverError('Can only assign to a simple variable name.', line);
      }
      return { kind: 'assign', target: target, expr: parseExpr(text.slice(eq + 1), line), line: line };
    }
    if (text === 'break') return { kind: 'break', line: line };
    if (text === 'continue') return { kind: 'continue', line: line };
    if (text === 'pass') return { kind: 'pass', line: line };
    // `global a, b`: inside a function, assignments to these names write to the
    // module scope instead of the local frame (real Python). At module level it
    // is a harmless no-op. Names are validated as identifiers.
    if ((m = text.match(/^global\s+(.+)$/))) {
      const names = m[1].split(',').map(function (s) { return s.trim(); });
      for (const nm of names) {
        if (!/^[A-Za-z_]\w*$/.test(nm)) throw new RoverError('global: "' + nm + '" is not a valid name.', line);
      }
      return { kind: 'global', names: names, line: line };
    }
    if ((m = text.match(/^return\b(.*)$/))) {
      return { kind: 'return', expr: m[1].trim() ? parseExpr(m[1], line) : null, line: line };
    }
    return { kind: 'expr', expr: parseExpr(text, line), line: line };
  }

  function findAssignEq(text) {
    let depth = 0, inStr = false, q = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inStr) { if (ch === q && text[i - 1] !== '\\') inStr = false; continue; }
      if (ch === '"' || ch === "'") { inStr = true; q = ch; continue; }
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      else if (ch === '=' && depth === 0) {
        const prev = text[i - 1], next = text[i + 1];
        if (next === '=') { i++; continue; }       // ==
        if (prev === '!' || prev === '<' || prev === '>') continue; // != <= >=
        return i;
      }
    }
    return -1;
  }

  // =========================================================================
  // 2. EXPRESSION PARSER (tokenizer + Pratt)
  // =========================================================================
  function tokenize(src, line) {
    const toks = [];
    let i = 0;
    const n = src.length;
    const isIdStart = c => /[A-Za-z_]/.test(c);
    const isId = c => /[A-Za-z0-9_]/.test(c);
    while (i < n) {
      const c = src[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (isIdStart(c)) {
        let j = i + 1; while (j < n && isId(src[j])) j++;
        toks.push({ t: 'name', v: src.slice(i, j) }); i = j; continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
        let j = i + 1;
        while (j < n && /[0-9._]/.test(src[j])) j++;  // digits, '.', and 1_000 separators
        // optional scientific-notation exponent: e / E [+/-] digits
        if (j < n && (src[j] === 'e' || src[j] === 'E') && /[0-9+\-]/.test(src[j + 1] || '')) {
          j++;
          if (src[j] === '+' || src[j] === '-') j++;
          while (j < n && /[0-9]/.test(src[j])) j++;
        }
        const slice = src.slice(i, j);
        // Python has no number like 1.2.3; parseFloat would silently keep 1.2
        // and drop the rest, so reject any literal with more than one dot.
        if ((slice.match(/\./g) || []).length > 1) {
          throw new RoverError('invalid number literal "' + slice + '"', line);
        }
        toks.push({ t: 'num', v: parseFloat(slice.replace(/_/g, '')) }); i = j; continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1, s = '';
        while (j < n && src[j] !== c) {
          if (src[j] === '\\' && j + 1 < n) {
            // Translate the standard C-Python escapes so the sim's string
            // VALUES match what the grader's real `exec` builds (e.g.
            // print("a\nb") is two lines, not the literal letters a n b).
            // An UNKNOWN escape keeps its backslash, mirroring CPython, where
            // "\d" stays the two characters backslash + d.
            const e = src[j + 1];
            switch (e) {
              case 'n': s += '\n'; break;
              case 't': s += '\t'; break;
              case 'r': s += '\r'; break;
              case '\\': s += '\\'; break;
              case '"': s += '"'; break;
              case "'": s += "'"; break;
              case '0': s += '\0'; break;
              default: s += '\\' + e; break;   // unknown escape: keep the backslash
            }
            j += 2;
          }
          else { s += src[j]; j++; }
        }
        if (j >= n) throw new RoverError('Unterminated string.', line);
        toks.push({ t: 'str', v: s }); i = j + 1; continue;
      }
      // multi-char operators
      const two = src.substr(i, 2);
      if (['==', '!=', '<=', '>=', '//', '**'].indexOf(two) >= 0) { toks.push({ t: 'op', v: two }); i += 2; continue; }
      if ('+-*/%<>().,[]'.indexOf(c) >= 0) { toks.push({ t: 'op', v: c }); i++; continue; }
      // A non-ASCII letter (cafe with an accent, a Greek variable) is almost
      // always an attempted identifier: name the actual rule instead of a bare
      // "unexpected character" (bugs D8).
      if (/[^\x00-\x7F]/.test(c)) {
        throw new RoverError('Unexpected character "' + c + '": names must use ASCII letters (a to z, A to Z), digits and underscores.', line);
      }
      throw new RoverError('Unexpected character "' + c + '".', line);
    }
    return toks;
  }

  function parseExpr(src, line) {
    const toks = tokenize(src, line);
    let p = 0;
    const peek = () => toks[p];
    const next = () => toks[p++];
    const expect = (v) => {
      const tk = toks[p];
      if (!tk || tk.v !== v) throw new RoverError('Expected "' + v + '".', line);
      p++;
    };

    function parsePrimary() {
      const tk = peek();
      if (!tk) throw new RoverError('Unexpected end of expression.', line);
      let node;
      if (tk.t === 'num') { next(); node = { k: 'num', v: tk.v }; }
      else if (tk.t === 'str') { next(); node = { k: 'str', v: tk.v }; }
      else if (tk.v === '(') {
        next();
        const items = [parseTernaryless()];
        while (peek() && peek().v === ',') { next(); if (peek() && peek().v === ')') break; items.push(parseTernaryless()); }
        expect(')');
        node = items.length === 1 ? items[0] : { k: 'tuple', items: items };
      }
      else if (tk.v === '[') {
        next();
        const items = [];
        while (peek() && peek().v !== ']') { items.push(parseTernaryless()); if (peek() && peek().v === ',') next(); else break; }
        expect(']');
        node = { k: 'list', items: items };
      }
      else if (tk.t === 'name') {
        if (tk.v === 'True') { next(); return { k: 'bool', v: true }; }
        if (tk.v === 'False') { next(); return { k: 'bool', v: false }; }
        if (tk.v === 'None') { next(); return { k: 'none' }; }
        next();
        node = { k: 'name', v: tk.v };
      }
      else throw new RoverError('Unexpected token "' + (tk.v) + '".', line);
      // Trailers (attribute / call / subscript) apply to every atom, so a list
      // or string literal can be indexed directly, e.g. [1,2,3][0] or "abc"[1].
      return parseTrailers(node);
    }

    function parseTrailers(node) {
      while (peek()) {
        if (peek().v === '.') {
          next();
          const m = next();
          if (!m || m.t !== 'name') throw new RoverError('Expected attribute name after ".".', line);
          node = { k: 'attr', obj: node, name: m.v };
        } else if (peek().v === '(') {
          next();
          const args = [];
          while (peek() && peek().v !== ')') { args.push(parseTernaryless()); if (peek() && peek().v === ',') next(); else break; }
          expect(')');
          node = { k: 'call', callee: node, args: args };
        } else if (peek().v === '[') {
          // Subscript read: obj[index]. Slices (obj[a:b]) are not supported;
          // the ':' would fall through to the expression parser and error,
          // matching the file's honest-diagnostic standard rather than
          // silently returning a wrong value.
          next();
          const idx = parseTernaryless();
          expect(']');
          node = { k: 'index', obj: node, index: idx };
        } else break;
      }
      return node;
    }

    function parseUnary() {
      if (peek() && (peek().v === '-' || peek().v === '+')) {
        const op = next().v; return { k: 'unary', op: op, e: parseUnary() };
      }
      return parsePower();
    }
    function parsePower() {
      let left = parsePrimary();
      if (peek() && peek().v === '**') { next(); return { k: 'bin', op: '**', l: left, r: parseUnary() }; }
      return left;
    }
    function binLevel(ops, sub) {
      return function () {
        let left = sub();
        while (peek() && peek().t === 'op' && ops.indexOf(peek().v) >= 0) {
          const op = next().v; left = { k: 'bin', op: op, l: left, r: sub() };
        }
        return left;
      };
    }
    const parseMul = binLevel(['*', '/', '//', '%'], parseUnary);
    const parseAdd = binLevel(['+', '-'], parseMul);
    const parseCmp = function () {
      const first = parseAdd();
      // Python chains comparisons: `a < b < c` means `a < b and b < c`, with
      // every operand evaluated exactly once. Collect the whole chain into one
      // node (ops[] between operands[]) so the evaluator can short-circuit it.
      const ops = [];
      const operands = [first];
      while (peek() && peek().t === 'op' && ['<', '>', '<=', '>=', '==', '!='].indexOf(peek().v) >= 0) {
        ops.push(next().v);
        operands.push(parseAdd());
      }
      if (ops.length === 0) return first;
      return { k: 'cmp', ops: ops, operands: operands };
    };
    // `not` binds looser than comparison but tighter than `and` (Python order),
    // so `not a == b` means `not (a == b)`.
    function parseNot() {
      if (peek() && peek().t === 'name' && peek().v === 'not') { next(); return { k: 'not', e: parseNot() }; }
      return parseCmp();
    }
    function parseAnd() {
      let left = parseNot();
      while (peek() && peek().t === 'name' && peek().v === 'and') { next(); left = { k: 'and', l: left, r: parseNot() }; }
      return left;
    }
    function parseOr() {
      let left = parseAnd();
      while (peek() && peek().t === 'name' && peek().v === 'or') { next(); left = { k: 'or', l: left, r: parseAnd() }; }
      return left;
    }
    function parseTernaryless() { return parseOr(); }

    const result = parseTernaryless();
    if (p < toks.length) throw new RoverError('Unexpected token "' + toks[p].v + '".', line);
    return result;
  }

  // =========================================================================
  // 3. INTERPRETER (generator-based execution)
  // =========================================================================
  const BREAK = { signal: 'break' };
  const CONTINUE = { signal: 'continue' };
  const RETURN = { signal: 'return' };

  // Largest range()/list length we will materialize. Python builds ranges
  // lazily, so `for i in range(10**9)` costs nothing there; our sim eagerly
  // materializes the list in ONE host operation, which can OOM or hang the tab
  // before the per-statement MAX_STEPS guard can trip. Refuse anything larger
  // with an honest, line-numbered error instead of freezing the browser.
  const MAX_RANGE_LEN = 1000000;

  // Cap on the length of any string/list built by repeat (`*`) or concat (`+`).
  // The browser has no per-process memory limit the way the desktop Python
  // sandbox does (MAX_LITERAL_REPEAT), so an unbounded `'x' * 5e7` or a
  // `s = s + s` doubling loop could allocate gigabytes and hang the tab before
  // MAX_STEPS trips (each is one step). Matching MAX_RANGE_LEN keeps a
  // teaching program (tiny sequences) unaffected while refusing the abuse with
  // an honest, line-numbered error.
  const MAX_SEQ_LEN = 1000000;
  function capSeqLen(len, line) {
    if (len > MAX_SEQ_LEN) {
      throw new RoverError(
        'sequence too large (' + len + ' items; limit ' + MAX_SEQ_LEN + '). Build smaller sequences.',
        line,
      );
    }
    return len;
  }

  function makeBuiltins(host, lineOf) {
    // curLine getter so builtin diagnostics carry the 1-based source line, like
    // the rest of the interpreter's errors (defensive: null if not supplied).
    const at = function () { return typeof lineOf === 'function' ? lineOf() : null; };
    // Null prototype: `name in builtins` must not resolve Object.prototype
    // members (constructor, toString, ...) as callable builtins.
    return Object.assign(Object.create(null), {
      range: function (a, b, c) {
        let start = 0, stop, step = 1;
        if (b === undefined) stop = a; else { start = a; stop = b; if (c !== undefined) step = c; }
        // Python's range() takes only ints: a float arg or step is a TypeError,
        // and a zero step is a ValueError. Match that so the JS sim agrees with
        // the grader instead of silently iterating fractional ranges.
        for (const v of [start, stop, step]) {
          if (!Number.isInteger(Number(v))) {
            throw new RoverError("'float' object cannot be interpreted as an integer", at());
          }
        }
        if (step === 0) throw new RoverError('range() arg 3 must not be zero', at());
        // Reject an over-large range BEFORE building the array: compute how many
        // elements it would yield and refuse past MAX_RANGE_LEN, so a huge count
        // fails fast with a clear message rather than materializing a giant list.
        const span = step > 0 ? stop - start : start - stop;
        const count = span > 0 ? Math.ceil(span / Math.abs(step)) : 0;
        if (count > MAX_RANGE_LEN) {
          throw new RoverError('range() is too large (max ' + MAX_RANGE_LEN + '); use a smaller count.', at());
        }
        const arr = [];
        if (step > 0) for (let i = start; i < stop; i += step) arr.push(i);
        else for (let i = start; i > stop; i += step) arr.push(i);
        return arr;
      },
      // CPython len(): strings and lists/tuples report their length, and an
      // EMPTY one is 0 -- len("") == 0, len([]) == 0 -- not an error. The old
      // truthiness guard (`x && ...`) treated the empty string as falsy and
      // threw, diverging from the grader (which runs real `len`). Test by TYPE
      // so a zero-length size passes through instead of tripping the guard.
      len: x => {
        if (typeof x === 'string' || Array.isArray(x)) return x.length;
        throw new RoverError('len() needs a list or text.', at());
      },
      int: x => pyInt(x),
      float: x => pyFloat(x),
      str: x => pyStr(x),
      abs: x => Math.abs(x),
      round: (x, d) => pyRound(x, d),
      // Python min()/max() accept either several args or a single iterable.
      // Loop rather than Math.min/max.apply: apply() pushes every element as a
      // JS stack argument, so a large iterable (~120k+) blew the native stack
      // with a raw RangeError. The loop handles any capped-size list.
      min: function () {
        let a = [].slice.call(arguments); if (a.length === 1 && Array.isArray(a[0])) a = a[0];
        if (!a.length) throw new RoverError('min() arg is an empty sequence', at());
        let m = a[0]; for (let i = 1; i < a.length; i++) if (a[i] < m) m = a[i];
        return m;
      },
      max: function () {
        let a = [].slice.call(arguments); if (a.length === 1 && Array.isArray(a[0])) a = a[0];
        if (!a.length) throw new RoverError('max() arg is an empty sequence', at());
        let m = a[0]; for (let i = 1; i < a.length; i++) if (a[i] > m) m = a[i];
        return m;
      },
      sqrt: x => Math.sqrt(x),
      // Deterministic when the host supplies a seeded PRNG (the scenario grader
      // does): a graded program that calls random() then reproduces exactly for
      // a given seed, upholding the "a fixed seed reproduces a run" contract.
      // Live play has no host.rng, so it stays truly random.
      random: () => (host && typeof host.rng === 'function' ? host.rng() : Math.random())
    });
  }

  function pyStr(v) {
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (v === null || v === undefined) return 'None';
    if (Array.isArray(v)) return '[' + v.map(pyStr).join(', ') + ']';
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return String(v);
      // Emit the full double repr (String(v)) so e.g. print(1/3) matches
      // Python's '0.3333333333333333' rather than the old 6-digit truncation.
      // Known modelling gap (out of scope): we do not track int vs float, so
      // 4/2 prints '2' here where CPython prints '2.0'.
      return String(v);
    }
    return String(v);
  }

  // round() with Python's banker's rounding (round half to even) for both the
  // no-digit and d-digit forms, so the JS sim agrees with the grader. The
  // `d != null` test (not `d ?`) routes round(x, 0) through the digit path.
  function pyRound(x, d) {
    const n = Number(x);
    if (d != null) {
      const f = Math.pow(10, d);
      return roundHalfToEven(n * f) / f;
    }
    return roundHalfToEven(n);
  }
  function roundHalfToEven(n) {
    const floor = Math.floor(n);
    const diff = n - floor;
    if (diff < 0.5) return floor;
    if (diff > 0.5) return floor + 1;
    // Exactly halfway: round to the even neighbour.
    return (floor % 2 === 0) ? floor : floor + 1;
  }

  // int()/float() guard non-numeric strings with a value-error diagnostic. The
  // graded Python sandbox does not even expose int/float, so this is purely a
  // pupil-facing message, not a CPython-conformance claim. Numeric args keep
  // the prior Math.trunc / Number behaviour.
  function pyFloat(x) {
    if (typeof x === 'string') {
      const n = Number(x.trim());
      if (Number.isNaN(n) || x.trim() === '') {
        throw new RoverError('cannot convert "' + x + '" to a number');
      }
      return n;
    }
    return Number(x);
  }
  function pyInt(x) {
    if (typeof x === 'string') {
      const s = x.trim();
      if (!/^[+-]?\d+$/.test(s)) {
        throw new RoverError('cannot convert "' + x + '" to a whole number');
      }
      return parseInt(s, 10);
    }
    return Math.trunc(Number(x));
  }

  function truthy(v) {
    if (Array.isArray(v)) return v.length > 0;
    return !!v;
  }

  // Build the interpreter object from source. Throws RoverError on parse error.
  function compile(source) {
    let program = buildBlocks(source);
    program = linkConditionals(program);
    return {
      program: program,
      // run returns a generator. host = { sensor(name,args), motion(ev) optional }
      run: function* (host) {
        const builtins = makeBuiltins(host, function () { return curLine; });
        // Scope frames: `scope` points at the ACTIVE frame. Top level runs in
        // globalScope; each user-function call pushes a fresh frame chained to
        // globalScope via the prototype (reads fall through to globals, writes
        // stay local) - Python function semantics, no dynamic scoping.
        const globalScope = Object.create(null);
        let scope = globalScope;
        // Names the ACTIVE frame declared `global`; their assignments write to
        // globalScope instead of the local frame. null/empty at module level.
        let curGlobals = null;
        function setVar(name, value) {
          if (scope !== globalScope && curGlobals && curGlobals.has(name)) globalScope[name] = value;
          else scope[name] = value;
        }
        const funcs = Object.create(null);
        let steps = 0;
        const MAX_STEPS = 200000;
        // Guard user-function recursion: the native JS stack overflows around
        // ~2000 nested generator frames (before MAX_STEPS can trip), throwing a
        // raw RangeError with no line number. Cap call depth well under that and
        // surface a wrapped RoverError instead, matching Python's RecursionError.
        let callDepth = 0;
        const MAX_CALL_DEPTH = 400;

        // Bounded, serialisable variable snapshots travel with interpreter
        // events so the learning studio can show values from the exact run
        // instead of asking a model to guess them.
        function snapshotVars() {
          const visible = Object.create(null);
          Object.keys(globalScope).forEach(function (name) { visible[name] = globalScope[name]; });
          if (scope !== globalScope) Object.keys(scope).forEach(function (name) { visible[name] = scope[name]; });
          const out = {};
          Object.keys(visible).sort().slice(0, 24).forEach(function (name) {
            if (name.indexOf('__') === 0) return;
            const value = visible[name];
            if (typeof value === 'number' || typeof value === 'boolean' || value === null) out[name] = value;
            else if (typeof value === 'string') out[name] = value.slice(0, 120);
            else if (Array.isArray(value)) {
              out[name] = value.slice(0, 12).map(function (item) {
                return (typeof item === 'number' || typeof item === 'boolean' || typeof item === 'string' || item === null)
                  ? item : String(item).slice(0, 80);
              });
            }
          });
          return out;
        }
        function event(payload) {
          return Object.assign({}, payload, { vars: snapshotVars() });
        }

        function evalExpr(node) {
          switch (node.k) {
            case 'num': return node.v;
            case 'str': return node.v;
            case 'bool': return node.v;
            case 'none': return null;
            case 'list': return node.items.map(evalExpr);
            case 'tuple': return node.items.map(evalExpr);
            case 'name':
              if (node.v in scope) return scope[node.v];
              if (node.v in builtins) return builtins[node.v];
              if (node.v === 'rover') return { __rover: true };
              throw new RoverError('Name "' + node.v + '" is not defined.', curLine);
            case 'unary': { const e = evalExpr(node.e); return node.op === '-' ? -e : +e; }
            case 'not': return !truthy(evalExpr(node.e));
            case 'and': { const l = evalExpr(node.l); return truthy(l) ? evalExpr(node.r) : l; }
            case 'or': { const l = evalExpr(node.l); return truthy(l) ? l : evalExpr(node.r); }
            case 'bin': return binop(node.op, evalExpr(node.l), evalExpr(node.r), curLine);
            case 'cmp': {
              // Chained comparison a<b<c == (a<b) and (b<c), each operand
              // evaluated exactly once, short-circuiting on the first false.
              let prev = evalExpr(node.operands[0]);
              for (let ci = 0; ci < node.ops.length; ci++) {
                const rhs = evalExpr(node.operands[ci + 1]);
                if (!truthy(compare(node.ops[ci], prev, rhs, curLine))) return false;
                prev = rhs;
              }
              return true;
            }
            case 'attr': return { __attr: true, obj: evalExpr(node.obj), name: node.name, node: node };
            case 'index': return pyIndex(evalExpr(node.obj), evalExpr(node.index), curLine);
            case 'call': return evalCall(node);
            default: throw new RoverError('Cannot evaluate expression.', curLine);
          }
        }

        function evalCall(node) {
          const callee = node.callee;
          // rover.<sensor>(...) inside an expression
          if (callee.k === 'attr' && isRoverRef(callee.obj)) {
            const name = callee.name;
            if (name in SENSOR_METHODS) {
              const args = node.args.map(evalExpr);
              return host.sensor(name, args, curLine);
            }
            if (name in MOTION_METHODS) {
              // Motion used as a value: ignore movement, return None.
              return null;
            }
            throw new RoverError('rover has no method "' + name + '".', curLine);
          }
          // Bare-verb RoboLearn sensor functions used in an expression, e.g.
          // `if obstacle_ahead():` or `d = distance()`.
          if (callee.k === 'name' && !(callee.v in scope) && !funcs[callee.v]) {
            const v = callee.v;
            if (v in LESSON_SENSOR) return host.sensor(LESSON_SENSOR[v], node.args.map(evalExpr), curLine);
            if (v in LESSON_API && host && typeof host.lessonApi === 'function') {
              return host.lessonApi(v, node.args.map(evalExpr), curLine);
            }
            if (v === 'obstacle_ahead') {
              const d = host.sensor('distance', [], curLine);
              return typeof d === 'number' && d < OBSTACLE_AHEAD_CM;
            }
            if (v === 'sample_detected') return false;  // JS sim has no samples; Python grades them
            if (v === 'at_base') {
              const bx = host.sensor('x', [], curLine), by = host.sensor('y', [], curLine);
              return typeof bx === 'number' && typeof by === 'number'
                ? Math.hypot(bx, by) < AT_BASE_CM : true;
            }
            if (v in LESSON_MOTION || v === 'beep' || v === 'log'
                || v === 'collect_sample' || v === 'drop_sample'
                || v === 'place' || v === 'clear_props') {
              return null;  // an action used as a value -> None
            }
          }
          // User-defined function used as a value, e.g. `area = double(5)`.
          // Run its body synchronously (animation events are produced but
          // ignored in an expression) and return its `return` value -- this
          // matches the Python engine, which evaluates such calls fine.
          if (callee.k === 'name' && funcs[callee.v]) {
            const ufn = funcs[callee.v];
            const uargs = node.args.map(evalExpr);
            // Python function semantics: a fresh LOCAL frame chained to the
            // GLOBAL scope for reads (never the caller's locals - Python is
            // not dynamically scoped). Writes land on the frame, so a callee
            // can no longer clobber a caller's variable and each recursive
            // call keeps its own locals.
            const callerScope = scope, callerGlobals = curGlobals;
            scope = Object.create(globalScope); curGlobals = null;
            ufn.params.forEach((pn, i) => { scope[pn] = uargs[i]; });
            let rv = null;
            callDepth++;
            // The whole body runs inside ONE synchronous gen.next() here
            // (expression context cannot yield). The deterministic caps
            // (MAX_STEPS, loop guards) bound the statement count, but a
            // per-statement heavy operation could still wedge the tab beyond
            // Pause/Reset, so a wall-clock backstop throws instead.
            let drained = 0;
            const drainT0 = Date.now();
            try {
              if (callDepth > MAX_CALL_DEPTH) throw new RoverError('Recursion too deep (over ' + MAX_CALL_DEPTH + ' nested calls; check for a missing base case).', curLine);
              for (const _ev of execBlock(ufn.body)) {
                void _ev;
                if ((++drained & 2047) === 0 && Date.now() - drainT0 > 2000) {
                  throw new RoverError('Function "' + callee.v + '" ran too long inside an expression (2 second limit). Call it on its own line, or simplify it.', curLine);
                }
              }
            } catch (e) {
              if (e === RETURN) { rv = RETURN.value; }
              else { throw e; }
            } finally {
              callDepth--;
              scope = callerScope; curGlobals = callerGlobals;
            }
            return rv;
          }
          const fn = evalExpr(callee);
          const args = node.args.map(evalExpr);
          if (typeof fn === 'function') return fn.apply(null, args);
          // A method call reaches here with an 'attr' callee, and describe()
          // returned the internal AST node kind, so the pupil saw
          // '"attr" is not callable.' Name the real limitation instead: the
          // Python engine runs xs.append(...) and "s".upper(), this one does
          // not, so the message must say so rather than leak an AST tag.
          if (callee && callee.k === 'attr') {
            throw new RoverError('Method calls like .' + (callee.name || callee.attr || 'method')
              + '() are not supported in the browser engine. Use the built-in commands instead.', curLine);
          }
          throw new RoverError('"' + describe(callee) + '" is not callable.', curLine);
        }

        function isRoverRef(node) {
          if (node.k === 'name' && node.v === 'rover' && !(node.v in scope)) return true;
          return false;
        }

        let curLine = 1;

        function* execBlock(stmts) {
          for (let i = 0; i < stmts.length; i++) {
            yield* execStmt(stmts[i]);
          }
        }

        function* execStmt(s) {
          if (++steps > MAX_STEPS) throw new RoverError('Program ran too long (possible infinite loop).', s.line);
          curLine = s.line;
          switch (s.kind) {
            case 'pass': yield event({ type: 'step', line: s.line }); return;
            case 'break': throw BREAK;
            case 'continue': throw CONTINUE;
            case 'global': {
              if (scope !== globalScope) { if (!curGlobals) curGlobals = new Set(); s.names.forEach(n => curGlobals.add(n)); }
              yield event({ type: 'step', line: s.line }); return;
            }
            case 'assign': setVar(s.target, evalExpr(s.expr)); yield event({ type: 'step', line: s.line }); return;
            case 'augassign': {
              // Python raises NameError for `x += 1` with x undefined; the old
              // silent base-0 default masked real pupil mistakes and diverged
              // from the grader's engine.
              if (!(s.target in scope)) throw new RoverError('Name "' + s.target + '" is not defined.', s.line);
              setVar(s.target, binop(s.op, scope[s.target], evalExpr(s.expr), s.line));
              yield event({ type: 'step', line: s.line }); return;
            }
            case 'expr': {
              yield* execExprStmt(s.expr, s.line); return;
            }
            case 'for': {
              const iter = evalExpr(s.iter);
              // Strings are iterable in Python (for ch in word), so iterate
              // their characters; lists/tuples/range() are already arrays.
              // Anything else -- a number, None, a bool -- is NOT iterable:
              // CPython raises "TypeError: 'int' object is not iterable". The
              // old code silently coerced it to an empty list and no-op'd the
              // loop, diverging from the grader; raise instead, line-numbered
              // like the subscript diagnostic (pyTypeName gives 'int'/'NoneType').
              let list;
              if (Array.isArray(iter)) list = iter;
              else if (typeof iter === 'string') list = iter.split('');
              else throw new RoverError("'" + pyTypeName(iter) + "' object is not iterable", s.line);
              for (let i = 0; i < list.length; i++) {
                scope[s.varName] = list[i];
                yield event({ type: 'step', line: s.line });
                try { yield* execBlock(s.body); }
                catch (e) { if (e === BREAK) break; if (e === CONTINUE) continue; throw e; }
              }
              return;
            }
            case 'while': {
              let guard = 0;
              while (truthy(evalExpr(s.test))) {
                if (++guard > 100000) throw new RoverError('while loop ran too long.', s.line);
                yield event({ type: 'step', line: s.line });
                try { yield* execBlock(s.body); }
                catch (e) { if (e === BREAK) break; if (e === CONTINUE) continue; throw e; }
              }
              return;
            }
            case 'if': {
              for (const b of s.branches) {
                if (truthy(evalExpr(b.test))) { yield event({ type: 'step', line: s.line }); yield* execBlock(b.body); return; }
              }
              if (s.orelse) { yield event({ type: 'step', line: s.line }); yield* execBlock(s.orelse); }
              return;
            }
            case 'def': funcs[s.name] = s; yield event({ type: 'step', line: s.line }); return;
            case 'return':  // carry the value + unwind to the enclosing call
              RETURN.value = s.expr ? evalExpr(s.expr) : null;
              throw RETURN;
            default: throw new RoverError('Unknown statement.', s.line);
          }
        }

        // Expression statement: detect rover motion or print; else evaluate.
        function* execExprStmt(expr, line) {
          if (expr.k === 'call') {
            const callee = expr.callee;
            // rover.<motion>(...)
            if (callee.k === 'attr' && callee.obj.k === 'name' && callee.obj.v === 'rover' && !(scope['rover'])) {
              const name = callee.name;
              if (name in MOTION_METHODS) {
                const args = expr.args.map(evalExpr);
                yield motionEvent(name, args, line);
                return;
              }
              if (name in SENSOR_METHODS) { host.sensor(name, expr.args.map(evalExpr), line); yield event({ type: 'step', line: line }); return; }
              throw new RoverError('rover has no method "' + name + '".', line);
            }
            // Bare-verb RoboLearn lesson API on its own line.
            if (callee.k === 'name' && !(callee.v in scope) && !funcs[callee.v]) {
              const v = callee.v;
              if (v === 'move_forward' || v === 'move_backward') {
                // Default to 1 m when omitted; motionEvent clamps the magnitude
                // (incl. non-finite from e.g. `move_forward(10 ** 400)`).
                const metres = expr.args.length ? evalExpr(expr.args[0]) : 1;
                yield motionEvent(LESSON_MOTION[v], [metres * 100], line);  // m -> cm
                return;
              }
              if (v in LESSON_MOTION) { yield motionEvent(LESSON_MOTION[v], expr.args.map(evalExpr), line); return; }
              if (v in LESSON_SENSOR) { host.sensor(LESSON_SENSOR[v], expr.args.map(evalExpr), line); yield event({ type: 'step', line: line }); return; }
              if (v in LESSON_API && host && typeof host.lessonApi === 'function') {
                host.lessonApi(v, expr.args.map(evalExpr), line);
                yield event({ type: 'step', line: line });
                return;
              }
              if (v === 'beep') {
                // S3: beep() is a real, audible event now, not console spam.
                // times clamps 0..16, mirroring the Python API's beep clamp
                // (rover_api._MAX_BEEP_TIMES); QA hosts ignore the new type.
                const bt = expr.args.length ? evalExpr(expr.args[0]) : 1;
                yield event({ type: 'beep', times: clampNum(bt, 0, 16, 1), line: line });
                return;
              }
              if (v === 'log') { const a = expr.args.map(evalExpr); yield event({ type: 'print', line: line, text: a.map(pyStr).join(' ') }); return; }
              if (v === 'collect_sample') { yield event({ type: 'print', line: line, text: 'Sample collected.' }); return; }
              if (v === 'drop_sample') { yield event({ type: 'print', line: line, text: 'Sample dropped.' }); return; }
              // World-building: place(kind) at the rover, or place(kind, x_m, y_m).
              if (v === 'place') {
                const a = expr.args.map(evalExpr);
                const kind = a.length ? String(a[0]) : 'flag';
                const ev = { type: 'place', kind: kind, line: line };
                if (a.length >= 3) { ev.x = clampNum(a[1], -15, 15, 0) * 100; ev.y = clampNum(a[2], -15, 15, 0) * 100; }
                yield event(ev);
                return;
              }
              if (v === 'clear_props') { yield event({ type: 'clear_props', line: line }); return; }
              if (v === 'obstacle_ahead' || v === 'sample_detected' || v === 'at_base') { yield event({ type: 'step', line: line }); return; }
            }
            // print(...)
            if (callee.k === 'name' && callee.v === 'print') {
              const args = expr.args.map(evalExpr);
              yield event({ type: 'print', line: line, text: args.map(pyStr).join(' ') });
              return;
            }
            // user function call on its own line -> execute its body (may move)
            if (callee.k === 'name' && funcs[callee.v]) {
              const fn = funcs[callee.v];
              const args = expr.args.map(evalExpr);
              // Fresh local frame chained to GLOBALS (see the expression-call
              // twin in evalCall): body writes stay local to this call, and
              // duplicate parameter names can no longer corrupt a global on
              // restore because there is no save/restore at all.
              const callerScope = scope, callerGlobals = curGlobals;
              scope = Object.create(globalScope); curGlobals = null;
              fn.params.forEach((pn, idx) => { scope[pn] = args[idx]; });
              yield event({ type: 'step', line: line });
              callDepth++;
              try {
                if (callDepth > MAX_CALL_DEPTH) throw new RoverError('Recursion too deep (over ' + MAX_CALL_DEPTH + ' nested calls; check for a missing base case).', line);
                yield* execBlock(fn.body);
              }
              catch (e) { if (e !== RETURN) throw e; }
              finally { callDepth--; scope = callerScope; curGlobals = callerGlobals; }
              return;
            }
          }
          // fallback: evaluate for side effects
          evalExpr(expr);
          yield event({ type: 'step', line: line });
        }

        function motionEvent(name, args, line) {
          switch (name) {
            case 'forward': return event({ type: 'move', dir: 1, distance: clampNum(args[0], 0, 4000, 100), line: line });
            case 'backward': return event({ type: 'move', dir: -1, distance: clampNum(args[0], 0, 4000, 100), line: line });
            case 'turn_right': return event({ type: 'turn', deg: clampNum(args[0], -3600, 3600, 90), line: line });
            case 'turn_left': return event({ type: 'turn', deg: -clampNum(args[0], -3600, 3600, 90), line: line });
            case 'set_speed': return event({ type: 'speed', value: clampNum(args[0], 0, 100, 50), line: line });
            case 'wait': case 'sleep': return event({ type: 'wait', seconds: clampNum(args[0], 0, 10, 1), line: line });
            case 'pen_down': return event({ type: 'pen', down: true, line: line });
            case 'pen_up': return event({ type: 'pen', down: false, line: line });
            case 'stop': return event({ type: 'halt', line: line });
            case 'led': return event({ type: 'led', color: args[0] != null ? String(args[0]) : 'cyan', line: line });
            case 'say': return event({ type: 'say', text: args.map(pyStr).join(' '), line: line });
            case 'scan': return event({ type: 'scan', line: line });
          }
          return event({ type: 'step', line: line });
        }

        // Surface stray control-flow sentinels as real diagnostics instead of
        // leaking "[object Object]" to the host. (CPython rejects these at
        // compile time; this subset reports them at runtime, same wording.)
        try {
          yield* execBlock(program);
        } catch (e) {
          if (e === BREAK) throw new RoverError("'break' outside loop", curLine);
          if (e === CONTINUE) throw new RoverError("'continue' not properly in loop", curLine);
          if (e === RETURN) throw new RoverError("'return' outside function", curLine);
          throw e;
        }
      }
    };
  }

  // Clamp a pupil-supplied magnitude into [lo, hi]. A *missing* argument
  // (undefined) falls back to `dflt`; a *present* but non-finite value (NaN or
  // +/-Infinity) maps to the lower bound `lo`. A pupil can reach non-finite two
  // ways: an overflowing power such as `forward(10 ** 400)`, or an e-notation
  // literal the tokenizer accepts but that overflows a double (e.g. `1e309`
  // parses to Infinity). The clamp handles both. This mirrors the Python
  // engine's rover_api._clamp_finite so the animated and graded paths agree,
  // and guarantees a finite magnitude so the value can never overflow app.jsx's
  // animation duration and soft-hang the UI.
  function clampNum(v, lo, hi, dflt) {
    const n = (v === undefined) ? dflt : Number(v);
    if (!isFinite(n)) return lo;            // NaN / +/-Infinity -> lower bound
    return Math.max(lo, Math.min(hi, n));
  }
  // Frame-loop progress guard shared with app.jsx animateMove/animateTurn:
  // returns progress in [0, 1] for `elapsedMs` of a `durationMs` animation. A
  // non-finite or non-positive duration completes immediately (1) so a frame
  // loop can never wedge at p=0 forever (defence-in-depth behind clampNum).
  function frameProgress(elapsedMs, durationMs) {
    if (!(durationMs > 0) || !isFinite(durationMs)) return 1;
    const p = elapsedMs / durationMs;
    return p < 0 ? 0 : (p > 1 ? 1 : p);
  }
  function describe(node) { return node.k === 'name' ? node.v : node.k; }

  // Python type name for a value, used in subscript diagnostics so the message
  // reads like the grader's ("'int' object is not subscriptable").
  function pyTypeName(v) {
    if (v === null || v === undefined) return 'NoneType';
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
    if (typeof v === 'string') return 'str';
    if (Array.isArray(v)) return 'list';
    return 'object';
  }

  // Subscript read obj[idx] with CPython semantics, so the sim agrees with the
  // grader (which runs real `exec`): only lists and strings are subscriptable;
  // the index must be an int (a bool counts as 0/1); a negative index counts
  // from the end; an out-of-range index raises (IndexError-style) with the
  // 1-based source line. Slices are not implemented (parser rejects the ':').
  function pyIndex(obj, idx, line) {
    if (typeof obj === 'string' || Array.isArray(obj)) {
      const container = Array.isArray(obj) ? 'list' : 'string';
      let i = idx;
      if (typeof i === 'boolean') i = i ? 1 : 0;
      if (typeof i !== 'number' || !Number.isInteger(i)) {
        throw new RoverError(container + ' indices must be integers, not ' + pyTypeName(idx), line);
      }
      const len = obj.length;
      const k = i < 0 ? i + len : i;   // negative index counts from the end
      if (k < 0 || k >= len) {
        throw new RoverError(container + ' index out of range', line);
      }
      return obj[k];
    }
    throw new RoverError("'" + pyTypeName(obj) + "' object is not subscriptable", line);
  }

  function binop(op, l, r, line) {
    if (op === '+') {
      if (typeof l === 'string' || typeof r === 'string') {
        // Python does NOT coerce for '+': "moved " + 3 is a TypeError, not
        // "moved 3". Concatenating silently let a program pass in the browser
        // and fail on the Python engine from the SAME source, which breaks the
        // parity the rest of this file maintains ('*' already raises). The
        // message matches CPython so the two engines read identically.
        if (typeof l !== typeof r) {
          const bad = typeof l === 'string' ? r : l;
          throw new RoverError('can only concatenate str (not "' + pyTypeName(bad) + '") to str', line);
        }
        const s = pyStr(l) + pyStr(r);
        capSeqLen(s.length, line); // F1: refuse a `s = s + s` doubling-to-OOM loop
        return s;
      }
      if (Array.isArray(l) && Array.isArray(r)) {
        capSeqLen(l.length + r.length, line);
        return l.concat(r);
      }
      return l + r;
    }
    // Python raises ZeroDivisionError for /, // and % by zero; JS would give
    // Infinity/NaN, so raise here to match the grader and surface a diagnostic.
    if ((op === '/' || op === '//' || op === '%') && r === 0) {
      throw new RoverError('division by zero', line);
    }
    switch (op) {
      case '-': return l - r;
      case '*': {
        // Python sequence-repeat, both operand orders, so the in-browser branch
        // agrees with the Python grader instead of truncating or returning NaN:
        // 'x'*3 and 3*'x' both repeat; a bool counts as 0/1 (True*'x' -> 'x');
        // a float multiplier raises like range() does ('x'*2.5 -> TypeError in
        // CPython) rather than silently truncating.
        var lStr = typeof l === 'string', rStr = typeof r === 'string';
        var lArr = Array.isArray(l), rArr = Array.isArray(r);
        if (lStr || rStr || lArr || rArr) {
          if ((lStr && rStr) || (lArr && rArr)) throw new RoverError("can't multiply sequence by non-int of type 'str'", line);
          var seq = (lStr || lArr) ? l : r;
          var n = (lStr || lArr) ? r : l;
          if (typeof n === 'boolean') n = n ? 1 : 0;
          if (typeof n !== 'number' || !Number.isInteger(n)) throw new RoverError("can't multiply sequence by non-int of type 'float'", line);
          n = Math.max(0, n);
          // F1: bound the allocation BEFORE building the sequence.
          var total = seq.length * n;
          capSeqLen(total, line);
          if (typeof seq === 'string') return seq.repeat(n);
          // F2: list/tuple repeat -- Python builds [x]*3 -> [x,x,x]. Built by
          // PREALLOCATED fill: the old concat-in-a-loop was O(n^2) element
          // copying, so a capped-but-large repeat ([0] * 1000000) still wedged
          // the tab for minutes even though the memory cap had passed.
          var out = new Array(total);
          for (var i = 0; i < total; i++) out[i] = seq[i % seq.length];
          return out;
        }
        return l * r;
      }
      case '/': return l / r;
      case '//': return Math.floor(l / r);
      case '%': return ((l % r) + r) % r;
      case '**': return Math.pow(l, r);
    }
    throw new RoverError('Unknown operator "' + op + '".', line);
  }
  // Python-style equality: True==1 / False==0 and element-wise list/tuple
  // compare, so the in-browser branch matches what the Python grader scores.
  function pyEqual(a, b) {
    if (typeof a === 'boolean') a = a ? 1 : 0;
    if (typeof b === 'boolean') b = b ? 1 : 0;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!pyEqual(a[i], b[i])) return false;
      return true;
    }
    return a === b;
  }
  function compare(op, l, r, line) {
    if (op === '==') return pyEqual(l, r);
    if (op === '!=') return !pyEqual(l, r);
    // Ordering (<, >, <=, >=): Python only orders number-vs-number (bool counts
    // as int) or str-vs-str; mixing types, or comparing with None, raises a
    // TypeError. Match that so the in-browser branch agrees with the Python
    // grader instead of silently coercing (e.g. 1 < "a" -> false in raw JS).
    var lo = typeof l === 'number' || typeof l === 'boolean';
    var ro = typeof r === 'number' || typeof r === 'boolean';
    var ls = typeof l === 'string';
    var rs = typeof r === 'string';
    if (!((lo && ro) || (ls && rs))) {
      throw new RoverError("'" + op + "' not supported between those types", line);
    }
    switch (op) {
      case '<': return l < r;
      case '>': return l > r;
      case '<=': return l <= r;
      case '>=': return l >= r;
    }
    return false;
  }

  window.RoverLang = {
    compile: compile,
    RoverError: RoverError,
    MOTION_METHODS: MOTION_METHODS,
    SENSOR_METHODS: SENSOR_METHODS,
    pyStr: pyStr,
    frameProgress: frameProgress
  };
})();
