/*
 * Autonomous self-test. Given a program, run it through the SAME interpreter and
 * kinematics the live sim uses, with no animation, and report what actually
 * happens: does it compile, does it run to the end without throwing, would it
 * drive into the arena wall, how far does it move. This is deterministic test
 * signal, not an opinion, so the assistant can apply code and check it itself.
 *
 *   window.KodroSelfTest(src) -> {
 *     ok, stage, error, line, steps, moves, turns, hitWall, endPos, summary
 *   }
 */
(function () {
  const WALL = 1500; // arena half-extent in cm, matches the engine

  function rayToWall(x, y, headingDeg) {
    const a = headingDeg * Math.PI / 180;
    const dx = Math.sin(a), dy = -Math.cos(a);
    let best = Infinity;
    for (const pair of [[dx, x], [dy, y]]) {
      const d = pair[0], p = pair[1];
      if (d > 1e-9) best = Math.min(best, (WALL - p) / d);
      else if (d < -1e-9) best = Math.min(best, (-WALL - p) / d);
    }
    return Math.max(0, Math.round(best));
  }

  function selfTest(src) {
    if (!window.RoverLang) return { ok: false, stage: 'load', error: 'interpreter not loaded', summary: 'Interpreter not loaded.' };
    let program;
    try {
      program = window.RoverLang.compile(src);
    } catch (e) {
      return { ok: false, stage: 'compile', error: e && e.message ? e.message : String(e), line: e && e.line, summary: 'Will not compile' + (e && e.line ? ' (line ' + e.line + ')' : '') + ': ' + (e && e.message ? e.message : e) };
    }
    const s = { x: 0, y: 0, heading: 0, speed: 50, battery: 100 };
    const host = {
      sensor: function (name) {
        switch (name) {
          case 'distance': return rayToWall(s.x, s.y, s.heading);
          case 'heading': return Math.round(((s.heading % 360) + 360) % 360);
          case 'battery': return Math.round(s.battery);
          case 'speed': return Math.round(s.speed);
          case 'x': return Math.round(s.x);
          case 'y': return Math.round(-s.y);
          case 'gravity': return 9.81;
          case 'temperature': return 16;
          case 'light': return 0.8;
          case 'tilt': return 0;
          default: return 0;
        }
      },
    };
    let gen;
    try { gen = program.run(host); } catch (e) { return { ok: false, stage: 'start', error: e && e.message, line: e && e.line, summary: 'Failed to start: ' + (e && e.message ? e.message : e) }; }
    let steps = 0, moves = 0, turns = 0, hitWall = false;
    const CAP = 200000;
    try {
      for (;;) {
        const res = gen.next();
        if (res.done) break;
        if (++steps > CAP) return { ok: false, stage: 'run', error: 'did not terminate', steps: steps, summary: 'Does not finish: it loops without stopping (' + steps + '+ steps).' };
        const ev = res.value;
        if (ev.type === 'move') {
          moves++;
          const a = s.heading * Math.PI / 180;
          const nx = s.x + Math.sin(a) * ev.dir * ev.distance;
          const ny = s.y - Math.cos(a) * ev.dir * ev.distance;
          if (Math.abs(nx) > WALL || Math.abs(ny) > WALL) {
            hitWall = true;
            s.x = Math.max(-WALL, Math.min(WALL, nx));
            s.y = Math.max(-WALL, Math.min(WALL, ny));
          } else { s.x = nx; s.y = ny; }
        } else if (ev.type === 'turn') {
          turns++; s.heading += ev.deg;
        } else if (ev.type === 'speed') {
          s.speed = Math.max(0, Math.min(100, ev.value));
        }
      }
    } catch (e) {
      return { ok: false, stage: 'run', error: e && e.message ? e.message : String(e), line: e && e.line, steps: steps, moves: moves, summary: 'Errors while running' + (e && e.line ? ' at line ' + e.line : '') + ': ' + (e && e.message ? e.message : e) };
    }
    const endPos = { x: Math.round(s.x), y: Math.round(-s.y) };
    let summary;
    if (hitWall) summary = 'Runs, but it would drive into the arena wall. Add a distance() check before moving, or shorten the moves.';
    else if (moves === 0) summary = 'Runs clean but the robot never moves. Add a move_forward or rover.forward.';
    else summary = 'Self-test passed: ' + moves + ' moves, ' + turns + ' turns, ends at (' + endPos.x + ', ' + endPos.y + '), stays in the arena.';
    return { ok: true, steps: steps, moves: moves, turns: turns, hitWall: hitWall, endPos: endPos, summary: summary };
  }

  window.KodroSelfTest = selfTest;
})();
