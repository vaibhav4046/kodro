// Run the run-announcement de-duplication straight out of app.jsx source, so
// this check cannot drift from the shipped expression the way a copied regex
// would. Prints one JSON object. Usage: node announce_dedup.cjs <web-assets-dir>
'use strict';
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const app = fs.readFileSync(path.join(dir, 'app.jsx'), 'utf8');

// The single line that strips the verdict's own measured clause. Matched on the
// binding name so a reformat of the regex body does not break extraction.
const line = app.split('\n').find((l) => l.trim().startsWith('const said ='));
if (!line) {
  console.log(JSON.stringify({ error: 'no "const said =" line in app.jsx: the announcement de-dup was removed or renamed' }));
  process.exit(0);
}

let said;
try {
  said = new Function('simpleLatestVerdict', 'r', line + '\nreturn said;');
} catch (e) {
  console.log(JSON.stringify({ error: 'could not compile the extracted line: ' + e.message }));
  process.exit(0);
}

// Verdict strings exactly as diagnostics.jsx builds them, one per branch.
const CASES = {
  pass_distance_and_prox: 'Mission complete and the design held up. Covered 8.0 m, closest approach 31 cm.',
  pass_distance_only: 'Mission complete and the design held up. Covered 8.0 m.',
  pass_prox_only: 'Mission complete and the design held up., closest approach 31 cm.',
  pass_prose_fallback: 'Mission complete and the design held up. Margins looked healthy.',
  pass_unsimulated_hazard: "Mission complete: driving, sensing and battery held up on this surface. Covered 8.0 m, closest approach 31 cm. This site's depth pressure effects are not simulated, so this run cannot prove the build survives them.",
  near_miss: 'Mission complete, but only 22 cm of clearance remained. Treat this as a near miss and add more margin before calling the behaviour robust.',
  warn: 'Mission complete, but watch the flagged points: add a distance sensor.',
  stalled: 'It stalled: the surface gave its motors too little grip for the weight. Fit 4 DC motors or shed mass.',
  nothing_ran: 'Nothing ran: the program produced no commands, so this run says nothing about the design.',
};

const out = { results: {}, stripsSomething: null, prosePreserved: null };
for (const [name, verdict] of Object.entries(CASES)) {
  const spoken = said(verdict, {});
  out.results[name] = {
    covered: (spoken.match(/Covered /g) || []).length,
    approach: (spoken.match(/closest approach /g) || []).length,
    doubleDot: /\.\./.test(spoken),
    spoken,
  };
}
// Guard the guard: a stripper that returns its input unchanged would pass every
// assertion above only because the fixture inputs happened to be clean.
out.stripsSomething = said(CASES.pass_distance_and_prox, {}) !== CASES.pass_distance_and_prox;
// Lesson prose that merely mentions a distance must survive untouched.
const prose = 'Drive at least 3 m before turning.';
out.prosePreserved = said(prose, {}) === prose;

console.log(JSON.stringify(out));
