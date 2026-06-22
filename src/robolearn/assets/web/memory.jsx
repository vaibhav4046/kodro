/* Self-refinement store (offline, local).
 *
 * The honest, system-level self-refinement the proposal describes: after each
 * run the system records what happened and writes a short reflection, keeps a
 * growing library of programs that worked as reusable skills, and surfaces the
 * most relevant past lesson for the world the user is in. Nothing here changes
 * the model's weights; the gain is in what the system remembers and reuses,
 * which is exactly what can be counted. Backed by localStorage so it persists
 * across sessions and never leaves the machine.
 *
 *   window.KodroMemory.record({world, robotType, outcome, detail})
 *   window.KodroMemory.reflections()      -- recent reflections, newest first
 *   window.KodroMemory.saveSkill(name, code, ctx) / skills() / removeSkill(name)
 *   window.KodroMemory.lessonFor(world, robotType?)  -- most relevant reflection
 *   window.KodroMemory.findSkill(world, robotType)   -- best matching saved skill
 *   window.KodroMemory.stats()           -- {reflectionCount, skillCount, ...}
 *   window.KodroMemory.exportData()      -- JSON backup of reflections + skills
 *   window.KodroMemory.importData(json)  -- restore from a backup string
 */
(function () {
  const RKEY = 'kodro_reflections_v1';
  const SKEY = 'kodro_skills_v1';
  const CKEY = 'kodro_scenarios_v1';
  const MAX = 40;

  function load(key) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : []; } catch (e) { return []; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { void e; } }
  function bump() { try { window.dispatchEvent(new CustomEvent('kodro-memory')); } catch (e) { void e; } }

  // Turn a run outcome into a short, specific, actionable reflection. Rule
  // based and deterministic; the local model can elaborate it when one is
  // installed. Each branch names the concrete command to add or change so the
  // suggestion can be applied directly to the next program.
  function reflect(run) {
    const what = (run.detail || '').toLowerCase();
    const detail = run.detail || 'an obstacle';
    if (run.outcome === 'done') {
      return "Program worked. Consider saving it as a skill with the Save button to reuse on similar tasks.";
    }
    if (run.outcome === 'crash') {
      if (what.indexOf('pedestrian') >= 0) {
        return "A pedestrian crossed. Add 'while distance() > 40: move_forward(1)' to sense and stop before moving into a crossing.";
      }
      if (what.indexOf('vehicle') >= 0 || what.indexOf('car') >= 0 || what.indexOf('traffic') >= 0) {
        return "Traffic was in the way. Scan with distance() before entering a lane, and wait if the reading is under 100.";
      }
      if (what.indexOf('boundary') >= 0 || what.indexOf('wall') >= 0 || what.indexOf('edge') >= 0) {
        return "Hit the boundary. The arena is 30m wide. Use shorter moves like move_forward(2) and check distance() before long drives.";
      }
      return "Collided with " + detail + ". Add a distance() check before moving forward.";
    }
    if (run.outcome === 'flat') {
      return "Battery ran out. Use shorter moves or set a lower speed with set_speed(50) to conserve battery.";
    }
    return "Run stopped early. Check the last command and try again.";
  }

  function record(run) {
    const refl = reflect(run);
    const list = load(RKEY);
    list.unshift({ ts: (run.ts || 0), world: run.world || '', robotType: run.robotType || '', outcome: run.outcome || '', detail: run.detail || '', reflection: refl });
    if (list.length > MAX) list.length = MAX;
    save(RKEY, list);
    bump();
    return refl;
  }

  function reflections() { return load(RKEY); }

  // Relevance score for a reflection against (world, robotType). A reflection
  // matching both scores higher than one matching only the world; newer
  // reflections break ties so the most recent applicable lesson wins.
  function reflScore(r, world, robotType) {
    let s = 0;
    if (world && r.world === world) s += 2;
    if (robotType && r.robotType === robotType) s += 1;
    // Half-credit for an empty world so early generic lessons still surface.
    if (world && !r.world) s += 0.5;
    if (robotType && !r.robotType) s += 0.25;
    return s;
  }

  // Most relevant reflection for the given world (and optional robotType).
  // Backward compatible: callers that pass only world still get the newest
  // world match, identical to the old behaviour.
  function lessonFor(world, robotType) {
    const l = load(RKEY);
    if (!l.length) return null;
    let best = null;
    let bestScore = 0;
    for (let i = 0; i < l.length; i++) {
      const r = l[i];
      if (world && r.world && r.world !== world) continue;
      const s = reflScore(r, world, robotType) + (l.length - i) / 100000; // recency tiebreak
      if (s > bestScore) { bestScore = s; best = r; }
    }
    return best;
  }

  function saveSkill(name, code, ctx) {
    if (!name || !code) return false;
    const list = load(SKEY).filter((s) => s.name !== name);
    list.unshift({ name: String(name).slice(0, 40), code: String(code), world: (ctx && ctx.world) || '', robotType: (ctx && ctx.robotType) || '', ts: (ctx && ctx.ts) || 0, uses: 0 });
    if (list.length > MAX) list.length = MAX;
    save(SKEY, list);
    bump();
    return true;
  }
  function skills() { return load(SKEY); }
  function useSkill(name) { const l = load(SKEY); const s = l.find((x) => x.name === name); if (s) { s.uses = (s.uses || 0) + 1; save(SKEY, l); } return s ? s.code : null; }
  function removeSkill(name) { save(SKEY, load(SKEY).filter((s) => s.name !== name)); bump(); }

  // Best saved skill for the current context. Prefers a skill saved for this
  // exact world + robotType; falls back to world-only matches; ranks ties by
  // most uses, then most recent. Returns null if nothing usable is stored.
  function findSkill(world, robotType) {
    const l = load(SKEY);
    if (!l.length) return null;
    function score(s) {
      let sWorld = 0, sType = 0;
      if (world && s.world === world) sWorld = 2; else if (world && !s.world) sWorld = 0.5;
      if (robotType && s.robotType === robotType) sType = 1; else if (robotType && !s.robotType) sType = 0.25;
      return sWorld + sType;
    }
    let best = null, bestKey = -1;
    for (const s of l) {
      const sc = score(s);
      if (sc <= 0) continue;
      // Sort key: score * 1e6 + uses * 1e3 + ts. Higher is better.
      const key = sc * 1e6 + (s.uses || 0) * 1e3 + (s.ts || 0);
      if (key > bestKey) { bestKey = key; best = s; }
    }
    return best;
  }

  // Snapshot for the Memory panel: counts, the most-used skill, and the most
  // recent run outcome so the UI can show what the system currently knows.
  function stats() {
    const rs = load(RKEY);
    const ss = load(SKEY);
    let topSkill = null;
    for (const s of ss) if (!topSkill || (s.uses || 0) > (topSkill.uses || 0)) topSkill = s;
    const recent = rs[0] || null;
    return {
      reflectionCount: rs.length,
      skillCount: ss.length,
      topSkill: topSkill ? { name: topSkill.name, uses: topSkill.uses || 0, world: topSkill.world || '', robotType: topSkill.robotType || '' } : null,
      recentOutcome: recent ? { outcome: recent.outcome, world: recent.world || '', robotType: recent.robotType || '', ts: recent.ts || 0 } : null,
    };
  }

  // Backup / restore. Only reflections + skills are exported (scenario reports
  // are reproducible from seeds, so they stay out of the backup to keep it
  // small and portable). importData merges by name for skills and prepends
  // reflections, capping at MAX; returns the number of items restored.
  function exportData() {
    return JSON.stringify({
      version: 1,
      exportedAt: Date.now(),
      reflections: load(RKEY),
      skills: load(SKEY),
    });
  }
  function importData(json) {
    let data;
    try { data = typeof json === 'string' ? JSON.parse(json) : json; }
    catch (e) { return 0; }
    if (!data || typeof data !== 'object') return 0;
    let count = 0;
    if (Array.isArray(data.reflections)) {
      const existing = load(RKEY);
      const merged = data.reflections
        .filter((r) => r && typeof r === 'object' && r.reflection)
        .map((r) => ({
          ts: r.ts || 0,
          world: r.world || '',
          robotType: r.robotType || '',
          outcome: r.outcome || '',
          detail: r.detail || '',
          reflection: String(r.reflection),
        }))
        .concat(existing);
      while (merged.length > MAX) merged.pop();
      save(RKEY, merged);
      count += merged.length;
    }
    if (Array.isArray(data.skills)) {
      const existing = load(SKEY);
      const byName = {};
      for (const s of existing) byName[s.name] = s;
      for (const s of data.skills) {
        if (!s || !s.name || !s.code) continue;
        const prev = byName[s.name];
        byName[s.name] = {
          name: String(s.name).slice(0, 40),
          code: String(s.code),
          world: s.world || (prev && prev.world) || '',
          robotType: s.robotType || (prev && prev.robotType) || '',
          ts: Math.max(s.ts || 0, (prev && prev.ts) || 0),
          uses: Math.max(s.uses || 0, (prev && prev.uses) || 0),
        };
      }
      const merged = Object.values(byName).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      while (merged.length > MAX) merged.pop();
      save(SKEY, merged);
      count += merged.length;
    }
    bump();
    return count;
  }

  // ---- scenario validation reports (domain randomisation across seeds) ----
  function saveScenarioReport(report) {
    if (!report) return false;
    const list = load(CKEY);
    list.unshift(report);
    if (list.length > MAX) list.length = MAX;
    save(CKEY, list);
    bump();
    return true;
  }
  function scenarioReports() { return load(CKEY); }

  window.KodroMemory = {
    record, reflections, lessonFor,
    saveSkill, skills, useSkill, removeSkill, findSkill,
    stats, exportData, importData,
    saveScenarioReport, scenarioReports,
  };
})();
