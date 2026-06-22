/* ============================================================================
   ORBITAL ROVER — Python-subset interpreter
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

  const MOTION_METHODS = {
    forward: 'move', backward: 'move',
    turn_right: 'turn', turn_left: 'turn',
    set_speed: 'speed', wait: 'wait', sleep: 'wait',
    pen_down: 'pen', pen_up: 'pen', stop: 'halt',
    led: 'led', say: 'say', scan: 'scan'
  };
  const SENSOR_METHODS = {
    distance: 1, heading: 1, battery: 1, speed: 1, tilt: 1,
    temperature: 1, x: 1, y: 1, ground: 1, light: 1, gravity: 1
  };

  // RoboLearn lesson API (bare verbs used by every lesson YAML) mapped onto
  // the design's motion/sensor handlers, so lesson starter code RUNS on
  // screen and matches what the Python grader scores. move_forward/backward
  // take METRES (the lesson + grader unit); the design world is in cm, so we
  // scale x100 below. Everything else shares units (degrees, 0-100 speed).
  const LESSON_MOTION = {
    move_forward: 'forward', move_backward: 'backward',
    turn_left: 'turn_left', turn_right: 'turn_right',
    set_speed: 'set_speed', pen_down: 'pen_down', pen_up: 'pen_up',
    wait: 'wait', sleep: 'sleep', stop: 'stop',
    scan: 'scan', led: 'led', say: 'say'
  };
  const LESSON_SENSOR = {
    distance: 'distance', heading: 'heading', battery: 'battery',
    gravity: 'gravity', temperature: 'temperature', ground: 'ground', light: 'light',
    // Python pupil-API sensor names (lessons use these) -> design sensors.
    read_distance: 'distance', read_heading: 'heading', read_battery: 'battery',
    read_colour: 'ground'
  };
  const OBSTACLE_AHEAD_CM = 40;
  const AT_BASE_CM = 20;

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
          if (ch === q && text[c - 1] !== '\\') inStr = false;
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
      return { kind: 'def', name: m[1], params: params, body: body, line: line };
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
        throw new RoverError('Can only assign to a simple variable name.', line);
      }
      return { kind: 'assign', target: target, expr: parseExpr(text.slice(eq + 1), line), line: line };
    }
    if (text === 'break') return { kind: 'break', line: line };
    if (text === 'continue') return { kind: 'continue', line: line };
    if (text === 'pass') return { kind: 'pass', line: line };
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
          if (src[j] === '\\' && j + 1 < n) { s += src[j + 1]; j += 2; }
          else { s += src[j]; j++; }
        }
        if (j >= n) throw new RoverError('Unterminated string.', line);
        toks.push({ t: 'str', v: s }); i = j + 1; continue;
      }
      // multi-char operators
      const two = src.substr(i, 2);
      if (['==', '!=', '<=', '>=', '//', '**'].indexOf(two) >= 0) { toks.push({ t: 'op', v: two }); i += 2; continue; }
      if ('+-*/%<>().,[]'.indexOf(c) >= 0) { toks.push({ t: 'op', v: c }); i++; continue; }
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
      if (tk.t === 'num') { next(); return { k: 'num', v: tk.v }; }
      if (tk.t === 'str') { next(); return { k: 'str', v: tk.v }; }
      if (tk.v === '(') {
        next();
        const items = [parseTernaryless()];
        while (peek() && peek().v === ',') { next(); if (peek() && peek().v === ')') break; items.push(parseTernaryless()); }
        expect(')');
        return items.length === 1 ? items[0] : { k: 'tuple', items: items };
      }
      if (tk.v === '[') {
        next();
        const items = [];
        while (peek() && peek().v !== ']') { items.push(parseTernaryless()); if (peek() && peek().v === ',') next(); else break; }
        expect(']');
        return { k: 'list', items: items };
      }
      if (tk.t === 'name') {
        if (tk.v === 'True') { next(); return { k: 'bool', v: true }; }
        if (tk.v === 'False') { next(); return { k: 'bool', v: false }; }
        if (tk.v === 'None') { next(); return { k: 'none' }; }
        next();
        let node = { k: 'name', v: tk.v };
        node = parseTrailers(node);
        return node;
      }
      throw new RoverError('Unexpected token "' + (tk.v) + '".', line);
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

  function makeBuiltins(host) {
    return {
      range: function (a, b, c) {
        let start = 0, stop, step = 1;
        if (b === undefined) stop = a; else { start = a; stop = b; if (c !== undefined) step = c; }
        // Python's range() takes only ints: a float arg or step is a TypeError,
        // and a zero step is a ValueError. Match that so the JS sim agrees with
        // the grader instead of silently iterating fractional ranges.
        for (const v of [start, stop, step]) {
          if (!Number.isInteger(Number(v))) {
            throw new RoverError("'float' object cannot be interpreted as an integer");
          }
        }
        if (step === 0) throw new RoverError('range() arg 3 must not be zero');
        const arr = [];
        if (step > 0) for (let i = start; i < stop; i += step) arr.push(i);
        else for (let i = start; i > stop; i += step) arr.push(i);
        return arr;
      },
      len: x => { if (x && x.length != null) return x.length; throw new RoverError('len() needs a list or text.'); },
      int: x => pyInt(x),
      float: x => pyFloat(x),
      str: x => pyStr(x),
      abs: x => Math.abs(x),
      round: (x, d) => pyRound(x, d),
      // Python min()/max() accept either several args or a single iterable.
      min: function () { let a = [].slice.call(arguments); if (a.length === 1 && Array.isArray(a[0])) a = a[0]; return Math.min.apply(null, a); },
      max: function () { let a = [].slice.call(arguments); if (a.length === 1 && Array.isArray(a[0])) a = a[0]; return Math.max.apply(null, a); },
      sqrt: x => Math.sqrt(x),
      random: () => Math.random()
    };
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
        const builtins = makeBuiltins(host);
        const scope = Object.create(null);
        const funcs = Object.create(null);
        let steps = 0;
        const MAX_STEPS = 200000;

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
                if (!truthy(compare(node.ops[ci], prev, rhs))) return false;
                prev = rhs;
              }
              return true;
            }
            case 'attr': return { __attr: true, obj: evalExpr(node.obj), name: node.name, node: node };
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
              return host.sensor(name, args);
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
            if (v in LESSON_SENSOR) return host.sensor(LESSON_SENSOR[v], node.args.map(evalExpr));
            if (v === 'obstacle_ahead') {
              const d = host.sensor('distance', []);
              return typeof d === 'number' && d < OBSTACLE_AHEAD_CM;
            }
            if (v === 'sample_detected') return false;  // JS sim has no samples; Python grades them
            if (v === 'at_base') {
              const bx = host.sensor('x', []), by = host.sensor('y', []);
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
            const usaved = {};
            ufn.params.forEach((pn, i) => { usaved[pn] = scope[pn]; scope[pn] = uargs[i]; });
            let rv = null;
            try {
              for (const _ev of execBlock(ufn.body)) { void _ev; }
            } catch (e) {
              if (e === RETURN) { rv = RETURN.value; }
              else { ufn.params.forEach(pn => { scope[pn] = usaved[pn]; }); throw e; }
            }
            ufn.params.forEach(pn => { scope[pn] = usaved[pn]; });
            return rv;
          }
          const fn = evalExpr(callee);
          const args = node.args.map(evalExpr);
          if (typeof fn === 'function') return fn.apply(null, args);
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
            case 'pass': yield { type: 'step', line: s.line }; return;
            case 'break': throw BREAK;
            case 'continue': throw CONTINUE;
            case 'assign': scope[s.target] = evalExpr(s.expr); yield { type: 'step', line: s.line }; return;
            case 'augassign': {
              const cur = (s.target in scope) ? scope[s.target] : 0;
              scope[s.target] = binop(s.op, cur, evalExpr(s.expr), s.line);
              yield { type: 'step', line: s.line }; return;
            }
            case 'expr': {
              yield* execExprStmt(s.expr, s.line); return;
            }
            case 'for': {
              const iter = evalExpr(s.iter);
              // Strings are iterable in Python (for ch in word), so iterate their characters.
              const list = Array.isArray(iter) ? iter : (typeof iter === 'string' ? iter.split('') : []);
              for (let i = 0; i < list.length; i++) {
                scope[s.varName] = list[i];
                yield { type: 'step', line: s.line };
                try { yield* execBlock(s.body); }
                catch (e) { if (e === BREAK) break; if (e === CONTINUE) continue; throw e; }
              }
              return;
            }
            case 'while': {
              let guard = 0;
              while (truthy(evalExpr(s.test))) {
                if (++guard > 100000) throw new RoverError('while loop ran too long.', s.line);
                yield { type: 'step', line: s.line };
                try { yield* execBlock(s.body); }
                catch (e) { if (e === BREAK) break; if (e === CONTINUE) continue; throw e; }
              }
              return;
            }
            case 'if': {
              for (const b of s.branches) {
                if (truthy(evalExpr(b.test))) { yield { type: 'step', line: s.line }; yield* execBlock(b.body); return; }
              }
              if (s.orelse) { yield { type: 'step', line: s.line }; yield* execBlock(s.orelse); }
              return;
            }
            case 'def': funcs[s.name] = s; yield { type: 'step', line: s.line }; return;
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
              if (name in SENSOR_METHODS) { host.sensor(name, expr.args.map(evalExpr)); yield { type: 'step', line: line }; return; }
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
              if (v in LESSON_SENSOR) { host.sensor(LESSON_SENSOR[v], expr.args.map(evalExpr)); yield { type: 'step', line: line }; return; }
              if (v === 'beep') { yield { type: 'print', line: line, text: 'beep' }; return; }
              if (v === 'log') { const a = expr.args.map(evalExpr); yield { type: 'print', line: line, text: a.map(pyStr).join(' ') }; return; }
              if (v === 'collect_sample') { yield { type: 'print', line: line, text: 'Sample collected.' }; return; }
              if (v === 'drop_sample') { yield { type: 'print', line: line, text: 'Sample dropped.' }; return; }
              // World-building: place(kind) at the rover, or place(kind, x_m, y_m).
              if (v === 'place') {
                const a = expr.args.map(evalExpr);
                const kind = a.length ? String(a[0]) : 'flag';
                const ev = { type: 'place', kind: kind, line: line };
                if (a.length >= 3) { ev.x = clampNum(a[1], -15, 15, 0) * 100; ev.y = clampNum(a[2], -15, 15, 0) * 100; }
                yield ev;
                return;
              }
              if (v === 'clear_props') { yield { type: 'clear_props', line: line }; return; }
              if (v === 'obstacle_ahead' || v === 'sample_detected' || v === 'at_base') { yield { type: 'step', line: line }; return; }
            }
            // print(...)
            if (callee.k === 'name' && callee.v === 'print') {
              const args = expr.args.map(evalExpr);
              yield { type: 'print', line: line, text: args.map(pyStr).join(' ') };
              return;
            }
            // user function call on its own line -> execute its body (may move)
            if (callee.k === 'name' && funcs[callee.v]) {
              const fn = funcs[callee.v];
              const args = expr.args.map(evalExpr);
              const saved = {};
              fn.params.forEach((pn, idx) => { saved[pn] = scope[pn]; scope[pn] = args[idx]; });
              yield { type: 'step', line: line };
              try { yield* execBlock(fn.body); }
              catch (e) { if (e !== RETURN) { fn.params.forEach(pn => { scope[pn] = saved[pn]; }); throw e; } }
              fn.params.forEach(pn => { scope[pn] = saved[pn]; });
              return;
            }
          }
          // fallback: evaluate for side effects
          evalExpr(expr);
          yield { type: 'step', line: line };
        }

        function motionEvent(name, args, line) {
          switch (name) {
            case 'forward': return { type: 'move', dir: 1, distance: clampNum(args[0], 0, 4000, 100), line: line };
            case 'backward': return { type: 'move', dir: -1, distance: clampNum(args[0], 0, 4000, 100), line: line };
            case 'turn_right': return { type: 'turn', deg: clampNum(args[0], -3600, 3600, 90), line: line };
            case 'turn_left': return { type: 'turn', deg: -clampNum(args[0], -3600, 3600, 90), line: line };
            case 'set_speed': return { type: 'speed', value: clampNum(args[0], 0, 100, 50), line: line };
            case 'wait': case 'sleep': return { type: 'wait', seconds: clampNum(args[0], 0, 10, 1), line: line };
            case 'pen_down': return { type: 'pen', down: true, line: line };
            case 'pen_up': return { type: 'pen', down: false, line: line };
            case 'stop': return { type: 'halt', line: line };
            case 'led': return { type: 'led', color: args[0] != null ? String(args[0]) : 'cyan', line: line };
            case 'say': return { type: 'say', text: args.map(pyStr).join(' '), line: line };
            case 'scan': return { type: 'scan', line: line };
          }
          return { type: 'step', line: line };
        }

        yield* execBlock(program);
      }
    };
  }

  // Clamp a pupil-supplied magnitude into [lo, hi]. A *missing* argument
  // (undefined) falls back to `dflt`; a *present* but non-finite value (NaN or
  // +/-Infinity -- e.g. `forward(10 ** 400)`, the only inf a pupil can type
  // since the tokenizer rejects `1e308`) maps to the lower bound `lo`. This
  // mirrors the Python engine's rover_api._clamp_finite so the animated and
  // graded paths agree, and guarantees a finite magnitude so the value can
  // never overflow app.jsx's animation duration and soft-hang the UI.
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

  function binop(op, l, r, line) {
    if (op === '+') {
      if (typeof l === 'string' || typeof r === 'string') return pyStr(l) + pyStr(r);
      if (Array.isArray(l) && Array.isArray(r)) return l.concat(r);
      return l + r;
    }
    // Python raises ZeroDivisionError for /, // and % by zero; JS would give
    // Infinity/NaN, so raise here to match the grader and surface a diagnostic.
    if ((op === '/' || op === '//' || op === '%') && r === 0) {
      throw new RoverError('division by zero', line);
    }
    switch (op) {
      case '-': return l - r;
      case '*':
        if (typeof l === 'string' && typeof r === 'number') return l.repeat(Math.max(0, r));
        return l * r;
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
  function compare(op, l, r) {
    switch (op) {
      case '<': return l < r; case '>': return l > r;
      case '<=': return l <= r; case '>=': return l >= r;
      case '==': return pyEqual(l, r); case '!=': return !pyEqual(l, r);
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
