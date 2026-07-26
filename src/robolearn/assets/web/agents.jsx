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
  let simT = 0; // accumulated sim seconds; drives the traffic-light cycle
  const R = 30; // rover collision radius (cm), matched to the engine
  const ROBOT_COLORS = [0x4a9a94, 0x9a8850, 0x8a8f96, 0x556072];
  // Mission sites where a roaming pastel fleet would break the fiction (W5):
  // the Challenger Deep and Europa are silent, lifeless places.
  const QUIET_SITES = { mariana: 1, europa: 1 };

  // R4: the city junction's traffic-light cycle. One road flows while the
  // other holds; a full cycle is 24 s (9 green, 2.5 amber, 0.5 all-red each
  // way). Pure function of the sim clock so the 3D light heads, the 2.5D view
  // and the car braking below all read the SAME state.
  const LIGHT_CYCLE = 24, LIGHT_GREEN = 9, LIGHT_AMBER = 2.5;
  function lightState(horiz) {
    const t = ((simT % LIGHT_CYCLE) + LIGHT_CYCLE) % LIGHT_CYCLE;
    const local = horiz ? t : (t + LIGHT_CYCLE / 2) % LIGHT_CYCLE;
    if (local < LIGHT_GREEN) return 'green';
    if (local < LIGHT_GREEN + LIGHT_AMBER) return 'amber';
    return 'red';
  }

  // lane(dir, axis, offset): a one-way lane. dir +1/-1 is travel direction along
  // the moving axis; offset is the fixed cross-axis position.
  // `vel` is the eased actual speed (agents accelerate and brake, they do not
  // step-change); `fade` is 0..1 near the loop-wrap ends so the renderer can
  // hide the teleport; `stride` varies the walk cadence per pedestrian.
  function car(horiz, dir, lane, speed, s0, color) {
    return { kind: 'car', horiz, dir, lane, speed, s: s0, span: 3400, r: 96, color, x: 0, y: 0, dx: dir, dy: 0, leg: 0, base: speed, vel: speed, fade: 1 };
  }
  function ped(horiz, dir, lane, speed, s0, color, span) {
    const v = speed * (0.88 + Math.random() * 0.3); // no two walk the same pace
    return { kind: 'person', horiz, dir, lane, speed: v, s: s0, span: span || 2800, r: 44, color, x: 0, y: 0, dx: dir, dy: 0, leg: 0, base: v, vel: v, fade: 1,
      stride: 0.05 + Math.random() * 0.03, nextIdle: 4 + Math.random() * 9, idleFor: 0 };
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
    // Restart the clock with the scene. simT drives the traffic-light phase,
    // so leaving it running meant a rebuilt city inherited the previous run's
    // light state and the same program met a different junction each time.
    simT = 0;
    if (id === 'city') {
      const shirts = [0xd98c4a, 0x5aa0d8, 0x8a6fc0, 0x5bbf86, 0xd35d7a, 0xe0b45c];
      // Traffic: two lanes each way on both roads, flowing one direction, looping.
      agents.push(car(true, 1, -78, 240, 200, 0x3a434d));
      agents.push(car(true, 1, -78, 240, 1900, 0x4a4f57));
      agents.push(car(true, -1, 78, 220, 1100, 0x39424a));
      agents.push(car(false, 1, 78, 230, 600, 0xa6acb2));
      agents.push(car(false, -1, -78, 210, 2400, 0x2b3039));
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
    } else if (id !== 'none' && !QUIET_SITES[id]) {
      // Open terrain worlds were static. Give them a small autonomous fleet that
      // roams and reacts, so the world is alive and the player has machines to
      // share it with. Quiet sites (Challenger Deep, Europa) stay empty (W5).
      // 'none' is the lesson arena: a lesson is graded against its own samples
      // and obstacles only, so any roaming machine here is an obstacle the
      // grader has never heard of. That mismatch is how a lesson could show a
      // visible crash and still tick "Do not hit anything".
      addRobots(3, ROBOT_COLORS);
    }
    step(0); // place every agent on its lane immediately, before the first frame
    start();
  }

  // The zebra crossing sits east of the junction on the horizontal road
  // (x 200..420 cm, matching the painted bars in the 3D city). Cars slow for
  // it and stop when a crossing pedestrian is on their half of the carriageway.
  const ZEBRA_X0 = 200, ZEBRA_X1 = 420;

  function step(dt) {
    if (dt > 0.1) dt = 0.1; // a long pause (tab hidden) must not teleport agents
    simT += dt;
    const rov = window.KODRO_ROVER;
    // Which halves of the zebra have a pedestrian on them right now? Cars in
    // the matching lane must stop; the other lane only slows for the crossing.
    let zebraNeg = false, zebraPos = false;
    if (worldId === 'city') {
      for (let i = 0; i < agents.length; i++) {
        const p = agents[i];
        if (p.kind !== 'person' || p.horiz || p.lane < 300) continue;
        if (p.y > -165 && p.y < 40) zebraNeg = true;
        if (p.y > -40 && p.y < 165) zebraPos = true;
      }
    }
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
        // Stop far enough back that the car cannot be touching the rover when
        // it comes to rest. The old stop offset was a flat 60, which is less
        // than the a.r + R clearance the collision test uses (96 + 30 = 126 for
        // a car), so a braked car settled 98 cm from a rover sitting at the
        // junction: already overlapping. Every first run of the bundled welcome
        // program ended in "collision detected" before the rover had moved,
        // because traffic parked itself on top of the start position.
        // Deriving the offset from the same radii the collision test uses means
        // it stays correct if either radius changes.
        const STOP = a.r + R + 12;   // 12 cm of daylight, not a bumper kiss
        if (fwd > 0 && fwd < STOP + 180 && lat < a.r + R + 24) {
          brake = Math.max(0, (fwd - STOP) / 180);
        }
      }
      // desired speed this frame; the eased `vel` below chases it, so cars
      // pull away gently from stops and brake smoothly, never step-change
      let target = a.base * brake;
      if (a.kind === 'person') {
        if (a.idleFor > 0) {
          a.idleFor -= dt; target = 0; // paused: look around, then carry on
        } else {
          a.nextIdle -= dt;
          // only begin a pause on the pavement, never in the carriageway
          if (a.nextIdle <= 0 && Math.abs(ax) > 220 && Math.abs(ay) > 220) {
            a.idleFor = 1 + Math.random() * 2;
            a.nextIdle = 6 + Math.random() * 9;
            target = 0;
          }
        }
      } else if (a.kind === 'car' && worldId === 'city') {
        if (a.horiz) {
          // approaching the zebra: distance from this car's nose to the zone edge
          const ahead = a.dir > 0 ? (ZEBRA_X0 - a.r) - ax : ax - (ZEBRA_X1 + a.r);
          if (ahead > 0 && ahead < 420) {
            const pedInLane = a.lane < 0 ? zebraNeg : zebraPos;
            if (pedInLane) target = Math.min(target, a.base * Math.max(0, (ahead - 50) / 370));
            else target = Math.min(target, a.base * (0.45 + 0.55 * (ahead / 420))); // caution slow-down
          }
        }
        // R4: obey the junction lights. The junction box is |along| < 150 cm;
        // a car still short of its stop line eases to a halt on red or amber
        // (unless it is already too close to stop), using the same eased-vel
        // machinery as the zebra. Cars already inside the box keep going.
        const st = lightState(a.horiz);
        if (st !== 'green') {
          const along = a.horiz ? ax : ay;
          const stopAt = 150 + a.r + 20;
          const toLine = a.dir > 0 ? (-stopAt - along) : (along - stopAt);
          if (toLine > 0 && toLine < 420 && (st === 'red' || toLine > 60)) {
            target = Math.min(target, a.base * Math.max(0, (toLine - 55) / 365));
          }
        }
        // Car-following: never drive into the car queued ahead in this lane.
        const meAlong = a.horiz ? ax : ay;
        for (let j = 0; j < agents.length; j++) {
          const o = agents[j];
          if (o === a || o.kind !== 'car' || o.horiz !== a.horiz || o.lane !== a.lane || o.dir !== a.dir) continue;
          const gapFwd = ((a.horiz ? o.x : o.y) - meAlong) * a.dir;
          if (gapFwd > 0 && gapFwd < 320) target = Math.min(target, a.base * Math.max(0, (gapFwd - 215) / 105));
        }
      }
      const k = target < a.vel ? 6.5 : 1.8; // brake briskly, accelerate gently
      a.vel += (target - a.vel) * Math.min(1, dt * k);
      if (a.vel < 0.8 && target === 0) a.vel = 0; // settle instead of creeping
      a.s += a.vel * dt;
      const hs = (((a.s % a.span) + a.span) % a.span) - a.span / 2;
      const al = a.dir * hs;
      if (a.horiz) { a.x = al; a.y = a.lane; a.dx = a.dir; a.dy = 0; }
      else { a.x = a.lane; a.y = al; a.dx = 0; a.dy = a.dir; }
      a.speed = a.vel;
      // legs swing with the actual pace and settle when stopping; per-agent
      // stride length so the crowd does not march in lockstep
      a.leg = Math.sin(a.s * (a.stride || 0.06)) * (a.base > 0 ? a.vel / a.base : 0);
      // fade to nothing just before the loop wrap so the renderer never shows
      // the teleport (agents melt into the distance and re-emerge instead)
      const fz = Math.min(200, a.span * 0.1);
      const edge = a.span / 2 - Math.abs(hs);
      a.fade = edge < fz ? Math.max(0, edge / fz) : 1;
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

  window.KodroAgents = { build, step, stop, list: () => agents, world: () => worldId, lightState };
})();
