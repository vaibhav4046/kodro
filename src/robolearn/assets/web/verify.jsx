/*
 * Per-robot verification report: "your robot as simulated" (PERFECTION_PLAN SI3).
 *
 * Pure functions that turn the active build (spec + derived numbers) into a
 * closed-form prediction sheet, join it with the MEASURED evidence the app
 * already collects (the last live run's odometer/wall-clock, the last
 * multi-seed validation report), and render both as a standalone HTML file a
 * skeptical builder can keep. Nothing here computes new simulation state;
 * every number is either a motion-model closed form or a recorded result,
 * and every claim carries its SI4 fidelity tier.
 *
 *   window.KodroVerify.report(robot, terrain) -> { rows, empirical, design, fidelity }
 *   window.KodroVerify.toHtml(report)         -> HTML string (Blob/bridge save)
 *
 * Plain JS (no React) so the headless QA can exercise it under Node.
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // One prediction row: label, value, fidelity tier, how it was derived.
  function row(label, value, tier, how) {
    return { label: label, value: value, tier: tier, how: how };
  }

  function report(robot, terrain) {
    var KM = window.KodroMotion;
    var M = KM.MODEL;
    var phys = robot && robot.phys;
    var speedFac = (robot && robot.speedFactor) || 1;
    var massFac = (robot && robot.massFactor) || 1;
    var traction = (terrain && terrain.traction) || 1;
    var gravity = (terrain && terrain.env && terrain.env.gravity) || M.gravityEarthMps2;

    var rows = [];
    // Top speed: physical -> motor-derived (HONOURED); catalogue -> the
    // calibrated 3.125 m/s anchor scaled by the parts factor.
    var vCmPerS = phys && phys.vMaxSimCmPerS !== undefined ? phys.vMaxSimCmPerS : M.baseSpeedCmPerS * speedFac;
    rows.push(row('Top speed', (vCmPerS / 100).toFixed(2) + ' m/s',
      phys && phys.vMaxSimCmPerS !== undefined ? 'honoured' : 'approximated',
      phys && phys.vMaxSimCmPerS !== undefined ? 'v = rpm/60 * 2*pi*r from the imported motor' : 'catalogue speed factor times the 3.125 m/s anchor'));
    // 0-to-top time (physical only; catalogue ramp is a display trapezoid).
    if (phys && phys.accelCmPerS2 !== undefined) {
      rows.push(row('0 to top speed', (vCmPerS / phys.accelCmPerS2).toFixed(2) + ' s', 'approximated',
        'a = (F_stall - Crr*m*g)/m, first order'));
    }
    // Stopping distance: v^2/(2*mu*g) replaces the old proxy.
    var stopCm = KM.physStoppingDistanceCm(vCmPerS, traction, gravity);
    rows.push(row('Stopping distance', (stopCm / 100).toFixed(2) + ' m', 'approximated',
      'd = v^2 / (2*mu*g), mu = ' + (M.brakeMu * traction).toFixed(2)));
    // Turn radius: ackermann geometry when specified, else turns in place.
    if (phys && phys.turnRadiusCm !== undefined) {
      rows.push(row('Minimum turn radius', (phys.turnRadiusCm / 100).toFixed(2) + ' m', 'notSimulated',
        'R = wheelbase/tan(maxSteer); REPORT-ONLY in v1, the sim does not drive this arc'));
    } else {
      rows.push(row('Turn', 'turns in place (differential drive)', phys && phys.trackCm !== undefined ? 'honoured' : 'approximated',
        phys && phys.trackCm !== undefined ? 'omega = 2*v_wheel/track' : 'display timing scaled by mass'));
    }
    // Runtime and range.
    var runtimeMin = (robot && robot.runtimeMin) || 60;
    rows.push(row('Runtime', '~' + runtimeMin + ' min',
      phys && phys.energyWh !== undefined ? 'approximated' : 'approximated',
      phys && phys.energyWh !== undefined
        ? 'E = mAh*V*usable; P = F*v/eta + idle (constant-power, no sag)'
        : 'catalogue estimate from mass'));
    rows.push(row('Range on one charge', ((vCmPerS / 100) * runtimeMin * 60 / 1000).toFixed(2) + ' km', 'approximated',
      'top speed times runtime; real missions turn and idle'));
    // Battery per metre, the number the empirical block cross-checks.
    var drainPerM = phys && phys.energyWh !== undefined
      ? phys.drainPctPerCmNominal * 100
      : KM.moveDrainPct(100, gravity, massFac, traction);
    rows.push(row('Battery per metre', drainPerM.toFixed(3) + ' %', 'approximated',
      phys && phys.energyWh !== undefined ? 'energy-true model at cruise speed' : 'shared constant-power ledger'));
    // Max slope is REPORTED only: worlds are flat planes (disclosed).
    if (phys && phys.maxSlopeDeg !== undefined) {
      rows.push(row('Max slope', phys.maxSlopeDeg + ' deg', 'notSimulated',
        'force and grip limits; the sim worlds are flat, so this is never driven'));
    }
    // Collision circle + sensor coverage.
    rows.push(row('Collision body', ((phys && phys.collisionRadiusCm) || M.roverRadiusCm) * 2 + ' cm circle',
      phys && phys.collisionRadiusCm ? 'honoured' : 'approximated',
      phys && phys.collisionRadiusCm ? 'hypot(length, width) from the imported body (still a circle, disclosed)' : 'default 60 cm circle'));
    var sensors = (robot && robot.sensors) || [];
    var sensorLine = sensors.length ? sensors.join(', ') : 'none fitted';
    if (phys && phys.sensor) {
      sensorLine += ' | ultrasonic at +' + phys.sensor.fwdCm + ' cm fwd, ' + phys.sensor.yawDeg + ' deg yaw, ' + phys.sensor.rangeCm + ' cm range';
    }
    rows.push(row('Sensor coverage', sensorLine, phys && phys.sensor ? 'honoured' : 'approximated',
      'mount pose and range drive the distance() ray; z ignored'));

    // ---- empirical block: measured evidence already recorded -------------
    var empirical = { lastRun: null, validation: null, agreement: null };
    var lastRun = window.KODRO_LAST_RUN;
    if (lastRun && lastRun.distanceCm > 0 && lastRun.wallMs > 400) {
      var measuredMps = (lastRun.distanceCm / 100) / (lastRun.wallMs / 1000);
      empirical.lastRun = {
        distanceM: Math.round(lastRun.distanceCm) / 100,
        seconds: Math.round(lastRun.wallMs / 100) / 10,
        measuredMps: Math.round(measuredMps * 100) / 100,
        speedMul: lastRun.speedMul || 1,
      };
      // Agreement check: measured mean speed vs derived top speed. Mean
      // speed is legitimately below top (ramps, turns, waits), so the
      // honest statement is a ratio, not a pass/fail.
      empirical.agreement = {
        derivedTopMps: Math.round(vCmPerS) / 100,
        ratio: Math.round((measuredMps / (vCmPerS / 100)) * 100) / 100,
      };
    }
    var reports = (window.KodroMemory && window.KodroMemory.scenarioReports && window.KodroMemory.scenarioReports()) || [];
    var last = reports[0];
    if (last && last.aggregate) {
      empirical.validation = {
        scenario: last.scenario && last.scenario.name,
        successRate: Math.round((last.aggregate.successRate || 0) * 100),
        meanCollisions: last.aggregate.meanCollisions,
        meanBatteryUsed: last.aggregate.meanBattery,
        seeds: last.aggregate.seeds,
      };
    }

    // ---- design check block ----------------------------------------------
    var design = null;
    if (window.KodroDiagnostics && terrain) {
      var rep = window.KodroDiagnostics.assess(robot, robot, terrain);
      design = { overall: rep.overall, summary: rep.summary, dimensions: rep.dimensions };
    }

    return {
      name: (robot && robot.name) || 'Robot',
      type: (robot && robot.type) || '-',
      world: (terrain && terrain.name) || '-',
      generated: new Date().toISOString(),
      measured: !!phys,
      rows: rows,
      empirical: empirical,
      design: design,
      fidelity: (window.KodroSpecSchema && window.KodroSpecSchema.FIDELITY) || null,
    };
  }

  var TIER_LABEL = { honoured: 'HONOURED', approximated: 'APPROXIMATED', notSimulated: 'NOT SIMULATED' };
  var TIER_COLOR = { honoured: '#1d8a7d', approximated: '#a97a1c', notSimulated: '#a5453a' };

  function toHtml(r) {
    var h = [];
    h.push('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Kodro verification: ' + esc(r.name) + '</title>');
    h.push('<style>body{font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#1c2430;max-width:820px;margin:32px auto;padding:0 20px;line-height:1.5}h1{font-size:22px}h2{font-size:15px;letter-spacing:0.06em;text-transform:uppercase;color:#44536b;margin-top:28px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #dbe2ec;padding:7px 8px;font-size:13.5px;text-align:left;vertical-align:top}.badge{font-size:10px;font-weight:800;letter-spacing:0.06em;border-radius:4px;padding:2px 7px;color:#fff;white-space:nowrap}.how{color:#68758c;font-size:12px}.muted{color:#68758c}</style></head><body>');
    h.push('<h1>' + esc(r.name) + ' - as simulated by Kodro</h1>');
    h.push('<p class="muted">Type ' + esc(r.type) + ' | world ' + esc(r.world) + ' | generated ' + esc(r.generated) + (r.measured ? ' | measured build (imported KRS spec)' : ' | catalogue build') + '</p>');
    h.push('<h2>Predicted performance</h2><table><tr><th>Quantity</th><th>Value</th><th>Fidelity</th><th>Derivation</th></tr>');
    r.rows.forEach(function (rw) {
      h.push('<tr><td>' + esc(rw.label) + '</td><td><b>' + esc(rw.value) + '</b></td><td><span class="badge" style="background:' + TIER_COLOR[rw.tier] + '">' + TIER_LABEL[rw.tier] + '</span></td><td class="how">' + esc(rw.how) + '</td></tr>');
    });
    h.push('</table>');
    h.push('<h2>Measured evidence</h2>');
    if (r.empirical.lastRun) {
      var lr = r.empirical.lastRun;
      h.push('<p>Last live run: <b>' + lr.distanceM + ' m</b> in <b>' + lr.seconds + ' s</b> = mean <b>' + lr.measuredMps + ' m/s</b> (sim speed ' + lr.speedMul + 'x). Derived top speed ' + r.empirical.agreement.derivedTopMps + ' m/s; the mean ran at ' + Math.round(r.empirical.agreement.ratio * 100) + ' percent of it (ramps, turns and waits keep the mean below the top).</p>');
    } else {
      h.push('<p class="muted">No live run recorded yet. Press Run in the studio, then regenerate this report for the measured block.</p>');
    }
    if (r.empirical.validation) {
      var va = r.empirical.validation;
      h.push('<p>Last validation ("' + esc(va.scenario || '-') + '", ' + va.seeds + ' randomised seeds): success ' + va.successRate + ' percent, mean collisions ' + va.meanCollisions + ', mean battery used ' + va.meanBatteryUsed + ' percent.</p>');
    } else {
      h.push('<p class="muted">No multi-seed validation recorded yet. Press Validate in the studio for the spread.</p>');
    }
    if (r.design) {
      h.push('<h2>Design check (' + esc(r.design.overall).toUpperCase() + ')</h2><p>' + esc(r.design.summary) + '</p><ul>');
      r.design.dimensions.forEach(function (d) {
        h.push('<li><b>' + esc(d.label) + '</b> (' + esc(d.status) + '): ' + esc(d.reason) + '</li>');
      });
      h.push('</ul>');
    }
    if (r.fidelity) {
      h.push('<h2>Fidelity annex: what these numbers are</h2>');
      [['honoured', 'Honoured exactly'], ['approximated', 'Approximated (first order)'], ['notSimulated', 'Not simulated (reported or absent)']].forEach(function (pair) {
        h.push('<p><span class="badge" style="background:' + TIER_COLOR[pair[0]] + '">' + TIER_LABEL[pair[0]] + '</span> ' + esc(pair[1]) + '</p><ul>');
        r.fidelity[pair[0]].forEach(function (item) { h.push('<li>' + esc(item) + '</li>'); });
        h.push('</ul>');
      });
    }
    h.push('<p class="muted">Kodro is a first-order proving ground, not a certification tool: expect real hardware to land within honest error bars of these numbers, and treat every NOT SIMULATED row as exactly that.</p>');
    h.push('</body></html>');
    return h.join('');
  }

  window.KodroVerify = { report: report, toHtml: toHtml };
})();
