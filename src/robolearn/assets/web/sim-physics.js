/* ============================================================================
   KODRO - pure simulation physics (extracted from useSimEngine, hooks.jsx)

   The React-free, side-effect-free geometry and trapezoidal-motion MATH the
   run engine leans on every frame. These were inline closures inside
   useSimEngine; the run/animation orchestration (advance, the pump loop, the
   run-state machine, animateMove/animateTurn's ref writes and setState calls)
   stays in the hook, which now CALLS these functions. Nothing here reads a
   React ref or setter: every value it needs is passed in, so the module is
   testable headlessly (scripts/qa_physics.mjs) and byte-identical to the
   pre-extraction inlines.

   What moved, and the one substitution made:
     - collisionAt / rayDistance: the closure captured the collision radius R,
       the arena half-extent WALL and the live terrain; those are now the last
       three parameters. window.KodroAgents is still read at call time (moving
       pedestrians / traffic are real obstacles), exactly as before.
     - trapCover / trapVelocity: the acceleration-cruise-brake trapezoid's
       covered-distance integral and its instantaneous speed. The closure read
       accelFrac / brakeFrac / cruiseFrac / profileArea from animateMove; those
       are now parameters. The endpoint stays exact (trapCover(1, ...) === 1),
       so distances, collisions and battery settle are unchanged.

   Plain JS, no JSX, no React. Loaded before hooks in the bundle. Exposes
   window.KodroPhysics.
   ========================================================================== */
(function () {
  'use strict';

  // Is (x, y) touching a wall, a static obstacle, or a moving agent, for a
  // body of collision radius R in an arena of half-extent WALL? Returns a
  // {type[, o]} hit descriptor or null. Moved VERBATIM from useSimEngine with
  // R / WALL / terrain lifted to parameters.
  function collisionAt(x, y, R, WALL, terrain) {
    if (Math.abs(x) > WALL - R || Math.abs(y) > WALL - R) return { type: 'wall' };
    for (const o of terrain.obstacles) {
      if (Math.hypot(o.x - x, o.y - y) < o.r + R) return { type: 'obstacle', o };
    }
    // Moving agents (pedestrians and traffic) are real obstacles too: the
    // robot must avoid them, not just the parked cars and buildings. The
    // agent sim is keyed by the SITE id when a mission site is active
    // (App builds it with terrainId), so gate on the same id.
    if (window.KodroAgents && window.KodroAgents.world() === (terrain.siteId || terrain.id)) {
      for (const a of window.KodroAgents.list()) {
        if (Math.hypot(a.x - x, a.y - y) < a.r + R) return { type: a.kind === 'person' ? 'pedestrian' : a.kind === 'robot' ? 'robot' : 'vehicle', o: a };
      }
    }
    return null;
  }

  // Distance along heading from (x, y) to the nearest wall / obstacle / agent,
  // for a body of collision radius R in an arena of half-extent WALL. Moved
  // VERBATIM from useSimEngine with R / WALL / terrain lifted to parameters.
  function rayDistance(x, y, headingDeg, R, WALL, terrain) {
    const a = headingDeg * Math.PI / 180;
    const dx = Math.sin(a), dy = -Math.cos(a);
    let best = Infinity;
    // walls (square at +/-(WALL-R))
    const lim = WALL - R;
    if (dx > 1e-6) best = Math.min(best, (lim - x) / dx);
    if (dx < -1e-6) best = Math.min(best, (-lim - x) / dx);
    if (dy > 1e-6) best = Math.min(best, (lim - y) / dy);
    if (dy < -1e-6) best = Math.min(best, (-lim - y) / dy);
    // obstacles (ray-circle)
    for (const o of terrain.obstacles) {
      const ox = o.x - x, oy = o.y - y;
      const tca = ox * dx + oy * dy;
      if (tca < 0) continue;
      const d2 = ox * ox + oy * oy - tca * tca;
      const rr = (o.r + R) * (o.r + R);
      if (d2 > rr) continue;
      const t = tca - Math.sqrt(rr - d2);
      if (t > 0) best = Math.min(best, t);
    }
    // the sensor also picks up moving agents in the robot's path (same
    // site-aware world key as the collision test above)
    if (window.KodroAgents && window.KodroAgents.world() === (terrain.siteId || terrain.id)) {
      for (const o of window.KodroAgents.list()) {
        const ox = o.x - x, oy = o.y - y;
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

  // Instantaneous speed at fraction p of a move, normalised to cruise = 1: the
  // derivative of the trapezoid trapCover traces. Ramps up over accelFrac,
  // holds 1 through the cruise, brakes to 0 over the final brakeFrac. Moved
  // VERBATIM from animateMove (the vAt closure).
  function trapVelocity(p, accelFrac, brakeFrac) {
    return p <= accelFrac ? (accelFrac > 0 ? p / accelFrac : 1)
      : p <= 1 - brakeFrac ? 1
        : (brakeFrac > 0 ? Math.max(0, (1 - p) / brakeFrac) : 0);
  }

  // Fraction of the total distance covered by fraction p of the move time,
  // integrating the accel-cruise-brake trapezoid and normalising by its area
  // so the endpoint is exact (trapCover(1, ...) === 1). Moved VERBATIM from
  // animateMove (the coverFrac closure).
  function trapCover(p, accelFrac, brakeFrac, cruiseFrac, profileArea) {
    let area;
    if (accelFrac > 0 && p <= accelFrac) { const v = p / accelFrac; area = 0.5 * v * p; }
    else if (p <= 1 - brakeFrac) { area = 0.5 * accelFrac + (p - accelFrac); }
    else if (brakeFrac > 0) { const q = (p - (1 - brakeFrac)) / brakeFrac; area = 0.5 * accelFrac + cruiseFrac + (1 - 0.5 * q) * (q * brakeFrac); }
    else { area = profileArea; }
    return profileArea > 0 ? area / profileArea : p;
  }

  window.KodroPhysics = {
    collisionAt: collisionAt,
    rayDistance: rayDistance,
    trapVelocity: trapVelocity,
    trapCover: trapCover
  };
})();
