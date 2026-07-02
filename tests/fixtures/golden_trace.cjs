// Golden-trace runner for the JS engine (PERFECTION_PLAN E-P2).
// Runs a program (stdin) through the SHIPPED interpreter.js with the SHARED
// motion-model.js kinematics/battery at nominal conditions (gravity 9.81,
// massFactor 1, traction 1), mirroring app.jsx semantics: wall contact at
// (arenaHalfExtent - roverRadius) stops the move and counts a collision.
// Prints one JSON object so pytest can compare against the Python engine.
//   node golden_trace.cjs <interpreter.js> <motion-model.js>   (program on stdin)
'use strict';
const fs = require('fs');

const src = fs.readFileSync(0, 'utf8');
global.window = {};
eval(fs.readFileSync(process.argv[2], 'utf8')); // interpreter.js
eval(fs.readFileSync(process.argv[3], 'utf8')); // motion-model.js
const RL = global.window.RoverLang;
const KM = global.window.KodroMotion;
const M = KM.MODEL;
const LIM = M.arenaHalfExtentCm - M.roverRadiusCm; // wall contact line (app.jsx)

const s = { x: 0, y: 0, heading: 0, speed: 50, battery: 100 };
let collisions = 0, travelledCm = 0, turnedDeg = 0, halted = null;

function rayToWall(x, y, headingDeg) {
  const a = headingDeg * Math.PI / 180;
  const dx = Math.sin(a), dy = -Math.cos(a);
  let best = Infinity;
  for (const [d, p] of [[dx, x], [dy, y]]) {
    if (d > 1e-9) best = Math.min(best, (LIM - p) / d);
    else if (d < -1e-9) best = Math.min(best, (-LIM - p) / d);
  }
  return Math.max(0, Math.round(best));
}

const host = {
  sensor(name) {
    switch (name) {
      case 'distance': return rayToWall(s.x, s.y, s.heading);
      case 'heading': return Math.round(((s.heading % 360) + 360) % 360);
      case 'battery': return Math.round(s.battery);
      case 'speed': return Math.round(s.speed);
      case 'x': return Math.round(s.x);
      case 'y': return Math.round(-s.y);
      case 'gravity': return M.gravityEarthMps2;
      case 'temperature': return 16;
      case 'light': return 0.8;
      case 'tilt': return 0;
      default: return 0;
    }
  }
};

let error = null;
try {
  const gen = RL.compile(src).run(host);
  let steps = 0;
  for (;;) {
    const r = gen.next();
    if (r.done) break;
    if (++steps > 2000000) { error = 'did not terminate'; break; }
    const ev = r.value;
    if (ev.type === 'move') {
      const a = s.heading * Math.PI / 180;
      const dirx = Math.sin(a) * ev.dir, diry = -Math.cos(a) * ev.dir;
      let nx = s.x + dirx * ev.distance, ny = s.y + diry * ev.distance;
      let dist = ev.distance;
      // Battery-flat crossing: halt EXACTLY where the charge hits zero
      // (app.jsx solves the cover fraction; here the profile is linear).
      const drainFull = KM.moveDrainPct(dist, M.gravityEarthMps2, 1, 1);
      let flat = false;
      if (drainFull > 0 && drainFull >= s.battery) {
        const cf = s.battery / drainFull;
        nx = s.x + dirx * dist * cf; ny = s.y + diry * dist * cf;
        dist *= cf; flat = true;
      }
      // Wall contact stops the move at the contact point and is a collision.
      let hitWall = false;
      if (Math.abs(nx) > LIM || Math.abs(ny) > LIM) {
        // Walk back along the ray to the wall line (exact, axis-aligned box).
        let t = 1;
        if (Math.abs(dirx) > 1e-9) {
          if (nx > LIM) t = Math.min(t, (LIM - s.x) / (dirx * dist));
          if (nx < -LIM) t = Math.min(t, (-LIM - s.x) / (dirx * dist));
        }
        if (Math.abs(diry) > 1e-9) {
          if (ny > LIM) t = Math.min(t, (LIM - s.y) / (diry * dist));
          if (ny < -LIM) t = Math.min(t, (-LIM - s.y) / (diry * dist));
        }
        t = Math.max(0, Math.min(1, t));
        nx = s.x + dirx * dist * t; ny = s.y + diry * dist * t;
        dist *= t; hitWall = true;
      }
      const legCm = Math.hypot(nx - s.x, ny - s.y);
      s.x = nx; s.y = ny;
      travelledCm += legCm;
      s.battery = Math.max(0, s.battery - KM.moveDrainPct(legCm, M.gravityEarthMps2, 1, 1));
      if (hitWall) { collisions++; halted = 'collision'; break; } // app.jsx halts on crash
      if (flat) { s.battery = 0; halted = 'flat'; break; }        // ...and on a flat pack
    } else if (ev.type === 'turn') {
      s.heading += ev.deg;
      turnedDeg += Math.abs(ev.deg);
      s.battery = Math.max(0, s.battery - KM.turnDrainPct(ev.deg));
    } else if (ev.type === 'speed') {
      s.speed = Math.max(0, Math.min(100, ev.value));
    }
  }
} catch (e) {
  error = (e && e.message) || String(e);
}

process.stdout.write(JSON.stringify({
  error,
  halted,
  xCm: s.x,
  yCm: s.y,
  headingDeg: ((s.heading % 360) + 360) % 360,
  batteryPct: s.battery,
  collisions,
  travelledCm,
  turnedDeg,
  displacementCm: Math.hypot(s.x, s.y),
}));
