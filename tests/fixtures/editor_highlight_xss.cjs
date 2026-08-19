// Run the REAL syntax highlighter out of Editor.jsx against XSS payloads.
//
// Editor.jsx renders the highlighter's output through dangerouslySetInnerHTML,
// and its input is whatever a pupil types or an imported project carries. The
// safety property is that every branch escapes, which is currently implicit in
// the highlighter's structure rather than asserted anywhere.
//
// The functions are extracted from source rather than copied, so a branch added
// later without esc() is caught here instead of shipping.
//
// Usage: node editor_highlight_xss.cjs <web-assets-dir>   -> prints one JSON object
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(process.argv[2], 'Editor.jsx'), 'utf8');

function grab(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) return null;
  let depth = 0;
  const open = src.indexOf('{', start);
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

const parts = ['esc', 'highlightLine', 'highlight'].map((n) => [n, grab(n)]);
const missing = parts.filter(([, body]) => !body).map(([n]) => n);
if (missing.length) {
  console.log(JSON.stringify({ error: 'could not extract from Editor.jsx: ' + missing.join(', ') }));
  process.exit(0);
}

// The token vocabularies the highlighter closes over. Kept as literals here
// because they are allowlists: a word only reaches an unescaped branch if it
// matches one of these or matches /[A-Za-z_][A-Za-z0-9_]*/, neither of which
// can carry markup.
const KEYWORDS = ['for', 'in', 'while', 'if', 'elif', 'else', 'def', 'return',
  'break', 'continue', 'pass', 'and', 'or', 'not', 'import', 'from'];
const CONSTS = ['True', 'False', 'None'];
const BUILTINS = ['print', 'range', 'len', 'int', 'float', 'str', 'abs', 'round',
  'min', 'max', 'sqrt', 'random'];

let highlight;
try {
  highlight = new Function(
    'KEYWORDS', 'CONSTS', 'BUILTINS',
    parts.map(([, body]) => body).join('\n') + '\nreturn highlight;'
  )(KEYWORDS, CONSTS, BUILTINS);
} catch (e) {
  console.log(JSON.stringify({ error: 'extracted source did not compile: ' + e.message }));
  process.exit(0);
}

const ATTACKS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '"><script>alert(1)</script>',
  '<svg/onload=alert(1)>',
  '</span><script>alert(1)</script>',
  '</pre><script>alert(1)</script><pre>',
  'move_forward(1) # <script>alert(1)</script>',
  'x = "<script>alert(1)</script>"',
  '<iframe src=javascript:alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  'a<b>c</b>d',
  "<img src='x' onerror='alert(1)'>",
  '<<SCRIPT>alert(1);//<</SCRIPT>',
  '<body onload=alert(1)>',
  '<style>@import"javascript:alert(1)";</style>',
];

// Anything the highlighter is allowed to emit as real markup.
const OWN_TAG = /^(?:<span class="tok-[a-z]+">|<\/span>)$/;

const results = {};
for (const attack of ATTACKS) {
  const out = highlight(attack);
  const leaked = (out.match(/<[^>]*>/g) || []).filter((t) => !OWN_TAG.test(t));
  results[attack] = { leaked, safe: leaked.length === 0 };
}

// Guard the guard: the extraction must really be running the highlighter, and
// the leak detector must really fire on markup that is not ours.
const sanity = {
  highlighterProducesSpans: /<span class="tok-/.test(highlight('def f():')),
  detectorCatchesForeignTags:
    (('<script>x</script>'.match(/<[^>]*>/g) || []).filter((t) => !OWN_TAG.test(t)).length > 0),
};

console.log(JSON.stringify({ results, sanity }));
