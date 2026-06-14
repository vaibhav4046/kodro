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

  // lane(dir, axis, offset): a one-way lane. dir +1/-1 is travel direction along
  // the moving axis; offset is the fixed cross-axis position.
  function car(horiz, dir, lane, speed, s0, color) {
    return { kind: 'car', horiz, dir, lane, speed, s: s0, span: 3400, r: 96, color, x: 0, y: 0, dx: dir, dy: 0, leg: 0, base: speed };
  }
  function ped(horiz, dir, lane, speed, s0, color, span) {
    return { kind: 'person', horiz, dir, lane, speed, s: s0, span: span || 2800, r: 44, color, x: 0, y: 0, dx: dir, dy: 0, leg: 0, base: speed };
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
    } else if (id === 'room') {
      agents.push(ped(true, 1, -360, 40, 0, 0x6aa0d8, 1300));
      agents.push(ped(false, 1, 360, 32, 200, 0xc97f6a, 1100));
    }
    start();
  }

  function step(dt) {
    if (dt > 0.1) dt = 0.1; // a long pause (tab hidden) must not teleport agents
    const rov = window.KODRO_ROVER;
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
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
