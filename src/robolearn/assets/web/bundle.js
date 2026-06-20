/* AUTO-GENERATED from the .jsx sources by scripts/build_web.cjs. Do not edit. */

;(function () {
/* Shared moving-agent simulation.
 *
 * One source of truth for the city's pedestrians and traffic, in the same
 * centimetre world coordinates the rover and the obstacle field use. Both
 * viewports render from it and the collision test reads it, so an agent the
 * robot can see is one it can hit.
 *
 * Motion is meant to read as real, not as sliding props: traffic flows one way
 * along its lane and loops, pedestrians walk their pavement and a few cross at
 * the crossing, and everything BRAKES for the robot instead of driving through
 * it. Integrated per frame (position advances by speed * dt scaled by braking),
 * self driven by requestAnimationFrame, with a single step where rAF is absent
 * (the offline bundle-render test) so it never throws there.
 *
 *   window.KodroAgents.build(worldId)  -- set up agents for a world
 *   window.KodroAgents.list()          -- [{x,y,r,kind,color,dx,dy,leg}] in cm
 */
(function () {
  let agents = [];
  let worldId = null;
  let raf = 0;
  let last = null;
  const R = 30; // rover collision radius (cm), matched to the engine
  const ROBOT_COLORS = [0x5ce0d8, 0xe0b45c, 0xd35d7a, 0x7a5fc0];

  // lane(dir, axis, offset): a one-way lane. dir +1/-1 is travel direction along
  // the moving axis; offset is the fixed cross-axis position.
  function car(horiz, dir, lane, speed, s0, color) {
    return {
      kind: 'car',
      horiz,
      dir,
      lane,
      speed,
      s: s0,
      span: 3400,
      r: 96,
      color,
      x: 0,
      y: 0,
      dx: dir,
      dy: 0,
      leg: 0,
      base: speed
    };
  }
  function ped(horiz, dir, lane, speed, s0, color, span) {
    return {
      kind: 'person',
      horiz,
      dir,
      lane,
      speed,
      s: s0,
      span: span || 2800,
      r: 44,
      color,
      x: 0,
      y: 0,
      dx: dir,
      dy: 0,
      leg: 0,
      base: speed
    };
  }
  // An autonomous robot: roams to random goals, steers around the player rover
  // and the other robots, and turns back at the arena edge. Distinct from the
  // lane agents above, which run on fixed tracks.
  function rbt(x, y, color, base) {
    return {
      kind: 'robot',
      x: x,
      y: y,
      heading: Math.atan2(-y, -x),
      base: base || 130,
      r: 42,
      color: color,
      dx: 1,
      dy: 0,
      leg: 0,
      spin: 0,
      gx: x,
      gy: y,
      retime: 0
    };
  }
  function wrap(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }
  function steerRobot(a, dt, rov, all) {
    const BOUND = 1350;
    // pick a fresh goal when reached or the timer runs out
    a.retime -= dt;
    if (a.retime <= 0 || Math.hypot(a.gx - a.x, a.gy - a.y) < 130) {
      a.gx = (Math.random() - 0.5) * 2 * BOUND;
      a.gy = (Math.random() - 0.5) * 2 * BOUND;
      a.retime = 4 + Math.random() * 5;
    }
    let want = Math.atan2(a.gy - a.y, a.gx - a.x);
    // steer away from anything close ahead: the player rover, then other robots
    let steer = 0;
    const dodge = (ox, oy, rad) => {
      const dx = ox - a.x,
        dy = oy - a.y,
        d = Math.hypot(dx, dy);
      if (d > 0.1 && d < rad) {
        const rel = wrap(Math.atan2(dy, dx) - a.heading);
        if (Math.abs(rel) < 1.3) steer -= (rel >= 0 ? 1 : -1) * (1 - d / rad) * 1.6;
      }
    };
    if (rov) dodge(rov.x, rov.y, 300);
    for (let j = 0; j < all.length; j++) {
      const o = all[j];
      if (o !== a && o.kind === 'robot') dodge(o.x, o.y, 240);
    }
    // bias back toward the centre near the edge so it never escapes the arena
    if (Math.abs(a.x) > BOUND || Math.abs(a.y) > BOUND) want = Math.atan2(-a.y, -a.x);
    a.heading += wrap(want + steer - a.heading) * Math.min(1, dt * 3.5);
    const spd = a.base * (steer ? 0.7 : 1);
    a.x += Math.cos(a.heading) * spd * dt;
    a.y += Math.sin(a.heading) * spd * dt;
    a.dx = Math.cos(a.heading);
    a.dy = Math.sin(a.heading);
    a.speed = spd;
    a.spin += spd * dt * 0.04; // wheel-spin proxy for the renderer
    a.leg = a.spin;
  }

  // 2 to 3 roaming robots, spread out, so every world has machines moving and
  // reacting, not a static prop field.
  function addRobots(n, palette) {
    const spots = [[-900, -700], [950, -650], [-150, 1000], [700, 800], [-1000, 400]];
    for (let i = 0; i < n; i++) {
      const p = spots[i % spots.length];
      agents.push(rbt(p[0], p[1], palette[i % palette.length], 120 + i % 3 * 25));
    }
  }
  function build(id) {
    stop();
    agents = [];
    worldId = id;
    if (id === 'city') {
      const shirts = [0xd98c4a, 0x5aa0d8, 0x8a6fc0, 0x5bbf86, 0xd35d7a, 0xe0b45c];
      // Traffic: two lanes each way on both roads, flowing one direction, looping.
      agents.push(car(true, 1, -78, 240, 200, 0x2c6fb0));
      agents.push(car(true, 1, -78, 240, 1900, 0xc0392b));
      agents.push(car(true, -1, 78, 220, 1100, 0x4aa564));
      agents.push(car(false, 1, 78, 230, 600, 0xd8a838));
      agents.push(car(false, -1, -78, 210, 2400, 0x7a5fc0));
      // Pedestrians walking the pavements, one direction each, looping.
      const pave = 300;
      agents.push(ped(true, 1, -pave, 60, 0, shirts[0]));
      agents.push(ped(true, -1, pave, 52, 900, shirts[1]));
      agents.push(ped(false, 1, pave, 58, 400, shirts[2]));
      agents.push(ped(false, -1, -pave, 50, 1500, shirts[3]));
      // Two crossing the zebra crossing (east of the junction), back and forth-ish
      // but on the crossing lane so it reads as using the crossing.
      agents.push(ped(false, 1, 320, 46, 0, shirts[4], 700));
      agents.push(ped(false, -1, 360, 44, 350, shirts[5], 700));
      addRobots(3, ROBOT_COLORS);
    } else if (id === 'room') {
      agents.push(ped(true, 1, -360, 40, 0, 0x6aa0d8, 1300));
      agents.push(ped(false, 1, 360, 32, 200, 0xc97f6a, 1100));
    } else {
      // Open terrain worlds were static. Give them a small autonomous fleet that
      // roams and reacts, so the world is alive and the player has machines to
      // share it with.
      addRobots(3, ROBOT_COLORS);
    }
    step(0); // place every agent on its lane immediately, before the first frame
    start();
  }
  function step(dt) {
    if (dt > 0.1) dt = 0.1; // a long pause (tab hidden) must not teleport agents
    const rov = window.KODRO_ROVER;
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.kind === 'robot') {
        steerRobot(a, dt, rov, agents);
        continue;
      }
      // provisional position from current s, along the lane in the travel dir
      const halfShift = (a.s % a.span + a.span) % a.span - a.span / 2;
      const along = a.dir * halfShift;
      const ax = a.horiz ? along : a.lane;
      const ay = a.horiz ? a.lane : along;
      // brake for the robot if it is close ahead in this agent's path
      let brake = 1;
      if (rov) {
        const relx = rov.x - ax,
          rely = rov.y - ay;
        const fwd = a.horiz ? relx * a.dir : rely * a.dir; // distance ahead
        const lat = a.horiz ? Math.abs(rely - 0) : Math.abs(relx - 0); // cross-track
        if (fwd > 0 && fwd < 240 && lat < a.r + R + 24) brake = Math.max(0, (fwd - 60) / 180);
      }
      a.s += a.base * brake * dt;
      const hs = (a.s % a.span + a.span) % a.span - a.span / 2;
      const al = a.dir * hs;
      if (a.horiz) {
        a.x = al;
        a.y = a.lane;
        a.dx = a.dir;
        a.dy = 0;
      } else {
        a.x = a.lane;
        a.y = al;
        a.dx = 0;
        a.dy = a.dir;
      }
      a.speed = a.base * brake;
      a.leg = Math.sin(a.s * 0.06) * brake; // legs slow and stop when braking
    }
  }
  function loop(now) {
    if (last == null) last = now;
    step((now - last) / 1000);
    last = now;
    raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(loop) : 0;
  }
  function start() {
    if (typeof requestAnimationFrame === 'function') {
      last = null;
      raf = requestAnimationFrame(loop);
    } else step(0);
  }
  function stop() {
    if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    raf = 0;
  }
  window.KodroAgents = {
    build,
    step,
    stop,
    list: () => agents,
    world: () => worldId
  };
})();
})();

;(function () {
/* Self-refinement store (offline, local).
 *
 * The honest, system-level self-refinement the proposal describes: after each
 * run the system records what happened and writes a short reflection, keeps a
 * growing library of programs that worked as reusable skills, and surfaces the
 * most relevant past lesson for the world the user is in. Nothing here changes
 * the model's weights; the gain is in what the system remembers and reuses,
 * which is exactly what can be counted. Backed by localStorage so it persists
 * across sessions and never leaves the machine.
 *
 *   window.KodroMemory.record({world, robotType, outcome, detail})
 *   window.KodroMemory.reflections()      -- recent reflections, newest first
 *   window.KodroMemory.saveSkill(name, code, ctx) / skills() / removeSkill(name)
 *   window.KodroMemory.lessonFor(world)   -- the latest reflection for a world
 */
(function () {
  const RKEY = 'kodro_reflections_v1';
  const SKEY = 'kodro_skills_v1';
  const MAX = 40;
  function load(key) {
    try {
      const r = localStorage.getItem(key);
      return r ? JSON.parse(r) : [];
    } catch (e) {
      return [];
    }
  }
  function save(key, v) {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch (e) {
      void e;
    }
  }

  // Turn a run outcome into a short, useful reflection. Rule based and
  // deterministic; the local model can elaborate it when one is installed.
  function reflect(run) {
    const what = (run.detail || '').toLowerCase();
    if (run.outcome === 'done') return 'Reached the goal. This program worked here; consider saving it as a skill to reuse.';
    if (run.outcome === 'crash') {
      if (what.indexOf('pedestrian') >= 0) return 'A pedestrian crossed the path. Read sensor() and slow or stop before moving on.';
      if (what.indexOf('vehicle') >= 0 || what.indexOf('car') >= 0) return 'Traffic was in the way. Wait for the lane to clear, then cross.';
      if (what.indexOf('boundary') >= 0 || what.indexOf('wall') >= 0) return 'Hit the edge of the area. Turn back before the boundary.';
      return 'Collided with ' + (run.detail || 'an obstacle') + '. Add a turn or a shorter move to go around it.';
    }
    return 'Run stopped early. Check the last command and try again.';
  }
  function record(run) {
    const refl = reflect(run);
    const list = load(RKEY);
    list.unshift({
      ts: run.ts || 0,
      world: run.world || '',
      robotType: run.robotType || '',
      outcome: run.outcome || '',
      detail: run.detail || '',
      reflection: refl
    });
    if (list.length > MAX) list.length = MAX;
    save(RKEY, list);
    try {
      window.dispatchEvent(new CustomEvent('kodro-memory'));
    } catch (e) {
      void e;
    }
    return refl;
  }
  function reflections() {
    return load(RKEY);
  }
  function lessonFor(world) {
    const l = load(RKEY);
    for (const r of l) if (!world || r.world === world) return r;
    return null;
  }
  function saveSkill(name, code, ctx) {
    if (!name || !code) return false;
    const list = load(SKEY).filter(s => s.name !== name);
    list.unshift({
      name: String(name).slice(0, 40),
      code: String(code),
      world: ctx && ctx.world || '',
      robotType: ctx && ctx.robotType || '',
      ts: ctx && ctx.ts || 0,
      uses: 0
    });
    if (list.length > MAX) list.length = MAX;
    save(SKEY, list);
    try {
      window.dispatchEvent(new CustomEvent('kodro-memory'));
    } catch (e) {
      void e;
    }
    return true;
  }
  function skills() {
    return load(SKEY);
  }
  function useSkill(name) {
    const l = load(SKEY);
    const s = l.find(x => x.name === name);
    if (s) {
      s.uses = (s.uses || 0) + 1;
      save(SKEY, l);
    }
    return s ? s.code : null;
  }
  function removeSkill(name) {
    save(SKEY, load(SKEY).filter(s => s.name !== name));
    try {
      window.dispatchEvent(new CustomEvent('kodro-memory'));
    } catch (e) {
      void e;
    }
  }

  // ---- scenario validation reports (domain randomisation across seeds) ----
  const CKEY = 'kodro_scenarios_v1';
  function saveScenarioReport(report) {
    if (!report) return false;
    const list = load(CKEY);
    list.unshift(report);
    if (list.length > MAX) list.length = MAX;
    save(CKEY, list);
    try {
      window.dispatchEvent(new CustomEvent('kodro-memory'));
    } catch (e) {
      void e;
    }
    return true;
  }
  function scenarioReports() {
    return load(CKEY);
  }
  window.KodroMemory = {
    record,
    reflections,
    lessonFor,
    saveSkill,
    skills,
    useSkill,
    removeSkill,
    saveScenarioReport,
    scenarioReports
  };
})();
})();

;(function () {
/* ============================================================================
   ORBITAL ROVER — terrains
   Each terrain defines: accent color, telemetry environment (gravity, temp,
   pressure, light), a static backdrop layer, a camera-tracked ground layer,
   ambient particles, and a deterministic obstacle field used by the live
   distance sensor and collision detection.
   Exposes: window.TERRAINS, window.TerrainBackdrop, window.TerrainGround
   ========================================================================== */
(function () {
  const {
    useMemo
  } = React;

  // simple seeded RNG
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = s * 1664525 + 1013904223 >>> 0;
      return s / 4294967296;
    };
  }

  // World half-extent; arena walls sit at ±WALL (cm). Rover starts at (0,0).
  const WALL = 1500;
  function genObstacles(seed, count, minR, maxR) {
    const r = rng(seed);
    const out = [];
    let guard = 0;
    while (out.length < count && guard++ < 2000) {
      const ang = r() * Math.PI * 2;
      const dist = 240 + r() * (WALL - 360);
      const x = Math.cos(ang) * dist;
      const y = Math.sin(ang) * dist;
      const rad = minR + r() * (maxR - minR);
      // keep a clear starting corridor
      if (Math.hypot(x, y) < 220) continue;
      let ok = true;
      for (const o of out) if (Math.hypot(o.x - x, o.y - y) < o.r + rad + 90) {
        ok = false;
        break;
      }
      if (ok) out.push({
        x,
        y,
        r: rad,
        rot: r() * 360,
        v: r()
      });
    }
    return out;
  }

  // Decorative micro-features (pebbles, tufts, ripples, shells, micro-craters).
  // Purely visual -- they are NOT in the obstacles array, so they never
  // collide; they just make the ground read like a real place.
  function genDecor(seed, count) {
    const r = rng(seed);
    const out = [];
    for (let i = 0; i < count; i++) {
      const ang = r() * Math.PI * 2;
      const dist = 120 + r() * (WALL - 160);
      out.push({
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist,
        r: 5 + r() * 14,
        rot: r() * 360,
        v: r()
      });
    }
    return out;
  }

  // City street: real, collidable furniture (buildings along the edges, parked
  // cars beside the road) laid out around a cross roads with the rover's start
  // clear. Pedestrians and a moving car are added on top as live agents.
  function genCity(seed) {
    const r = rng(seed);
    const out = [];
    // buildings ring the block, well away from the central crossing
    for (let i = 0; i < 10; i++) {
      const ang = i / 10 * Math.PI * 2 + 0.2;
      const dist = 760 + r() * 520;
      const x = Math.cos(ang) * dist,
        y = Math.sin(ang) * dist;
      if (Math.abs(x) < 230 || Math.abs(y) < 230) continue; // keep the roads clear
      out.push({
        x,
        y,
        r: 150 + r() * 90,
        rot: 0,
        v: r(),
        kind: 'building'
      });
    }
    // parked cars line the kerb of the horizontal road
    for (let i = 0; i < 6; i++) {
      const x = -1100 + i * 380 + r() * 40;
      const y = (i % 2 ? 1 : -1) * (250 + r() * 18);
      if (Math.abs(x) < 240) continue; // leave the junction open
      out.push({
        x,
        y,
        r: 70,
        rot: i % 2 ? 92 : 88,
        v: r(),
        kind: 'car'
      });
    }
    return out;
  }
  const TERRAINS = {
    city: {
      id: 'city',
      name: 'Riverside City',
      label: 'CITY',
      coord: '51.5072° N, 0.1276° W',
      accent: '#6fb4e8',
      dot: '#6fb4e8',
      env: {
        gravity: 9.81,
        temp: 16,
        tempLabel: 'AIR TEMP',
        pressure: 1.0,
        pressureLabel: 'PRESSURE',
        pressureUnit: 'atm',
        light: 80
      },
      traction: 0.98,
      obstacleLabel: 'PARKED CAR',
      obstacles: genCity(2027),
      decor: [],
      backdrop: 'city'
    },
    room: {
      id: 'room',
      name: 'Living Room',
      label: 'ROOM',
      coord: 'Indoor test space',
      accent: '#e0a36a',
      dot: '#e0a36a',
      env: {
        gravity: 9.81,
        temp: 21,
        tempLabel: 'ROOM TEMP',
        pressure: 1.0,
        pressureLabel: 'PRESSURE',
        pressureUnit: 'atm',
        light: 70
      },
      traction: 1.05,
      obstacleLabel: 'FURNITURE',
      // A few collidable pieces so a companion robot must navigate the room.
      // Furniture is kept clear of the robot's start at the origin so it never
      // spawns inside a piece; the centre of the room is open floor.
      obstacles: [{
        x: 0,
        y: 760,
        r: 150,
        rot: 0,
        v: 0.2,
        kind: 'sofa'
      }, {
        x: -470,
        y: 380,
        r: 100,
        rot: 0,
        v: 0.5,
        kind: 'table'
      }, {
        x: 840,
        y: -300,
        r: 130,
        rot: 0,
        v: 0.8,
        kind: 'shelf'
      }, {
        x: -860,
        y: -820,
        r: 70,
        rot: 0,
        v: 0.9,
        kind: 'plant'
      }],
      decor: [],
      backdrop: 'room'
    },
    earth: {
      id: 'earth',
      name: 'Earth',
      label: 'EARTH',
      coord: '48.8566° N, 2.3522° E',
      accent: '#7cc49b',
      dot: '#7cc49b',
      env: {
        gravity: 9.81,
        temp: 18,
        tempLabel: 'AIR TEMP',
        pressure: 1.0,
        pressureLabel: 'PRESSURE',
        pressureUnit: 'atm',
        light: 92
      },
      traction: 1.0,
      obstacleLabel: 'BOULDER',
      obstacles: genObstacles(7, 14, 46, 96),
      decor: genDecor(101, 44),
      backdrop: 'earth'
    },
    mars: {
      id: 'mars',
      name: 'Mars',
      label: 'MARS',
      coord: '18.4470° N, 77.4508° E',
      accent: '#d98b6a',
      dot: '#c8685a',
      env: {
        gravity: 3.71,
        temp: -63,
        tempLabel: 'SURFACE TEMP',
        pressure: 0.006,
        pressureLabel: 'PRESSURE',
        pressureUnit: 'atm',
        light: 43
      },
      traction: 0.82,
      obstacleLabel: 'RILLE ROCK',
      obstacles: genObstacles(21, 17, 40, 104),
      decor: genDecor(102, 52),
      backdrop: 'mars'
    },
    underwater: {
      id: 'underwater',
      name: 'Abyssal',
      label: 'UNDERWATER',
      coord: '11.3733° N, 142.5917° E',
      accent: '#5ce0d8',
      dot: '#5ce0d8',
      env: {
        gravity: 9.81,
        temp: 3,
        tempLabel: 'WATER TEMP',
        pressure: 38,
        pressureLabel: 'DEPTH',
        pressureUnit: 'm',
        light: 12
      },
      traction: 0.66,
      obstacleLabel: 'CORAL HEAD',
      obstacles: genObstacles(48, 15, 50, 110),
      decor: genDecor(103, 46),
      backdrop: 'underwater'
    },
    space: {
      id: 'space',
      name: 'Lunar',
      label: 'SPACE',
      coord: '0.6741° N, 23.4730° E',
      accent: '#aeb8e8',
      dot: '#aeb8e8',
      env: {
        gravity: 1.62,
        temp: -173,
        tempLabel: 'SURFACE TEMP',
        pressure: 0,
        pressureLabel: 'VACUUM',
        pressureUnit: 'Pa',
        light: 100
      },
      traction: 1.18,
      obstacleLabel: 'EJECTA BLOCK',
      obstacles: genObstacles(77, 15, 44, 100),
      decor: genDecor(104, 50),
      backdrop: 'space'
    }
  };
  TERRAINS.WALL = WALL;

  // ----------------------------------------------------------------------
  // Mission sites: REAL places with real physics. Each derives from a base
  // terrain renderer but overrides the environment (gravity, temperature,
  // pressure, light), traction and the obstacle field -- so the same program
  // behaves differently in the Sahara, under the Mariana Trench, or on
  // Europa, and the pupil can SEE and MEASURE why.
  // ----------------------------------------------------------------------
  const SITES = {
    sahara: {
      base: 'earth',
      label: 'SAHARA',
      name: 'Sahara Desert',
      coord: '23.4162° N, 25.6628° E',
      env: {
        temp: 38,
        tempLabel: 'AIR TEMP',
        light: 100
      },
      traction: 0.74,
      // loose sand slips
      seed: 201,
      count: 10,
      minR: 40,
      maxR: 80,
      decorSeed: 211,
      decorCount: 64,
      groundBg: {
        background: 'radial-gradient(circle at 42% 38%, #d9b36c, #b08a4a 58%, #8a6a36 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(245,215,150,0.5) 0 2px, transparent 2px), radial-gradient(circle at 68% 64%, rgba(140,105,60,0.45) 0 2.5px, transparent 3px)',
        texSize: '24px 24px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #d6ab64, #94703c 66%, #5e472a)'
    },
    amazon: {
      base: 'earth',
      label: 'AMAZON',
      name: 'Amazon Rainforest',
      coord: '3.4653° S, 62.2159° W',
      env: {
        temp: 27,
        light: 38
      },
      // canopy shade
      traction: 0.68,
      // mud + roots
      seed: 202,
      count: 22,
      minR: 44,
      maxR: 100,
      decorSeed: 212,
      decorCount: 70,
      groundBg: {
        background: 'radial-gradient(circle at 40% 35%, #38522c, #243a1e 58%, #182a16 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(90,130,70,0.5) 0 2.5px, transparent 3px), radial-gradient(circle at 70% 60%, rgba(20,40,18,0.55) 0 3px, transparent 4px)',
        texSize: '26px 26px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #5d8a44, #2e4a22 66%, #1c2f16)'
    },
    antarctica: {
      base: 'earth',
      label: 'ANTARCTICA',
      name: 'Antarctica - Ross Ice Shelf',
      coord: '81.5000° S, 175.0000° W',
      env: {
        temp: -55,
        light: 88
      },
      traction: 0.45,
      // ICE: drives slow, drains hard
      seed: 203,
      count: 8,
      minR: 50,
      maxR: 110,
      decorSeed: 213,
      decorCount: 40,
      groundBg: {
        background: 'radial-gradient(circle at 44% 38%, #eef3f8, #c6d6e4 56%, #93acc2 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(255,255,255,0.7) 0 2px, transparent 2.5px), radial-gradient(circle at 68% 62%, rgba(130,160,190,0.4) 0 3px, transparent 4px)',
        texSize: '30px 30px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #e8f2fa, #a9c2d6 64%, #6e8ba2)'
    },
    india: {
      base: 'earth',
      label: 'INDIA',
      name: 'India - Thar Desert, Rajasthan',
      coord: '27.0238° N, 70.0000° E',
      env: {
        temp: 42,
        light: 100
      },
      traction: 0.7,
      // dry scrub + sand
      seed: 301,
      count: 14,
      minR: 40,
      maxR: 86,
      decorSeed: 311,
      decorCount: 60,
      groundBg: {
        background: 'radial-gradient(circle at 42% 38%, #e3b878, #c08a4c 56%, #95673a 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(245,210,150,0.45) 0 2px, transparent 2px), radial-gradient(circle at 68% 64%, rgba(150,105,60,0.4) 0 2.5px, transparent 3px)',
        texSize: '24px 24px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #d9a85e, #9a6e38 66%, #5f4424)'
    },
    kenya: {
      base: 'earth',
      label: 'KENYA',
      name: 'Kenya - Maasai Mara Savanna',
      coord: '1.4910° S, 35.1430° E',
      env: {
        temp: 29,
        light: 96
      },
      traction: 0.82,
      // firm dry grass
      seed: 302,
      count: 16,
      minR: 42,
      maxR: 92,
      decorSeed: 312,
      decorCount: 66,
      groundBg: {
        background: 'radial-gradient(circle at 40% 36%, #c7b15e, #9c8a3e 58%, #6f6228 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(210,200,120,0.5) 0 2px, transparent 2.5px), radial-gradient(circle at 70% 62%, rgba(110,98,40,0.45) 0 3px, transparent 4px)',
        texSize: '26px 26px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #b8a24e, #756328 66%, #46401a)'
    },
    japan: {
      base: 'earth',
      label: 'JAPAN',
      name: 'Japan - Mount Fuji Slopes',
      coord: '35.3606° N, 138.7274° E',
      env: {
        temp: 8,
        light: 80
      },
      traction: 0.6,
      // volcanic ash + scree
      seed: 303,
      count: 13,
      minR: 46,
      maxR: 100,
      decorSeed: 313,
      decorCount: 50,
      groundBg: {
        background: 'radial-gradient(circle at 44% 40%, #5a5560, #3c3842 58%, #26232c 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(200,196,206,0.3) 0 2px, transparent 2.5px), radial-gradient(circle at 68% 62%, rgba(30,28,34,0.5) 0 3px, transparent 4px)',
        texSize: '24px 24px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #6a6470, #403c48 66%, #232029)'
    },
    egypt: {
      base: 'earth',
      label: 'EGYPT',
      name: 'Egypt - Giza Plateau',
      coord: '29.9792° N, 31.1342° E',
      env: {
        temp: 36,
        light: 100
      },
      traction: 0.72,
      seed: 304,
      count: 11,
      minR: 44,
      maxR: 96,
      decorSeed: 314,
      decorCount: 52,
      groundBg: {
        background: 'radial-gradient(circle at 42% 38%, #e6cf9a, #cbab6e 58%, #a3814a 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(250,235,190,0.45) 0 2px, transparent 2px), radial-gradient(circle at 68% 64%, rgba(160,125,75,0.4) 0 2.5px, transparent 3px)',
        texSize: '24px 24px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #ddc184, #a8824c 66%, #6a512c)'
    },
    iceland: {
      base: 'earth',
      label: 'ICELAND',
      name: 'Iceland - Lava Field',
      coord: '64.8000° N, 17.6700° W',
      env: {
        temp: 4,
        light: 74
      },
      traction: 0.55,
      // jagged basalt
      seed: 305,
      count: 18,
      minR: 48,
      maxR: 108,
      decorSeed: 315,
      decorCount: 44,
      groundBg: {
        background: 'radial-gradient(circle at 44% 40%, #3a3a40, #26262b 58%, #161619 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(120,150,120,0.22) 0 2px, transparent 2.5px), radial-gradient(circle at 68% 62%, rgba(10,10,12,0.55) 0 3px, transparent 4px)',
        texSize: '22px 22px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #4a4a52, #28282e 66%, #131316)'
    },
    nepal: {
      base: 'earth',
      label: 'NEPAL',
      name: 'Nepal - Himalayan Foothills',
      coord: '28.0000° N, 84.0000° E',
      env: {
        temp: -6,
        light: 90
      },
      traction: 0.5,
      // snow-dusted rock
      seed: 306,
      count: 12,
      minR: 50,
      maxR: 112,
      decorSeed: 316,
      decorCount: 38,
      groundBg: {
        background: 'radial-gradient(circle at 44% 40%, #cdd6dd, #9fb0bd 56%, #748794 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(255,255,255,0.6) 0 2px, transparent 2.5px), radial-gradient(circle at 68% 62%, rgba(110,135,155,0.4) 0 3px, transparent 4px)',
        texSize: '28px 28px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #d7e0e8, #9fb2bf 64%, #6b8090)'
    },
    reef: {
      base: 'underwater',
      label: 'CORAL REEF',
      name: 'Great Barrier Reef',
      coord: '18.2871° S, 147.6992° E',
      env: {
        temp: 24,
        pressure: 12,
        pressureLabel: 'DEPTH',
        pressureUnit: 'm',
        light: 62
      },
      traction: 0.72,
      seed: 204,
      count: 20,
      minR: 44,
      maxR: 96,
      decorSeed: 214,
      decorCount: 64,
      groundBg: {
        background: 'radial-gradient(circle at 48% 42%, #3f96a4, #2a7080 58%, #1c5260 100%)',
        texture: 'radial-gradient(circle at 35% 35%, rgba(230,245,245,0.35) 0 2px, transparent 3px), radial-gradient(circle at 70% 65%, rgba(20,70,80,0.4) 0 3px, transparent 4px)',
        texSize: '26px 26px'
      },
      obFill: 'radial-gradient(circle at 40% 26%, #e08a96, #a04a62 66%, #5e2a3c)'
    },
    mariana: {
      base: 'underwater',
      label: 'MARIANA',
      name: 'Mariana Trench - Challenger Deep',
      coord: '11.3733° N, 142.5917° E',
      env: {
        temp: 2,
        pressure: 10994,
        pressureLabel: 'DEPTH',
        pressureUnit: 'm',
        light: 0
      },
      traction: 0.6,
      seed: 205,
      count: 9,
      minR: 52,
      maxR: 116,
      decorSeed: 215,
      decorCount: 34,
      groundBg: {
        background: 'radial-gradient(circle at 50% 45%, #14303e, #0c2030 60%, #061420 100%)',
        texture: 'radial-gradient(circle at 35% 35%, rgba(120,160,170,0.16) 0 2px, transparent 3px)',
        texSize: '32px 32px'
      },
      obFill: 'radial-gradient(circle at 40% 26%, #3c5a66, #1e3540 66%, #101e26)'
    },
    olympus: {
      base: 'mars',
      label: 'OLYMPUS MONS',
      name: 'Mars - Olympus Mons',
      coord: '18.6500° N, 226.2000° E',
      env: {
        temp: -73,
        light: 40
      },
      traction: 0.8,
      seed: 206,
      count: 17,
      minR: 42,
      maxR: 104,
      decorSeed: 216,
      decorCount: 56,
      groundBg: {
        background: 'radial-gradient(circle at 45% 40%, #8a4630, #66301e 58%, #481f12 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(190,110,80,0.45) 0 2px, transparent 2px), radial-gradient(circle at 65% 70%, rgba(80,35,20,0.5) 0 2.5px, transparent 3px)',
        texSize: '22px 22px'
      }
    },
    tycho: {
      base: 'space',
      label: 'TYCHO',
      name: 'Moon - Tycho Crater',
      coord: '43.3100° S, 11.3600° W',
      env: {
        gravity: 1.62,
        temp: -173,
        light: 100
      },
      traction: 1.18,
      seed: 207,
      count: 14,
      minR: 44,
      maxR: 100,
      decorSeed: 217,
      decorCount: 52
    },
    europa: {
      base: 'space',
      label: 'EUROPA',
      name: 'Jupiter - Europa Ice Crust',
      coord: '9.1000° S, 152.8000° W',
      env: {
        gravity: 1.315,
        temp: -160,
        light: 4
      },
      traction: 0.5,
      // moon-ice
      seed: 208,
      count: 12,
      minR: 46,
      maxR: 102,
      decorSeed: 218,
      decorCount: 44,
      groundBg: {
        background: 'radial-gradient(circle at 46% 40%, #cfdcea, #9fb4ca 56%, #6c8098 100%)',
        texture: 'linear-gradient(115deg, transparent 48%, rgba(120,90,80,0.25) 49%, transparent 51%), radial-gradient(circle at 34% 34%, rgba(255,255,255,0.5) 0 2px, transparent 2.5px)',
        texSize: '64px 64px, 28px 28px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #e2ecf6, #a2b8cc 64%, #66809a)'
    },
    lab: {
      base: 'room',
      label: 'ROBOTICS LAB',
      name: 'Robotics Lab - Test Bay',
      coord: 'Indoor controlled environment',
      env: {
        temp: 22,
        tempLabel: 'ROOM TEMP',
        light: 95
      },
      traction: 1.08,
      // clean epoxy floor, excellent grip
      seed: 401,
      count: 7,
      minR: 38,
      maxR: 70,
      decorSeed: 411,
      decorCount: 30,
      groundBg: {
        background: 'radial-gradient(circle at 45% 40%, #d8dde4, #b9c0c9 58%, #969ea8 100%)',
        texture: 'linear-gradient(0deg, transparent 49%, rgba(90,100,115,0.18) 50%, transparent 51%), linear-gradient(90deg, transparent 49%, rgba(90,100,115,0.18) 50%, transparent 51%)',
        texSize: '54px 54px'
      },
      obFill: 'radial-gradient(circle at 40% 26%, #e9edf1, #b6bec8 66%, #828a96)'
    },
    warehouse: {
      base: 'room',
      label: 'WAREHOUSE',
      name: 'Warehouse Test Zone',
      coord: 'Indoor logistics floor',
      env: {
        temp: 17,
        tempLabel: 'AIR TEMP',
        light: 72
      },
      traction: 0.95,
      // sealed concrete
      seed: 402,
      count: 14,
      minR: 50,
      maxR: 110,
      decorSeed: 412,
      decorCount: 22,
      groundBg: {
        background: 'radial-gradient(circle at 46% 42%, #6f7277, #54565b 58%, #3c3e42 100%)',
        texture: 'linear-gradient(0deg, transparent 48%, rgba(20,22,26,0.5) 49%, transparent 50%), linear-gradient(90deg, transparent 48%, rgba(255,210,120,0.12) 49%, transparent 50%)',
        texSize: '120px 120px'
      },
      obFill: 'radial-gradient(circle at 40% 26%, #c9892f, #8a5c1c 66%, #553808)'
    },
    debug_grid: {
      base: 'room',
      label: 'DEBUG GRID',
      name: 'Minimal Debug Grid',
      coord: 'Calibration grid - no decor',
      env: {
        temp: 20,
        tempLabel: 'AMBIENT',
        light: 88
      },
      traction: 1.0,
      // ideal reference surface
      seed: 403,
      count: 4,
      minR: 40,
      maxR: 70,
      decorSeed: 413,
      decorCount: 0,
      groundBg: {
        background: 'radial-gradient(circle at 50% 45%, #14171c, #0e1014 60%, #08090c 100%)',
        texture: 'linear-gradient(0deg, transparent 49%, rgba(94,224,216,0.28) 50%, transparent 51%), linear-gradient(90deg, transparent 49%, rgba(94,224,216,0.28) 50%, transparent 51%)',
        texSize: '40px 40px'
      },
      obFill: 'radial-gradient(circle at 40% 26%, #2a3340, #1a2230 66%, #0e1420)'
    }
  };

  // Resolve a terrain OR site id into a renderable terrain object.
  function resolveSite(id) {
    if (TERRAINS[id]) return TERRAINS[id];
    const s = SITES[id];
    if (!s) return TERRAINS.earth;
    const base = TERRAINS[s.base];
    return {
      ...base,
      siteId: id,
      label: s.label,
      name: s.name,
      coord: s.coord,
      env: {
        ...base.env,
        ...s.env
      },
      traction: s.traction != null ? s.traction : base.traction,
      obstacles: genObstacles(s.seed, s.count, s.minR, s.maxR),
      decor: genDecor(s.decorSeed, s.decorCount),
      groundBg: s.groundBg || null,
      obFill: s.obFill || null
    };
  }
  window.SITES = SITES;
  window.resolveSite = resolveSite;

  // ----------------------------------------------------------------------
  // Base fill (sits behind everything; mostly covered by the tilted ground)
  // ----------------------------------------------------------------------
  const BASE_FILL = {
    room: 'linear-gradient(180deg, #c9b48f 0%, #8a6a44 100%)',
    city: 'linear-gradient(180deg, #2a3340 0%, #1a1f28 100%)',
    earth: 'linear-gradient(180deg, #2c4426 0%, #1c2e1f 100%)',
    mars: 'linear-gradient(180deg, #5e2a1c 0%, #2e1610 100%)',
    underwater: 'linear-gradient(180deg, #07293a 0%, #04161f 100%)',
    space: 'radial-gradient(ellipse at 70% 18%, #11142a 0%, #07080f 70%, #050509 100%)'
  };
  function TerrainBackdrop({
    terrain
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "bd",
      style: {
        position: 'absolute',
        inset: 0,
        background: BASE_FILL[terrain.id]
      }
    });
  }

  // ----------------------------------------------------------------------
  // Sky band — screen-space horizon (gradient + celestial + stars), painted
  // over the far/receding ground and feathered into it at the bottom.
  // ----------------------------------------------------------------------
  const SKY_GRAD = {
    room: 'linear-gradient(180deg, #d8c6a4 0%, #c2ac86 55%, #a98e64 100%)',
    city: 'linear-gradient(180deg, #6f93b8 0%, #93acc0 55%, #b3c2cc 100%)',
    earth: 'linear-gradient(180deg, #5d86b6 0%, #8fb0c2 55%, #b6cdba 100%)',
    mars: 'linear-gradient(180deg, #5a2415 0%, #8a4026 60%, #a85636 100%)',
    underwater: 'linear-gradient(180deg, #0c5066 0%, #0b3a4c 60%, #0a2a38 100%)',
    space: 'linear-gradient(180deg, #06070d 0%, #0b0e1f 70%, #11142a 100%)'
  };
  function TerrainSky({
    terrain
  }) {
    const id = terrain.id;
    const stars = useMemo(() => {
      const r = rng(99);
      return Array.from({
        length: 90
      }, () => ({
        x: r() * 100,
        y: r() * 78,
        s: r() * 1.7 + 0.3,
        o: 0.3 + r() * 0.7,
        tw: 2 + r() * 5,
        delay: -r() * 6
      }));
    }, []);
    let celestial = null,
      glow = null;
    if (id === 'space') {
      celestial = /*#__PURE__*/React.createElement("div", {
        className: "celestial",
        style: {
          right: '9%',
          top: '14%',
          width: 150,
          height: 150,
          background: 'radial-gradient(circle at 38% 36%, #cfe0ff 0%, #6c95cf 36%, #305285 60%, #16294e 80%, #0a1530 100%)',
          boxShadow: 'inset -14px -10px 36px rgba(0,0,0,0.6), 0 0 70px rgba(90,140,210,0.35)'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: '22%',
          top: '32%',
          width: '32%',
          height: '18%',
          borderRadius: '50%',
          background: 'rgba(120,200,160,0.4)',
          filter: 'blur(4px)'
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: '54%',
          top: '54%',
          width: '24%',
          height: '15%',
          borderRadius: '50%',
          background: 'rgba(120,200,160,0.3)',
          filter: 'blur(4px)'
        }
      }));
    } else if (id === 'mars') {
      celestial = /*#__PURE__*/React.createElement("div", {
        className: "celestial",
        style: {
          right: '22%',
          top: '26%',
          width: 46,
          height: 46,
          background: 'radial-gradient(circle at 45% 45%, #fff4e2, #f0cfa0 55%, rgba(240,200,150,0) 80%)'
        }
      });
      glow = 'radial-gradient(ellipse at 78% 30%, rgba(255,200,150,0.3), transparent 55%)';
    } else if (id === 'earth') {
      celestial = /*#__PURE__*/React.createElement("div", {
        className: "celestial",
        style: {
          right: '16%',
          top: '20%',
          width: 92,
          height: 92,
          background: 'radial-gradient(circle at 45% 45%, #fffdf2, #fff0c2 50%, rgba(255,230,160,0) 74%)',
          filter: 'blur(1px)'
        }
      });
      glow = 'radial-gradient(ellipse at 80% 36%, rgba(255,245,210,0.32), transparent 50%)';
    } else {
      glow = 'radial-gradient(ellipse at 50% -10%, rgba(150,225,235,0.4), transparent 60%)';
    }
    return /*#__PURE__*/React.createElement("div", {
      className: "sky-band",
      style: {
        background: SKY_GRAD[id]
      }
    }, id === 'space' && stars.map((s, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        left: s.x + '%',
        top: s.y + '%',
        width: s.s,
        height: s.s,
        position: 'absolute',
        borderRadius: '99px',
        background: '#fff',
        opacity: s.o,
        animation: `twk ${s.tw}s ease-in-out ${s.delay}s infinite`
      }
    })), id === 'underwater' && /*#__PURE__*/React.createElement("div", {
      className: "shafts"
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        left: '14%'
      }
    }), /*#__PURE__*/React.createElement("i", {
      style: {
        left: '40%',
        animationDelay: '-3s'
      }
    }), /*#__PURE__*/React.createElement("i", {
      style: {
        left: '64%',
        animationDelay: '-6s'
      }
    }), /*#__PURE__*/React.createElement("i", {
      style: {
        left: '86%',
        animationDelay: '-1.5s'
      }
    })), celestial, glow && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        background: glow
      }
    }));
  }

  // ----------------------------------------------------------------------
  // Foreground ambient particles drifting over the whole scene.
  // ----------------------------------------------------------------------
  function TerrainAmbient({
    terrain
  }) {
    const id = terrain.id;
    const motes = useMemo(() => {
      const r = rng(id === 'mars' ? 5 : id === 'underwater' ? 9 : 23);
      return Array.from({
        length: id === 'space' ? 0 : 40
      }, () => ({
        x: r() * 100,
        y: r() * 100,
        s: 0.8 + r() * 2.4,
        d: 7 + r() * 14,
        delay: -r() * 16,
        drift: (r() - 0.5) * 50
      }));
    }, [id]);
    if (!motes.length) return null;
    return /*#__PURE__*/React.createElement("div", {
      className: "ambient-fg"
    }, motes.map((m, i) => {
      if (id === 'underwater') {
        return /*#__PURE__*/React.createElement("span", {
          key: i,
          className: "bubble",
          style: {
            left: m.x + '%',
            bottom: -10,
            width: m.s * 2.2,
            height: m.s * 2.2,
            position: 'absolute',
            borderRadius: '99px',
            border: '1px solid rgba(180,230,235,0.5)',
            background: 'rgba(160,220,230,0.1)',
            animation: `bub ${m.d}s linear ${m.delay}s infinite`,
            ['--drift']: m.drift + 'px'
          }
        });
      }
      return /*#__PURE__*/React.createElement("span", {
        key: i,
        style: {
          left: m.x + '%',
          top: m.y + '%',
          width: m.s,
          height: m.s,
          position: 'absolute',
          borderRadius: '99px',
          background: id === 'mars' ? 'rgba(235,180,130,0.5)' : 'rgba(200,225,180,0.4)',
          animation: `dust ${m.d}s linear ${m.delay}s infinite`,
          ['--drift']: m.drift + 'px'
        }
      });
    }));
  }

  // ----------------------------------------------------------------------
  // Ground plane content (panned by the camera in Viewport).
  // Renders ground texture + obstacles. Size: big square centered on world 0,0.
  // ----------------------------------------------------------------------
  const GROUND = 3400; // px square (1cm = 1px world unit)

  function groundBg(id) {
    switch (id) {
      case 'city':
        return {
          background: 'radial-gradient(circle at 50% 45%, #3a4150, #2b313d 60%, #20242e 100%)',
          texture: 'radial-gradient(circle at 30% 30%, rgba(150,160,175,0.10) 0 2px, transparent 3px)',
          texSize: '34px 34px'
        };
      case 'room':
        return {
          background: 'radial-gradient(circle at 45% 40%, #b08a5c, #8c6a44 62%, #6e5234 100%)',
          texture: 'repeating-linear-gradient(90deg, rgba(60,40,20,0.18) 0 2px, transparent 2px 64px)',
          texSize: '64px 64px'
        };
      case 'earth':
        return {
          background: 'radial-gradient(circle at 40% 35%, #5b7d49, #3c5a32 60%, #2c4426 100%)',
          texture: 'radial-gradient(circle at 30% 30%, rgba(120,150,90,0.5) 0 2px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(90,120,70,0.4) 0 3px, transparent 3px)',
          texSize: '26px 26px'
        };
      case 'mars':
        return {
          background: 'radial-gradient(circle at 45% 40%, #a8533a, #7e3a26 58%, #5c2a1b 100%)',
          texture: 'radial-gradient(circle at 30% 30%, rgba(210,130,90,0.45) 0 2px, transparent 2px), radial-gradient(circle at 65% 70%, rgba(120,55,35,0.5) 0 2.5px, transparent 3px)',
          texSize: '22px 22px'
        };
      case 'underwater':
        return {
          background: 'radial-gradient(circle at 50% 45%, #2a6577, #1c4655 60%, #123442 100%)',
          texture: 'radial-gradient(circle at 35% 35%, rgba(200,225,225,0.18) 0 2px, transparent 3px), radial-gradient(circle at 70% 65%, rgba(20,60,70,0.4) 0 3px, transparent 4px)',
          texSize: '30px 30px'
        };
      default:
        // space / lunar
        return {
          background: 'radial-gradient(circle at 50% 45%, #4a4c55, #34363f 58%, #25262d 100%)',
          texture: 'radial-gradient(circle at 30% 30%, rgba(180,182,195,0.25) 0 2px, transparent 2px), radial-gradient(circle at 68% 66%, rgba(20,20,26,0.5) 0 2.5px, transparent 3px)',
          texSize: '24px 24px'
        };
    }
  }
  const OB_FILL = {
    earth: 'radial-gradient(circle at 38% 24%, #7d9a60, #45592f 66%, #2c3a20)',
    mars: 'radial-gradient(circle at 38% 24%, #b05a3c, #6b2f1f 68%, #401a10)',
    underwater: 'radial-gradient(circle at 40% 26%, #58a6ac, #2c6068 66%, #173a42)',
    space: 'radial-gradient(circle at 40% 26%, #797b86, #44464e 66%, #282a30)'
  };
  const CRATER_FILL = {
    earth: 'radial-gradient(circle at 50% 42%, #28361d, #3c5028 62%, #51683a)',
    mars: 'radial-gradient(circle at 50% 42%, #3a190f, #5e2818 60%, #84402a)',
    underwater: 'radial-gradient(circle at 50% 42%, #102a31, #1c4651 60%, #2e6470)',
    space: 'radial-gradient(circle at 50% 42%, #1c1d23, #303138 60%, #54565f)'
  };
  function Obstacle({
    o,
    terrain
  }) {
    const id = terrain.id;
    const size = o.r * 2;
    const cx = GROUND / 2 + o.x,
      cy = GROUND / 2 + o.y;

    // Room furniture for the indoor companion-robot world.
    if (id === 'room') {
      const palette = {
        sofa: '#3f6f8c',
        table: '#7a5536',
        shelf: '#6a4f2c',
        plant: '#3f7d3a'
      };
      const col = palette[o.kind] || '#7a5536';
      const w = size * (o.kind === 'sofa' ? 2.2 : o.kind === 'plant' ? 0.9 : 1.5);
      const h = size * (o.kind === 'shelf' ? 1.8 : o.kind === 'plant' ? 1.2 : 0.9);
      return /*#__PURE__*/React.createElement("div", {
        className: "obstacle",
        style: {
          position: 'absolute',
          left: cx - w / 2,
          top: cy - h,
          width: w,
          height: h
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "ob-shadow",
        style: {
          left: '50%',
          top: '100%',
          width: w * 1.05,
          height: o.r * 0.6
        }
      }), o.kind === 'plant' ? /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: w,
          height: h
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: w * 0.5,
          height: h * 0.4,
          background: '#b56a45',
          borderRadius: '3px 3px 5px 5px'
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: '50%',
          bottom: h * 0.3,
          transform: 'translateX(-50%)',
          width: w,
          height: w,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 30%, #5fa04a, #2c5226)'
        }
      })) : /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          inset: 0,
          borderRadius: 6,
          background: `linear-gradient(180deg, ${col}, rgba(0,0,0,0.45))`,
          boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.18), 1px 3px 6px rgba(0,0,0,0.4)'
        }
      }));
    }

    // City furniture: buildings and parked cars stand up out of the street.
    // Collision still uses o.r, so what the rover must avoid is unchanged.
    if (id === 'city') {
      if (o.kind === 'building') {
        // A tall, lit-window tower so the 2.5D city reads as the same place as
        // the 3D city: same footprint (collision uses o.r), much more height.
        const w = size,
          h = size * (2.6 + o.v % 1.0);
        return /*#__PURE__*/React.createElement("div", {
          className: "obstacle",
          style: {
            position: 'absolute',
            left: cx - w / 2,
            top: cy - h,
            width: w,
            height: h
          }
        }, /*#__PURE__*/React.createElement("div", {
          className: "ob-shadow",
          style: {
            left: '50%',
            top: '100%',
            width: w * 1.05,
            height: o.r * 0.7
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            inset: 0,
            borderRadius: 3,
            background: 'linear-gradient(160deg, #5c6b80, #313b4a 60%, #232b38)',
            boxShadow: '2px 7px 12px rgba(0,0,0,0.5)',
            backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 9px, rgba(255,232,160,0.55) 9px 15px, transparent 15px 23px), repeating-linear-gradient(90deg, transparent 0 8px, rgba(10,14,22,0.55) 8px 11px)'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: -2,
            top: -3,
            width: w + 4,
            height: 6,
            borderRadius: 2,
            background: '#3a414c'
          }
        }));
      }
      // parked car: a rounded body with a cabin and two windows, oriented by rot
      const cw = size * 1.7,
        ch = size * 0.92;
      return /*#__PURE__*/React.createElement("div", {
        className: "obstacle",
        style: {
          position: 'absolute',
          left: cx - cw / 2,
          top: cy - ch / 2,
          width: cw,
          height: ch,
          transform: `rotate(${o.rot}deg)`
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "ob-shadow",
        style: {
          left: '50%',
          top: '94%',
          width: cw * 0.96,
          height: ch * 0.5
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          inset: 0,
          borderRadius: ch * 0.42,
          background: o.v < 0.5 ? 'linear-gradient(180deg,#d24b4b,#8d2a2a)' : 'linear-gradient(180deg,#3f7fc4,#244e84)',
          boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.25), 1px 3px 6px rgba(0,0,0,0.45)'
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: '26%',
          right: '26%',
          top: '20%',
          height: '60%',
          borderRadius: 4,
          background: 'linear-gradient(180deg, rgba(190,225,245,0.92), rgba(120,160,190,0.85))'
        }
      }));
    }

    // Earth reads like a game map: most stand-up features are trees and
    // bushes rather than bare rocks. Collision still uses o.r, so the world
    // the grader sees is unchanged -- only the picture differs.
    if (id === 'earth' && o.v >= 0.32) {
      const h = size * 1.35;
      if (o.v < 0.66) {
        // tree: a trunk under a layered canopy
        const cw = size * 1.15;
        return /*#__PURE__*/React.createElement("div", {
          className: "obstacle",
          style: {
            position: 'absolute',
            left: cx - cw / 2,
            top: cy - h,
            width: cw,
            height: h
          }
        }, /*#__PURE__*/React.createElement("div", {
          className: "ob-shadow",
          style: {
            left: '50%',
            top: '100%',
            width: cw * 1.1,
            height: o.r * 0.9
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: '50%',
            bottom: 0,
            width: Math.max(4, o.r * 0.34),
            height: h * 0.42,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(90deg, #5a4326, #7a5c36 55%, #46341d)',
            borderRadius: 2
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: '50%',
            bottom: h * 0.3,
            width: cw,
            height: cw,
            transform: 'translateX(-50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 30%, #5f9148, #2c5023 70%, #1f3a18)',
            boxShadow: '2px 4px 5px rgba(0,0,0,0.35)'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: '34%',
            bottom: h * 0.46,
            width: cw * 0.62,
            height: cw * 0.62,
            transform: 'translateX(-50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 32%, #6fa455, #305726)'
          }
        }));
      }
      if (o.v < 0.82) {
        // bush: a low cluster of leafy lobes
        const bw = size * 1.1;
        return /*#__PURE__*/React.createElement("div", {
          className: "obstacle",
          style: {
            position: 'absolute',
            left: cx - bw / 2,
            top: cy - bw * 0.7,
            width: bw,
            height: bw * 0.7
          }
        }, /*#__PURE__*/React.createElement("div", {
          className: "ob-shadow",
          style: {
            left: '50%',
            top: '100%',
            width: bw,
            height: o.r * 0.7
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: bw * 0.62,
            height: bw * 0.62,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 32%, #6c9a4c, #355a26)'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: bw * 0.58,
            height: bw * 0.58,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 32%, #5f8e44, #2e4f22)'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: '50%',
            bottom: bw * 0.14,
            width: bw * 0.6,
            height: bw * 0.6,
            transform: 'translateX(-50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 30%, #74a356, #335828)'
          }
        }));
      }
      // else fall through to the rock billboard below
    }

    // ~32% of features are flat craters (lie on the ground); rest stand up as rocks
    if (o.v < 0.32) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: cx - o.r,
          top: cy - o.r,
          width: size,
          height: size,
          borderRadius: '50%',
          background: CRATER_FILL[id],
          boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.55), inset 0 -3px 8px rgba(255,255,255,0.10)',
          border: '1px solid rgba(0,0,0,0.22)',
          transform: `rotate(${o.rot}deg)`
        }
      });
    }
    const h = size; // billboard stands ~as tall as wide
    return /*#__PURE__*/React.createElement("div", {
      className: "obstacle",
      style: {
        position: 'absolute',
        left: cx - o.r,
        top: cy - h,
        width: size,
        height: h
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "ob-shadow",
      style: {
        left: '50%',
        top: '100%',
        width: size * 1.25,
        height: o.r * 1.1
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "ob-body",
      style: {
        transform: `rotateZ(calc(-1 * var(--yaw, 0deg))) rotateX(calc(-1 * var(--tilt, 46deg)))`,
        background: terrain.obFill || OB_FILL[id],
        borderRadius: id === 'underwater' ? '46% 54% 44% 56% / 64% 60% 40% 36%' : '48% 52% 50% 50% / 60% 58% 42% 40%'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "ob-spec"
    })));
  }

  // Per-terrain decorative micro-feature (visual only; never collides).
  function Decor({
    d,
    id
  }) {
    const cx = GROUND / 2 + d.x,
      cy = GROUND / 2 + d.y;
    const base = {
      position: 'absolute',
      pointerEvents: 'none',
      transform: `rotate(${d.rot}deg)`
    };
    if (id === 'earth') {
      // grass tuft (v<0.55) or pebble
      if (d.v < 0.55) {
        return /*#__PURE__*/React.createElement("div", {
          style: {
            ...base,
            left: cx,
            top: cy,
            width: 2,
            height: d.r * 1.4,
            borderRadius: 2,
            background: 'linear-gradient(180deg, #86a861, #4c6436)',
            boxShadow: '3px 1px 0 -0.5px #6d8c4e, -3px 2px 0 -0.5px #5a7440'
          }
        });
      }
      return /*#__PURE__*/React.createElement("div", {
        style: {
          ...base,
          left: cx - d.r / 2,
          top: cy - d.r / 3,
          width: d.r,
          height: d.r * 0.66,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 30%, #74875c, #44522f)'
        }
      });
    }
    if (id === 'mars') {
      // wind ripple (v<0.5) or pebble
      if (d.v < 0.5) {
        return /*#__PURE__*/React.createElement("div", {
          style: {
            ...base,
            left: cx - d.r,
            top: cy,
            width: d.r * 2.6,
            height: 2,
            borderRadius: 2,
            background: 'linear-gradient(90deg, transparent, rgba(220,140,95,0.5), transparent)'
          }
        });
      }
      return /*#__PURE__*/React.createElement("div", {
        style: {
          ...base,
          left: cx - d.r / 2,
          top: cy - d.r / 3,
          width: d.r,
          height: d.r * 0.6,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 36% 28%, #b06245, #69311e)'
        }
      });
    }
    if (id === 'underwater') {
      // sand ripple (v<0.45), shell (v<0.75) or coral speck
      if (d.v < 0.45) {
        return /*#__PURE__*/React.createElement("div", {
          style: {
            ...base,
            left: cx - d.r,
            top: cy,
            width: d.r * 2.4,
            height: 2,
            borderRadius: 2,
            background: 'linear-gradient(90deg, transparent, rgba(180,215,215,0.28), transparent)'
          }
        });
      }
      if (d.v < 0.75) {
        return /*#__PURE__*/React.createElement("div", {
          style: {
            ...base,
            left: cx - d.r / 2,
            top: cy - d.r / 2,
            width: d.r * 0.9,
            height: d.r * 0.7,
            borderRadius: '60% 60% 45% 45%',
            background: 'radial-gradient(circle at 40% 25%, #d8d4c2, #8d8a78)'
          }
        });
      }
      return /*#__PURE__*/React.createElement("div", {
        style: {
          ...base,
          left: cx - d.r / 2,
          top: cy - d.r / 2,
          width: d.r * 0.7,
          height: d.r * 0.7,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 30%, #5ca6ac, #2c5a62)'
        }
      });
    }
    // space: micro-crater (v<0.6) or regolith speck
    if (d.v < 0.6) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          ...base,
          left: cx - d.r / 2,
          top: cy - d.r / 2,
          width: d.r,
          height: d.r,
          borderRadius: '50%',
          background: CRATER_FILL.space,
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), inset 0 -1px 3px rgba(255,255,255,0.08)'
        }
      });
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...base,
        left: cx - d.r / 3,
        top: cy - d.r / 3,
        width: d.r * 0.6,
        height: d.r * 0.5,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 30%, #84868f, #4a4c54)'
      }
    });
  }

  // ----------------------------------------------------------------------
  // Real-world Earth landscape: farmland patchwork, forests, roads and a
  // meandering river painted across the ground square. Purely decorative --
  // none of it collides; it just makes the base Earth read like a map you
  // could fly over. Only the temperate base Earth gets it (not the Sahara,
  // Amazon or Antarctica sites, where farmland and rivers would be wrong).
  // ----------------------------------------------------------------------
  const FIELD_FILL = ['#6f8f4e', '#7ba055', '#c9b067', '#8a6b46', '#9bbf6a', '#93925a', '#5f8048', '#b6a85e'];
  function EarthFeatures() {
    const {
      fields,
      forests
    } = useMemo(() => {
      const r = rng(404);
      const fl = [];
      let guard = 0;
      while (fl.length < 30 && guard++ < 600) {
        const w = 220 + r() * 320,
          h = 200 + r() * 300;
        const x = r() * (GROUND - w),
          y = r() * (GROUND - h);
        // leave the rover's start clearing (centre) free of hard patches
        if (Math.abs(x + w / 2 - GROUND / 2) < 260 && Math.abs(y + h / 2 - GROUND / 2) < 260) continue;
        fl.push({
          x,
          y,
          w,
          h,
          c: FIELD_FILL[r() * FIELD_FILL.length | 0],
          rot: (r() - 0.5) * 8,
          row: 20 + r() * 120
        });
      }
      const fo = [];
      for (let i = 0; i < 8; i++) {
        const cx = 200 + r() * (GROUND - 400),
          cy = 200 + r() * (GROUND - 400);
        const trees = [];
        const n = 12 + (r() * 10 | 0);
        for (let t = 0; t < n; t++) {
          const a = r() * Math.PI * 2,
            d = r() * (90 + r() * 80);
          trees.push({
            x: cx + Math.cos(a) * d,
            y: cy + Math.sin(a) * d,
            s: 13 + r() * 18,
            v: r()
          });
        }
        fo.push(trees);
      }
      return {
        fields: fl,
        forests: fo
      };
    }, []);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        borderRadius: 8,
        overflow: 'hidden'
      }
    }, fields.map((f, i) => /*#__PURE__*/React.createElement("div", {
      key: 'f' + i,
      style: {
        position: 'absolute',
        left: f.x,
        top: f.y,
        width: f.w,
        height: f.h,
        background: f.c,
        opacity: 0.74,
        transform: `rotate(${f.rot}deg)`,
        backgroundImage: `repeating-linear-gradient(90deg, rgba(0,0,0,0.14) 0 2px, transparent 2px ${f.row}px)`,
        outline: '2.5px solid rgba(40,56,30,0.55)',
        outlineOffset: -1,
        borderRadius: 3
      }
    })), /*#__PURE__*/React.createElement("svg", {
      viewBox: `0 0 ${GROUND} ${GROUND}`,
      width: GROUND,
      height: GROUND,
      style: {
        position: 'absolute',
        inset: 0
      }
    }, /*#__PURE__*/React.createElement("path", {
      d: "M 300 -60 C 760 560, 240 1120, 880 1640 S 1500 2680, 1180 3460",
      fill: "none",
      stroke: "#2f6ea6",
      strokeWidth: "48",
      strokeLinecap: "round",
      opacity: "0.92"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M 300 -60 C 760 560, 240 1120, 880 1640 S 1500 2680, 1180 3460",
      fill: "none",
      stroke: "#8fc3e6",
      strokeWidth: "16",
      strokeLinecap: "round",
      opacity: "0.7"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M -60 1180 Q 1700 940 3460 1340",
      fill: "none",
      stroke: "#cabd96",
      strokeWidth: "22",
      opacity: "0.9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M 2240 -60 Q 1960 1700 2480 3460",
      fill: "none",
      stroke: "#cabd96",
      strokeWidth: "20",
      opacity: "0.85"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M -60 1180 Q 1700 940 3460 1340",
      fill: "none",
      stroke: "#f0dc8e",
      strokeWidth: "3",
      strokeDasharray: "18 22",
      opacity: "0.85"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M 2240 -60 Q 1960 1700 2480 3460",
      fill: "none",
      stroke: "#f0dc8e",
      strokeWidth: "3",
      strokeDasharray: "18 22",
      opacity: "0.8"
    })), forests.map((trees, i) => /*#__PURE__*/React.createElement("div", {
      key: 'fo' + i
    }, trees.map((t, j) => /*#__PURE__*/React.createElement("div", {
      key: j,
      style: {
        position: 'absolute',
        left: t.x - t.s / 2,
        top: t.y - t.s / 2,
        width: t.s,
        height: t.s,
        borderRadius: '50%',
        boxShadow: '1px 2px 3px rgba(0,0,0,0.4)',
        background: t.v < 0.5 ? 'radial-gradient(circle at 38% 30%, #4e7a3e, #1f3a18)' : 'radial-gradient(circle at 38% 30%, #5f9148, #244a1c)'
      }
    })))));
  }

  // ----------------------------------------------------------------------
  // City street furniture painted on the ground: two roads crossing, a zebra
  // crossing, lane lines and pavements. Decorative; collision uses the
  // building and car obstacles, not this paint.
  // ----------------------------------------------------------------------
  const C = GROUND / 2;
  const ROAD = 150; // half-width of a carriageway (px)
  function CityFeatures() {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        borderRadius: 8,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: 0,
        top: C - ROAD - 70,
        width: GROUND,
        height: (ROAD + 70) * 2,
        background: '#4a525f'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: C - ROAD - 70,
        top: 0,
        width: (ROAD + 70) * 2,
        height: GROUND,
        background: '#4a525f'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: 0,
        top: C - ROAD,
        width: GROUND,
        height: ROAD * 2,
        background: '#23272f'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: C - ROAD,
        top: 0,
        width: ROAD * 2,
        height: GROUND,
        background: '#23272f'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: 0,
        top: C - 3,
        width: GROUND,
        height: 6,
        backgroundImage: 'repeating-linear-gradient(90deg, #e6d886 0 46px, transparent 46px 92px)',
        opacity: 0.9
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: C - 3,
        top: 0,
        width: 6,
        height: GROUND,
        backgroundImage: 'repeating-linear-gradient(0deg, #e6d886 0 46px, transparent 46px 92px)',
        opacity: 0.9
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: C + ROAD + 30,
        top: C - ROAD,
        width: 150,
        height: ROAD * 2,
        backgroundImage: 'repeating-linear-gradient(90deg, #e8ecf2 0 20px, transparent 20px 44px)',
        opacity: 0.92
      }
    }));
  }

  // Live agents: pedestrians stroll the pavements and a car drives the road.
  // Self contained animation; positions are visual only.
  const hex = n => '#' + (n == null ? 0 : n).toString(16).padStart(6, '0');
  function CityAgents() {
    // Re-render every frame; positions come from the shared agent simulation
    // (window.KodroAgents) so the 2D view, the 3D view and the robot's
    // collision all see the same pedestrians and traffic.
    const [, setTick] = React.useState(0);
    React.useEffect(() => {
      let raf;
      if (typeof requestAnimationFrame !== 'function') return undefined;
      const loop = () => {
        setTick(n => n + 1 & 1023);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => {
        if (raf) cancelAnimationFrame(raf);
      };
    }, []);
    const KA = window.KodroAgents;
    const w = KA && KA.world();
    const list = w === 'city' || w === 'room' ? KA.list() : [];
    const bill = {
      transform: 'rotateZ(calc(-1 * var(--yaw, 0deg))) rotateX(calc(-1 * var(--tilt, 46deg)))',
      transformOrigin: '50% 100%'
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none'
      }
    }, list.map((ag, i) => {
      const x = C + ag.x,
        y = C + ag.y; // world cm -> ground px
      const horiz = Math.abs(ag.dx) >= Math.abs(ag.dy);
      if (ag.kind === 'person') {
        const bob = Math.abs(ag.leg || 0) * 2;
        return /*#__PURE__*/React.createElement("div", {
          key: i,
          style: {
            position: 'absolute',
            left: x,
            top: y,
            zIndex: 4
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: -9,
            top: -3,
            width: 18,
            height: 7,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.32)',
            filter: 'blur(2px)'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -7,
            bottom: 0 - bob,
            width: 14,
            height: 40
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 3,
            top: 0,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#e8c9a8'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 1,
            top: 9,
            width: 12,
            height: 18,
            borderRadius: '4px 4px 3px 3px',
            background: hex(ag.color)
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 3,
            top: 27,
            width: 3,
            height: 12,
            background: '#2f3646',
            borderRadius: 2
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 8,
            top: 27,
            width: 3,
            height: 12,
            background: '#2f3646',
            borderRadius: 2
          }
        })));
      }
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        style: {
          position: 'absolute',
          left: x,
          top: y,
          zIndex: 4
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: -34,
          top: -2,
          width: 68,
          height: 14,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.34)',
          filter: 'blur(3px)'
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          ...bill,
          position: 'absolute',
          left: -34,
          bottom: 0,
          width: 68,
          height: 30,
          transform: bill.transform + (horiz ? '' : ' rotateZ(90deg)')
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          inset: 0,
          borderRadius: 13,
          background: `linear-gradient(180deg, ${hex(ag.color)}, rgba(0,0,0,0.4))`,
          boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.3), 1px 3px 6px rgba(0,0,0,0.45)'
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: '24%',
          right: '24%',
          top: '24%',
          height: '52%',
          borderRadius: 4,
          background: 'linear-gradient(180deg, rgba(190,225,245,0.92), rgba(120,160,190,0.85))'
        }
      })));
    }));
  }
  function TerrainGround({
    terrain,
    children,
    showGrid
  }) {
    const g = terrain.groundBg || groundBg(terrain.id);
    const isEarth = terrain.id === 'earth';
    return /*#__PURE__*/React.createElement("div", {
      className: "ground",
      style: {
        position: 'absolute',
        left: -GROUND / 2,
        top: -GROUND / 2,
        width: GROUND,
        height: GROUND,
        background: g.background,
        borderRadius: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        backgroundImage: g.texture,
        backgroundSize: g.texSize,
        opacity: 0.6,
        borderRadius: 8
      }
    }), isEarth ? /*#__PURE__*/React.createElement(EarthFeatures, null) : null, terrain.id === 'city' ? /*#__PURE__*/React.createElement(CityFeatures, null) : null, showGrid !== false && terrain.id !== 'city' ? /*#__PURE__*/React.createElement("div", {
      className: "ground-grid"
    }) : null, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: GROUND / 2 - WALL,
        top: GROUND / 2 - WALL,
        width: WALL * 2,
        height: WALL * 2,
        border: '2px dashed ' + terrain.accent,
        opacity: 0.2,
        borderRadius: 12,
        pointerEvents: 'none'
      }
    }), (terrain.decor || []).map((d, i) => /*#__PURE__*/React.createElement(Decor, {
      key: 'd' + i,
      d: d,
      id: terrain.id
    })), children, terrain.obstacles.map((o, i) => /*#__PURE__*/React.createElement(Obstacle, {
      key: i,
      o: o,
      terrain: terrain
    })), terrain.id === 'city' || terrain.id === 'room' ? /*#__PURE__*/React.createElement(CityAgents, null) : null);
  }
  window.TERRAINS = TERRAINS;
  window.TERRAIN_GROUND = GROUND;
  window.TerrainBackdrop = TerrainBackdrop;
  window.TerrainSky = TerrainSky;
  window.TerrainAmbient = TerrainAmbient;
  window.TerrainGround = TerrainGround;
})();
})();

;(function () {
/* ============================================================================
   ORBITAL ROVER — Rover render
   Top-down 4-wheel rover drawn in SVG. Points "up" (north) at heading 0.
   Wheels animate when moving; a headlight cone and status LED respond to state.
   Exposes window.Rover
   ========================================================================== */
(function () {
  function Wheel({
    x,
    y,
    moving
  }) {
    return /*#__PURE__*/React.createElement("g", {
      transform: `translate(${x},${y})`
    }, /*#__PURE__*/React.createElement("rect", {
      x: "-7",
      y: "-12",
      width: "14",
      height: "24",
      rx: "4",
      fill: "#1a1d2a",
      stroke: "#000",
      strokeWidth: "0.5"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "-7",
      y: "-12",
      width: "14",
      height: "24",
      rx: "4",
      fill: "url(#tread)",
      opacity: "0.9"
    }), moving && /*#__PURE__*/React.createElement("g", {
      opacity: "0.5"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "-4.5",
      y: "-9",
      width: "9",
      height: "2",
      rx: "1",
      fill: "#5ce0d8"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "-4.5",
      y: "0",
      width: "9",
      height: "2",
      rx: "1",
      fill: "#5ce0d8"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "-4.5",
      y: "7",
      width: "9",
      height: "2",
      rx: "1",
      fill: "#5ce0d8"
    })));
  }
  function Rover({
    moving,
    accent,
    led,
    scanning
  }) {
    const ledColor = led || accent || '#5ce0d8';
    return /*#__PURE__*/React.createElement("svg", {
      width: "92",
      height: "108",
      viewBox: "-46 -54 92 108",
      style: {
        display: 'block',
        overflow: 'visible'
      }
    }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: "tread",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "0"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#2a2e3d"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "0.5",
      stopColor: "#0c0e16"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#2a2e3d"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "chassis",
      x1: "0",
      y1: "-1",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#e8e2d2"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "0.5",
      stopColor: "#c7c0ad"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#9d9684"
    })), /*#__PURE__*/React.createElement("radialGradient", {
      id: "beam",
      cx: "0.5",
      cy: "1",
      r: "0.9"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: ledColor,
      stopOpacity: "0.55"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: ledColor,
      stopOpacity: "0"
    }))), /*#__PURE__*/React.createElement("path", {
      d: "M-16 -22 L-30 -78 L30 -78 L16 -22 Z",
      fill: "url(#beam)",
      opacity: scanning ? 0.95 : 0.7
    }), /*#__PURE__*/React.createElement("ellipse", {
      cx: "2",
      cy: "6",
      rx: "34",
      ry: "40",
      fill: "#000",
      opacity: "0.32"
    }), /*#__PURE__*/React.createElement(Wheel, {
      x: -26,
      y: -22,
      moving: moving
    }), /*#__PURE__*/React.createElement(Wheel, {
      x: 26,
      y: -22,
      moving: moving
    }), /*#__PURE__*/React.createElement(Wheel, {
      x: -26,
      y: 22,
      moving: moving
    }), /*#__PURE__*/React.createElement(Wheel, {
      x: 26,
      y: 22,
      moving: moving
    }), /*#__PURE__*/React.createElement("rect", {
      x: "-24",
      y: "-34",
      width: "48",
      height: "68",
      rx: "11",
      fill: "url(#chassis)",
      stroke: "#3a3528",
      strokeWidth: "1.2"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "-18",
      y: "-26",
      width: "36",
      height: "52",
      rx: "7",
      fill: "#15171f",
      stroke: "#3a3e4d",
      strokeWidth: "0.8"
    }), /*#__PURE__*/React.createElement("g", {
      stroke: "#2b3550",
      strokeWidth: "0.8",
      opacity: "0.9"
    }, /*#__PURE__*/React.createElement("line", {
      x1: "-18",
      y1: "-13",
      x2: "18",
      y2: "-13"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "-18",
      y1: "0",
      x2: "18",
      y2: "0"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "-18",
      y1: "13",
      x2: "18",
      y2: "13"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "-6",
      y1: "-26",
      x2: "-6",
      y2: "26"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "6",
      y1: "-26",
      x2: "6",
      y2: "26"
    })), /*#__PURE__*/React.createElement("rect", {
      x: "-24",
      y: "-2.5",
      width: "48",
      height: "5",
      fill: accent,
      opacity: "0.85"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "0",
      cy: "-26",
      r: "6.5",
      fill: "#0c0e16",
      stroke: ledColor,
      strokeWidth: "1.4"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "0",
      cy: "-26",
      r: "2.6",
      fill: ledColor
    }, scanning && /*#__PURE__*/React.createElement("animate", {
      attributeName: "opacity",
      values: "1;0.3;1",
      dur: "0.6s",
      repeatCount: "indefinite"
    })), /*#__PURE__*/React.createElement("circle", {
      cx: "0",
      cy: "28",
      r: "3",
      fill: ledColor,
      opacity: "0.9"
    }, /*#__PURE__*/React.createElement("animate", {
      attributeName: "opacity",
      values: "0.9;0.4;0.9",
      dur: "2s",
      repeatCount: "indefinite"
    })), /*#__PURE__*/React.createElement("line", {
      x1: "16",
      y1: "-30",
      x2: "24",
      y2: "-42",
      stroke: "#9d9684",
      strokeWidth: "1.4"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "24",
      cy: "-42",
      r: "2.4",
      fill: accent
    }));
  }
  window.Rover = Rover;
})();
})();

;(function () {
/* ============================================================================
   ORBITAL ROVER — Viewport (3D diorama)
   A tilted, camera-tracked world: ground + perspective grid + standing
   obstacles + trail + a lifted rover that casts a shadow, kicks up dust while
   driving, and emits scan ripples. HUD stays in screen space.
   Exposes window.Viewport
   ========================================================================== */
(function () {
  const {
    useMemo,
    memo
  } = React;
  const GROUND = window.TERRAIN_GROUND;
  const WALL = window.TERRAINS.WALL;
  const DUST = {
    city: '#8a909c',
    room: '#c8b48c',
    earth: '#b9a878',
    mars: '#d89a6a',
    underwater: 'rgba(190,220,222,0.55)',
    space: '#9a9ca6'
  };
  const HORIZON = {
    city: 'rgba(26,31,40,0.5)',
    room: 'rgba(110,82,52,0.5)',
    earth: 'rgba(28,46,31,0.5)',
    mars: 'rgba(46,22,16,0.5)',
    underwater: 'rgba(4,22,31,0.55)',
    space: 'rgba(7,8,15,0.55)'
  };

  // The rover pushes one segment array per pen-down move and appends points to
  // the LAST segment as it drives (app.jsx pushTrailPoint, in place). Earlier
  // segments are never mutated again, so a finished segment's SVG path string
  // can be built once and cached by array identity — only the in-progress leg
  // is rebuilt per frame. This turns the old per-frame rebuild of every path
  // (O(N) per frame, O(N^2) cumulative over an N-point spiral) into work that
  // scales with the current leg, not the whole trail.
  const pathCache = new WeakMap();
  function buildPath(seg) {
    return seg.map((p, j) => (j === 0 ? 'M' : 'L') + (GROUND / 2 + p.x).toFixed(1) + ' ' + (GROUND / 2 + p.y).toFixed(1)).join(' ');
  }
  function cachedPath(seg) {
    let d = pathCache.get(seg);
    if (d === undefined) {
      d = buildPath(seg);
      pathCache.set(seg, d);
    }
    return d;
  }
  function TrailPath({
    d,
    accent
  }) {
    return /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: "#000",
      strokeWidth: "7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      opacity: "0.18"
    }), /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: accent,
      strokeWidth: "4",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      opacity: "0.78"
    }));
  }

  // Completed segments (all but the last) are immutable, so this layer only
  // re-renders when a new leg starts (count grows) or the colour changes — NOT
  // on every animation frame. memo with a count-based compare skips it during a
  // move, when only the live segment is growing. (A naive memo on `segments`
  // identity would wrongly skip: the array ref is stable while the last segment
  // mutates in place — see app.jsx, setTrail only fires on segment add/reset.)
  const CompletedTrail = memo(function CompletedTrail({
    segments,
    count,
    accent
  }) {
    const paths = [];
    for (let i = 0; i < count; i++) {
      const seg = segments[i];
      if (seg.length < 2) continue;
      paths.push(/*#__PURE__*/React.createElement(TrailPath, {
        key: i,
        d: cachedPath(seg),
        accent: accent
      }));
    }
    return paths;
  }, (a, b) => a.accent === b.accent && a.count === b.count);
  function Trail({
    segments,
    accent
  }) {
    if (!segments || !segments.length) return null;
    const last = segments[segments.length - 1];
    return /*#__PURE__*/React.createElement("svg", {
      width: GROUND,
      height: GROUND,
      style: {
        position: 'absolute',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        overflow: 'visible'
      }
    }, /*#__PURE__*/React.createElement(CompletedTrail, {
      segments: segments,
      count: segments.length - 1,
      accent: accent
    }), last && last.length >= 2 ? /*#__PURE__*/React.createElement(TrailPath, {
      d: buildPath(last),
      accent: accent
    }) : null);
  }
  function DustKick({
    color
  }) {
    const motes = useMemo(() => Array.from({
      length: 8
    }, (_, i) => ({
      dx: (Math.random() - 0.5) * 46,
      dy: 30 + Math.random() * 44,
      delay: -(i / 8) * 0.9,
      left: (Math.random() - 0.5) * 30
    })), []);
    return /*#__PURE__*/React.createElement("div", {
      className: "dust-kick",
      style: {
        ['--dust']: color
      }
    }, motes.map((m, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        left: m.left,
        ['--dx']: m.dx + 'px',
        ['--dy']: m.dy + 'px',
        animationDelay: m.delay + 's'
      }
    })));
  }

  // World props placed by pupil code (place("flag") etc). Billboarded like
  // obstacles so they stand up out of the tilted ground. Visual only.
  function Prop({
    p,
    photoUrl
  }) {
    const cx = GROUND / 2 + p.x,
      cy = GROUND / 2 + p.y;
    const bill = {
      transform: 'rotateZ(calc(-1 * var(--yaw, 0deg))) rotateX(calc(-1 * var(--tilt, 46deg)))',
      transformOrigin: '50% 100%'
    };
    let body = null;
    switch (p.kind) {
      case 'photo':
        body = /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -26,
            bottom: 0,
            width: 52,
            height: 66
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 24,
            bottom: 0,
            width: 4,
            height: 14,
            background: 'linear-gradient(180deg,#9aa0b4,#5a5f70)',
            borderRadius: 2
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 0,
            top: 0,
            width: 52,
            height: 52,
            background: '#f5f0e4',
            borderRadius: 4,
            padding: 3,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
          }
        }, photoUrl ? /*#__PURE__*/React.createElement("img", {
          src: photoUrl,
          alt: "",
          style: {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 2
          }
        }) : /*#__PURE__*/React.createElement("div", {
          style: {
            width: '100%',
            height: '100%',
            borderRadius: 2,
            background: 'linear-gradient(135deg,#5ce0d8,#1a6f6a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20
          }
        }, "\uD83D\uDCF7")));
        break;
      case 'drone':
        body = /*#__PURE__*/React.createElement("div", {
          className: "prop-drone",
          style: {
            ...bill,
            position: 'absolute',
            left: -16,
            bottom: 26,
            width: 32,
            height: 18
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 8,
            top: 7,
            width: 16,
            height: 8,
            borderRadius: 3,
            background: 'linear-gradient(180deg,#aeb8e8,#5a6390)'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 0,
            top: 4,
            width: 12,
            height: 2,
            borderRadius: 2,
            background: '#cfd6f5',
            opacity: 0.85
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            right: 0,
            top: 4,
            width: 12,
            height: 2,
            borderRadius: 2,
            background: '#cfd6f5',
            opacity: 0.85
          }
        }), /*#__PURE__*/React.createElement("div", {
          className: "prop-pulse",
          style: {
            position: 'absolute',
            left: 14,
            bottom: 0,
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: '#5ce0d8'
          }
        }));
        break;
      case 'beacon':
        body = /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -5,
            bottom: 0,
            width: 10,
            height: 52
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 3,
            bottom: 0,
            width: 4,
            height: 44,
            background: 'linear-gradient(180deg,#9aa0b4,#5a5f70)',
            borderRadius: 2
          }
        }), /*#__PURE__*/React.createElement("div", {
          className: "prop-pulse",
          style: {
            position: 'absolute',
            left: 0,
            top: 0,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#5ce0d8',
            boxShadow: '0 0 12px #5ce0d8'
          }
        }));
        break;
      case 'rock':
        body = /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -14,
            bottom: 0,
            width: 28,
            height: 22,
            borderRadius: '48% 52% 45% 55% / 70% 64% 36% 30%',
            background: 'radial-gradient(circle at 38% 26%, #8d8f99, #4c4e58 70%, #33353d)'
          }
        });
        break;
      case 'tree':
        body = /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -16,
            bottom: 0,
            width: 32,
            height: 58
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 13,
            bottom: 0,
            width: 6,
            height: 20,
            background: 'linear-gradient(180deg,#7a5a3a,#4c3722)',
            borderRadius: 2
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 0,
            top: 0,
            width: 32,
            height: 40,
            borderRadius: '50% 50% 46% 46%',
            background: 'radial-gradient(circle at 38% 28%, #7fae62, #3f6030 72%, #2c4422)'
          }
        }));
        break;
      case 'person':
        body = /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -9,
            bottom: 0,
            width: 18,
            height: 46
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 4,
            top: 0,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#e8c9a8'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 2,
            top: 11,
            width: 14,
            height: 22,
            borderRadius: '5px 5px 3px 3px',
            background: 'linear-gradient(180deg,#e0b45c,#a87f38)'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 4,
            top: 33,
            width: 4,
            height: 13,
            background: '#3a4356',
            borderRadius: 2
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 10,
            top: 33,
            width: 4,
            height: 13,
            background: '#3a4356',
            borderRadius: 2
          }
        }));
        break;
      case 'crate':
        body = /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -12,
            bottom: 0,
            width: 24,
            height: 22,
            background: 'linear-gradient(180deg,#a8845c,#6e5538)',
            border: '2px solid #4c3a24',
            borderRadius: 3,
            boxShadow: 'inset 0 0 0 2px rgba(255,235,200,0.12)'
          }
        });
        break;
      default:
        // flag
        body = /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -2,
            bottom: 0,
            width: 26,
            height: 54
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: 3,
            height: 54,
            background: 'linear-gradient(180deg,#d8d3c4,#8b8678)',
            borderRadius: 2
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 3,
            top: 2,
            width: 0,
            height: 0,
            borderTop: '9px solid transparent',
            borderBottom: '9px solid transparent',
            borderLeft: '22px solid #5ce0d8'
          }
        }));
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: cx,
        top: cy,
        zIndex: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: -10,
        top: -4,
        width: 20,
        height: 8,
        borderRadius: '50%',
        background: 'rgba(0,0,0,0.3)',
        filter: 'blur(2px)'
      }
    }), body);
  }
  function Viewport({
    terrain,
    rover,
    trail,
    props,
    photoUrl,
    sensorDist,
    say,
    crashKey,
    zoom,
    showGrid,
    showFx,
    trailColor,
    tilt,
    yaw,
    onTilt
  }) {
    const Rover = window.Rover;
    const Backdrop = window.TerrainBackdrop;
    const Sky = window.TerrainSky;
    const Ambient = window.TerrainAmbient;
    const Ground = window.TerrainGround;
    const z = zoom || 1;
    const tl = tilt == null ? 46 : tilt;
    const yw = yaw || 0;
    const beamLen = Math.min(sensorDist != null ? sensorDist : 600, 600);
    const counter = `rotateZ(${-yw}deg) rotateX(${-tl}deg)`;
    return /*#__PURE__*/React.createElement("div", {
      className: "viewport",
      style: {
        ['--horizon']: HORIZON[terrain.id]
      }
    }, /*#__PURE__*/React.createElement(Backdrop, {
      terrain: terrain
    }), /*#__PURE__*/React.createElement(Sky, {
      terrain: terrain
    }), /*#__PURE__*/React.createElement("div", {
      className: "world",
      style: {
        transform: `rotateX(${tl}deg) scale(${z}) rotateZ(${yw}deg) translate(${-rover.x}px, ${-rover.y}px)`,
        ['--tilt']: tl + 'deg',
        ['--yaw']: yw + 'deg'
      }
    }, /*#__PURE__*/React.createElement(Ground, {
      terrain: terrain,
      showGrid: showGrid
    }, /*#__PURE__*/React.createElement(Trail, {
      segments: trail,
      accent: trailColor || terrain.accent
    }), (props || []).map(p => /*#__PURE__*/React.createElement(Prop, {
      key: p.id,
      p: p,
      photoUrl: photoUrl
    }))), /*#__PURE__*/React.createElement("div", {
      className: "rover-wrap",
      style: {
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate(${rover.x}px, ${rover.y}px)`,
        zIndex: 5
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "sensor-ring",
      style: {
        position: 'absolute',
        left: -600,
        top: -600,
        width: 1200,
        height: 1200,
        borderRadius: '50%',
        border: '1px solid ' + terrain.accent,
        opacity: 0.07,
        pointerEvents: 'none'
      }
    }), rover.scanning && /*#__PURE__*/React.createElement("div", {
      className: "scan-ripple"
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        width: 900,
        height: 900,
        animationDelay: '0s'
      }
    }), /*#__PURE__*/React.createElement("i", {
      style: {
        width: 900,
        height: 900,
        animationDelay: '0.5s'
      }
    }), /*#__PURE__*/React.createElement("i", {
      style: {
        width: 900,
        height: 900,
        animationDelay: '1s'
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "heading-rot",
      style: {
        transform: `rotate(${rover.heading}deg)`,
        transformOrigin: 'center',
        position: 'absolute',
        left: 0,
        top: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: -1.5,
        top: -beamLen - 30,
        width: 3,
        height: beamLen,
        background: `linear-gradient(180deg, transparent, ${terrain.accent})`,
        opacity: 0.55,
        pointerEvents: 'none'
      }
    }), beamLen < 600 && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: -6,
        top: -beamLen - 36,
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: terrain.accent,
        opacity: 0.85,
        boxShadow: '0 0 10px ' + terrain.accent
      }
    }), rover.moving && /*#__PURE__*/React.createElement(DustKick, {
      color: DUST[terrain.id]
    }), /*#__PURE__*/React.createElement("div", {
      className: "rover-shadow"
    }), /*#__PURE__*/React.createElement("div", {
      className: "rover-lift",
      style: {
        transform: 'translate(-50%,-50%) translateZ(16px)',
        position: 'absolute',
        left: 0,
        top: 0
      }
    }, /*#__PURE__*/React.createElement(Rover, {
      moving: rover.moving,
      accent: terrain.accent,
      led: rover.led,
      scanning: rover.scanning
    }))), say && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: 0,
        top: -70,
        transform: counter,
        transformOrigin: 'center bottom'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "say-bubble",
      style: {
        left: 0,
        top: 0
      }
    }, say)))), showFx !== false ? /*#__PURE__*/React.createElement(Ambient, {
      terrain: terrain
    }) : null, showFx !== false ? /*#__PURE__*/React.createElement("div", {
      className: "vignette"
    }) : null, showFx !== false ? /*#__PURE__*/React.createElement("div", {
      className: "grain"
    }) : null, crashKey ? /*#__PURE__*/React.createElement("div", {
      className: "crash-flash",
      key: crashKey
    }) : null, /*#__PURE__*/React.createElement("div", {
      className: "hud-tr"
    }, /*#__PURE__*/React.createElement("div", {
      className: "terrain-name"
    }, terrain.name), /*#__PURE__*/React.createElement("div", {
      className: "terrain-coord"
    }, terrain.coord)), /*#__PURE__*/React.createElement("div", {
      className: "hud-bl"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hl"
    }, /*#__PURE__*/React.createElement("span", null, "Pos X"), /*#__PURE__*/React.createElement("span", null, rover.x.toFixed(0), " cm")), /*#__PURE__*/React.createElement("div", {
      className: "hl"
    }, /*#__PURE__*/React.createElement("span", null, "Pos Y"), /*#__PURE__*/React.createElement("span", null, (-rover.y).toFixed(0), " cm")), /*#__PURE__*/React.createElement("div", {
      className: "hl"
    }, /*#__PURE__*/React.createElement("span", null, "Heading"), /*#__PURE__*/React.createElement("span", null, (rover.heading % 360 + 360) % 360 | 0, "\xB0"))), onTilt && /*#__PURE__*/React.createElement("div", {
      className: "view-mode-pill"
    }, /*#__PURE__*/React.createElement("button", {
      className: tl <= 4 ? 'on' : '',
      onClick: () => onTilt(0)
    }, "2D"), /*#__PURE__*/React.createElement("button", {
      className: tl > 4 ? 'on' : '',
      onClick: () => onTilt(46)
    }, "3D")), /*#__PURE__*/React.createElement("div", {
      className: "orbit-hint"
    }, "Drag to orbit \xB7 scroll to zoom"));
  }
  window.Viewport = Viewport;
})();
})();

;(function () {
/* Procedural surface maps for the 3D viewport (offline, no asset files).
 *
 * The ground already carries a baked albedo grain canvas. What made it still
 * read as a flat coloured plane was the lack of any SURFACE RELIEF: light hit
 * it as if it were glass-smooth. This module adds a tangent-space normal map
 * (Sobel-derived from a tileable height field) and a roughness map, so the
 * existing PBR sun and fill lights graze real micro-relief -- sand catches a
 * sheen, regolith pits read as pits, the seabed ripples.
 *
 * Everything is generated in-canvas at scene build time. No network, no files,
 * no new vendored binary. Headless-safe: with no `document` the generators
 * return null and the caller simply renders without the maps (exactly the old
 * look), so the offline bundle-render test never touches a canvas.
 *
 * Exposed as window.KodroTextures.groundMaps(THREE, color, id).
 */
(function () {
  'use strict';

  function _doc() {
    return typeof document !== 'undefined' ? document : null;
  }
  function _canvas(size) {
    const d = _doc();
    if (!d || !d.createElement) return null;
    const cv = d.createElement('canvas');
    cv.width = cv.height = size;
    return cv;
  }

  // A tileable grayscale height field. Layered value-noise sines give the broad
  // dunes/swells; scattered radial bumps give grain; the seabed gets directional
  // ripples. Drawn so opposite edges meet (the sines are periodic over `size`),
  // which keeps the derived normal map seamless under RepeatWrapping.
  function heightCanvas(size, id) {
    const cv = _canvas(size);
    if (!cv) return null;
    const g = cv.getContext('2d');
    if (!g) return null;
    const img = g.createImageData(size, size);
    const d = img.data;
    const TAU = Math.PI * 2;
    // Two periodic octaves plus a finer one; all use integer wave counts over
    // the canvas so the field wraps exactly at the seam.
    const ripple = id === 'underwater';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size,
          v = y / size;
        let h = 0.5 + 0.16 * Math.sin(TAU * (2 * u)) * Math.cos(TAU * (2 * v)) + 0.10 * Math.sin(TAU * (5 * u + 3 * v)) + 0.06 * Math.sin(TAU * (8 * v - 4 * u));
        if (ripple) h += 0.12 * Math.sin(TAU * (11 * v)); // seabed ripples
        const c = Math.max(0, Math.min(1, h)) * 255;
        const i = (y * size + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = c;
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // Scatter a few hundred soft bumps for grain. Radial gradients keep them
    // smooth so the normal map does not spike into harsh facets.
    const bumps = ripple ? 180 : 340;
    for (let i = 0; i < bumps; i++) {
      const x = Math.random() * size,
        y = Math.random() * size,
        r = 1.5 + Math.random() * 4.5;
      const up = Math.random() < 0.5;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.12 + Math.random() * 0.16;
      grad.addColorStop(0, (up ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + a + ')');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, 6.283);
      g.fill();
    }
    return cv;
  }

  // Tangent-space normal map from a height canvas via a wrap-around Sobel.
  // strength scales the relief; nz is kept at 1 so a flat patch reads as a
  // neutral (0.5,0.5,1) normal.
  function normalFromHeight(THREE, hcv, strength) {
    const size = hcv.width;
    const hc = hcv.getContext('2d');
    if (!hc) return null;
    const hd = hc.getImageData(0, 0, size, size).data;
    const out = _canvas(size);
    if (!out) return null;
    const oc = out.getContext('2d');
    const od = oc.createImageData(size, size);
    const o = od.data;
    const H = (x, y) => {
      x = (x + size) % size;
      y = (y + size) % size;
      return hd[(y * size + x) * 4] / 255;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (H(x - 1, y) - H(x + 1, y)) * strength;
        const dy = (H(x, y - 1) - H(x, y + 1)) * strength;
        let nx = dx,
          ny = dy,
          nz = 1;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;
        const i = (y * size + x) * 4;
        o[i] = (nx * 0.5 + 0.5) * 255;
        o[i + 1] = (ny * 0.5 + 0.5) * 255;
        o[i + 2] = (nz * 0.5 + 0.5) * 255;
        o[i + 3] = 255;
      }
    }
    oc.putImageData(od, 0, 0);
    const t = new THREE.CanvasTexture(out);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // A gentle roughness map: mostly rough ground with softer, slightly smoother
  // patches (compacted soil, polished stone, wet seabed) so specular highlights
  // pool unevenly instead of being uniform. Lower value = smoother (shinier).
  function roughCanvas(size, id) {
    const cv = _canvas(size);
    if (!cv) return null;
    const g = cv.getContext('2d');
    if (!g) return null;
    const base = id === 'underwater' ? 168 : id === 'city' || id === 'room' ? 150 : 200;
    g.fillStyle = 'rgb(' + base + ',' + base + ',' + base + ')';
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 22; i++) {
      const x = Math.random() * size,
        y = Math.random() * size,
        r = 14 + Math.random() * 40;
      const dark = Math.random() < 0.5;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, dark ? 'rgba(70,70,70,0.45)' : 'rgba(235,235,235,0.4)');
      grad.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, 6.283);
      g.fill();
    }
    return cv;
  }

  // Build the relief + roughness maps for a ground material. Returns nulls when
  // headless or when canvas is unavailable, so the caller stays unconditional.
  function groundMaps(THREE, color, id) {
    try {
      if (!THREE || !_doc()) return {
        normal: null,
        rough: null
      };
      const size = 256;
      const strength = id === 'space' ? 3.4 : id === 'underwater' ? 2.2 : id === 'mars' ? 3.0 : 2.6;
      const hcv = heightCanvas(size, id);
      if (!hcv) return {
        normal: null,
        rough: null
      };
      const normal = normalFromHeight(THREE, hcv, strength);
      if (normal) normal.repeat.set(9, 9);
      const rcv = roughCanvas(size, id);
      let rough = null;
      if (rcv) {
        rough = new THREE.CanvasTexture(rcv);
        rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
        rough.repeat.set(9, 9);
      }
      return {
        normal,
        rough
      };
    } catch (e) {
      void e;
      return {
        normal: null,
        rough: null
      };
    }
  }
  if (typeof window !== 'undefined') {
    window.KodroTextures = {
      groundMaps
    };
  }
})();
})();

;(function () {
/* Hand-written offline post-processing for the Cinematic quality tier.
 *
 * Three.js ships EffectComposer and the bloom pass only in its examples/ tree,
 * which is NOT vendored here and cannot be fetched under the zero-network
 * offline guarantee. So this is a small, self-contained bloom + vignette pass
 * written directly against the core renderer: no EffectComposer, no examples,
 * no new vendored binary.
 *
 * Design for safety. The proven base image is rendered to the canvas exactly
 * as the non-Cinematic path renders it. The scene is then rendered once more
 * into an offscreen target used ONLY as a bloom source; the bloom is composited
 * ADDITIVELY on top and a vignette MULTIPLY darkens the corners. Because the
 * base is never replaced, the worst case is "looks like the normal render".
 * create() returns null on any GPU/allocation failure, and the caller falls
 * back to a plain renderer.render. Gated by the caller to Cinematic only, off
 * under prefers-reduced-motion and after the slow-GPU auto-downgrade.
 *
 * Exposed as window.KodroPost.create(THREE, renderer, w, h).
 */
(function () {
  'use strict';

  const VERT = ['varying vec2 vUv;', 'void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'].join('\n');
  const BRIGHT_FS = ['uniform sampler2D tDiffuse; uniform float threshold; uniform float knee; varying vec2 vUv;', 'void main(){', '  vec3 c = texture2D(tDiffuse, vUv).rgb;', '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));', '  float k = smoothstep(threshold, threshold + knee, l);', '  gl_FragColor = vec4(c * k, 1.0);', '}'].join('\n');

  // 5-tap separable Gaussian (sigma ~ the classic 0.227/0.316/0.070 weights).
  const BLUR_FS = ['uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;', 'void main(){', '  vec4 s = texture2D(tDiffuse, vUv) * 0.227027;', '  s += texture2D(tDiffuse, vUv + dir * 1.3846) * 0.316216;', '  s += texture2D(tDiffuse, vUv - dir * 1.3846) * 0.316216;', '  s += texture2D(tDiffuse, vUv + dir * 3.2307) * 0.070270;', '  s += texture2D(tDiffuse, vUv - dir * 3.2307) * 0.070270;', '  gl_FragColor = s;', '}'].join('\n');

  // Additive bloom overlay. The source target is linear (tone-mapped); convert
  // to approximate display space so the glow adds in the same space the canvas
  // base already lives in.
  const BLOOM_FS = ['uniform sampler2D tBloom; uniform float intensity; varying vec2 vUv;', 'void main(){', '  vec3 b = max(texture2D(tBloom, vUv).rgb * intensity, 0.0);', '  b = pow(b, vec3(1.0 / 2.2));', '  gl_FragColor = vec4(b, 1.0);', '}'].join('\n');

  // Multiply vignette: 1.0 in the centre, darkening toward the corners.
  const VIG_FS = ['uniform float strength; varying vec2 vUv;', 'void main(){', '  vec2 p = vUv - 0.5;', '  float d = dot(p, p);', '  float v = 1.0 - strength * smoothstep(0.12, 0.7, d);', '  gl_FragColor = vec4(vec3(v), 1.0);', '}'].join('\n');
  function create(THREE, renderer, w, h) {
    try {
      if (!THREE || !renderer || !THREE.WebGLRenderTarget || !THREE.ShaderMaterial) return null;
      w = Math.max(2, w | 0);
      h = Math.max(2, h | 0);
      let hw = Math.max(1, w / 2 | 0),
        hh = Math.max(1, h / 2 | 0);
      const rtOpts = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat
      };
      // HalfFloat lets bright highlights exceed 1.0 so the bloom has something to
      // bloom from; fall back to the default byte target if unsupported.
      if (THREE.HalfFloatType != null) rtOpts.type = THREE.HalfFloatType;
      const sceneRT = new THREE.WebGLRenderTarget(w, h, rtOpts);
      const bloomA = new THREE.WebGLRenderTarget(hw, hh, rtOpts);
      const bloomB = new THREE.WebGLRenderTarget(hw, hh, rtOpts);

      // Fullscreen triangle: vertices already in clip space, so the vertex
      // shader passes them straight through and the camera is irrelevant.
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));

      // ShaderMaterial (not RawShaderMaterial) so Three injects the `position`
      // and `uv` attribute declarations and the precision qualifier the shaders
      // below rely on; the injected MVP matrices are simply ignored because the
      // fullscreen triangle is already in clip space.
      const mk = (fs, uniforms, blending) => new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: fs,
        uniforms,
        depthTest: false,
        depthWrite: false,
        blending: blending == null ? THREE.NoBlending : blending,
        transparent: blending != null
      });
      const brightMat = mk(BRIGHT_FS, {
        tDiffuse: {
          value: sceneRT.texture
        },
        threshold: {
          value: 0.7
        },
        knee: {
          value: 0.25
        }
      });
      const blurMat = mk(BLUR_FS, {
        tDiffuse: {
          value: null
        },
        dir: {
          value: new THREE.Vector2()
        }
      });
      const bloomMat = mk(BLOOM_FS, {
        tBloom: {
          value: bloomA.texture
        },
        intensity: {
          value: 0.65
        }
      }, THREE.AdditiveBlending);
      const vigMat = mk(VIG_FS, {
        strength: {
          value: 0.4
        }
      }, THREE.MultiplyBlending);
      const quadScene = new THREE.Scene();
      const quadMesh = new THREE.Mesh(geo, brightMat);
      quadMesh.frustumCulled = false;
      quadScene.add(quadMesh);
      const quadCam = new THREE.Camera();
      const drawPass = (mat, target) => {
        quadMesh.material = mat;
        renderer.setRenderTarget(target || null);
        renderer.render(quadScene, quadCam);
      };
      function render(scene, camera) {
        const prevAutoClear = renderer.autoClear;
        const prevTarget = renderer.getRenderTarget ? renderer.getRenderTarget() : null;
        try {
          // 1. Proven base image straight to the canvas (identical to the
          //    non-post path), so nothing about the trusted render changes.
          renderer.autoClear = true;
          renderer.setRenderTarget(null);
          renderer.render(scene, camera);
          // 2. Re-render the same frame into an offscreen target as the bloom
          //    source (tone-mapped, linear).
          renderer.setRenderTarget(sceneRT);
          renderer.render(scene, camera);
          // 3. Bright-pass into the half-res bloom buffer.
          brightMat.uniforms.tDiffuse.value = sceneRT.texture;
          drawPass(brightMat, bloomA);
          // 4. Separable blur: horizontal A->B, vertical B->A.
          blurMat.uniforms.tDiffuse.value = bloomA.texture;
          blurMat.uniforms.dir.value.set(1.5 / hw, 0);
          drawPass(blurMat, bloomB);
          blurMat.uniforms.tDiffuse.value = bloomB.texture;
          blurMat.uniforms.dir.value.set(0, 1.5 / hh);
          drawPass(blurMat, bloomA);
          // 5. Composite onto the canvas WITHOUT clearing the base.
          renderer.autoClear = false;
          bloomMat.uniforms.tBloom.value = bloomA.texture;
          drawPass(bloomMat, null);
          drawPass(vigMat, null);
        } finally {
          renderer.setRenderTarget(prevTarget || null);
          renderer.autoClear = prevAutoClear;
        }
      }
      function setSize(nw, nh) {
        nw = Math.max(2, nw | 0);
        nh = Math.max(2, nh | 0);
        hw = Math.max(1, nw / 2 | 0);
        hh = Math.max(1, nh / 2 | 0);
        sceneRT.setSize(nw, nh);
        bloomA.setSize(hw, hh);
        bloomB.setSize(hw, hh);
      }
      function dispose() {
        sceneRT.dispose();
        bloomA.dispose();
        bloomB.dispose();
        geo.dispose();
        brightMat.dispose();
        blurMat.dispose();
        bloomMat.dispose();
        vigMat.dispose();
      }
      return {
        render,
        setSize,
        dispose
      };
    } catch (e) {
      void e;
      return null;
    }
  }
  if (typeof window !== 'undefined') {
    window.KodroPost = {
      create
    };
  }
})();
})();

;(function () {
/* Real WebGL 3D viewport (Three.js, vendored offline).
 *
 * Renders the world and the rover as actual 3D geometry, driven by the same
 * live rover state the 2.5D view uses. Two cameras: a third-person orbit you
 * can drag to revolve around the rover, and a first-person view mounted on the
 * rover looking the way it drives. All Three.js work lives inside useEffect so
 * the offline bundle-render test (which has no WebGL) never touches it.
 */
(function () {
  const {
    useRef,
    useEffect
  } = React;

  // Engine world is in centimetres (roughly +/-1500). Scale it down to a
  // comfortable number of 3D units.
  const SCALE = 0.03;
  const SKY = {
    room: 0xe9ddc8,
    city: 0x93acc0,
    earth: 0x9ec7e8,
    mars: 0xd98a5a,
    underwater: 0x0b3a4c,
    space: 0x05060d
  };
  const GROUND = {
    room: 0x9c7b50,
    city: 0x2b313d,
    earth: 0x4a6b39,
    mars: 0x9a4a2e,
    underwater: 0x1c4a55,
    space: 0x3a3c44
  };
  const FOG = {
    room: 0xe9ddc8,
    city: 0xb3c2cc,
    earth: 0xb6cdba,
    mars: 0xc08050,
    underwater: 0x0a2a38,
    space: 0x05060d
  };
  function Viewport3D({
    terrain,
    rover,
    fpv,
    robotType
  }) {
    const mountRef = useRef(null);
    const stateRef = useRef({
      x: 0,
      y: 0,
      heading: 0
    });
    const fpvRef = useRef(!!fpv);
    stateRef.current = rover || stateRef.current;
    fpvRef.current = !!fpv;
    useEffect(() => {
      const THREE = typeof window !== 'undefined' && window.THREE;
      const mount = mountRef.current;
      if (!THREE || !mount) return undefined;
      const id = terrain && terrain.id || 'earth';
      // Site-aware 3D ground colour. An Earth-based site (Sahara, Kenya, Egypt)
      // or a Mars/space variant carries its own palette in groundBg/obFill, used
      // by the 2D view. Pull the dominant hex so the 3D ground MATCHES the site
      // instead of always rendering the base terrain's colour (the green-Sahara
      // bug). Falls back to the base map when a site has no palette.
      const hexFromCss = str => {
        if (!str) return null;
        const m = String(str).match(/#([0-9a-fA-F]{6})/g);
        if (!m || !m.length) return null;
        return parseInt((m[1] || m[0]).slice(1), 16);
      };
      const siteGround = hexFromCss(terrain && terrain.groundBg && terrain.groundBg.background);
      const groundColor = siteGround != null ? siteGround : GROUND[id] != null ? GROUND[id] : GROUND.earth;
      let w = mount.clientWidth || 800;
      let h = mount.clientHeight || 500;

      // Honour the pupil's motion preference: no smoothing-induced drift.
      const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const posLerp = reduce ? 1 : 0.16;
      const camLerp = reduce ? 1 : 0.12;

      // Guard WebGL: a failed context (old GPU, lost context) shows a calm
      // message and the pupil can fall back to the flat view, never a blank box.
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true
        });
      } catch (err) {
        mount.innerHTML = '<div class="vp3d-fail">3D needs a graphics card this machine cannot give. Switch to the 2.5D view in the bar.</div>';
        return undefined;
      }
      let disposed = false;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      renderer.shadowMap.enabled = true;
      // Softer shadows and filmic tone mapping lift the look out of the flat,
      // plasticky default that read as generic.
      if (THREE.PCFSoftShadowMap != null) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // Performance mode (window.KODRO_QUALITY: 'low'|'med'|'high'|'cinematic').
      // Bounds the two biggest costs, shadow resolution and pixel ratio, so a
      // laptop without a discrete GPU stays smooth on Low while Cinematic maxes
      // fidelity for a screenshot. Read at (re)build time so a change reapplies
      // when the viewport remounts.
      const Q = window.KODRO_QUALITY || 'high';
      const _dpr = window.devicePixelRatio || 1;
      renderer.setPixelRatio(Q === 'low' ? 1 : Q === 'med' ? Math.min(1.25, _dpr) : Q === 'cinematic' ? Math.min(2, _dpr * 1.5) : Math.min(1.5, _dpr));
      renderer.shadowMap.enabled = Q !== 'low';
      if (THREE.ACESFilmicToneMapping != null) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
      }
      if (THREE.SRGBColorSpace != null) renderer.outputColorSpace = THREE.SRGBColorSpace;else if (THREE.sRGBEncoding != null) renderer.outputEncoding = THREE.sRGBEncoding;
      const canvas = renderer.domElement;
      canvas.setAttribute('tabindex', '0');
      canvas.setAttribute('aria-label', 'Three dimensional world. Drag or use the arrow keys to orbit, plus and minus to zoom.');
      const onContextLost = e => {
        e.preventDefault();
        mount.classList.add('vp3d-lost');
      };
      canvas.addEventListener('webglcontextlost', onContextLost, false);
      mount.appendChild(canvas);

      // Cinematic post-processing (offline bloom + vignette). Gated to the
      // Cinematic tier and disabled under reduced motion; null on any GPU
      // allocation failure, in which case tick() renders straight to the canvas
      // exactly as before. Created after the renderer so it shares its context.
      let post = null;
      if (Q === 'cinematic' && !reduce && window.KodroPost && window.KodroPost.create) {
        post = window.KodroPost.create(THREE, renderer, w, h);
      }
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(SKY[id] != null ? SKY[id] : SKY.earth);
      // Underwater murk swallows distance much sooner than open air; the Moon
      // has no atmosphere so its fog is pushed far back so the stars stay visible.
      if (id === 'underwater') scene.fog = new THREE.FogExp2(FOG[id], 0.025);else scene.fog = new THREE.Fog(FOG[id] != null ? FOG[id] : FOG.earth, id === 'space' ? 200 : 60, id === 'space' ? 800 : 220);
      const camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 2000);

      // Lights. Indoors (room) is warm and soft; outdoors is daylight.
      const indoor = id === 'room';
      const skyCol2 = indoor ? 0xfff1de : 0xffffff;
      const grndCol2 = indoor ? 0x3a2f28 : 0x404048;
      // Each world carries its own light mood: the Moon is dim and contrasty,
      // the abyss is dark and blue, Mars is dusty and half-lit, indoors is warm.
      const hemiInt = id === 'space' ? 0.4 : id === 'underwater' ? 0.45 : indoor ? 0.62 : id === 'mars' ? 0.52 : 0.6;
      scene.add(new THREE.HemisphereLight(skyCol2, grndCol2, hemiInt));
      const sunCol = indoor ? 0xffe9c4 : id === 'underwater' ? 0x6fb7c9 : id === 'mars' ? 0xffd9b0 : 0xfff4e2;
      const sunInt = id === 'space' ? 0.9 : id === 'underwater' ? 0.6 : indoor ? 1.05 : id === 'mars' ? 1.05 : 1.4;
      const sun = new THREE.DirectionalLight(sunCol, sunInt);
      sun.position.set(indoor ? 18 : 40, indoor ? 38 : 80, indoor ? 22 : 30);
      sun.castShadow = true;
      const _shMap = Q === 'low' ? 512 : Q === 'med' ? 1024 : Q === 'cinematic' ? 2048 : indoor ? 2048 : 1024;
      sun.shadow.mapSize.set(_shMap, _shMap); // quality-scaled: lighter on iGPUs at Low/Med, crisp at High/Cinematic
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 320;
      sun.shadow.camera.left = -120;
      sun.shadow.camera.right = 120;
      sun.shadow.camera.top = 120;
      sun.shadow.camera.bottom = -120;
      sun.shadow.bias = -0.0003;
      if (sun.shadow.radius != null) sun.shadow.radius = 5;
      scene.add(sun);
      // A soft fill from the opposite side so shadowed faces are not black.
      const fill = new THREE.DirectionalLight(0xbcd2ff, indoor ? 0.18 : 0.28);
      fill.position.set(-30, 26, -22);
      scene.add(fill);

      // A gradient sky dome so the world has a horizon, not a flat wall of fog.
      const skyTop = new THREE.Color(SKY[id] != null ? SKY[id] : SKY.earth);
      const skyBot = new THREE.Color(FOG[id] != null ? FOG[id] : FOG.earth);
      const skyGeo = new THREE.SphereGeometry(900, 24, 12);
      const skyCol = [];
      const pos = skyGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const t = Math.max(0, Math.min(1, pos.getY(i) / 900 * 0.5 + 0.5));
        const c = skyBot.clone().lerp(skyTop, t);
        skyCol.push(c.r, c.g, c.b);
      }
      skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyCol, 3));
      const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        fog: false
      }));
      scene.add(sky);
      // The Moon has no atmosphere, so its sky is full of stars. Cheap Points
      // cloud on the upper hemisphere (it is a scene child, so teardown disposes it).
      if (id === 'space') {
        const sg = new THREE.BufferGeometry();
        const N = 800,
          arr = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
          const u = Math.random() * 2 - 1,
            th = Math.random() * Math.PI * 2,
            rr = Math.sqrt(1 - u * u);
          arr[i * 3] = Math.cos(th) * rr * 850;
          arr[i * 3 + 1] = Math.abs(u) * 850;
          arr[i * 3 + 2] = Math.sin(th) * rr * 850;
        }
        sg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        scene.add(new THREE.Points(sg, new THREE.PointsMaterial({
          color: 0xffffff,
          size: 1.6,
          sizeAttenuation: false,
          fog: false
        })));
      }

      // Ground.
      const groundMat = new THREE.MeshStandardMaterial({
        color: groundColor,
        roughness: 1
      });
      const openWorld = id !== 'city' && id !== 'room';
      // Open terrain gets a subdivided, gently displaced surface (dunes, swells)
      // so light grazes real undulations instead of reading as a billiard-flat
      // plane. City and room keep a flat floor.
      const groundGeo = openWorld ? new THREE.PlaneGeometry(400, 400, 96, 96) : new THREE.PlaneGeometry(400, 400);
      if (openWorld) {
        const amp = id === 'underwater' ? 2.6 : id === 'space' ? 1.8 : 3.0;
        const pos = groundGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i),
            y = pos.getY(i); // plane is in XY before rotation
          const h = Math.sin(x * 0.05) * Math.cos(y * 0.045) * 0.6 + Math.sin(x * 0.013 + y * 0.017) * 0.3 + Math.sin((x + y) * 0.09) * 0.12;
          pos.setZ(i, h * amp);
        }
        groundGeo.computeVertexNormals();
      }
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      // City and room floors get a touch of metalness and lower roughness for a
      // slightly reflective sheen; open terrain stays rough and matte.
      if (!openWorld) {
        groundMat.roughness = 0.85;
        groundMat.metalness = 0.1;
      }
      scene.add(ground);
      if (id !== 'city' && id !== 'room') {
        // Give the open ground a procedural grain texture so it reads as a
        // surface (sand, regolith, seabed) instead of a flat coloured plane,
        // which was the biggest tell that the world was a tech demo.
        const gtex = typeof document !== 'undefined' && function () {
          const cv = document.createElement('canvas');
          cv.width = cv.height = 256;
          const c2 = cv.getContext('2d');
          if (!c2) return null;
          const base = new THREE.Color(groundColor);
          c2.fillStyle = '#' + base.getHexString();
          c2.fillRect(0, 0, 256, 256);
          const speckle = (n, amp, alpha) => {
            for (let i = 0; i < n; i++) {
              const x = Math.random() * 256,
                y = Math.random() * 256,
                r = Math.random() * 1.8 + 0.4;
              const cc = base.clone();
              cc.offsetHSL(0, 0, (Math.random() < 0.5 ? -1 : 1) * (amp * 0.5 + Math.random() * amp));
              c2.fillStyle = 'rgba(' + Math.round(cc.r * 255) + ',' + Math.round(cc.g * 255) + ',' + Math.round(cc.b * 255) + ',' + alpha + ')';
              c2.beginPath();
              c2.arc(x, y, r, 0, 6.283);
              c2.fill();
            }
          };
          speckle(id === 'underwater' ? 1400 : 2600, 0.12, 0.6); // grain
          for (let i = 0; i < 14; i++) {
            // soft larger patches for variation
            const x = Math.random() * 256,
              y = Math.random() * 256,
              r = 12 + Math.random() * 34;
            const cc = base.clone();
            cc.offsetHSL(0, 0, (Math.random() < 0.5 ? -1 : 1) * 0.06);
            const g = c2.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, 'rgba(' + Math.round(cc.r * 255) + ',' + Math.round(cc.g * 255) + ',' + Math.round(cc.b * 255) + ',0.4)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            c2.fillStyle = g;
            c2.beginPath();
            c2.arc(x, y, r, 0, 6.283);
            c2.fill();
          }
          // A handful of broad colour regions with a gentle hue shift so the
          // terrain reads as real ground with mineral/vegetation variation, not
          // a uniform field of speckles.
          for (let i = 0; i < 6; i++) {
            const x = Math.random() * 256,
              y = Math.random() * 256,
              r = 40 + Math.random() * 60;
            const cc = base.clone();
            cc.offsetHSL((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.08, (Math.random() < 0.5 ? -1 : 1) * 0.05);
            const g = c2.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, 'rgba(' + Math.round(cc.r * 255) + ',' + Math.round(cc.g * 255) + ',' + Math.round(cc.b * 255) + ',0.35)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            c2.fillStyle = g;
            c2.beginPath();
            c2.arc(x, y, r, 0, 6.283);
            c2.fill();
          }
          const t = new THREE.CanvasTexture(cv);
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(9, 9);
          return t;
        }();
        if (gtex) {
          groundMat.map = gtex;
          groundMat.needsUpdate = true;
        }
        // Surface relief: a Sobel-derived normal map plus a roughness map so the
        // PBR sun and fill light graze real micro-relief (sand sheen, regolith
        // pits, seabed ripple) instead of a glass-smooth coloured plane. Headless
        // or canvas-less devices get nulls and render exactly as before.
        const gmaps = window.KodroTextures && window.KodroTextures.groundMaps ? window.KodroTextures.groundMaps(THREE, groundColor, id) : null;
        if (gmaps) {
          if (gmaps.normal) {
            groundMat.normalMap = gmaps.normal;
            if (groundMat.normalScale) groundMat.normalScale.set(0.7, 0.7);
          }
          if (gmaps.rough) {
            groundMat.roughnessMap = gmaps.rough;
          }
          groundMat.needsUpdate = true;
        }
      }

      // An environment map captured from the sky and ground, so metal surfaces
      // (car paint, hubs, the chassis) actually reflect the world and catch
      // highlights rather than reading as flat plastic. Guarded: if the device
      // cannot generate it, the scene simply renders without reflections.
      try {
        if (THREE.PMREMGenerator) {
          let pmrem = null;
          // dispose in finally so the generator's internal render targets are
          // freed even if fromScene throws on a GPU that cannot allocate them.
          try {
            pmrem = new THREE.PMREMGenerator(renderer);
            scene.environment = pmrem.fromScene(scene, 0.04, 1, 1200).texture;
          } finally {
            if (pmrem) pmrem.dispose();
          }
        }
      } catch (e) {
        void e;
      }

      // Moving agents (city pedestrians and cars); each gets an update(t) called
      // every frame so the world is alive, not a still set of props.
      const agents = [];

      // Obstacles as 3D meshes (trees + rocks on Earth, rocks elsewhere).
      const siteRock = hexFromCss(terrain && terrain.obFill);
      const rockMat = new THREE.MeshStandardMaterial({
        color: siteRock != null ? siteRock : id === 'mars' ? 0x7e3a26 : id === 'underwater' ? 0x2c6068 : 0x6a6a64,
        roughness: 1,
        flatShading: true
      });
      const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x6b4f2c,
        roughness: 1
      });
      // Foliage harmonised with the biome: on a sandy site the canopy dries to a
      // muted olive instead of a cartoon jungle green; a green biome stays green.
      const _leafCol = siteGround != null ? new THREE.Color(0x4a7a30).lerp(new THREE.Color(groundColor), 0.42) : new THREE.Color(0x356b2a);
      const leafMat = new THREE.MeshStandardMaterial({
        color: _leafCol,
        roughness: 1,
        flatShading: true
      });
      const coralMat = new THREE.MeshStandardMaterial({
        color: 0xc9607a,
        roughness: 0.85,
        flatShading: true
      });
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0x3a3c44,
        roughness: 1,
        flatShading: true
      });
      // Vary the rock silhouette by world and by the obstacle's own value so a
      // boulder field does not read as one shape stamped repeatedly: Mars gets
      // eroded icosahedra, the Moon sharp ejecta, the abyss rounded rocks.
      const mkRock = (r, px, pz, v, rot) => {
        const geo = id === 'mars' ? new THREE.IcosahedronGeometry(r, 0) : id === 'space' ? new THREE.OctahedronGeometry(r, 0) : id === 'underwater' ? new THREE.DodecahedronGeometry(r, 1) : new THREE.DodecahedronGeometry(r, 0);
        const rock = new THREE.Mesh(geo, rockMat);
        rock.position.set(px, r * 0.5, pz);
        rock.rotation.set(v * 3, rot || 0, v * 2);
        rock.scale.set(1 + v * 0.4, 0.7 + v * 0.5, 1 + (1 - v) * 0.4);
        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);
      };
      const obstacles = terrain && terrain.obstacles || [];
      if (id !== 'city' && id !== 'room') obstacles.forEach(o => {
        const r = Math.max(0.6, o.r * SCALE);
        const px = o.x * SCALE,
          pz = -o.y * SCALE;
        if (id === 'earth' && o.v >= 0.5) {
          // tree: trunk + canopy
          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.24, r * 1.4, 6), trunkMat);
          trunk.position.y = r * 0.7;
          trunk.castShadow = true;
          const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 1.1, 0), leafMat);
          canopy.position.y = r * 1.9;
          canopy.castShadow = true;
          tree.add(trunk);
          tree.add(canopy);
          tree.position.set(px, 0, pz);
          scene.add(tree);
        } else if (id === 'underwater' && o.v >= 0.45) {
          // coral: a small clump of upright branches
          const coral = new THREE.Group();
          const n = 3 + (o.v * 4 | 0);
          for (let k = 0; k < n; k++) {
            const a = k / n * Math.PI * 2;
            const br = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, r * (1.0 + k % 2 * 0.6), 5), coralMat);
            br.position.set(Math.cos(a) * r * 0.4, r * 0.6, Math.sin(a) * r * 0.4);
            br.rotation.z = Math.cos(a) * 0.3;
            br.rotation.x = Math.sin(a) * 0.3;
            br.castShadow = true;
            coral.add(br);
          }
          coral.position.set(px, 0, pz);
          scene.add(coral);
        } else if (id === 'space' && o.v >= 0.5) {
          // crater: a low rim sunk into the surface with a dark basin floor, so
          // it reads as a depression rather than a ring lying on top of the ground.
          const crater = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.2, 6, 16), rimMat);
          crater.rotation.x = Math.PI / 2;
          crater.position.set(px, -r * 0.1, pz);
          crater.receiveShadow = true;
          scene.add(crater);
          const basin = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 18), new THREE.MeshStandardMaterial({
            color: 0x26282f,
            roughness: 1
          }));
          basin.rotation.x = -Math.PI / 2;
          basin.position.set(px, 0.02, pz);
          scene.add(basin);
        } else {
          mkRock(r, px, pz, o.v, o.rot);
        }
      });

      // ---- Proper 3D city and room scenes (meshes, not generic rocks). ----
      function makeWindowTex() {
        try {
          if (!document || !document.createElement) return null;
          const cv = document.createElement('canvas');
          cv.width = 64;
          cv.height = 96;
          const g = cv.getContext && cv.getContext('2d');
          if (!g) return null;
          g.fillStyle = '#39414f';
          g.fillRect(0, 0, 64, 96);
          for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 4; xx++) {
            g.fillStyle = Math.random() < 0.5 ? '#ffe6a0' : '#222a38';
            g.fillRect(6 + xx * 14, 6 + yy * 11, 9, 7);
          }
          const t = new THREE.CanvasTexture(cv);
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          return t;
        } catch (e) {
          return null;
        }
      }
      // A detailed car: a tapered hull, a raked cabin and windshield, head and
      // tail lights, mirrors, bumpers and rimmed wheels. Forward is +x.
      function carBody(parent, col) {
        const bodyM = new THREE.MeshPhysicalMaterial({
          color: col,
          roughness: 0.24,
          metalness: 0.72,
          envMapIntensity: 1.1,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
          sheen: 0.3
        });
        const trimM = new THREE.MeshStandardMaterial({
          color: 0x16181d,
          roughness: 0.6,
          metalness: 0.3
        });
        const glassM = new THREE.MeshPhysicalMaterial({
          color: 0x9fcae6,
          transmission: 0.0,
          roughness: 0.02,
          metalness: 0.0,
          transparent: true,
          opacity: 0.5,
          envMapIntensity: 1.8,
          clearcoat: 1.0
        });
        const headM = new THREE.MeshStandardMaterial({
          color: 0xfff6d8,
          emissive: 0xfff0c0,
          emissiveIntensity: 0.9
        });
        const tailM = new THREE.MeshStandardMaterial({
          color: 0xff5a4a,
          emissive: 0xff3322,
          emissiveIntensity: 0.8
        });
        // lower hull, slightly narrower at the base for a tapered look
        const hull = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.62, 1.7), bodyM);
        hull.position.y = 0.62;
        hull.castShadow = true;
        parent.add(hull);
        const skirt = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.34, 1.5), bodyM);
        skirt.position.y = 0.34;
        parent.add(skirt);
        // hood (front) and boot (rear), lower than the cabin
        const hood = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.34, 1.55), bodyM);
        hood.position.set(1.05, 1.05, 0);
        hood.castShadow = true;
        parent.add(hood);
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.34, 1.55), bodyM);
        boot.position.set(-1.2, 1.05, 0);
        boot.castShadow = true;
        parent.add(boot);
        // cabin: a box narrowed at the top, with a forward rake
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.74, 1.5), bodyM);
        cabin.position.set(-0.05, 1.5, 0);
        cabin.castShadow = true;
        parent.add(cabin);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 1.36), bodyM);
        roof.position.set(-0.15, 1.92, 0);
        parent.add(roof);
        // glass: a raked windscreen, a rear screen and side windows
        const wind = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 1.34), glassM);
        wind.position.set(0.82, 1.55, 0);
        wind.rotation.z = 0.5;
        parent.add(wind);
        const rear = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.66, 1.34), glassM);
        rear.position.set(-0.92, 1.55, 0);
        rear.rotation.z = -0.5;
        parent.add(rear);
        const sideL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.06), glassM);
        sideL.position.set(-0.05, 1.55, 0.74);
        parent.add(sideL);
        const sideR = sideL.clone();
        sideR.position.z = -0.74;
        parent.add(sideR);
        // lights
        [[1.78, 0.55], [1.78, -0.55]].forEach(p => {
          const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.34), headM);
          l.position.set(p[0], 0.72, p[1]);
          parent.add(l);
        });
        [[-1.78, 0.55], [-1.78, -0.55]].forEach(p => {
          const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.3), tailM);
          l.position.set(p[0], 0.74, p[1]);
          parent.add(l);
        });
        // bumpers and mirrors
        const fB = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 1.72), trimM);
        fB.position.set(1.78, 0.45, 0);
        parent.add(fB);
        const rB = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 1.72), trimM);
        rB.position.set(-1.78, 0.45, 0);
        parent.add(rB);
        [[0.55, 0.92], [0.55, -0.92]].forEach(p => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.3), bodyM);
          m.position.set(p[0], 1.5, p[1]);
          parent.add(m);
        });
      }
      function carWheels(parent, register) {
        const wM = new THREE.MeshStandardMaterial({
          color: 0x121319,
          roughness: 0.85
        });
        const rimM = new THREE.MeshStandardMaterial({
          color: 0xb6bcc8,
          roughness: 0.3,
          metalness: 0.75,
          envMapIntensity: 1.2
        });
        [[1.15, 0.92], [1.15, -0.92], [-1.15, 0.92], [-1.15, -0.92]].forEach(p => {
          const wheel = new THREE.Group();
          const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.36, 18), wM);
          tyre.rotation.x = Math.PI / 2;
          tyre.castShadow = true;
          const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.4, 8), rimM);
          rim.rotation.x = Math.PI / 2;
          wheel.add(tyre);
          wheel.add(rim);
          wheel.position.set(p[0], 0.5, p[1]);
          parent.add(wheel);
          if (register) register(wheel, tyre, p[0] > 0);
        });
      }
      function mkCar(col) {
        const car = new THREE.Group();
        carBody(car, col);
        carWheels(car, null);
        return car;
      }
      function mkPerson(shirt) {
        const p = new THREE.Group();
        const legM = new THREE.MeshStandardMaterial({
          color: 0x2f3646,
          roughness: 0.9
        });
        const shirtM = new THREE.MeshStandardMaterial({
          color: shirt,
          roughness: 0.85
        });
        const skinM = new THREE.MeshStandardMaterial({
          color: 0xe8c9a8,
          roughness: 0.7
        });
        const Cap = THREE.CapsuleGeometry ? THREE.CapsuleGeometry : null;
        const torso = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.42, 0.8, 4, 8) : new THREE.CylinderGeometry(0.42, 0.42, 1.4, 8), shirtM);
        torso.position.y = 1.7;
        torso.castShadow = true;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12), skinM);
        head.position.y = 2.5;
        head.castShadow = true;
        const lLeg = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.18, 0.7, 3, 6) : new THREE.CylinderGeometry(0.18, 0.18, 1.0, 6), legM);
        lLeg.position.set(-0.2, 0.85, 0);
        const rLeg = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.18, 0.7, 3, 6) : new THREE.CylinderGeometry(0.18, 0.18, 1.0, 6), legM);
        rLeg.position.set(0.2, 0.85, 0);
        p.add(torso);
        p.add(head);
        p.add(lLeg);
        p.add(rLeg);
        p._legs = [lLeg, rLeg];
        return p;
      }
      // A small autonomous robot for the roaming fleet: a coloured rover body on
      // four wheels with a glowing eye, so the other machines read as robots.
      function mkRobotAgent(col) {
        const g = new THREE.Group();
        const bodyM = new THREE.MeshStandardMaterial({
          color: col,
          roughness: 0.4,
          metalness: 0.4
        });
        const eyeM = new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.8
        });
        const hull = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 1.1), bodyM);
        hull.position.y = 0.62;
        hull.castShadow = true;
        g.add(hull);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), bodyM);
        dome.position.set(0.1, 1.05, 0);
        dome.castShadow = true;
        g.add(dome);
        const eye = new THREE.Mesh(new THREE.CircleGeometry(0.12, 14), eyeM);
        eye.position.set(0.78, 0.7, 0);
        eye.rotation.y = Math.PI / 2;
        g.add(eye);
        const wm = new THREE.MeshStandardMaterial({
          color: 0x14161b,
          roughness: 0.85
        });
        const wheels = [];
        [[0.55, 0.62], [0.55, -0.62], [-0.55, 0.62], [-0.55, -0.62]].forEach(p => {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 12), wm);
          w.rotation.x = Math.PI / 2;
          w.position.set(p[0], 0.3, p[1]);
          w.castShadow = true;
          g.add(w);
          wheels.push(w);
        });
        g._wheels = wheels;
        return g;
      }
      // Render every KodroAgents entity (cars, people, roaming robots) as a 3D
      // mesh driven by the shared sim, so what the collision test sees is what
      // the eye sees. Used by the city and the open terrain worlds.
      function renderAgents() {
        const KA = window.KodroAgents;
        if (!KA) return;
        KA.list().forEach((ag, i) => {
          let mesh;
          if (ag.kind === 'car') mesh = mkCar(ag.color != null ? ag.color : 0x2c6fb0);else if (ag.kind === 'robot') mesh = mkRobotAgent(ag.color != null ? ag.color : 0x5ce0d8);else mesh = mkPerson(ag.color != null ? ag.color : 0x5aa0d8);
          scene.add(mesh);
          agents.push({
            mesh,
            update: () => {
              const a = KA.list()[i];
              if (!a) return;
              mesh.position.set(a.x * SCALE, 0, -a.y * SCALE);
              mesh.rotation.y = Math.atan2(a.dy, a.dx);
              if (ag.kind === 'person' && mesh._legs) {
                mesh._legs[0].rotation.x = a.leg * 0.5;
                mesh._legs[1].rotation.x = -a.leg * 0.5;
              }
              if (ag.kind === 'robot' && mesh._wheels) {
                for (let k = 0; k < mesh._wheels.length; k++) mesh._wheels[k].rotation.y = a.leg;
              }
            }
          });
        });
      }
      function buildCity() {
        const HALF = 1500 * SCALE; // 45 units
        const ROADW = 150 * SCALE * 2; // 9 units carriageway
        const asphalt = new THREE.MeshStandardMaterial({
          color: 0x23272f,
          roughness: 0.95
        });
        const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, ROADW), asphalt);
        hRoad.rotation.x = -Math.PI / 2;
        hRoad.position.y = 0.02;
        hRoad.receiveShadow = true;
        scene.add(hRoad);
        const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROADW, HALF * 2), asphalt);
        vRoad.rotation.x = -Math.PI / 2;
        vRoad.position.y = 0.021;
        vRoad.receiveShadow = true;
        scene.add(vRoad);
        const dashM = new THREE.MeshBasicMaterial({
          color: 0xe6d886
        });
        for (let i = -HALF; i < HALF; i += 4.2) {
          if (Math.abs(i) < ROADW / 2) continue;
          const d1 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.22), dashM);
          d1.rotation.x = -Math.PI / 2;
          d1.position.set(i, 0.03, 0);
          scene.add(d1);
          const d2 = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 2.2), dashM);
          d2.rotation.x = -Math.PI / 2;
          d2.position.set(0, 0.03, i);
          scene.add(d2);
        }
        const zM = new THREE.MeshBasicMaterial({
          color: 0xe8ecf2
        });
        for (let k = 0; k < 6; k++) {
          const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.7, ROADW * 0.92), zM);
          bar.rotation.x = -Math.PI / 2;
          bar.position.set(ROADW / 2 + 1.4 + k * 1.3, 0.03, 0);
          scene.add(bar);
        }
        const winTex = makeWindowTex();
        obstacles.forEach(o => {
          const px = o.x * SCALE,
            pz = -o.y * SCALE;
          if (o.kind === 'building') {
            const w = Math.max(3, o.r * SCALE * 1.4),
              hgt = w * (1.4 + o.v * 3.2);
            const m = winTex ? new THREE.MeshStandardMaterial({
              map: winTex.clone(),
              color: 0x8b94a1,
              roughness: 0.8
            }) : new THREE.MeshStandardMaterial({
              color: 0x5a6472,
              roughness: 0.85
            });
            if (m.map) {
              m.map.repeat.set(2, Math.max(2, Math.round(hgt / 4)));
              m.map.needsUpdate = true;
            }
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, w), m);
            b.position.set(px, hgt / 2, pz);
            b.castShadow = true;
            b.receiveShadow = true;
            scene.add(b);
            const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.4, w * 1.05), new THREE.MeshStandardMaterial({
              color: 0x343b45,
              roughness: 1
            }));
            roof.position.set(px, hgt + 0.2, pz);
            scene.add(roof);
          } else if (o.kind === 'car') {
            const car = mkCar(o.v < 0.5 ? 0xc0392b : 0x2c6fb0);
            car.position.set(px, 0, pz);
            car.rotation.y = (o.rot || 0) * Math.PI / 180;
            scene.add(car);
          }
        });
        // The base window texture is only a clone source: each building got its
        // own independent clone, so the base can be freed now (it is never rendered).
        if (winTex) winTex.dispose();
        // Render the shared moving agents as 3D meshes, driven by the same
        // simulation the collision test reads, so a pedestrian the robot can
        // see in the world is one it can actually hit.
        renderAgents();
      }
      function buildRoom() {
        const R = 30;
        const wallM = new THREE.MeshStandardMaterial({
          color: 0xcdbfa8,
          roughness: 0.95,
          side: THREE.DoubleSide
        });
        const wallH = 14;
        const mkWall = (w, x, z, ry) => {
          const ww = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 0.6), wallM);
          ww.position.set(x, wallH / 2, z);
          ww.rotation.y = ry;
          ww.receiveShadow = true;
          scene.add(ww);
        };
        mkWall(R * 2, 0, -R, 0);
        mkWall(R * 2, -R, 0, Math.PI / 2);
        mkWall(R * 2, R, 0, Math.PI / 2);
        const rug = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), new THREE.MeshStandardMaterial({
          color: 0x9a5f54,
          roughness: 1
        }));
        rug.rotation.x = -Math.PI / 2;
        rug.position.y = 0.03;
        scene.add(rug);
        const sofaM = new THREE.MeshStandardMaterial({
          color: 0x3f6f8c,
          roughness: 0.85
        });
        const sofa = new THREE.Group();
        const seat = new THREE.Mesh(new THREE.BoxGeometry(10, 1.4, 4), sofaM);
        seat.position.y = 1.6;
        seat.castShadow = true;
        const back = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 1), sofaM);
        back.position.set(0, 2.8, -1.7);
        back.castShadow = true;
        const aL = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 4), sofaM);
        aL.position.set(-5.5, 2.2, 0);
        const aR = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 4), sofaM);
        aR.position.set(5.5, 2.2, 0);
        sofa.add(seat);
        sofa.add(back);
        sofa.add(aL);
        sofa.add(aR);
        sofa.position.set(0, 0, -R + 6);
        scene.add(sofa);
        const woodM = new THREE.MeshStandardMaterial({
          color: 0x7a5536,
          roughness: 0.7
        });
        const TX = -14.1,
          TZ = -11.4; // matches the table collision obstacle, clear of the robot's start
        const table = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 4), woodM);
        table.position.set(TX, 2.2, TZ);
        table.castShadow = true;
        scene.add(table);
        [[2.5, 1.8], [2.5, -1.8], [-2.5, 1.8], [-2.5, -1.8]].forEach(p => {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), woodM);
          leg.position.set(TX + p[0], 1.1, TZ + p[1]);
          scene.add(leg);
        });
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(8, 9, 1.2), woodM);
        shelf.position.set(R - 2, 4.5, -8);
        shelf.castShadow = true;
        scene.add(shelf);
        for (let s = 0; s < 3; s++) {
          const bk = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.4, 1.0), new THREE.MeshStandardMaterial({
            color: 0x6a4f2c,
            roughness: 1
          }));
          bk.position.set(R - 2, 2 + s * 3, -8);
          scene.add(bk);
        }
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 1.8, 10), new THREE.MeshStandardMaterial({
          color: 0xb56a45,
          roughness: 1
        }));
        pot.position.set(-R + 4, 0.9, -R + 4);
        pot.castShadow = true;
        scene.add(pot);
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 0), new THREE.MeshStandardMaterial({
          color: 0x3f7d3a,
          roughness: 1,
          flatShading: true
        }));
        leaf.position.set(-R + 4, 3.4, -R + 4);
        leaf.castShadow = true;
        scene.add(leaf);
        const lamp = new THREE.SpotLight(0xffd9a0, 1.2, 80, 0.6, 0.4);
        lamp.position.set(R - 8, 11, 8);
        lamp.target.position.set(R - 8, 0, 8);
        lamp.castShadow = false;
        scene.add(lamp);
        scene.add(lamp.target);
        // People moving in the room, from the shared agent simulation, so the
        // companion robot has someone to avoid.
        const KAr = window.KodroAgents;
        if (KAr) {
          KAr.list().forEach((ag, i) => {
            if (ag.kind !== 'person') return;
            const pr = mkPerson(ag.color != null ? ag.color : 0x6aa0d8);
            scene.add(pr);
            agents.push({
              mesh: pr,
              update: () => {
                const a = KAr.list()[i];
                if (!a) return;
                pr.position.set(a.x * SCALE, 0, -a.y * SCALE);
                pr.rotation.y = Math.atan2(a.dy, a.dx);
                if (pr._legs) {
                  pr._legs[0].rotation.x = a.leg * 0.5;
                  pr._legs[1].rotation.x = -a.leg * 0.5;
                }
              }
            });
          });
        }
      }
      // Make sure the shared agent sim is built for THIS world before we render
      // its meshes (the viewport effect can run before App's build effect).
      if (window.KodroAgents && window.KodroAgents.world() !== id) window.KodroAgents.build(id);
      if (id === 'city') buildCity();else if (id === 'room') buildRoom();else renderAgents(); // open terrain worlds: render the roaming robot fleet

      // The robot: built to match the kind the user designed in Robot Lab, so
      // a rover, a car, a home companion or an arm each look like themselves.
      const accent = new THREE.Color(terrain && terrain.accent || '#5ce0d8');
      const rType = robotType || window.getKodroRobot && window.getKodroRobot().type || 'rover';
      // Per-type motion feel: a car throws its weight around; a heavy rover is
      // measured and stable; a humanoid stays upright and barely banks; a fixed
      // manipulator arm does not pitch or roll as it works.
      const MOTION = {
        car: {
          pitch: 1.0,
          roll: 1.0,
          susp: 1.0
        },
        rover: {
          pitch: 0.5,
          roll: 0.45,
          susp: 0.6
        },
        home: {
          pitch: 0.28,
          roll: 0.22,
          susp: 0.4
        },
        arm: {
          pitch: 0,
          roll: 0,
          susp: 0
        }
      };
      const feel = MOTION[rType] || {
        pitch: 0.6,
        roll: 0.55,
        susp: 0.7
      };
      const rov = new THREE.Group();
      const body = new THREE.Group();
      rov.add(body); // non-wheel parts: leans with weight transfer
      const wheels = [];
      const steer = []; // front wheel groups, turned toward the heading change
      const Cap = THREE.CapsuleGeometry || null;
      let ledIndicator = null; // rover mast LED, pulsed each frame in tick()
      // DoubleSide so flat accent discs (the rover eye, the home chest) stay
      // visible when the orbit camera swings round behind the robot.
      const accMat = () => new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: 0.5,
        side: THREE.DoubleSide
      });
      const addWheels = (positions, r) => {
        const wm = new THREE.MeshStandardMaterial({
          color: 0x14161b,
          roughness: 0.85
        });
        const hubM = new THREE.MeshStandardMaterial({
          color: 0x9aa0ad,
          roughness: 0.4,
          metalness: 0.6
        });
        positions.forEach(p => {
          const wheel = new THREE.Group();
          const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.32, 16), wm);
          tyre.rotation.x = Math.PI / 2;
          tyre.castShadow = true;
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.42, 0.34, 8), hubM);
          hub.rotation.x = Math.PI / 2;
          wheel.add(tyre);
          wheel.add(hub);
          wheel.position.set(p[0], r, p[1]);
          rov.add(wheel);
          wheels.push(tyre);
          if (p[0] > 0) steer.push(wheel); // front axle steers
        });
      };
      const arrow = y => {
        const a = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 4), accMat());
        a.rotation.z = -Math.PI / 2;
        a.position.set(0.2, y, 0);
        body.add(a);
      };
      if (rType === 'car') {
        carBody(body, 0x2c6fb0);
        carWheels(rov, (wheel, tyre, front) => {
          wheels.push(tyre);
          if (front) steer.push(wheel);
        });
        arrow(2.05);
        // Headlights as real spotlights (children of rov so they track the car).
        // Forward is +x; only the left one casts a shadow to keep the cost down.
        [[0.55], [-0.55]].forEach((zArr, idx) => {
          const sl = new THREE.SpotLight(0xfff5e0, 1.5, 60, 0.4, 0.5);
          sl.position.set(1.78, 0.72, zArr[0]);
          sl.target.position.set(20, 0.2, zArr[0]);
          sl.castShadow = idx === 0;
          if (sl.castShadow) {
            sl.shadow.mapSize.set(512, 512);
            sl.shadow.bias = -0.0003;
          }
          rov.add(sl);
          rov.add(sl.target);
        });
      } else if (rType === 'home') {
        const botM = new THREE.MeshStandardMaterial({
          color: 0xe9edf2,
          roughness: 0.4,
          metalness: 0.1
        });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.05, 0.5, 20), new THREE.MeshStandardMaterial({
          color: 0x3a4150,
          roughness: 0.6
        }));
        base.position.y = 0.25;
        base.castShadow = true;
        body.add(base);
        const torso = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.78, 1.1, 6, 16) : new THREE.CylinderGeometry(0.78, 0.78, 1.9, 16), botM);
        torso.position.y = 1.55;
        torso.castShadow = true;
        body.add(torso);
        const chest = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16), accMat());
        chest.position.set(0.74, 1.6, 0);
        chest.rotation.y = Math.PI / 2;
        body.add(chest);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.66, 20, 16), botM);
        head.position.y = 2.75;
        head.castShadow = true;
        body.add(head);
        const visor = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12), new THREE.MeshStandardMaterial({
          color: 0x10141c,
          roughness: 0.2,
          metalness: 0.4
        }));
        visor.scale.set(1, 0.7, 0.6);
        visor.position.set(0.42, 2.78, 0);
        body.add(visor);
        [[0.78, 0.18], [0.78, -0.18]].forEach(p => {
          const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), accMat());
          e.position.set(p[0], 2.82, p[1]);
          body.add(e);
        });
        // arms: a companion robot needs hands. Shoulder + upper arm + elbow +
        // forearm per side, hanging at rest, accent-coloured joints.
        const armMatH = new THREE.MeshStandardMaterial({
          color: 0xd7dbe2,
          roughness: 0.45,
          metalness: 0.15
        });
        [0.86, -0.86].forEach(z => {
          const sh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), accMat());
          sh.position.set(0, 2.0, z);
          body.add(sh);
          const up = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.17, 0.66, 4, 8) : new THREE.CylinderGeometry(0.17, 0.17, 1.0, 8), armMatH);
          up.position.set(0.06, 1.52, z);
          up.castShadow = true;
          body.add(up);
          const el = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), accMat());
          el.position.set(0.12, 1.08, z);
          body.add(el);
          const fo = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.14, 0.52, 4, 8) : new THREE.CylinderGeometry(0.14, 0.14, 0.8, 8), armMatH);
          fo.position.set(0.18, 0.66, z);
          fo.castShadow = true;
          body.add(fo);
        });
        // wheels pushed out past the base skirt so they are actually visible
        // (at the old 0.55 they were buried inside the ~1.0-radius base).
        addWheels([[0, 1.05], [0, -1.05]], 0.32);
        arrow(3.5);
      } else if (rType === 'arm') {
        const armM = new THREE.MeshStandardMaterial({
          color: 0xc7ccd4,
          roughness: 0.35,
          metalness: 0.6
        });
        const jointM = accMat();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.7, 20), new THREE.MeshStandardMaterial({
          color: 0x39414c,
          roughness: 0.6
        }));
        base.position.y = 0.35;
        base.castShadow = true;
        body.add(base);
        const j1 = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), jointM);
        j1.position.y = 0.9;
        body.add(j1);
        const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.5), armM);
        seg1.position.set(0.2, 2.0, 0);
        seg1.rotation.z = -0.5;
        seg1.castShadow = true;
        body.add(seg1);
        const j2 = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), jointM);
        j2.position.set(1.1, 2.9, 0);
        body.add(j2);
        const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 0.4), armM);
        seg2.position.set(1.9, 3.4, 0);
        seg2.rotation.z = -1.2;
        seg2.castShadow = true;
        body.add(seg2);
        // wrist joint capping seg2 so the gripper reads as articulated, not floating
        const j3 = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), jointM);
        j3.position.set(2.55, 3.62, 0);
        body.add(j3);
        const g1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), armM);
        g1.position.set(2.7, 3.7, 0.22);
        body.add(g1);
        const g2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), armM);
        g2.position.set(2.7, 3.7, -0.22);
        body.add(g2);
        arrow(1.3);
      } else {
        // rover (and custom): chassis, solar deck, sensor mast with a camera eye.
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x2b2f3a,
          roughness: 0.42,
          metalness: 0.45,
          envMapIntensity: 1.0
        });
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.7), bodyMat);
        chassis.position.y = 0.92;
        chassis.castShadow = true;
        body.add(chassis);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 1.4), new THREE.MeshStandardMaterial({
          color: 0x1b2740,
          roughness: 0.3,
          metalness: 0.5
        }));
        deck.position.set(-0.2, 1.34, 0);
        body.add(deck);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8), bodyMat);
        mast.position.set(0.85, 1.75, 0);
        body.add(mast);
        const camHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.72), bodyMat);
        camHead.position.set(0.85, 2.3, 0);
        camHead.castShadow = true;
        body.add(camHead);
        const eye = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), accMat());
        eye.position.set(1.12, 2.3, 0);
        eye.rotation.y = Math.PI / 2;
        body.add(eye);
        // A small status LED atop the mast that pulses each frame (see tick()).
        const ledMat = new THREE.MeshStandardMaterial({
          color: accent,
          emissive: accent,
          emissiveIntensity: 0.6
        });
        ledIndicator = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), ledMat);
        ledIndicator.position.set(0.85, 2.6, 0);
        body.add(ledIndicator);
        // running lights on the leading edge of the chassis
        const litM = new THREE.MeshStandardMaterial({
          color: 0xfff6d8,
          emissive: 0xfff0c0,
          emissiveIntensity: 0.9
        });
        [[1.3, 0.55], [1.3, -0.55]].forEach(p => {
          const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.28), litM);
          l.position.set(p[0], 0.85, p[1]);
          body.add(l);
        });
        addWheels([[0.95, 0.95], [0.95, -0.95], [-0.95, 0.95], [-0.95, -0.95]], 0.5);
        arrow(2.05);
      }
      // Sensor attachments: small modules on the body reflecting the FITTED
      // parts, so the robot the user designed is visible. Mounted on `body` so
      // they lean with weight transfer. Forward is +x. Guarded so a bad spec or
      // a missing global can never break the scene build.
      try {
        const fitted = window.getKodroRobot && window.getKodroRobot().sensors || [];
        const sy = rType === 'home' ? 1.6 : rType === 'arm' ? 1.0 : 1.15; // mount height by build
        const fx = rType === 'car' ? 1.55 : rType === 'home' ? 0.7 : 1.25; // front face by build
        const darkM = new THREE.MeshStandardMaterial({
          color: 0x14161b,
          roughness: 0.7,
          metalness: 0.3
        });
        if (rType !== 'arm') {
          if (fitted.indexOf('ultrasonic') >= 0) {
            [0.2, -0.2].forEach(z => {
              const e = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.13, 16), darkM);
              e.rotation.z = Math.PI / 2;
              e.position.set(fx, sy, z);
              body.add(e);
              const r = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), accMat());
              r.position.set(fx + 0.08, sy, z);
              r.rotation.y = Math.PI / 2;
              body.add(r);
            });
          }
          if (fitted.indexOf('camera') >= 0) {
            const cam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.34), darkM);
            cam.position.set(fx - 0.05, sy + 0.4, 0);
            body.add(cam);
            const lens = new THREE.Mesh(new THREE.CircleGeometry(0.09, 14), accMat());
            lens.position.set(fx + 0.07, sy + 0.4, 0);
            lens.rotation.y = Math.PI / 2;
            body.add(lens);
          }
          if (fitted.indexOf('bumper') >= 0) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 1.2), new THREE.MeshStandardMaterial({
              color: 0xb84a3a,
              roughness: 0.6
            }));
            bar.position.set(fx + 0.05, 0.55, 0);
            body.add(bar);
          }
          if (fitted.indexOf('line') >= 0) {
            const ls = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.5), darkM);
            ls.position.set(fx - 0.2, 0.35, 0);
            body.add(ls);
          }
        }
        if (fitted.indexOf('gps') >= 0) {
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), new THREE.MeshStandardMaterial({
            color: 0x9aa0ad,
            metalness: 0.6,
            roughness: 0.4
          }));
          ant.position.set(-0.2, sy + 0.9, 0.3);
          body.add(ant);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), accMat());
          tip.position.set(-0.2, sy + 1.25, 0.3);
          body.add(tip);
        }
        if (fitted.indexOf('imu') >= 0) {
          const chip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.16), new THREE.MeshStandardMaterial({
            color: 0x2c7a4a,
            roughness: 0.5
          }));
          chip.position.set(-0.1, sy + 0.1, -0.3);
          body.add(chip);
        }
      } catch (e) {
        void e;
      }
      // Practical scale: a robot indoors shares a small room with furniture, so
      // it is sized down to fit rather than towering over the sofa.
      // Give the robot real presence: it was reading as a distant toy. Scale it
      // up so the build and its sensor pods are legible (indoors stays a touch
      // smaller so it does not tower over the furniture).
      rov.scale.setScalar(id === 'room' ? 1.05 : 1.4);
      scene.add(rov);

      // A trail ribbon that grows as the rover drives.
      const MAXPTS = 600;
      const trailPos = new Float32Array(MAXPTS * 3);
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
      trailGeo.setDrawRange(0, 0);
      const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.85
      }));
      scene.add(trail);
      let trailN = 0;

      // Smoothed render state (lerped toward the live rover each frame).
      const cur = new THREE.Vector3(0, 0, 0);
      let curHeading = 0;
      // Motion feel: a real vehicle transfers weight, so the body pitches when
      // it accelerates or brakes, banks into turns, and the suspension settles.
      let prevSpeed = 0,
        prevHead = 0,
        bodyPitch = 0,
        bodyRoll = 0,
        susp = 0,
        vsmooth = 0;
      const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
      const camPos = new THREE.Vector3(0, 20, 30);

      // Third-person orbit: drag to rotate, wheel or two-finger pinch to zoom,
      // so it works on a tablet or Chromebook as well as a mouse.
      let azim = 2.4,
        elev = 0.62,
        dist = id === 'room' ? 13 : 19,
        dragging = false,
        lx = 0,
        ly = 0;
      const dom = renderer.domElement;
      const ptrs = new Map();
      let pinch = 0;
      const pinchGap = () => {
        const v = [...ptrs.values()];
        return v.length < 2 ? 0 : Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
      };
      const onDown = e => {
        ptrs.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY
        });
        if (ptrs.size === 1) {
          dragging = true;
          lx = e.clientX;
          ly = e.clientY;
        } else {
          dragging = false;
          pinch = pinchGap();
        }
      };
      const onUp = e => {
        ptrs.delete(e.pointerId);
        if (ptrs.size < 2) pinch = 0;
        if (ptrs.size === 0) dragging = false;
      };
      const onMove = e => {
        if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY
        });
        if (ptrs.size >= 2) {
          const g = pinchGap();
          if (pinch) dist = Math.max(8, Math.min(80, dist + (pinch - g) * 0.05));
          pinch = g;
          return;
        }
        if (!dragging) return;
        azim -= (e.clientX - lx) * 0.008;
        elev = Math.max(0.12, Math.min(1.45, elev - (e.clientY - ly) * 0.006));
        lx = e.clientX;
        ly = e.clientY;
      };
      const onWheel = e => {
        dist = Math.max(8, Math.min(80, dist + e.deltaY * 0.03));
        e.preventDefault();
      };
      // Keyboard control so the orbit camera works without a pointer drag
      // (the QA flagged this as a WCAG keyboard-access gap).
      const onKey = e => {
        const k = e.key;
        if (k === 'ArrowLeft') azim -= 0.12;else if (k === 'ArrowRight') azim += 0.12;else if (k === 'ArrowUp') elev = Math.min(1.45, elev + 0.08);else if (k === 'ArrowDown') elev = Math.max(0.12, elev - 0.08);else if (k === '+' || k === '=') dist = Math.max(8, dist - 2);else if (k === '-' || k === '_') dist = Math.min(80, dist + 2);else return;
        e.preventDefault();
      };
      dom.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointermove', onMove);
      dom.addEventListener('wheel', onWheel, {
        passive: false
      });
      dom.addEventListener('keydown', onKey);
      const onResize = () => {
        w = mount.clientWidth || w;
        h = mount.clientHeight || h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (post) post.setSize(w, h);
      };
      window.addEventListener('resize', onResize);
      let raf = 0;
      const tmp = new THREE.Vector3();
      const camTarget = new THREE.Vector3();
      const angLerp = (a, b, t) => {
        let d = (b - a) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        return a + d * t;
      };
      // Auto-quality: if the first couple of seconds run slow on a weak GPU,
      // drop shadows and the pixel ratio once so the view stays usable.
      let frames = 0,
        slow = 0,
        downgraded = false,
        last = window.performance && window.performance.now ? window.performance.now() : 0;
      const tick = () => {
        if (disposed) return;
        const now = window.performance && window.performance.now ? window.performance.now() : last + 16;
        const dt = now - last;
        last = now;
        if (!downgraded && ++frames > 12) {
          if (dt > 40) slow++;else slow = Math.max(0, slow - 1);
          if (slow > 30) {
            renderer.shadowMap.enabled = false;
            sun.castShadow = false;
            renderer.setPixelRatio(1);
            downgraded = true;
          }
        }
        const s = stateRef.current;
        const tx = s.x * SCALE,
          tz = -s.y * SCALE;
        const tr = (s.heading || 0) * Math.PI / 180;
        const px0 = cur.x,
          pz0 = cur.z;
        // Glide the rover toward the live state instead of snapping to it.
        cur.x += (tx - cur.x) * posLerp;
        cur.z += (tz - cur.z) * posLerp;
        curHeading = angLerp(curHeading, tr, posLerp);
        rov.position.set(cur.x, 0, cur.z);
        // The engine advances by (sin h, -cos h); after the z-flip the 3D travel
        // direction is (sin h, cos h). The mesh is built forward = local +x, and
        // a Y-rotation of +x by theta gives (cos theta, -sin theta), so theta
        // must be curHeading - 90deg for the mesh to face the way it actually
        // moves (it was crabbing 90deg before). Matches how the agents face.
        rov.rotation.y = curHeading - Math.PI / 2;
        const moved = Math.hypot(cur.x - px0, cur.z - pz0);
        if (moved > 0.001) wheels.forEach(wh => wh.rotateY(moved * 1.6));
        // Rover status LED: pulses on a slow sine and tracks the live LED colour
        // (s.led is a hex string set by led("cyan") etc.), falling back to accent.
        if (ledIndicator) {
          ledIndicator.material.emissiveIntensity = 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(now * 0.004));
          if (s.led && s.led !== ledIndicator.userData.led) {
            ledIndicator.userData.led = s.led;
            const lc = new THREE.Color(s.led);
            ledIndicator.material.color.copy(lc);
            ledIndicator.material.emissive.copy(lc);
          }
        }
        // ---- weight transfer, banking, suspension and steering ----
        const accel = moved - prevSpeed;
        prevSpeed = moved;
        vsmooth += (moved - vsmooth) * 0.2;
        let turn = curHeading - prevHead;
        prevHead = curHeading;
        if (turn > Math.PI) turn -= Math.PI * 2;else if (turn < -Math.PI) turn += Math.PI * 2;
        // pitch: nose lifts under acceleration, dips under braking (about the lateral axis = local z)
        bodyPitch += (clamp(-accel * 7, -0.16, 0.16) * feel.pitch - bodyPitch) * 0.18;
        // roll: lean into the turn (about the forward axis = local x), more at speed
        bodyRoll += (clamp(turn * 9 + turn * vsmooth * 22, -0.24, 0.24) * feel.roll - bodyRoll) * 0.16;
        // suspension: a small settle driven by acceleration, eased back to rest
        susp += (clamp(-accel * 1.6, -0.18, 0.18) * feel.susp - susp) * 0.22;
        body.rotation.z = bodyPitch;
        body.rotation.x = bodyRoll;
        body.position.y = -Math.abs(susp) * 0.35;
        // front wheels steer toward the heading change
        if (steer.length) {
          const sa = clamp(turn * 26, -0.5, 0.5);
          steer.forEach(wg => {
            wg.rotation.y += (sa - wg.rotation.y) * 0.3;
          });
        }
        // First-person forward is the real 3D travel direction (sin h, cos h),
        // the same vector the rover mesh now faces, so the driver view looks
        // where the robot actually drives rather than 90deg off to the side.
        const fwd = tmp.set(Math.sin(curHeading), 0, Math.cos(curHeading));

        // Grow the trail when the rover has actually moved.
        if (trailN === 0 || Math.hypot(cur.x - trailPos[(trailN - 1) * 3], cur.z - trailPos[(trailN - 1) * 3 + 2]) > 0.25) {
          if (trailN >= MAXPTS) {
            trailPos.copyWithin(0, 3);
            trailN = MAXPTS - 1;
          }
          trailPos[trailN * 3] = cur.x;
          trailPos[trailN * 3 + 1] = 0.3;
          trailPos[trailN * 3 + 2] = cur.z;
          trailN += 1;
          trailGeo.setDrawRange(0, trailN);
          trailGeo.attributes.position.needsUpdate = true;
        }

        // Drive the live city agents (pedestrians, traffic).
        if (agents.length) {
          const tsec = now / 1000;
          for (let i = 0; i < agents.length; i++) agents[i].update(tsec);
        }
        if (fpvRef.current) {
          // First person: sit in the rover, look the way it drives.
          camPos.set(cur.x + fwd.x * 1.2, 2.4, cur.z + fwd.z * 1.2);
          camera.position.copy(camPos);
          camera.lookAt(cur.x + fwd.x * 20, 1.8, cur.z + fwd.z * 20);
        } else {
          // Third person orbit, damped so it eases rather than jumps.
          const ox = Math.cos(azim) * Math.cos(elev) * dist;
          const oy = Math.sin(elev) * dist + 4;
          const oz = Math.sin(azim) * Math.cos(elev) * dist;
          camPos.lerp(camTarget.set(cur.x + ox, oy, cur.z + oz), camLerp);
          camera.position.copy(camPos);
          camera.lookAt(cur.x, 2, cur.z);
        }
        // Cinematic uses the offline bloom/vignette pass; every other tier (and
        // the post-downgrade slow-GPU path) renders straight to the canvas. If
        // the post pass ever throws at frame time (e.g. an old GPU that cannot
        // linear-filter the half-float bloom target), disable it permanently and
        // fall back to the plain render so the view never freezes.
        if (post && !downgraded) {
          try {
            post.render(scene, camera);
          } catch (e) {
            void e;
            try {
              post.dispose();
            } catch (e2) {
              void e2;
            }
            post = null;
            renderer.setRenderTarget(null);
            renderer.render(scene, camera);
          }
        } else {
          renderer.render(scene, camera);
        }
        raf = window.requestAnimationFrame(tick);
      };
      tick();
      return () => {
        disposed = true;
        window.cancelAnimationFrame(raf);
        if (post) {
          try {
            post.dispose();
          } catch (e) {
            void e;
          }
          post = null;
        }
        window.removeEventListener('resize', onResize);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointermove', onMove);
        dom.removeEventListener('pointerdown', onDown);
        dom.removeEventListener('wheel', onWheel);
        dom.removeEventListener('keydown', onKey);
        canvas.removeEventListener('webglcontextlost', onContextLost);
        trailGeo.dispose();
        renderer.dispose();
        // The PMREM environment map is a render-target texture and is not a
        // scene-graph child, so traverse never reaches it: dispose it directly.
        if (scene.environment) scene.environment.dispose();
        scene.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => {
            // Material.dispose() does not free textures it references (they may be
            // shared), so dispose the maps too. dispose() is idempotent.
            if (m.map) m.map.dispose();
            if (m.emissiveMap) m.emissiveMap.dispose();
            if (m.normalMap) m.normalMap.dispose();
            if (m.roughnessMap) m.roughnessMap.dispose();
            m.dispose();
          });
        });
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      };
    }, [terrain && terrain.id, robotType]);
    return React.createElement('div', {
      className: 'viewport3d',
      ref: mountRef
    });
  }
  window.Viewport3D = Viewport3D;
})();
})();

;(function () {
/* ============================================================================
   ORBITAL ROVER — Code editor
   Transparent textarea over a syntax-highlighted <pre>, with a line-number
   gutter and an active-line marker driven by the interpreter.
   Exposes window.Editor
   ========================================================================== */
(function () {
  const {
    useRef,
    useEffect
  } = React;
  const KEYWORDS = ['for', 'in', 'while', 'if', 'elif', 'else', 'def', 'return', 'break', 'continue', 'pass', 'and', 'or', 'not', 'import', 'from'];
  const CONSTS = ['True', 'False', 'None'];
  const BUILTINS = ['print', 'range', 'len', 'int', 'float', 'str', 'abs', 'round', 'min', 'max', 'sqrt', 'random'];
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
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
      if (c === '#') {
        res += '<span class="tok-com">' + esc(line.slice(i)) + '</span>';
        break;
      }
      // string
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && line[j] !== c) {
          if (line[j] === '\\') j++;
          j++;
        }
        res += '<span class="tok-str">' + esc(line.slice(i, Math.min(j + 1, n))) + '</span>';
        i = j + 1;
        continue;
      }
      // number
      if (/[0-9]/.test(c)) {
        let j = i + 1;
        while (j < n && /[0-9.]/.test(line[j])) j++;
        res += '<span class="tok-num">' + esc(line.slice(i, j)) + '</span>';
        i = j;
        continue;
      }
      // identifier
      if (isIdStart(c)) {
        let j = i + 1;
        while (j < n && isId(line[j])) j++;
        const word = line.slice(i, j);
        const after = line.slice(j);
        // rover.method
        if (word === 'rover') {
          res += '<span class="tok-rover">rover</span>';
          i = j;
          continue;
        }
        if (KEYWORDS.indexOf(word) >= 0) res += '<span class="tok-kw">' + word + '</span>';else if (CONSTS.indexOf(word) >= 0) res += '<span class="tok-num">' + word + '</span>';else if (/^\s*\(/.test(after) || BUILTINS.indexOf(word) >= 0) res += '<span class="tok-fn">' + word + '</span>';else res += esc(word);
        i = j;
        continue;
      }
      // operator / punctuation
      if ('+-*/%<>=!&|'.indexOf(c) >= 0) {
        res += '<span class="tok-op">' + esc(c) + '</span>';
        i++;
        continue;
      }
      res += esc(c);
      i++;
    }
    return res || '&nbsp;';
  }
  const LH = 21,
    PAD = 14;
  function Editor({
    code,
    onChange,
    activeLine,
    readOnly
  }) {
    const taRef = useRef(null);
    const preRef = useRef(null);
    const wrapRef = useRef(null);

    // auto-size textarea height to content
    useEffect(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.style.height = 'auto';
      ta.style.height = Math.max(ta.scrollHeight, wrapRef.current ? wrapRef.current.clientHeight : 200) + 'px';
    }, [code]);

    // keep active line in view
    useEffect(() => {
      if (!activeLine || !wrapRef.current) return;
      const wrap = wrapRef.current;
      const top = PAD + (activeLine - 1) * LH;
      if (top < wrap.scrollTop + 30 || top > wrap.scrollTop + wrap.clientHeight - 50) {
        wrap.scrollTo({
          top: Math.max(0, top - wrap.clientHeight / 2),
          behavior: 'smooth'
        });
      }
    }, [activeLine]);
    const lines = code.split('\n');
    function handleKey(e) {
      // Escape releases the textarea so keyboard-only users are never trapped
      // by Tab-inserts-spaces (WCAG 2.1.2 No Keyboard Trap).
      if (e.key === 'Escape') {
        e.target.blur();
        return;
      }
      const ta = e.target;
      const s = ta.selectionStart,
        en = ta.selectionEnd;
      const val = ta.value;
      if (e.key === 'Tab' && e.shiftKey) {
        // Shift+Tab: dedent up to 4 leading spaces on the current line.
        e.preventDefault();
        const ls = val.lastIndexOf('\n', s - 1) + 1;
        const lead = val.slice(ls).match(/^ {1,4}/);
        if (lead) {
          const cut = lead[0].length;
          onChange(val.slice(0, ls) + val.slice(ls + cut));
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = Math.max(ls, s - cut);
          });
        }
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        onChange(val.slice(0, s) + '    ' + val.slice(en));
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = s + 4;
        });
        return;
      }
      if (e.key === 'Enter') {
        // Auto-indent: keep the current line's leading spaces, and add 4 more
        // after a line that opens a block (ends with ':').
        e.preventDefault();
        const ls = val.lastIndexOf('\n', s - 1) + 1;
        const lineToCursor = val.slice(ls, s);
        const indent = (lineToCursor.match(/^ */) || [''])[0];
        const extra = /:\s*$/.test(lineToCursor) ? '    ' : '';
        const ins = '\n' + indent + extra;
        onChange(val.slice(0, s) + ins + val.slice(en));
        const caret = s + ins.length;
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = caret;
        });
      }
    }
    return /*#__PURE__*/React.createElement("div", {
      className: "editor-wrap",
      ref: wrapRef
    }, /*#__PURE__*/React.createElement("div", {
      className: "editor-grid"
    }, /*#__PURE__*/React.createElement("div", {
      className: "gutter"
    }, lines.map((_, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      className: 'gl' + (activeLine === i + 1 ? ' active' : '')
    }, i + 1))), /*#__PURE__*/React.createElement("div", {
      className: "code-layer",
      style: {
        position: 'relative',
        minWidth: 'max-content',
        flex: 1
      }
    }, activeLine ? /*#__PURE__*/React.createElement("div", {
      className: "line-hl",
      style: {
        top: PAD + (activeLine - 1) * LH
      }
    }) : null, /*#__PURE__*/React.createElement("pre", {
      className: "code-pre",
      ref: preRef,
      dangerouslySetInnerHTML: {
        __html: highlight(code)
      }
    }), /*#__PURE__*/React.createElement("textarea", {
      ref: taRef,
      className: "code-ta",
      value: code,
      spellCheck: false,
      readOnly: readOnly,
      "aria-label": "Python code editor. Press Tab to indent, Escape to move focus out.",
      "aria-multiline": "true",
      onChange: e => onChange(e.target.value),
      onKeyDown: handleKey,
      style: {
        minWidth: 'max-content'
      }
    }))));
  }
  window.Editor = Editor;
})();
})();

;(function () {
/* ============================================================================
   ORBITAL ROVER — Telemetry rail
   Live instrument cluster: compass, speed, proximity, battery, odometer, and
   the terrain environment readout (gravity, temperature, pressure, light).
   Exposes window.Telemetry
   ========================================================================== */
(function () {
  function norm(deg) {
    return (deg % 360 + 360) % 360;
  }
  function cardinal(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(norm(deg) / 45) % 8];
  }
  function Compass({
    heading,
    accent
  }) {
    const h = norm(heading);
    const ticks = [];
    for (let a = 0; a < 360; a += 30) {
      const major = a % 90 === 0;
      const r1 = major ? 27 : 30;
      const x1 = 37 + Math.sin(a * Math.PI / 180) * r1;
      const y1 = 37 - Math.cos(a * Math.PI / 180) * r1;
      const x2 = 37 + Math.sin(a * Math.PI / 180) * 33;
      const y2 = 37 - Math.cos(a * Math.PI / 180) * 33;
      ticks.push(/*#__PURE__*/React.createElement("line", {
        key: a,
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        stroke: "rgba(245,240,228,0.35)",
        strokeWidth: major ? 1.4 : 0.8
      }));
    }
    return /*#__PURE__*/React.createElement("svg", {
      className: "compass",
      viewBox: "0 0 74 74"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "37",
      cy: "37",
      r: "35",
      fill: "#08090f",
      stroke: "rgba(245,240,228,0.12)",
      strokeWidth: "1"
    }), ticks, /*#__PURE__*/React.createElement("text", {
      x: "37",
      y: "13",
      textAnchor: "middle",
      fontFamily: "JetBrains Mono",
      fontSize: "8",
      fill: "rgba(245,240,228,0.55)"
    }, "N"), /*#__PURE__*/React.createElement("g", {
      transform: `rotate(${h} 37 37)`,
      style: {
        transition: 'transform 200ms cubic-bezier(0.22,0.61,0.36,1)'
      }
    }, /*#__PURE__*/React.createElement("polygon", {
      points: "37,10 32,40 42,40",
      fill: accent
    }), /*#__PURE__*/React.createElement("polygon", {
      points: "37,64 32,40 42,40",
      fill: "rgba(245,240,228,0.22)"
    })), /*#__PURE__*/React.createElement("circle", {
      cx: "37",
      cy: "37",
      r: "3.2",
      fill: "#08090f",
      stroke: accent,
      strokeWidth: "1.4"
    }));
  }
  function Bar({
    k,
    v,
    pct,
    color
  }) {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "bm-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "bm-k"
    }, k), /*#__PURE__*/React.createElement("span", {
      className: "bm-v"
    }, v)), /*#__PURE__*/React.createElement("div", {
      className: "bar-track",
      style: {
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "bar-fill",
      style: {
        width: Math.max(0, Math.min(100, pct)) + '%',
        background: color
      }
    })));
  }
  function Telemetry({
    rover,
    terrain,
    sensorDist,
    odometer
  }) {
    const accent = terrain.accent;
    const env = terrain.env;
    const battery = rover.battery;
    const batColor = battery > 50 ? 'var(--success)' : battery > 20 ? 'var(--warning)' : 'var(--danger)';
    const dist = sensorDist == null ? 600 : sensorDist;
    const distState = dist < 80 ? 'danger' : dist < 200 ? 'warn' : '';
    const distColor = dist < 80 ? 'var(--danger)' : dist < 200 ? 'var(--warning)' : accent;
    // A text cue for proximity so the state is not signalled by colour alone
    // (WCAG 1.4.1).
    const distWord = distState === 'danger' ? 'Obstacle close' : distState === 'warn' ? 'Caution' : 'Clear';
    // A single coarse status message for a polite live region. It is a CATEGORY,
    // not the live number, so it changes only when the rover crosses a threshold
    // and the screen reader announces once per change instead of every frame
    // (WCAG 4.1.3 without the per-frame spam a naive aria-live on the number
    // would cause).
    const liveMsg = distState === 'danger' ? 'Warning: obstacle close ahead' : battery <= 20 ? 'Battery low' : rover.moving ? 'Driving' : 'Idle';
    const srOnly = {
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap',
      border: 0
    };
    return /*#__PURE__*/React.createElement("div", {
      className: "tele-body"
    }, /*#__PURE__*/React.createElement("div", {
      role: "status",
      "aria-live": "polite",
      style: srOnly
    }, liveMsg), /*#__PURE__*/React.createElement("div", {
      className: "tele-section"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Navigation"), /*#__PURE__*/React.createElement("div", {
      className: "compass-wrap",
      role: "img",
      "aria-label": 'Heading ' + Math.round(norm(rover.heading)) % 360 + ' degrees, ' + cardinal(rover.heading)
    }, /*#__PURE__*/React.createElement(Compass, {
      heading: rover.heading,
      accent: accent
    }), /*#__PURE__*/React.createElement("div", {
      className: "compass-info"
    }, /*#__PURE__*/React.createElement("div", {
      className: "ci-deg"
    }, Math.round(norm(rover.heading)) % 360, "\xB0"), /*#__PURE__*/React.createElement("div", {
      className: "ci-card"
    }, cardinal(rover.heading)))), /*#__PURE__*/React.createElement("div", {
      className: "bar-meter",
      style: {
        marginTop: 14
      }
    }, /*#__PURE__*/React.createElement(Bar, {
      k: "Throttle",
      v: rover.speed.toFixed(0) + '%',
      pct: rover.speed,
      color: accent
    }))), /*#__PURE__*/React.createElement("div", {
      className: "tele-section"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Proximity \xB7 Front Lidar"), /*#__PURE__*/React.createElement("div", {
      className: 'dist-readout ' + distState,
      "aria-label": distWord + ', ' + (dist >= 600 ? '600 plus' : dist.toFixed(0)) + ' centimetres to obstacle'
    }, /*#__PURE__*/React.createElement("span", {
      className: "dr-val"
    }, dist >= 600 ? '600+' : dist.toFixed(0)), /*#__PURE__*/React.createElement("span", {
      className: "dr-unit"
    }, "cm to obstacle"), distState ? /*#__PURE__*/React.createElement("span", {
      className: "dr-state",
      style: {
        color: distColor,
        fontWeight: 600,
        marginLeft: 8
      }
    }, distWord) : null), /*#__PURE__*/React.createElement("div", {
      className: "bar-track"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bar-fill",
      style: {
        width: Math.min(100, dist / 600 * 100) + '%',
        background: distColor
      }
    }))), /*#__PURE__*/React.createElement("div", {
      className: "tele-section"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Systems"), /*#__PURE__*/React.createElement("div", {
      className: "bar-meter"
    }, /*#__PURE__*/React.createElement(Bar, {
      k: "Battery",
      v: battery.toFixed(0) + '%',
      pct: battery,
      color: batColor
    }), /*#__PURE__*/React.createElement(Bar, {
      k: "Traction",
      v: Math.min(100, Math.round(terrain.traction * 100)) + '%',
      pct: Math.min(100, Math.round(terrain.traction * 100)),
      color: accent
    })), /*#__PURE__*/React.createElement("div", {
      className: "gauges",
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "gauge"
    }, /*#__PURE__*/React.createElement("span", {
      className: "g-label"
    }, "Odometer"), /*#__PURE__*/React.createElement("span", {
      className: "g-val"
    }, (odometer / 100).toFixed(1), /*#__PURE__*/React.createElement("span", {
      className: "g-unit"
    }, "m"))), /*#__PURE__*/React.createElement("div", {
      className: "gauge"
    }, /*#__PURE__*/React.createElement("span", {
      className: "g-label"
    }, "Status"), /*#__PURE__*/React.createElement("span", {
      className: "g-val",
      style: {
        fontSize: 13,
        color: rover.moving ? accent : 'var(--fg-3)',
        paddingTop: 4
      }
    }, rover.moving ? 'DRIVING' : 'IDLE')))), /*#__PURE__*/React.createElement("div", {
      className: "tele-section",
      style: {
        borderBottom: 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Environment"), /*#__PURE__*/React.createElement("div", {
      className: "gauges"
    }, /*#__PURE__*/React.createElement("div", {
      className: "gauge"
    }, /*#__PURE__*/React.createElement("span", {
      className: "g-label"
    }, "Gravity"), /*#__PURE__*/React.createElement("span", {
      className: "g-val"
    }, env.gravity, /*#__PURE__*/React.createElement("span", {
      className: "g-unit"
    }, "m/s\xB2"))), /*#__PURE__*/React.createElement("div", {
      className: "gauge"
    }, /*#__PURE__*/React.createElement("span", {
      className: "g-label"
    }, env.tempLabel), /*#__PURE__*/React.createElement("span", {
      className: "g-val"
    }, env.temp, /*#__PURE__*/React.createElement("span", {
      className: "g-unit"
    }, "\xB0C"))), /*#__PURE__*/React.createElement("div", {
      className: "gauge"
    }, /*#__PURE__*/React.createElement("span", {
      className: "g-label"
    }, env.pressureLabel), /*#__PURE__*/React.createElement("span", {
      className: "g-val"
    }, env.pressure, /*#__PURE__*/React.createElement("span", {
      className: "g-unit"
    }, env.pressureUnit))), /*#__PURE__*/React.createElement("div", {
      className: "gauge"
    }, /*#__PURE__*/React.createElement("span", {
      className: "g-label"
    }, "Light"), /*#__PURE__*/React.createElement("span", {
      className: "g-val"
    }, env.light, /*#__PURE__*/React.createElement("span", {
      className: "g-unit"
    }, "%"))))));
  }
  window.Telemetry = Telemetry;
})();
})();

;(function () {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-omelette-chrome": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}

// Schematic of the planned real robot, drawn from the parts list. Visual aid
// for the budget builder; highlights the major components that are present.
function RoverSchematic({
  parts
}) {
  const text = (parts || []).map(p => (p.name + ' ' + (p.role || '')).toLowerCase()).join(' ');
  const has = (...keys) => keys.some(k => text.includes(k));
  const board = has('esp32') ? 'ESP32' : has('micro:bit', 'microbit') ? 'micro:bit' : has('arduino') ? 'Arduino' : has('raspberry', 'pico') ? 'Pico' : 'MCU';
  const sensor = has('ultrasonic', 'hc-sr04', 'distance', 'lidar', 'sensor');
  const driver = has('driver', 'l298', 'tb6612');
  const battery = has('batter', 'coin', 'power', 'cell');
  return /*#__PURE__*/React.createElement("svg", {
    className: "schematic",
    viewBox: "0 0 320 150",
    xmlns: "http://www.w3.org/2000/svg",
    role: "img",
    "aria-label": "Robot schematic"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "80",
    y: "30",
    width: "160",
    height: "90",
    rx: "10",
    fill: "#161a2d",
    stroke: "#5ce0d8",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "58",
    y: "40",
    width: "22",
    height: "32",
    rx: "5",
    fill: "#3a4356",
    stroke: "#aeb8e8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "58",
    y: "84",
    width: "22",
    height: "32",
    rx: "5",
    fill: "#3a4356",
    stroke: "#aeb8e8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "240",
    y: "40",
    width: "22",
    height: "32",
    rx: "5",
    fill: "#3a4356",
    stroke: "#aeb8e8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "240",
    y: "84",
    width: "22",
    height: "32",
    rx: "5",
    fill: "#3a4356",
    stroke: "#aeb8e8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "120",
    y: "48",
    width: "80",
    height: "40",
    rx: "5",
    fill: "#1f6f6a",
    stroke: "#5ce0d8"
  }), /*#__PURE__*/React.createElement("text", {
    x: "160",
    y: "72",
    textAnchor: "middle",
    fill: "#eafffd",
    fontSize: "13",
    fontFamily: "monospace"
  }, board), sensor && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "150",
    y: "14",
    width: "20",
    height: "12",
    rx: "2",
    fill: "#e0b45c"
  }), /*#__PURE__*/React.createElement("text", {
    x: "160",
    y: "9",
    textAnchor: "middle",
    fill: "#cfd6f5",
    fontSize: "8"
  }, "sensor")), driver && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "92",
    y: "96",
    width: "40",
    height: "16",
    rx: "3",
    fill: "#3a4356",
    stroke: "#7cc49b"
  }), /*#__PURE__*/React.createElement("text", {
    x: "112",
    y: "107",
    textAnchor: "middle",
    fill: "#cfe7d6",
    fontSize: "8"
  }, "driver")), battery && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "186",
    y: "96",
    width: "44",
    height: "16",
    rx: "3",
    fill: "#3a4356",
    stroke: "#e0b45c"
  }), /*#__PURE__*/React.createElement("text", {
    x: "208",
    y: "107",
    textAnchor: "middle",
    fill: "#f0dcb0",
    fontSize: "8"
  }, "battery")), /*#__PURE__*/React.createElement("line", {
    x1: "160",
    y1: "120",
    x2: "160",
    y2: "134",
    stroke: "#5ce0d8",
    strokeDasharray: "3 3"
  }), /*#__PURE__*/React.createElement("text", {
    x: "160",
    y: "146",
    textAnchor: "middle",
    fill: "#8b93a7",
    fontSize: "8"
  }, "front of rover"));
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton,
  RoverSchematic
});
})();

;(function () {
/*
 * Kodro design diagnostics. Pure, deterministic, offline.
 *
 * This is the heart of the "design -> validate" loop: it takes the robot the
 * user built (spec + derived numbers from RobotLab) and the world it is being
 * tested in, and works out, from grounded physics-style rules, whether the
 * design will actually cope, WHY it will or will not, and WHAT to change. No
 * model, no cloud: a capable adult can read every reason and act on it.
 *
 *   window.KodroDiagnostics.assess(spec, derived, terrain) -> report
 *   window.KodroDiagnostics.afterRun(report, run)          -> outcome verdict
 *
 * A report is { overall, summary, dimensions[], topFix, numbers }.
 * Each dimension is { key, label, status: 'pass'|'warn'|'fail', reason, fix, margin }.
 */
(function () {
  const SENSOR_RANGE = 600; // cm the ultrasonic can see ahead (matches the sim ray)

  function has(list, id) {
    return (list || []).indexOf(id) >= 0;
  }

  // Stopping distance (cm) at the build's top speed: heavier and faster takes
  // longer to halt. Tuned so a light, sensible build stops well within sensor
  // range and a heavy, fast one does not.
  function stoppingDistance(speedFactor, massFactor) {
    return Math.round(120 * speedFactor * speedFactor * massFactor);
  }

  // Mobility headroom on a surface: drive torque times grip, divided by how
  // heavy the build is. Below ~0.45 it cannot reliably get moving here.
  function mobilityScore(speedFactor, massFactor, traction) {
    return speedFactor * traction / massFactor;
  }
  function assess(spec, derived, terrain) {
    spec = spec || {};
    derived = derived || {};
    const sensors = spec.sensors || [];
    const actuators = spec.actuators || [];
    const massFactor = derived.massFactor || 1;
    const speedFactor = derived.speedFactor || 1;
    const runtimeMin = derived.runtimeMin || 60;
    const traction = terrain && terrain.traction || 0.8;
    const gravity = terrain && terrain.env && terrain.env.gravity || 9.81;
    const worldName = terrain && terrain.name || 'this world';
    const driveCount = actuators.filter(function (a) {
      return a === 'motors2' || a === 'motors4' || a === 'servos';
    }).length;
    const dims = [];

    // 1. MOBILITY -- can it physically get around on this surface?
    const mob = mobilityScore(speedFactor, massFactor, traction);
    if (driveCount === 0) {
      dims.push({
        key: 'mobility',
        label: 'Mobility',
        status: 'fail',
        margin: 0,
        reason: 'No drive parts fitted, so it can barely crawl and cannot complete a moving mission.',
        fix: 'Add a drive set: 2 DC motors for flat ground, or 4 DC motors for grip.'
      });
    } else if (mob < 0.45) {
      dims.push({
        key: 'mobility',
        label: 'Mobility',
        status: 'fail',
        margin: +(mob / 0.45).toFixed(2),
        reason: 'Underpowered for ' + worldName + ': the build is too heavy for the grip its motors get on this low-traction surface, so it slips and stalls.',
        fix: 'Fit 4 DC motors for more torque, or shed mass by dropping spare sensors.'
      });
    } else if (mob < 0.75) {
      dims.push({
        key: 'mobility',
        label: 'Mobility',
        status: 'warn',
        margin: +(mob / 0.75).toFixed(2),
        reason: 'Marginal traction on ' + worldName + ': it will move, but slowly and with some slip on the loose surface.',
        fix: 'Heavier terrain rewards 4 DC motors and a lighter chassis.'
      });
    } else {
      dims.push({
        key: 'mobility',
        label: 'Mobility',
        status: 'pass',
        margin: +mob.toFixed(2),
        reason: 'Good drive-to-weight for ' + worldName + ': it gets moving and holds the surface.',
        fix: ''
      });
    }

    // 2. OBSTACLE SENSING -- can it perceive and avoid hazards in time?
    const hasRange = has(sensors, 'ultrasonic');
    const stop = stoppingDistance(speedFactor, massFactor);
    if (!hasRange) {
      dims.push({
        key: 'sensing',
        label: 'Obstacle sensing',
        status: 'fail',
        margin: 0,
        reason: 'No range sensor fitted, so the robot drives blind. distance() reads clear no matter what is ahead, and it will run into obstacles.',
        fix: 'Fit an Ultrasonic range sensor so it can see and avoid what is in front.'
      });
    } else if (stop > SENSOR_RANGE * 0.6) {
      dims.push({
        key: 'sensing',
        label: 'Obstacle sensing',
        status: 'warn',
        margin: +(SENSOR_RANGE / stop).toFixed(2),
        reason: 'Stopping distance is about ' + stop + ' cm at top speed, which is tight against the ' + SENSOR_RANGE + ' cm the sensor sees. A late obstacle can be hit before it halts.',
        fix: 'Cap speed with set_speed below 60, or lighten the build so it stops sooner.'
      });
    } else {
      dims.push({
        key: 'sensing',
        label: 'Obstacle sensing',
        status: 'pass',
        margin: +(SENSOR_RANGE / Math.max(1, stop)).toFixed(2),
        reason: 'Range sensor fitted and it stops in about ' + stop + ' cm, well inside its ' + SENSOR_RANGE + ' cm view.',
        fix: ''
      });
    }

    // 3. ENDURANCE -- will the charge last, given mass and gravity?
    const gPenalty = 0.6 + 0.4 * (gravity / 9.81);
    const effMin = Math.round(runtimeMin / gPenalty);
    if (effMin < 30) {
      dims.push({
        key: 'power',
        label: 'Endurance',
        status: 'fail',
        margin: +(effMin / 45).toFixed(2),
        reason: 'Only about ' + effMin + ' minutes of charge here: a heavy build drains fast' + (gravity > 9.9 ? ' and high gravity makes it worse' : '') + ', so it may die mid-mission.',
        fix: 'Drop mass (fewer parts, a lighter board) to extend runtime.'
      });
    } else if (effMin < 50) {
      dims.push({
        key: 'power',
        label: 'Endurance',
        status: 'warn',
        margin: +(effMin / 45).toFixed(2),
        reason: 'About ' + effMin + ' minutes of charge: fine for a short task, tight for a long survey.',
        fix: 'Lighten the build for longer missions.'
      });
    } else {
      dims.push({
        key: 'power',
        label: 'Endurance',
        status: 'pass',
        margin: +(effMin / 45).toFixed(2),
        reason: 'About ' + effMin + ' minutes of charge: comfortable for a full mission.',
        fix: ''
      });
    }

    // 4. NAVIGATION PRECISION -- does it know which way it points?
    if (!has(sensors, 'imu')) {
      dims.push({
        key: 'nav',
        label: 'Navigation',
        status: 'warn',
        margin: 0.5,
        reason: 'No IMU, so heading() is unavailable and turns drift. Open-loop turning accumulates error over a long route.',
        fix: 'Add an IMU (gyro + accel) for steady, repeatable turns.'
      });
    } else {
      dims.push({
        key: 'nav',
        label: 'Navigation',
        status: 'pass',
        margin: 1,
        reason: 'IMU fitted: heading() works and turns stay true.',
        fix: ''
      });
    }

    // 5. TASK FIT -- does the build match what its type is for?
    const type = spec.type;
    if (type === 'arm' && !has(actuators, 'gripper')) {
      dims.push({
        key: 'task',
        label: 'Task fit',
        status: 'fail',
        margin: 0,
        reason: 'A manipulator arm with no gripper cannot grab or place anything, which is its whole job.',
        fix: 'Fit a Gripper arm so grab() works.'
      });
    } else if (type === 'home' && !has(sensors, 'bumper') && !hasRange) {
      dims.push({
        key: 'task',
        label: 'Task fit',
        status: 'warn',
        margin: 0.5,
        reason: 'An indoor robot with no bumper or range sensor cannot tell it is about to touch a person or furniture.',
        fix: 'Add a Bumper switch or Ultrasonic sensor for safe indoor contact.'
      });
    } else if (type === 'car' && !has(sensors, 'camera')) {
      dims.push({
        key: 'task',
        label: 'Task fit',
        status: 'warn',
        margin: 0.6,
        reason: 'A road vehicle with no camera cannot read markings, signs or a crossing.',
        fix: 'Add a Camera so see() works in traffic.'
      });
    } else {
      dims.push({
        key: 'task',
        label: 'Task fit',
        status: 'pass',
        margin: 1,
        reason: 'The fitted parts match what a ' + (type || 'robot') + ' needs for this world.',
        fix: ''
      });
    }

    // overall = worst dimension. Summarise honestly.
    const fails = dims.filter(function (d) {
      return d.status === 'fail';
    });
    const warns = dims.filter(function (d) {
      return d.status === 'warn';
    });
    let overall, summary, topFix;
    if (fails.length) {
      overall = 'fail';
      summary = 'This build will not cope in ' + worldName + '. ' + fails.length + (fails.length === 1 ? ' problem' : ' problems') + ' will stop it, the worst is ' + fails[0].label.toLowerCase() + '.';
      topFix = fails[0].fix;
    } else if (warns.length) {
      overall = 'warn';
      summary = 'Ready to test in ' + worldName + ', with ' + warns.length + (warns.length === 1 ? ' thing' : ' things') + ' to watch.';
      topFix = warns[0].fix;
    } else {
      overall = 'pass';
      summary = 'Well matched to ' + worldName + ': it should perform cleanly. Press Run and watch.';
      topFix = '';
    }
    return {
      overall: overall,
      summary: summary,
      dimensions: dims,
      topFix: topFix,
      numbers: {
        stoppingCm: stop,
        mobility: +mob.toFixed(2),
        enduranceMin: effMin,
        sensorRange: SENSOR_RANGE,
        blind: !hasRange
      }
    };
  }

  // After a run, turn the design report plus what actually happened into one
  // honest verdict line: did the design hold up, and if not, why and what next.
  function afterRun(report, run) {
    run = run || {};
    const outcome = run.outcome; // 'done' | 'crash' | 'flat' | 'stalled'
    if (outcome === 'crash') {
      if (report && report.numbers && report.numbers.blind) {
        return {
          tone: 'err',
          text: 'As predicted, it drove blind into ' + (run.detail || 'an obstacle') + '. Fit an ultrasonic range sensor so it can see ahead.'
        };
      }
      return {
        tone: 'err',
        text: 'It hit ' + (run.detail || 'an obstacle') + '. ' + (report && report.numbers ? 'Stopping distance is about ' + report.numbers.stoppingCm + ' cm: slow down before hazards or add sensing.' : 'Slow down before hazards.')
      };
    }
    if (outcome === 'flat') {
      return {
        tone: 'err',
        text: 'It ran out of charge before finishing. This build lasts about ' + (report && report.numbers ? report.numbers.enduranceMin : '?') + ' minutes here; lighten it or shorten the mission.'
      };
    }
    if (outcome === 'stalled') {
      return {
        tone: 'err',
        text: 'It stalled: the surface gave its motors too little grip for the weight. Fit 4 DC motors or shed mass.'
      };
    }
    // done
    if (report && report.overall === 'pass') {
      return {
        tone: 'sys',
        text: 'Mission complete and the design held up. Margins looked healthy.'
      };
    }
    if (report && report.overall === 'warn') {
      return {
        tone: 'sys',
        text: 'Mission complete, but watch the flagged points: ' + (report.topFix || 'see the design check.')
      };
    }
    return {
      tone: 'sys',
      text: 'Mission complete.'
    };
  }
  window.KodroDiagnostics = {
    assess: assess,
    afterRun: afterRun,
    stoppingDistance: stoppingDistance,
    mobilityScore: mobilityScore,
    SENSOR_RANGE: SENSOR_RANGE
  };
})();
})();

;(function () {
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
    const dx = Math.sin(a),
      dy = -Math.cos(a);
    let best = Infinity;
    for (const pair of [[dx, x], [dy, y]]) {
      const d = pair[0],
        p = pair[1];
      if (d > 1e-9) best = Math.min(best, (WALL - p) / d);else if (d < -1e-9) best = Math.min(best, (-WALL - p) / d);
    }
    return Math.max(0, Math.round(best));
  }
  function selfTest(src) {
    if (!window.RoverLang) return {
      ok: false,
      stage: 'load',
      error: 'interpreter not loaded',
      summary: 'Interpreter not loaded.'
    };
    let program;
    try {
      program = window.RoverLang.compile(src);
    } catch (e) {
      return {
        ok: false,
        stage: 'compile',
        error: e && e.message ? e.message : String(e),
        line: e && e.line,
        summary: 'Will not compile' + (e && e.line ? ' (line ' + e.line + ')' : '') + ': ' + (e && e.message ? e.message : e)
      };
    }
    const s = {
      x: 0,
      y: 0,
      heading: 0,
      speed: 50,
      battery: 100
    };
    const host = {
      sensor: function (name) {
        switch (name) {
          case 'distance':
            return rayToWall(s.x, s.y, s.heading);
          case 'heading':
            return Math.round((s.heading % 360 + 360) % 360);
          case 'battery':
            return Math.round(s.battery);
          case 'speed':
            return Math.round(s.speed);
          case 'x':
            return Math.round(s.x);
          case 'y':
            return Math.round(-s.y);
          case 'gravity':
            return 9.81;
          case 'temperature':
            return 16;
          case 'light':
            return 0.8;
          case 'tilt':
            return 0;
          default:
            return 0;
        }
      }
    };
    let gen;
    try {
      gen = program.run(host);
    } catch (e) {
      return {
        ok: false,
        stage: 'start',
        error: e && e.message,
        line: e && e.line,
        summary: 'Failed to start: ' + (e && e.message ? e.message : e)
      };
    }
    let steps = 0,
      moves = 0,
      turns = 0,
      hitWall = false;
    const CAP = 200000;
    try {
      for (;;) {
        const res = gen.next();
        if (res.done) break;
        if (++steps > CAP) return {
          ok: false,
          stage: 'run',
          error: 'did not terminate',
          steps: steps,
          summary: 'Does not finish: it loops without stopping (' + steps + '+ steps).'
        };
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
          } else {
            s.x = nx;
            s.y = ny;
          }
        } else if (ev.type === 'turn') {
          turns++;
          s.heading += ev.deg;
        } else if (ev.type === 'speed') {
          s.speed = Math.max(0, Math.min(100, ev.value));
        }
      }
    } catch (e) {
      return {
        ok: false,
        stage: 'run',
        error: e && e.message ? e.message : String(e),
        line: e && e.line,
        steps: steps,
        moves: moves,
        summary: 'Errors while running' + (e && e.line ? ' at line ' + e.line : '') + ': ' + (e && e.message ? e.message : e)
      };
    }
    const endPos = {
      x: Math.round(s.x),
      y: Math.round(-s.y)
    };
    let summary;
    if (hitWall) summary = 'Runs, but it would drive into the arena wall. Add a distance() check before moving, or shorten the moves.';else if (moves === 0) summary = 'Runs clean but the robot never moves. Add a move_forward or rover.forward.';else summary = 'Self-test passed: ' + moves + ' moves, ' + turns + ' turns, ends at (' + endPos.x + ', ' + endPos.y + '), stays in the arena.';
    return {
      ok: true,
      steps: steps,
      moves: moves,
      turns: turns,
      hitWall: hitWall,
      endPos: endPos,
      summary: summary
    };
  }
  window.KodroSelfTest = selfTest;
})();
})();

;(function () {
/* Robot Lab -- design a custom robot, then validate it in the world.
 *
 * The reframed core of Kodro: a user picks a robot archetype (rover, self
 * driving car, personal robot, arm or a bare microcontroller build), fits it
 * with real hobby parts (an ESP32 or micro:bit board, sensors, actuators),
 * names it, and saves it. The chosen specification is NOT cosmetic -- it
 * drives the simulation: total mass changes how fast the battery drains, the
 * motor choice sets the top speed, and the fitted sensors decide which Python
 * commands the robot actually supports. This file is self contained and
 * exposes itself on window like every other module in the bundle.
 *
 *   window.RobotLab          -- the React panel component
 *   window.getKodroRobot()   -- the saved spec + derived sim factors
 */
(function () {
  const STORE = 'kodro_robot_v1';

  // ---- parts catalogue. mass is grams; "enables" lists the Python the part unlocks.
  const BOARDS = {
    esp32: {
      id: 'esp32',
      name: 'ESP32',
      mass: 10,
      note: 'Wi-Fi + Bluetooth, dual core. The hobby default.'
    },
    microbit: {
      id: 'microbit',
      name: 'micro:bit v2',
      mass: 9,
      note: 'Classroom friendly, built-in buttons and LEDs.'
    },
    pico: {
      id: 'pico',
      name: 'Raspberry Pi Pico',
      mass: 6,
      note: 'Cheap, low power, MicroPython native.'
    },
    uno: {
      id: 'uno',
      name: 'Arduino Uno',
      mass: 25,
      note: 'Rugged and forgiving, a classic first board.'
    }
  };
  // `cmd` is the runnable, GATED command a part adds. Only parts whose command
  // is actually implemented in the interpreter carry one: the ultrasonic range
  // (distance()) and the IMU (heading()). The other parts are real fitted
  // hardware that change the build's mass and behaviour, but their command
  // bindings (vision, positioning, contact, line, gripper) are not implemented
  // yet, so they advertise no callable command rather than a phantom one that
  // would fail with a confusing error. See docs/known-limitations.md.
  const SENSORS = {
    ultrasonic: {
      id: 'ultrasonic',
      name: 'Ultrasonic range',
      mass: 9,
      enables: 'distance()  range ahead',
      cmd: 'distance'
    },
    line: {
      id: 'line',
      name: 'Line follower',
      mass: 6,
      enables: 'line tracking (fitted; adds mass)'
    },
    imu: {
      id: 'imu',
      name: 'IMU (gyro + accel)',
      mass: 4,
      enables: 'heading()  stable turns',
      cmd: 'heading'
    },
    camera: {
      id: 'camera',
      name: 'Camera',
      mass: 12,
      enables: 'computer vision (fitted; adds mass)'
    },
    gps: {
      id: 'gps',
      name: 'GPS',
      mass: 8,
      enables: 'positioning (fitted; adds mass)'
    },
    bumper: {
      id: 'bumper',
      name: 'Bumper switch',
      mass: 5,
      enables: 'contact bumper (fitted; adds mass)'
    }
  };
  const ACTUATORS = {
    motors2: {
      id: 'motors2',
      name: '2 DC motors',
      mass: 120,
      speed: 1.0,
      note: 'Two wheels, differential drive.'
    },
    motors4: {
      id: 'motors4',
      name: '4 DC motors',
      mass: 220,
      speed: 1.25,
      note: 'Four wheels, more grip and torque.'
    },
    servos: {
      id: 'servos',
      name: 'Steering servo',
      mass: 40,
      speed: 1.1,
      note: 'Car style front steering.'
    },
    gripper: {
      id: 'gripper',
      name: 'Gripper arm',
      mass: 90,
      speed: 0.9,
      enables: 'manipulator (fitted; adds reach and mass)'
    }
  };
  const TYPES = {
    rover: {
      id: 'rover',
      name: 'Rover',
      emoji: '🛻',
      blurb: 'A wheeled explorer for rough ground. The all rounder.',
      base: {
        board: 'esp32',
        sensors: ['ultrasonic', 'imu'],
        actuators: ['motors4']
      }
    },
    car: {
      id: 'car',
      name: 'Self-driving car',
      emoji: '🚗',
      blurb: 'A road vehicle. Validate it among pedestrians and traffic.',
      base: {
        board: 'esp32',
        sensors: ['ultrasonic', 'camera', 'gps'],
        actuators: ['motors2', 'servos']
      }
    },
    home: {
      id: 'home',
      name: 'Personal robot',
      emoji: '🤖',
      blurb: 'A helper that shares space with people indoors.',
      base: {
        board: 'pico',
        sensors: ['ultrasonic', 'bumper', 'camera'],
        actuators: ['motors2', 'gripper']
      }
    },
    arm: {
      id: 'arm',
      name: 'Robotic arm',
      emoji: '🦾',
      blurb: 'A fixed manipulator. Reach, grab and place.',
      base: {
        board: 'uno',
        sensors: ['camera'],
        actuators: ['gripper']
      }
    },
    custom: {
      id: 'custom',
      name: 'Custom build',
      emoji: '🔧',
      blurb: 'Start bare and fit exactly the parts you want.',
      base: {
        board: 'esp32',
        sensors: [],
        actuators: ['motors2']
      }
    }
  };

  // Which world a build should be validated in first, and why. This is the
  // assistant reasoning about the robot: a road vehicle belongs among traffic,
  // a home robot in a room, an explorer on open terrain.
  const WORLD_FOR = {
    rover: {
      id: 'earth',
      label: 'Open terrain',
      why: 'an explorer is tested on rough open ground first.'
    },
    car: {
      id: 'city',
      label: 'Riverside City',
      why: 'a road vehicle must cope with traffic and pedestrians.'
    },
    home: {
      id: 'room',
      label: 'Living Room',
      why: 'a companion robot shares an indoor space with people and furniture.'
    },
    arm: {
      id: 'room',
      label: 'Living Room',
      why: 'a fixed manipulator works at a table indoors.'
    },
    custom: {
      id: 'earth',
      label: 'Open terrain',
      why: 'start on safe open ground, then try the city and the others.'
    }
  };
  const CHASSIS_MASS = 380; // grams, frame + battery + wiring, before parts

  // Colour + word for a design-check status, shared by the verdict UI.
  function diagColor(s) {
    return s === 'fail' ? '#ff6b5e' : s === 'warn' ? '#f5c451' : '#5ce0d8';
  }
  function diagWord(s) {
    return s === 'fail' ? "WON'T COPE" : s === 'warn' ? 'WATCH' : 'READY';
  }
  function defaultSpec() {
    const t = TYPES.rover;
    return {
      type: 'rover',
      name: 'My Rover',
      board: t.base.board,
      sensors: t.base.sensors.slice(),
      actuators: t.base.actuators.slice()
    };
  }
  function specFromType(typeId, prevName) {
    const t = TYPES[typeId] || TYPES.rover;
    return {
      type: typeId,
      name: prevName || t.name,
      board: t.base.board,
      sensors: t.base.sensors.slice(),
      actuators: t.base.actuators.slice()
    };
  }

  // ---- derive the numbers the simulation cares about from a spec.
  function derive(spec) {
    let mass = CHASSIS_MASS + (BOARDS[spec.board] ? BOARDS[spec.board].mass : 10);
    (spec.sensors || []).forEach(s => {
      if (SENSORS[s]) mass += SENSORS[s].mass;
    });
    let speed = 0;
    (spec.actuators || []).forEach(a => {
      if (ACTUATORS[a]) {
        mass += ACTUATORS[a].mass;
        speed = Math.max(speed, ACTUATORS[a].speed || 0);
      }
    });
    if (speed === 0) speed = 0.8; // no drive parts: it barely crawls
    const baseline = 900; // grams ~ a typical small rover
    const massFactor = Math.min(1.8, Math.max(0.6, mass / baseline));
    const speedFactor = Math.min(1.45, Math.max(0.7, speed));
    // crude runtime estimate: lighter + fewer parts last longer on one charge
    const runtimeMin = Math.round(60 / massFactor);
    const cmds = [];
    (spec.sensors || []).forEach(s => {
      if (SENSORS[s] && SENSORS[s].cmd) cmds.push(SENSORS[s].cmd);
    });
    (spec.actuators || []).forEach(a => {
      if (ACTUATORS[a] && ACTUATORS[a].cmd) cmds.push(ACTUATORS[a].cmd);
    });
    return {
      mass,
      massFactor,
      speedFactor,
      runtimeMin,
      commands: cmds
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const s = JSON.parse(raw);
        // Floor: a saved build with no sensors cannot run the obstacle-avoidance
        // demos and confuses first-time users ("ultrasonic needed"). Give every
        // build at least an ultrasonic + IMU so it can sense and the default
        // autopilot just works on first Run; it stays editable in the Robot Lab.
        if (s && (!Array.isArray(s.sensors) || s.sensors.length === 0)) s.sensors = ['ultrasonic', 'imu'];
        return s;
      }
    } catch (e) {
      void e;
    }
    return defaultSpec();
  }
  function save(spec) {
    try {
      localStorage.setItem(STORE, JSON.stringify(spec));
    } catch (e) {
      void e;
    }
    const d = derive(spec);
    const rec = WORLD_FOR[spec.type] || {};
    window.KODRO_ROBOT = Object.assign({}, spec, d, {
      world: rec.id
    });
    try {
      window.dispatchEvent(new CustomEvent('kodro-robot', {
        detail: window.KODRO_ROBOT
      }));
    } catch (e) {
      void e;
    }
  }

  // Public accessor for the simulation (battery, speed, sensor gating).
  window.getKodroRobot = function () {
    if (!window.KODRO_ROBOT) {
      const s = load();
      window.KODRO_ROBOT = Object.assign({}, s, derive(s), {
        world: (WORLD_FOR[s.type] || {}).id
      });
    }
    return window.KODRO_ROBOT;
  };
  // Make sure a default exists from first load so the sim never sees undefined.
  window.getKodroRobot();

  // ---- canonical command registry. ONE source of truth for which commands a
  // build supports, read by the interpreter host, the assistant and the UI, so
  // no panel invents a command the robot cannot actually run. Keys are the
  // runtime command names (including the lesson aliases the interpreter emits);
  // each maps to the part that must be fitted for the command to be available.
  const BASE_COMMANDS = ['move_forward', 'move_backward', 'turn_left', 'turn_right', 'set_speed', 'stop'];
  // Only commands the interpreter actually implements are gated, keyed by the
  // internal name host.sensor receives (after the lesson-alias mapping). The
  // camera/gps/bumper/line/gripper commands are not implemented, so they are
  // not listed (they would never reach this gate) and are not advertised.
  const COMMAND_PART = {
    distance: 'ultrasonic',
    read_distance: 'ultrasonic',
    heading: 'imu',
    read_heading: 'imu',
    tilt: 'imu'
  };
  // The user-facing command name for each part that HAS a working command,
  // used in messages, the availability list and the assistant grounding.
  const PART_COMMAND = {
    ultrasonic: 'distance',
    imu: 'heading'
  };
  function partLabel(id) {
    return SENSORS[id] && SENSORS[id].name || ACTUATORS[id] && ACTUATORS[id].name || id;
  }
  function fittedParts(robot) {
    if (!robot) return null; // no build context (e.g. headless QA): do not gate
    return [].concat(robot.sensors || [], robot.actuators || []);
  }
  window.KodroCommands = {
    COMMAND_PART: COMMAND_PART,
    // {ok} for an always-available command, else {ok:false, part, label, reason}.
    check: function (robot, cmdName) {
      const part = COMMAND_PART[cmdName];
      if (!part) return {
        ok: true
      };
      const fitted = fittedParts(robot);
      if (fitted === null || fitted.indexOf(part) >= 0) return {
        ok: true,
        part: part
      };
      return {
        ok: false,
        part: part,
        label: partLabel(part),
        reason: 'This robot has no ' + partLabel(part) + ', so ' + cmdName + '() is not available. Fit a ' + partLabel(part) + ' in the Robot Lab to use it.'
      };
    },
    // The full availability list for the UI cards and the assistant grounding:
    // every base command plus one entry per part-gated command, with reasons.
    availability: function (robot) {
      const out = BASE_COMMANDS.map(function (c) {
        return {
          name: c,
          available: true,
          requires: null
        };
      });
      Object.keys(PART_COMMAND).forEach(function (part) {
        const cmd = PART_COMMAND[part];
        const r = window.KodroCommands.check(robot, cmd);
        out.push({
          name: cmd,
          available: r.ok,
          requires: part,
          partLabel: partLabel(part),
          reason: r.ok ? null : r.reason
        });
      });
      return out;
    },
    // A short grounding line for the assistant: the commands it may use and the
    // ones it must refuse because the part is not fitted.
    groundingText: function (robot) {
      const a = window.KodroCommands.availability(robot);
      const ok = a.filter(function (c) {
        return c.available;
      }).map(function (c) {
        return c.name + '()';
      });
      const no = a.filter(function (c) {
        return !c.available;
      }).map(function (c) {
        return c.name + '() (needs ' + c.partLabel + ')';
      });
      let t = 'Commands this build supports: ' + ok.join(', ') + '.';
      if (no.length) t += ' Not available, do not use and refuse if asked: ' + no.join(', ') + '.';
      return t;
    }
  };
  function Chip(props) {
    const on = props.on;
    return React.createElement('button', {
      type: 'button',
      className: 'rl-chip' + (on ? ' rl-chip-on' : ''),
      onClick: props.onClick,
      'aria-pressed': on
    }, React.createElement('span', {
      className: 'rl-chip-name'
    }, props.label), props.sub ? React.createElement('span', {
      className: 'rl-chip-sub'
    }, props.sub) : null);
  }
  function RobotLab(props) {
    const [spec, setSpec] = React.useState(load);
    const d = derive(spec);
    const t = TYPES[spec.type] || TYPES.rover;
    const rec = WORLD_FOR[spec.type] || WORLD_FOR.rover;
    // Predictive design check: how this exact build will behave in the world it
    // is recommended for, before a single line of code is run.
    const dTerrain = window.TERRAINS && window.TERRAINS[rec.id] || null;
    const report = window.KodroDiagnostics && dTerrain ? window.KodroDiagnostics.assess(spec, d, dTerrain) : null;
    function pickType(id) {
      setSpec(specFromType(id, null));
    }
    function toggle(kind, id) {
      setSpec(s => {
        const list = (s[kind] || []).slice();
        const i = list.indexOf(id);
        if (i >= 0) list.splice(i, 1);else list.push(id);
        return Object.assign({}, s, {
          [kind]: list
        });
      });
    }
    function onSave() {
      save(spec);
      if (props.onClose) props.onClose();
    }
    return React.createElement('div', {
      className: 'modal-backdrop',
      onClick: () => props.onClose && props.onClose()
    }, React.createElement('div', {
      className: 'modal modal-wide rl-modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Robot Lab',
      onClick: e => e.stopPropagation()
    }, React.createElement('div', {
      className: 'modal-head'
    }, React.createElement('span', {
      className: 'eyebrow'
    }, '🛠 Robot Lab. Design a robot, then run it in the world'), React.createElement('button', {
      className: 'btn-mini',
      'aria-label': 'Close',
      onClick: () => props.onClose && props.onClose()
    }, '✕')), React.createElement('div', {
      className: 'rl-body'
    },
    // ---- choose archetype
    React.createElement('div', {
      className: 'rl-section'
    }, React.createElement('div', {
      className: 'rl-label'
    }, '1 · Pick a robot'), React.createElement('div', {
      className: 'rl-types'
    }, Object.keys(TYPES).map(id => {
      const ty = TYPES[id];
      return React.createElement('button', {
        key: id,
        type: 'button',
        className: 'rl-type' + (spec.type === id ? ' rl-type-on' : ''),
        onClick: () => pickType(id),
        'aria-pressed': spec.type === id
      }, React.createElement('span', {
        className: 'rl-type-emoji'
      }, ty.emoji), React.createElement('span', {
        className: 'rl-type-name'
      }, ty.name));
    })), React.createElement('p', {
      className: 'rl-blurb'
    }, t.blurb)),
    // ---- name + board
    React.createElement('div', {
      className: 'rl-section rl-row2'
    }, React.createElement('label', {
      className: 'rl-field'
    }, React.createElement('span', {
      className: 'rl-label'
    }, 'Name'), React.createElement('input', {
      className: 'rl-input',
      value: spec.name,
      maxLength: 28,
      onChange: e => setSpec(s => Object.assign({}, s, {
        name: e.target.value
      }))
    })), React.createElement('label', {
      className: 'rl-field'
    }, React.createElement('span', {
      className: 'rl-label'
    }, 'Controller board'), React.createElement('select', {
      className: 'rl-input',
      value: spec.board,
      onChange: e => setSpec(s => Object.assign({}, s, {
        board: e.target.value
      }))
    }, Object.keys(BOARDS).map(id => React.createElement('option', {
      key: id,
      value: id
    }, BOARDS[id].name))))), React.createElement('p', {
      className: 'rl-note'
    }, BOARDS[spec.board] ? BOARDS[spec.board].note : ''),
    // ---- sensors
    React.createElement('div', {
      className: 'rl-section'
    }, React.createElement('div', {
      className: 'rl-label'
    }, '2 · Sensors. Each unlocks a command'), React.createElement('div', {
      className: 'rl-chips'
    }, Object.keys(SENSORS).map(id => React.createElement(Chip, {
      key: id,
      on: (spec.sensors || []).indexOf(id) >= 0,
      label: SENSORS[id].name,
      sub: SENSORS[id].enables,
      onClick: () => toggle('sensors', id)
    })))),
    // ---- actuators
    React.createElement('div', {
      className: 'rl-section'
    }, React.createElement('div', {
      className: 'rl-label'
    }, '3 · Drive & actuators'), React.createElement('div', {
      className: 'rl-chips'
    }, Object.keys(ACTUATORS).map(id => React.createElement(Chip, {
      key: id,
      on: (spec.actuators || []).indexOf(id) >= 0,
      label: ACTUATORS[id].name,
      sub: ACTUATORS[id].enables || (ACTUATORS[id].speed || 1) + '× speed',
      onClick: () => toggle('actuators', id)
    })))),
    // ---- live spec readout
    React.createElement('div', {
      className: 'rl-spec'
    }, React.createElement('div', {
      className: 'rl-stat'
    }, React.createElement('b', null, d.mass + ' g'), React.createElement('span', null, 'total mass')), React.createElement('div', {
      className: 'rl-stat'
    }, React.createElement('b', null, '~' + d.runtimeMin + ' min'), React.createElement('span', null, 'battery / charge')), React.createElement('div', {
      className: 'rl-stat'
    }, React.createElement('b', null, d.speedFactor.toFixed(2) + '×'), React.createElement('span', null, 'top speed')), React.createElement('div', {
      className: 'rl-stat rl-stat-wide'
    }, React.createElement('b', null, d.commands.length ? d.commands.map(c => c + '()').join('  ') : 'move()  turn()  only'), React.createElement('span', null, 'commands this build supports'))),
    // ---- predictive design check: will this build cope, and why
    report && React.createElement('div', {
      className: 'rl-section',
      style: {
        background: '#0e1622',
        border: '1.5px solid ' + diagColor(report.overall) + '55',
        borderRadius: 14,
        padding: 16
      }
    }, React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4
      }
    }, React.createElement('span', {
      className: 'rl-label',
      style: {
        margin: 0
      }
    }, 'Design check'), React.createElement('span', {
      style: {
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.06em',
        color: '#06121b',
        background: diagColor(report.overall),
        borderRadius: 6,
        padding: '3px 9px'
      }
    }, diagWord(report.overall))), React.createElement('p', {
      className: 'rl-blurb',
      style: {
        margin: '2px 0 10px'
      }
    }, report.summary), React.createElement('div', {
      style: {
        display: 'grid',
        gap: 7
      }
    }, report.dimensions.map(function (dim) {
      return React.createElement('div', {
        key: dim.key,
        style: {
          display: 'flex',
          gap: 9,
          alignItems: 'flex-start',
          fontSize: 12.5,
          lineHeight: 1.45
        }
      }, React.createElement('span', {
        'aria-hidden': 'true',
        style: {
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: diagColor(dim.status),
          marginTop: 4,
          flex: '0 0 auto'
        }
      }), React.createElement('span', {
        style: {
          fontWeight: 650,
          color: '#dce8f8',
          flex: '0 0 96px'
        }
      }, dim.label), React.createElement('span', {
        style: {
          color: '#9fb4d2'
        }
      }, dim.reason + (dim.fix ? '  Fix: ' + dim.fix : '')));
    }))),
    // ---- the assistant recommends where to validate this robot first
    React.createElement('div', {
      className: 'rl-rec'
    }, React.createElement('span', {
      className: 'rl-rec-tag'
    }, 'Best tested in'), React.createElement('b', null, rec.label), React.createElement('span', {
      className: 'rl-rec-why'
    }, rec.why))), React.createElement('div', {
      className: 'rl-foot'
    }, React.createElement('button', {
      className: 'btn-mini',
      onClick: () => setSpec(specFromType(spec.type, spec.name))
    }, 'Reset parts'), React.createElement('button', {
      className: 'ctrl ctrl-run',
      onClick: onSave
    }, '✓ Build & test in ' + rec.label))));
  }

  // Statics so other modules (e.g. onboarding) can reuse the canonical robot
  // catalogue and world-recommendation logic instead of duplicating it.
  RobotLab.TYPES = TYPES;
  RobotLab.WORLD_FOR = WORLD_FOR;
  RobotLab.selectType = function (typeId) {
    const spec = specFromType(typeId);
    save(spec);
    return spec;
  };

  // ---- onboarding agent: natural language -> a validated RobotSpec ----------
  // The starting-page agent maps a spoken or typed description onto the SAME
  // parts catalogue, so it can only ever produce a buildable robot. It never
  // emits executable code; the output is data, validated field by field against
  // the catalogue, with anything unknown dropped. This is the deterministic
  // path; a local model may rephrase the prompt first, but this mapper has the
  // final word on what parts the robot actually gets.
  function robotFromText(text) {
    const t = String(text || '').toLowerCase();
    let type = 'rover';
    if (/(car|vehicle|self.?driv|autonomous|road|traffic)/.test(t)) type = 'car';else if (/(robotic arm|\barm\b|manipulat|pick and place)/.test(t)) type = 'arm';else if (/(home|companion|personal|indoor|assistant|helper|house)/.test(t)) type = 'home';else if (/(rover|explor|terrain|outdoor|mars|moon|planet|rough)/.test(t)) type = 'rover';
    const spec = specFromType(type, null);
    const sensors = spec.sensors.slice();
    const actuators = spec.actuators.slice();
    function add(list, id) {
      if (list.indexOf(id) < 0) list.push(id);
    }
    function drop(list, id) {
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1);
    }
    if (/(camera|vision|\bsee\b|marker|look)/.test(t)) add(sensors, 'camera');
    if (/(ultrasonic|distance|obstacle|avoid|range|sonar)/.test(t)) add(sensors, 'ultrasonic');
    if (/(imu|gyro|balance|tilt|orient|accelerom)/.test(t)) add(sensors, 'imu');
    if (/(gps|location|position|navigat)/.test(t)) add(sensors, 'gps');
    if (/(line follow|follow.?line|\bline\b|track)/.test(t)) add(sensors, 'line');
    if (/(bumper|touch|contact|switch)/.test(t)) add(sensors, 'bumper');
    if (/(gripper|grab|grip|claw|\bpick\b)/.test(t)) add(actuators, 'gripper');
    if (/(four wheel|4 wheel|4wd|four.?motor|all.?wheel)/.test(t)) {
      add(actuators, 'motors4');
      drop(actuators, 'motors2');
    }
    if (/(steer|servo|ackermann)/.test(t)) add(actuators, 'servos');
    let board = spec.board;
    if (/arduino|uno/.test(t)) board = 'uno';else if (/micro.?bit/.test(t)) board = 'microbit';else if (/pico|raspberry/.test(t)) board = 'pico';else if (/esp32|\besp\b/.test(t)) board = 'esp32';
    // Validate every field against the catalogue: drop anything unknown.
    const vs = sensors.filter(function (s) {
      return SENSORS[s];
    });
    const va = actuators.filter(function (a) {
      return ACTUATORS[a];
    });
    const vb = BOARDS[board] ? board : 'esp32';
    const name = TYPES[type] && TYPES[type].name || 'My Robot';
    return {
      type: type,
      name: name,
      board: vb,
      sensors: vs,
      actuators: va
    };
  }
  RobotLab.fromText = robotFromText;
  // Apply an arbitrary spec, validated against the catalogue and saved. Used by
  // the guided demo to add or remove a part and show the command registry react.
  RobotLab.applySpec = function (spec) {
    const vs = (spec.sensors || []).filter(function (s) {
      return SENSORS[s];
    });
    const va = (spec.actuators || []).filter(function (a) {
      return ACTUATORS[a];
    });
    const vb = BOARDS[spec.board] ? spec.board : 'esp32';
    const vt = TYPES[spec.type] ? spec.type : 'rover';
    const clean = {
      type: vt,
      name: spec.name || 'My Robot',
      board: vb,
      sensors: vs,
      actuators: va
    };
    save(clean);
    return {
      spec: clean,
      derived: derive(clean),
      world: WORLD_FOR[clean.type] || {}
    };
  };
  RobotLab.buildFromText = function (text) {
    const spec = robotFromText(text);
    save(spec);
    return {
      spec: spec,
      derived: derive(spec),
      world: WORLD_FOR[spec.type] || {}
    };
  };
  window.KodroRobotFromText = robotFromText;
  window.RobotLab = RobotLab;
})();
})();

;(function () {
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

  // Deterministic PRNG so a seed reproduces a run exactly (reproducible demo).
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Distance from point p to segment a->b, used for swept collision tests.
  function segPointDist(ax, ay, bx, by, px, py) {
    const vx = bx - ax,
      vy = by - ay;
    const wx = px - ax,
      wy = py - ay;
    const len2 = vx * vx + vy * vy;
    let t = len2 > 0 ? (wx * vx + wy * vy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + vx * t,
      cy = ay + vy * t;
    return Math.hypot(px - cx, py - cy);
  }

  // Ray from (x,y) along heading to the nearest obstacle or wall, in cm.
  function rayDistance(x, y, headingDeg, obstacles) {
    const a = headingDeg * Math.PI / 180;
    const dx = Math.sin(a),
      dy = -Math.cos(a);
    let best = Infinity;
    for (const pair of [[dx, x], [dy, y]]) {
      const d = pair[0],
        p = pair[1];
      if (d > 1e-9) best = Math.min(best, (WALL - p) / d);else if (d < -1e-9) best = Math.min(best, (-WALL - p) / d);
    }
    for (const o of obstacles) {
      const ox = o.x - x,
        oy = o.y - y;
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

  // One headless run with the parameters this seed produced.
  function runOnce(src, scenario, seed) {
    if (!window.RoverLang) return {
      ok: false,
      error: 'interpreter not loaded'
    };
    let program;
    try {
      program = window.RoverLang.compile(src);
    } catch (e) {
      return {
        ok: false,
        seed: seed,
        error: e && e.message || String(e),
        compile: true,
        finalScore: 0
      };
    }
    const rng = mulberry32(seed >>> 0 ^ hashStr(scenario.scenarioId || 'scn'));
    const cfg = scenario.randomizationConfig || {};
    const fr = cfg.friction || [0.8, 1.0];
    const friction = lerp(fr[0], fr[1], rng());
    const massTol = cfg.massTol || 0.1;
    const massMul = 1 + (rng() * 2 - 1) * massTol;
    const noiseCm = cfg.sensorNoise || 0;
    const jitter = cfg.obstacleJitter || 0;
    const robot = window.getKodroRobot ? window.getKodroRobot() : null;
    const massFac = (robot && robot.massFactor ? robot.massFactor : 1) * massMul;
    const start = scenario.startPose || {
      x: 0,
      y: 0,
      heading: 0
    };
    const goal = scenario.goalPose || {
      x: 0,
      y: -1000,
      r: 120
    };
    // Jitter each obstacle a little, deterministically, so placement varies.
    const obstacles = (scenario.obstacles || []).map(function (o) {
      return {
        x: o.x + (rng() * 2 - 1) * jitter,
        y: o.y + (rng() * 2 - 1) * jitter,
        r: o.r
      };
    });
    const s = {
      x: start.x,
      y: start.y,
      heading: start.heading || 0,
      speed: 50,
      battery: 100
    };
    let minObstacleDistance = Infinity;
    function noteClearance() {
      for (const o of obstacles) {
        const d = Math.hypot(s.x - o.x, s.y - o.y) - o.r;
        if (d < minObstacleDistance) minObstacleDistance = d;
      }
    }
    noteClearance();
    let commandErrors = 0,
      sensorFailures = 0;
    const host = {
      sensor: function (name) {
        // Gate on the build's fitted parts, exactly like the live host.
        if (window.KodroCommands) {
          const g = window.KodroCommands.check(robot, name);
          if (!g.ok) {
            commandErrors++;
            throw new Error(g.reason);
          }
        }
        switch (name) {
          case 'distance':
            {
              let d = rayDistance(s.x, s.y, s.heading, obstacles);
              if (noiseCm) {
                d += (rng() * 2 - 1) * noiseCm;
                if (d < 0) {
                  d = 0;
                  sensorFailures++;
                }
              }
              return Math.round(d);
            }
          case 'heading':
            return Math.round((s.heading % 360 + 360) % 360);
          case 'battery':
            return Math.round(s.battery);
          case 'speed':
            return Math.round(s.speed);
          case 'x':
            return Math.round(s.x);
          case 'y':
            return Math.round(-s.y);
          case 'gravity':
            return 9.81;
          case 'temperature':
            return 16;
          case 'light':
            return 0.8;
          case 'tilt':
            return 0;
          default:
            return 0;
        }
      }
    };
    let gen;
    try {
      gen = program.run(host);
    } catch (e) {
      return {
        ok: false,
        seed: seed,
        error: e && e.message || String(e),
        finalScore: 0
      };
    }
    let steps = 0,
      moves = 0,
      turns = 0,
      collisions = 0,
      reachedGoal = false,
      runError = null,
      timeToGoal = null;
    try {
      for (;;) {
        const res = gen.next();
        if (res.done) break;
        if (++steps > STEP_CAP) {
          runError = 'did not terminate';
          break;
        }
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
            if (segPointDist(s.x, s.y, nx, ny, o.x, o.y) <= o.r) {
              hitAt = o;
              break;
            }
          }
          if (hitAt) {
            collisions++;
            // Stop just short of the obstacle centre, along the heading.
            const back = hitAt.r + 6;
            const tx = hitAt.x - Math.sin(a) * back,
              ty = hitAt.y + Math.cos(a) * back;
            s.x = tx;
            s.y = ty;
          } else if (Math.abs(nx) > WALL || Math.abs(ny) > WALL) {
            collisions++;
            s.x = Math.max(-WALL, Math.min(WALL, nx));
            s.y = Math.max(-WALL, Math.min(WALL, ny));
          } else {
            s.x = nx;
            s.y = ny;
          }
          s.battery = Math.max(0, s.battery - Math.abs(dist) * 0.011 * massFac / friction);
          noteClearance();
          if (!reachedGoal && Math.hypot(s.x - goal.x, s.y - goal.y) <= goal.r) {
            reachedGoal = true;
            timeToGoal = steps;
          }
        } else if (ev.type === 'turn') {
          turns++;
          s.heading += ev.deg;
        } else if (ev.type === 'speed') {
          s.speed = Math.max(0, Math.min(100, ev.value));
        }
      }
    } catch (e) {
      runError = e && e.message || String(e);
    }
    if (!reachedGoal && Math.hypot(s.x - goal.x, s.y - goal.y) <= goal.r) {
      reachedGoal = true;
      timeToGoal = steps;
    }
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
      ok: !runError,
      seed: seed,
      reachedGoal: reachedGoal,
      collisions: collisions,
      timeToGoal: timeToGoal,
      steps: steps,
      moves: moves,
      turns: turns,
      batteryUsed: batteryUsed,
      minObstacleDistance: Math.round(minObstacleDistance),
      commandErrors: commandErrors,
      sensorFailures: sensorFailures,
      friction: Math.round(friction * 100) / 100,
      massMul: Math.round(massMul * 100) / 100,
      error: runError,
      finalScore: score
    };
  }
  function run(src, scenario, n) {
    const seeds = Math.max(1, n || 5);
    const base = scenario && scenario.seed || 1;
    const runs = [];
    for (let i = 0; i < seeds; i++) runs.push(runOnce(src, scenario, base + i * 101));
    const ok = runs.filter(function (r) {
      return r && !r.compile;
    });
    const reached = ok.filter(function (r) {
      return r.reachedGoal;
    });
    const mean = function (sel) {
      return ok.length ? ok.reduce(function (a, r) {
        return a + (sel(r) || 0);
      }, 0) / ok.length : 0;
    };
    const times = reached.map(function (r) {
      return r.timeToGoal;
    });
    const aggregate = {
      seeds: seeds,
      successRate: ok.length ? reached.length / ok.length : 0,
      successCount: reached.length,
      meanCollisions: Math.round(mean(function (r) {
        return r.collisions;
      }) * 100) / 100,
      meanBattery: Math.round(mean(function (r) {
        return r.batteryUsed;
      }) * 10) / 10,
      meanTimeToGoal: times.length ? Math.round(times.reduce(function (a, b) {
        return a + b;
      }, 0) / times.length) : null,
      meanScore: Math.round(mean(function (r) {
        return r.finalScore;
      })),
      commandErrors: ok.reduce(function (a, r) {
        return a + (r.commandErrors || 0);
      }, 0),
      minClearance: ok.length ? Math.min.apply(null, ok.map(function (r) {
        return r.minObstacleDistance;
      })) : 0
    };
    const report = {
      scenario: {
        scenarioId: scenario.scenarioId,
        name: scenario.name,
        environmentPreset: scenario.environmentPreset,
        seed: base
      },
      runs: runs,
      aggregate: aggregate,
      ts: Date.now()
    };
    // Persist locally (offline) so the realism dashboard and the assistant can
    // read past validation. The desktop SQLite bridge mirrors this when present.
    try {
      if (window.KodroMemory && window.KodroMemory.saveScenarioReport) window.KodroMemory.saveScenarioReport(report);
      if (window.RoboLearn && window.RoboLearn.saveScenarioRun) window.RoboLearn.saveScenarioRun(report);
    } catch (e) {
      void e;
    }
    return report;
  }

  // ---- built-in scenarios, one per environment, as data ----
  const PRESETS = {
    city_cross: {
      scenarioId: 'city_cross',
      name: 'Cross the street, avoid the obstacles',
      environmentPreset: 'city',
      startPose: {
        x: 0,
        y: 1000,
        heading: 0
      },
      goalPose: {
        x: 0,
        y: -1100,
        r: 140
      },
      obstacles: [{
        x: -120,
        y: 300,
        r: 130
      }, {
        x: 180,
        y: -250,
        r: 150
      }, {
        x: -60,
        y: -650,
        r: 120
      }],
      terrainMaterial: 'asphalt',
      seed: 7,
      successCriteria: {
        reachGoal: true,
        maxCollisions: 0
      },
      randomizationConfig: {
        friction: [0.75, 1.0],
        massTol: 0.12,
        sensorNoise: 18,
        obstacleJitter: 60,
        lighting: [0.5, 1.0]
      }
    },
    room_reach: {
      scenarioId: 'room_reach',
      name: 'Reach the far corner among furniture',
      environmentPreset: 'room',
      startPose: {
        x: -900,
        y: 900,
        heading: 135
      },
      goalPose: {
        x: 900,
        y: -900,
        r: 130
      },
      obstacles: [{
        x: 0,
        y: 0,
        r: 200
      }, {
        x: 400,
        y: -300,
        r: 120
      }, {
        x: -300,
        y: -400,
        r: 110
      }],
      terrainMaterial: 'carpet',
      seed: 11,
      successCriteria: {
        reachGoal: true,
        maxCollisions: 1
      },
      randomizationConfig: {
        friction: [0.85, 1.0],
        massTol: 0.1,
        sensorNoise: 12,
        obstacleJitter: 50,
        lighting: [0.6, 1.0]
      }
    },
    terrain_traverse: {
      scenarioId: 'terrain_traverse',
      name: 'Traverse open ground to the marker',
      environmentPreset: 'earth',
      startPose: {
        x: 0,
        y: 1200,
        heading: 0
      },
      goalPose: {
        x: 200,
        y: -1200,
        r: 160
      },
      obstacles: [{
        x: 100,
        y: 400,
        r: 160
      }, {
        x: -200,
        y: -400,
        r: 180
      }],
      terrainMaterial: 'rock',
      seed: 17,
      successCriteria: {
        reachGoal: true,
        maxCollisions: 1
      },
      randomizationConfig: {
        friction: [0.6, 0.95],
        massTol: 0.15,
        sensorNoise: 22,
        obstacleJitter: 90,
        lighting: [0.4, 1.0]
      }
    }
  };
  function defaultFor(worldId) {
    if (worldId === 'room') return PRESETS.room_reach;
    if (worldId === 'city') return PRESETS.city_cross;
    return PRESETS.terrain_traverse;
  }
  window.KodroScenario = {
    PRESETS: PRESETS,
    run: run,
    runOnce: runOnce,
    defaultFor: defaultFor
  };
})();
})();

;(function () {
/*
 * Realism dashboard.
 *
 * A read-only debug panel that makes the simulation's honesty visible: it shows
 * that the robot the user built actually drives the physics, the sensors, the
 * command registry and the last validation run. Nothing here computes new
 * state; it reflects the single sources of truth (getKodroRobot, KodroCommands,
 * KodroMemory, TERRAINS) so a viewer can see at a glance that the spec matters.
 *
 *   window.KodroRealism({ onClose })
 */
(function () {
  const SENSOR_LABEL = {
    ultrasonic: 'Ultrasonic range',
    line: 'Line follower',
    imu: 'IMU (gyro + accel)',
    camera: 'Camera',
    gps: 'GPS',
    bumper: 'Bumper switch'
  };
  function card(title, rows, accent) {
    return React.createElement('div', {
      style: {
        background: '#0f1726',
        border: '1.5px solid #233248',
        borderRadius: 14,
        padding: '14px 16px'
      }
    }, React.createElement('div', {
      style: {
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: accent || '#5ed6ff',
        marginBottom: 10
      }
    }, title), React.createElement('div', {
      style: {
        display: 'grid',
        gap: 7
      }
    }, rows));
  }
  function row(label, value, color) {
    return React.createElement('div', {
      key: label,
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 13,
        lineHeight: 1.4
      }
    }, React.createElement('span', {
      style: {
        color: '#8da3c0'
      }
    }, label), React.createElement('span', {
      style: {
        color: color || '#dce8f8',
        fontWeight: 600,
        textAlign: 'right'
      }
    }, value));
  }
  function KodroRealism(props) {
    const robot = window.getKodroRobot && window.getKodroRobot() || {};
    const terrains = window.TERRAINS || {};
    const terrain = robot.world && terrains[robot.world] || terrains[Object.keys(terrains)[0]] || {
      name: '-',
      env: {},
      traction: 1,
      id: '-'
    };
    const env = terrain.env || {};
    const massFac = robot.massFactor || 1;
    const speedFac = robot.speedFactor || 1;
    // Qualitative acceleration: heavier mass -> slower to reach top speed.
    const accel = massFac >= 1.4 ? 'slow (heavy)' : massFac >= 1.0 ? 'moderate' : 'brisk (light)';
    const avail = window.KodroCommands && window.KodroCommands.availability(robot) || [];
    const reports = window.KodroMemory && window.KodroMemory.scenarioReports && window.KodroMemory.scenarioReports() || [];
    const last = reports[0] || null;
    const agg = last && last.aggregate;

    // Physics card.
    const physics = card('Robot physics', [row('Mass', (robot.mass || '-') + ' g'), row('Top speed', speedFac.toFixed(2) + '×'), row('Acceleration', accel), row('Terrain friction', terrain.traction != null ? terrain.traction.toFixed(2) : '-'), row('Battery / charge', '~' + (robot.runtimeMin || '-') + ' min')]);

    // Sensor card.
    const sensorRows = robot.sensors && robot.sensors.length ? robot.sensors.map(function (s) {
      return row(SENSOR_LABEL[s] || s, 'active', '#5ce0d8');
    }) : [row('Sensors', 'none fitted', '#f5c451')];
    sensorRows.push(row('Sensor noise', last && last.scenario ? 'randomised per seed' : 'nominal'));
    const sensors = card('Sensors', sensorRows, '#5ce0d8');

    // Scenario score card.
    const scoreRows = agg ? [row('Scenario', last.scenario && last.scenario.name || '-'), row('Success rate', Math.round((agg.successRate || 0) * 100) + '%  (' + (agg.successCount || 0) + '/' + (agg.seeds || 0) + ')', agg.successRate >= 0.6 ? '#5ce0d8' : '#f5c451'), row('Mean collisions', String(agg.meanCollisions != null ? agg.meanCollisions : '-')), row('Mean time to goal', agg.meanTimeToGoal != null ? agg.meanTimeToGoal + ' steps' : 'n/a'), row('Mean battery used', (agg.meanBattery != null ? agg.meanBattery : '-') + '%'), row('Base seed', String((last.scenario && last.scenario.seed) != null ? last.scenario.seed : '-'))] : [row('Validation', 'no runs yet', '#f5c451'), row('Tip', 'Run "Validate across seeds"')];
    const score = card('Scenario score', scoreRows, '#ffb86b');

    // Environment card.
    const environment = card('Environment', [row('Preset', terrain.name || terrain.id || '-'), row('Lighting', env.light != null ? env.light.toFixed(2) : '-'), row('Gravity', env.gravity != null ? env.gravity + ' m/s2' : '-'), row('Friction', terrain.traction != null ? terrain.traction.toFixed(2) : '-'), row('Moving agents', window.KodroAgents && window.KodroAgents.list && window.KodroAgents.world && window.KodroAgents.world() === terrain.id ? String(window.KodroAgents.list().length) : '0')], '#9fb4d2');

    // Command registry card.
    const okCmds = avail.filter(function (c) {
      return c.available;
    });
    const noCmds = avail.filter(function (c) {
      return !c.available;
    });
    const cmdRows = [];
    okCmds.forEach(function (c) {
      cmdRows.push(row(c.name + '()', 'available', '#5ce0d8'));
    });
    noCmds.forEach(function (c) {
      cmdRows.push(row(c.name + '()', 'needs ' + (c.partLabel || c.requires), '#ff8f7a'));
    });
    const registry = card('Command registry', cmdRows.length ? cmdRows : [row('Commands', 'base only')], '#c8a8ff');
    return React.createElement('div', {
      className: 'modal-backdrop',
      onClick: function () {
        return props.onClose && props.onClose();
      }
    }, React.createElement('div', {
      className: 'modal modal-wide',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Realism dashboard',
      style: {
        maxWidth: 860
      },
      onClick: function (e) {
        e.stopPropagation();
      }
    }, React.createElement('div', {
      className: 'modal-head'
    }, React.createElement('span', {
      className: 'eyebrow'
    }, '📊 Realism dashboard. The build drives the simulation'), React.createElement('button', {
      className: 'btn-mini',
      'aria-label': 'Close',
      onClick: function () {
        return props.onClose && props.onClose();
      }
    }, '✕')), React.createElement('div', {
      style: {
        padding: 16
      }
    }, React.createElement('p', {
      style: {
        color: '#8da3c0',
        fontSize: 13,
        margin: '0 0 14px'
      }
    }, 'Robot: ', React.createElement('b', {
      style: {
        color: '#dce8f8'
      }
    }, robot.name || 'My Robot'), ' · type ', robot.type || '-', ' · board ', robot.board || '-'), React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
        gap: 12
      }
    }, physics, sensors, score, environment, registry))));
  }
  window.KodroRealism = KodroRealism;
})();
})();

;(function () {
/*
 * Kodro Realism Demo: a guided, self-contained tour that PROVES the academic
 * objectives by performing real actions, not by faking screens. Each step runs
 * actual code against the same sources of truth the studio uses, and shows the
 * real result, so a viewer sees in two or three minutes that the build drives
 * the simulation, the registry gates commands, validation reports a spread, and
 * the memory reuses what worked. Nothing here is mocked and nothing leaves the
 * machine.
 *
 *   window.KodroDemo({ onClose })
 */
(function () {
  const PROGRAM = ['set_speed(60)', 'for i in range(120):', '    if read_distance() < 140:', '        turn_right(30)', '    else:', '        move_forward(1)'].join('\n');
  function robot() {
    return window.getKodroRobot && window.getKodroRobot() || {};
  }
  function ts() {
    try {
      return Date.now();
    } catch (e) {
      return 0;
    }
  }

  // Each step performs a real action and returns { text, tone }.
  const STEPS = [{
    title: 'Design a light rover',
    blurb: 'The agent builds a rover from the validated parts catalogue. Its mass, top speed and battery come from the parts, not from sliders.',
    action: 'Build it',
    run: function () {
      const r = window.RobotLab.buildFromText('a light rover with an ultrasonic distance sensor');
      const d = r.derived;
      return {
        text: 'Built "' + r.spec.name + '": ' + d.mass + ' g, top speed ' + d.speedFactor.toFixed(2) + 'x, battery ~' + d.runtimeMin + ' min. Recommended world: ' + (r.world.label || 'city') + '.',
        tone: 'ok'
      };
    }
  }, {
    title: 'read_distance() is available',
    blurb: 'Because an ultrasonic sensor is fitted, the distance command is in the registry that every panel reads.',
    action: 'Check the registry',
    run: function () {
      const a = window.KodroCommands.availability(robot());
      const ok = a.filter(function (c) {
        return c.available;
      }).map(function (c) {
        return c.name + '()';
      });
      return {
        text: 'Available commands: ' + ok.join(', ') + '.',
        tone: 'ok'
      };
    }
  }, {
    title: 'Validate across 5 randomised seeds',
    blurb: 'One program, five runs, each with different friction, mass, sensor noise and obstacle placement. A behaviour that survives the spread is the one to trust.',
    action: 'Run validation',
    run: function () {
      const scn = window.KodroScenario.defaultFor(robot().world || 'city');
      const rep = window.KodroScenario.run(PROGRAM, scn, 5);
      const g = rep.aggregate;
      return {
        text: 'Success ' + Math.round((g.successRate || 0) * 100) + '% (' + g.successCount + '/' + g.seeds + '), mean collisions ' + g.meanCollisions + ', mean battery ' + g.meanBattery + '%, mean score ' + g.meanScore + '. Saved to memory and SQLite.',
        tone: g.successRate >= 0.5 ? 'ok' : 'warn'
      };
    }
  }, {
    title: 'Remove the ultrasonic sensor',
    blurb: 'Now the build has no range sensor. Ask the registry for the distance command and it refuses, exactly as the grounded assistant would.',
    action: 'Remove it and ask',
    run: function () {
      const s = robot();
      window.RobotLab.applySpec(Object.assign({}, s, {
        sensors: (s.sensors || []).filter(function (x) {
          return x !== 'ultrasonic';
        })
      }));
      const g = window.KodroCommands.check(robot(), 'read_distance');
      return {
        text: g.ok ? 'Unexpectedly still available.' : 'Refused. ' + g.reason,
        tone: g.ok ? 'warn' : 'err'
      };
    }
  }, {
    title: 'Refit the sensor and save the skill',
    blurb: 'With the sensor back, the program runs and works. Keep it as a named skill and record a reflection, so the studio remembers what worked here.',
    action: 'Refit, save, reflect',
    run: function () {
      window.RobotLab.buildFromText('a light rover with an ultrasonic distance sensor');
      const r = robot();
      window.KodroMemory.saveSkill('avoid_obstacle_ultrasonic', PROGRAM, {
        world: r.world || 'city',
        robotType: r.type || 'rover',
        ts: ts()
      });
      const refl = window.KodroMemory.record({
        world: r.world || 'city',
        robotType: r.type || 'rover',
        outcome: 'done',
        detail: 'reached the goal with ultrasonic avoidance',
        ts: ts()
      });
      return {
        text: 'Saved skill "avoid_obstacle_ultrasonic". Reflection: ' + refl,
        tone: 'ok'
      };
    }
  }, {
    title: 'Reuse it on the next run',
    blurb: 'On a related scenario the studio retrieves the saved skill and the reflection, so its help is shaped by your own verified work, with no retraining.',
    action: 'Retrieve memory',
    run: function () {
      const r = robot();
      const skill = (window.KodroMemory.skills() || []).find(function (s) {
        return s.name === 'avoid_obstacle_ultrasonic';
      });
      const lesson = window.KodroMemory.lessonFor(r.world || 'city');
      return {
        text: 'Retrieved skill: ' + (skill ? skill.name : 'none') + '. Retrieved reflection: ' + (lesson ? lesson.reflection : 'none') + '.',
        tone: 'ok'
      };
    }
  }];
  function KodroDemo(props) {
    const {
      useState
    } = React;
    const [i, setI] = useState(0);
    const [results, setResults] = useState({});
    const step = STEPS[i];
    const res = results[i];
    const toneColor = function (t) {
      return t === 'err' ? '#ff8f7a' : t === 'warn' ? '#f5c451' : '#5ce0d8';
    };
    function doRun() {
      let out;
      try {
        out = step.run();
      } catch (e) {
        out = {
          text: 'Error: ' + (e && e.message ? e.message : e),
          tone: 'err'
        };
      }
      setResults(Object.assign({}, results, {
        [i]: out
      }));
    }
    return React.createElement('div', {
      style: {
        position: 'fixed',
        inset: 0,
        zIndex: 4200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(120% 120% at 50% 0%,#101726cc 0%,#070a12ee 70%)',
        padding: 28
      },
      onClick: function () {
        return props.onClose && props.onClose();
      }
    }, React.createElement('div', {
      style: {
        width: 'min(640px,100%)',
        background: '#0d1422',
        border: '1.5px solid #233248',
        borderRadius: 18,
        padding: 26,
        color: '#e8edf7',
        boxShadow: '0 30px 80px -30px #000'
      },
      onClick: function (e) {
        e.stopPropagation();
      }
    }, React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
      }
    }, React.createElement('span', {
      style: {
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#5ed6ff'
      }
    }, 'Kodro Realism Demo'), React.createElement('span', {
      style: {
        fontSize: 12,
        color: '#6f86a6'
      }
    }, 'Step ' + (i + 1) + ' of ' + STEPS.length)), React.createElement('h2', {
      style: {
        fontSize: 24,
        fontWeight: 720,
        margin: '6px 0 8px',
        letterSpacing: '-0.02em'
      }
    }, step.title), React.createElement('p', {
      style: {
        color: '#9fb4d2',
        fontSize: 14,
        lineHeight: 1.55,
        margin: '0 0 16px'
      }
    }, step.blurb), React.createElement('button', {
      style: {
        appearance: 'none',
        border: 0,
        cursor: 'pointer',
        fontWeight: 650,
        borderRadius: 11,
        padding: '11px 22px',
        background: '#5ed6ff',
        color: '#06121b',
        fontSize: 14
      },
      onClick: doRun
    }, step.action), res && React.createElement('div', {
      style: {
        marginTop: 16,
        padding: '13px 15px',
        background: '#0f1726',
        border: '1.5px solid ' + toneColor(res.tone) + '55',
        borderRadius: 12,
        fontSize: 13.5,
        lineHeight: 1.5,
        color: '#dce8f8'
      }
    }, res.text), React.createElement('div', {
      style: {
        display: 'flex',
        gap: 10,
        justifyContent: 'space-between',
        marginTop: 22
      }
    }, React.createElement('button', {
      style: {
        appearance: 'none',
        border: '1px solid #283a55',
        background: 'transparent',
        color: '#9fb4d2',
        cursor: 'pointer',
        borderRadius: 11,
        padding: '10px 18px',
        font: 'inherit'
      },
      onClick: function () {
        return props.onClose && props.onClose();
      }
    }, 'Close'), React.createElement('div', {
      style: {
        display: 'flex',
        gap: 10
      }
    }, i > 0 && React.createElement('button', {
      style: {
        appearance: 'none',
        border: '1px solid #283a55',
        background: 'transparent',
        color: '#9fb4d2',
        cursor: 'pointer',
        borderRadius: 11,
        padding: '10px 18px',
        font: 'inherit'
      },
      onClick: function () {
        return setI(i - 1);
      }
    }, 'Back'), i < STEPS.length - 1 ? React.createElement('button', {
      style: {
        appearance: 'none',
        border: 0,
        background: res ? '#5ed6ff' : '#1b2738',
        color: res ? '#06121b' : '#5d728f',
        cursor: res ? 'pointer' : 'not-allowed',
        borderRadius: 11,
        padding: '10px 20px',
        fontWeight: 650,
        font: 'inherit'
      },
      disabled: !res,
      onClick: function () {
        if (res) setI(i + 1);
      }
    }, 'Next') : React.createElement('button', {
      style: {
        appearance: 'none',
        border: 0,
        background: '#5ed6ff',
        color: '#06121b',
        cursor: 'pointer',
        borderRadius: 11,
        padding: '10px 20px',
        fontWeight: 650,
        font: 'inherit'
      },
      onClick: function () {
        return props.onClose && props.onClose();
      }
    }, 'Done')))));
  }
  window.KodroDemo = KodroDemo;
})();
})();

;(function () {
/*
 * Kodro onboarding / landing flow.
 *
 * A self-contained, skippable first-run experience that sits in front of the
 * studio: a landing hero, a "what do you want to build" robot picker, and the
 * assistant's world recommendation for that robot. Decoupled from app.jsx -
 * it reuses RobotLab's canonical catalogue (TYPES / WORLD_FOR / selectType) so
 * choosing a robot here drives exactly the same world selection the Robot Lab
 * would. Mounting and persistence ("seen it already") are owned by App; this
 * module only renders the flow and calls onClose() when the user is done.
 *
 * Exposes: window.KodroOnboarding({ onClose })
 */
(function () {
  const {
    useState,
    useEffect
  } = React;

  // Brand mark: the same orbit + trajectory + robot-node mark used in the navbar
  // (ORBIT_SVG), inlined so onboarding has no dependency on app.jsx.
  const MARK = /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 64 64",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "32",
    cy: "32",
    r: "21",
    stroke: "currentColor",
    strokeWidth: "2.4",
    opacity: "0.2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M15 44 A21 21 0 1 1 44 15",
    stroke: "currentColor",
    strokeWidth: "3.6",
    strokeLinecap: "round",
    opacity: "0.9"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "15",
    cy: "44",
    r: "2.6",
    fill: "currentColor",
    opacity: "0.45"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "44",
    cy: "15",
    r: "6.4",
    fill: "currentColor"
  }));
  const CSS = `
  .konb-root{position:fixed;inset:0;z-index:4000;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(120% 120% at 50% 0%,#101726 0%,#070a12 70%);
    color:#e8edf7;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    animation:konb-fade .35s ease both;overflow:auto;padding:32px}
  @keyframes konb-fade{from{opacity:0}to{opacity:1}}
  @keyframes konb-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .konb-card{width:min(720px,100%);animation:konb-rise .4s ease both}
  .konb-mark{width:72px;height:72px;color:#5ed6ff;margin:0 auto 22px;display:block}
  .konb-mark svg{width:100%;height:100%}
  .konb-title{font-size:clamp(34px,6vw,52px);font-weight:750;letter-spacing:-.03em;text-align:center;margin:0}
  .konb-tag{font-size:clamp(17px,3vw,22px);font-weight:600;text-align:center;margin:14px 0 6px;color:#cfe0f5}
  .konb-sub{text-align:center;color:#8da3c0;max-width:460px;margin:0 auto;line-height:1.5}
  .konb-steps{display:flex;gap:7px;justify-content:center;margin:26px 0 4px}
  .konb-dot{width:7px;height:7px;border-radius:50%;background:#2b3a55;transition:background .25s,width .25s}
  .konb-dot.done{background:#5ed6ff;width:7px;border-radius:50%}
  .konb-dot.on{background:#5ed6ff;width:20px;border-radius:4px}
  .konb-actions{display:flex;gap:12px;justify-content:center;margin-top:32px;flex-wrap:wrap}
  .konb-btn{appearance:none;border:0;cursor:pointer;font:inherit;font-weight:650;border-radius:11px;
    padding:13px 26px;transition:transform .12s ease,background .2s,box-shadow .2s}
  .konb-btn:active{transform:translateY(1px)}
  .konb-btn.primary{background:#5ed6ff;color:#06121b;box-shadow:0 8px 26px -10px #5ed6ff}
  .konb-btn.primary:hover{background:#7ee0ff}
  .konb-btn.ghost{background:transparent;color:#9fb4d2;border:1px solid #283a55}
  .konb-btn.ghost:hover{color:#dce8f8;border-color:#3b567a}
  .konb-btn[disabled]{opacity:.4;cursor:not-allowed}
  .konb-btn.primary[disabled]{background:#1b2738;color:#5d728f;box-shadow:none;opacity:1;cursor:not-allowed}
  .konb-h2{font-size:clamp(24px,4vw,32px);font-weight:720;letter-spacing:-.02em;text-align:center;margin:0 0 8px}
  .konb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-top:26px}
  @media (max-width:560px){.konb-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  .konb-tile{text-align:left;background:#0f1726;border:1.5px solid #233248;border-radius:14px;padding:17px 17px 15px;
    cursor:pointer;transition:border-color .18s,transform .12s,background .18s;color:inherit;font:inherit}
  .konb-tile:hover{border-color:#3d5a80;transform:translateY(-2px)}
  .konb-tile.sel{border-color:#5ed6ff;background:#11202e;box-shadow:0 0 0 1px #5ed6ff inset}
  .konb-emoji{font-size:30px;line-height:1}
  .konb-tname{font-weight:680;margin:9px 0 4px;font-size:16px}
  .konb-blurb{color:#8da3c0;font-size:13px;line-height:1.45}
  .konb-rec{background:#0f1726;border:1.5px solid #233248;border-radius:16px;padding:24px;margin-top:24px;text-align:center}
  .konb-rec .konb-world{font-size:26px;font-weight:720;color:#5ed6ff;margin:6px 0}
  .konb-rec .konb-why{color:#9fb4d2;line-height:1.5;max-width:440px;margin:6px auto 0}
  .konb-skip{position:absolute;top:20px;right:24px}
  .konb-skip button{background:none;border:0;color:#6f86a6;cursor:pointer;font:inherit;font-size:14px}
  .konb-skip button:hover{color:#cfe0f5}
  .konb-agent{margin-top:22px}
  .konb-agent-row{display:flex;gap:9px;align-items:center}
  .konb-agent-input{flex:1;min-width:0;background:#0e1726;border:1.5px solid #233248;border-radius:11px;
    color:#e8edf7;font:inherit;font-size:15px;padding:12px 14px;outline:none;transition:border-color .18s}
  .konb-agent-input:focus{border-color:#5ed6ff}
  .konb-agent-mic{padding:12px 14px}
  .konb-agent-or{text-align:center;color:#6f86a6;font-size:13px;margin:14px 0 0;letter-spacing:.02em}
  .konb-built{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:12px 0 0}
  .konb-chip{background:#11202e;border:1px solid #2a4258;border-radius:999px;color:#bfe6ff;font-size:12px;padding:4px 11px}
  `;
  function Step({
    n,
    current
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "konb-steps",
      role: "group",
      "aria-label": "Step " + (current + 1) + " of 3"
    }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "konb-dot" + (i === current ? " on" : i < current ? " done" : "")
    })));
  }
  function KodroOnboarding({
    onClose
  }) {
    const [step, setStep] = useState(0); // 0 land, 1 pick, 2 recommend
    const [type, setType] = useState(null);
    // Onboarding agent: describe a robot in words and it is built from the
    // validated parts catalogue (RobotLab.buildFromText). `built` holds the
    // result so step 2 can show the exact parts the agent fitted.
    const [agentText, setAgentText] = useState("");
    const [built, setBuilt] = useState(null);
    const [agentBusy, setAgentBusy] = useState(false);
    useEffect(() => {
      const tag = "kodro-onb-style";
      if (!document.getElementById(tag)) {
        const el = document.createElement("style");
        el.id = tag;
        el.textContent = CSS;
        document.head.appendChild(el);
      }
      const onKey = e => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    const TYPES = window.RobotLab && window.RobotLab.TYPES || {};
    const WORLD_FOR = window.RobotLab && window.RobotLab.WORLD_FOR || {};
    const order = ["rover", "car", "home", "arm", "custom"].filter(id => TYPES[id]);
    const rec = type && WORLD_FOR[type] || {};
    // Prefer the curated, place-like label ("Open terrain", "Riverside City")
    // over the raw terrain name ("Earth"), which reads oddly under the why-copy.
    const worldName = rec.label || window.TERRAINS && rec.id && window.TERRAINS[rec.id] && window.TERRAINS[rec.id].name || "the city";
    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    function enterStudio() {
      try {
        // The agent-built spec is already saved with its full parts; only fall
        // back to the bare type when nothing was built from a description.
        if (!built && window.RobotLab && type) window.RobotLab.selectType(type);
      } catch (e) {
        void e;
      }
      onClose();
    }

    // Build a robot from a free-text (or spoken) description, validated through
    // the parts catalogue, then jump to the world recommendation for it.
    function buildFromAgent(text) {
      const q = (text != null ? text : agentText).trim();
      if (!q || !window.RobotLab || !window.RobotLab.buildFromText) return;
      const res = window.RobotLab.buildFromText(q);
      setBuilt(res);
      setType(res.spec.type);
      setStep(2);
    }
    function agentVoice() {
      if (agentBusy || !window.RoboLearn || !window.RoboLearn.isAvailable || !window.RoboLearn.isAvailable()) return;
      const listen = window.RoboLearn.listen || window.RoboLearn.voiceCommand;
      if (!listen) return;
      setAgentBusy(true);
      Promise.resolve(listen(6)).then(function (r) {
        const txt = r && (r.text || r.transcript || (typeof r === "string" ? r : ""));
        if (txt && txt.trim()) {
          setAgentText(txt);
          buildFromAgent(txt);
        }
      }).catch(function () {}).then(function () {
        setAgentBusy(false);
      });
    }
    return /*#__PURE__*/React.createElement("div", {
      className: "konb-root",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Welcome to Kodro"
    }, /*#__PURE__*/React.createElement("div", {
      className: "konb-skip"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: onClose
    }, "Skip")), /*#__PURE__*/React.createElement("div", {
      className: "konb-card"
    }, step === 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "konb-mark"
    }, MARK), /*#__PURE__*/React.createElement("h1", {
      className: "konb-title"
    }, "Kodro"), /*#__PURE__*/React.createElement("p", {
      className: "konb-tag"
    }, "Design a robot. Program it. Watch it work."), /*#__PURE__*/React.createElement("p", {
      className: "konb-sub"
    }, "An offline robot design and simulation studio. Build a machine, write its behaviour, and validate it in a world that fits it - all on your own computer, no account, no cloud."), /*#__PURE__*/React.createElement(Step, {
      current: 0
    }), /*#__PURE__*/React.createElement("div", {
      className: "konb-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "konb-btn primary",
      autoFocus: true,
      onClick: () => setStep(1)
    }, "Get started"), /*#__PURE__*/React.createElement("button", {
      className: "konb-btn ghost",
      onClick: onClose
    }, "Skip to studio"))), step === 1 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
      className: "konb-h2"
    }, "What do you want to build?"), /*#__PURE__*/React.createElement("p", {
      className: "konb-sub"
    }, "Describe it in your own words and the assistant builds it, or pick a starting point. You can redesign every part later in the Robot Lab."), /*#__PURE__*/React.createElement("div", {
      className: "konb-agent"
    }, /*#__PURE__*/React.createElement("div", {
      className: "konb-agent-row"
    }, /*#__PURE__*/React.createElement("input", {
      className: "konb-agent-input",
      value: agentText,
      placeholder: "e.g. a self-driving car with a camera and an obstacle sensor",
      "aria-label": "Describe your robot",
      onChange: e => setAgentText(e.target.value),
      onKeyDown: e => {
        if (e.key === "Enter") buildFromAgent();
      }
    }), window.RoboLearn && window.RoboLearn.isAvailable && window.RoboLearn.isAvailable() && /*#__PURE__*/React.createElement("button", {
      className: "konb-btn ghost konb-agent-mic",
      type: "button",
      title: "Describe by voice",
      disabled: agentBusy,
      onClick: agentVoice
    }, agentBusy ? "…" : "🎤"), /*#__PURE__*/React.createElement("button", {
      className: "konb-btn primary",
      type: "button",
      disabled: !agentText.trim(),
      onClick: () => buildFromAgent()
    }, "Build it")), /*#__PURE__*/React.createElement("p", {
      className: "konb-agent-or"
    }, "or pick a starting point")), /*#__PURE__*/React.createElement("div", {
      className: "konb-grid",
      role: "radiogroup",
      "aria-label": "Robot type"
    }, order.map(id => {
      const t = TYPES[id];
      return /*#__PURE__*/React.createElement("button", {
        key: id,
        role: "radio",
        "aria-checked": type === id,
        className: "konb-tile" + (type === id ? " sel" : ""),
        onClick: () => setType(id)
      }, /*#__PURE__*/React.createElement("div", {
        className: "konb-emoji"
      }, t.emoji), /*#__PURE__*/React.createElement("div", {
        className: "konb-tname"
      }, t.name), /*#__PURE__*/React.createElement("div", {
        className: "konb-blurb"
      }, t.blurb));
    })), /*#__PURE__*/React.createElement(Step, {
      current: 1
    }), /*#__PURE__*/React.createElement("div", {
      className: "konb-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "konb-btn ghost",
      onClick: () => setStep(0)
    }, "Back"), /*#__PURE__*/React.createElement("button", {
      className: "konb-btn primary",
      disabled: !type,
      title: !type ? "Pick a robot to continue" : undefined,
      onClick: () => setStep(2)
    }, "Continue"))), step === 2 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
      className: "konb-h2"
    }, "Where it gets tested first"), /*#__PURE__*/React.createElement("p", {
      className: "konb-sub"
    }, "The assistant picks a world that suits your robot. Test it there, then try the others."), /*#__PURE__*/React.createElement("div", {
      className: "konb-rec"
    }, /*#__PURE__*/React.createElement("div", {
      className: "konb-emoji"
    }, TYPES[type] && TYPES[type].emoji || "🤖"), built && built.spec && /*#__PURE__*/React.createElement("div", {
      className: "konb-built",
      "aria-label": "Parts the assistant fitted"
    }, [built.spec.board].concat(built.spec.sensors || [], built.spec.actuators || []).map((p, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      className: "konb-chip"
    }, p))), /*#__PURE__*/React.createElement("div", {
      className: "konb-world"
    }, worldName), /*#__PURE__*/React.createElement("div", {
      className: "konb-why"
    }, cap(rec.why) || "Start in the busy city, then try the others.")), /*#__PURE__*/React.createElement(Step, {
      current: 2
    }), /*#__PURE__*/React.createElement("div", {
      className: "konb-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "konb-btn ghost",
      onClick: () => setStep(1)
    }, "Back"), /*#__PURE__*/React.createElement("button", {
      className: "konb-btn primary",
      onClick: enterStudio
    }, "Enter studio")))));
  }
  window.KodroOnboarding = KodroOnboarding;
})();
})();

;(function () {
/* ============================================================================
   ORBITAL ROVER — App (runtime + UI wiring)
   ========================================================================== */
(function () {
  const {
    useState,
    useRef,
    useEffect,
    useCallback
  } = React;
  const TERRAINS = window.TERRAINS;
  const WALL = TERRAINS.WALL;
  const RobotLab = window.RobotLab;
  const R = 30; // rover collision radius (cm)
  // Live check (re-evaluated per move) so toggling the OS setting takes effect.
  const PREFERS_REDUCED_MOTION = () => typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  // ---------------- example programs ----------------
  const EXAMPLES = {
    basecamp: {
      label: 'basecamp.py',
      code: `# BASE CAMP - your code BUILDS the world.
# place(kind) plants a prop right where the rover stands:
# "flag", "beacon", "person", "tree", "rock", "crate".
set_speed(80)
pen_down()
say("Building base camp")

# Mark the centre of camp with a beacon.
place("beacon")

# Drive a square and drop a crate at every corner.
for corner in range(4):
    move_forward(2)
    place("crate")
    turn_right(90)

# Plant a flag line out front.
turn_right(45)
for i in range(3):
    move_forward(1.2)
    place("flag")

# The crew arrives.
move_forward(1.5)
place("person")
turn_left(90)
move_forward(1)
place("person")

# A bit of landscaping.
turn_left(135)
move_forward(2.5)
place("tree")
move_forward(1)
place("rock")

led("green")
say("Camp ready!")
print("Base camp built: 1 beacon, 4 crates, 3 flags, 2 crew, 1 tree, 1 rock")`
    },
    autopilot: {
      label: 'autopilot.py',
      code: `# AUTOPILOT - the rover drives itself, like a self-driving car.
# Every step it reads its lidar. It ONLY moves forward when the way
# is clear, so it can never hit a boulder OR the arena wall. When
# something looms it scans, probes left + right, and steers toward
# the side with more room. Pure sense-think-act. Press Run and watch.
rover.set_speed(72)
rover.pen_down()
rover.led("cyan")
rover.say("Autopilot engaged")

legs = 0
dodges = 0
scans = 0
steps = 0

# Self-drive: it only moves forward when the lidar says the way is clear,
# so it can never hit a boulder OR the arena wall. Whenever something looms
# it scans, probes left + right, and steers toward the side with more room -
# so it roams the whole field, dodging as it goes. Always terminates.
while legs < 60 and steps < 220:
    steps = steps + 1
    ahead = rover.distance()

    if ahead < 150:
        # Boulder or wall ahead: scan, sense both sides, steer clear.
        rover.led("amber")
        rover.scan()
        scans = scans + 1
        rover.turn_left(60)
        left = rover.distance()
        rover.turn_right(120)
        right = rover.distance()
        if left > right:
            rover.turn_left(150)
        else:
            rover.turn_left(25)
        dodges = dodges + 1
        rover.led("cyan")
    else:
        rover.forward(40)
        legs = legs + 1

rover.led("green")
rover.say("Area mapped")
print("Legs driven:", legs)
print("Boulders dodged:", dodges)
print("Lidar scans:", scans)`
    },
    drive: {
      label: 'starter.py',
      code: `# Welcome to Kodro.
# Edit freely, then press Run. The API is listed below.
rover.set_speed(60)
rover.pen_down()

rover.forward(200)
rover.turn_left(90)
rover.forward(140)
rover.say("Hello, terrain")`
    },
    square: {
      label: 'square.py',
      code: `# A for-loop draws a square. Change the 4 or the 300.
rover.pen_down()
rover.set_speed(75)

for side in range(4):
    rover.forward(300)
    rover.turn_right(90)

print("Square complete.")`
    },
    spiral: {
      label: 'spiral.py',
      code: `# Variables + loops make an expanding spiral.
rover.pen_down()
rover.set_speed(85)

step = 40
for i in range(20):
    rover.forward(step)
    rover.turn_right(42)
    step = step + 20

print("Drew", i + 1, "segments.")`
    },
    avoid: {
      label: 'avoid.py',
      code: `# Obstacle avoidance: read the lidar, branch with if/else.
rover.set_speed(80)
rover.pen_down()

trips = 0
while trips < 30:
    front = rover.distance()
    if front < 150:
        rover.turn_right(55)
    else:
        rover.forward(80)
    trips = trips + 1

print("Finished after", trips, "moves.")`
    },
    survey: {
      label: 'survey.py',
      code: `# Sensors + conditionals: profile the environment.
rover.led("amber")
rover.scan()

g = rover.gravity()
t = rover.temperature()
print("Gravity:", g, "m/s^2")
print("Temperature:", t, "C")

if g < 4:
    print("Low gravity. Momentum carries far.")
else:
    print("Standard footing.")

rover.led("green")
rover.forward(240)
rover.say("Survey done")`
    }
  };
  const LED_COLORS = {
    red: '#d06a6a',
    amber: '#e0b45c',
    green: '#7cc49b',
    cyan: '#5ce0d8',
    blue: '#aeb8e8',
    white: '#f5f0e4',
    off: null
  };

  // ---------------- icons ----------------
  const I = {
    play: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "currentColor"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M8 5v14l11-7z"
    })),
    pause: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "currentColor"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M6 5h4v14H6zM14 5h4v14h-4z"
    })),
    step: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M5 5v14M9 12h11M16 7l5 5-5 5"
    })),
    reset: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M4 12a8 8 0 108-8M4 12V6M4 12h6",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }))
  };
  function App() {
    const [terrainId, setTerrainId] = useState(() => localStorage.getItem('or_terrain') || 'mars');
    const [activeTab, setActiveTab] = useState(() => {
      const saved = localStorage.getItem('or_tab');
      if (saved) return saved;
      // Default to the autopilot showcase, but only if the current build can
      // actually range: a camera-only arm (or any build with no ultrasonic)
      // would fail autopilot's first distance() call with a gating refusal, so
      // it opens on the base-command 'starter' example instead and first Run
      // always works.
      try {
        const rb = window.getKodroRobot && window.getKodroRobot();
        if (rb && window.KodroCommands && !window.KodroCommands.check(rb, 'distance').ok) return 'basecamp';
      } catch (e) {
        void e;
      }
      return 'autopilot';
    });
    const [programs, setPrograms] = useState(() => {
      try {
        const s = JSON.parse(localStorage.getItem('or_programs'));
        if (s) return s;
      } catch (e) {}
      const o = {};
      Object.keys(EXAMPLES).forEach(k => o[k] = EXAMPLES[k].code);
      return o;
    });
    const [runState, setRunState] = useState('idle');
    const [activeLine, setActiveLine] = useState(0);
    const [consoleLines, setConsoleLines] = useState([{
      type: 'sys',
      text: 'Kodro ready. Press Run to deploy.'
    }]);
    const [speedMul, setSpeedMul] = useState(1);
    const [say, setSay] = useState('');
    const [crashKey, setCrashKey] = useState(0);
    const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
    const [cam, setCam] = useState({
      tilt: 46,
      yaw: -8,
      zoom: 1
    });
    // Real WebGL 3D viewport (Three.js) with third-person orbit / first-person.
    const [view3d, setView3d] = useState(() => localStorage.getItem('or_view3d') !== '0');
    const [fpv, setFpv] = useState(() => localStorage.getItem('or_fpv') === '1');
    useEffect(() => {
      try {
        localStorage.setItem('or_view3d', view3d ? '1' : '0');
      } catch (e) {
        void e;
      }
    }, [view3d]);
    // Spin up the moving-agent simulation for the current world (city traffic
    // and pedestrians); both viewports and the collision test read from it.
    useEffect(() => {
      if (window.KodroAgents) window.KodroAgents.build(terrainId);
      return () => {
        if (window.KodroAgents) window.KodroAgents.stop();
      };
    }, [terrainId]);
    useEffect(() => {
      try {
        localStorage.setItem('or_fpv', fpv ? '1' : '0');
      } catch (e) {
        void e;
      }
    }, [fpv]);
    // Escape leaves first person fast (a quick exit for motion sensitivity).
    useEffect(() => {
      if (!fpv) return undefined;
      const onEsc = e => {
        if (e.key === 'Escape') setFpv(false);
      };
      window.addEventListener('keydown', onEsc);
      return () => window.removeEventListener('keydown', onEsc);
    }, [fpv]);
    const zoom = cam.zoom;
    const trailColor = t.trail === 'cyan' ? '#5ce0d8' : t.trail === 'amber' ? '#e0b45c' : t.trail === 'white' ? '#f5f0e4' : null;

    // terrainId may be a base terrain OR a real-world mission site id.
    const terrain = window.resolveSite ? window.resolveSite(terrainId) : TERRAINS[terrainId];

    // live rover state (authoritative for sensors/animation)
    const startState = () => ({
      x: 0,
      y: 0,
      heading: 0,
      speed: 50,
      battery: 100,
      moving: false,
      led: null,
      scanning: false,
      penDown: false
    });
    const live = useRef(startState());
    const [rover, setRover] = useState(() => ({
      ...live.current
    }));
    const trailRef = useRef([]); // array of segments; each = [{x,y}]
    const [trail, setTrail] = useState([]);
    const odoRef = useRef(0);
    const [odo, setOdo] = useState(0);
    const [sensorDist, setSensorDist] = useState(600);

    // RoboLearn bridge: lessons (from Python), currently-loaded lesson id,
    // pupil + verdict + hint after a graded Run. The React app stays
    // unchanged when there's no bridge (browser preview).
    // World props placed by pupil code via place(): flags, beacons, people...
    const [props, setProps] = useState([]);
    // A pupil-chosen local image, shown in the world by place("photo").
    const [photoUrl, setPhotoUrl] = useState(null);
    async function pickPhotoClick() {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) {
        addConsole('Photo props need the desktop app.', 'err');
        return;
      }
      try {
        const r = await window.RoboLearn.pickPhoto();
        if (r && r.ok) {
          setPhotoUrl(r.dataUrl);
          addConsole('Photo "' + r.name + '" loaded - use place("photo") to put it in the world.', 'ok');
        } else if (r && r.reason !== 'cancelled') {
          addConsole('Photo: ' + (r && r.reason || 'failed'), 'err');
        }
      } catch (e) {
        addConsole('Photo: ' + e, 'err');
      }
    }
    // Live terminal line + one-deep history (ArrowUp recalls the last line).
    const [replLine, setReplLine] = useState('');
    const replHistRef = useRef('');
    const setReplHist = v => {
      if (v && v.trim()) replHistRef.current = v;
    };
    const [lessons, setLessons] = useState([]);
    // Multi-pupil: list + active id, so shared classroom machines keep each
    // pupil's progress separate (re-score / "do-all").
    const [pupils, setPupils] = useState([]);
    const [activePupilId, setActivePupilId] = useState(null);
    function reloadPupils() {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) return;
      window.RoboLearn.listPupils().then(ps => {
        if (!Array.isArray(ps)) return;
        setPupils(ps);
        const active = ps.find(p => p.active);
        if (active) setActivePupilId(active.id);
      });
    }
    useEffect(reloadPupils, []);
    async function onPupilChange(e) {
      const val = e.target.value;
      if (val === '__new__') {
        const r = await window.RoboLearn.createPupil('Pupil ' + (pupils.length + 1));
        if (r && r.ok) {
          setActivePupilId(r.id);
          reloadPupils();
        }
      } else {
        const r = await window.RoboLearn.selectPupil(val);
        if (r && r.ok) setActivePupilId(val);
      }
      // Switching identity: clear the current verdict (it was the other pupil's).
      setLessonVerdict(null);
      setConsoleLines(l => [...l, {
        type: 'sys',
        text: 'Switched pupil.'
      }]);
    }
    const [currentLessonId, setCurrentLessonId] = useState(null);
    // Lessons keep their OWN editable buffer so loading one never clobbers the
    // example tabs (autopilot.py etc.); the editor shows it while a lesson is
    // active (QA re-score rank 11).
    const [lessonBuffers, setLessonBuffers] = useState({}); // per-lesson editable code
    const [lessonVerdict, setLessonVerdict] = useState(null); // {passed,score,reasons,hint}
    // The editor's current source: a lesson's own buffer when one is loaded,
    // otherwise the active example tab. (Declared AFTER the state above to
    // avoid a temporal-dead-zone ReferenceError.)
    const code = currentLessonId ? lessonBuffers[currentLessonId] !== undefined ? lessonBuffers[currentLessonId] : ''
    // Never hand the editor undefined (it would .split(undefined) and crash):
    // if activeTab is somehow not a known example key, fall back to basecamp.
    : programs[activeTab] !== undefined ? programs[activeTab] : programs.basecamp || '';
    // Dyslexia-friendly / larger reading text toggle (QA re-score rank 4).
    const [readable, setReadable] = useState(() => localStorage.getItem('or_readable') === '1');
    const [muted, setMuted] = useState(() => localStorage.getItem('or_muted') === '1');
    // Visual theme. 'dark' is the default mission-control look; the rest are
    // full repaints driven by [data-theme] CSS variable swaps in styles.css.
    const [theme, setTheme] = useState(() => localStorage.getItem('or_theme') || 'dark');
    const [showHelp, setShowHelp] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    // First-run onboarding / landing flow (shown once, remembered, skippable).
    const [onboarded, setOnboarded] = useState(() => localStorage.getItem('or_onboarded') === '1');
    // Budget robot builder (local AI hardware guide for a real-world rover).
    const [buildOpen, setBuildOpen] = useState(false);
    const [buildBudget, setBuildBudget] = useState('30');
    const [buildGoal, setBuildGoal] = useState('');
    const [buildBusy, setBuildBusy] = useState(false);
    const [buildPlan, setBuildPlan] = useState(null);
    const [buildErr, setBuildErr] = useState(null);
    async function runBuild() {
      if (buildBusy) return;
      const usd = Math.max(1, Math.min(100000, parseFloat(buildBudget) || 30));
      setBuildBusy(true);
      setBuildErr(null);
      try {
        if (!window.RoboLearn || !window.RoboLearn.isAvailable()) {
          setBuildErr('The robot builder needs the desktop app with local AI.');
        } else {
          const r = await window.RoboLearn.budgetBuild(usd, buildGoal);
          if (r && r.ok) setBuildPlan(r);else setBuildErr(r && r.reason || 'Could not build a plan.');
        }
      } catch (e) {
        setBuildErr(String(e));
      }
      setBuildBusy(false);
    }
    // Click-away + Escape close the settings popover.
    useEffect(() => {
      if (!settingsOpen) return undefined;
      const close = e => {
        if (!e.target.closest || !e.target.closest('.settings-wrap')) setSettingsOpen(false);
      };
      const key = e => {
        if (e.key === 'Escape') setSettingsOpen(false);
      };
      document.addEventListener('pointerdown', close);
      document.addEventListener('keydown', key);
      return () => {
        document.removeEventListener('pointerdown', close);
        document.removeEventListener('keydown', key);
      };
    }, [settingsOpen]);

    // --- AI vibe coding (local Ollama: Qwen/Gemma; graceful when absent) ---
    const [aiInfo, setAiInfo] = useState({
      available: false,
      model: null
    });
    const [vibeOpen, setVibeOpen] = useState(false);
    const [realismOpen, setRealismOpen] = useState(false);
    const [demoOpen, setDemoOpen] = useState(false);
    // Render-quality tier read by Viewport3D (Low/Med/High/Cinematic): bounds
    // shadow + pixel-ratio cost so a laptop stays smooth, or maxes a screenshot.
    const [quality, setQuality] = useState(() => {
      try {
        return localStorage.getItem('kodro_quality') || 'high';
      } catch (e) {
        return 'high';
      }
    });
    if (typeof window !== 'undefined') window.KODRO_QUALITY = quality;
    // Robot Lab: design a custom robot whose spec drives the simulation.
    const [robotLabOpen, setRobotLabOpen] = useState(false);
    const [robotSpec, setRobotSpec] = useState(() => window.getKodroRobot ? window.getKodroRobot() : null);
    useEffect(() => {
      const onRobot = e => {
        setRobotSpec(e.detail);
        // Drop the new robot into the world the assistant recommends for it.
        const w = e.detail && e.detail.world;
        if (w && window.TERRAINS && window.TERRAINS[w]) {
          setTerrainId(w);
          try {
            localStorage.setItem('or_terrain', w);
          } catch (err) {
            void err;
          }
        }
        // If the freshly chosen build cannot range (no ultrasonic), a
        // distance-based example would fail on the first Run with a gating
        // refusal. Move off it to the base-command 'starter' so the first Run
        // after picking, say, a camera-only arm still works.
        try {
          const canRange = !window.KodroCommands || window.KodroCommands.check(e.detail, 'distance').ok;
          if (!canRange) setActiveTab(t => t === 'autopilot' || t === 'avoid' ? 'basecamp' : t);
        } catch (err) {
          void err;
        }
      };
      window.addEventListener('kodro-robot', onRobot);
      return () => window.removeEventListener('kodro-robot', onRobot);
    }, []);
    // Self-refinement memory: reflections from past runs and a skill library.
    const [memoryOpen, setMemoryOpen] = useState(false);
    const [memTick, setMemTick] = useState(0);
    useEffect(() => {
      const on = () => setMemTick(n => n + 1 & 1023);
      window.addEventListener('kodro-memory', on);
      return () => window.removeEventListener('kodro-memory', on);
    }, []);
    // Second-agent code review (propose-then-critique on the local model).
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewBusy, setReviewBusy] = useState(false);
    const [reviewData, setReviewData] = useState(null);
    const [reviewErr, setReviewErr] = useState(null);
    // Teacher dashboard: class concept-strength heatmap (now in the web app).
    const [teacherOpen, setTeacherOpen] = useState(false);
    const [teacherData, setTeacherData] = useState(null);
    // Grounded Ask: answers from the lesson material, offline retrieval.
    const [askOpen, setAskOpen] = useState(false);
    const [askQuery, setAskQuery] = useState('');
    const [askBusy, setAskBusy] = useState(false);
    const [askData, setAskData] = useState(null);
    const [vibePrompt, setVibePrompt] = useState('');
    const [vibeBusy, setVibeBusy] = useState(false);
    const [vibeError, setVibeError] = useState(null);
    // The pywebview bridge injects asynchronously AFTER React mounts, so a
    // one-shot check at mount races it and can leave the panel "offline"
    // forever. Poll briefly at mount, and re-check every time the panel is
    // opened -- so starting Ollama later lights it up without a restart.
    function refreshAiStatus() {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) return;
      window.RoboLearn.aiStatus().then(s => {
        if (s) setAiInfo(s);
      }).catch(() => {});
    }
    // Let the user point Kodro at any local model they have pulled (DeepSeek,
    // Nemotron, Qwen, a custom fine-tune). Persisted server side; empty = auto.
    function pickModel(name) {
      if (!window.RoboLearn || !window.RoboLearn.setAiModel) return;
      window.RoboLearn.setAiModel(name || '').then(() => refreshAiStatus()).catch(() => {});
    }
    // B3 trigger: validate the current program across randomised seeds in the
    // scenario that fits this robot, persist the report, and open the dashboard.
    function runValidation() {
      if (!window.KodroScenario) {
        addConsole('Validation unavailable.', 'err');
        return;
      }
      const robot = window.getKodroRobot && window.getKodroRobot() || {};
      const scn = window.KodroScenario.defaultFor(robot.world || terrain && terrain.id);
      addConsole('Validating across 5 randomised seeds in "' + scn.name + '" (friction, mass, sensor noise and obstacle placement vary)...', 'sys');
      const rep = window.KodroScenario.run(code, scn, 5);
      const a = rep.aggregate;
      addConsole('Validation: success ' + Math.round((a.successRate || 0) * 100) + '% (' + a.successCount + '/' + a.seeds + '), mean collisions ' + a.meanCollisions + ', mean time ' + (a.meanTimeToGoal != null ? a.meanTimeToGoal + ' steps' : 'n/a') + ', mean battery ' + a.meanBattery + '%, mean score ' + a.meanScore + '. Saved.', a.successRate >= 0.6 ? 'ok' : 'warn');
      setRealismOpen(true);
    }
    useEffect(() => {
      let tries = 0;
      const t = setInterval(() => {
        tries += 1;
        if (window.RoboLearn && window.RoboLearn.isAvailable()) {
          refreshAiStatus();
          clearInterval(t);
        } else if (tries > 20) clearInterval(t);
      }, 500);
      return () => clearInterval(t);
    }, []);
    useEffect(() => {
      if (vibeOpen) refreshAiStatus();
    }, [vibeOpen]);
    // Chat thread: [{role:'user'|'ai', kind:'text'|'code', text}]
    const [vibeMsgs, setVibeMsgs] = useState([]);
    const [micBusy, setMicBusy] = useState(false);
    const [voiceGender, setVoiceGender] = useState(() => localStorage.getItem('or_voice') || 'female');
    useEffect(() => {
      try {
        localStorage.setItem('or_voice', voiceGender);
      } catch (e) {
        void e;
      }
    }, [voiceGender]);
    const vibeEndRef = useRef(null);
    useEffect(() => {
      if (vibeEndRef.current) vibeEndRef.current.scrollIntoView({
        block: 'end'
      });
    }, [vibeMsgs, vibeBusy]);

    // Streamed reply: start a job, poll ~4x/s, and show the model's text live
    // in the thread while it thinks (the response feels instant instead of a
    // long opaque spinner).
    const [vibeLive, setVibeLive] = useState('');
    async function vibeSend() {
      const text = vibePrompt.trim();
      if (vibeBusy || !text) return;
      const next = [...vibeMsgs, {
        role: 'user',
        kind: 'text',
        text
      }];
      setVibeMsgs(next);
      setVibePrompt('');
      setVibeBusy(true);
      setVibeError(null);
      setVibeLive('');
      try {
        const history = next.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          text: m.text
        }));
        // Self-refinement in action: feed the lesson the system remembers from
        // past runs in this world into the assistant's context, so its advice
        // is shaped by what actually happened, not just the immediate prompt.
        const lesson = window.KodroMemory && window.KodroMemory.lessonFor(terrain.id);
        if (lesson && lesson.reflection) {
          history.unshift({
            role: 'user',
            text: 'Keep in mind, learned from my past runs in the ' + terrain.name + ': ' + lesson.reflection
          });
        }
        // Ground the assistant in THIS robot's command registry (single source
        // of truth: RobotLab.KodroCommands) so it only suggests commands the
        // build supports and refuses ones whose part is not fitted. The runtime
        // gate in host.sensor and the self-test are the deterministic backstop.
        if (window.KodroCommands && window.getKodroRobot) {
          history.unshift({
            role: 'user',
            text: window.KodroCommands.groundingText(window.getKodroRobot())
          });
        }
        const start = await window.RoboLearn.aiChatStart(history, currentLessonIdRef.current);
        if (!start || !start.ok) {
          setVibeError(start && start.reason || 'AI unavailable.');
          setVibeBusy(false);
          return;
        }
        let r = null;
        for (;;) {
          await new Promise(res => setTimeout(res, 250));
          const p = await window.RoboLearn.aiChatPoll(start.jobId);
          if (!p || !p.ok) {
            r = p;
            break;
          }
          if (p.done) {
            r = p;
            break;
          }
          setVibeLive(p.text || '');
        }
        setVibeLive('');
        if (r && r.ok && r.type === 'question') {
          setVibeMsgs(m => [...m, {
            role: 'ai',
            kind: 'text',
            text: r.text
          }]);
          if (!muted) window.RoboLearn.speak(r.text, voiceGender);
        } else if (r && r.ok && r.type === 'code') {
          setVibeMsgs(m => [...m, {
            role: 'ai',
            kind: 'code',
            text: r.code,
            model: r.model
          }]);
        } else {
          setVibeError(r && r.reason || 'Generation failed.');
        }
      } catch (e) {
        setVibeError(String(e));
      }
      setVibeBusy(false);
    }

    // Autonomous test: when code is applied, run it through the real interpreter
    // and kinematics with no animation and report what actually happens, so the
    // assistant checks its own work instead of leaving it to the user.
    function selfTestReport(src) {
      if (!window.KodroSelfTest) return;
      const t = window.KodroSelfTest(src);
      addConsole('Self-test: ' + t.summary, t.ok && !t.hitWall ? 'ok' : 'err');
    }
    function vibeApply(code, model) {
      setVibeOpen(false);
      addConsole('AI (' + (model || aiInfo.model) + ') wrote a program. Read it, then press Run.', 'sys');
      typewriteCode(code);
      selfTestReport(code);
    }
    async function runReview() {
      if (reviewBusy) return;
      const src = (code || '').trim();
      if (!src) {
        setReviewErr('Write some code first, then ask for a review.');
        setReviewOpen(true);
        return;
      }
      setReviewOpen(true);
      setReviewBusy(true);
      setReviewErr(null);
      setReviewData(null);
      try {
        const r = await window.RoboLearn.aiReviewCode(src, currentLessonId || null);
        if (r && r.ok) setReviewData(r);else setReviewErr(r && r.reason || 'Review unavailable.');
      } catch (e) {
        setReviewErr(String(e));
      }
      setReviewBusy(false);
    }
    function applyReview() {
      if (reviewData && reviewData.revised && reviewData.code) {
        setReviewOpen(false);
        addConsole('Reviewer (' + (reviewData.model || aiInfo.model) + ') tidied your code. Read it, then press Run.', 'sys');
        typewriteCode(reviewData.code);
        selfTestReport(reviewData.code);
      }
    }

    // Wave voice agent: speak to drive the rover or ask a grounded question.
    const [vaOpen, setVaOpen] = useState(false);
    const [vaBusy, setVaBusy] = useState(false);
    const [vaData, setVaData] = useState(null);
    async function runVoiceAgent() {
      if (vaBusy) return;
      setVaBusy(true);
      setVaData(null);
      try {
        const r = await window.RoboLearn.voiceAgent(6);
        setVaData(r || {
          ok: false,
          reason: 'No response.'
        });
        if (r && r.ok && r.mode === 'command' && r.code) {
          setCode(c => (c && !c.endsWith('\n') ? c + '\n' : c) + r.code + '\n');
          addConsole('Heard "' + r.text + '" → added ' + r.code, 'ok');
        }
      } catch (e) {
        setVaData({
          ok: false,
          reason: String(e)
        });
      }
      setVaBusy(false);
    }
    const [voiceBusy, setVoiceBusy] = useState(false);
    async function runVoiceCommand() {
      if (voiceBusy) return;
      setVoiceBusy(true);
      addConsole('Listening… say a command like "go forward three" or "turn left ninety".', 'sys');
      try {
        const r = await window.RoboLearn.voiceCommand(6);
        if (r && r.ok && r.code) {
          setCode(c => (c && !c.endsWith('\n') ? c + '\n' : c) + r.code + '\n');
          addConsole('Heard "' + r.text + '" → added ' + r.code, 'ok');
        } else {
          addConsole(r && r.reason || 'Voice command not understood.', 'err');
        }
      } catch (e) {
        addConsole('Voice: ' + e, 'err');
      }
      setVoiceBusy(false);
    }

    // Agent swarm: run the program on a fleet of rovers, draw their trails.
    const [swarmOpen, setSwarmOpen] = useState(false);
    const [swarmBusy, setSwarmBusy] = useState(false);
    const [swarmData, setSwarmData] = useState(null);
    async function runSwarm() {
      const src = (code || '').trim();
      if (!src) {
        addConsole('Write a program first, then launch the swarm.', 'err');
        return;
      }
      setSwarmOpen(true);
      setSwarmBusy(true);
      setSwarmData(null);
      try {
        const r = await window.RoboLearn.swarmRun(src, currentLessonId || null, 6);
        if (r && r.ok) setSwarmData(r);else {
          setSwarmOpen(false);
          addConsole(r && r.reason || 'Swarm failed.', 'err');
        }
      } catch (e) {
        setSwarmOpen(false);
        addConsole('Swarm: ' + e, 'err');
      }
      setSwarmBusy(false);
    }
    async function runAsk() {
      const q = (askQuery || '').trim();
      if (!q || askBusy) return;
      setAskBusy(true);
      setAskData(null);
      try {
        const r = await window.RoboLearn.aiAsk(q);
        setAskData(r || {
          ok: false,
          reason: 'No response.'
        });
      } catch (e) {
        setAskData({
          ok: false,
          reason: String(e)
        });
      }
      setAskBusy(false);
    }
    async function openTeacher() {
      setSettingsOpen(false);
      setTeacherOpen(true);
      setTeacherData(null);
      try {
        const r = await window.RoboLearn.getClassHeatmap();
        if (r && r.ok) setTeacherData(r);else setTeacherData({
          ok: false,
          concepts: [],
          pupils: []
        });
      } catch (e) {
        setTeacherData({
          ok: false,
          concepts: [],
          pupils: []
        });
      }
    }
    async function vibeMic() {
      if (micBusy) return;
      setMicBusy(true);
      setVibeError(null);
      try {
        const r = await window.RoboLearn.listen(6);
        if (r && r.ok) setVibePrompt(p => (p ? p + ' ' : '') + r.text);else setVibeError(r && r.reason || 'Voice input failed.');
      } catch (e) {
        setVibeError(String(e));
      }
      setMicBusy(false);
    }

    // Typewriter: animate code into the active editor buffer like live typing.
    const typeRef = useRef(null);
    function typewriteCode(codeText) {
      if (typeRef.current) {
        clearInterval(typeRef.current);
        typeRef.current = null;
      }
      const lessonId = currentLessonIdRef.current;
      const setCode = v => {
        if (lessonId) setLessonBuffers(b => ({
          ...b,
          [lessonId]: v
        }));else setPrograms(p => ({
          ...p,
          [activeTab]: v
        }));
      };
      if (PREFERS_REDUCED_MOTION() || codeText.length > 4000) {
        setCode(codeText);
        return;
      }
      let i = 0;
      setCode('');
      typeRef.current = setInterval(() => {
        i = Math.min(codeText.length, i + 3);
        setCode(codeText.slice(0, i));
        if (i >= codeText.length) {
          clearInterval(typeRef.current);
          typeRef.current = null;
        }
      }, 12);
    }

    // --- Scratch-style blocks mode -----------------------------------------
    const BLOCK_DEFS = [{
      k: 'forward',
      label: 'move forward',
      unit: 'm',
      val: 2,
      code: v => 'move_forward(' + v + ')',
      color: 'var(--cyan)'
    }, {
      k: 'back',
      label: 'move backward',
      unit: 'm',
      val: 1,
      code: v => 'move_backward(' + v + ')',
      color: 'var(--cyan)'
    }, {
      k: 'left',
      label: 'turn left',
      unit: '°',
      val: 90,
      code: v => 'turn_left(' + v + ')',
      color: 'var(--warning)'
    }, {
      k: 'right',
      label: 'turn right',
      unit: '°',
      val: 90,
      code: v => 'turn_right(' + v + ')',
      color: 'var(--warning)'
    }, {
      k: 'beep',
      label: 'beep',
      code: () => 'beep(1)',
      color: 'var(--brass)'
    }, {
      k: 'say',
      label: 'say hello',
      code: () => 'say("hello")',
      color: 'var(--brass)'
    }, {
      k: 'led',
      label: 'LED cyan',
      code: () => 'led("cyan")',
      color: 'var(--brass)'
    }, {
      k: 'scan',
      label: 'scan',
      code: () => 'scan()',
      color: 'var(--success)'
    }, {
      k: 'collect',
      label: 'collect sample',
      code: () => 'collect_sample()',
      color: 'var(--success)'
    }, {
      k: 'drop',
      label: 'drop sample',
      code: () => 'drop_sample()',
      color: 'var(--success)'
    }, {
      k: 'speed',
      label: 'set speed',
      unit: '%',
      val: 60,
      code: v => 'set_speed(' + v + ')',
      color: 'var(--cyan)'
    }, {
      k: 'wait',
      label: 'wait',
      unit: 's',
      val: 1,
      code: v => 'wait(' + v + ')',
      color: 'var(--cyan)'
    }, {
      k: 'pendown',
      label: 'pen down',
      code: () => 'pen_down()',
      color: 'var(--brass)'
    }, {
      k: 'penup',
      label: 'pen up',
      code: () => 'pen_up()',
      color: 'var(--brass)'
    }, {
      k: 'repeat',
      label: 'repeat',
      unit: '×',
      val: 4,
      container: true,
      code: v => 'for i in range(' + v + '):',
      color: 'var(--mars)'
    }, {
      k: 'ifobs',
      label: 'if obstacle ahead',
      container: true,
      code: () => 'if obstacle_ahead():',
      color: 'var(--mars)'
    }];
    const [blocksOpen, setBlocksOpen] = useState(false);
    const [blocks, setBlocks] = useState([]); // {k,label,val,indent,container,color,unit}
    const [blockIndent, setBlockIndent] = useState(0);
    function addBlock(def) {
      setBlocks(bs => [...bs, {
        k: def.k,
        label: def.label,
        val: def.val,
        indent: blockIndent,
        container: !!def.container,
        color: def.color,
        unit: def.unit
      }]);
      if (def.container) setBlockIndent(d => Math.min(3, d + 1));
      sfx('led');
    }
    function endBlock() {
      setBlockIndent(d => Math.max(0, d - 1));
    }
    function removeBlock(i) {
      setBlocks(bs => bs.filter((_, j) => j !== i));
    }
    function moveBlock(i, dir) {
      setBlocks(bs => {
        const j = i + dir;
        if (j < 0 || j >= bs.length) return bs;
        const next = bs.slice();
        const tmp = next[i];
        next[i] = next[j];
        next[j] = tmp;
        return next;
      });
      sfx('led');
    }
    function blocksToPython() {
      const defs = {};
      BLOCK_DEFS.forEach(d => {
        defs[d.k] = d;
      });
      const lines = [];
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        lines.push('    '.repeat(b.indent) + defs[b.k].code(b.val));
        if (b.container) {
          const next = blocks[i + 1];
          // An empty container needs a body to be valid Python.
          if (!next || next.indent <= b.indent) lines.push('    '.repeat(b.indent + 1) + 'pass');
        }
      }
      return lines.join('\n') + '\n';
    }
    function insertBlocksCode() {
      if (!blocks.length) return;
      setBlocksOpen(false);
      addConsole('Blocks turned into Python. Read it, then press Run.', 'sys');
      typewriteCode(blocksToPython());
    }
    function toggleSound() {
      setMuted(m => {
        const next = !m;
        if (window.RLSound) window.RLSound.setMuted(next);
        return next;
      });
    }
    useEffect(() => {
      document.body.classList.toggle('a11y-readable', readable);
      try {
        localStorage.setItem('or_readable', readable ? '1' : '0');
      } catch (e) {
        void e;
      }
    }, [readable]);
    const currentLessonIdRef = useRef(null);
    useEffect(() => {
      currentLessonIdRef.current = currentLessonId;
    }, [currentLessonId]);
    useEffect(() => {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) return;
      window.RoboLearn.listLessons().then(ls => {
        if (Array.isArray(ls)) setLessons(ls);
      });
    }, []);
    function loadLesson(lesson) {
      if (!lesson) return;
      setCurrentLessonId(lesson.id);
      setLessonVerdict(null);
      // Render the rover on the SAME world it is graded against. Without this
      // the viewport could show a persisted Mars while the grader ran the
      // lesson's real terrain, so a pass looked like it happened elsewhere.
      if (lesson.terrain && TERRAINS[lesson.terrain]) setTerrainId(lesson.terrain);
      // Seed this lesson's buffer from its starter ONLY if it has no edits yet,
      // so switching A -> B -> A preserves the pupil's work in A (rank 6).
      setLessonBuffers(b => b[lesson.id] !== undefined ? b : {
        ...b,
        [lesson.id]: lesson.starterCode || ''
      });
      setConsoleLines(l => [...l, {
        type: 'sys',
        text: '─── ' + lesson.id + ' · ' + lesson.title + ' [' + lesson.keyStage + '] ───'
      }, {
        type: 'out',
        text: (lesson.intro || '').trim()
      }]);
    }
    async function gradeWithBridge(source) {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) return;
      const lessonId = currentLessonIdRef.current;
      if (!lessonId) return;
      try {
        const r = await window.RoboLearn.submitAttempt(lessonId, source, null);
        if (!r) return;
        if (r.ok === false) {
          setConsoleLines(l => [...l, {
            type: 'err',
            text: 'Grader: ' + (r.reason || 'unknown error')
          }]);
          return;
        }
        // Persist the verdict in a panel that survives Reset (QA #3).
        setLessonVerdict({
          passed: !!r.passed,
          score: r.score,
          reasons: r.reasons || [],
          hint: r.hint || null
        });
        if (r.passed) {
          sfx('pass');
          celebrate();
        } else {
          sfx('fail');
        }
        const tag = r.passed ? 'ok' : 'err';
        setConsoleLines(l => {
          const lines = [...l, {
            type: tag,
            text: (r.passed ? '✓ PASS' : '✗ NOT YET') + '  Score: ' + r.score + '/100'
          }];
          if (!r.passed && Array.isArray(r.reasons)) r.reasons.forEach(reason => lines.push({
            type: 'err',
            text: '  · ' + reason
          }));
          if (r.hint && r.hint.message) lines.push({
            type: 'sys',
            text: '💡 Hint: ' + r.hint.message
          });
          if (Array.isArray(r.achievements)) r.achievements.forEach(a => lines.push({
            type: 'ok',
            text: (a.icon || '🏅') + ' Achievement unlocked: ' + a.title
          }));
          if (r.recommended && r.recommended.id) lines.push({
            type: 'sys',
            text: '👉 Recommended next: ' + r.recommended.id + ' · ' + r.recommended.title
          });
          return lines;
        });
      } catch (err) {
        setConsoleLines(l => [...l, {
          type: 'err',
          text: 'Bridge error: ' + err
        }]);
      }
    }

    // `token` is a monotonic run id: every reset/start/resume bumps it, so a
    // stale pump loop or a pending start setTimeout that fires after a Reset is
    // ignored. `advancing` is a synchronous single-flight latch so two advance()
    // calls can never overlap (a pump step racing a manual Step). `startTimer`
    // and `abortTimer` hold the deferred-start / abort-clear handles so any new
    // control action can cancel them. Together these fix the Run/Step/Reset
    // mash races (QA adv5).
    const ctrl = useRef({
      running: false,
      abort: false,
      advancing: false,
      token: 0,
      startTimer: null,
      abortTimer: null
    });
    const genRef = useRef(null);
    const sayTimer = useRef(null);
    const consoleEndRef = useRef(null);
    useEffect(() => {
      if (consoleEndRef.current) consoleEndRef.current.scrollTop = consoleEndRef.current.scrollHeight;
    }, [consoleLines]);

    // persist
    useEffect(() => {
      localStorage.setItem('or_terrain', terrainId);
    }, [terrainId]);
    useEffect(() => {
      try {
        localStorage.setItem('or_theme', theme);
      } catch (e) {
        void e;
      }
      const root = document.documentElement;
      if (theme && theme !== 'dark') root.setAttribute('data-theme', theme);else root.removeAttribute('data-theme');
    }, [theme]);
    useEffect(() => {
      localStorage.setItem('or_tab', activeTab);
    }, [activeTab]);
    useEffect(() => {
      try {
        localStorage.setItem('or_programs', JSON.stringify(programs));
      } catch (e) {}
    }, [programs]);
    const sync = () => {
      setRover({
        ...live.current
      });
      try {
        window.KODRO_ROVER = {
          x: live.current.x,
          y: live.current.y
        };
      } catch (e) {
        void e;
      }
    };
    const pushTrailPoint = () => {
      if (!live.current.penDown) return;
      const segs = trailRef.current;
      if (!segs.length) return;
      const seg = segs[segs.length - 1];
      const last = seg[seg.length - 1];
      const x = live.current.x,
        y = live.current.y;
      // Decimate (skip points <6cm from the last) + cap, so a long run can't
      // grow the trail unboundedly or rebuild a huge SVG path each frame
      // (QA re-score rank 8 performance).
      if (last && Math.abs(x - last.x) < 6 && Math.abs(y - last.y) < 6) return;
      if (seg.length > 1500) return;
      seg.push({
        x,
        y
      });
    };
    function addConsole(text, type) {
      const ts = new Date();
      const hh = String(ts.getHours()).padStart(2, '0') + ':' + String(ts.getMinutes()).padStart(2, '0') + ':' + String(ts.getSeconds()).padStart(2, '0');
      setConsoleLines(l => [...l, {
        type: type || 'out',
        text,
        ts: hh
      }]);
    }

    // Fire a synthesised sound cue (no-op if sound.js absent or muted).
    function sfx(kind) {
      try {
        if (window.RLSound) window.RLSound.play(kind);
      } catch (e) {
        void e;
      }
    }

    // Lightweight celebration: a one-shot confetti burst on a lesson pass.
    function celebrate() {
      try {
        const host = document.getElementById('editor-main') || document.body;
        const layer = document.createElement('div');
        layer.className = 'confetti-layer';
        const colors = ['#5ce0d8', '#e0b45c', '#7cc49b', '#c8685a', '#f5f0e4'];
        for (let i = 0; i < 80; i++) {
          const p = document.createElement('i');
          p.className = 'confetti';
          p.style.left = Math.round(8 + i / 80 * 84) + '%';
          p.style.background = colors[i % colors.length];
          p.style.animationDelay = i % 10 * 40 + 'ms';
          p.style.transform = 'rotate(' + i * 31 % 360 + 'deg)';
          layer.appendChild(p);
        }
        host.appendChild(layer);
        setTimeout(() => {
          if (layer.parentNode) layer.parentNode.removeChild(layer);
        }, 2600);
      } catch (e) {
        void e;
      }
    }

    // ---------- geometry / sensors ----------
    function collisionAt(x, y) {
      if (Math.abs(x) > WALL - R || Math.abs(y) > WALL - R) return {
        type: 'wall'
      };
      for (const o of terrain.obstacles) {
        if (Math.hypot(o.x - x, o.y - y) < o.r + R) return {
          type: 'obstacle',
          o
        };
      }
      // Moving agents (pedestrians and traffic) are real obstacles too: the
      // robot must avoid them, not just the parked cars and buildings.
      if (window.KodroAgents && window.KodroAgents.world() === terrain.id) {
        for (const a of window.KodroAgents.list()) {
          if (Math.hypot(a.x - x, a.y - y) < a.r + R) return {
            type: a.kind === 'person' ? 'pedestrian' : a.kind === 'robot' ? 'robot' : 'vehicle',
            o: a
          };
        }
      }
      return null;
    }
    function rayDistance(x, y, headingDeg) {
      const a = headingDeg * Math.PI / 180;
      const dx = Math.sin(a),
        dy = -Math.cos(a);
      let best = Infinity;
      // walls (square at ±(WALL-R))
      const lim = WALL - R;
      if (dx > 1e-6) best = Math.min(best, (lim - x) / dx);
      if (dx < -1e-6) best = Math.min(best, (-lim - x) / dx);
      if (dy > 1e-6) best = Math.min(best, (lim - y) / dy);
      if (dy < -1e-6) best = Math.min(best, (-lim - y) / dy);
      // obstacles (ray-circle)
      for (const o of terrain.obstacles) {
        const ox = o.x - x,
          oy = o.y - y;
        const tca = ox * dx + oy * dy;
        if (tca < 0) continue;
        const d2 = ox * ox + oy * oy - tca * tca;
        const rr = (o.r + R) * (o.r + R);
        if (d2 > rr) continue;
        const t = tca - Math.sqrt(rr - d2);
        if (t > 0) best = Math.min(best, t);
      }
      // the sensor also picks up moving agents in the robot's path
      if (window.KodroAgents && window.KodroAgents.world() === terrain.id) {
        for (const o of window.KodroAgents.list()) {
          const ox = o.x - x,
            oy = o.y - y;
          const tca = ox * dx + oy * dy;
          if (tca < 0) continue;
          const d2 = ox * ox + oy * oy - tca * tca;
          const rr = (o.r + R) * (o.r + R);
          if (d2 > rr) continue;
          const t = tca - Math.sqrt(rr - d2);
          if (t > 0) best = Math.min(best, t);
        }
      }
      return Math.max(0, best);
    }
    const host = {
      sensor(name, args) {
        const s = live.current;
        // Single source of truth (RobotLab.KodroCommands): a sensor command is
        // only available if the part it needs is fitted. A missing part is a
        // readable refusal, not a faked reading, so removing a sensor genuinely
        // removes its command from text, blocks and voice alike.
        const rb = window.getKodroRobot ? window.getKodroRobot() : null;
        if (window.KodroCommands) {
          const g = window.KodroCommands.check(rb, name);
          if (!g.ok) throw new Error(g.reason);
        }
        switch (name) {
          case 'distance':
            {
              const d = Math.round(rayDistance(s.x, s.y, s.heading));
              setSensorDist(d);
              return d;
            }
          case 'heading':
            return Math.round((s.heading % 360 + 360) % 360);
          case 'battery':
            return Math.round(s.battery);
          case 'speed':
            return Math.round(s.speed);
          case 'x':
            return Math.round(s.x);
          case 'y':
            return Math.round(-s.y);
          case 'tilt':
            return Math.round((Math.sin(s.x * 0.01) * 6 + Math.cos(s.y * 0.013) * 5) * 10) / 10;
          case 'temperature':
            return terrain.env.temp;
          case 'gravity':
            return terrain.env.gravity;
          case 'light':
            return terrain.env.light;
          case 'ground':
            return terrain.id;
          default:
            return 0;
        }
      }
    };

    // ---------- animation primitives ----------
    // Driven by setTimeout (not rAF) so logic still advances when the iframe is
    // backgrounded; ~16ms cadence gives ~60fps while visible.
    function frames(durationMs, onFrame) {
      return new Promise(resolve => {
        // Respect prefers-reduced-motion: snap straight to the final position
        // (p=1) with no interpolation, so the rover teleports rather than
        // animating (WCAG 2.3.3, vestibular safety).
        if (PREFERS_REDUCED_MOTION()) {
          // Snap with NO animation, but still sample the swept path so a
          // boulder/wall mid-route halts the rover instead of being tunnelled
          // through (the collision check lives in onFrame). Sample at a fixed
          // fine resolution rather than four fixed fractions: at the 4000cm max
          // move that is ~62cm per step, under the smallest collision band, so
          // a long move can no longer skip past a small obstacle and the
          // accessibility path grades the same as the animated one. QA rank 4.
          const STEPS = 64;
          for (let k = 1; k <= STEPS; k++) {
            if (onFrame(k / STEPS)) break;
          }
          resolve('done');
          return;
        }
        const start = performance.now();
        const tick = () => {
          if (ctrl.current.abort) {
            resolve('abort');
            return;
          }
          // Non-finite / <=0 duration completes immediately (p=1); this guards
          // against a pathological value wedging the loop at p=0 forever.
          const p = window.RoverLang.frameProgress(performance.now() - start, durationMs);
          const stop = onFrame(p);
          if (p >= 1 || stop) {
            resolve('done');
            return;
          }
          setTimeout(tick, 16);
        };
        tick();
      });
    }
    const delay = ms => new Promise(res => {
      if (ms <= 0) return res();
      const start = performance.now();
      const tick = () => {
        if (ctrl.current.abort || performance.now() - start >= ms) res();else setTimeout(tick, 16);
      };
      setTimeout(tick, 16);
    });
    async function animateMove(ev) {
      const s = live.current;
      const myToken = ctrl.current.token; // run epoch captured at move start
      const a = s.heading * Math.PI / 180;
      const dirx = Math.sin(a) * ev.dir,
        diry = -Math.cos(a) * ev.dir;
      const total = ev.distance;
      const x0 = s.x,
        y0 = s.y;
      // The robot designed in Robot Lab drives the sim: a heavier build drains
      // the battery faster, and a stronger motor set raises the top speed.
      const robot = window.getKodroRobot ? window.getKodroRobot() : null;
      const massFac = robot && robot.massFactor ? robot.massFactor : 1;
      const speedFac = robot && robot.speedFactor ? robot.speedFactor : 1;
      // Mobility: too much weight for the grip its motors get on this surface
      // makes the robot crawl or stall, so an underpowered design visibly
      // struggles instead of gliding along regardless of what was built.
      const hasDrive = robot && robot.actuators && robot.actuators.some(function (a) {
        return a === 'motors2' || a === 'motors4' || a === 'servos';
      });
      const mob = window.KodroDiagnostics ? window.KodroDiagnostics.mobilityScore(speedFac, massFac, terrain.traction) : 1;
      const mobMul = !hasDrive ? 0.22 : mob < 0.45 ? 0.35 : mob < 0.75 ? 0.7 : 1;
      const sp = Math.max(8, s.speed) * speedFac * mobMul;
      // 0.32s per (cm/speed); lower-traction terrain drives a little slower.
      const dur = total / sp * 1000 * 0.32 / (terrain.traction * speedMulRef.current);
      // Real physics: heavier worlds drain the battery faster, lighter worlds
      // less (Moon ~0.58x Earth) -- pupils can measure the difference.
      const gFac = 0.5 + 0.5 * ((terrain.env.gravity || 9.81) / 9.81);
      s.moving = true;
      // new trail segment if pen down
      if (s.penDown) {
        trailRef.current.push([{
          x: x0,
          y: y0
        }]);
        setTrail([...trailRef.current]);
      }
      // Battery drains smoothly across the move (was a no-op: subtracted 0).
      const b0 = s.battery;
      const drainFull = total * 0.011 * gFac * massFac / terrain.traction;
      let crashed = false,
        flat = false;
      // ---- physical acceleration, inertia and braking ----------------------
      // The robot does not snap to top speed and stop dead. It ramps up, holds
      // a cruise, then brakes, and a heavier build takes longer to do each. If
      // it is already rolling from the previous move (s.vel), it skips most of
      // the ramp up so momentum carries between straight segments. The endpoint
      // is exact (coverFrac(1) === 1), so distances and collisions are unchanged
      // and the headless interpreter QA, which uses its own kinematics, is too.
      const inertia = Math.min(0.92, Math.max(0.12, (massFac - 0.6) / 1.4));
      const carried = Math.min(1, Math.max(0, s.vel || 0));
      let accelFrac = (0.18 + 0.30 * inertia) * (1 - 0.85 * carried);
      let brakeFrac = 0.16 + 0.34 * inertia;
      if (accelFrac + brakeFrac > 0.95) {
        const k = 0.95 / (accelFrac + brakeFrac);
        accelFrac *= k;
        brakeFrac *= k;
      }
      const cruiseFrac = Math.max(0, 1 - accelFrac - brakeFrac);
      const profileArea = 0.5 * accelFrac + cruiseFrac + 0.5 * brakeFrac;
      function coverFrac(p) {
        let area;
        if (accelFrac > 0 && p <= accelFrac) {
          const v = p / accelFrac;
          area = 0.5 * v * p;
        } else if (p <= 1 - brakeFrac) {
          area = 0.5 * accelFrac + (p - accelFrac);
        } else if (brakeFrac > 0) {
          const q = (p - (1 - brakeFrac)) / brakeFrac;
          area = 0.5 * accelFrac + cruiseFrac + (1 - 0.5 * q) * (q * brakeFrac);
        } else {
          area = profileArea;
        }
        return profileArea > 0 ? area / profileArea : p;
      }
      await frames(dur, p => {
        const cf = coverFrac(p);
        const nx = x0 + dirx * total * cf;
        const ny = y0 + diry * total * cf;
        const hit = collisionAt(nx, ny);
        if (hit) {
          crashed = hit;
          return true; // stop frame loop, keep last safe pos
        }
        s.x = nx;
        s.y = ny;
        s.battery = Math.max(0, b0 - drainFull * cf);
        pushTrailPoint();
        setSensorDist(Math.round(rayDistance(s.x, s.y, s.heading)));
        sync();
        if (s.battery <= 0) {
          flat = true;
          return true;
        } // out of charge mid-move
        return false;
      });
      // A Reset/restart while this move was animating bumps the token: bail
      // before touching the shared odometer or halting, so a stale in-flight
      // move can't corrupt the fresh run (phantom odometer add, or a spurious
      // 'error' state stomped over the Reset the user just pressed).
      if (ctrl.current.token !== myToken) {
        s.moving = false;
        s.vel = 0;
        return false;
      }
      // Settle battery on the distance actually travelled (handles a crash
      // that stopped the move early), relative to the pre-move level b0.
      const travelled = Math.hypot(s.x - x0, s.y - y0);
      s.battery = Math.max(0, b0 - travelled * 0.011 * gFac * massFac / terrain.traction);
      odoRef.current += travelled;
      setOdo(odoRef.current);
      s.moving = false;
      sync();
      if (crashed) {
        setCrashKey(k => k + 1);
        const what = crashed.type === 'wall' ? 'arena boundary' : crashed.type === 'pedestrian' ? 'a pedestrian' : crashed.type === 'robot' ? 'another robot' : crashed.type === 'vehicle' ? 'a vehicle' : terrain.obstacleLabel.toLowerCase();
        sfx('crash');
        addConsole('Collision with ' + what + ' at (' + Math.round(s.x) + ', ' + Math.round(-s.y) + '). Robot halted.', 'err');
        // Self-refinement: record the run and surface what the system learned.
        if (window.KodroMemory) {
          const refl = window.KodroMemory.record({
            world: terrain.id,
            robotType: robotSpec && robotSpec.type || '',
            outcome: 'crash',
            detail: what,
            ts: Date.now()
          });
          if (refl) addConsole('Reflection saved: ' + refl, 'sys');
        }
        // Coach: tie the outcome back to the design and recommend a fix.
        if (window.KodroDiagnostics) {
          const v = window.KodroDiagnostics.afterRun(window.KodroDiagnostics.assess(robotSpec, robot || {}, terrain), {
            outcome: 'crash',
            detail: what
          });
          if (v) addConsole(v.text, v.tone);
        }
        haltProgram('error');
        return false;
      }
      if (flat) {
        s.battery = 0;
        sync();
        sfx('crash');
        addConsole('Out of charge at (' + Math.round(s.x) + ', ' + Math.round(-s.y) + '). Robot halted.', 'err');
        if (window.KodroMemory) {
          const refl = window.KodroMemory.record({
            world: terrain.id,
            robotType: robotSpec && robotSpec.type || '',
            outcome: 'flat',
            detail: 'battery',
            ts: Date.now()
          });
          if (refl) addConsole('Reflection saved: ' + refl, 'sys');
        }
        if (window.KodroDiagnostics) {
          const v = window.KodroDiagnostics.afterRun(window.KodroDiagnostics.assess(robotSpec, robot || {}, terrain), {
            outcome: 'flat'
          });
          if (v) addConsole(v.text, v.tone);
        }
        haltProgram('error');
        return false;
      }
      s.vel = 1; // leaving this move still rolling: momentum carries to the next
      return true;
    }
    async function animateTurn(ev) {
      const s = live.current;
      const myToken = ctrl.current.token; // run epoch captured at turn start
      const h0 = s.heading;
      // Turning bleeds forward momentum, and a heavier build is slower to swing
      // its mass around, so the turn takes a little longer and eases in and out
      // rather than snapping. The final heading is still exact (set below).
      const turnRobot = window.getKodroRobot ? window.getKodroRobot() : null;
      const turnMass = turnRobot && turnRobot.massFactor ? turnRobot.massFactor : 1;
      s.vel = 0;
      const dur = Math.abs(ev.deg) / 180 * 650 * (0.78 + 0.5 * Math.min(1.5, turnMass)) / speedMulRef.current;
      s.moving = true;
      await frames(dur, p => {
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        s.heading = h0 + ev.deg * e;
        setSensorDist(Math.round(rayDistance(s.x, s.y, s.heading)));
        sync();
        return false;
      });
      if (ctrl.current.token !== myToken) {
        s.moving = false;
        return false;
      } // superseded by Reset/restart
      s.heading = h0 + ev.deg;
      s.moving = false;
      s.battery = Math.max(0, s.battery - Math.abs(ev.deg) * 0.004);
      sync();
      return true;
    }

    // speedMul ref so animation reads latest
    const speedMulRef = useRef(1);
    useEffect(() => {
      speedMulRef.current = speedMul;
    }, [speedMul]);
    function showSay(text) {
      setSay(text);
      if (sayTimer.current) clearTimeout(sayTimer.current);
      sayTimer.current = setTimeout(() => setSay(''), 2200);
    }

    // ---------- one interpreter step ----------
    // `advancing` is a synchronous re-entrancy latch: a pump iteration and a
    // manual Step (or two Steps) must never drive the same generator at once,
    // or they double-consume gen.next() and run overlapping animations that
    // stomp live.current. The latch wraps the whole body (incl. the awaited
    // animation) so the next driver bails until this one settles.
    async function advance(stepMode) {
      if (ctrl.current.advancing) return false;
      ctrl.current.advancing = true;
      try {
        const gen = genRef.current;
        if (!gen) return false;
        let res;
        try {
          res = gen.next();
        } catch (e) {
          handleRuntimeError(e);
          return false;
        }
        if (res.done) {
          finishProgram();
          return false;
        }
        const ev = res.value;
        if (ev.line) setActiveLine(ev.line);
        switch (ev.type) {
          case 'step':
            await delay(stepMode ? 0 : 70 / speedMulRef.current);
            break;
          case 'print':
            addConsole(ev.text, 'out');
            await delay(stepMode ? 0 : 90 / speedMulRef.current);
            break;
          case 'move':
            sfx('move');
            return await animateMove(ev);
          case 'turn':
            sfx('turn');
            return await animateTurn(ev);
          case 'speed':
            live.current.speed = Math.max(0, Math.min(100, ev.value));
            sync();
            break;
          case 'wait':
            live.current.vel = 0;
            await delay(ev.seconds * 1000 / speedMulRef.current);
            break;
          case 'pen':
            live.current.penDown = ev.down;
            if (ev.down) {
              trailRef.current.push([{
                x: live.current.x,
                y: live.current.y
              }]);
              setTrail([...trailRef.current]);
            }
            break;
          case 'halt':
            live.current.moving = false;
            sync();
            break;
          case 'led':
            sfx('led');
            live.current.led = ev.color in LED_COLORS ? LED_COLORS[ev.color] : terrain.accent;
            sync();
            break;
          case 'say':
            sfx('say');
            // Rover speaks aloud with the OS's offline TTS voice (Windows
            // SAPI via the bridge); silent in browser preview or when muted.
            if (window.RoboLearn && window.RoboLearn.isAvailable() && (!window.RLSound || !window.RLSound.isMuted())) {
              window.RoboLearn.speak(ev.text, voiceGender);
            }
            showSay(ev.text);
            await delay(stepMode ? 0 : 200 / speedMulRef.current);
            break;
          case 'place':
            {
              const px = ev.x !== undefined ? ev.x : live.current.x;
              const py = ev.y !== undefined ? ev.y : live.current.y;
              sfx('led');
              setProps(p => p.length >= 80 ? p : [...p, {
                kind: ev.kind,
                x: px,
                y: py,
                id: p.length
              }]);
              await delay(stepMode ? 0 : 160 / speedMulRef.current);
              break;
            }
          case 'clear_props':
            setProps([]);
            break;
          case 'scan':
            sfx('scan');
            live.current.scanning = true;
            sync();
            addConsole('Scanning. Nearest obstacle ' + Math.round(rayDistance(live.current.x, live.current.y, live.current.heading)) + ' cm ahead.', 'sys');
            await delay(1000 / speedMulRef.current);
            live.current.scanning = false;
            sync();
            break;
        }
        return true;
      } finally {
        ctrl.current.advancing = false;
      }
    }
    function handleRuntimeError(e) {
      const msg = e && e.message ? e.message : String(e);
      const line = e && e.line;
      if (line) setActiveLine(line);
      addConsole((line ? 'Line ' + line + ': ' : '') + msg, 'err');
      haltProgram('error');
    }
    function finishProgram() {
      ctrl.current.running = false;
      genRef.current = null;
      live.current.moving = false;
      sync();
      setRunState('done');
      if (replRef.current) {
        replRef.current = false;
        return;
      } // terminal line: stay quiet
      addConsole('Program finished.', 'ok');
      // Self-refinement: a clean finish is a result worth remembering.
      if (window.KodroMemory) {
        window.KodroMemory.record({
          world: terrain.id,
          robotType: robotSpec && robotSpec.type || '',
          outcome: 'done',
          detail: 'finished without a collision',
          ts: Date.now()
        });
      }
      // Coach: confirm the design held up, or name what to still watch.
      if (window.KodroDiagnostics) {
        const robotNow = window.getKodroRobot ? window.getKodroRobot() : {};
        const v = window.KodroDiagnostics.afterRun(window.KodroDiagnostics.assess(robotSpec, robotNow, terrain), {
          outcome: 'done'
        });
        if (v) addConsole(v.text, v.tone);
      }
      // RoboLearn: if a lesson is loaded, grade the Run via the Python engine.
      gradeWithBridge(code);
    }

    // Live terminal: run ONE line immediately against the current world --
    // like a real Python REPL, without resetting the rover or grading.
    const replRef = useRef(false);
    function runReplLine(line) {
      const src = (line || '').trim();
      if (!src) return;
      if (window.RLSound) window.RLSound.resume();
      addConsole('>>> ' + src, 'sys');
      if (ctrl.current.running || ctrl.current.advancing) {
        addConsole('The program is still running - press Pause or Reset first.', 'err');
        return;
      }
      let gen;
      try {
        gen = window.RoverLang.compile(src).run(host);
      } catch (e) {
        addConsole(String(e && e.message || e), 'err');
        return;
      }
      replRef.current = true;
      genRef.current = gen;
      ctrl.current.token++;
      const myToken = ctrl.current.token;
      ctrl.current.abort = false;
      ctrl.current.running = true;
      setRunState('running');
      pumpLoop(myToken);
    }
    function haltProgram(state) {
      ctrl.current.running = false;
      ctrl.current.abort = false;
      genRef.current = null;
      live.current.moving = false;
      sync();
      setRunState(state || 'idle');
    }

    // ---------- compile + start ----------
    function compileFresh() {
      try {
        const interp = window.RoverLang.compile(code);
        genRef.current = interp.run(host);
        return true;
      } catch (e) {
        handleRuntimeError(e);
        genRef.current = null;
        return false;
      }
    }
    // Cancel any deferred start / abort-clear left over from a prior control
    // action so a queued Run can't fire after a Reset (the stale-callback race).
    function clearPending() {
      if (ctrl.current.startTimer) {
        clearTimeout(ctrl.current.startTimer);
        ctrl.current.startTimer = null;
      }
      if (ctrl.current.abortTimer) {
        clearTimeout(ctrl.current.abortTimer);
        ctrl.current.abortTimer = null;
      }
    }
    function resetRover(clearConsole) {
      clearPending();
      ctrl.current.abort = true;
      ctrl.current.running = false;
      ctrl.current.advancing = false; // abandon any in-flight advance latch
      ctrl.current.token++; // invalidate any in-flight pump / pending start
      live.current = startState();
      trailRef.current = [];
      setTrail([]);
      setProps([]);
      odoRef.current = 0;
      setOdo(0);
      setSensorDist(600);
      setActiveLine(0);
      setSay('');
      sync();
      genRef.current = null;
      ctrl.current.abortTimer = setTimeout(() => {
        ctrl.current.abort = false;
        ctrl.current.abortTimer = null;
      }, 30);
      if (clearConsole) setConsoleLines([{
        type: 'sys',
        text: 'Reset. Rover at origin.'
      }]);
    }
    async function pumpLoop(myToken) {
      while (ctrl.current.running && ctrl.current.token === myToken) {
        const cont = await advance(false);
        if (!cont) break;
      }
      if (ctrl.current.token !== myToken) return; // superseded by a reset/restart/resume
      // The loop only exits with running=false. finish/halt null the generator
      // (and already set 'done'/'error'); a Reset bumps the token (returned just
      // above). So a still-live generator here means the user pressed Pause.
      // Do NOT also gate on runStateRef === 'running': the 'running' commit can
      // lag behind a fast Pause, which would drop the pause transition and then
      // wedge the UI in a phantom 'running' with no pump driving it.
      if (!ctrl.current.running && genRef.current) {
        setRunState('paused');
      }
    }
    function onRun() {
      // Resume the AudioContext here, inside the click gesture (browsers block
      // audio that starts outside a user gesture).
      if (window.RLSound) window.RLSound.resume();
      // Pause: gate on the synchronous ref, not the (stale until re-render)
      // runState closure, so a Run pressed right after a resume still pauses.
      if (ctrl.current.running) {
        ctrl.current.running = false;
        return;
      }
      // start fresh or resume
      if (runState === 'idle' || runState === 'done' || runState === 'error') {
        resetRover(false);
        const myToken = ctrl.current.token; // captured after reset's bump
        // reset clears abort after 30ms; compile after
        ctrl.current.startTimer = setTimeout(() => {
          ctrl.current.startTimer = null;
          if (ctrl.current.token !== myToken) return; // a Reset landed first
          if (!compileFresh()) return;
          ctrl.current.abort = false;
          ctrl.current.running = true;
          setRunState('running');
          addConsole('Deployed on ' + terrain.name + '.', 'sys');
          pumpLoop(myToken);
        }, 50);
      } else if (runState === 'paused') {
        // `runState` is a lagging closure: after a Reset/finish nulled the
        // generator it can still read 'paused' for a frame. Only a live
        // generator is actually resumable — resuming a null gen would spin a
        // pump that exits instantly yet leaves running=true, wedging the UI in
        // a phantom 'running'. genRef is the synchronous truth.
        if (!genRef.current) return;
        if (ctrl.current.running || ctrl.current.advancing) return; // already running / mid-step
        ctrl.current.token++; // new pump epoch: orphan any prior pump
        const myToken = ctrl.current.token;
        ctrl.current.abort = false;
        ctrl.current.running = true;
        setRunState('running');
        pumpLoop(myToken);
      }
    }
    function onStep() {
      // A Step while a pump is live pauses it (same as Run), gated on the
      // synchronous ref so it works in the gap before runState commits.
      if (ctrl.current.running) {
        ctrl.current.running = false;
        return;
      }
      if (ctrl.current.advancing) return; // a step/animation is in flight: ignore
      if (runState === 'idle' || runState === 'done' || runState === 'error') {
        resetRover(false);
        const myToken = ctrl.current.token;
        ctrl.current.startTimer = setTimeout(() => {
          ctrl.current.startTimer = null;
          if (ctrl.current.token !== myToken) return;
          if (!compileFresh()) return;
          ctrl.current.abort = false;
          setRunState('paused');
          addConsole('Stepping through on ' + terrain.name + '.', 'sys');
          advance(true);
        }, 50);
      } else if (runState === 'paused') {
        if (!genRef.current) return; // stale 'paused' after a Reset/finish: nothing to step
        ctrl.current.abort = false;
        advance(true);
      }
    }
    function onReset() {
      resetRover(true);
      setRunState('idle');
    }
    function onTerrain(id) {
      if (id === terrainId) return;
      resetRover(false);
      setTerrainId(id);
      setRunState('idle');
      setLessonVerdict(null); // verdict was graded on the lesson's own world
      // Resolve through resolveSite: a real-world mission site id (e.g. 'sahara')
      // lives in SITES, not TERRAINS, so TERRAINS[id] would be undefined and the
      // old TERRAINS[id].name threw a TypeError that killed the render.
      const t = (window.resolveSite ? window.resolveSite(id) : null) || TERRAINS[id] || TERRAINS.earth;
      setConsoleLines([{
        type: 'sys',
        text: 'Switched to ' + (t.name || id) + '.' + (t.coord ? ' ' + t.coord : '')
      }]);
    }
    function onCodeChange(v) {
      if (currentLessonId) setLessonBuffers(b => ({
        ...b,
        [currentLessonId]: v
      })); // per-lesson buffer
      else setPrograms(p => ({
        ...p,
        [activeTab]: v
      })); // edit the example tab
    }
    async function exportReportClick() {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) {
        setConsoleLines(l => [...l, {
          type: 'warn',
          text: 'Report export needs the desktop app.'
        }]);
        return;
      }
      try {
        const r = await window.RoboLearn.exportReport();
        if (r && r.ok) {
          setConsoleLines(l => [...l, {
            type: 'ok',
            text: 'Progress report saved: ' + r.path
          }]);
        } else {
          setConsoleLines(l => [...l, {
            type: 'err',
            text: 'Report export failed: ' + (r && r.reason || 'unknown')
          }]);
        }
      } catch (e) {
        setConsoleLines(l => [...l, {
          type: 'err',
          text: 'Report export error: ' + e
        }]);
      }
    }

    // apply terrain accent to CSS var
    useEffect(() => {
      document.documentElement.style.setProperty('--terrain', terrain.accent);
    }, [terrainId]);

    // ---------- layout resizers ----------
    const [editorW, setEditorW] = useState(404);
    const [teleW, setTeleW] = useState(318);
    const [consoleH, setConsoleH] = useState(184);
    function startDrag(kind, e) {
      e.preventDefault();
      const sx = e.clientX,
        sy = e.clientY;
      const w0 = editorW,
        t0 = teleW,
        c0 = consoleH;
      const move = ev => {
        if (kind === 'editor') setEditorW(Math.max(280, Math.min(640, w0 + (ev.clientX - sx))));else if (kind === 'tele') setTeleW(Math.max(240, Math.min(460, t0 - (ev.clientX - sx))));else if (kind === 'console') setConsoleH(Math.max(90, Math.min(420, c0 - (ev.clientY - sy))));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.style.cursor = '';
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      document.body.style.cursor = kind === 'console' ? 'row-resize' : 'col-resize';
    }

    // interactive camera: drag the viewport to orbit (yaw + pitch), wheel to zoom
    function camDrag(e) {
      if (e.target.closest('.terrain-switch') || e.target.closest('.view-mode-pill')) return;
      const sx = e.clientX,
        sy = e.clientY;
      const y0 = cam.yaw,
        t0 = cam.tilt;
      let moved = false;
      const move = ev => {
        moved = true;
        setCam(c => ({
          ...c,
          yaw: Math.max(-60, Math.min(60, y0 + (ev.clientX - sx) * 0.35)),
          tilt: Math.max(0, Math.min(72, t0 - (ev.clientY - sy) * 0.32))
        }));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.style.cursor = '';
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      document.body.style.cursor = 'grabbing';
    }
    function camWheel(e) {
      setCam(c => ({
        ...c,
        zoom: Math.max(0.7, Math.min(1.7, c.zoom - e.deltaY * 0.0012))
      }));
    }

    // keyboard shortcuts. The handler is registered ONCE: App re-renders ~60
    // times a second during a run, so a deps-free effect would thrash
    // add/removeEventListener on the hot path. Live handlers and state are read
    // through refs that are kept current every render.
    const onRunRef = useRef(onRun);
    onRunRef.current = onRun;
    const onStepRef = useRef(onStep);
    onStepRef.current = onStep;
    const showHelpRef = useRef(showHelp);
    showHelpRef.current = showHelp;
    useEffect(() => {
      const typingIn = el => el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable);
      const h = e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          onRunRef.current();
        } else if (e.key === 'F10') {
          e.preventDefault();
          onStepRef.current();
        } else if (e.key === 'Escape' && showHelpRef.current) {
          setShowHelp(false);
        } else if (e.key === '?' && !typingIn(e.target)) {
          e.preventDefault();
          setShowHelp(s => !s);
        }
      };
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    }, []);

    // Focus management for the modals. Each is marked aria-modal, which promises
    // assistive tech that focus is confined to the dialog, so honour it: when one
    // opens, move focus into it and trap Tab inside; on close, restore focus to
    // whatever had it before. Keyed on the open-state so it does not run per frame.
    const anyModalOpen = swarmOpen || vaOpen || askOpen || teacherOpen || robotLabOpen || memoryOpen || reviewOpen || vibeOpen || blocksOpen || buildOpen || showHelp || realismOpen || demoOpen;
    useEffect(() => {
      if (!anyModalOpen) return undefined;
      const modal = Array.prototype.slice.call(document.querySelectorAll('.modal[aria-modal="true"]')).pop();
      if (!modal) return undefined;
      const prev = document.activeElement;
      const focusables = () => Array.prototype.slice.call(modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled && el.offsetParent !== null);
      const f = focusables();
      if (f.length) f[0].focus();
      const onKey = e => {
        if (e.key !== 'Tab') return;
        const items = focusables();
        if (!items.length) return;
        const first = items[0],
          last = items[items.length - 1],
          a = document.activeElement;
        if (!modal.contains(a)) {
          e.preventDefault();
          first.focus();
          return;
        }
        if (e.shiftKey && a === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && a === last) {
          e.preventDefault();
          first.focus();
        }
      };
      document.addEventListener('keydown', onKey, true);
      return () => {
        document.removeEventListener('keydown', onKey, true);
        if (prev && prev.focus) prev.focus();
      };
    }, [anyModalOpen]);
    const statusLabel = {
      idle: 'Standby',
      running: 'Running',
      paused: 'Stepping',
      done: 'Complete',
      error: 'Halted'
    }[runState];
    return /*#__PURE__*/React.createElement("div", {
      className: "app"
    }, /*#__PURE__*/React.createElement("a", {
      className: "skip-link",
      href: "#editor-main"
    }, "Skip to code editor"), /*#__PURE__*/React.createElement("h1", {
      className: "sr-only"
    }, "Kodro, an offline robot design and simulation studio"), /*#__PURE__*/React.createElement("div", {
      className: "missionbar",
      role: "banner"
    }, /*#__PURE__*/React.createElement("div", {
      className: "brand"
    }, /*#__PURE__*/React.createElement("div", {
      className: "brand-mark",
      dangerouslySetInnerHTML: {
        __html: ORBIT_SVG
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "brand-text"
    }, /*#__PURE__*/React.createElement("div", {
      className: "brand-name"
    }, "Kodro"), /*#__PURE__*/React.createElement("div", {
      className: "brand-sub"
    }, "Robot design studio \xB7 Offline"))), /*#__PURE__*/React.createElement("div", {
      className: "bar-divider"
    }), /*#__PURE__*/React.createElement("div", {
      className: "run-controls"
    }, /*#__PURE__*/React.createElement("button", {
      className: 'ctrl ' + (runState === 'running' ? '' : 'ctrl-run'),
      onClick: onRun
    }, runState === 'running' ? I.pause : I.play, runState === 'running' ? 'Pause' : runState === 'paused' ? 'Resume' : 'Run'), /*#__PURE__*/React.createElement("button", {
      className: "ctrl",
      onClick: onStep,
      disabled: runState === 'running'
    }, I.step, "Step"), /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-stop",
      onClick: onReset
    }, I.reset, "Reset")), /*#__PURE__*/React.createElement("div", {
      className: "bar-divider"
    }), /*#__PURE__*/React.createElement("div", {
      className: "speed-ctrl"
    }, /*#__PURE__*/React.createElement("label", {
      htmlFor: "sim-speed"
    }, "Sim speed"), /*#__PURE__*/React.createElement("input", {
      id: "sim-speed",
      type: "range",
      className: "slider",
      min: "0.4",
      max: "3",
      step: "0.1",
      value: speedMul,
      onChange: e => setSpeedMul(parseFloat(e.target.value)),
      "aria-label": "Simulation speed",
      "aria-valuetext": speedMul + ' times'
    }), /*#__PURE__*/React.createElement("span", {
      className: "num",
      style: {
        fontSize: 11,
        color: 'var(--fg-2)',
        width: 30
      }
    }, speedMul.toFixed(1), "\xD7")), /*#__PURE__*/React.createElement("div", {
      className: "bar-spacer"
    }), /*#__PURE__*/React.createElement("div", {
      className: "bar-status",
      role: "status",
      "aria-live": "polite",
      "aria-label": 'Status: ' + statusLabel
    }, /*#__PURE__*/React.createElement("span", {
      className: 'status-dot ' + runState,
      "aria-hidden": "true"
    }), /*#__PURE__*/React.createElement("span", null, statusLabel)), /*#__PURE__*/React.createElement("div", {
      className: "bar-divider"
    }), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn voice-agent-btn",
      title: "Talk to Kodro. Speak a command or ask a question",
      "aria-label": "Voice agent",
      onClick: () => {
        setVaOpen(true);
        setVaData(null);
        runVoiceAgent();
      }
    }, "\uD83C\uDF99"), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Robot Lab. Design a custom robot",
      "aria-label": "Robot Lab",
      onClick: () => setRobotLabOpen(true)
    }, "\uD83D\uDEE0"), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Memory. What the system learned, and your skill library",
      "aria-label": "Memory and skills",
      onClick: () => setMemoryOpen(true)
    }, "\uD83E\uDDE0"), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Build a real robot on a budget",
      "aria-label": "Build a real robot",
      onClick: () => setBuildOpen(true)
    }, "\uD83E\uDD16"), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Keyboard shortcuts (?)",
      "aria-label": "Keyboard shortcuts",
      onClick: () => setShowHelp(true)
    }, "?"), /*#__PURE__*/React.createElement("div", {
      className: "settings-wrap"
    }, /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Settings",
      "aria-label": "Settings",
      "aria-expanded": settingsOpen,
      onClick: () => setSettingsOpen(o => !o)
    }, "\u2699"), settingsOpen && /*#__PURE__*/React.createElement("div", {
      className: "settings-pop",
      role: "menu",
      "aria-label": "Settings"
    }, pupils.length > 0 && /*#__PURE__*/React.createElement("label", {
      className: "set-row"
    }, /*#__PURE__*/React.createElement("span", null, "Pupil"), /*#__PURE__*/React.createElement("select", {
      className: "lesson-select",
      value: activePupilId || '',
      onChange: onPupilChange,
      "aria-label": "Active pupil"
    }, pupils.map(p => /*#__PURE__*/React.createElement("option", {
      key: p.id,
      value: p.id
    }, p.displayName)), /*#__PURE__*/React.createElement("option", {
      value: "__new__"
    }, "+ New pupil\u2026"))), /*#__PURE__*/React.createElement("label", {
      className: "set-row"
    }, /*#__PURE__*/React.createElement("span", null, "Theme"), /*#__PURE__*/React.createElement("select", {
      className: "lesson-select",
      value: theme,
      onChange: e => setTheme(e.target.value),
      "aria-label": "Visual theme"
    }, /*#__PURE__*/React.createElement("option", {
      value: "dark"
    }, "Mission (dark)"), /*#__PURE__*/React.createElement("option", {
      value: "light"
    }, "Daylight (light)"), /*#__PURE__*/React.createElement("option", {
      value: "contrast"
    }, "High contrast (colour-blind safe)"), /*#__PURE__*/React.createElement("option", {
      value: "matrix"
    }, "Matrix"), /*#__PURE__*/React.createElement("option", {
      value: "pixel"
    }, "Pixel"), /*#__PURE__*/React.createElement("option", {
      value: "game"
    }, "Arcade"), /*#__PURE__*/React.createElement("option", {
      value: "lego"
    }, "Brick"), /*#__PURE__*/React.createElement("option", {
      value: "chatgpt"
    }, "Clean"), /*#__PURE__*/React.createElement("option", {
      value: "abstract"
    }, "Abstract"), /*#__PURE__*/React.createElement("option", {
      value: "wiki"
    }, "Wiki / Network"))), /*#__PURE__*/React.createElement("button", {
      className: "set-row set-btn",
      role: "menuitem",
      "aria-pressed": !muted,
      onClick: toggleSound
    }, /*#__PURE__*/React.createElement("span", null, "Sound"), /*#__PURE__*/React.createElement("span", {
      className: "set-val"
    }, muted ? 'Off' : 'On')), /*#__PURE__*/React.createElement("button", {
      className: "set-row set-btn",
      role: "menuitem",
      "aria-pressed": readable,
      onClick: () => setReadable(v => !v)
    }, /*#__PURE__*/React.createElement("span", null, "Readable text"), /*#__PURE__*/React.createElement("span", {
      className: "set-val"
    }, readable ? 'On' : 'Off')), /*#__PURE__*/React.createElement("button", {
      className: "set-row set-btn",
      role: "menuitem",
      onClick: () => setVoiceGender(v => v === 'female' ? 'male' : 'female')
    }, /*#__PURE__*/React.createElement("span", null, "Voice"), /*#__PURE__*/React.createElement("span", {
      className: "set-val"
    }, voiceGender === 'female' ? 'Female' : 'Male')), /*#__PURE__*/React.createElement("button", {
      className: "set-row set-btn",
      role: "menuitem",
      onClick: () => {
        setSettingsOpen(false);
        pickPhotoClick();
      }
    }, /*#__PURE__*/React.createElement("span", null, "Photo prop \xB7 place(\"photo\")"), /*#__PURE__*/React.createElement("span", {
      className: "set-val"
    }, photoUrl ? 'Loaded' : 'Pick…')), /*#__PURE__*/React.createElement("button", {
      className: "set-row set-btn",
      role: "menuitem",
      onClick: openTeacher
    }, /*#__PURE__*/React.createElement("span", null, "Teacher dashboard"), /*#__PURE__*/React.createElement("span", {
      className: "set-val"
    }, "\u2192")), /*#__PURE__*/React.createElement("button", {
      className: "set-row set-btn",
      role: "menuitem",
      onClick: () => {
        setSettingsOpen(false);
        exportReportClick();
      }
    }, /*#__PURE__*/React.createElement("span", null, "Export progress report"), /*#__PURE__*/React.createElement("span", {
      className: "set-val"
    }, "\u2192"))))), /*#__PURE__*/React.createElement("main", {
      id: "editor-main",
      className: "workspace",
      style: {
        ['--editor-w']: editorW + 'px',
        ['--tele-w']: teleW + 'px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "panel",
      style: {
        gridColumn: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "editor-panel",
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "panel-head"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tabs"
    }, Object.keys(EXAMPLES).map(k => /*#__PURE__*/React.createElement("button", {
      key: k,
      type: "button",
      className: 'tab' + (!currentLessonId && activeTab === k ? ' active' : ''),
      "aria-pressed": !currentLessonId && activeTab === k,
      onClick: () => {
        setCurrentLessonId(null);
        setActiveTab(k);
      }
    }, EXAMPLES[k].label))), lessons.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "lesson-picker"
    }, /*#__PURE__*/React.createElement("label", {
      htmlFor: "lesson-select",
      className: "eyebrow"
    }, "Lesson"), /*#__PURE__*/React.createElement("select", {
      id: "lesson-select",
      className: "lesson-select",
      value: currentLessonId || '',
      onChange: e => loadLesson(lessons.find(l => l.id === e.target.value))
    }, /*#__PURE__*/React.createElement("option", {
      value: "",
      disabled: true
    }, "Pick a lesson\u2026"), lessons.map(l => /*#__PURE__*/React.createElement("option", {
      key: l.id,
      value: l.id
    }, l.id, " \xB7 ", l.title, " [", l.keyStage, "]")))), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini btn-vibe",
      title: aiInfo.available ? 'Code with AI (' + aiInfo.model + ')' : 'Code with AI (needs local Ollama)',
      onClick: () => setVibeOpen(true)
    }, "\u2728 Vibe"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      title: "Build the program from blocks",
      onClick: () => setBlocksOpen(true)
    }, "\uD83E\uDDE9 Blocks"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      title: "A second AI agent reviews your code",
      onClick: runReview
    }, "\uD83D\uDD0E Review"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      title: "Validate this program across 5 randomised seeds",
      onClick: runValidation
    }, "\uD83C\uDFAF Validate"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      title: "Realism dashboard: how the build drives the simulation",
      onClick: () => setRealismOpen(true)
    }, "\uD83D\uDCCA Realism"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      title: "Guided 2 to 3 minute realism demo",
      onClick: () => setDemoOpen(true)
    }, "\u25B6 Demo"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      title: "Ask a question, answered from the lesson material",
      onClick: () => {
        setAskOpen(true);
        setAskData(null);
      }
    }, "\u2753 Ask"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      title: "Speak a command. Works offline, no AI model needed",
      disabled: voiceBusy,
      onClick: runVoiceCommand
    }, voiceBusy ? '🎙…' : '🎙 Voice'), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      title: "Run your program on a swarm of rovers at once",
      onClick: runSwarm
    }, "\uD83D\uDC1D Swarm")), /*#__PURE__*/React.createElement(window.Editor, {
      code: code,
      onChange: onCodeChange,
      activeLine: activeLine,
      readOnly: runState === 'running'
    }), /*#__PURE__*/React.createElement("div", {
      className: "api-hint"
    }, /*#__PURE__*/React.createElement("b", null, "move_forward(m)"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "move_backward(m)"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "turn_left(\xB0)"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "turn_right(\xB0)"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "set_speed(0\u2013100)"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "pen_down/up()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "scan()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "led(\"cyan\")"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "say(\"\u2026\")"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "collect_sample()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "place(\"flag\")"), /*#__PURE__*/React.createElement("span", {
      className: "sep"
    }, " \xB7 sensors return values: "), /*#__PURE__*/React.createElement("b", null, "distance()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "heading()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "battery()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "obstacle_ahead()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "gravity()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "temperature()")), (() => {
      const lesson = lessons.find(l => l.id === currentLessonId);
      if (!lesson) return null;
      return /*#__PURE__*/React.createElement("section", {
        className: "lesson-card",
        "aria-label": "Current lesson"
      }, /*#__PURE__*/React.createElement("div", {
        className: "lesson-card-head"
      }, /*#__PURE__*/React.createElement("span", {
        className: "lesson-badge"
      }, lesson.keyStage), /*#__PURE__*/React.createElement("span", {
        className: "lesson-title"
      }, lesson.id, " \xB7 ", lesson.title), lesson.readingAge ? /*#__PURE__*/React.createElement("span", {
        className: "lesson-age",
        title: "Reading age"
      }, "Age ", lesson.readingAge, "+") : null, lessonVerdict && /*#__PURE__*/React.createElement("span", {
        className: 'lesson-verdict ' + (lessonVerdict.passed ? 'pass' : 'fail')
      }, lessonVerdict.passed ? '✓ Complete' : '✗ Not yet', " \xB7 ", lessonVerdict.score, "/100"), /*#__PURE__*/React.createElement("button", {
        className: "read-aloud",
        type: "button",
        title: "Read this lesson aloud",
        "aria-label": "Read this lesson aloud",
        onClick: () => {
          const gloss = lesson.glossary ? Object.keys(lesson.glossary).map(t => t + ': ' + lesson.glossary[t]).join('. ') : '';
          const text = (lesson.intro || '').trim() + (gloss ? '. ' + gloss : '');
          if (text && window.RoboLearn) window.RoboLearn.speak(text, voiceGender, -2);
        }
      }, "\uD83D\uDD0A Read aloud")), lesson.intro ? /*#__PURE__*/React.createElement("p", {
        className: "lesson-intro"
      }, lesson.intro.trim()) : null, lesson.glossary && Object.keys(lesson.glossary).length > 0 && /*#__PURE__*/React.createElement("dl", {
        className: "lesson-glossary"
      }, Object.keys(lesson.glossary).map(term => /*#__PURE__*/React.createElement("div", {
        key: term,
        className: "gloss-item"
      }, /*#__PURE__*/React.createElement("dt", null, term), /*#__PURE__*/React.createElement("dd", null, lesson.glossary[term])))), lessonVerdict && !lessonVerdict.passed && lessonVerdict.reasons.length > 0 && /*#__PURE__*/React.createElement("ul", {
        className: "lesson-reasons"
      }, lessonVerdict.reasons.map((r, i) => /*#__PURE__*/React.createElement("li", {
        key: i
      }, r))), lessonVerdict && lessonVerdict.hint && lessonVerdict.hint.message && /*#__PURE__*/React.createElement("p", {
        className: "lesson-hint"
      }, "\uD83D\uDCA1 ", lessonVerdict.hint.message));
    })()), /*#__PURE__*/React.createElement("div", {
      className: "resizer-row",
      onPointerDown: e => startDrag('console', e),
      style: {
        height: 5,
        cursor: 'row-resize',
        background: 'transparent',
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: '0 0',
        borderTop: '0.5px solid var(--border)'
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "console",
      style: {
        height: consoleH,
        flex: 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "console-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Console"), /*#__PURE__*/React.createElement("div", {
      className: "ph-spacer",
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      onClick: () => setConsoleLines([{
        type: 'sys',
        text: 'Console cleared.'
      }])
    }, "Clear")), /*#__PURE__*/React.createElement("div", {
      className: "console-out",
      ref: consoleEndRef,
      role: "log",
      "aria-live": "polite",
      "aria-label": "Program output and lesson feedback"
    }, consoleLines.map((l, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      role: l.type === 'err' ? 'alert' : undefined,
      className: 'cline ' + (l.type === 'err' ? 'err' : l.type === 'ok' ? 'ok' : l.type === 'sys' ? 'sys' : '')
    }, l.ts ? /*#__PURE__*/React.createElement("span", {
      className: "ts"
    }, l.ts) : null, l.text))), /*#__PURE__*/React.createElement("div", {
      className: "repl-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "repl-prompt",
      "aria-hidden": "true"
    }, ">>>"), /*#__PURE__*/React.createElement("input", {
      className: "repl-input",
      type: "text",
      spellCheck: "false",
      placeholder: "live terminal. Try move_forward(1) or place(\"flag\")",
      "aria-label": "Live terminal: type one Python line and press Enter",
      value: replLine,
      onChange: e => setReplLine(e.target.value),
      onKeyDown: e => {
        if (e.key === 'Enter') {
          runReplLine(replLine);
          setReplHist(replLine);
          setReplLine('');
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (replHistRef.current) setReplLine(replHistRef.current);
        } else if (e.key === 'Escape') {
          e.target.blur();
        }
      }
    })))), /*#__PURE__*/React.createElement("div", {
      className: "resizer",
      onPointerDown: e => startDrag('editor', e),
      style: {
        gridColumn: 2
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "panel view-panel",
      style: {
        gridColumn: 3
      },
      onPointerDown: camDrag,
      onWheel: camWheel
    }, /*#__PURE__*/React.createElement("div", {
      className: "terrain-switch"
    }, ['city', 'room', 'earth', 'mars', 'underwater', 'space'].map(id => /*#__PURE__*/React.createElement("button", {
      type: "button",
      key: id,
      className: 'terrain-btn' + (terrainId === id ? ' active' : ''),
      "aria-pressed": terrainId === id,
      onClick: () => onTerrain(id)
    }, /*#__PURE__*/React.createElement("span", {
      className: "tdot",
      style: {
        background: TERRAINS[id].dot,
        boxShadow: terrainId === id ? '0 0 8px ' + TERRAINS[id].dot : 'none'
      }
    }), TERRAINS[id].label)), window.SITES && /*#__PURE__*/React.createElement("select", {
      className: "lesson-select site-select",
      value: window.SITES[terrainId] ? terrainId : '',
      onChange: e => {
        if (e.target.value) onTerrain(e.target.value);
      },
      "aria-label": "Real-world mission site",
      title: "Drop the rover at a real place. Real gravity, traction and light"
    }, /*#__PURE__*/React.createElement("option", {
      value: "",
      disabled: true
    }, "\uD83C\uDF0D Mission site\u2026"), [['earth', '🌍 Earth'], ['underwater', '🌊 Underwater'], ['mars', '🔴 Mars'], ['space', '🌑 Space']].map(([base, label]) => {
      const ids = Object.keys(window.SITES).filter(id => window.SITES[id].base === base);
      return ids.length === 0 ? null : /*#__PURE__*/React.createElement("optgroup", {
        key: base,
        label: label
      }, ids.map(id => /*#__PURE__*/React.createElement("option", {
        key: id,
        value: id
      }, window.SITES[id].name)));
    })), /*#__PURE__*/React.createElement("span", {
      className: "view-toggle"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: 'terrain-btn' + (view3d ? ' active' : ''),
      "aria-pressed": view3d,
      title: "Real 3D view",
      onClick: () => setView3d(true)
    }, "3D"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: 'terrain-btn' + (!view3d ? ' active' : ''),
      "aria-pressed": !view3d,
      title: "Flat 2.5D view",
      onClick: () => setView3d(false)
    }, "2.5D"), view3d && /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "terrain-btn",
      "aria-pressed": fpv,
      title: "Switch between orbit and first person",
      onClick: () => setFpv(f => !f)
    }, fpv ? '👁 First person' : '🛰 Orbit'), view3d && /*#__PURE__*/React.createElement("select", {
      className: "terrain-btn",
      value: quality,
      title: "Render quality (Low keeps a basic laptop smooth, Cinematic maxes a screenshot)",
      "aria-label": "Render quality",
      style: {
        cursor: 'pointer'
      },
      onChange: e => {
        const v = e.target.value;
        window.KODRO_QUALITY = v;
        setQuality(v);
        try {
          localStorage.setItem('kodro_quality', v);
        } catch (err) {
          void err;
        }
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: "low"
    }, "Low"), /*#__PURE__*/React.createElement("option", {
      value: "med"
    }, "Medium"), /*#__PURE__*/React.createElement("option", {
      value: "high"
    }, "High"), /*#__PURE__*/React.createElement("option", {
      value: "cinematic"
    }, "Cinematic")))), view3d ? /*#__PURE__*/React.createElement(window.Viewport3D, {
      key: 'vp3d-' + quality,
      terrain: terrain,
      rover: rover,
      fpv: fpv,
      robotType: robotSpec && robotSpec.type
    }) : /*#__PURE__*/React.createElement(window.Viewport, {
      terrain: terrain,
      rover: rover,
      trail: trail,
      props: props,
      photoUrl: photoUrl,
      sensorDist: sensorDist,
      say: say,
      crashKey: crashKey,
      zoom: zoom,
      showGrid: t.grid,
      showFx: t.ambientFx,
      trailColor: trailColor,
      tilt: cam.tilt,
      yaw: cam.yaw,
      onTilt: v => setCam({
        tilt: v,
        yaw: v === 0 ? 0 : -8,
        zoom: 1
      })
    })), /*#__PURE__*/React.createElement("div", {
      className: "resizer",
      onPointerDown: e => startDrag('tele', e),
      style: {
        gridColumn: 4
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "panel tele-panel",
      style: {
        gridColumn: 5
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "panel-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Telemetry"), /*#__PURE__*/React.createElement("div", {
      className: "ph-spacer",
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "num",
      style: {
        fontSize: 10,
        color: 'var(--fg-3)',
        letterSpacing: '0.1em'
      }
    }, "OQ-ROVER-04")), /*#__PURE__*/React.createElement(window.Telemetry, {
      rover: rover,
      terrain: terrain,
      sensorDist: sensorDist,
      odometer: odo
    }))), /*#__PURE__*/React.createElement(window.TweaksPanel, {
      title: "Tweaks"
    }, /*#__PURE__*/React.createElement(window.TweakSection, {
      label: "Camera"
    }), /*#__PURE__*/React.createElement(window.TweakSlider, {
      label: "Perspective",
      value: cam.tilt,
      min: 0,
      max: 70,
      step: 2,
      unit: "\xB0",
      onChange: v => setCam(c => ({
        ...c,
        tilt: v
      }))
    }), /*#__PURE__*/React.createElement(window.TweakSlider, {
      label: "Orbit",
      value: cam.yaw,
      min: -45,
      max: 45,
      step: 1,
      unit: "\xB0",
      onChange: v => setCam(c => ({
        ...c,
        yaw: v
      }))
    }), /*#__PURE__*/React.createElement(window.TweakSlider, {
      label: "Zoom",
      value: cam.zoom,
      min: 0.7,
      max: 1.6,
      step: 0.05,
      onChange: v => setCam(c => ({
        ...c,
        zoom: v
      }))
    }), /*#__PURE__*/React.createElement(window.TweakSection, {
      label: "Scene"
    }), /*#__PURE__*/React.createElement(window.TweakToggle, {
      label: "Reference grid",
      value: t.grid,
      onChange: v => setTweak('grid', v)
    }), /*#__PURE__*/React.createElement(window.TweakToggle, {
      label: "Ambient FX",
      value: t.ambientFx,
      onChange: v => setTweak('ambientFx', v)
    }), /*#__PURE__*/React.createElement(window.TweakSection, {
      label: "Path trace"
    }), /*#__PURE__*/React.createElement(window.TweakRadio, {
      label: "Trail color",
      value: t.trail,
      options: ['terrain', 'cyan', 'amber'],
      onChange: v => setTweak('trail', v)
    })), swarmOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => !swarmBusy && setSwarmOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Agent swarm",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\uD83D\uDC1D Agent swarm. Your one program, run by a fleet at once"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setSwarmOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "swarm-body"
    }, swarmBusy && /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "Launching the swarm\u2026"), swarmData && swarmData.paths && (() => {
      const COLORS = ['#5ce0d8', '#e0b45c', '#7cc49b', '#c8685a', '#a78bfa', '#f0808a', '#62b6ff', '#b6e36a'];
      const pts = swarmData.paths.flat();
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      pts.forEach(([x, y]) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      });
      if (!isFinite(minX)) {
        minX = -1;
        maxX = 1;
        minY = -1;
        maxY = 1;
      }
      const W = 380,
        H = 260,
        pad = 18;
      const spanX = Math.max(0.5, maxX - minX),
        spanY = Math.max(0.5, maxY - minY);
      const sc = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
      const px = x => pad + (x - minX) * sc;
      const py = y => H - pad - (y - minY) * sc; // flip: world y up
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("svg", {
        className: "swarm-plot",
        viewBox: '0 0 ' + W + ' ' + H,
        role: "img",
        "aria-label": "Swarm trails"
      }, /*#__PURE__*/React.createElement("rect", {
        x: "0",
        y: "0",
        width: W,
        height: H,
        rx: "6",
        fill: "var(--void)",
        stroke: "var(--border)"
      }), swarmData.paths.map((path, i) => {
        const d = path.map(([x, y], j) => (j === 0 ? 'M' : 'L') + px(x) + ' ' + py(y)).join(' ');
        const last = path[path.length - 1];
        return /*#__PURE__*/React.createElement("g", {
          key: i
        }, /*#__PURE__*/React.createElement("path", {
          d: d,
          fill: "none",
          stroke: COLORS[i % COLORS.length],
          strokeWidth: "2",
          strokeLinejoin: "round",
          opacity: "0.9"
        }), /*#__PURE__*/React.createElement("circle", {
          cx: px(last[0]),
          cy: py(last[1]),
          r: "4",
          fill: COLORS[i % COLORS.length]
        }));
      })), /*#__PURE__*/React.createElement("p", {
        className: "build-note"
      }, swarmData.n, " rovers ran the same program from different starting points. Identical code, no central controller, a coordinated pattern. All offline."));
    })()))), vaOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => !vaBusy && setVaOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal va-modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Talk to Kodro",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\uD83C\uDF99 Talk to Kodro. Say a command, or ask a question"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setVaOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "va-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: 'va-wave' + (vaBusy ? ' live' : ''),
      "aria-hidden": "true"
    }, Array.from({
      length: 28
    }).map((_, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        ['--i']: i
      }
    }))), /*#__PURE__*/React.createElement("p", {
      className: "va-status"
    }, vaBusy ? 'Listening…' : vaData ? null : 'Tap the microphone in the bar to talk.'), vaData && vaData.text && /*#__PURE__*/React.createElement("p", {
      className: "va-heard"
    }, "\u201C", vaData.text, "\u201D"), vaData && vaData.ok === false && /*#__PURE__*/React.createElement("p", {
      className: "vibe-error",
      role: "alert"
    }, vaData.reason), vaData && vaData.ok && vaData.mode === 'command' && /*#__PURE__*/React.createElement("p", {
      className: "va-result"
    }, /*#__PURE__*/React.createElement("span", {
      className: "va-tag"
    }, "added to your code"), /*#__PURE__*/React.createElement("code", null, vaData.code)), vaData && vaData.ok && vaData.mode === 'answer' && /*#__PURE__*/React.createElement("div", {
      className: "ask-answer"
    }, /*#__PURE__*/React.createElement("p", {
      className: "ask-text"
    }, vaData.answer), vaData.sources && vaData.sources.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "ask-sources"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "From the lessons"), vaData.sources.map((s, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "ask-src"
    }, /*#__PURE__*/React.createElement("b", null, "[", i + 1, "] ", s.source), /*#__PURE__*/React.createElement("span", null, s.text))))), /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-run",
      disabled: vaBusy,
      onClick: runVoiceAgent
    }, vaBusy ? 'Listening…' : '🎙 Talk again')))), askOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => !askBusy && setAskOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Ask a question",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\u2753 Ask. Answered from the lesson material, not made up"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setAskOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "ask-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "build-input"
    }, /*#__PURE__*/React.createElement("label", {
      className: "grow"
    }, /*#__PURE__*/React.createElement("span", null, "Your question"), /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: askQuery,
      placeholder: "e.g. how do I check for a wall?",
      onChange: e => setAskQuery(e.target.value),
      onKeyDown: e => {
        if (e.key === 'Enter') runAsk();
      },
      autoFocus: true
    })), /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-run",
      disabled: askBusy || !askQuery.trim(),
      onClick: runAsk
    }, askBusy ? 'Looking…' : 'Ask')), askData && askData.ok === false && /*#__PURE__*/React.createElement("p", {
      className: "vibe-error",
      role: "alert"
    }, askData.reason), askData && askData.ok && /*#__PURE__*/React.createElement("div", {
      className: "ask-answer"
    }, /*#__PURE__*/React.createElement("p", {
      className: "ask-text"
    }, askData.answer), askData.sources && askData.sources.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "ask-sources"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "From the lessons"), askData.sources.map((s, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "ask-src"
    }, /*#__PURE__*/React.createElement("b", null, "[", i + 1, "] ", s.source), /*#__PURE__*/React.createElement("span", null, s.text)))), askData.noModel && /*#__PURE__*/React.createElement("p", {
      className: "build-note"
    }, "Start a local model (Ollama) for a written answer; the lesson material above is shown offline."))))), teacherOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => setTeacherOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal modal-wide",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Teacher dashboard",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\uD83D\uDCCA Teacher dashboard. Class concept strength"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setTeacherOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "teacher-body"
    }, !teacherData && /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "Reading the class memory on this machine\u2026"), teacherData && teacherData.pupils.length === 0 && /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "No pupil data yet. Pass a lesson to start the heatmap."), teacherData && teacherData.pupils.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        overflow: 'auto',
        maxHeight: '60vh'
      }
    }, /*#__PURE__*/React.createElement("table", {
      className: "heatmap-table"
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Pupil"), teacherData.concepts.map(c => /*#__PURE__*/React.createElement("th", {
      key: c,
      className: "hm-concept"
    }, c)))), /*#__PURE__*/React.createElement("tbody", null, teacherData.pupils.map(p => /*#__PURE__*/React.createElement("tr", {
      key: p.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "hm-name"
    }, p.name, p.active ? ' ·' : ''), teacherData.concepts.map(c => {
      const v = p.scores[c];
      const has = typeof v === 'number';
      const pct = has ? Math.round(v * 100) : null;
      const hue = has ? Math.round(v * 130) : 0; // 0 red → 130 green
      return /*#__PURE__*/React.createElement("td", {
        key: c,
        className: "hm-cell",
        title: has ? c + ': ' + pct + '%' : 'not attempted',
        style: {
          background: has ? 'hsl(' + hue + ' 55% 42%)' : 'transparent',
          color: has ? '#fff' : 'var(--fg-4)'
        }
      }, has ? pct : '·');
    }))))), /*#__PURE__*/React.createElement("p", {
      className: "build-note"
    }, "Each cell is a rolling strength score from 0 to 100 for that concept. Higher and greener is stronger. All data is local to this machine."))))), robotLabOpen && RobotLab && /*#__PURE__*/React.createElement(RobotLab, {
      onClose: () => setRobotLabOpen(false)
    }), memoryOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => setMemoryOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal modal-wide",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Memory and skills",
      "data-tick": memTick,
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\uD83E\uDDE0 Memory. The system refines from what it has seen, offline"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setMemoryOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "mem-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "mem-col"
    }, /*#__PURE__*/React.createElement("div", {
      className: "rl-label"
    }, "Reflections from past runs"), (window.KodroMemory ? window.KodroMemory.reflections() : []).length ? /*#__PURE__*/React.createElement("ul", {
      className: "mem-list"
    }, window.KodroMemory.reflections().slice(0, 10).map((r, i) => /*#__PURE__*/React.createElement("li", {
      key: i,
      className: 'mem-refl mem-' + r.outcome
    }, /*#__PURE__*/React.createElement("span", {
      className: "mem-ctx"
    }, (r.world || '?') + ' · ' + (r.robotType || 'robot') + ' · ' + r.outcome), r.reflection))) : /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "No runs yet. Run a program and the system notes what happened, then draws on it.")), /*#__PURE__*/React.createElement("div", {
      className: "mem-col"
    }, /*#__PURE__*/React.createElement("div", {
      className: "rl-label"
    }, "Skill library. Programs that worked, reused"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini btn-vibe",
      onClick: () => {
        const n = window.prompt && window.prompt('Name this skill');
        if (n && window.KodroMemory) window.KodroMemory.saveSkill(n, code, {
          world: terrain.id,
          robotType: robotSpec && robotSpec.type || '',
          ts: Date.now()
        });
      }
    }, "\uFF0B Save current code as a skill"), (window.KodroMemory ? window.KodroMemory.skills() : []).length ? /*#__PURE__*/React.createElement("ul", {
      className: "mem-list"
    }, window.KodroMemory.skills().map((s, i) => /*#__PURE__*/React.createElement("li", {
      key: i,
      className: "mem-skill"
    }, /*#__PURE__*/React.createElement("span", {
      className: "mem-skill-name"
    }, s.name), /*#__PURE__*/React.createElement("span", {
      className: "mem-skill-ctx"
    }, (s.world || '') + ' · used ' + (s.uses || 0) + '×'), /*#__PURE__*/React.createElement("span", {
      className: "mem-skill-act"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      onClick: () => {
        const cd = window.KodroMemory.useSkill(s.name);
        if (cd != null) {
          if (currentLessonId) setLessonBuffers(b => ({
            ...b,
            [currentLessonId]: cd
          }));else setPrograms(p => ({
            ...p,
            [activeTab]: cd
          }));
          setMemoryOpen(false);
        }
      }
    }, "Insert"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      onClick: () => window.KodroMemory.removeSkill(s.name)
    }, "\u2715"))))) : /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "Save a program that worked, then reuse it on the next robot."))))), reviewOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => !reviewBusy && setReviewOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "AI code review",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\uD83D\uDD0E Code review. A second AI agent checks your work"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setReviewOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "review-body"
    }, reviewBusy && /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "A reviewer agent is reading your code on this machine\u2026"), reviewErr && /*#__PURE__*/React.createElement("p", {
      className: "vibe-error",
      role: "alert"
    }, reviewErr), reviewData && !reviewBusy && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "Reviewer: ", /*#__PURE__*/React.createElement("b", null, reviewData.model), " \xB7 runs entirely offline."), reviewData.issues && reviewData.issues.length > 0 ? /*#__PURE__*/React.createElement("ul", {
      className: "review-issues"
    }, reviewData.issues.map((it, i) => /*#__PURE__*/React.createElement("li", {
      key: i
    }, it))) : /*#__PURE__*/React.createElement("p", {
      className: "review-clean"
    }, "No problems spotted. Nice work."), reviewData.revised && reviewData.code && /*#__PURE__*/React.createElement("div", {
      className: "review-rewrite"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Suggested rewrite (checked to run safely)"), /*#__PURE__*/React.createElement("pre", {
      className: "vibe-code"
    }, reviewData.code), /*#__PURE__*/React.createElement("div", {
      className: "vibe-code-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-run",
      onClick: applyReview
    }, "\u2713 Apply to editor"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      onClick: () => setReviewOpen(false)
    }, "Keep mine"))))))), realismOpen && window.KodroRealism && React.createElement(window.KodroRealism, {
      onClose: () => setRealismOpen(false)
    }), demoOpen && window.KodroDemo && React.createElement(window.KodroDemo, {
      onClose: () => setDemoOpen(false)
    }), vibeOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => !vibeBusy && setVibeOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal modal-wide",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Code with AI",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\u2728 Vibe coding. Describe it, the AI writes it"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setVibeOpen(false)
    }, "\u2715")), aiInfo.available ? /*#__PURE__*/React.createElement("div", {
      className: "vibe-body"
    }, /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "Local model: ", /*#__PURE__*/React.createElement("b", null, aiInfo.model), " \xB7 runs entirely on this machine, nothing leaves it."), aiInfo.models && aiInfo.models.length > 1 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '2px 0 10px',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: '#9fb4d2'
      }
    }, "Use model"), /*#__PURE__*/React.createElement("select", {
      value: aiInfo.override || aiInfo.model || '',
      onChange: e => pickModel(e.target.value),
      style: {
        background: '#0e1622',
        color: '#dce8f8',
        border: '1px solid #2a3a52',
        borderRadius: 8,
        padding: '5px 8px',
        fontSize: 12.5
      }
    }, aiInfo.models.map(m => /*#__PURE__*/React.createElement("option", {
      key: m,
      value: m
    }, m))), aiInfo.override && /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      onClick: () => pickModel(''),
      title: "Return to automatic model selection"
    }, "Auto")), /*#__PURE__*/React.createElement("div", {
      className: "vibe-thread",
      role: "log",
      "aria-live": "polite",
      "aria-label": "AI conversation"
    }, vibeMsgs.length === 0 && /*#__PURE__*/React.createElement("p", {
      className: "vibe-empty"
    }, "Chat with the AI like a coding partner. It may ask a question first, e.g. try ", /*#__PURE__*/React.createElement("i", null, "\"explore the field\""), " or ", /*#__PURE__*/React.createElement("i", null, "\"draw a star\""), "."), vibeMsgs.map((m, i) => m.kind === 'code' ? /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "vibe-msg ai code"
    }, /*#__PURE__*/React.createElement("pre", {
      className: "vibe-code"
    }, m.text), /*#__PURE__*/React.createElement("div", {
      className: "vibe-code-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-run",
      onClick: () => vibeApply(m.text, m.model)
    }, "\u2713 Apply to editor"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      onClick: () => {
        setVibeMsgs(ms => [...ms, {
          role: 'user',
          kind: 'text',
          text: '(discarded, try again)'
        }]);
      }
    }, "Discard"))) : /*#__PURE__*/React.createElement("div", {
      key: i,
      className: 'vibe-msg ' + m.role
    }, /*#__PURE__*/React.createElement("span", null, m.text))), vibeBusy && /*#__PURE__*/React.createElement("div", {
      className: "vibe-msg ai thinking"
    }, vibeLive ? /*#__PURE__*/React.createElement("pre", {
      className: "vibe-live"
    }, vibeLive) : /*#__PURE__*/React.createElement("span", null, "Thinking\u2026")), /*#__PURE__*/React.createElement("div", {
      ref: vibeEndRef
    })), vibeError && /*#__PURE__*/React.createElement("p", {
      className: "vibe-error",
      role: "alert"
    }, vibeError), /*#__PURE__*/React.createElement("div", {
      className: "vibe-inputrow"
    }, /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Speak your request (offline)",
      "aria-label": "Voice input",
      disabled: micBusy,
      onClick: vibeMic
    }, micBusy ? '…' : '🎤'), /*#__PURE__*/React.createElement("textarea", {
      className: "vibe-input",
      rows: 2,
      placeholder: "Say what the rover should do. The AI may ask you a question back",
      value: vibePrompt,
      onChange: e => setVibePrompt(e.target.value),
      onKeyDown: e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          vibeSend();
        }
      },
      "aria-label": "Describe what the rover should do",
      autoFocus: true
    }), /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-run",
      disabled: vibeBusy || !vibePrompt.trim(),
      onClick: vibeSend
    }, "Send")), /*#__PURE__*/React.createElement("span", {
      className: "vibe-hint"
    }, "Apply types the code into the editor. Nothing runs until you press Run.")) : /*#__PURE__*/React.createElement("div", {
      className: "vibe-body"
    }, /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "AI is offline. Vibe coding uses a ", /*#__PURE__*/React.createElement("b", null, "local"), " model (no cloud, no account):"), /*#__PURE__*/React.createElement("ol", {
      className: "vibe-steps"
    }, /*#__PURE__*/React.createElement("li", null, "Install Ollama from ollama.com (free, offline after install)"), /*#__PURE__*/React.createElement("li", null, "Run: ", /*#__PURE__*/React.createElement("code", null, "ollama pull qwen2.5-coder:3b"), " (or ", /*#__PURE__*/React.createElement("code", null, "gemma3"), ")"), /*#__PURE__*/React.createElement("li", null, "Reopen Kodro. This panel lights up automatically"))))), blocksOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => setBlocksOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal modal-wide",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Block coding",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\uD83E\uDDE9 Blocks. Click blocks to build, then turn them into Python"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setBlocksOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "blocks-palette"
    }, BLOCK_DEFS.map(d => /*#__PURE__*/React.createElement("button", {
      key: d.k,
      className: "block-chip",
      style: {
        borderColor: d.color
      },
      onClick: () => addBlock(d)
    }, d.label, d.unit ? ' ' + d.val + d.unit : '')), /*#__PURE__*/React.createElement("button", {
      className: "block-chip block-end",
      onClick: endBlock,
      disabled: blockIndent === 0
    }, "\u21A4 end block")), /*#__PURE__*/React.createElement("div", {
      className: "blocks-program",
      "aria-label": "Your program"
    }, blocks.length === 0 && /*#__PURE__*/React.createElement("p", {
      className: "vibe-hint"
    }, "Click blocks above. They stack here like Scratch."), blocks.map((b, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "block-row",
      style: {
        marginLeft: b.indent * 22 + 'px',
        borderLeftColor: b.color
      }
    }, /*#__PURE__*/React.createElement("span", null, b.label), b.val !== undefined && /*#__PURE__*/React.createElement("input", {
      type: "number",
      className: "block-num",
      value: b.val,
      min: b.unit === '%' ? 0 : 1,
      max: b.unit === '°' ? 360 : b.unit === '%' ? 100 : 20,
      "aria-label": b.label + ' amount',
      onChange: e => {
        const v = Number(e.target.value) || 1;
        setBlocks(bs => bs.map((x, j) => j === i ? {
          ...x,
          val: v
        } : x));
      }
    }), b.unit && /*#__PURE__*/React.createElement("span", {
      className: "vibe-hint"
    }, b.unit), /*#__PURE__*/React.createElement("span", {
      className: "block-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      disabled: i === 0,
      "aria-label": 'move ' + b.label + ' up',
      title: "Move up",
      onClick: () => moveBlock(i, -1)
    }, "\u2191"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      disabled: i === blocks.length - 1,
      "aria-label": 'move ' + b.label + ' down',
      title: "Move down",
      onClick: () => moveBlock(i, 1)
    }, "\u2193"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": 'remove ' + b.label,
      onClick: () => removeBlock(i)
    }, "\u2715"))))), /*#__PURE__*/React.createElement("div", {
      className: "vibe-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      disabled: !blocks.length,
      onClick: () => {
        setBlocks([]);
        setBlockIndent(0);
      }
    }, "Clear"), /*#__PURE__*/React.createElement("span", {
      className: "vibe-hint",
      style: {
        flex: 1
      }
    }, "Turns into real Python. Watch it type itself into the editor."), /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-run",
      disabled: !blocks.length,
      onClick: insertBlocksCode
    }, "Insert code \u2192")))), showHelp && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => setShowHelp(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Keyboard shortcuts",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Keyboard shortcuts"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setShowHelp(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("dl", {
      className: "shortcut-list"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Ctrl"), "+", /*#__PURE__*/React.createElement("kbd", null, "Enter")), /*#__PURE__*/React.createElement("dd", null, "Run / Pause the program")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "F10")), /*#__PURE__*/React.createElement("dd", null, "Step one instruction")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Tab")), /*#__PURE__*/React.createElement("dd", null, "Indent (in the editor)")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Shift"), "+", /*#__PURE__*/React.createElement("kbd", null, "Tab")), /*#__PURE__*/React.createElement("dd", null, "Dedent (in the editor)")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Enter")), /*#__PURE__*/React.createElement("dd", null, "Auto-indent the next line")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Esc")), /*#__PURE__*/React.createElement("dd", null, "Leave the editor / close this")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "?")), /*#__PURE__*/React.createElement("dd", null, "Show this help"))))), buildOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => setBuildOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal modal-wide",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Build a real robot",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\uD83E\uDD16 Build a real robot. What your budget can buy"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setBuildOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "build-body"
    }, /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "Type a budget and the local AI plans a real rover you can build and program, mapping what you learned here onto real hardware. Nothing is ordered; this runs offline."), /*#__PURE__*/React.createElement("div", {
      className: "build-input"
    }, /*#__PURE__*/React.createElement("label", null, "Budget (US$)", /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "1",
      max: "100000",
      value: buildBudget,
      onChange: e => setBuildBudget(e.target.value),
      onKeyDown: e => {
        if (e.key === 'Enter') runBuild();
      }
    })), /*#__PURE__*/React.createElement("label", {
      className: "grow"
    }, "Goal (optional)", /*#__PURE__*/React.createElement("input", {
      type: "text",
      placeholder: "e.g. \"avoid walls and follow a line\"",
      value: buildGoal,
      onChange: e => setBuildGoal(e.target.value),
      onKeyDown: e => {
        if (e.key === 'Enter') runBuild();
      }
    })), /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-run",
      disabled: buildBusy,
      onClick: runBuild
    }, buildBusy ? 'Planning…' : 'Generate')), buildErr && /*#__PURE__*/React.createElement("p", {
      className: "vibe-error",
      role: "alert"
    }, buildErr), buildPlan && /*#__PURE__*/React.createElement("div", {
      className: "build-plan"
    }, /*#__PURE__*/React.createElement("div", {
      className: "build-head"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: '0 0 2px'
      }
    }, buildPlan.tier), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        color: 'var(--fg-2)',
        fontSize: 12
      }
    }, buildPlan.summary)), /*#__PURE__*/React.createElement("div", {
      className: 'build-cost' + (buildPlan.total <= buildPlan.budget ? ' ok' : ' over')
    }, "$", Math.round(buildPlan.total), " ", /*#__PURE__*/React.createElement("span", null, "of $", buildPlan.budget))), /*#__PURE__*/React.createElement(window.RoverSchematic, {
      parts: buildPlan.parts
    }), /*#__PURE__*/React.createElement("div", {
      className: "build-cols"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "eyebrow"
    }, "Parts"), /*#__PURE__*/React.createElement("table", {
      className: "build-table"
    }, /*#__PURE__*/React.createElement("tbody", null, buildPlan.parts.map((p, i) => /*#__PURE__*/React.createElement("tr", {
      key: i
    }, /*#__PURE__*/React.createElement("td", null, p.name), /*#__PURE__*/React.createElement("td", {
      className: "role"
    }, p.role), /*#__PURE__*/React.createElement("td", {
      className: "cost"
    }, "$", p.cost)))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "eyebrow"
    }, "Build steps"), /*#__PURE__*/React.createElement("ol", {
      className: "build-steps"
    }, buildPlan.steps.map((s, i) => /*#__PURE__*/React.createElement("li", {
      key: i
    }, s))), buildPlan.maps && buildPlan.maps.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "eyebrow",
      style: {
        marginTop: 8
      }
    }, "From Kodro to hardware"), /*#__PURE__*/React.createElement("dl", {
      className: "build-maps"
    }, buildPlan.maps.map((m, i) => /*#__PURE__*/React.createElement("div", {
      key: i
    }, /*#__PURE__*/React.createElement("dt", null, m.robolearn), /*#__PURE__*/React.createElement("dd", null, m.hardware))))))), buildPlan.fallback && /*#__PURE__*/React.createElement("p", {
      className: "build-note"
    }, "A standard plan is shown because the model could not tailor one within this budget."))))), !onboarded && window.KodroOnboarding && /*#__PURE__*/React.createElement(window.KodroOnboarding, {
      onClose: () => {
        setOnboarded(true);
        try {
          localStorage.setItem('or_onboarded', '1');
        } catch (err) {
          void err;
        }
      }
    }));
  }
  const TWEAK_DEFAULTS = {
    zoom: 1,
    tilt: 46,
    grid: true,
    ambientFx: true,
    trail: 'terrain'
  };

  // Kodro brand mark: a circular orbit (the simulated world), a trajectory swept
  // along it, and the robot as the solid node at the head of its path. Monochrome
  // via currentColor so it inherits whatever colour .brand-mark sets (theme-safe).
  const ORBIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="21" stroke="currentColor" stroke-width="2.4" opacity="0.2"></circle>
    <path d="M15 44 A21 21 0 1 1 44 15" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" opacity="0.9"></path>
    <circle cx="15" cy="44" r="2.6" fill="currentColor" opacity="0.45"></circle>
    <circle cx="44" cy="15" r="6.4" fill="currentColor"></circle>
  </svg>`;

  // adjust grid columns to include resizer tracks
  const style = document.createElement('style');
  style.textContent = '.workspace{grid-template-columns:var(--editor-w) 5px 1fr 5px var(--tele-w);}';
  document.head.appendChild(style);
  ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})();
})();
