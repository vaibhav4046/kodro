/* Kodro project file - the document model (PERFECTION_PLAN P7/A7).
 *
 * One JSON document (.kodro) that captures the whole working state the studio
 * scatters across localStorage keys: the robot spec, every program buffer,
 * the active world/tab, the render presets, the self-refinement memory, the
 * scenario validation history and the run reports. Save it, wipe the machine,
 * open it, and the studio is back where it was - the professional-app promise
 * a pile of unversioned localStorage keys cannot make.
 *
 * Plain JS (no React, no JSX) so the QA harness can exercise the round trip
 * in a bare VM with a localStorage shim. Exposes window.KodroProject:
 *
 *   collect()        -> document object (KPF v1) from the live storage
 *   serialize()      -> pretty JSON string of collect()
 *   validate(text)   -> { ok, doc, errors[], warnings[] }  (never throws)
 *   apply(docOrText) -> { ok, warnings[] }  writes storage; caller reloads
 *   fileName(doc)    -> suggested "<name>.kodro" file name
 *
 * Validation mirrors the KRS importer's defensiveness: unknown keys dropped,
 * wrong-typed fields dropped with a named warning, oversize payloads rejected.
 */
(function () {
  'use strict';

  var VERSION = 1;
  var MAX_TEXT = 2 * 1024 * 1024;   // an entire project over 2 MB is not ours
  var MAX_PROGRAM = 100 * 1024;     // one program buffer over 100 KB is junk
  var MAX_LIST = 60;                // reflections / skills / reports cap

  // The storage keys this document owns (single source for collect/apply).
  var KEYS = {
    world: 'or_terrain',
    tab: 'or_tab',
    programs: 'or_programs',
    spec: 'kodro_robot_v2',
    specV1: 'kodro_robot_v1',
    tod: 'kodro_tod',
    weather: 'kodro_weather',
    quality: 'kodro_quality',
    view3d: 'or_view3d',
    mode: 'kodro_mode',
    theme: 'or_theme',
    reflections: 'kodro_reflections_v1',
    skills: 'kodro_skills_v1',
    scenarios: 'kodro_scenarios_v1',
    runReports: 'kodro_run_reports_v1',
  };

  function store() {
    // Injectable for the VM round-trip test; the browser uses localStorage.
    return (window.KODRO_PROJECT_STORE || window.localStorage);
  }
  function readJson(key, fallback) {
    try {
      var raw = store().getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function readStr(key, fallback) {
    try {
      var raw = store().getItem(key);
      return raw == null ? fallback : String(raw);
    } catch (e) { return fallback; }
  }
  // Reports whether the value actually landed. It used to swallow the throw
  // and return nothing, which let apply() declare success after a quota or
  // private-mode failure had dropped an arbitrary subset of the document.
  function write(key, value) {
    try { store().setItem(key, value); return true; } catch (e) { void e; return false; }
  }

  function collect() {
    // The raw saved spec (v2 preferred, v1 fallback) - NOT the derived block;
    // derivation is recomputed on open so a document can never smuggle stale
    // physics past the validator.
    var spec = readJson(KEYS.spec, null) || readJson(KEYS.specV1, null);
    return {
      kodroProject: VERSION,
      savedAt: Date.now(),
      world: readStr(KEYS.world, 'earth'),
      tab: readStr(KEYS.tab, 'drive'),
      tod: readStr(KEYS.tod, 'noon'),
      weather: readStr(KEYS.weather, 'clear'),
      quality: readStr(KEYS.quality, 'high'),
      view3d: readStr(KEYS.view3d, '1'),
      mode: readStr(KEYS.mode, 'studio'),
      theme: readStr(KEYS.theme, 'dark'),
      spec: spec,
      programs: readJson(KEYS.programs, {}) || {},
      memory: {
        reflections: readJson(KEYS.reflections, []) || [],
        skills: readJson(KEYS.skills, []) || [],
      },
      scenarioReports: readJson(KEYS.scenarios, []) || [],
      runReports: readJson(KEYS.runReports, []) || [],
    };
  }

  function serialize() {
    return JSON.stringify(collect(), null, 2);
  }

  function fileName(doc) {
    var name = (doc && doc.spec && doc.spec.name) || 'kodro-project';
    // Unicode-aware slug: keep letters and numbers from any script (CJK,
    // Cyrillic, accented Latin) so a non-ASCII robot name does not collapse to
    // the generic 'kodro-project' and collide with every other non-Latin name.
    var slug = String(name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'kodro-project';
    return slug + '.kodro';
  }

  function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  function cleanList(list, warnings, label) {
    if (!Array.isArray(list)) {
      if (list !== undefined) warnings.push(label + ' is not a list; dropped.');
      return [];
    }
    var out = list.filter(isPlainObject).slice(0, MAX_LIST);
    if (out.length !== list.length) warnings.push(label + ': ' + (list.length - out.length) + ' malformed or overflow entries dropped.');
    return out;
  }

  function validate(text) {
    var errors = [];
    var warnings = [];
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, doc: null, errors: ['Empty project file.'], warnings: warnings };
    }
    if (text.length > MAX_TEXT) {
      return { ok: false, doc: null, errors: ['Project file is larger than 2 MB.'], warnings: warnings };
    }
    var raw;
    try { raw = JSON.parse(text); }
    catch (e) { return { ok: false, doc: null, errors: ['Not valid JSON: ' + (e && e.message ? e.message : e)], warnings: warnings }; }
    if (!isPlainObject(raw)) {
      return { ok: false, doc: null, errors: ['Project file must be a JSON object.'], warnings: warnings };
    }
    if (raw.kodroProject !== VERSION) {
      return { ok: false, doc: null, errors: ['Not a Kodro project file (missing "kodroProject": 1).'], warnings: warnings };
    }

    var doc = { kodroProject: VERSION, savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : 0 };

    // Simple string fields: wrong type -> default + warning, never a crash.
    var strField = function (key, dflt) {
      var v = raw[key];
      if (v === undefined) { doc[key] = dflt; return; }
      if (typeof v !== 'string' || v.length > 64) { warnings.push('"' + key + '" is not a short string; reset to "' + dflt + '".'); doc[key] = dflt; return; }
      doc[key] = v;
    };
    strField('world', 'earth');
    strField('tab', 'drive');
    strField('tod', 'noon');
    strField('weather', 'clear');
    strField('quality', 'high');
    strField('view3d', '1');
    strField('mode', 'studio');
    strField('theme', 'dark');

    // The robot spec: passed through the KRS/catalogue validator when it is
    // available (browser), else structurally checked (VM round-trip test).
    if (raw.spec === undefined || raw.spec === null) {
      doc.spec = null;
      warnings.push('No robot spec in the project; the current build is kept.');
    } else if (!isPlainObject(raw.spec)) {
      doc.spec = null;
      errors.push('"spec" must be an object.');
    } else {
      // Coerce the spec's list fields to arrays. A hand-edited or corrupted
      // .kodro with e.g. "actuators": {} (an object) used to be persisted raw
      // and then throw "TypeError: forEach is not a function" at module init on
      // the next reload - a persistent boot brick until localStorage was cleared.
      // The KRS schema rejects this, but a project file bypasses it, so guard here.
      var spec = Object.assign({}, raw.spec);
      ['sensors', 'actuators'].forEach(function (k) {
        if (spec[k] !== undefined && !Array.isArray(spec[k])) {
          warnings.push('"spec.' + k + '" is not a list; reset to empty.');
          spec[k] = [];
        }
      });
      // The measured (KRS) physical block is written RAW by apply() and then
      // consumed at BOOT by RobotLab.load() -> deriveFromPhysical(), so a
      // malformed block here is a persistent boot brick, not a soft warning.
      // Validate it as a typed shape: the block itself and its object fields
      // must be plain objects, and physical.sensors must be a list.
      if (spec.physical !== undefined && spec.physical !== null) {
        if (!isPlainObject(spec.physical)) {
          errors.push('"spec.physical" must be an object (a measured KRS block).');
        } else {
          var phys = Object.assign({}, spec.physical);
          if (phys.sensors !== undefined && !Array.isArray(phys.sensors)) {
            warnings.push('"spec.physical.sensors" is not a list; reset to empty.');
            phys.sensors = [];
          }
          ['bodyCm', 'drive', 'battery', 'declared'].forEach(function (k) {
            if (phys[k] !== undefined && !isPlainObject(phys[k])) {
              warnings.push('"spec.physical.' + k + '" is not an object; dropped.');
              delete phys[k];
            }
          });
          if (phys.massKg !== undefined && (typeof phys.massKg !== 'number' || !isFinite(phys.massKg) || phys.massKg <= 0)) {
            warnings.push('"spec.physical.massKg" is not a positive number; dropped.');
            delete phys.massKg;
          }
          spec.physical = phys;
        }
      }
      doc.spec = spec;
    }

    // Program buffers: a map of tab -> source string.
    doc.programs = {};
    if (raw.programs !== undefined) {
      if (!isPlainObject(raw.programs)) {
        errors.push('"programs" must be an object of tab -> source.');
      } else {
        Object.keys(raw.programs).forEach(function (k) {
          var v = raw.programs[k];
          if (typeof v !== 'string') { warnings.push('program "' + k + '" is not text; dropped.'); return; }
          if (v.length > MAX_PROGRAM) { warnings.push('program "' + k + '" exceeds 100 KB; dropped.'); return; }
          doc.programs[k] = v;
        });
      }
    }

    doc.memory = {
      reflections: cleanList(raw.memory && raw.memory.reflections, warnings, 'memory.reflections'),
      skills: cleanList(raw.memory && raw.memory.skills, warnings, 'memory.skills'),
    };
    doc.scenarioReports = cleanList(raw.scenarioReports, warnings, 'scenarioReports');
    doc.runReports = cleanList(raw.runReports, warnings, 'runReports');

    return { ok: errors.length === 0, doc: errors.length === 0 ? doc : null, errors: errors, warnings: warnings };
  }

  function apply(docOrText) {
    var res;
    if (typeof docOrText === 'string') {
      res = validate(docOrText);
      if (!res.ok) return { ok: false, warnings: res.warnings, errors: res.errors };
    } else {
      // An already-validated document (or a collect() result round-tripping).
      res = validate(JSON.stringify(docOrText));
      if (!res.ok) return { ok: false, warnings: res.warnings, errors: res.errors };
    }
    var doc = res.doc;
    // Storage can refuse a write at any point: quota exhausted part-way
    // through a large document, or private mode refusing all of them. The
    // writes are not transactional and cannot be rolled back once some have
    // landed, so the only honest option is to notice and say so. Reporting
    // ok:true here meant the caller announced "Project loaded" and reloaded
    // the studio into a half-applied mixture of the old and new documents.
    var failed = [];
    function put(key, value) { if (!write(key, value)) failed.push(key); }
    put(KEYS.world, doc.world);
    put(KEYS.tab, doc.tab);
    put(KEYS.tod, doc.tod);
    put(KEYS.weather, doc.weather);
    put(KEYS.quality, doc.quality);
    put(KEYS.view3d, doc.view3d);
    put(KEYS.mode, doc.mode);
    put(KEYS.theme, doc.theme);
    if (doc.spec) {
      // A catalogue spec routes through the Lab's validate-then-save (parts
      // are checked against the catalogue, unknown ids dropped). A measured
      // (KRS) build is written raw: its physical block was validated by the
      // schema on import and RobotLab.load() re-derives on read, so stale
      // derived numbers can never be smuggled in through a project file.
      if (!doc.spec.physical && window.RobotLab && window.RobotLab.applySpec) {
        window.RobotLab.applySpec(doc.spec);
      } else {
        put(KEYS.spec, JSON.stringify(doc.spec));
      }
    }
    put(KEYS.programs, JSON.stringify(doc.programs));
    put(KEYS.reflections, JSON.stringify(doc.memory.reflections));
    put(KEYS.skills, JSON.stringify(doc.memory.skills));
    put(KEYS.scenarios, JSON.stringify(doc.scenarioReports));
    put(KEYS.runReports, JSON.stringify(doc.runReports));
    if (failed.length) {
      return {
        ok: false,
        partial: true,
        failedKeys: failed,
        warnings: res.warnings,
        errors: [
          'This device refused to store ' + failed.length + ' of the project\'s '
          + 'settings, so only part of it was applied. Storage is probably full '
          + 'or disabled. Free some space and open the file again.',
        ],
      };
    }
    return { ok: true, partial: false, failedKeys: [], warnings: res.warnings, errors: [] };
  }

  window.KodroProject = {
    VERSION: VERSION,
    KEYS: KEYS,
    collect: collect,
    serialize: serialize,
    validate: validate,
    apply: apply,
    fileName: fileName,
  };
})();
