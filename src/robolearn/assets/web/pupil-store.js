/* On-device pupil register for the static (browser) build.
 *
 * The desktop app keeps pupil records + concept-strength in a Python SQLite
 * store (memory/store.py). The hosted browser build has no Python, so the
 * Teacher dashboard used to short-circuit to a "needs the desktop app" empty
 * state and nothing was ever recorded. This module gives the browser the same
 * register, persisted in localStorage, using the SAME concept-strength rule as
 * the desktop so a lesson's effect on mastery matches on both surfaces: an
 * exponential moving average with alpha = 0.3 over pass(1)/fail(0) samples
 * (mirrors store.py:396-446 update_concept_strength).
 *
 * Browser mode has no roster (bridge.js invents no pupils), so there is one
 * implicit on-device learner. Everything stays on this machine and nothing is
 * ever sent anywhere -- this file makes no network call. heatmap() returns
 * exactly the shape TeacherModal renders and the desktop get_class_heatmap()
 * produces: {ok, concepts:[...], pupils:[{id, name, active, scores:{concept: 0..1}}]}.
 *
 *   window.KodroPupilStore.record(concepts, passed)  // one graded attempt
 *   window.KodroPupilStore.heatmap()                 // -> dashboard model
 *   window.KodroPupilStore.reset()                   // clear the register
 */
(function () {
  'use strict';

  var KEY = 'kodro_pupils_v1';
  var ALPHA = 0.3;              // MUST match store.py update_concept_strength alpha
  var LEARNER_ID = 'local';
  var LEARNER_NAME = 'This device';

  function store() {
    // Injectable for the deterministic gate; the browser uses localStorage.
    return (window.KODRO_PROJECT_STORE || window.localStorage);
  }
  function now() { return Date.now(); }

  function load() {
    try {
      var raw = store().getItem(KEY);
      if (!raw) return { v: 1, pupils: [] };
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.pupils)) return { v: 1, pupils: [] };
      return data;
    } catch (e) { void e; return { v: 1, pupils: [] }; }
  }
  function save(data) {
    try { store().setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { void e; return false; }
  }
  function announce() {
    try { window.dispatchEvent(new CustomEvent('kodro-pupils')); } catch (e) { void e; }
  }

  function ensureLearner(data) {
    for (var i = 0; i < data.pupils.length; i++) {
      if (data.pupils[i] && data.pupils[i].id === LEARNER_ID) return data.pupils[i];
    }
    var p = { id: LEARNER_ID, name: LEARNER_NAME, created: now(), strengths: {} };
    data.pupils.push(p);
    return p;
  }

  // Record ONE graded attempt against its lesson's concept(s). EMA parity with
  // store.py: the first sample for a (learner, concept) sets the score verbatim;
  // later samples blend alpha*sample + (1 - alpha)*old. A convex combination of
  // 0/1 samples stays in [0,1] with no clamp. Records BOTH pass and fail --
  // mirroring the desktop update_on_submission, which runs on every graded
  // attempt, not only passes, so a struggled-with idea reads correctly as weak.
  function record(concepts, passed) {
    if (!Array.isArray(concepts) || concepts.length === 0) return null;
    var sample = passed ? 1.0 : 0.0;
    var data = load();
    var learner = ensureLearner(data);
    var t = now();
    for (var i = 0; i < concepts.length; i++) {
      var c = String(concepts[i] || '');
      if (!c) continue;
      var s = learner.strengths[c];
      if (!s) {
        learner.strengths[c] = {
          score: sample,
          successes: passed ? 1 : 0,
          failures: passed ? 0 : 1,
          lastSeen: t,
        };
      } else {
        s.score = ALPHA * sample + (1 - ALPHA) * s.score;
        s.successes += passed ? 1 : 0;
        s.failures += passed ? 0 : 1;
        s.lastSeen = t;
      }
    }
    // save() reports whether the write actually landed. Discarding it meant a
    // full or blocked store still fired 'kodro-pupils' and returned the
    // in-memory data, so the pupil saw a pass while the register stayed empty,
    // under copy promising "Concept strength updates after each graded lesson
    // attempt". Surface the failure the way the memory-import path already
    // does, and tell the caller.
    var stored = save(data);
    announce();
    if (!stored) {
      try {
        window.dispatchEvent(new CustomEvent('kodro-storage-failed', {
          detail: { what: 'concept progress', reason: 'storage is full or blocked' },
        }));
      } catch (e) { void e; }
    }
    data.stored = stored;
    return data;
  }

  // Same JSON shape as the desktop get_class_heatmap(): concepts is the sorted
  // union of every concept any pupil has touched; each pupil's scores map a
  // concept to its EMA (a missing concept means untouched, drawn as a blank
  // cell). ok:false when there is nothing to show, so the dashboard renders its
  // empty state instead of a header-only table.
  function heatmap() {
    var data = load();
    var conceptSet = {};
    var pupils = data.pupils.map(function (p) {
      var scores = {};
      var strengths = p.strengths || {};
      Object.keys(strengths).forEach(function (c) {
        conceptSet[c] = true;
        scores[c] = strengths[c].score;
      });
      return { id: p.id, name: p.name, active: true, scores: scores };
    });
    var concepts = Object.keys(conceptSet).sort();
    var hasData = concepts.length > 0 && pupils.length > 0;
    return { ok: hasData, concepts: concepts, pupils: hasData ? pupils : [] };
  }

  function reset() {
    save({ v: 1, pupils: [] });
    announce();
  }

  window.KodroPupilStore = {
    KEY: KEY,
    ALPHA: ALPHA,
    record: record,
    heatmap: heatmap,
    reset: reset,
    load: load,
    save: save,
  };
})();
