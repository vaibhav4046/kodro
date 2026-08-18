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
  // A lesson arena is a RECTANGLE at an offset, not the symmetric free-play
  // box: 05_iteration is 10 x 8 metres with the base at (1, 5). Without this
  // the watched run had no walls where the lesson has them, so a rover could
  // drive out of the arena the pupil was being marked in and `no_collisions`
  // could never fail on a boundary the grader does enforce.
  function boundsHit(x, y, R, WALL, terrain) {
    const b = terrain && terrain.bounds;
    if (!b) return Math.abs(x) > WALL - R || Math.abs(y) > WALL - R;
    return x < b.xMin + R || x > b.xMax - R || y < b.yMin + R || y > b.yMax - R;
  }

  function collisionAt(x, y, R, WALL, terrain) {
    if (boundsHit(x, y, R, WALL, terrain)) return { type: 'wall' };
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
    // walls: the symmetric free-play box at +/-(WALL-R), or the lesson's own
    // rectangle when one is loaded (see boundsHit).
    const b = terrain && terrain.bounds;
    const xHi = b ? b.xMax - R : WALL - R, xLo = b ? b.xMin + R : -(WALL - R);
    const yHi = b ? b.yMax - R : WALL - R, yLo = b ? b.yMin + R : -(WALL - R);
    if (dx > 1e-6) best = Math.min(best, (xHi - x) / dx);
    if (dx < -1e-6) best = Math.min(best, (xLo - x) / dx);
    if (dy > 1e-6) best = Math.min(best, (yHi - y) / dy);
    if (dy < -1e-6) best = Math.min(best, (yLo - y) / dy);
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

  // The accel-cruise-brake trapezoid's SHAPE for one move: the accel/brake ramp
  // fractions, the cruise fraction and the profile area trapCover normalises by.
  // Pure: a heavier build (massFac) ramps slower; momentum already carried
  // (rawVel) shortens the accel ramp; a physically-specified build (a defined
  // physAccelCmPerS2 with a non-null physV) uses the real ramp time t = v/a,
  // else the inertia heuristic. Moved VERBATIM from animateMove (the block that
  // set accelFrac/brakeFrac/cruiseFrac/profileArea); the endpoint stays exact
  // (trapCover(1, ...) === 1), so distances, collisions and battery are
  // unchanged. Reads no React ref or setter: every input is passed in.
  function trapProfile(massFac, rawVel, physAccelCmPerS2, physV, total) {
    const inertia = Math.min(0.92, Math.max(0.12, (massFac - 0.6) / 1.4));
    const carried = Math.min(1, Math.max(0, rawVel || 0));
    let accelFrac, brakeFrac;
    if (physAccelCmPerS2 !== undefined && physV !== null) {
      const dur0 = (total / physV) * 1000; // unscaled ms (sim-speed invariant)
      const rampMs = (physV / physAccelCmPerS2) * 1000;
      accelFrac = Math.min(0.45, rampMs / Math.max(1, dur0)) * (1 - 0.85 * carried);
      brakeFrac = Math.min(0.45, rampMs / Math.max(1, dur0));
    } else {
      accelFrac = (0.18 + 0.30 * inertia) * (1 - 0.85 * carried);
      brakeFrac = 0.16 + 0.34 * inertia;
    }
    if (accelFrac + brakeFrac > 0.95) { const k = 0.95 / (accelFrac + brakeFrac); accelFrac *= k; brakeFrac *= k; }
    const cruiseFrac = Math.max(0, 1 - accelFrac - brakeFrac);
    const profileArea = 0.5 * accelFrac + cruiseFrac + 0.5 * brakeFrac;
    return { accelFrac: accelFrac, brakeFrac: brakeFrac, cruiseFrac: cruiseFrac, profileArea: profileArea };
  }

  window.KodroPhysics = {
    collisionAt: collisionAt,
    rayDistance: rayDistance,
    trapVelocity: trapVelocity,
    trapCover: trapCover,
    trapProfile: trapProfile
  };
})();
