/* Kodro read-only site tools (WebMCP).
 *
 * Registers Kodro's live workspace for a compatible agent through the
 * official site-tools surface when the browser offers it, and does nothing
 * everywhere else. This module is intentionally read-only: it exposes the
 * current editor source, robot spec, world prefs, lesson, latest run
 * evidence, and capability flags. It cannot alter code, robot, scene,
 * storage, lessons, or grades, so it carries no versioning, undo, or
 * renderer risk. Anything that changes state belongs in a later,
 * separately gated module, never slipped in here.
 *
 * No fetch, no endpoints, no secret fields, no storage changes. Feature
 * detection follows the official capability check; unsupported browsers
 * keep the normal Kodro interface untouched.
 */
(function (window) {
  'use strict';

  var TOOL_NAMES = ['kodro_get_workspace', 'kodro_get_run_evidence', 'kodro_get_capabilities'];
  var MAX_SOURCE_CHARS = 20000;
  var EMPTY_SCHEMA = { type: 'object', properties: {}, additionalProperties: false };
  var READ_ONLY = { readOnlyHint: true };

  function lsGet(store, key) {
    try {
      if (!store || typeof store.getItem !== 'function') return null;
      var v = store.getItem(key);
      return typeof v === 'string' ? v : null;
    } catch (e) { return null; }
  }

  function jsonSafe(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (e) { return undefined; }
  }

  function field(value, reason) {
    return value === null || value === undefined ? { value: null, reason: reason } : { value: value };
  }

  function readProgram(env) {
    var win = env.window || {};
    if (typeof win.KODRO_LIVE_CODE !== 'string') {
      return { value: null, reason: 'no program loaded in the editor' };
    }
    if (win.KODRO_LIVE_CODE.length > MAX_SOURCE_CHARS) {
      return { value: null, reason: 'program exceeds 20000 characters' };
    }
    return { value: win.KODRO_LIVE_CODE };
  }

  function readRobot(env) {
    var win = env.window || {};
    if (typeof win.getKodroRobot !== 'function') {
      return { value: null, reason: 'robot not initialised' };
    }
    var spec;
    try { spec = jsonSafe(win.getKodroRobot()); } catch (e) { spec = undefined; }
    if (!spec || typeof spec !== 'object') {
      return { value: null, reason: 'robot spec unreadable' };
    }
    return { value: spec };
  }

  function readWorld(env) {
    var store = env.localStorage;
    return {
      terrainId: field(lsGet(store, 'or_terrain'), 'world preference not stored yet'),
      tod: field(lsGet(store, 'kodro_tod'), 'time-of-day preference not stored yet'),
      weather: field(lsGet(store, 'kodro_weather'), 'weather preference not stored yet'),
      quality: field(lsGet(store, 'kodro_quality'), 'quality preference not stored yet'),
    };
  }

  function readLesson(env) {
    var id = null;
    try {
      var doc = env.document;
      if (doc && typeof doc.querySelector === 'function') {
        var sel = doc.querySelector('#lesson-select');
        if (sel && typeof sel.value === 'string' && sel.value) id = sel.value;
      }
    } catch (e) { id = null; }
    return field(id, 'no lesson selected');
  }

  var EVIDENCE_KEYS = ['id', 'lessonId', 'score', 'verdict', 'passed', 'collisions',
    'distanceM', 'distanceTravelledM', 'batteryPct', 'samplesCollected', 'createdAt'];

  function pickScalars(entry) {
    var out = {};
    for (var i = 0; i < EVIDENCE_KEYS.length; i++) {
      var k = EVIDENCE_KEYS[i];
      var v = entry[k];
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    }
    return out;
  }

  function readReports(env) {
    var win = env.window || {};
    try {
      var api = win.KodroRunReports;
      if (!api || typeof api.list !== 'function') return null;
      var list = api.list();
      if (!Array.isArray(list) || list.length === 0) return null;
      return list;
    } catch (e) { return null; }
  }

  function snapshot(env) {
    return {
      source: 'kodro-webmcp/1',
      world: readWorld(env),
      lesson: readLesson(env),
      robot: readRobot(env),
      program: readProgram(env),
      capabilities: TOOL_NAMES.slice(),
    };
  }

  function evidence(env) {
    var list = readReports(env);
    if (!list) return { ran: false, reason: 'no run reports recorded yet' };
    var latest = list[list.length - 1];
    if (!latest || typeof latest !== 'object') {
      return { ran: false, reason: 'latest run report unreadable' };
    }
    var out = pickScalars(latest);
    out.ran = true;
    return out;
  }

  function capabilities(env) {
    var win = env.window || {};
    var doc = env.document;
    var hasSelect = false;
    try {
      hasSelect = !!(doc && typeof doc.querySelector === 'function' && doc.querySelector('#lesson-select'));
    } catch (e) { hasSelect = false; }
    return {
      tools: TOOL_NAMES.slice(),
      stateChanges: 'none in this module version',
      bridges: {
        editor: typeof win.KODRO_LIVE_CODE === 'string',
        robot: typeof win.getKodroRobot === 'function',
        reports: !!(win.KodroRunReports && typeof win.KodroRunReports.list === 'function'),
        lessonSelect: hasSelect,
      },
    };
  }

  function safeExecute(fn, env) {
    return function () {
      try {
        var out = fn(env);
        var clean = jsonSafe(out);
        return clean === undefined ? { ok: false, reason: 'result not serializable' } : clean;
      } catch (e) {
        return { ok: false, reason: 'tool failed: ' + (e && e.message ? String(e.message).slice(0, 160) : 'unknown') };
      }
    };
  }

  function definitions(env) {
    return [
      {
        name: 'kodro_get_workspace',
        description: 'Read the live Kodro workspace: world prefs, selected lesson, robot spec, editor source, and tool list. Read-only; changes nothing.',
        inputSchema: EMPTY_SCHEMA,
        annotations: READ_ONLY,
        execute: safeExecute(snapshot, env),
      },
      {
        name: 'kodro_get_run_evidence',
        description: 'Read the latest deterministic run report (score, verdict, collisions, distance). Read-only; null fields mean no run yet, never a guess.',
        inputSchema: EMPTY_SCHEMA,
        annotations: READ_ONLY,
        execute: safeExecute(evidence, env),
      },
      {
        name: 'kodro_get_capabilities',
        description: 'List the site tools Kodro currently offers and which live bridges are present. Read-only.',
        inputSchema: EMPTY_SCHEMA,
        annotations: READ_ONLY,
        execute: safeExecute(capabilities, env),
      },
    ];
  }

  async function register(target, env) {
    var context = target && target.modelContext;
    if (!context || typeof context.registerTool !== 'function') {
      return { registered: 0, reason: 'site tools not supported' };
    }
    if (target.__kodroWebmcpRegistered) return { registered: 0, reason: 'already registered' };
    var e = env || {};
    var defs = definitions(e);
    var count = 0;
    for (var i = 0; i < defs.length; i++) {
      try {
        await context.registerTool(defs[i]);
        count += 1;
      } catch (err) { /* one rejected descriptor must not block the rest */ }
    }
    if (count > 0) {
      try { target.__kodroWebmcpRegistered = true; } catch (err) { /* frozen host: registration still stands */ }
    }
    return { registered: count };
  }

  var api = { register: register, tools: TOOL_NAMES.slice() };
  try {
    if (window) window.KodroWebMCP = api;
  } catch (e) { /* no host to attach to */ }

  // Auto-mount only where the official surface exists. Everywhere else this
  // file is inert and Kodro behaves exactly as before.
  try {
    if (typeof document !== 'undefined' && document && document.modelContext
      && typeof document.modelContext.registerTool === 'function') {
      var store = null;
      try { store = window.localStorage; } catch (e) { store = null; }
      register(
        { modelContext: document.modelContext },
        { window: window, document: document, localStorage: store },
      );
    }
  } catch (e) { /* unsupported host: stay silent, stay out of the way */ }
})(typeof window !== 'undefined' ? window : undefined);
