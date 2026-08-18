/* Curated OFFLINE parts database, bound to the KRS spec.
 *
 * A small, honest catalogue of REAL hobby parts so a learner can drop a
 * measured motor or battery into a build instead of guessing numbers, and so
 * the derived top speed / runtime / slope come from datasheet figures rather
 * than catalogue proxies. Every motor row carries its source URL and the date
 * the figure was read; the stall torque is stored in the manufacturer's unit
 * (kg-cm) and converted to the KRS N-m field through one transparent constant,
 * so the cited number is preserved and the maths is auditable.
 *
 * Provenance rules (no fabrication):
 *   - Motor rpm / stall torque are Pololu's published 6 V figures (their stall
 *     numbers are theoretical extrapolations, noted per row).
 *   - Battery CELL voltages are universal nominal constants (LiPo/Li-ion 3.7 V,
 *     NiMH 1.2 V); pack capacities are representative "typical hobby pack"
 *     nominals, labelled as such, NOT a specific SKU's datasheet.
 *   - usableFraction values are stated engineering conventions (headroom kept
 *     to protect pack health), labelled, not measured per cell.
 *
 * The database is a static file: it makes no network request at runtime and is
 * fully usable offline, exactly like the rest of Kodro.
 *
 *   window.KodroParts.motors / .batteries          -> catalogue rows
 *   window.KodroParts.toKrsMotor(id)               -> { noLoadRpm, stallTorqueNm }
 *   window.KodroParts.toKrsBattery(id)             -> { mAh, voltage, usableFraction }
 */
(function () {
  'use strict';

  // 1 kilogram-force centimetre = 0.0980665 newton metre (exact, g0/100).
  var KGCM_TO_NM = 0.0980665;
  function nm(kgcm) { return Math.round(kgcm * KGCM_TO_NM * 1e4) / 1e4; }

  // Pololu micro metal gearmotors ("N20"), 6 V. rpm + stall torque (kg-cm) read
  // from Pololu's product pages on 2026-07-12; stall torque is Pololu's stated
  // theoretical extrapolation. Gearbox output shaft 3 mm D.
  var POLOLU = 'https://www.pololu.com/product/';
  var ACCESSED = '2026-07-12';
  var motors = [
    { id: 'n20-30-1-hp-6v', name: 'N20 30:1 HP (6V)', family: 'Pololu micro metal gearmotor',
      voltage: 6, noLoadRpm: 1000, stallTorqueKgCm: 0.57, torqueEstimated: true,
      source: POLOLU + '1093', accessed: ACCESSED },
    { id: 'n20-100-1-hp-6v', name: 'N20 100:1 HP (6V)', family: 'Pololu micro metal gearmotor',
      voltage: 6, noLoadRpm: 310, stallTorqueKgCm: 1.7, torqueEstimated: true,
      source: POLOLU + '1101', accessed: ACCESSED },
    { id: 'n20-298-1-hp-6v', name: 'N20 298:1 HP (6V)', family: 'Pololu micro metal gearmotor',
      voltage: 6, noLoadRpm: 100, stallTorqueKgCm: 4.0, torqueEstimated: true,
      source: POLOLU + '994', accessed: ACCESSED },
    { id: 'n20-30-1-lp-6v', name: 'N20 30:1 LP (6V)', family: 'Pololu micro metal gearmotor',
      voltage: 6, noLoadRpm: 450, stallTorqueKgCm: 0.29, torqueEstimated: true,
      source: POLOLU + '993', accessed: ACCESSED },
  ];
  motors.forEach(function (m) { m.stallTorqueNm = nm(m.stallTorqueKgCm); });

  // Batteries. Cell voltages are universal nominals; capacities are typical
  // hobby-pack nominals (labelled), NOT a specific product datasheet.
  var batteries = [
    { id: 'lipo-1s-1000', name: 'LiPo 1S 1000 mAh', chemistry: 'LiPo', cellV: 3.7, cells: 1,
      voltage: 3.7, mAh: 1000, usableFraction: 0.8, capacityNominal: true,
      note: '3.7 V/cell nominal; 20% headroom kept for pack health' },
    { id: 'lipo-2s-2200', name: 'LiPo 2S 2200 mAh', chemistry: 'LiPo', cellV: 3.7, cells: 2,
      voltage: 7.4, mAh: 2200, usableFraction: 0.8, capacityNominal: true,
      note: '3.7 V/cell nominal; 20% headroom kept for pack health' },
    { id: 'lipo-3s-2200', name: 'LiPo 3S 2200 mAh', chemistry: 'LiPo', cellV: 3.7, cells: 3,
      voltage: 11.1, mAh: 2200, usableFraction: 0.8, capacityNominal: true,
      note: '3.7 V/cell nominal; 20% headroom kept for pack health' },
    { id: 'nimh-6cell-2000', name: 'NiMH 6-cell 2000 mAh', chemistry: 'NiMH', cellV: 1.2, cells: 6,
      voltage: 7.2, mAh: 2000, usableFraction: 0.9, capacityNominal: true,
      note: '1.2 V/cell nominal; NiMH tolerates deeper discharge' },
    { id: 'liion-2x18650-2500', name: 'Li-ion 2x 18650 2500 mAh', chemistry: 'Li-ion', cellV: 3.7, cells: 2,
      voltage: 7.4, mAh: 2500, usableFraction: 0.85, capacityNominal: true,
      note: '3.7 V/cell nominal; representative 18650 capacity' },
  ];

  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  // Bind a catalogue row onto the KRS physical fields the schema validates.
  function toKrsMotor(id) {
    var m = byId(motors, id);
    if (!m) return null;
    return { noLoadRpm: m.noLoadRpm, stallTorqueNm: m.stallTorqueNm };
  }
  function toKrsBattery(id) {
    var b = byId(batteries, id);
    if (!b) return null;
    return { mAh: b.mAh, voltage: b.voltage, usableFraction: b.usableFraction, chemistry: b.chemistry };
  }

  window.KodroParts = {
    motors: motors,
    batteries: batteries,
    KGCM_TO_NM: KGCM_TO_NM,
    toKrsMotor: toKrsMotor,
    toKrsBattery: toKrsBattery,
  };
})();
