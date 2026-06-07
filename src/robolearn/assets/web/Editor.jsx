/* ============================================================================
   ORBITAL ROVER — Code editor
   Transparent textarea over a syntax-highlighted <pre>, with a line-number
   gutter and an active-line marker driven by the interpreter.
   Exposes window.Editor
   ========================================================================== */
(function () {
  const { useRef, useEffect } = React;

  const KEYWORDS = ['for', 'in', 'while', 'if', 'elif', 'else', 'def', 'return', 'break', 'continue', 'pass', 'and', 'or', 'not', 'import', 'from'];
  const CONSTS = ['True', 'False', 'None'];
  const BUILTINS = ['print', 'range', 'len', 'int', 'float', 'str', 'abs', 'round', 'min', 'max', 'sqrt', 'random'];

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function highlight(code) {
    let out = '';
    const lines = code.split('\n');
    for (let li = 0; li < lines.length; li++) {
      let line = lines[li];
      out += highlightLine(line);
      if (li < lines.length - 1) out += '\n';
    }
    return out;
  }

  function highlightLine(line) {
    let res = '';
    let i = 0;
    const n = line.length;
    const isIdStart = c => /[A-Za-z_]/.test(c);
    const isId = c => /[A-Za-z0-9_]/.test(c);
    while (i < n) {
      const c = line[i];
      // comment
      if (c === '#') { res += '<span class="tok-com">' + esc(line.slice(i)) + '</span>'; break; }
      // string
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && line[j] !== c) { if (line[j] === '\\') j++; j++; }
        res += '<span class="tok-str">' + esc(line.slice(i, Math.min(j + 1, n))) + '</span>';
        i = j + 1; continue;
      }
      // number
      if (/[0-9]/.test(c)) {
        let j = i + 1; while (j < n && /[0-9.]/.test(line[j])) j++;
        res += '<span class="tok-num">' + esc(line.slice(i, j)) + '</span>'; i = j; continue;
      }
      // identifier
      if (isIdStart(c)) {
        let j = i + 1; while (j < n && isId(line[j])) j++;
        const word = line.slice(i, j);
        const after = line.slice(j);
        // rover.method
        if (word === 'rover') { res += '<span class="tok-rover">rover</span>'; i = j; continue; }
        if (KEYWORDS.indexOf(word) >= 0) res += '<span class="tok-kw">' + word + '</span>';
        else if (CONSTS.indexOf(word) >= 0) res += '<span class="tok-num">' + word + '</span>';
        else if (/^\s*\(/.test(after) || BUILTINS.indexOf(word) >= 0) res += '<span class="tok-fn">' + word + '</span>';
        else res += esc(word);
        i = j; continue;
      }
      // operator / punctuation
      if ('+-*/%<>=!&|'.indexOf(c) >= 0) { res += '<span class="tok-op">' + esc(c) + '</span>'; i++; continue; }
      res += esc(c); i++;
    }
    return res || '&nbsp;';
  }

  const LH = 21, PAD = 14;

  function Editor({ code, onChange, activeLine, readOnly }) {
    const taRef = useRef(null);
    const preRef = useRef(null);
    const wrapRef = useRef(null);

    // auto-size textarea height to content
    useEffect(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.style.height = 'auto';
      ta.style.height = Math.max(ta.scrollHeight, (wrapRef.current ? wrapRef.current.clientHeight : 200)) + 'px';
    }, [code]);

    // keep active line in view
    useEffect(() => {
      if (!activeLine || !wrapRef.current) return;
      const wrap = wrapRef.current;
      const top = PAD + (activeLine - 1) * LH;
      if (top < wrap.scrollTop + 30 || top > wrap.scrollTop + wrap.clientHeight - 50) {
        wrap.scrollTo({ top: Math.max(0, top - wrap.clientHeight / 2), behavior: 'smooth' });
      }
    }, [activeLine]);

    const lines = code.split('\n');

    function handleKey(e) {
      // Escape releases the textarea so keyboard-only users are never trapped
      // by Tab-inserts-spaces (WCAG 2.1.2 No Keyboard Trap).
      if (e.key === 'Escape') { e.target.blur(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.target;
        const s = ta.selectionStart, en = ta.selectionEnd;
        const val = ta.value;
        const next = val.slice(0, s) + '    ' + val.slice(en);
        onChange(next);
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 4; });
      }
    }

    return (
      <div className="editor-wrap" ref={wrapRef}>
        <div className="editor-grid">
          <div className="gutter">
            {lines.map((_, i) => (
              <span key={i} className={'gl' + (activeLine === i + 1 ? ' active' : '')}>{i + 1}</span>
            ))}
          </div>
          <div className="code-layer" style={{ position: 'relative', minWidth: 'max-content', flex: 1 }}>
            {activeLine ? (
              <div className="line-hl" style={{ top: PAD + (activeLine - 1) * LH }}></div>
            ) : null}
            <pre className="code-pre" ref={preRef} dangerouslySetInnerHTML={{ __html: highlight(code) }}></pre>
            <textarea
              ref={taRef}
              className="code-ta"
              value={code}
              spellCheck={false}
              readOnly={readOnly}
              aria-label="Python code editor. Press Tab to indent, Escape to move focus out."
              aria-multiline="true"
              onChange={e => onChange(e.target.value)}
              onKeyDown={handleKey}
              style={{ minWidth: 'max-content' }}
            ></textarea>
          </div>
        </div>
      </div>
    );
  }

  window.Editor = Editor;
})();
