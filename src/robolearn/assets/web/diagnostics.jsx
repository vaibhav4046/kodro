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
  // Default ultrasonic range from the SHARED motion model (E-P1); an imported
  // spec's real sensor range overrides it per-build inside assess().
  const SENSOR_RANGE = (window.KodroMotion && window.KodroMotion.MODEL.sensorRangeCm) || 600;

  function has(list, id) { return (list || []).indexOf(id) >= 0; }

  // Stopping distance (cm) at the build's top speed: heavier and faster takes
  // longer to halt. Tuned so a light, sensible build stops well within sensor
  // range and a heavy, fast one does not.
  function stoppingDistance(speedFactor, massFactor) {
    return Math.round(120 * speedFactor * speedFactor * massFactor);
  }

  // Mobility headroom on a surface: delegates to the shared motion model
  // (E-P1) so the design check and the live tick can never disagree about
  // what stalls. Below ~0.45 it cannot reliably get moving here.
  function mobilityScore(speedFactor, massFactor, traction) {
    return window.KodroMotion
      ? window.KodroMotion.mobilityScore(speedFactor, massFactor, traction)
      : (speedFactor * traction) / massFactor;
  }

  function assess(spec, derived, terrain) {
    spec = spec || {};
    derived = derived || {};
    const sensors = spec.sensors || [];
    const actuators = spec.actuators || [];
    const massFactor = derived.massFactor || 1;
    const speedFactor = derived.speedFactor || 1;
    const runtimeMin = derived.runtimeMin || 60;
    const traction = (terrain && terrain.traction) || 0.8;
    const gravity = (terrain && terrain.env && terrain.env.gravity) || 9.81;
    const worldName = (terrain && terrain.name) || 'this world';
    const driveCount = actuators.filter(function (a) { return a === 'motors2' || a === 'motors4' || a === 'servos'; }).length;

    const dims = [];

    // 1. MOBILITY -- can it physically get around on this surface?
    // An imported KRS build (derived.phys.stallForceN present) is judged by
    // the SAME force-ratio model the live tick drives it with (useSimEngine in
    // KodroMotion.physMobility / physStallVerdict), so the Design Check verdict
    // can never contradict what then happens on screen. Catalogue (non-physical)
    // builds keep the parts proxy (speedFactor*traction/massFactor).
    const physM = derived.phys;
    const usePhysMob = !!(physM && physM.stallForceN !== undefined && window.KodroMotion);
    const massKg = (physM && physM.massKg !== undefined) ? physM.massKg
      : (physM && physM.massKg === undefined && derived.mass ? derived.mass / 1000 : massFactor * 0.9);
    const mob = usePhysMob
      ? window.KodroMotion.physMobility(physM.stallForceN, massKg, traction, gravity)
      : mobilityScore(speedFactor, massFactor, traction);
    if (driveCount === 0) {
      dims.push({ key: 'mobility', label: 'Mobility', status: 'fail', margin: 0,
        reason: 'No drive parts fitted, so it can barely crawl and cannot complete a moving mission.',
        fix: 'Add a drive set: 2 DC motors for flat ground, or 4 DC motors for grip.' });
    } else if (mob < 0.45) {
      dims.push({ key: 'mobility', label: 'Mobility', status: 'fail', margin: +(mob / 0.45).toFixed(2),
        reason: 'Underpowered for ' + worldName + ': the build is too heavy for the grip its motors get on this low-traction surface, so it slips and stalls.',
        fix: 'Fit 4 DC motors for more torque, or shed mass by dropping spare sensors.' });
    } else if (mob < 0.75) {
      dims.push({ key: 'mobility', label: 'Mobility', status: 'warn', margin: +(mob / 0.75).toFixed(2),
        reason: 'Marginal traction on ' + worldName + ': it will move, but slowly and with some slip on the loose surface.',
        fix: 'Heavier terrain rewards 4 DC motors and a lighter chassis.' });
    } else {
      dims.push({ key: 'mobility', label: 'Mobility', status: 'pass', margin: +(mob).toFixed(2),
        reason: 'Good drive-to-weight for ' + worldName + ': it gets moving and holds the surface.', fix: '' });
    }

    // 2. OBSTACLE SENSING -- can it perceive and avoid hazards in time?
    // An imported spec's REAL sensor range replaces the 600 cm default, and
    // a physical build's braking distance comes from v^2/(2*mu*g) instead of
    // the catalogue proxy (SI2).
    const phys = derived.phys;
    const SENSOR_RANGE_BUILD = (phys && phys.sensor && phys.sensor.rangeCm) || SENSOR_RANGE;
    const hasRange = has(sensors, 'ultrasonic');
    // Stop distance must use the speed the live tick actually approaches at, not
    // the raw no-load top speed: the tick hard-throttles by the mobility
    // multiplier and by traction (hooks.jsx physV = vMaxSimCmPerS * mobMul *
    // traction at full speed), so a mobility-limited build reaches an obstacle
    // far slower and stops far sooner. Using vMaxSimCmPerS alone made the sensing
    // dimension emit a WARN the live run never earns, contradicting the tick.
    const approachMobMul = usePhysMob ? window.KodroMotion.mobilityMultiplier(driveCount > 0, mob) : 1;
    const stop = (phys && phys.vMaxSimCmPerS !== undefined && window.KodroMotion)
      ? Math.round(window.KodroMotion.physStoppingDistanceCm(phys.vMaxSimCmPerS * approachMobMul * traction, traction, gravity))
      : stoppingDistance(speedFactor, massFactor);
    if (!hasRange) {
      dims.push({ key: 'sensing', label: 'Obstacle sensing', status: 'fail', margin: 0,
        reason: 'No range sensor fitted, so the robot drives blind. distance() reads clear no matter what is ahead, and it will run into obstacles.',
        fix: 'Fit an Ultrasonic range sensor so it can see and avoid what is in front.' });
    } else if (stop > SENSOR_RANGE_BUILD * 0.6) {
      dims.push({ key: 'sensing', label: 'Obstacle sensing', status: 'warn', margin: +(SENSOR_RANGE_BUILD / stop).toFixed(2),
        reason: 'Stopping distance is about ' + stop + ' cm at top speed, which is tight against the ' + SENSOR_RANGE_BUILD + ' cm the sensor sees. A late obstacle can be hit before it halts.',
        fix: 'Cap speed with set_speed below 60, or lighten the build so it stops sooner.' });
    } else {
      dims.push({ key: 'sensing', label: 'Obstacle sensing', status: 'pass', margin: +(SENSOR_RANGE_BUILD / Math.max(1, stop)).toFixed(2),
        reason: 'Range sensor fitted and it stops in about ' + stop + ' cm, well inside its ' + SENSOR_RANGE_BUILD + ' cm view.', fix: '' });
    }

    // 3. ENDURANCE -- will the charge last, given mass and gravity?
    const gPenalty = 0.6 + 0.4 * (gravity / 9.81);
    const effMin = Math.round(runtimeMin / gPenalty);
    if (effMin < 30) {
      dims.push({ key: 'power', label: 'Endurance', status: 'fail', margin: +(effMin / 45).toFixed(2),
        reason: 'Only about ' + effMin + ' minutes of charge here: a heavy build drains fast' + (gravity > 9.9 ? ' and high gravity makes it worse' : '') + ', so it may die mid-mission.',
        fix: 'Drop mass (fewer parts, a lighter board) to extend runtime.' });
    } else if (effMin < 50) {
      dims.push({ key: 'power', label: 'Endurance', status: 'warn', margin: +(effMin / 45).toFixed(2),
        reason: 'About ' + effMin + ' minutes of charge: fine for a short task, tight for a long survey.', fix: 'Lighten the build for longer missions.' });
    } else {
      dims.push({ key: 'power', label: 'Endurance', status: 'pass', margin: +(effMin / 45).toFixed(2),
        reason: 'About ' + effMin + ' minutes of charge: comfortable for a full mission.', fix: '' });
    }

    // 4. NAVIGATION PRECISION -- does it know which way it points?
    if (!has(sensors, 'imu')) {
      dims.push({ key: 'nav', label: 'Navigation', status: 'warn', margin: 0.5,
        reason: 'No IMU, so heading() is unavailable and turns drift. Open-loop turning accumulates error over a long route.',
        fix: 'Add an IMU (gyro + accel) for steady, repeatable turns.' });
    } else {
      dims.push({ key: 'nav', label: 'Navigation', status: 'pass', margin: 1,
        reason: 'IMU fitted: heading() works and turns stay true.', fix: '' });
    }

    // 5. TASK FIT -- does the build match what its type is for?
    const type = spec.type;
    // Fix texts name REAL effects of fitting the part (mass, reach, sensing),
    // never a command: grab() and see() are not in the interpreter, and a
    // design check that recommends a command the robot cannot run undermines
    // the whole honesty story (product-coherence D6).
    if (type === 'arm' && !has(actuators, 'gripper')) {
      dims.push({ key: 'task', label: 'Task fit', status: 'fail', margin: 0,
        reason: 'A manipulator arm with no gripper cannot grab or place anything, which is its whole job.',
        fix: 'Fit a Gripper arm so the build can actually hold and place objects.' });
    } else if (type === 'home' && !has(sensors, 'bumper') && !hasRange) {
      dims.push({ key: 'task', label: 'Task fit', status: 'warn', margin: 0.5,
        reason: 'An indoor robot with no bumper or range sensor cannot tell it is about to touch a person or furniture.',
        fix: 'Add a Bumper switch or Ultrasonic sensor for safe indoor contact.' });
    } else if (type === 'car' && !has(sensors, 'camera')) {
      dims.push({ key: 'task', label: 'Task fit', status: 'warn', margin: 0.6,
        reason: 'A road vehicle with no camera cannot read markings, signs or a crossing.',
        fix: 'Add a Camera so the build carries the vision hardware a road robot needs.' });
    } else {
      dims.push({ key: 'task', label: 'Task fit', status: 'pass', margin: 1,
        reason: 'The fitted parts match what a ' + (type || 'robot') + ' needs for this world.', fix: '' });
    }

    // overall = worst dimension. Summarise honestly.
    const fails = dims.filter(function (d) { return d.status === 'fail'; });
    const warns = dims.filter(function (d) { return d.status === 'warn'; });
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

    return { overall: overall, summary: summary, dimensions: dims, topFix: topFix,
      numbers: { stoppingCm: stop, mobility: +mob.toFixed(2), enduranceMin: effMin, sensorRange: SENSOR_RANGE_BUILD, blind: !hasRange } };
  }

  // After a run, turn the design report plus what actually happened into one
  // honest verdict line: did the design hold up, and if not, why and what next.
  // `run` may carry real run stats from the host (bugs D5):
  //   commands        events the program actually executed (0 = nothing ran)
  //   distanceCm      odometer distance covered this run
  //   minProximityCm  closest approach to an obstacle during the run
  function afterRun(report, run) {
    run = run || {};
    const outcome = run.outcome; // 'done' | 'crash' | 'flat' | 'stalled'
    if (outcome === 'crash') {
      if (report && report.numbers && report.numbers.blind) {
        return { tone: 'err', text: 'As predicted, it drove blind into ' + (run.detail || 'an obstacle') + '. Fit an ultrasonic range sensor so it can see ahead.' };
      }
      return { tone: 'err', text: 'It hit ' + (run.detail || 'an obstacle') + '. ' + (report && report.numbers ? 'Stopping distance is about ' + report.numbers.stoppingCm + ' cm: slow down before hazards or add sensing.' : 'Slow down before hazards.') };
    }
    if (outcome === 'flat') {
      return { tone: 'err', text: 'It ran out of charge before finishing. This build lasts about ' + (report && report.numbers ? report.numbers.enduranceMin : '?') + ' minutes here; lighten it or shorten the mission.' };
    }
    if (outcome === 'stalled') {
      return { tone: 'err', text: 'It stalled: the surface gave its motors too little grip for the weight. Fit 4 DC motors or shed mass.' };
    }
    // done -- but only claim the design was tested if something actually ran.
    // A blank program "finishing" proves nothing about the build (bugs D5).
    if (run.commands === 0) {
      return { tone: 'sys', text: 'Nothing ran: the program produced no commands, so this run says nothing about the design.' };
    }
    // A finish that shaved an obstacle is not a healthy margin: report the
    // measured closest approach instead of a blanket all-clear.
    const prox = run.minProximityCm;
    if (report && report.overall === 'pass') {
      if (prox != null && prox < 30) {
        return { tone: 'sys', text: 'Mission complete, but the closest approach was ' + Math.round(prox) + ' cm - one sensor misread from a collision. Add clearance before calling this design safe.' };
      }
      const measured = (run.distanceCm != null ? ' Covered ' + (run.distanceCm / 100).toFixed(1) + ' m' : '')
        + (prox != null && prox < 600 ? ', closest approach ' + Math.round(prox) + ' cm.' : (run.distanceCm != null ? '.' : ''));
      return { tone: 'sys', text: 'Mission complete and the design held up.' + (measured || ' Margins looked healthy.') };
    }
    if (report && report.overall === 'warn') {
      return { tone: 'sys', text: 'Mission complete, but watch the flagged points: ' + (report.topFix || 'see the design check.') };
    }
    return { tone: 'sys', text: 'Mission complete.' };
  }

  window.KodroDiagnostics = { assess: assess, afterRun: afterRun, stoppingDistance: stoppingDistance, mobilityScore: mobilityScore, SENSOR_RANGE: SENSOR_RANGE };
})();
