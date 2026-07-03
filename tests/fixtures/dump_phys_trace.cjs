// Dump the JS motion model's phys* closed-form outputs for a fixed set of
// reference-rover inputs, so tests/unit/test_physical_golden_trace.py can prove
// the Python twin (motion_model.py phys_* functions) computes identical values.
// The FORMULAS are parity-locked here, not just the constant table (E-C4).
// Usage: node dump_phys_trace.cjs <motion-model.js path>
'use strict';
const fs = require('fs');
global.window = {};
eval(fs.readFileSync(process.argv[2], 'utf8'));
const KM = global.window.KodroMotion;

// Shipped Reference Rover (tests/fixtures/krs_reference_rover.json) inputs.
const rpm = 300, wheelR = 3.25, torque = 0.35, motors = 2, massKg = 1.2;
const track = 14, steer = 30, mAh = 2200, volt = 7.4, usable = 0.8;
const g = 9.81, traction = 1;

// A deliberately slow build at the H1 floor boundary (60 rpm / 3 cm wheel).
const slowRpm = 60, slowWheelR = 3.0;

const vMax = KM.physTopSpeedCmPerS(rpm, wheelR);
const stallF = KM.physStallForceN(torque, motors, wheelR);
const energyWh = KM.physEnergyWh(mAh, volt, usable);
const sv = KM.physStallVerdict(stallF, massKg, traction, g, motors, wheelR);
const pose = KM.sensorPose(0, 0, 0, 10, 0, 0);

process.stdout.write(JSON.stringify({
  vMaxCmPerS: vMax,
  speedFactor: KM.physSpeedFactor(vMax),
  massFactor: KM.physMassFactor(massKg),
  stallForceN: stallF,
  mobility: KM.physMobility(stallF, massKg, traction, g),
  accelCmPerS2: KM.physAccelCmPerS2(stallF, massKg, g),
  energyWh: energyWh,
  drainPctPerCm: KM.physDrainPctPerCm(massKg, energyWh, vMax, g, traction),
  runtimeMin: KM.physRuntimeMin(massKg, energyWh, vMax, g, traction),
  turnMs90: KM.physTurnDurationMs(90, vMax, track, 1),
  turnRadiusCm: KM.physTurnRadiusCm(track, steer),
  stoppingCm: KM.physStoppingDistanceCm(vMax, traction, g),
  maxSlopeDeg: KM.physMaxSlopeDeg(stallF, massKg, g, traction),
  stallMobility: sv.mobility,
  stallNeededNm: sv.neededNm,
  stallHasNm: sv.hasNm,
  sensorPoseX: pose.x,
  sensorPoseY: pose.y,
  sensorPoseHeading: pose.heading,
  // H1 floor boundary: a slow build clamps UP, so its sim speed factor floors.
  slowVMaxCmPerS: KM.physTopSpeedCmPerS(slowRpm, slowWheelR),
  slowSpeedFactor: KM.physSpeedFactor(KM.physTopSpeedCmPerS(slowRpm, slowWheelR))
}));
