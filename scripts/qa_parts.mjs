/* Curated parts database QA (window.KodroParts).
 *
 * Honesty + correctness of the offline parts catalogue: every motor carries a
 * source URL and access date, the kg-cm -> N-m conversion is exact, and every
 * derived KRS field lands inside the schema's validated range so a part can be
 * dropped straight onto a build.
 *
 *   node scripts/qa_parts.mjs      # exits non-zero on any failed assertion
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dir = new URL('../src/kodro/assets/web/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('parts-db.js', dir), 'utf8'), ctx);
const P = ctx.window.KodroParts;

// KRS schema ranges (mirrored from specschema.js RANGES) that a part must fit.
const RANGE = {
  noLoadRpm: [10, 2000],
  stallTorqueNm: [0.01, 5.0],
  mAh: [100, 20000],
  voltage: [3, 48],
  usableFraction: [0.5, 1.0],
};
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass += 1; else { fail += 1; console.error('FAIL  ' + m); } };
const inRange = (v, r) => v >= r[0] && v <= r[1];

ok(P && P.motors.length >= 3, 'catalogue ships motors');
ok(P && P.batteries.length >= 3, 'catalogue ships batteries');

// Every motor: cited, and its converted KRS fields are in range.
for (const m of P.motors) {
  ok(/^https?:\/\//.test(m.source) && /\d{4}-\d{2}-\d{2}/.test(m.accessed), `motor ${m.id} carries a source URL + access date`);
  // Conversion is exact: stored kg-cm times the exact constant equals the N-m field.
  const expected = Math.round(m.stallTorqueKgCm * P.KGCM_TO_NM * 1e4) / 1e4;
  ok(m.stallTorqueNm === expected, `motor ${m.id} kg-cm->N-m conversion is exact (${m.stallTorqueNm} == ${expected})`);
  const k = P.toKrsMotor(m.id);
  ok(k && inRange(k.noLoadRpm, RANGE.noLoadRpm), `motor ${m.id} noLoadRpm in KRS range`);
  ok(k && inRange(k.stallTorqueNm, RANGE.stallTorqueNm), `motor ${m.id} stallTorqueNm in KRS range`);
}

// Every battery: cell voltage consistent with pack voltage, KRS fields in range.
for (const b of P.batteries) {
  ok(Math.abs(b.cellV * b.cells - b.voltage) < 1e-6, `battery ${b.id} pack voltage = cellV x cells`);
  const k = P.toKrsBattery(b.id);
  ok(k && inRange(k.voltage, RANGE.voltage), `battery ${b.id} voltage in KRS range`);
  ok(k && inRange(k.mAh, RANGE.mAh), `battery ${b.id} mAh in KRS range`);
  ok(k && inRange(k.usableFraction, RANGE.usableFraction), `battery ${b.id} usableFraction in KRS range`);
}

// A specific spot-check against the cited figure (Pololu 30:1 HP: 0.57 kg-cm).
const hp30 = P.toKrsMotor('n20-30-1-hp-6v');
ok(hp30 && Math.abs(hp30.stallTorqueNm - 0.0559) < 1e-3, '30:1 HP stall torque ~0.0559 N-m (0.57 kg-cm)');

// Unknown id returns null, never a fabricated part.
ok(P.toKrsMotor('does-not-exist') === null && P.toKrsBattery('nope') === null, 'unknown id returns null');

console.log((fail ? 'FAIL' : 'PASS') + '  parts database: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
