/* Shared moving-agent simulation.
 *
 * One source of truth for the city's pedestrians and traffic, in the same
 * centimetre world coordinates the rover and the obstacle field use. Both
 * viewports render from it and the collision test reads it, so an agent the
 * robot can see is an agent the robot can hit. Self driving via its own
 * requestAnimationFrame; falls back to a single step where rAF is absent
 * (the offline bundle-render test), so it never throws there.
 *
 *   window.KodroAgents.build(worldId)  -- set up agents for a world
 *   window.KodroAgents.list()          -- [{x,y,r,kind,color,dx,dy,leg}] in cm
 */
(function () {
  let agents = [];
  let worldId = null;
  let raf = 0;
  let t0 = null;

  function build(id) {
    stop();
    agents = [];
    worldId = id;
    if (id === 'city') {
      const PAVE = 280;
      const shirts = [0xd98c4a, 0x5aa0d8, 0x8a6fc0, 0x5bbf86, 0xd35d7a];
      for (let i = 0; i < 7; i++) {
        const horiz = (i % 2 === 0);
        const lane = (i % 4 < 2 ? 1 : -1) * PAVE;
        agents.push({ kind: 'person', horiz, lane, span: 2600, speed: 70 + (i % 3) * 22, off: i * 0.9, r: 44, color: shirts[i % shirts.length], x: 0, y: 0, dx: 1, dy: 0, leg: 0 });
      }
      [[true, -70, 210, 0x2c6fb0], [false, 70, 175, 0x4aa564], [true, 70, 150, 0xc0392b]].forEach((c, i) => {
        agents.push({ kind: 'car', horiz: c[0], lane: c[1], span: 3000, speed: c[2], off: i * 0.6, r: 96, color: c[3], x: 0, y: 0, dx: 1, dy: 0, leg: 0 });
      });
    } else if (id === 'room') {
      // People sharing the room: a companion robot must move around them.
      agents.push({ kind: 'person', horiz: true, lane: -360, span: 1100, speed: 40, off: 0.2, r: 46, color: 0x6aa0d8, x: 0, y: 0, dx: 1, dy: 0, leg: 0 });
      agents.push({ kind: 'person', horiz: false, lane: 360, span: 900, speed: 32, off: 1.3, r: 46, color: 0xc97f6a, x: 0, y: 0, dx: 0, dy: 1, leg: 0 });
    }
    start();
  }

  function tri(t, span, speed, off) {
    const ph = ((t * speed / span) + off) % 2;
    const x = ph < 1 ? ph : 2 - ph;      // 0..1..0 linear ramp
    return x * x * (3 - 2 * x);           // smoothstep: ease in and out of each turn
  }

  function step(t) {
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      const p0 = (tri(t, a.span, a.speed, a.off) - 0.5) * a.span;
      const p1 = (tri(t + 0.06, a.span, a.speed, a.off) - 0.5) * a.span;
      const dir = (p1 - p0) >= 0 ? 1 : -1;
      if (a.horiz) { a.x = p0; a.y = a.lane; a.dx = dir; a.dy = 0; }
      else { a.x = a.lane; a.y = p0; a.dx = 0; a.dy = dir; }
      a.leg = Math.sin(t * 6 + a.off * 3);
    }
  }

  function loop(now) {
    if (t0 == null) t0 = now;
    step((now - t0) / 1000);
    raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(loop) : 0;
  }
  function start() {
    if (typeof requestAnimationFrame === 'function') { t0 = null; raf = requestAnimationFrame(loop); }
    else step(0);
  }
  function stop() {
    if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    raf = 0;
  }

  window.KodroAgents = { build, step, stop, list: () => agents, world: () => worldId };
})();
