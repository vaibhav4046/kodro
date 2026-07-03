/* ============================================================================
   KODRO - KRS v1 robot spec schema + validator (PERFECTION_PLAN SI0)

   The Kodro Robot Spec is the JSON a skeptical builder writes about their
   REAL robot (SI units, wide-but-sane ranges) and imports into the Robot
   Lab. The physical fields drive the simulation through the shared motion
   model (motion-model.js): measured top speed, energy-true battery,
   geometric turns, real sensor mount geometry.

   Validation is hand-rolled (no jsonschema dependency, mirrors the
   defensiveness of app.py _parse_build_plan): unknown keys are dropped with
   a warning, a value outside its range but within 2x of the bound is
   clamped WITH a warning, and a value beyond 2x is rejected with an error
   naming the field. All physical fields are optional: a plain catalogue
   save (v1) imports unchanged.

     window.KodroSpecSchema.validate(textOrObject) -> {ok, spec, warnings, errors}
     window.KodroSpecSchema.deriveFromPhysical(spec, catalogueDerived) -> phys block
     window.KodroSpecSchema.exportKrs(spec, derived) -> pretty JSON string
     window.KodroSpecSchema.FIDELITY -> the three-tier disclosure table (SI4)

   Plain JS, no JSX, no React. Loaded after motion-model.js.
   ========================================================================== */
(function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  var MAX_SENSORS = 16;

  var TYPES = ['rover', 'car', 'home', 'arm', 'custom'];
  var BOARDS = ['esp32', 'microbit', 'pico', 'uno', 'custom'];
  var DRIVE_KINDS = ['differential', 'ackermann', 'none'];
  var SENSOR_KINDS = ['ultrasonic', 'line', 'imu', 'camera', 'gps', 'bumper'];
  var ACTUATOR_IDS = ['motors2', 'motors4', 'servos', 'gripper'];

  // ---- numeric ranges (SI units; wide but sane). [lo, hi]; a value within
  // [lo/2, hi*2] clamps with a warning, beyond that rejects with an error.
  var RANGES = {
    'massKg': [0.05, 50],
    'bodyCm.lengthCm': [5, 200],
    'bodyCm.widthCm': [5, 200],
    'bodyCm.heightCm': [5, 200],
    'drive.wheelRadiusCm': [0.5, 20],
    'drive.wheelbaseCm': [2, 150],
    'drive.motorCount': [1, 8],
    'drive.motor.noLoadRpm': [10, 2000],
    'drive.motor.stallTorqueNm': [0.01, 5.0],
    'drive.motor.nominalV': [1.5, 48],
    'drive.maxSteerDeg': [5, 60],
    'battery.mAh': [100, 20000],
    'battery.voltage': [3, 48],
    'battery.usableFraction': [0.5, 1.0],
    'board.massG': [1, 500],
    'sensor.posCm.x': [-100, 100],
    'sensor.posCm.y': [-100, 100],
    'sensor.posCm.z': [-100, 100],
    'sensor.yawDeg': [-180, 180],
    'sensor.rangeCm': [5, 2000],
    'sensor.fovDeg': [1, 360],
    'declared.maxSpeedMps': [0.05, 10],
    'declared.runtimeMin': [1, 2000],
  };

  // ---- SI4: three-tier fidelity disclosure, one honest line per claim ------
  var FIDELITY = {
    honoured: [
      'Commanded distances and turn angles (endpoint-exact)',
      'Top speed calibrated from motor rpm and wheel radius, when it falls inside the simulable band (outside it the badge drops to APPROXIMATED and the sim speed is disclosed)',
      'Sensor mount position, yaw and range in the studio sim (z ignored, disclosed; the Python engine rays from the rover centre)',
      'Collision circle sized from the body footprint',
      'Command availability gated on fitted parts',
      'Battery as a hard budget: the robot halts at zero',
    ],
    approximated: [
      'Acceleration and braking: first-order trapezoid, not F=ma integration',
      'Turn time from mass or track geometry, not wheel torque curves',
      'Traction: three coarse bands per surface',
      'Constant-power battery drain (no voltage sag or thermal derating)',
      'Scenario validation spread from seeded randomisation',
    ],
    notSimulated: [
      'Slopes and terrain height (worlds are flat planes)',
      'Wheel-level slip and per-motor torque curves',
      'Suspension and 3D contact (body motion is cosmetic)',
      'Voltage sag, thermal limits, per-motor current transients',
      'IMU acceleration content (returns level readings)',
      'Camera, GPS, bumper, line and gripper command semantics',
    ],
  };

  // Per-stat badge tier used by the Robot Lab readout and the report annex.
  var STAT_TIER = {
    mass: 'honoured',
    topSpeed: 'honoured',
    sensorMount: 'honoured',
    collisionRadius: 'honoured',
    commands: 'honoured',
    battery: 'approximated',
    acceleration: 'approximated',
    turnTime: 'approximated',
    traction: 'approximated',
    slope: 'notSimulated',
  };

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  // Validate one number against its RANGES row. Returns the usable value or
  // null (error already recorded). Clamps with a warning inside the 2x
  // envelope; rejects with a named-field error beyond it.
  function num(field, value, warnings, errors) {
    var r = RANGES[field];
    var n = Number(value);
    if (!isFinite(n)) {
      errors.push(field + ': "' + value + '" is not a number.');
      return null;
    }
    var lo = r[0], hi = r[1];
    if (n >= lo && n <= hi) return n;
    if (n >= lo / 2 && n <= hi * 2) {
      var c = Math.min(hi, Math.max(lo, n));
      warnings.push(field + ': ' + n + ' is outside the supported range ' + lo + ' to ' + hi + '; clamped to ' + c + '.');
      return c;
    }
    errors.push(field + ': ' + n + ' is more than 2x outside the supported range ' + lo + ' to ' + hi + '. Fix the value and re-import.');
    return null;
  }

  function pickKnown(obj, known, where, warnings) {
    var out = {};
    var dropped = [];
    Object.keys(obj || {}).forEach(function (k) {
      if (known.indexOf(k) >= 0) out[k] = obj[k];
      else dropped.push(k);
    });
    if (dropped.length) warnings.push(where + ': dropped unknown field' + (dropped.length > 1 ? 's' : '') + ' ' + dropped.join(', ') + '.');
    return out;
  }

  // ---- main validator ------------------------------------------------------
  // Accepts a JSON string or an already-parsed object. Returns
  // { ok, spec, warnings, errors } where spec is the normalised INTERNAL
  // shape RobotLab persists: catalogue fields + an optional .physical block.
  function validate(textOrObject) {
    var warnings = [], errors = [];
    var raw = textOrObject;
    if (typeof raw === 'string') {
      if (raw.length > 262144) {
        return { ok: false, spec: null, warnings: [], errors: ['Spec file is larger than 256 KB.'] };
      }
      try { raw = JSON.parse(raw); }
      catch (e) { return { ok: false, spec: null, warnings: [], errors: ['Not valid JSON: ' + ((e && e.message) || e)] }; }
    }
    if (!isObj(raw)) return { ok: false, spec: null, warnings: [], errors: ['A KRS spec must be a JSON object.'] };

    var top = pickKnown(raw, ['kodroSpec', 'name', 'type', 'board', 'bodyCm', 'massKg', 'drive', 'battery', 'sensors', 'actuators', 'declared', 'derived'], 'spec', warnings);
    if (top.kodroSpec !== undefined && Number(top.kodroSpec) !== SCHEMA_VERSION) {
      warnings.push('kodroSpec: version ' + top.kodroSpec + ' read as version ' + SCHEMA_VERSION + '.');
    }
    if (top.derived !== undefined) {
      warnings.push('derived: ignored on import (it is recomputed from the spec).');
    }

    // name: 1..28 chars, trimmed.
    var name = String(top.name != null ? top.name : 'Imported robot').trim();
    if (name.length < 1) { name = 'Imported robot'; warnings.push('name: empty, defaulted to "Imported robot".'); }
    if (name.length > 28) { warnings.push('name: longer than 28 characters, truncated.'); name = name.slice(0, 28); }

    var type = String(top.type || 'custom');
    if (TYPES.indexOf(type) < 0) { warnings.push('type: "' + type + '" is not a known archetype; read as "custom".'); type = 'custom'; }

    // board: catalogue id, or an object { id: 'custom', massG } for a custom one.
    var board = 'esp32', boardMassG = null;
    if (isObj(top.board)) {
      var b = pickKnown(top.board, ['id', 'massG'], 'board', warnings);
      board = BOARDS.indexOf(String(b.id)) >= 0 ? String(b.id) : 'custom';
      if (b.massG !== undefined) boardMassG = num('board.massG', b.massG, warnings, errors);
    } else if (top.board !== undefined) {
      board = String(top.board);
      if (BOARDS.indexOf(board) < 0) { warnings.push('board: "' + board + '" is not in the catalogue; read as "custom".'); board = 'custom'; }
    }
    if (board === 'custom' && boardMassG === null) boardMassG = 10;

    // ---- physical block (ALL optional) ----
    var physical = null;
    function phys() { if (!physical) physical = {}; return physical; }

    if (top.massKg !== undefined) {
      var mk = num('massKg', top.massKg, warnings, errors);
      if (mk !== null) phys().massKg = mk;
    }
    if (top.bodyCm !== undefined) {
      if (!isObj(top.bodyCm)) errors.push('bodyCm: must be an object like {"lengthCm": 25, "widthCm": 18, "heightCm": 12}.');
      else {
        var bc = pickKnown(top.bodyCm, ['lengthCm', 'widthCm', 'heightCm'], 'bodyCm', warnings);
        var body = {};
        ['lengthCm', 'widthCm', 'heightCm'].forEach(function (k) {
          if (bc[k] !== undefined) { var v = num('bodyCm.' + k, bc[k], warnings, errors); if (v !== null) body[k] = v; }
        });
        if (body.lengthCm !== undefined && body.widthCm !== undefined) phys().bodyCm = body;
        else if (Object.keys(body).length) warnings.push('bodyCm: needs at least lengthCm and widthCm to size the collision circle; ignored.');
      }
    }
    if (top.drive !== undefined) {
      if (!isObj(top.drive)) errors.push('drive: must be an object.');
      else {
        var dr = pickKnown(top.drive, ['kind', 'wheelRadiusCm', 'wheelbaseCm', 'motorCount', 'motor', 'maxSteerDeg'], 'drive', warnings);
        var drive = {};
        drive.kind = DRIVE_KINDS.indexOf(String(dr.kind)) >= 0 ? String(dr.kind) : 'differential';
        if (dr.kind !== undefined && DRIVE_KINDS.indexOf(String(dr.kind)) < 0) {
          warnings.push('drive.kind: "' + dr.kind + '" is not differential/ackermann/none; read as "differential".');
        }
        if (dr.wheelRadiusCm !== undefined) { var wr = num('drive.wheelRadiusCm', dr.wheelRadiusCm, warnings, errors); if (wr !== null) drive.wheelRadiusCm = wr; }
        if (dr.wheelbaseCm !== undefined) { var wb = num('drive.wheelbaseCm', dr.wheelbaseCm, warnings, errors); if (wb !== null) drive.wheelbaseCm = wb; }
        if (dr.motorCount !== undefined) { var mc = num('drive.motorCount', dr.motorCount, warnings, errors); if (mc !== null) drive.motorCount = Math.round(mc); }
        if (dr.maxSteerDeg !== undefined) { var ms = num('drive.maxSteerDeg', dr.maxSteerDeg, warnings, errors); if (ms !== null) drive.maxSteerDeg = ms; }
        if (isObj(dr.motor)) {
          var mo = pickKnown(dr.motor, ['noLoadRpm', 'stallTorqueNm', 'nominalV'], 'drive.motor', warnings);
          var motor = {};
          if (mo.noLoadRpm !== undefined) { var rpm = num('drive.motor.noLoadRpm', mo.noLoadRpm, warnings, errors); if (rpm !== null) motor.noLoadRpm = rpm; }
          if (mo.stallTorqueNm !== undefined) { var st = num('drive.motor.stallTorqueNm', mo.stallTorqueNm, warnings, errors); if (st !== null) motor.stallTorqueNm = st; }
          if (mo.nominalV !== undefined) { var nv = num('drive.motor.nominalV', mo.nominalV, warnings, errors); if (nv !== null) motor.nominalV = nv; }
          if (Object.keys(motor).length) drive.motor = motor;
        } else if (dr.motor !== undefined) {
          errors.push('drive.motor: must be an object like {"noLoadRpm": 200, "stallTorqueNm": 0.35, "nominalV": 6}.');
        }
        // Cross-field checks.
        if (drive.kind === 'ackermann' && drive.maxSteerDeg === undefined) {
          warnings.push('drive: ackermann steering with no maxSteerDeg; the turn-radius report will be skipped.');
        }
        if (drive.motor && drive.wheelRadiusCm === undefined) {
          warnings.push('drive: motor specified without wheelRadiusCm, so top speed cannot be derived from it.');
        }
        phys().drive = drive;
      }
    }
    if (top.battery !== undefined) {
      if (!isObj(top.battery)) errors.push('battery: must be an object like {"mAh": 2200, "voltage": 7.4, "usableFraction": 0.8}.');
      else {
        var ba = pickKnown(top.battery, ['mAh', 'voltage', 'usableFraction'], 'battery', warnings);
        var batt = {};
        if (ba.mAh !== undefined) { var mah = num('battery.mAh', ba.mAh, warnings, errors); if (mah !== null) batt.mAh = mah; }
        if (ba.voltage !== undefined) { var vv = num('battery.voltage', ba.voltage, warnings, errors); if (vv !== null) batt.voltage = vv; }
        batt.usableFraction = 0.8;
        if (ba.usableFraction !== undefined) { var uf = num('battery.usableFraction', ba.usableFraction, warnings, errors); if (uf !== null) batt.usableFraction = uf; }
        if (batt.mAh !== undefined && batt.voltage !== undefined) phys().battery = batt;
        else if (ba.mAh !== undefined || ba.voltage !== undefined) warnings.push('battery: needs both mAh and voltage to derive runtime; ignored.');
      }
    }
    // sensors: KRS physical entries (kind + geometry). The catalogue sensor
    // ids for command gating are derived from the kinds.
    var physSensors = [];
    var catalogueSensors = [];
    if (Array.isArray(top.sensors)) {
      if (top.sensors.length > MAX_SENSORS) {
        warnings.push('sensors: more than ' + MAX_SENSORS + ' entries; extra ones dropped.');
      }
      top.sensors.slice(0, MAX_SENSORS).forEach(function (entry, i) {
        if (typeof entry === 'string') {
          // Plain catalogue id (v1 saves): no geometry.
          if (SENSOR_KINDS.indexOf(entry) >= 0) catalogueSensors.push(entry);
          else warnings.push('sensors[' + i + ']: unknown sensor "' + entry + '" dropped.');
          return;
        }
        if (!isObj(entry)) { warnings.push('sensors[' + i + ']: not an object or catalogue id; dropped.'); return; }
        var se = pickKnown(entry, ['kind', 'posCm', 'yawDeg', 'rangeCm', 'fovDeg'], 'sensors[' + i + ']', warnings);
        var kind = String(se.kind || '');
        if (SENSOR_KINDS.indexOf(kind) < 0) { warnings.push('sensors[' + i + ']: unknown kind "' + kind + '" dropped.'); return; }
        var s = { kind: kind };
        if (isObj(se.posCm)) {
          var pc = pickKnown(se.posCm, ['x', 'y', 'z'], 'sensors[' + i + '].posCm', warnings);
          s.posCm = {};
          ['x', 'y', 'z'].forEach(function (ax) {
            if (pc[ax] !== undefined) { var pv = num('sensor.posCm.' + ax, pc[ax], warnings, errors); if (pv !== null) s.posCm[ax] = pv; }
          });
          if (s.posCm.z !== undefined) warnings.push('sensors[' + i + ']: posCm.z is recorded but IGNORED by the 2D ray model (disclosed).');
        }
        if (se.yawDeg !== undefined) { var yd = num('sensor.yawDeg', se.yawDeg, warnings, errors); if (yd !== null) s.yawDeg = yd; }
        if (se.rangeCm !== undefined) { var rc = num('sensor.rangeCm', se.rangeCm, warnings, errors); if (rc !== null) s.rangeCm = rc; }
        if (se.fovDeg !== undefined) { var fd = num('sensor.fovDeg', se.fovDeg, warnings, errors); if (fd !== null) s.fovDeg = fd; }
        physSensors.push(s);
        if (catalogueSensors.indexOf(kind) < 0) catalogueSensors.push(kind);
      });
    } else if (top.sensors !== undefined) {
      errors.push('sensors: must be an array of sensor objects or catalogue ids.');
    }
    if (physSensors.length) phys().sensors = physSensors;

    var actuators = [];
    if (Array.isArray(top.actuators)) {
      top.actuators.forEach(function (a, i) {
        if (ACTUATOR_IDS.indexOf(String(a)) >= 0) actuators.push(String(a));
        else warnings.push('actuators[' + i + ']: unknown actuator "' + a + '" dropped.');
      });
    } else if (top.actuators !== undefined) {
      errors.push('actuators: must be an array of catalogue actuator ids.');
    }
    // A physical drive implies drive actuators for command gating.
    if (physical && physical.drive && physical.drive.kind !== 'none' && actuators.length === 0) {
      actuators.push(physical.drive.kind === 'ackermann' ? 'servos' : 'motors2');
      warnings.push('actuators: none listed; drive.kind "' + physical.drive.kind + '" implies a drive set for command gating.');
    }

    if (top.declared !== undefined) {
      if (!isObj(top.declared)) errors.push('declared: must be an object like {"maxSpeedMps": 1.2, "runtimeMin": 90}.');
      else {
        var de = pickKnown(top.declared, ['maxSpeedMps', 'runtimeMin'], 'declared', warnings);
        var decl = {};
        if (de.maxSpeedMps !== undefined) { var dm = num('declared.maxSpeedMps', de.maxSpeedMps, warnings, errors); if (dm !== null) decl.maxSpeedMps = dm; }
        if (de.runtimeMin !== undefined) { var dn = num('declared.runtimeMin', de.runtimeMin, warnings, errors); if (dn !== null) decl.runtimeMin = dn; }
        if (Object.keys(decl).length) phys().declared = decl;
      }
    }

    if (errors.length) return { ok: false, spec: null, warnings: warnings, errors: errors };

    var spec = {
      kodroSpec: SCHEMA_VERSION,
      type: type,
      name: name,
      board: board,
      sensors: catalogueSensors,
      actuators: actuators,
    };
    if (boardMassG !== null && board === 'custom') spec.boardMassG = boardMassG;
    if (physical) spec.physical = physical;
    return { ok: true, spec: spec, warnings: warnings, errors: [] };
  }

  // ---- SI2: derive the sim numbers from the physical block -----------------
  // Returns the `phys` block getKodroRobot() carries, or null when the spec
  // has no physical fields (catalogue mode stays byte-identical). `cat` is
  // the catalogue-derived numbers used as fallbacks for missing fields.
  function deriveFromPhysical(spec, cat) {
    var p = spec && spec.physical;
    if (!p) return null;
    var KM = window.KodroMotion;
    var M = KM.MODEL;
    var out = { badges: {}, warnings: [] };

    var massKg = p.massKg !== undefined ? p.massKg : (cat && cat.mass ? cat.mass / 1000 : 0.9);
    out.massKg = massKg;
    out.massFactor = KM.physMassFactor(massKg);

    // Collision circle from the body footprint (HONOURED, circle disclosed).
    if (p.bodyCm && p.bodyCm.lengthCm !== undefined && p.bodyCm.widthCm !== undefined) {
      out.collisionRadiusCm = Math.round(Math.hypot(p.bodyCm.lengthCm, p.bodyCm.widthCm) / 2 * 10) / 10;
      out.badges.collisionRadius = 'honoured';
    }

    // Top speed chain (E-A1, HONOURED when rpm + wheel radius are given).
    var drive = p.drive || {};
    var motor = drive.motor || {};
    if (motor.noLoadRpm !== undefined && drive.wheelRadiusCm !== undefined) {
      out.vMaxCmPerS = KM.physTopSpeedCmPerS(motor.noLoadRpm, drive.wheelRadiusCm);
      out.speedFactor = KM.physSpeedFactor(out.vMaxCmPerS);
      var capped = KM.MODEL.baseSpeedCmPerS * out.speedFactor;
      // The sim can only run inside the speedFactor band [Lo, Hi]. A build
      // whose real top speed falls outside that band is simulated at a
      // DIFFERENT speed than it actually reaches: clamped DOWN when it is
      // above the ceiling, clamped UP (so it runs FASTER than real) when it
      // is below the floor. Never badge such a value 'honoured' - the sim is
      // not honouring the measured number - and the warning must name the
      // real direction (below/above, faster/slower), not always "exceeds".
      if (Math.abs(capped - out.vMaxCmPerS) > 0.5) {
        out.vMaxSimCmPerS = capped;
        var realMps = (out.vMaxCmPerS / 100).toFixed(2);
        var simMps = (capped / 100).toFixed(2);
        if (capped > out.vMaxCmPerS) {
          out.warnings.push('Top speed ' + realMps + ' m/s is below the simulable floor; simulated FASTER at ' + simMps + ' m/s.');
        } else {
          out.warnings.push('Top speed ' + realMps + ' m/s is above the simulable ceiling; simulated SLOWER at ' + simMps + ' m/s.');
        }
        out.badges.topSpeed = 'approximated';
      } else {
        out.vMaxSimCmPerS = out.vMaxCmPerS;
        out.badges.topSpeed = 'honoured';
      }
    }
    // Tractive force, mobility, acceleration, slope (E-A1/E-A5).
    if (motor.stallTorqueNm !== undefined && drive.wheelRadiusCm !== undefined) {
      var n = drive.motorCount !== undefined ? drive.motorCount : 2;
      out.motorCount = n;
      out.wheelRadiusCm = drive.wheelRadiusCm;
      out.stallForceN = KM.physStallForceN(motor.stallTorqueNm, n, drive.wheelRadiusCm);
      out.accelCmPerS2 = KM.physAccelCmPerS2(out.stallForceN, massKg, M.gravityEarthMps2);
      out.maxSlopeDeg = Math.round(KM.physMaxSlopeDeg(out.stallForceN, massKg, M.gravityEarthMps2) * 10) / 10;
      out.badges.acceleration = 'approximated';
      out.badges.slope = 'notSimulated';
    }
    // Energy-true battery (E-A2).
    if (p.battery) {
      out.energyWh = KM.physEnergyWh(p.battery.mAh, p.battery.voltage, p.battery.usableFraction);
      var vNom = out.vMaxSimCmPerS || (cat && cat.speedFactor ? M.baseSpeedCmPerS * cat.speedFactor : M.baseSpeedCmPerS);
      out.drainPctPerCmNominal = KM.physDrainPctPerCm(massKg, out.energyWh, vNom, M.gravityEarthMps2, 1);
      out.runtimeMin = Math.round(KM.physRuntimeMin(massKg, out.energyWh, vNom, M.gravityEarthMps2, 1));
      out.badges.battery = 'approximated';
    }
    // Turn geometry (E-A4) and ackermann turn radius (report-only in v1).
    if (drive.wheelbaseCm !== undefined) {
      out.trackCm = drive.wheelbaseCm;
      out.badges.turnTime = 'approximated';
      if (drive.kind === 'ackermann' && drive.maxSteerDeg !== undefined) {
        out.turnRadiusCm = Math.round(KM.physTurnRadiusCm(drive.wheelbaseCm, drive.maxSteerDeg));
        out.warnings.push('Ackermann minimum turn radius ' + (out.turnRadiusCm / 100).toFixed(2) + ' m is REPORT-ONLY in v1: the sim still turns in place or on its fixed display arc.');
      }
    }
    // Sensor mount geometry (HONOURED; first ultrasonic drives the ray).
    var us = (p.sensors || []).filter(function (s) { return s.kind === 'ultrasonic'; })[0];
    if (us) {
      out.sensor = {
        fwdCm: (us.posCm && us.posCm.x) || 0,
        leftCm: (us.posCm && us.posCm.y) || 0,
        yawDeg: us.yawDeg || 0,
        rangeCm: us.rangeCm !== undefined ? us.rangeCm : M.sensorRangeCm,
      };
      out.badges.sensorMount = 'honoured';
    }
    // Declared cross-check: over 20 percent discrepancy is flagged (SI2).
    var decl = p.declared || {};
    if (decl.maxSpeedMps !== undefined && out.vMaxCmPerS !== undefined) {
      var relV = Math.abs(decl.maxSpeedMps * 100 - out.vMaxCmPerS) / Math.max(1, out.vMaxCmPerS);
      if (relV > 0.2) {
        out.warnings.push('Declared top speed ' + decl.maxSpeedMps + ' m/s disagrees with the motor-derived ' + (out.vMaxCmPerS / 100).toFixed(2) + ' m/s by ' + Math.round(relV * 100) + ' percent. The derived value is simulated.');
      }
    }
    if (decl.runtimeMin !== undefined && out.runtimeMin !== undefined) {
      var relR = Math.abs(decl.runtimeMin - out.runtimeMin) / Math.max(1, out.runtimeMin);
      if (relR > 0.2) {
        out.warnings.push('Declared runtime ' + decl.runtimeMin + ' min disagrees with the battery-derived ' + out.runtimeMin + ' min by ' + Math.round(relR * 100) + ' percent. The derived value is simulated.');
      }
    }
    return out;
  }

  // ---- export: the validated spec plus the derived block (SI1) -------------
  function exportKrs(spec, derived) {
    var out = {
      kodroSpec: SCHEMA_VERSION,
      name: spec.name,
      type: spec.type,
      board: spec.board,
      sensors: (spec.physical && spec.physical.sensors) ? spec.physical.sensors : (spec.sensors || []),
      actuators: spec.actuators || [],
    };
    ['massKg', 'bodyCm', 'drive', 'battery', 'declared'].forEach(function (k) {
      if (spec.physical && spec.physical[k] !== undefined) out[k] = spec.physical[k];
    });
    out.derived = {
      note: 'Computed by Kodro from the fields above; ignored on re-import.',
      massG: derived && derived.mass,
      massFactor: derived && derived.massFactor,
      speedFactor: derived && derived.speedFactor,
      runtimeMin: derived && derived.runtimeMin,
    };
    if (derived && derived.phys) {
      var ph = derived.phys;
      out.derived.topSpeedMps = ph.vMaxCmPerS !== undefined ? Math.round(ph.vMaxCmPerS) / 100 : undefined;
      out.derived.collisionRadiusCm = ph.collisionRadiusCm;
      out.derived.stallForceN = ph.stallForceN !== undefined ? Math.round(ph.stallForceN * 100) / 100 : undefined;
      out.derived.energyWh = ph.energyWh !== undefined ? Math.round(ph.energyWh * 100) / 100 : undefined;
      out.derived.maxSlopeDeg = ph.maxSlopeDeg;
      out.derived.turnRadiusCm = ph.turnRadiusCm;
    }
    return JSON.stringify(out, null, 2);
  }

  window.KodroSpecSchema = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    RANGES: RANGES,
    FIDELITY: FIDELITY,
    STAT_TIER: STAT_TIER,
    SENSOR_KINDS: SENSOR_KINDS,
    validate: validate,
    deriveFromPhysical: deriveFromPhysical,
    exportKrs: exportKrs,
  };
})();
