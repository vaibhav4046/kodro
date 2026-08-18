/* ============================================================================
   KODRO - the teacher's markbook, as a file a school actually uses.

   Kodro's most defensible feature is that a lesson result is trustworthy: it
   was marked on the run the pupil watched, against criteria stated in advance,
   by an engine that is gated on every change. And then that result died on the
   pupil's device. A head of computing could watch a class earn evidence all
   lesson and have nothing to put in front of a book scrutiny, an SLT data drop
   or a moderation meeting, because there was no way to get the marks OUT.

   This module turns the on-device records into CSV, because CSV is the only
   format every school system already accepts: SIMS, Arbor, Excel, Google
   Sheets, a paper printout. No new format, no viewer, no account.

   Two exports, deliberately separate files because they answer different
   questions:

     markbookCsv(lessons)  - pupil x lesson: passed, score, attempts, when.
                             "Who has finished what?"
     strengthsCsv()        - pupil x concept: the register's mastery estimate.
                             "Who needs help with which idea?"

   The strengths figures are the pupil-store's EMA estimates and are labelled
   as practice signals in the dashboard that shows them; the CSV carries the
   same numbers and the teacher guide's caveat stands: practice feedback, not
   assessment evidence.

   Plain JS, no React, storage via the same injectable seam every other store
   uses, so scripts/qa_markbook.mjs drives every branch in a bare vm.
   Exposes window.KodroMarkbook.
   ========================================================================== */
(function () {
  'use strict';

  function store() {
    return (window.KODRO_PROJECT_STORE || window.localStorage);
  }

  function readJson(key) {
    var raw;
    try {
      raw = store().getItem(key);
    } catch (e) {
      return null;
    }
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  // RFC 4180 field escaping: quote when the value contains a comma, a quote or
  // a line break, and double any quotes inside. Excel and Sheets both read
  // this; hand-rolled "join with commas and hope" breaks on the first pupil
  // named O'Brien, Jr.
  function csvField(v) {
    var s = String(v === null || v === undefined ? '' : v);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function csvLine(fields) {
    var out = [];
    for (var i = 0; i < fields.length; i++) out.push(csvField(fields[i]));
    return out.join(',');
  }

  // Every pupil the register knows, plus the anonymous legacy record when it
  // exists, so marks earned before pupils were introduced are not silently
  // dropped from the export.
  function pupilList() {
    var reg = readJson('kodro_pupils_v1');
    var pupils = (reg && Array.isArray(reg.pupils)) ? reg.pupils.slice() : [];
    var legacy = readJson('or_lesson_results');
    if (legacy && Object.keys(legacy).length
      && !pupils.some(function (p) { return p && p.id === '__legacy__'; })) {
      pupils.push({ id: '__legacy__', name: 'Unassigned (before pupils)', strengths: {} });
    }
    return pupils;
  }

  function resultsFor(pupilId) {
    if (pupilId === '__legacy__') return readJson('or_lesson_results') || {};
    return readJson('or_lesson_results__' + pupilId) || {};
  }

  /**
   * The markbook: one row per pupil per attempted lesson.
   *
   * `lessons` is the runtime lesson list (id, title, keyStage), used for the
   * human columns; a result for a lesson that no longer exists still exports,
   * with its id standing in for the title, because a teacher's evidence must
   * not vanish when a lesson is renamed or deleted.
   *
   * Returns null when there is nothing at all to export, so the caller can say
   * so instead of downloading an empty file.
   */
  function markbookCsv(lessons) {
    var byId = {};
    (lessons || []).forEach(function (l) { if (l && l.id) byId[l.id] = l; });
    var lines = [csvLine(['Pupil', 'Lesson id', 'Lesson title', 'Key stage',
      'Passed', 'Score', 'Attempts', 'Last attempt'])];
    var rows = 0;
    pupilList().forEach(function (p) {
      var results = resultsFor(p.id);
      Object.keys(results).sort().forEach(function (lessonId) {
        var r = results[lessonId];
        if (!r || typeof r !== 'object') return;
        var lesson = byId[lessonId];
        var when = '';
        if (typeof r.updatedAt === 'number' && isFinite(r.updatedAt)) {
          try { when = new Date(r.updatedAt).toISOString(); } catch (e) { when = ''; }
        }
        lines.push(csvLine([
          p.name || p.id,
          lessonId,
          lesson ? lesson.title : lessonId,
          lesson ? (lesson.keyStage || '') : '',
          r.passed ? 'yes' : 'no',
          typeof r.score === 'number' ? r.score : '',
          typeof r.attempts === 'number' ? r.attempts : '',
          when,
        ]));
        rows++;
      });
    });
    return rows === 0 ? null : lines.join('\r\n') + '\r\n';
  }

  /**
   * Concept strengths: one row per pupil, one column per concept seen anywhere
   * in the register, as whole percentages. The union of concepts is computed
   * from the data rather than hardcoded, so a new lesson concept appears in
   * the export without this file changing.
   */
  function strengthsCsv() {
    var pupils = pupilList().filter(function (p) { return p.id !== '__legacy__'; });
    if (!pupils.length) return null;
    var concepts = {};
    pupils.forEach(function (p) {
      Object.keys(p.strengths || {}).forEach(function (c) { concepts[c] = true; });
    });
    var conceptList = Object.keys(concepts).sort();
    if (!conceptList.length) return null;
    var lines = [csvLine(['Pupil'].concat(conceptList.map(function (c) { return c + ' (%)'; })))];
    pupils.forEach(function (p) {
      var row = [p.name || p.id];
      conceptList.forEach(function (c) {
        var s = (p.strengths || {})[c];
        row.push(s && typeof s.score === 'number' ? Math.round(s.score * 100) : '');
      });
      lines.push(csvLine(row));
    });
    return lines.join('\r\n') + '\r\n';
  }

  window.KodroMarkbook = {
    markbookCsv: markbookCsv,
    strengthsCsv: strengthsCsv,
    csvField: csvField,
  };
})();
