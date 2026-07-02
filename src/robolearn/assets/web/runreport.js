/* Run reports - the per-run structured artefact (PERFECTION_PLAN P7/A8).
 *
 * Every terminal run outcome (finished, crashed, flat battery, stalled)
 * produces one structured record: what robot, in which world, how far, how
 * close it shaved an obstacle, what the battery cost, and how the outcome
 * compared with the design check's pre-run prediction. Today's console lines
 * are transient; this history is the durable evidence a skeptical builder
 * can read back and compare across builds.
 *
 * Plain JS, localStorage-backed, capped. Exposes window.KodroRunReports:
 *   save(entry)  -> the stored entry (stamped with an id)
 *   list()       -> newest first
 *   clear()
 *   diff(a, b)   -> [{label, a, b, delta}] numeric comparison rows
 */
(function () {
  'use strict';

  var KEY = 'kodro_run_reports_v1';
  var MAX = 40;

  function store() { return (window.KODRO_PROJECT_STORE || window.localStorage); }
  function load() {
    try { var raw = store().getItem(KEY); var v = raw ? JSON.parse(raw) : []; return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function persist(list) {
    try { store().setItem(KEY, JSON.stringify(list)); } catch (e) { void e; }
  }

  var seq = 0;
  function save(entry) {
    if (!entry || typeof entry !== 'object') return null;
    var rec = {
      id: Date.now() + '-' + (++seq),
      ts: entry.ts || Date.now(),
      world: String(entry.world || ''),
      worldName: String(entry.worldName || ''),
      robotName: String(entry.robotName || ''),
      robotType: String(entry.robotType || ''),
      massFactor: +entry.massFactor || 1,
      speedFactor: +entry.speedFactor || 1,
      outcome: String(entry.outcome || ''),        // done | crash | flat | stalled | error
      detail: String(entry.detail || ''),
      commands: entry.commands != null ? Math.round(+entry.commands) : null,
      distanceCm: entry.distanceCm != null ? Math.round(+entry.distanceCm) : null,
      batteryUsedPct: entry.batteryUsedPct != null ? Math.round(+entry.batteryUsedPct * 10) / 10 : null,
      minProximityCm: entry.minProximityCm != null && isFinite(entry.minProximityCm) ? Math.round(+entry.minProximityCm) : null,
      wallMs: entry.wallMs != null ? Math.round(+entry.wallMs) : null,
      predicted: String(entry.predicted || ''),    // design-check overall before the run
      verdict: String(entry.verdict || ''),        // the post-run coach line
    };
    var list = load();
    list.unshift(rec);
    if (list.length > MAX) list.length = MAX;
    persist(list);
    try { window.dispatchEvent(new CustomEvent('kodro-runreport')); } catch (e) { void e; }
    return rec;
  }

  function list() { return load(); }
  function clear() { persist([]); try { window.dispatchEvent(new CustomEvent('kodro-runreport')); } catch (e) { void e; } }

  // Numeric side-by-side for the compare view: two runs, one row per metric.
  function diff(a, b) {
    if (!a || !b) return [];
    var rows = [
      ['Distance (cm)', a.distanceCm, b.distanceCm],
      ['Battery used (%)', a.batteryUsedPct, b.batteryUsedPct],
      ['Closest approach (cm)', a.minProximityCm, b.minProximityCm],
      ['Commands run', a.commands, b.commands],
      ['Wall time (s)', a.wallMs != null ? Math.round(a.wallMs / 100) / 10 : null, b.wallMs != null ? Math.round(b.wallMs / 100) / 10 : null],
    ];
    return rows.map(function (r) {
      var av = r[1], bv = r[2];
      return {
        label: r[0],
        a: av != null ? av : '-',
        b: bv != null ? bv : '-',
        delta: (av != null && bv != null) ? Math.round((bv - av) * 10) / 10 : null,
      };
    });
  }

  window.KodroRunReports = { save: save, list: list, clear: clear, diff: diff, KEY: KEY, MAX: MAX };
})();
