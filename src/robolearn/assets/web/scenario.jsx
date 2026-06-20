/*
 * Scenario validation with domain randomisation.
 *
 * The honest validation layer: take one program and run it through the SAME
 * interpreter and kinematics the live sim uses, headless and with no animation,
 * many times, each time varying friction, robot mass, sensor noise and obstacle
 * placement from a seeded random source. A behaviour that survives the spread is
 * likely to survive reality; one that only works on a tidy layout is not. This
 * follows domain randomisation (Tobin et al., 2017) and reports the spread, not
 * just one tidy number.
 *
 *   window.KodroScenario.PRESETS                  -> built-in scenarios
 *   window.KodroScenario.run(src, scenario, n)    -> { runs, aggregate, scenario }
 *   window.KodroScenario.defaultFor(worldId)      -> a scenario for a world
 *
 * A scenario is data:
 *   { scenarioId, name, environmentPreset, startPose:{x,y,heading},
 *     goalPose:{x,y,r}, obstacles:[{x,y,r}], terrainMaterial, seed,
 *     successCriteria:{ reachGoal, maxCollisions }, randomizationConfig }
 */
(function () {
  const WALL = 1500; // arena half-extent in cm, matches the engine and self-test
  const STEP_CAP = 200000;
  // Single source of truth for "did this design pass the spread". A majority of
  // randomised seeds must reach the goal, and mean collisions must stay within
  // the scenario's own successCriteria.maxCollisions. The UI renders this one
  // boolean instead of each surface re-deriving its own 0.6 threshold.
  const PASS_RATE = 0.6;

  // Deterministic PRNG so a seed reproduces a run exactly (reproducible demo).
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Distance from point p to segment a->b, used for swept collision tests.
  function segPointDist(ax, ay, bx, by, px, py) {
    const vx = bx - ax, vy = by - ay;
    const wx = px - ax, wy = py - ay;
    const len2 = vx * vx + vy * vy;
    let t = len2 > 0 ? (wx * vx + wy * vy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + vx * t, cy = ay + vy * t;
    return Math.hypot(px - cx, py - cy);
  }

  // Ray from (x,y) along heading to the nearest obstacle or wall, in cm.
  function rayDistance(x, y, headingDeg, obstacles) {
    const a = headingDeg * Math.PI / 180;
    const dx = Math.sin(a), dy = -Math.cos(a);
    let best = Infinity;
    for (const pair of [[dx, x], [dy, y]]) {
      const d = pair[0], p = pair[1];
      if (d > 1e-9) best = Math.min(best, (WALL - p) / d);
      else if (d < -1e-9) best = Math.min(best, (-WALL - p) / d);
    }
    for (const o of obstacles) {
      const ox = o.x - x, oy = o.y - y;
      const tca = ox * dx + oy * dy;
      if (tca < 0) continue;
      const d2 = ox * ox + oy * oy - tca * tca;
      const rr = o.r * o.r;
      if (d2 > rr) continue;
      const t = tca - Math.sqrt(rr - d2);
      if (t > 0) best = Math.min(best, t);
    }
    return Math.max(0, best);
  }

  // One headless run with the parameters this seed produced. `gateRobot` is the
  // build whose fitted parts gate the part-specific commands; run() resolves it
  // once and never passes null on a user-facing path (see run()).
  function runOnce(src, scenario, seed, gateRobot) {
    if (!window.RoverLang) return { ok: false, error: 'interpreter not loaded' };
    let program;
    try { program = window.RoverLang.compile(src); }
    catch (e) { return { ok: false, seed: seed, error: (e && e.message) || String(e), compile: true, finalScore: 0 }; }

    const rng = mulberry32((seed >>> 0) ^ hashStr(scenario.scenarioId || 'scn'));
    const cfg = scenario.randomizationConfig || {};
    const fr = cfg.friction || [0.8, 1.0];
    const friction = lerp(fr[0], fr[1], rng());
    const massTol = cfg.massTol || 0.1;
    const massMul = 1 + (rng() * 2 - 1) * massTol;
    const noiseCm = cfg.sensorNoise || 0;
    const jitter = cfg.obstacleJitter || 0;

    const robot = gateRobot;
    const massFac = (robot && robot.massFactor ? robot.massFactor : 1) * massMul;
    const start = scenario.startPose || { x: 0, y: 0, heading: 0 };
    const goal = scenario.goalPose || { x: 0, y: -1000, r: 120 };
    // Jitter each obstacle a little, deterministically, so placement varies.
    const obstacles = (scenario.obstacles || []).map(function (o) {
      return { x: o.x + (rng() * 2 - 1) * jitter, y: o.y + (rng() * 2 - 1) * jitter, r: o.r };
    });

    const s = { x: start.x, y: start.y, heading: start.heading || 0, speed: 50, battery: 100 };
    let minObstacleDistance = Infinity;
    function noteClearance() {
      for (const o of obstacles) { const d = Math.hypot(s.x - o.x, s.y - o.y) - o.r; if (d < minObstacleDistance) minObstacleDistance = d; }
    }
    noteClearance();

    let commandErrors = 0, sensorFailures = 0;
    const host = {
      sensor: function (name) {
        // Gate on the build's fitted parts, exactly like the live host.
        if (window.KodroCommands) {
          const g = window.KodroCommands.check(robot, name);
          if (!g.ok) { commandErrors++; throw new Error(g.reason); }
        }
        switch (name) {
          case 'distance': {
            let d = rayDistance(s.x, s.y, s.heading, obstacles);
            if (noiseCm) { d += (rng() * 2 - 1) * noiseCm; if (d < 0) { d = 0; sensorFailures++; } }
            return Math.round(d);
          }
          case 'heading': return Math.round(((s.heading % 360) + 360) % 360);
          case 'battery': return Math.round(s.battery);
          case 'speed': return Math.round(s.speed);
          case 'x': return Math.round(s.x);
          case 'y': return Math.round(-s.y);
          case 'gravity': return 9.81; case 'temperature': return 16; case 'light': return 0.8;
          // Mirror the live host (app.jsx) so a program branching on tilt()/
          // read_colour() validates the same way it runs: same tilt formula,
          // and the scenario's environment preset as the ground id.
          case 'tilt': return Math.round((Math.sin(s.x * 0.01) * 6 + Math.cos(s.y * 0.013) * 5) * 10) / 10;
          case 'ground': return scenario.environmentPreset || 'earth';
          default: return 0;
        }
      },
    };

    let gen;
    try { gen = program.run(host); }
    catch (e) { return { ok: false, seed: seed, error: (e && e.message) || String(e), finalScore: 0 }; }

    let steps = 0, moves = 0, turns = 0, collisions = 0, reachedGoal = false, runError = null, timeToGoal = null;
    try {
      for (;;) {
        const res = gen.next();
        if (res.done) break;
        if (++steps > STEP_CAP) { runError = 'did not terminate'; break; }
        const ev = res.value;
        if (ev.type === 'move') {
          moves++;
          const a = s.heading * Math.PI / 180;
          // Friction slip: lower traction means the move falls a little short.
          const slip = 0.85 + 0.15 * friction;
          const dist = ev.dir * ev.distance * slip;
          const nx = s.x + Math.sin(a) * dist;
          const ny = s.y - Math.cos(a) * dist;
          // Collision: did the swept segment clip any obstacle?
          let hitAt = null;
          for (const o of obstacles) {
            if (segPointDist(s.x, s.y, nx, ny, o.x, o.y) <= o.r) { hitAt = o; break; }
          }
          if (hitAt) {
            collisions++;
            // Stop just short of the obstacle centre, along the heading.
            const back = hitAt.r + 6;
            const tx = hitAt.x - Math.sin(a) * back, ty = hitAt.y + Math.cos(a) * back;
            s.x = tx; s.y = ty;
          } else if (Math.abs(nx) > WALL || Math.abs(ny) > WALL) {
            collisions++;
            s.x = Math.max(-WALL, Math.min(WALL, nx));
            s.y = Math.max(-WALL, Math.min(WALL, ny));
          } else { s.x = nx; s.y = ny; }
          s.battery = Math.max(0, s.battery - Math.abs(dist) * 0.011 * massFac / friction);
          noteClearance();
          if (!reachedGoal && Math.hypot(s.x - goal.x, s.y - goal.y) <= goal.r) { reachedGoal = true; timeToGoal = steps; }
        } else if (ev.type === 'turn') { turns++; s.heading += ev.deg; }
        else if (ev.type === 'speed') { s.speed = Math.max(0, Math.min(100, ev.value)); }
        else if (ev.type === 'scan') {
          // scan() reports an ultrasonic range, so gate it on the same part the
          // live run-pump does. A build without an ultrasonic must refuse here
          // too, otherwise a program halts in the live run but validates clean.
          if (window.KodroCommands) {
            const g = window.KodroCommands.check(robot, 'scan');
            if (!g.ok) { commandErrors++; runError = g.reason; break; }
          }
        }
      }
    } catch (e) { runError = (e && e.message) || String(e); }

    if (!reachedGoal && Math.hypot(s.x - goal.x, s.y - goal.y) <= goal.r) { reachedGoal = true; timeToGoal = steps; }
    if (minObstacleDistance === Infinity) minObstacleDistance = WALL;
    const batteryUsed = Math.round((100 - s.battery) * 10) / 10;

    // Final score: reaching the goal is most of it, then collisions, battery and
    // command errors pull it down. Bounded 0 to 100.
    let score = reachedGoal ? 100 : Math.max(0, 45 - Math.round(Math.hypot(s.x - goal.x, s.y - goal.y) / 40));
    score -= collisions * 14;
    score -= commandErrors * 20;
    score -= Math.round(batteryUsed * 0.25);
    if (runError) score -= 25;
    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      ok: !runError, seed: seed, reachedGoal: reachedGoal, collisions: collisions,
      timeToGoal: timeToGoal, steps: steps, moves: moves, turns: turns,
      batteryUsed: batteryUsed, minObstacleDistance: Math.round(minObstacleDistance),
      commandErrors: commandErrors, sensorFailures: sensorFailures,
      friction: Math.round(friction * 100) / 100, massMul: Math.round(massMul * 100) / 100,
      error: runError, finalScore: score,
    };
  }

  function run(src, scenario, n, opts) {
    const seeds = Math.max(1, n || 5);
    const base = (scenario && scenario.seed) || 1;
    // Resolve the build once. A user-facing validation must run against a real
    // build: a null robot would make KodroCommands.check pass EVERY part-gated
    // command (a camera-only build could 'pass' a ranging lesson). So for the
    // user path we substitute an empty-but-non-null build, which gates every
    // part-specific command correctly. Only an explicit headless harness
    // (opts.harness) is allowed the null = no-gating shortcut.
    const harness = !!(opts && opts.harness);
    const live = window.getKodroRobot ? window.getKodroRobot() : null;
    const gateRobot = harness ? live : (live || { sensors: [], actuators: [] });
    const runs = [];
    for (let i = 0; i < seeds; i++) runs.push(runOnce(src, scenario, base + i * 101, gateRobot));
    const ok = runs.filter(function (r) { return r && !r.compile; });
    // Every seed failed to even compile: a typo, not a behaviour failure. Flag it
    // so the UI shows a code error instead of a misleading 0% pass, and do not
    // persist a junk all-zero report to memory or SQLite.
    const allCompileFail = runs.length > 0 && runs.every(function (r) { return r && r.compile; });
    const reached = ok.filter(function (r) { return r.reachedGoal; });
    const mean = function (sel) { return ok.length ? ok.reduce(function (a, r) { return a + (sel(r) || 0); }, 0) / ok.length : 0; };
    const times = reached.map(function (r) { return r.timeToGoal; });
    const aggregate = {
      seeds: seeds,
      successRate: ok.length ? reached.length / ok.length : 0,
      successCount: reached.length,
      meanCollisions: Math.round(mean(function (r) { return r.collisions; }) * 100) / 100,
      meanBattery: Math.round(mean(function (r) { return r.batteryUsed; }) * 10) / 10,
      meanTimeToGoal: times.length ? Math.round(times.reduce(function (a, b) { return a + b; }, 0) / times.length) : null,
      meanScore: Math.round(mean(function (r) { return r.finalScore; })),
      commandErrors: ok.reduce(function (a, r) { return a + (r.commandErrors || 0); }, 0),
      minClearance: ok.length ? Math.min.apply(null, ok.map(function (r) { return r.minObstacleDistance; })) : 0,
      compileError: allCompileFail ? ((runs[0] && runs[0].error) || 'Your code has a syntax error.') : null,
    };
    // Derive the single pass/fail verdict from the scenario's own criteria so the
    // per-scenario successCriteria is live data, not decoration. reachGoal is
    // already captured by successRate; maxCollisions gates the collision spread.
    const crit = (scenario && scenario.successCriteria) || {};
    aggregate.passed = !allCompileFail
      && aggregate.successRate >= PASS_RATE
      && (crit.maxCollisions == null || aggregate.meanCollisions <= crit.maxCollisions);
    const report = { scenario: { scenarioId: scenario.scenarioId, name: scenario.name, environmentPreset: scenario.environmentPreset, seed: base }, runs: runs, aggregate: aggregate, ts: Date.now() };
    // Persist locally (offline) so the realism dashboard and the assistant can
    // read past validation. The desktop SQLite bridge mirrors this when present.
    if (!allCompileFail) {
      try {
        if (window.KodroMemory && window.KodroMemory.saveScenarioReport) window.KodroMemory.saveScenarioReport(report);
        if (window.RoboLearn && window.RoboLearn.saveScenarioRun) window.RoboLearn.saveScenarioRun(report);
      } catch (e) { void e; }
    }
    return report;
  }

  // ---- built-in scenarios, one per environment, as data ----
  const PRESETS = {
    city_cross: {
      scenarioId: 'city_cross', name: 'Cross the street, avoid the obstacles', environmentPreset: 'city',
      startPose: { x: 0, y: 1000, heading: 0 }, goalPose: { x: 0, y: -1100, r: 140 },
      obstacles: [{ x: -120, y: 300, r: 130 }, { x: 180, y: -250, r: 150 }, { x: -60, y: -650, r: 120 }],
      terrainMaterial: 'asphalt', seed: 7,
      successCriteria: { reachGoal: true, maxCollisions: 0 },
      randomizationConfig: { friction: [0.75, 1.0], massTol: 0.12, sensorNoise: 18, obstacleJitter: 60, lighting: [0.5, 1.0] },
    },
    room_reach: {
      scenarioId: 'room_reach', name: 'Reach the far corner among furniture', environmentPreset: 'room',
      startPose: { x: -900, y: 900, heading: 135 }, goalPose: { x: 900, y: -900, r: 130 },
      obstacles: [{ x: 0, y: 0, r: 200 }, { x: 400, y: -300, r: 120 }, { x: -300, y: -400, r: 110 }],
      terrainMaterial: 'carpet', seed: 11,
      successCriteria: { reachGoal: true, maxCollisions: 1 },
      randomizationConfig: { friction: [0.85, 1.0], massTol: 0.1, sensorNoise: 12, obstacleJitter: 50, lighting: [0.6, 1.0] },
    },
    terrain_traverse: {
      scenarioId: 'terrain_traverse', name: 'Traverse open ground to the marker', environmentPreset: 'earth',
      startPose: { x: 0, y: 1200, heading: 0 }, goalPose: { x: 200, y: -1200, r: 160 },
      obstacles: [{ x: 100, y: 400, r: 160 }, { x: -200, y: -400, r: 180 }],
      terrainMaterial: 'rock', seed: 17,
      successCriteria: { reachGoal: true, maxCollisions: 1 },
      randomizationConfig: { friction: [0.6, 0.95], massTol: 0.15, sensorNoise: 22, obstacleJitter: 90, lighting: [0.4, 1.0] },
    },
  };
  function defaultFor(worldId) {
    if (worldId === 'room') return PRESETS.room_reach;
    if (worldId === 'city') return PRESETS.city_cross;
    return PRESETS.terrain_traverse;
  }

  window.KodroScenario = { PRESETS: PRESETS, run: run, runOnce: runOnce, defaultFor: defaultFor, PASS_RATE: PASS_RATE };
})();
