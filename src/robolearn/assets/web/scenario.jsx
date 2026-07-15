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
  // Arena half-extent from the SHARED motion model (E-P1): one constant, not
  // a third hand-rolled copy. Fallback keeps headless loads working.
  const WALL = (window.KodroMotion && window.KodroMotion.MODEL.arenaHalfExtentCm) || 1500;
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
  // R is the rover collision radius: the live sensor host (sim-physics.js
  // rayDistance) grows each obstacle by R so distance() reads the gap to where
  // the BODY would touch, not the point path. The validator must match, or a
  // program branching on distance() takes a different branch than it runs.
  function rayDistance(x, y, headingDeg, obstacles, R) {
    R = R || 0;
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
      const rr = (o.r + R) * (o.r + R);
      if (d2 > rr) continue;
      const t = tca - Math.sqrt(rr - d2);
      if (t > 0) best = Math.min(best, t);
    }
    return Math.max(0, best);
  }

  // Physical-build battery drain at the speed actually driven (E-A2), mirroring
  // the live host (hooks.jsx). The energy-true per-cm figure RISES as speed
  // falls, because the fixed idle draw is amortised over fewer centimetres, so
  // grading every move at the fixed nominal top-speed figure under-counted drain
  // and passed programs that then go flat mid-move on the live run. Gravity is
  // Earth, matching the grader's gravity sensor; traction threads through both
  // the drive load and the driven speed, exactly as the live tick does.
  function physDrainPerCm(phys, speedSetting, traction) {
    var KM = window.KodroMotion;
    if (!KM || phys.vMaxSimCmPerS === undefined) return phys.drainPctPerCmNominal;
    var v = phys.vMaxSimCmPerS * (Math.max(8, speedSetting) / 100) * (traction || 1);
    return KM.physDrainPctPerCm(phys.massKg, phys.energyWh, v, KM.MODEL.gravityEarthMps2, traction || 1);
  }

  // Base-world environment for the sensor host, mirroring terrains.jsx base env
  // (gravity, air temp, light on the 0-100 scale). A program that branches on
  // gravity()/temperature()/light() must grade the way it runs, so the grader
  // reports the scenario world's real environment instead of always Earth.
  // Site scenarios set environmentPreset to their BASE world.
  var ENV_BY_PRESET = {
    earth: { gravity: 9.81, temp: 16, light: 80 },
    room: { gravity: 9.81, temp: 21, light: 70 },
    city: { gravity: 9.81, temp: 18, light: 92 },
    mars: { gravity: 3.71, temp: -63, light: 43 },
    underwater: { gravity: 9.81, temp: 3, light: 12 },
    space: { gravity: 1.62, temp: -173, light: 100 },
  };
  function scenarioEnv(preset) { return ENV_BY_PRESET[preset] || ENV_BY_PRESET.earth; }

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

    // Rover collision radius, resolved exactly like the live host (hooks.jsx):
    // an imported build's measured body circle, else the shared model default.
    // Threaded into every obstacle test so the validator collides, senses and
    // measures clearance against the BODY, not a dimensionless point.
    const KMc = window.KodroMotion;
    const R = (robot && robot.phys && robot.phys.collisionRadiusCm) || (KMc && KMc.MODEL && KMc.MODEL.roverRadiusCm) || 30;

    const s = { x: start.x, y: start.y, heading: start.heading || 0, speed: 50, battery: 100 };
    let minObstacleDistance = Infinity;
    function noteClearance() {
      for (const o of obstacles) { const d = Math.hypot(s.x - o.x, s.y - o.y) - (o.r + R); if (d < minObstacleDistance) minObstacleDistance = d; }
    }
    noteClearance();

    let commandErrors = 0, sensorFailures = 0;
    const host = {
      // Seeded PRNG so a graded program that calls random() reproduces exactly
      // for a fixed seed (the interpreter's random() reads host.rng when present).
      rng: rng,
      sensor: function (name) {
        // Gate on the build's fitted parts, exactly like the live host.
        if (window.KodroCommands) {
          const g = window.KodroCommands.check(robot, name);
          if (!g.ok) { commandErrors++; throw new Error(g.reason); }
        }
        switch (name) {
          case 'distance': {
            // SI2: honour an imported sensor's mount pose and range, exactly
            // like the live host, so a program validates the way it runs.
            let d;
            const sp = robot && robot.phys && robot.phys.sensor;
            if (sp && window.KodroMotion) {
              const pose = window.KodroMotion.sensorPose(s.x, s.y, s.heading, sp.fwdCm, sp.leftCm, sp.yawDeg);
              d = Math.min(sp.rangeCm, rayDistance(pose.x, pose.y, pose.heading, obstacles, R));
            } else {
              d = rayDistance(s.x, s.y, s.heading, obstacles, R);
            }
            if (noiseCm) { d += (rng() * 2 - 1) * noiseCm; if (d < 0) { d = 0; sensorFailures++; } }
            return Math.round(d);
          }
          case 'heading': return Math.round(((s.heading % 360) + 360) % 360);
          case 'battery': return Math.round(s.battery);
          case 'speed': return Math.round(s.speed);
          case 'x': return Math.round(s.x);
          case 'y': return Math.round(-s.y);
          case 'gravity': return scenarioEnv(scenario.environmentPreset).gravity;
          case 'temperature': return scenarioEnv(scenario.environmentPreset).temp;
          case 'light': return scenarioEnv(scenario.environmentPreset).light;
          // Mirror the live host (app.jsx) so a program branching on tilt()/
          // read_colour() validates the same way it runs: same tilt formula,
          // and the scenario's environment preset as the ground id.
          case 'tilt': return 0; // worlds are flat planes: a synthesized non-zero tilt contradicted the
          // fidelity disclosure (IMU returns level readings) and diverged from the
          // self-test, lesson grader and Python engine, which all model 0 (judge round 9).
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
        // Arm honesty (A13, bugs D4): a fixed-base arm cannot drive, so a
        // move/turn is refused here in the grader too - the SAME KodroCommands
        // source of truth the live run reads - so a pedestal build cannot pass
        // a driving scenario it never physically performed. A rover/car/home
        // build has a drive actuator and sails through unchanged.
        if ((ev.type === 'move' || ev.type === 'turn') && window.KodroCommands) {
          const cmdName = ev.type === 'move'
            ? (ev.dir < 0 ? 'move_backward' : 'move_forward')
            : (ev.deg < 0 ? 'turn_left' : 'turn_right');
          const g = window.KodroCommands.driveCheck(robot, cmdName);
          if (!g.ok) { commandErrors++; runError = g.reason; break; }
        }
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
            // Body vs obstacle: the swept centre path clips when it comes within
            // (o.r + R), matching the live sim's collisionAt (o.r + R). A bare
            // o.r test let the body corner-cut ~R cm into an obstacle and still
            // pass, so a program grazing obstacles validated but crashed on run.
            if (segPointDist(s.x, s.y, nx, ny, o.x, o.y) <= o.r + R) { hitAt = o; break; }
          }
          if (hitAt) {
            collisions++;
            // Stop with the body just short of the obstacle, along the heading.
            const back = hitAt.r + R + 6;
            const tx = hitAt.x - Math.sin(a) * back, ty = hitAt.y + Math.cos(a) * back;
            s.x = tx; s.y = ty;
          } else if (Math.abs(nx) > WALL || Math.abs(ny) > WALL) {
            collisions++;
            s.x = Math.max(-WALL, Math.min(WALL, nx));
            s.y = Math.max(-WALL, Math.min(WALL, ny));
          } else { s.x = nx; s.y = ny; }
          // Shared drain ledger (E-P1); an imported pack uses its energy-true
          // per-cm figure (E-A2), scaled by this seed's mass randomisation.
          s.battery = Math.max(0, s.battery - ((robot && robot.phys && robot.phys.energyWh !== undefined)
            ? Math.abs(dist) * physDrainPerCm(robot.phys, s.speed, friction) * massMul
            : window.KodroMotion.moveDrainPct(Math.abs(dist), window.KodroMotion.MODEL.gravityEarthMps2, massFac, friction)));
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
    mars_ridge: {
      scenarioId: 'mars_ridge', name: 'Cross the boulder field to the ridge marker', environmentPreset: 'mars',
      startPose: { x: 0, y: 1100, heading: 0 }, goalPose: { x: -150, y: -1150, r: 150 },
      obstacles: [{ x: -80, y: 350, r: 150 }, { x: 220, y: -300, r: 140 }, { x: -250, y: -700, r: 130 }],
      terrainMaterial: 'regolith', seed: 23,
      successCriteria: { reachGoal: true, maxCollisions: 1 },
      randomizationConfig: { friction: [0.6, 0.9], massTol: 0.15, sensorNoise: 20, obstacleJitter: 80, lighting: [0.3, 0.8] },
    },
    reef_survey: {
      scenarioId: 'reef_survey', name: 'Thread the coral heads to the survey buoy', environmentPreset: 'underwater',
      startPose: { x: 0, y: 1100, heading: 0 }, goalPose: { x: 250, y: -1100, r: 150 },
      obstacles: [{ x: 60, y: 350, r: 140 }, { x: -220, y: -250, r: 150 }, { x: 180, y: -700, r: 120 }],
      terrainMaterial: 'sediment', seed: 29,
      successCriteria: { reachGoal: true, maxCollisions: 1 },
      randomizationConfig: { friction: [0.5, 0.8], massTol: 0.12, sensorNoise: 25, obstacleJitter: 70, lighting: [0.1, 0.6] },
    },
    crater_line: {
      scenarioId: 'crater_line', name: 'Reach the far crater rim beacon', environmentPreset: 'space',
      startPose: { x: 0, y: 1150, heading: 0 }, goalPose: { x: -200, y: -1150, r: 160 },
      obstacles: [{ x: 120, y: 300, r: 150 }, { x: -180, y: -350, r: 140 }],
      terrainMaterial: 'regolith', seed: 31,
      successCriteria: { reachGoal: true, maxCollisions: 1 },
      randomizationConfig: { friction: [0.9, 1.2], massTol: 0.1, sensorNoise: 15, obstacleJitter: 90, lighting: [0.6, 1.0] },
    },
  };
  // Every base world has its OWN scenario (product-coherence D1: no more
  // silently grading an Earth mission while Mars is on screen). A mission
  // site validates on its base world's scenario; an unknown id falls back to
  // the Earth traverse, which the caller labels.
  function defaultFor(worldId) {
    if (worldId === 'room') return PRESETS.room_reach;
    if (worldId === 'city') return PRESETS.city_cross;
    if (worldId === 'mars') return PRESETS.mars_ridge;
    if (worldId === 'underwater') return PRESETS.reef_survey;
    if (worldId === 'space') return PRESETS.crater_line;
    return PRESETS.terrain_traverse;
  }

  window.KodroScenario = { PRESETS: PRESETS, run: run, runOnce: runOnce, defaultFor: defaultFor, PASS_RATE: PASS_RATE };
})();
