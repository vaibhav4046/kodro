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
    return { kind: 'car', horiz, dir, lane, speed, s: s0, span: 3400, r: 96, color, x: 0, y: 0, dx: dir, dy: 0, leg: 0, base: speed };
  }
  function ped(horiz, dir, lane, speed, s0, color, span) {
    return { kind: 'person', horiz, dir, lane, speed, s: s0, span: span || 2800, r: 44, color, x: 0, y: 0, dx: dir, dy: 0, leg: 0, base: speed };
  }
  // An autonomous robot: roams to random goals, steers around the player rover
  // and the other robots, and turns back at the arena edge. Distinct from the
  // lane agents above, which run on fixed tracks.
  function rbt(x, y, color, base) {
    return { kind: 'robot', x: x, y: y, heading: Math.atan2(-y, -x), base: base || 130, r: 42, color: color,
      dx: 1, dy: 0, leg: 0, spin: 0, gx: x, gy: y, retime: 0 };
  }
  function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

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
      const dx = ox - a.x, dy = oy - a.y, d = Math.hypot(dx, dy);
      if (d > 0.1 && d < rad) {
        const rel = wrap(Math.atan2(dy, dx) - a.heading);
        if (Math.abs(rel) < 1.3) steer -= (rel >= 0 ? 1 : -1) * (1 - d / rad) * 1.6;
      }
    };
    if (rov) dodge(rov.x, rov.y, 300);
    for (let j = 0; j < all.length; j++) { const o = all[j]; if (o !== a && o.kind === 'robot') dodge(o.x, o.y, 240); }
    // bias back toward the centre near the edge so it never escapes the arena
    if (Math.abs(a.x) > BOUND || Math.abs(a.y) > BOUND) want = Math.atan2(-a.y, -a.x);
    a.heading += wrap(want + steer - a.heading) * Math.min(1, dt * 3.5);
    const spd = a.base * (steer ? 0.7 : 1);
    a.x += Math.cos(a.heading) * spd * dt;
    a.y += Math.sin(a.heading) * spd * dt;
    a.dx = Math.cos(a.heading); a.dy = Math.sin(a.heading);
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
      agents.push(rbt(p[0], p[1], palette[i % palette.length], 120 + (i % 3) * 25));
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
      if (a.kind === 'robot') { steerRobot(a, dt, rov, agents); continue; }
      // provisional position from current s, along the lane in the travel dir
      const halfShift = (((a.s % a.span) + a.span) % a.span) - a.span / 2;
      const along = a.dir * halfShift;
      const ax = a.horiz ? along : a.lane;
      const ay = a.horiz ? a.lane : along;
      // brake for the robot if it is close ahead in this agent's path
      let brake = 1;
      if (rov) {
        const relx = rov.x - ax, rely = rov.y - ay;
        const fwd = a.horiz ? relx * a.dir : rely * a.dir;     // distance ahead
        const lat = a.horiz ? Math.abs(rely - 0) : Math.abs(relx - 0); // cross-track
        if (fwd > 0 && fwd < 240 && lat < a.r + R + 24) brake = Math.max(0, (fwd - 60) / 180);
      }
      a.s += a.base * brake * dt;
      const hs = (((a.s % a.span) + a.span) % a.span) - a.span / 2;
      const al = a.dir * hs;
      if (a.horiz) { a.x = al; a.y = a.lane; a.dx = a.dir; a.dy = 0; }
      else { a.x = a.lane; a.y = al; a.dx = 0; a.dy = a.dir; }
      a.speed = a.base * brake;
      a.leg = Math.sin(a.s * 0.06) * brake; // legs slow and stop when braking
    }
  }

  function loop(now) {
    // Backgrounded tab: skip the step but keep the loop alive and reset the
    // clock, so a hidden tab does no work and the agents do not teleport when
    // it returns (step() also clamps dt, this avoids even that catch-up).
    if (typeof document !== 'undefined' && document.hidden) {
      last = now;
      raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(loop) : 0;
      return;
    }
    if (last == null) last = now;
    step((now - last) / 1000); last = now;
    raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(loop) : 0;
  }
  function start() {
    if (typeof requestAnimationFrame === 'function') { last = null; raf = requestAnimationFrame(loop); }
    else step(0);
  }
  function stop() {
    if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    raf = 0;
  }

  window.KodroAgents = { build, step, stop, list: () => agents, world: () => worldId };
})();
