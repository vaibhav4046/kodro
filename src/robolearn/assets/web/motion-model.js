/* ============================================================================
   KODRO - shared motion model (PERFECTION_PLAN E-P1)

   THE single source of truth for the physics constants and the pure motion
   formulas the whole product uses. Before this module existed, four
   hand-rolled replicas simulated the same robot (app.jsx, engine/rover.py,
   scenario.jsx, selftest.jsx) and they disagreed: battery costs differed
   roughly 11x per metre between the JS tick and the Python engine. Now:

     - app.jsx animateMove/animateTurn call these functions on the hot path,
     - scenario.jsx and selftest.jsx read the same constants and drains,
     - engine/motion_model.py mirrors MODEL and the formulas exactly, and
       tests/unit/test_motion_model_conformance.py (E-C4) fails the build if
       the two constant tables ever drift (hash of the canonical JSON), while
       tests/unit/test_golden_traces.py (E-P2) fails it if the ENGINES drift.

   Catalogue mode (a Robot Lab parts build) uses the cat* path and is
   byte-identical to the pre-refactor behaviour. Physical mode (an imported
   KRS spec with real motor/battery numbers, P4/SI2) uses the phys* functions:
   closed-form top speed (E-A1), energy-true battery (E-A2), geometric turns
   (E-A4) and stall verdicts (E-A5).

   Plain JS, no JSX, no React. Exposes window.KodroMotion.
   ========================================================================== */
(function () {
  'use strict';

  // ---- constants (mirrored by engine/motion_model.py; keep FLAT so the
  // canonical JSON is trivially comparable across languages) ----------------
  var MODEL = {
    modelId: 'kodro-motion-v1',
    // arena + body
    arenaHalfExtentCm: 1500,
    roverRadiusCm: 30,
    // calibration anchor: at set_speed(100), speedFactor 1, traction 1 the
    // ground speed is 3.125 m/s (derived from the 0.32 ms-per-cm tick).
    baseSpeedCmPerS: 312.5,
    msPerCm: 0.32,
    minSpeedUnits: 8,
    // catalogue battery model (constant-power ledger, APPROXIMATED)
    drainPctPerCm: 0.011,
    drainPctPerDeg: 0.004,
    drainPctPerCollision: 1,
    // catalogue turn timing
    turnMsPer180Deg: 650,
    turnMassBase: 0.78,
    turnMassSlope: 0.5,
    turnMassCap: 1.5,
    // catalogue derivation bounds (RobotLab.derive)
    massBaselineG: 900,
    catMassFactorLo: 0.6,
    catMassFactorHi: 1.8,
    catSpeedFactorLo: 0.7,
    catSpeedFactorHi: 1.45,
    // mobility bands (shared by catalogue and physical modes)
    mobilityStallBand: 0.45,
    mobilityWarnBand: 0.75,
    mobilityStallMul: 0.35,
    mobilityWarnMul: 0.7,
    mobilityNoDriveMul: 0.22,
    // environment
    gravityEarthMps2: 9.81,
    sensorRangeCm: 600,
    obstacleAheadCm: 50,
    // physical (KRS) model constants: E-A1/E-A2 closed forms.
    // rollingResistance is the EFFECTIVE rolling + gearbox drag coefficient
    // for small geared wheels (far above the tyre-only ~0.015), calibrated so
    // a typical 2S/2200mAh hobby rover lands in its datasheet runtime band.
    rollingResistance: 0.12,
    drivetrainEfficiency: 0.55,
    idleDrawW: 1.5,
    brakeMu: 0.7,
    physMassFactorLo: 0.4,
    physMassFactorHi: 2.5,
    physSpeedFactorLo: 0.3,
    physSpeedFactorHi: 2
  };

  // Canonical JSON of the constant table: keys sorted, no whitespace. The
  // Python twin emits the identical string; E-C4 hashes both and fails CI on
  // any drift, so a constant can never again change on one side only.
  function canonicalJson() {
    var keys = Object.keys(MODEL).sort();
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
      parts.push(JSON.stringify(keys[i]) + ':' + JSON.stringify(MODEL[keys[i]]));
    }
    return '{' + parts.join(',') + '}';
  }

  // ---- catalogue-mode formulas (byte-identical to the pre-E-P1 inlines) ----
  function gravityFactor(gravityMps2) {
    return 0.5 + 0.5 * ((gravityMps2 || MODEL.gravityEarthMps2) / MODEL.gravityEarthMps2);
  }
  // Drive-to-weight headroom on a surface (diagnostics + the live tick agree).
  function mobilityScore(speedFactor, massFactor, traction) {
    return (speedFactor * traction) / massFactor;
  }
  function mobilityMultiplier(hasDrive, mob) {
    return !hasDrive ? MODEL.mobilityNoDriveMul
      : mob < MODEL.mobilityStallBand ? MODEL.mobilityStallMul
        : mob < MODEL.mobilityWarnBand ? MODEL.mobilityWarnMul : 1;
  }
  function effectiveSpeedUnits(speed, speedFactor, mobMul) {
    return Math.max(MODEL.minSpeedUnits, speed) * speedFactor * mobMul;
  }
  function moveDurationMs(distanceCm, speedUnits, traction, speedMul) {
    return (distanceCm / speedUnits) * 1000 * MODEL.msPerCm / (traction * (speedMul || 1));
  }
  function moveDrainPct(distanceCm, gravityMps2, massFactor, traction) {
    return distanceCm * MODEL.drainPctPerCm * gravityFactor(gravityMps2) * massFactor / traction;
  }
  function turnDurationMs(deg, massFactor, speedMul) {
    return (Math.abs(deg) / 180) * MODEL.turnMsPer180Deg
      * (MODEL.turnMassBase + MODEL.turnMassSlope * Math.min(MODEL.turnMassCap, massFactor))
      / (speedMul || 1);
  }
  function turnDrainPct(deg) {
    return Math.abs(deg) * MODEL.drainPctPerDeg;
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // ---- physical-mode closed forms (E-A1/E-A2/E-A4; consumed by SI2) --------
  // Free (no-load) top speed from the motor and wheel: v = rpm/60 * 2*pi*r.
  function physTopSpeedCmPerS(noLoadRpm, wheelRadiusCm) {
    return (noLoadRpm / 60) * 2 * Math.PI * wheelRadiusCm;
  }
  function physSpeedFactor(vCmPerS) {
    return clamp(vCmPerS / MODEL.baseSpeedCmPerS, MODEL.physSpeedFactorLo, MODEL.physSpeedFactorHi);
  }
  function physMassFactor(massKg) {
    return clamp((massKg * 1000) / MODEL.massBaselineG, MODEL.physMassFactorLo, MODEL.physMassFactorHi);
  }
  // Tractive force at stall: F = n * tau / r (gear ratio 1 in v1).
  function physStallForceN(stallTorqueNm, motorCount, wheelRadiusCm) {
    return (motorCount * stallTorqueNm) / (wheelRadiusCm / 100);
  }
  // Force-ratio mobility fed into the SAME three bands the catalogue uses:
  // drive force times grip over weight. Below the stall band the physical
  // build HALTS with a torque verdict (E-A5) instead of the catalogue crawl.
  function physMobility(stallForceN, massKg, traction, gravityMps2) {
    return (stallForceN * traction) / (massKg * (gravityMps2 || MODEL.gravityEarthMps2));
  }
  // First-order acceleration: a = (F_stall - Crr*m*g)/m, floored so a
  // barely-mobile build still ramps rather than dividing the trapezoid by 0.
  function physAccelCmPerS2(stallForceN, massKg, gravityMps2) {
    var g = gravityMps2 || MODEL.gravityEarthMps2;
    var a = (stallForceN - MODEL.rollingResistance * massKg * g) / massKg;
    return Math.max(1, a * 100);
  }
  function physEnergyWh(mAh, voltage, usableFraction) {
    return (mAh / 1000) * voltage * usableFraction;
  }
  // Energy-true battery (E-A2): P = F_drive*v/eta + P_idle, so the percent
  // drained per cm depends on the speed actually driven. F_drive is the
  // steady-state rolling load, worsened on low-traction ground.
  function physDrainPctPerCm(massKg, energyWh, vCmPerS, gravityMps2, traction) {
    var g = gravityMps2 || MODEL.gravityEarthMps2;
    var vMps = Math.max(0.01, vCmPerS / 100);
    var fDrive = MODEL.rollingResistance * massKg * g / (traction || 1);
    var watts = (fDrive * vMps) / MODEL.drivetrainEfficiency + MODEL.idleDrawW;
    var joulesPerCm = watts * (0.01 / vMps);
    return 100 * joulesPerCm / (3600 * energyWh);
  }
  // Runtime at cruise: minutes until the usable energy is gone at speed v.
  function physRuntimeMin(massKg, energyWh, vCmPerS, gravityMps2, traction) {
    var g = gravityMps2 || MODEL.gravityEarthMps2;
    var vMps = Math.max(0.01, vCmPerS / 100);
    var fDrive = MODEL.rollingResistance * massKg * g / (traction || 1);
    var watts = (fDrive * vMps) / MODEL.drivetrainEfficiency + MODEL.idleDrawW;
    return (energyWh * 3600) / watts / 60;
  }
  // Geometric differential-drive turn (E-A4): omega = 2*v_wheel/track.
  function physTurnDurationMs(deg, vCmPerS, trackCm, speedMul) {
    var omega = (2 * vCmPerS) / Math.max(1, trackCm); // rad/s
    return (Math.abs(deg) * Math.PI / 180) / Math.max(0.01, omega) * 1000 / (speedMul || 1);
  }
  // Ackermann minimum turn radius (report-only in v1): R = wheelbase/tan(steer).
  function physTurnRadiusCm(wheelbaseCm, maxSteerDeg) {
    var t = Math.tan(maxSteerDeg * Math.PI / 180);
    return t > 1e-6 ? wheelbaseCm / t : Infinity;
  }
  // Braking distance from speed v: d = v^2 / (2*mu*g)  (SI3 verification).
  function physStoppingDistanceCm(vCmPerS, traction, gravityMps2) {
    var g = gravityMps2 || MODEL.gravityEarthMps2;
    var vMps = vCmPerS / 100;
    var mu = MODEL.brakeMu * (traction || 1);
    return (vMps * vMps) / (2 * mu * g) * 100;
  }
  // Max climbable slope (reported-only badge): the lesser of the force limit
  // sin(theta) = (F - Crr*m*g)/(m*g) and the wheel-grip limit tan(theta) = mu
  // (torque numbers alone imply absurd grades; grip is the real ceiling).
  function physMaxSlopeDeg(stallForceN, massKg, gravityMps2, traction) {
    var g = gravityMps2 || MODEL.gravityEarthMps2;
    var s = (stallForceN - MODEL.rollingResistance * massKg * g) / (massKg * g);
    var forceDeg = Math.asin(clamp(s, 0, 1)) * 180 / Math.PI;
    var gripDeg = Math.atan(MODEL.brakeMu * (traction || 1)) * 180 / Math.PI;
    return Math.min(forceDeg, gripDeg);
  }
  // Stall verdict inputs (E-A5): the torque this terrain needs vs what the
  // build has, so the refusal can say "needs X N*m, has Y N*m".
  function physStallVerdict(stallForceN, massKg, traction, gravityMps2, motorCount, wheelRadiusCm) {
    var g = gravityMps2 || MODEL.gravityEarthMps2;
    var mob = physMobility(stallForceN, massKg, traction, g);
    var neededForceN = (MODEL.mobilityStallBand * massKg * g) / (traction || 1);
    var neededNm = neededForceN * (wheelRadiusCm / 100) / Math.max(1, motorCount);
    var hasNm = stallForceN * (wheelRadiusCm / 100) / Math.max(1, motorCount);
    return { stalled: mob < MODEL.mobilityStallBand, mobility: mob, neededNm: neededNm, hasNm: hasNm };
  }
  // Sensor mount pose (SI2, HONOURED): the ray origin offset by the sensor's
  // forward/left position and its yaw, in the sim's compass frame (heading 0
  // is up/-y, clockwise positive). z is ignored and disclosed.
  function sensorPose(x, y, headingDeg, fwdCm, leftCm, yawDeg) {
    var a = headingDeg * Math.PI / 180;
    var fx = Math.sin(a), fy = -Math.cos(a);      // forward
    var lx = -Math.cos(a), ly = -Math.sin(a);     // left
    return {
      x: x + fwdCm * fx + leftCm * lx,
      y: y + fwdCm * fy + leftCm * ly,
      heading: headingDeg + (yawDeg || 0)
    };
  }

  window.KodroMotion = {
    MODEL: MODEL,
    canonicalJson: canonicalJson,
    gravityFactor: gravityFactor,
    mobilityScore: mobilityScore,
    mobilityMultiplier: mobilityMultiplier,
    effectiveSpeedUnits: effectiveSpeedUnits,
    moveDurationMs: moveDurationMs,
    moveDrainPct: moveDrainPct,
    turnDurationMs: turnDurationMs,
    turnDrainPct: turnDrainPct,
    physTopSpeedCmPerS: physTopSpeedCmPerS,
    physSpeedFactor: physSpeedFactor,
    physMassFactor: physMassFactor,
    physStallForceN: physStallForceN,
    physMobility: physMobility,
    physAccelCmPerS2: physAccelCmPerS2,
    physEnergyWh: physEnergyWh,
    physDrainPctPerCm: physDrainPctPerCm,
    physRuntimeMin: physRuntimeMin,
    physTurnDurationMs: physTurnDurationMs,
    physTurnRadiusCm: physTurnRadiusCm,
    physStoppingDistanceCm: physStoppingDistanceCm,
    physMaxSlopeDeg: physMaxSlopeDeg,
    physStallVerdict: physStallVerdict,
    sensorPose: sensorPose
  };
})();
