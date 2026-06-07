// Drive interpreter.js on a program read from stdin; print {error, steps}.
// Usage: node run_interp.cjs <interpreter.js path>   (program on stdin)
'use strict';
const fs = require('fs');
const src = fs.readFileSync(0, 'utf8');
global.window = {};
eval(fs.readFileSync(process.argv[2], 'utf8'));
const RL = global.window.RoverLang;
const SENSORS = { distance: 600, heading: 0, battery: 100, gravity: 3.71, temperature: -63, ground: 0.5, light: 0.8, x: 0, y: 0, speed: 50, tilt: 0 };
const host = { sensor(n) { return SENSORS[n] === undefined ? 0 : SENSORS[n]; } };
let error = null, steps = 0;
try {
  for (const ev of RL.compile(src).run(host)) {
    void ev;
    if (++steps > 50000) { error = 'too-many-steps'; break; }
  }
} catch (e) {
  error = (e && e.message) || String(e);
}
process.stdout.write(JSON.stringify({ error, steps }));
