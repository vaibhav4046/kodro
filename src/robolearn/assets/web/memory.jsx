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
 *   window.KodroMemory.lessonFor(world)   -- the latest reflection for a world
 */
(function () {
  const RKEY = 'kodro_reflections_v1';
  const SKEY = 'kodro_skills_v1';
  const MAX = 40;

  function load(key) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : []; } catch (e) { return []; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { void e; } }

  // Turn a run outcome into a short, useful reflection. Rule based and
  // deterministic; the local model can elaborate it when one is installed.
  function reflect(run) {
    const what = (run.detail || '').toLowerCase();
    if (run.outcome === 'done') return 'Reached the goal. This program worked here; consider saving it as a skill to reuse.';
    if (run.outcome === 'crash') {
      if (what.indexOf('pedestrian') >= 0) return 'A pedestrian crossed the path. Read sensor() and slow or stop before moving on.';
      if (what.indexOf('vehicle') >= 0 || what.indexOf('car') >= 0) return 'Traffic was in the way. Wait for the lane to clear, then cross.';
      if (what.indexOf('boundary') >= 0 || what.indexOf('wall') >= 0) return 'Hit the edge of the area. Turn back before the boundary.';
      return 'Collided with ' + (run.detail || 'an obstacle') + '. Add a turn or a shorter move to go around it.';
    }
    return 'Run stopped early. Check the last command and try again.';
  }

  function record(run) {
    const refl = reflect(run);
    const list = load(RKEY);
    list.unshift({ ts: (run.ts || 0), world: run.world || '', robotType: run.robotType || '', outcome: run.outcome || '', detail: run.detail || '', reflection: refl });
    if (list.length > MAX) list.length = MAX;
    save(RKEY, list);
    try { window.dispatchEvent(new CustomEvent('kodro-memory')); } catch (e) { void e; }
    return refl;
  }

  function reflections() { return load(RKEY); }
  function lessonFor(world) { const l = load(RKEY); for (const r of l) if (!world || r.world === world) return r; return null; }

  function saveSkill(name, code, ctx) {
    if (!name || !code) return false;
    const list = load(SKEY).filter((s) => s.name !== name);
    list.unshift({ name: String(name).slice(0, 40), code: String(code), world: (ctx && ctx.world) || '', robotType: (ctx && ctx.robotType) || '', ts: (ctx && ctx.ts) || 0, uses: 0 });
    if (list.length > MAX) list.length = MAX;
    save(SKEY, list);
    try { window.dispatchEvent(new CustomEvent('kodro-memory')); } catch (e) { void e; }
    return true;
  }
  function skills() { return load(SKEY); }
  function useSkill(name) { const l = load(SKEY); const s = l.find((x) => x.name === name); if (s) { s.uses = (s.uses || 0) + 1; save(SKEY, l); } return s ? s.code : null; }
  function removeSkill(name) { save(SKEY, load(SKEY).filter((s) => s.name !== name)); try { window.dispatchEvent(new CustomEvent('kodro-memory')); } catch (e) { void e; } }

  // ---- scenario validation reports (domain randomisation across seeds) ----
  const CKEY = 'kodro_scenarios_v1';
  function saveScenarioReport(report) {
    if (!report) return false;
    const list = load(CKEY);
    list.unshift(report);
    if (list.length > MAX) list.length = MAX;
    save(CKEY, list);
    try { window.dispatchEvent(new CustomEvent('kodro-memory')); } catch (e) { void e; }
    return true;
  }
  function scenarioReports() { return load(CKEY); }

  window.KodroMemory = { record, reflections, lessonFor, saveSkill, skills, useSkill, removeSkill, saveScenarioReport, scenarioReports };
})();
