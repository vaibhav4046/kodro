/*
 * Browser lesson grader - the JS twin of robolearn/lessons/grader.py plus the
 * slice of the Python engine a graded run needs (WebBackend slice 2).
 *
 * On the desktop app, Submit re-runs the pupil source in the Python engine
 * (BridgeAPI.submit_attempt), grades the trace against the lesson's
 * success_criteria and returns {passed, score, reasons, hint}. The
 * zero-install static build has no Python, so this module does the SAME job
 * headlessly in the browser: compile the source with the shipped interpreter
 * (window.RoverLang), drive its generator against a metre-unit port of the
 * Python lesson world (engine/rover.py + engine/sensors.py semantics, shared
 * battery constants from window.KodroMotion.MODEL), then apply grader.py's
 * criterion checks with the same failure messages.
 *
 *   window.KodroLessonGrader.grade(lesson, source) -> Promise<{
 *     ok, lessonId, graded, passed, score, reasons: [..],
 *     hint: {ruleName, message} | null, events: [..],
 *     achievements: [], recommended: null,
 *   }>
 *
 * The per-lesson world/criteria/hints data is embedded below (LESSON_DATA),
 * generated from src/robolearn/lessons/library/*.yaml. scripts/qa_grader.mjs
 * re-extracts the YAMLs on every run and fails if this table drifts.
 *
 * Known, deliberate divergences from the Python grader (documented, all in
 * the pupil's favour or cosmetic; scripts/qa_grader.mjs pins the rest):
 *  - The JS interpreter exposes int()/float()/str()/abs()/round()/min()/
 *    max()/sqrt() and the design dialect (rover.forward, stop(), tilt()...);
 *    the Python sandbox does not, so a program using them grades here but
 *    would raise NameError on the desktop.
 *  - Python clamps a single move to 1000 m, the JS interpreter to 40 m. Every
 *    lesson arena is at most 10 m wide, so the wall clamps such a move first
 *    and both engines register the same collision at the same spot.
 *  - turn_left(-30) is traced as turn_right(30) (the interpreter normalises
 *    the sign into the event); the applied rotation is identical.
 *  - Hint choice: the desktop ranks hints with the learned hint engine; the
 *    browser returns the lesson's first on_failure hint on a fail and the
 *    first on_success hint on a pass (none of the shipped lessons has one).
 *  - Method calls (xs.append(...), "s".upper()) run on the Python engine but
 *    are NOT supported here; the browser raises a message naming that limit.
 *    This one is NOT in the pupil's favour, which is why it is stated plainly
 *    rather than filed under "cosmetic": the same source grades differently.
 *    No shipped lesson requires a method call, so no lesson is blocked by it.
 */
(function () {
  'use strict';

  // --- shared constants (motion-model.js is loaded before this module) -----
  var MODEL = (window.KodroMotion && window.KodroMotion.MODEL) || {};
  // Same derivation as engine/motion_model.py BATTERY_PCT_PER_METRE et al.
  var BATTERY_PER_METRE = (MODEL.drainPctPerCm !== undefined ? MODEL.drainPctPerCm : 0.011) * 100.0;
  var BATTERY_PER_DEGREE = MODEL.drainPctPerDeg !== undefined ? MODEL.drainPctPerDeg : 0.004;
  var BATTERY_PER_COLLISION = MODEL.drainPctPerCollision !== undefined ? MODEL.drainPctPerCollision : 1;
  var ROVER_RADIUS_M = (MODEL.roverRadiusCm !== undefined ? MODEL.roverRadiusCm : 30) / 100.0;

  // engine/rover.py DEFAULT_DETECTION_RADIUS_M (samples + at_base).
  var DETECTION_RADIUS_M = 0.3;
  // lessons/grader.py RETURNS_TO_BASE_TOLERANCE_M.
  var RETURNS_TO_BASE_TOLERANCE_M = 0.4;
  // lessons/grader.py SCORE_PENALTY_PER_FAILURE.
  var SCORE_PENALTY_PER_FAILURE = 20;
  // engine/sensors.py LIDAR_MAX_RANGE_M.
  var LIDAR_MAX_RANGE_M = 50.0;
  // rover_api clamp bounds for sensor thresholds.
  var MAX_DISTANCE_M = 1000.0;
  // Yielded-event cap so a runaway generator cannot wedge the tab (the
  // interpreter's own MAX_STEPS usually trips first).
  var EVENT_CAP = 400000;

  // engine/sensors.py TERRAIN_COLOURS + indicators, for read_colour().
  var TERRAIN_COLOURS = {
    earth: [139, 195, 74], mars: [193, 68, 14],
    underwater: [3, 80, 150], space: [10, 10, 30],
  };
  var COLOUR_SAMPLE = [255, 215, 0];
  var COLOUR_BASE = [50, 205, 50];

  // --- per-lesson grading data (generated from lessons/library/*.yaml) -----
  // Regenerate with: node scripts/qa_grader.mjs --emit
  var LESSON_DATA = {
    "00_first_drive": {"world":{"base":[1,1],"samples":[],"obstacles":[],"width":6,"height":6},"criteria":[{"min_distance_travelled":3},{"no_collisions":true}],"hints":{"onFailure":["Use move_forward to drive the rover ahead. Try move_forward(2).","You can use move_forward more than once to go further."],"onSuccess":[]}},
    "00b_repeat_square": {"world":{"base":[3,3],"samples":[],"obstacles":[],"width":8,"height":8},"criteria":[{"min_distance_travelled":6},{"uses_construct":"for"},{"no_collisions":true}],"hints":{"onFailure":["Use a loop: 'for side in range(4):' then indent the steps to repeat.","Inside the loop, move_forward and then turn_right(90) to make each corner."],"onSuccess":[]}},
    "00c_look_first": {"world":{"base":[1,1],"samples":[],"obstacles":[{"x":1.8,"y":1,"r":0.4}],"width":6,"height":6},"criteria":[{"min_distance_travelled":2.5},{"uses_construct":"if"},{"no_collisions":true}],"hints":{"onFailure":["Ask the sensor first: 'if obstacle_ahead():' then turn out of the way.","After the if, drive forward. Keep the move_forward OUTSIDE the if so it always runs."],"onSuccess":[]}},
    "01_hello_rover": {"world":{"base":[1,1],"samples":[],"obstacles":[],"width":6,"height":6},"criteria":[{"min_distance_travelled":1.5},{"max_battery_used":5},{"no_collisions":true}],"hints":{"onFailure":["Check that you call all three functions, in this exact order: move_forward, beep, log.","Make sure each function name is spelled correctly and ends with parentheses."],"onSuccess":[]}},
    "02_move_turn": {"world":{"base":[1,1],"samples":[[4,4]],"obstacles":[],"width":6,"height":6},"criteria":[{"samples_collected":1},{"max_battery_used":15},{"no_collisions":true}],"hints":{"onFailure":["After your first move_forward the rover is east of the base. You need to turn left and drive again to reach (4, 4).","Remember to call collect_sample() once the rover sits on top of the patch."],"onSuccess":[]}},
    "03_sequence": {"world":{"base":[1,1],"samples":[[1,3]],"obstacles":[],"width":6,"height":6},"criteria":[{"samples_collected":1},{"max_battery_used":25},{"no_collisions":true}],"hints":{"onFailure":["Each move_forward distance should match the gap between corners. Sketch the path on paper first.","If the rover stops before the sample, increase the last move_forward distance by one metre."],"onSuccess":[]}},
    "04_selection": {"world":{"base":[1,1],"samples":[[5,1]],"obstacles":[{"x":3,"y":1,"r":0.4}],"width":6,"height":6},"criteria":[{"samples_collected":1},{"no_collisions":true},{"uses_construct":"if"}],"hints":{"onFailure":["The if-statement runs only once. Repeat it (or use a loop) until the rover passes the rock.","Did you call collect_sample() once the rover reaches the patch?"],"onSuccess":[]}},
    "05_iteration": {"world":{"base":[1,5],"samples":[[3,6],[4.5,5.4],[6,6.4]],"obstacles":[{"x":8,"y":5.5,"r":0.3}],"width":10,"height":8},"criteria":[{"samples_collected":3},{"max_battery_used":60},{"no_collisions":true},{"uses_construct":"while"}],"hints":{"onFailure":["Your loop ended early -- have you logged sample_detected() to see when it fires?","Try moving in smaller steps (e.g. move_forward(0.5)) so the rover doesn't overshoot a sample."],"onSuccess":[]}},
    "06_functions": {"world":{"base":[3,3],"samples":[[5,3],[5,5],[3,5],[3,3]],"obstacles":[],"width":8,"height":8},"criteria":[{"samples_collected":4},{"max_battery_used":60},{"uses_construct":"function_def"}],"hints":{"onFailure":["Define hop() once at the top, then call it four times to walk a square.","Add collect_sample() inside hop() so each corner picks up its patch."],"onSuccess":[]}},
    "07_sensors": {"world":{"base":[1,1],"samples":[[5,1]],"obstacles":[],"width":6,"height":6},"criteria":[{"samples_collected":1},{"no_collisions":true}],"hints":{"onFailure":["If the rover hits the wall, your while condition is too generous -- try > 1.0 not > 0.1.","Drive in smaller increments so the loop can react before a collision."],"onSuccess":[]}},
    "08_pathfinding": {"world":{"base":[1,5],"samples":[[9,5]],"obstacles":[{"x":5,"y":5,"r":0.4}],"width":10,"height":10},"criteria":[{"samples_collected":1},{"returns_to_base":true},{"no_collisions":true}],"hints":{"onFailure":["Did the rover get stuck? Add a log() call inside the loop to see which branch fires each iteration.","If the rover never reaches the sample, increase the distance in your else branch."],"onSuccess":[]}},
    "09_recursion": {"world":{"base":[5,5],"samples":[],"obstacles":[],"width":10,"height":10},"criteria":[{"min_distance_travelled":8},{"max_battery_used":80},{"no_collisions":true},{"uses_construct":"recursion"}],"hints":{"onFailure":["If the rover runs off the arena, your starting step is too big -- try spiral(2.0).","Don't forget the base case (the if step < 0.5: return) or the function recurses forever."],"onSuccess":[]}},
    "10_optimisation": {"world":{"base":[1,1],"samples":[[2,6],[5,5],[7,2]],"obstacles":[],"width":10,"height":8},"criteria":[{"samples_collected":3},{"returns_to_base":true},{"max_battery_used":70}],"hints":{"onFailure":["If the rover overshoots, lower the per-step distance from 0.5 m to 0.2 m.","Compare the total distance for at least two different sample orderings."],"onSuccess":[]}},
    "11_decomposition": {"world":{"base":[1,1],"samples":[[4,1],[4,4]],"obstacles":[],"width":10,"height":10},"criteria":[{"samples_collected":2},{"no_collisions":true},{"uses_construct":"function_def"}],"hints":{"onFailure":["You collected the first sample but not the second -- call leg_two() as well.","Each helper should do exactly one leg of the route; then call them in order."],"onSuccess":[]}},
    "12_abstraction": {"world":{"base":[5,1],"samples":[],"obstacles":[{"x":5,"y":4,"r":0.6}],"width":10,"height":10},"criteria":[{"no_collisions":true},{"uses_construct":"if"},{"min_distance_travelled":3}],"hints":{"onFailure":["Check obstacle_ahead() BEFORE you move, then turn_left(90) when it is True.","Wrap the move in an if/else so the rover only drives forward when the way is clear."],"onSuccess":[]}},
    "13_nested_loops": {"world":{"base":[1,1],"samples":[[3,1],[5,1],[7,1],[3,3],[5,3],[7,3]],"obstacles":[],"width":10,"height":10},"criteria":[{"samples_collected":6},{"no_collisions":true},{"uses_construct":"for"}],"hints":{"onFailure":["You collected one row. Add an outer loop so the inner sweep repeats for each row.","After each row, turn and move to the next row before sweeping again."],"onSuccess":[]}},
    "14_counting": {"world":{"base":[1,1],"samples":[[3,1],[5,1],[7,1]],"obstacles":[],"width":10,"height":10},"criteria":[{"samples_collected":3},{"no_collisions":true},{"uses_construct":"while"}],"hints":{"onFailure":["You collected one sample. Put the move/collect/count lines inside a `while count < 3:` loop.","Remember to add 1 to count inside the loop, or it will never reach 3 and will loop forever."],"onSuccess":[]}},
    "15_parameters": {"world":{"base":[1,1],"samples":[[3,1],[6,1],[8,1]],"obstacles":[],"width":10,"height":10},"criteria":[{"samples_collected":3},{"no_collisions":true},{"uses_construct":"function_def"}],"hints":{"onFailure":["The samples are at different gaps, so a fixed 2m hop can't reach them all -- add a `distance` parameter.","Define `def hop(distance):` then call hop(2), hop(3), hop(2) to step between the samples."],"onSuccess":[]}},
  };

  // --- geometry (ports of engine/motion_model.py + engine/sensors.py) ------

  // motion_model.segment_circle_hit: first contact t in [0,1] where the swept
  // segment a->b meets a circle (obstacle grown by the rover radius).
  function segmentCircleHit(ax, ay, bx, by, cx, cy, radius) {
    var dx = bx - ax, dy = by - ay;
    var fx = ax - cx, fy = ay - cy;
    var a = dx * dx + dy * dy;
    var c = fx * fx + fy * fy - radius * radius;
    if (a <= 1e-12) {
      // Degenerate (zero-length) move: contact only if already inside.
      return c <= 0.0 ? 0.0 : null;
    }
    var b = 2.0 * (fx * dx + fy * dy);
    if (c <= 0.0) {
      // The segment STARTS on or inside the grown circle, which is exactly
      // where a previous swept stop leaves the rover. The old max(0, t1)
      // collapsed this to t=0 for EVERY direction, so a rover that had
      // kissed a rock was trapped at the contact point forever in the
      // browser grade while the desktop let it back off (motion_model.py
      // fixed this on its side and this mirror was missed; the cross-engine
      // fuzz found the divergence). Moving away or tangentially is free;
      // only moving deeper in is an immediate contact.
      return b < 0.0 ? 0.0 : null;
    }
    var disc = b * b - 4.0 * a * c;
    if (disc < 0.0) return null;
    var sq = Math.sqrt(disc);
    var t1 = (-b - sq) / (2.0 * a);
    var t2 = (-b + sq) / (2.0 * a);
    if (t2 < 0.0 || t1 > 1.0) return null;
    return Math.max(0.0, t1);
  }

  // sensors._circle_ray_intersection: smallest positive t along a unit ray.
  function circleRayHit(x, y, dx, dy, cx, cy, radius) {
    var ox = x - cx, oy = y - cy;
    var b = ox * dx + oy * dy;
    var c = ox * ox + oy * oy - radius * radius;
    var disc = b * b - c;
    if (disc < 0) return null;
    var sq = Math.sqrt(disc);
    var t1 = -b - sq;
    if (t1 >= 0) return t1;
    var t2 = -b + sq;
    if (t2 >= 0) return t2;
    return null;
  }

  // sensors.lidar_distance: nearest wall or obstacle along the heading, in
  // metres; Infinity beyond max range. Includes the on-the-wall epsilon rule.
  function lidarDistance(rover, world) {
    var dir = ((rover.heading % 360.0) + 360.0) % 360.0;
    var rad = dir * Math.PI / 180.0;
    var dx = Math.cos(rad), dy = Math.sin(rad);
    var rx = rover.x, ry = rover.y;
    var nearest = LIDAR_MAX_RANGE_M;
    var eps = 1e-12;
    var t, hit;
    if (Math.abs(dx) > eps) {
      var wallsX = [0.0, world.width];
      for (var i = 0; i < 2; i++) {
        t = (wallsX[i] - rx) / dx;
        if (t <= eps) continue; // a rover ON a wall reads the far wall, not 0
        hit = ry + t * dy;
        if (hit >= 0.0 && hit <= world.height) nearest = Math.min(nearest, t);
      }
    }
    if (Math.abs(dy) > eps) {
      var wallsY = [0.0, world.height];
      for (var j = 0; j < 2; j++) {
        t = (wallsY[j] - ry) / dy;
        if (t <= eps) continue;
        hit = rx + t * dx;
        if (hit >= 0.0 && hit <= world.width) nearest = Math.min(nearest, t);
      }
    }
    for (var k = 0; k < world.obstacles.length; k++) {
      var o = world.obstacles[k];
      var oh = circleRayHit(rx, ry, dx, dy, o.x, o.y, o.r);
      if (oh !== null) nearest = Math.min(nearest, oh);
    }
    if (nearest >= LIDAR_MAX_RANGE_M) return Infinity;
    return Math.max(0.0, nearest);
  }

  // rover_api._clamp_finite: NaN/Infinity map to the LOWER bound.
  function clampFinite(v, lo, hi) {
    var n = Number(v);
    if (!isFinite(n)) return lo;
    return Math.min(hi, Math.max(lo, n));
  }

  // --- rover model (port of engine/rover.py) --------------------------------

  function makeRover(world) {
    return {
      x: world.base[0], y: world.base[1],
      heading: 0.0,               // 0 = east, anticlockwise positive
      battery: 100.0,
      collisions: 0,
      distance: 0.0,
      samplesHeld: 0,
      samplesCollected: 0,
      speed: 50,                  // design-dialect nicety; no Python effect
    };
  }

  function drain(rover, amountPct) {
    rover.battery = Math.max(0.0, rover.battery - amountPct);
  }

  // Rover.move: swept-circle sweep against grown obstacles, wall clamp, drain
  // for the distance ACTUALLY travelled, one collision on obstacle or wall.
  function roverMove(rover, world, distanceM) {
    var rad = rover.heading * Math.PI / 180.0;
    var idealDx = distanceM * Math.cos(rad);
    var idealDy = distanceM * Math.sin(rad);
    var sx = rover.x, sy = rover.y;
    var tx = sx + idealDx, ty = sy + idealDy;
    // Stop at the FIRST contact along the ORIGINAL segment: take the minimum
    // t across all obstacles, then apply it once. The old loop shortened the
    // target inside the loop while still scaling by the full ideal
    // displacement, so with two obstacles on the path the later-listed one
    // could overshoot the true nearer contact (the same order-dependence
    // rover.py fixed on the Python side; this mirror had kept the old loop).
    var hitObstacle = false;
    var firstT = null;
    for (var i = 0; i < world.obstacles.length; i++) {
      var o = world.obstacles[i];
      var t = segmentCircleHit(sx, sy, tx, ty, o.x, o.y, o.r + ROVER_RADIUS_M);
      if (t !== null && (firstT === null || t < firstT)) firstT = t;
    }
    if (firstT !== null) {
      tx = sx + idealDx * firstT;
      ty = sy + idealDy * firstT;
      hitObstacle = true;
    }
    rover.x = Math.min(Math.max(tx, 0.0), world.width);
    rover.y = Math.min(Math.max(ty, 0.0), world.height);
    var hitWall = rover.x !== tx || rover.y !== ty;
    var travelled = Math.hypot(rover.x - sx, rover.y - sy);
    rover.distance += travelled;
    drain(rover, travelled * BATTERY_PER_METRE);
    if (hitObstacle || hitWall) {
      rover.collisions += 1;
      drain(rover, BATTERY_PER_COLLISION);
    }
  }

  // Rover.turn (anticlockwise positive; Python's % is never negative).
  function roverTurn(rover, angleDeg) {
    rover.heading = (((rover.heading + angleDeg) % 360.0) + 360.0) % 360.0;
    drain(rover, Math.abs(angleDeg) * BATTERY_PER_DEGREE);
  }

  // Rover._nearest_sample: closest uncollected sample within radius.
  function nearestSample(rover, world, radiusM) {
    var best = null;
    var bestD = radiusM;
    for (var i = 0; i < world.samples.length; i++) {
      var s = world.samples[i];
      if (s.collected) continue;
      var d = Math.hypot(rover.x - s.x, rover.y - s.y);
      if (d <= bestD) { best = s; bestD = d; }
    }
    return best;
  }

  function tryCollect(rover, world) {
    var s = nearestSample(rover, world, DETECTION_RADIUS_M);
    if (s === null) return false;
    s.collected = true;
    rover.samplesHeld += 1;
    rover.samplesCollected += 1;
    return true;
  }

  function tryDrop(rover) {
    if (rover.samplesHeld <= 0) return false;
    rover.samplesHeld -= 1;
    return true;
  }

  function atBase(rover, world) {
    return Math.hypot(rover.x - world.base[0], rover.y - world.base[1]) <= DETECTION_RADIUS_M;
  }

  // sensors.colour_under precedence: base, then sample, then terrain.
  function colourUnder(rover, world, terrain) {
    if (Math.hypot(rover.x - world.base[0], rover.y - world.base[1]) <= DETECTION_RADIUS_M) {
      return COLOUR_BASE.slice();
    }
    for (var i = 0; i < world.samples.length; i++) {
      var s = world.samples[i];
      if (s.collected) continue;
      if (Math.hypot(rover.x - s.x, rover.y - s.y) <= DETECTION_RADIUS_M) {
        return COLOUR_SAMPLE.slice();
      }
    }
    return (TERRAIN_COLOURS[terrain] || TERRAIN_COLOURS.earth).slice();
  }

  // --- headless run ----------------------------------------------------------

  function makeWorld(entry) {
    return {
      base: [entry.world.base[0], entry.world.base[1]],
      width: entry.world.width,
      height: entry.world.height,
      samples: entry.world.samples.map(function (s) {
        return { x: s[0], y: s[1], collected: false };
      }),
      obstacles: entry.world.obstacles.map(function (o) {
        return { x: o.x, y: o.y, r: o.r };
      }),
    };
  }

  // Run the pupil source in the lesson world. Returns
  //   { events, rover, error: null } on a clean run, or
  //   { events, rover, error: {kind, message, line} } on failure.
  // Every traced call mirrors one rover_api tracer event (step_count parity):
  // the Python sandbox rewires print() to rover_api.log, so both print and
  // log count as one 'log' event here too.
  function runProgram(entry, source, terrain) {
    var events = [];
    function trace(name, args, result, kind) {
      events.push({ frame: 0, kind: kind, name: name, args: args, result: result });
    }
    if (!window.RoverLang) {
      return { events: events, rover: null, error: { kind: 'runtime', message: 'interpreter not loaded', line: null } };
    }
    var program;
    try {
      program = window.RoverLang.compile(source);
    } catch (e) {
      return { events: events, rover: null, error: { kind: 'syntax', message: (e && e.message) || String(e), line: (e && e.line) || null } };
    }

    var world = makeWorld(entry);
    var rover = makeRover(world);

    var host = {
      sensor: function (name) {
        var v;
        switch (name) {
          case 'distance':          // read_distance(): metres, inf past 50 m
            v = lidarDistance(rover, world);
            trace('read_distance', [], v, 'sensor_read');
            return v;
          case 'heading':
            v = rover.heading;
            trace('read_heading', [], v, 'sensor_read');
            return v;
          case 'battery':
            v = rover.battery;
            trace('read_battery', [], v, 'sensor_read');
            return v;
          case 'ground':            // read_colour(): [r, g, b] like Python
            v = colourUnder(rover, world, terrain);
            trace('read_colour', [], v.slice(), 'sensor_read');
            return v;
          default:
            // Design-dialect extras (speed/tilt/x/y/temperature/light/
            // gravity) have no Python pupil API; the desktop grader would
            // raise NameError. Answer with engine-state values so a design-
            // dialect program at least runs deterministically here.
            v = ({
              speed: rover.speed,
              x: Math.round(rover.x * 100),
              y: Math.round(rover.y * 100),
              gravity: 9.81,
              temperature: 16,
              light: 80,
              tilt: 0,
            })[name];
            v = v === undefined ? 0 : v;
            trace(name, [], v, 'sensor_read');
            return v;
        }
      },
      // Lesson world API (interpreter.js routes these five verbs here when
      // the host provides lessonApi): Python-faithful samples/base/look-ahead.
      lessonApi: function (name, args) {
        var v, safe;
        switch (name) {
          case 'obstacle_ahead':
            safe = clampFinite(args.length ? args[0] : 0.5, 0.0, MAX_DISTANCE_M);
            v = lidarDistance(rover, world) <= safe;
            trace('obstacle_ahead', [safe], v, 'sensor_read');
            return v;
          case 'sample_detected':
            safe = clampFinite(args.length ? args[0] : 0.3, 0.0, MAX_DISTANCE_M);
            v = nearestSample(rover, world, safe) !== null;
            trace('sample_detected', [safe], v, 'sensor_read');
            return v;
          case 'at_base':
            v = atBase(rover, world);
            trace('at_base', [], v, 'sensor_read');
            return v;
          case 'collect_sample':
            v = tryCollect(rover, world);
            trace('collect_sample', [], v, 'sample');
            return v;
          case 'drop_sample':
            v = tryDrop(rover);
            trace('drop_sample', [], v, 'sample');
            return v;
        }
        return null;
      },
    };

    var gen;
    try {
      gen = program.run(host);
    } catch (e) {
      return { events: events, rover: rover, error: { kind: 'runtime', message: (e && e.message) || String(e), line: (e && e.line) || null } };
    }
    var guard = 0;
    try {
      for (;;) {
        var res = gen.next();
        if (res.done) break;
        if (++guard > EVENT_CAP) {
          return { events: events, rover: rover, error: { kind: 'timeout', message: 'program did not finish (too many steps)', line: null } };
        }
        var ev = res.value;
        switch (ev.type) {
          case 'move': {
            var d = ev.dir * ev.distance / 100.0; // interpreter emits cm
            roverMove(rover, world, d);
            trace(ev.dir < 0 ? 'move_backward' : 'move_forward', [Math.abs(d)], null, 'call');
            break;
          }
          case 'turn':
            // JS events use compass-positive degrees; the Python engine is
            // anticlockwise-positive, so the applied angle is -deg.
            roverTurn(rover, -ev.deg);
            trace(ev.deg < 0 ? 'turn_left' : 'turn_right', [Math.abs(ev.deg)], null, 'call');
            break;
          case 'speed':
            rover.speed = ev.value;
            trace('set_speed', [ev.value], null, 'call');
            break;
          case 'wait':
            trace('wait', [ev.seconds], null, 'call');
            break;
          case 'pen':
            trace(ev.down ? 'pen_down' : 'pen_up', [], null, 'call');
            break;
          case 'halt':
            trace('stop', [], null, 'call');
            break;
          case 'led':
            trace('led', [ev.color], null, 'call');
            break;
          case 'say':
            trace('say', [ev.text], null, 'call');
            break;
          case 'scan':
            trace('scan', [], null, 'call');
            break;
          case 'beep':
            trace('beep', [ev.times], null, 'call');
            break;
          case 'print':
            // print() and log() are the same traced call under the Python
            // sandbox (print is rewired to rover_api.log).
            trace('log', [ev.text], null, 'call');
            break;
          case 'place':
            trace('place', ev.x !== undefined ? [ev.kind, ev.x / 100.0, ev.y / 100.0] : [ev.kind], null, 'call');
            break;
          case 'clear_props':
            trace('clear_props', [], null, 'call');
            break;
          default:
            break; // 'step' bookkeeping events are not API calls
        }
      }
    } catch (e) {
      return { events: events, rover: rover, error: { kind: 'runtime', message: (e && e.message) || String(e), line: (e && e.line) || null } };
    }
    return { events: events, rover: rover, error: null };
  }

  // --- uses_construct (port of grader.py _source_uses / _has_recursion) -----

  // Walk the interpreter's own AST. Statements carry `kind`, expressions `k`.
  function walkNode(node, fn) {
    if (!node || typeof node !== 'object') return;
    fn(node);
    if (node.kind) {
      switch (node.kind) {
        case 'for': walkNode(node.iter, fn); walkList(node.body, fn); break;
        case 'while': walkNode(node.test, fn); walkList(node.body, fn); break;
        case 'if':
          (node.branches || []).forEach(function (b) { walkNode(b.test, fn); walkList(b.body, fn); });
          if (node.orelse) walkList(node.orelse, fn);
          break;
        case 'def': walkList(node.body, fn); break;
        case 'return': if (node.expr) walkNode(node.expr, fn); break;
        case 'assign': case 'augassign': walkNode(node.expr, fn); break;
        case 'expr': walkNode(node.expr, fn); break;
        default: break; // pass / break / continue
      }
      return;
    }
    switch (node.k) {
      case 'list': case 'tuple': (node.items || []).forEach(function (it) { walkNode(it, fn); }); break;
      case 'unary': case 'not': walkNode(node.e, fn); break;
      case 'and': case 'or': case 'bin': walkNode(node.l, fn); walkNode(node.r, fn); break;
      case 'cmp': (node.operands || []).forEach(function (op) { walkNode(op, fn); }); break;
      case 'attr': walkNode(node.obj, fn); break;
      case 'call':
        walkNode(node.callee, fn);
        (node.args || []).forEach(function (a) { walkNode(a, fn); });
        break;
      default: break; // num / str / bool / none / name
    }
  }

  function walkList(stmts, fn) {
    (stmts || []).forEach(function (s) { walkNode(s, fn); });
  }

  // grader.py _CONSTRUCT_NODE_TYPES, mapped onto the JS AST shapes.
  var CONSTRUCT_TESTS = {
    'while': function (n) { return n.kind === 'while'; },
    'for': function (n) { return n.kind === 'for'; },
    'if': function (n) { return n.kind === 'if'; },
    'function_def': function (n) { return n.kind === 'def'; },
    'function_call': function (n) { return n.k === 'call'; },
    'comparison': function (n) { return n.k === 'cmp'; },
    'arithmetic': function (n) { return n.k === 'bin'; },
    'assignment': function (n) { return n.kind === 'assign' || n.kind === 'augassign'; },
    'logical': function (n) { return n.k === 'and' || n.k === 'or'; },
    'return': function (n) { return n.kind === 'return'; },
  };

  // grader.py _is_constant_falsy: a literal test that can never be truthy.
  function isConstantFalsy(t) {
    if (!t) return false;
    if (t.k === 'bool' || t.k === 'num' || t.k === 'str') return !t.v;
    if (t.k === 'none') return true;
    if (t.k === 'list') return !(t.items && t.items.length);
    return false;
  }

  // grader.py _is_provably_empty_iterable: a `for` over something literally empty.
  function isProvablyEmptyIterable(it) {
    if (!it) return false;
    if (it.k === 'list') return !(it.items && it.items.length);
    if (it.k === 'str') return it.v === '';
    if (it.k === 'call' && it.callee && it.callee.k === 'name' && it.callee.v === 'range'
        && it.args && it.args.length && it.args.every(function (a) { return a.k === 'num'; })) {
      var v = it.args.map(function (a) { return a.v; });
      if (v.length === 1) return v[0] <= 0;
      var step = v.length > 2 ? v[2] : 1;
      if (step === 0) return false;
      return step > 0 ? v[0] >= v[1] : v[0] <= v[1];
    }
    return false;
  }

  // grader.py _is_live: reject constructs that provably cannot do the work the
  // lesson asks for. A dead `if False:` satisfied the bare node-presence test
  // while letting a pupil pass a sensor lesson without reading the sensor.
  // Only PROVABLY dead code is rejected: `while True:` is an ordinary idiom
  // and `if True:` still runs its body, so both still count. Must stay in step
  // with the Python grader or the two engines disagree on the same program.
  function isLive(n, program) {
    if (n.kind === 'if') {
      var branches = n.branches || [];
      for (var i = 0; i < branches.length; i++) {
        if (!isConstantFalsy(branches[i].test)) return true;
      }
      return false;
    }
    if (n.kind === 'while') return !isConstantFalsy(n.test);
    if (n.kind === 'for') return !isProvablyEmptyIterable(n.iter);
    if (n.kind === 'def') {
      // A definition nobody ever names is dead code, not modular design.
      var named = false;
      walkList(program, function (o) {
        if (o && o.k === 'name' && o.v === n.name) named = true;
      });
      return named;
    }
    return true;
  }

  function sourceUses(source, construct) {
    if (!source || !source.trim()) return false;
    if (!window.RoverLang) return false;
    var program;
    try {
      program = window.RoverLang.compile(source).program;
    } catch (e) {
      void e;
      return false; // grader.py: a SyntaxError means the construct is absent
    }
    if (construct === 'recursion') return hasRecursion(program);
    var test = CONSTRUCT_TESTS[construct];
    if (!test) return false;
    var found = false;
    walkList(program, function (n) { if (test(n) && isLive(n, program)) found = true; });
    return found;
  }

  // grader.py _has_recursion: any def whose subtree calls its own name.
  function hasRecursion(program) {
    var found = false;
    walkList(program, function (n) {
      if (found || n.kind !== 'def') return;
      walkList(n.body, function (inner) {
        if (inner.k === 'call' && inner.callee && inner.callee.k === 'name' && inner.callee.v === n.name) {
          found = true;
        }
      });
    });
    return found;
  }

  // --- criteria (port of grader.py _check_criterion) -------------------------

  function computeAggregates(run) {
    var rover = run.rover;
    var hasEvents = run.events.length > 0;
    return {
      samplesCollected: rover ? rover.samplesCollected : 0,
      collisions: rover ? rover.collisions : 0,
      distanceTravelledM: rover ? rover.distance : 0.0,
      batteryUsedPct: rover ? (100.0 - rover.battery) : 0.0,
      stepCount: run.events.length,
      finalX: hasEvents && rover ? rover.x : null,
      finalY: hasEvents && rover ? rover.y : null,
    };
  }

  function returnsToBase(agg, entry) {
    if (agg.finalX === null || agg.finalY === null) return false;
    var bx = entry.world.base[0], by = entry.world.base[1];
    return Math.hypot(agg.finalX - bx, agg.finalY - by) <= RETURNS_TO_BASE_TOLERANCE_M;
  }

  // Same dispatch order and the same pupil-facing messages as grader.py.
  function checkCriterion(criterion, agg, entry, source) {
    if (criterion.samples_collected !== undefined
        && agg.samplesCollected < criterion.samples_collected) {
      return 'Collected ' + agg.samplesCollected + ' of ' + criterion.samples_collected + ' samples.';
    }
    if (criterion.no_collisions === true && agg.collisions > 0) {
      return 'Recorded ' + agg.collisions + ' collision(s); none were expected.';
    }
    if (criterion.max_battery_used !== undefined
        && agg.batteryUsedPct > criterion.max_battery_used) {
      return 'Battery used ' + agg.batteryUsedPct.toFixed(1) + '% '
        + '(limit ' + Number(criterion.max_battery_used).toFixed(1) + '%).';
    }
    if (criterion.uses_construct !== undefined && !sourceUses(source, criterion.uses_construct)) {
      return "Code did not use the required '" + criterion.uses_construct + "' construct.";
    }
    if (criterion.returns_to_base === true && !returnsToBase(agg, entry)) {
      return 'Rover did not return to base.';
    }
    if (criterion.max_steps !== undefined && agg.stepCount > criterion.max_steps) {
      return 'Used ' + agg.stepCount + ' API calls (limit ' + criterion.max_steps + ').';
    }
    if (criterion.min_distance_travelled !== undefined
        && agg.distanceTravelledM < criterion.min_distance_travelled) {
      return 'Travelled ' + agg.distanceTravelledM.toFixed(1) + ' m '
        + '(minimum ' + Number(criterion.min_distance_travelled).toFixed(1) + ' m).';
    }
    return null;
  }

  // --- learner-facing goal checklist helpers --------------------------------
  // The lesson card shows each criterion as a goal the pupil can read BEFORE
  // running, then ticks or crosses it against the verdict. describeCriterion
  // turns the machine criterion into plain English; criterionFailedIn says
  // whether a verdict reason belongs to this criterion (the patterns mirror
  // the exact message templates in checkCriterion above -- change one, change
  // the other).
  var CONSTRUCT_LABEL = {
    for: 'a for loop', while: 'a while loop', if: 'an if statement',
    function_def: 'a function (def)', recursion: 'recursion',
  };
  function describeCriterion(c) {
    if (!c) return '';
    if (c.samples_collected !== undefined) return 'Collect ' + c.samples_collected + ' sample' + (c.samples_collected === 1 ? '' : 's');
    if (c.no_collisions === true) return 'Do not hit anything';
    if (c.max_battery_used !== undefined) return 'Use at most ' + c.max_battery_used + '% battery';
    if (c.uses_construct !== undefined) return 'Use ' + (CONSTRUCT_LABEL[c.uses_construct] || "'" + c.uses_construct + "'");
    if (c.returns_to_base === true) return 'Return to base';
    if (c.max_steps !== undefined) return 'Use at most ' + c.max_steps + ' commands';
    if (c.min_distance_travelled !== undefined) return 'Travel at least ' + c.min_distance_travelled + ' m';
    return Object.keys(c).join(', ');
  }
  function criterionFailedIn(c, reasons) {
    if (!c || !reasons || !reasons.length) return false;
    var re = null;
    if (c.samples_collected !== undefined) re = /^Collected \d+ of \d+ samples\./;
    else if (c.no_collisions === true) re = /collision/;
    else if (c.max_battery_used !== undefined) re = /^Battery used /;
    else if (c.uses_construct !== undefined) re = new RegExp("did not use the required '" + c.uses_construct + "'");
    else if (c.returns_to_base === true) re = /did not return to base/;
    else if (c.max_steps !== undefined) re = /API calls \(limit/;
    else if (c.min_distance_travelled !== undefined) re = /^Travelled [\s\S]*minimum/;
    if (!re) return false;
    for (var i = 0; i < reasons.length; i++) { if (re.test(String(reasons[i]))) return true; }
    return false;
  }

  // --- public API -------------------------------------------------------------

  function firstHint(entry, passed) {
    var bank = passed ? entry.hints.onSuccess : entry.hints.onFailure;
    if (!bank || !bank.length) return null;
    return { ruleName: passed ? 'lesson_on_success' : 'lesson_on_failure', message: bank[0] };
  }

  function formatError(err) {
    return err.kind + ': ' + err.message + (err.line != null ? ' (line ' + err.line + ')' : '');
  }

  // Synchronous core; grade() wraps it in a Promise for the bridge.
  function gradeSync(lesson, source) {
    var id = lesson && (lesson.id || lesson.lessonId);
    var entry = id ? LESSON_DATA[id] : null;
    if (!entry) {
      return { ok: false, reason: 'unknown lesson: ' + id };
    }
    var terrain = (lesson && lesson.terrain) || 'earth';
    var src = source || '';
    var run = runProgram(entry, src, terrain);
    if (run.error) {
      // Mirror BridgeAPI.submit_attempt's error path: graded, score 0, the
      // error string as the single reason, plus the lesson's failure hint.
      return {
        ok: true, lessonId: id, graded: true, passed: false, score: 0,
        reasons: [formatError(run.error)],
        hint: firstHint(entry, false),
        events: run.events, achievements: [], recommended: null,
      };
    }
    var agg = computeAggregates(run);
    var reasons = [];
    for (var i = 0; i < entry.criteria.length; i++) {
      var reason = checkCriterion(entry.criteria[i], agg, entry, src);
      if (reason !== null) reasons.push(reason);
    }
    var passed = reasons.length === 0;
    var score = Math.max(0, 100 - SCORE_PENALTY_PER_FAILURE * reasons.length);
    return {
      ok: true, lessonId: id, graded: true, passed: passed, score: score,
      reasons: reasons,
      hint: firstHint(entry, passed),
      events: run.events, achievements: [], recommended: null,
    };
  }

  window.KodroLessonGrader = {
    grade: function (lesson, source) {
      return new Promise(function (resolve) { resolve(gradeSync(lesson, source)); });
    },
    gradeSync: gradeSync,
    sourceUses: sourceUses,
    describeCriterion: describeCriterion,
    criterionFailedIn: criterionFailedIn,
    LESSON_DATA: LESSON_DATA,
  };
})();
