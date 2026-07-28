/* ============================================================================
   KODRO - the lesson document, its on-device store, and its file format.

   Kodro shipped 18 lessons and no way to write a nineteenth. A teacher who
   wanted an arena that matched what their class was doing that week, or a pupil
   who wanted to set a challenge for a friend, had nothing: the curriculum was
   whatever we had decided months earlier, baked into the bundle.

   This module is the data half of the Lesson Studio. It owns:
     - the .kodrolesson document shape and its validator,
     - the on-device library (localStorage) with honest failure reporting,
     - hydration, which hands each authored lesson to the grader.

   It is deliberately plain JS with no React and no JSX, for the same reason
   project.js and pupil-store.js are: it has to run inside a bare node vm with a
   fake localStorage so scripts/qa_lesson_studio.mjs can drive every branch,
   including the ones a browser will not reproduce on demand (a full disk, a
   corrupt record, a file from a stranger).

   THE ONE RULE THIS FILE EXISTS TO ENFORCE: an authored lesson is graded by
   exactly the same code as a shipped one. There is no second grading path, no
   "custom lesson" criterion dispatch, no relaxed scoring. The document is
   translated once, here, into the same entry shape lesson-grader.jsx generates
   from the YAML library, and from that point nothing downstream can tell the
   difference. A lesson this module cannot translate is refused with a reason
   rather than half-registered.

   Exposes window.KodroLessonStore.
   ========================================================================== */
(function () {
  'use strict';

  //: Bumped only when the on-disk shape changes incompatibly. The stamp is
  //: self-naming so a file dropped on the app is identifiable without a
  //: filename convention, matching kodroProject / kodroSpec.
  var VERSION = 1;
  var STORAGE_KEY = 'kodro_lessons_v1';
  //: Same cap as the robot spec importer (web/app.py _SPEC_MAX_BYTES). A
  //: lesson is a few kilobytes of text; anything approaching this is either a
  //: mistake or something that is not a lesson.
  var MAX_TEXT = 262144;
  //: Enough for a term of authored work, small enough that the library stays
  //: browsable and localStorage stays inside every browser's quota.
  var MAX_LESSONS = 40;
  var MAX_INTRO = 1200;
  var MAX_HINT = 400;
  var MAX_TITLE = 80;
  var MAX_CODE = 8000;

  //: Only worlds whose 3D renderer actually draws terrain.obstacles. `city`
  //: and `room` are skipped by that loop and build their own furniture, so an
  //: arena authored on them would have invisible-but-solid collision circles:
  //: the pupil would be stopped by nothing they can see. That is the exact
  //: class of defect this release was spent removing, so those worlds are not
  //: offered rather than offered with a caveat.
  var TERRAINS = ['earth', 'mars', 'underwater', 'space'];
  var KEY_STAGES = ['KS1', 'KS2', 'KS3', 'KS4'];
  var CT_CONCEPTS = [
    'sequence', 'selection', 'iteration', 'functions', 'decomposition',
    'abstraction', 'recursion', 'algorithmic_efficiency',
  ];
  //: The criterion keys lesson-grader.jsx's checkCriterion understands. Kept
  //: as data so the Studio form, the validator and the grader cannot drift:
  //: adding a criterion means adding it here and in both graders, and
  //: tests/unit/test_lesson_document.py pins this list against the pydantic
  //: SuccessCriterion model.
  var CRITERION_KEYS = [
    'samples_collected', 'no_collisions', 'max_battery_used', 'uses_construct',
    'calls_in_order', 'returns_to_base', 'max_steps', 'min_distance_travelled',
  ];
  var CONSTRUCTS = ['if', 'while', 'for', 'function_def', 'function_call', 'comparison', 'recursion', 'assignment'];
  var ID_RE = /^authored:[a-z0-9][a-z0-9-]{0,47}$/;

  // The injectable storage seam every other store in this codebase uses, so the
  // QA gate can hand in a shim that refuses writes and assert we say so.
  function store() {
    return (window.KODRO_PROJECT_STORE || window.localStorage);
  }

  function isFiniteNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  // FNV-1a, the same hash scenario.jsx uses for code fingerprints. Two people
  // authoring "Crater hop" on different machines must not collide when they
  // swap files, and a random id would change every time the same lesson was
  // re-saved.
  function hashHex(str) {
    var h = 2166136261;
    for (var i = 0; i < String(str).length; i++) {
      h ^= String(str).charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  function slug(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'lesson';
  }

  // A stable id derived from the title plus a salt the caller supplies (the
  // creation time). Same title twice on the same device gives two ids, because
  // the salt differs; the same document copied between devices keeps its id, so
  // re-importing it updates rather than duplicates.
  function makeId(title, salt) {
    return 'authored:' + slug(title) + '-' + hashHex(String(title) + '|' + String(salt));
  }

  // --- validation ---------------------------------------------------------
  //
  // Never throws. Returns {ok, errors, warnings}. Errors refuse the document;
  // warnings are things we corrected or dropped and the user should be told
  // about, because silently changing someone's lesson is its own kind of lie.
  function validate(doc) {
    var errors = [];
    var warnings = [];
    var push = function (m) { errors.push(m); };

    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
      return { ok: false, errors: ['That file does not contain a lesson.'], warnings: warnings };
    }
    if (doc.kodroLesson !== VERSION) {
      return {
        ok: false,
        warnings: warnings,
        errors: [doc.kodroLesson === undefined
          ? 'That file is not a Kodro lesson.'
          : 'That lesson was made by a different version of Kodro (file version '
            + String(doc.kodroLesson) + ', this build reads ' + VERSION + ').'],
      };
    }
    if (typeof doc.id !== 'string' || !ID_RE.test(doc.id)) {
      push('Lesson id must look like "authored:my-lesson-1a2b3c4d".');
    } else {
      var G = window.KodroLessonGrader;
      if (G && G.LESSON_DATA && Object.prototype.hasOwnProperty.call(G.LESSON_DATA, doc.id)) {
        push('That id belongs to one of the built-in lessons.');
      }
    }
    if (typeof doc.title !== 'string' || !doc.title.trim()) push('The lesson needs a title.');
    else if (doc.title.length > MAX_TITLE) push('The title is longer than ' + MAX_TITLE + ' characters.');
    if (KEY_STAGES.indexOf(doc.keyStage) < 0) push('Key stage must be one of ' + KEY_STAGES.join(', ') + '.');
    if (!Array.isArray(doc.concepts) || doc.concepts.length === 0) {
      push('Choose the main computing concept this lesson teaches.');
    } else if (doc.concepts.some(function (c) { return CT_CONCEPTS.indexOf(c) < 0; })) {
      push('Computing concepts must be one of ' + CT_CONCEPTS.join(', ') + '.');
    }
    if (TERRAINS.indexOf(doc.terrain) < 0) {
      push('World must be one of ' + TERRAINS.join(', ') + '. The city and indoor worlds draw their own scenery, so an arena placed there would have obstacles the pupil cannot see.');
    }
    if (typeof doc.intro !== 'string' || !doc.intro.trim()) push('The lesson needs an introduction telling the pupil what to do.');
    else if (doc.intro.length > MAX_INTRO) push('The introduction is longer than ' + MAX_INTRO + ' characters.');
    if (typeof doc.starterCode !== 'string' || !doc.starterCode.trim()) push('The lesson needs a starter program.');
    else if (doc.starterCode.length > MAX_CODE) push('The starter program is too long.');
    if (doc.solutionCode !== undefined && doc.solutionCode !== null
      && (typeof doc.solutionCode !== 'string' || doc.solutionCode.length > MAX_CODE)) {
      push('The worked solution is not valid text.');
    }

    // --- world ---
    var w = doc.world;
    if (!w || typeof w !== 'object') push('The lesson needs a world.');
    else {
      var width = Number(w.width), height = Number(w.height);
      if (!(width >= 2 && width <= 40)) push('World width must be between 2 and 40 metres.');
      if (!(height >= 2 && height <= 40)) push('World height must be between 2 and 40 metres.');
      var base = w.base;
      if (!Array.isArray(base) || base.length !== 2 || !isFiniteNum(Number(base[0])) || !isFiniteNum(Number(base[1]))) {
        push('The base must be a point [x, y] in metres.');
      } else if (Number(base[0]) < 0 || Number(base[0]) > width || Number(base[1]) < 0 || Number(base[1]) > height) {
        push('The base is outside the arena.');
      }
      var inside = function (x, y) {
        return isFiniteNum(x) && isFiniteNum(y) && x >= 0 && x <= width && y >= 0 && y <= height;
      };
      var samples = Array.isArray(w.samples) ? w.samples : [];
      for (var i = 0; i < samples.length; i++) {
        var s = samples[i];
        if (!Array.isArray(s) || s.length !== 2 || !inside(Number(s[0]), Number(s[1]))) {
          push('Sample ' + (i + 1) + ' is outside the arena.');
          continue;
        }
        for (var si = 0; si < i; si++) {
          var earlier = samples[si];
          if (Array.isArray(earlier)
            && Math.hypot(Number(s[0]) - Number(earlier[0]), Number(s[1]) - Number(earlier[1])) < 0.2) {
            push('Sample ' + (i + 1) + ' is on top of sample ' + (si + 1) + '. Move one so pupils can tell them apart.');
          }
        }
      }
      if (samples.length > 12) push('A lesson can have at most 12 samples.');
      var obstacles = Array.isArray(w.obstacles) ? w.obstacles : [];
      for (var j = 0; j < obstacles.length; j++) {
        var o = obstacles[j] || {};
        var ox = Number(o.x), oy = Number(o.y), orad = Number(o.r);
        if (!inside(ox, oy)) push('Rock ' + (j + 1) + ' is outside the arena.');
        if (!(orad > 0 && orad <= 3)) {
          push('Rock ' + (j + 1) + ' needs a radius between 0 and 3 metres.');
        } else if (inside(ox, oy) && (ox - orad < 0 || ox + orad > width || oy - orad < 0 || oy + orad > height)) {
          push('Rock ' + (j + 1) + ' crosses the arena wall. Move it inward or make it smaller.');
        }
      }
      if (obstacles.length > 24) push('A lesson can have at most 24 rocks.');
      // A rock sitting on the start point means the rover begins inside an
      // obstacle, which is not a hard lesson, it is a broken one.
      if (Array.isArray(base)) {
        for (var k = 0; k < obstacles.length; k++) {
          var ob = obstacles[k] || {};
          var d = Math.sqrt(Math.pow(Number(ob.x) - Number(base[0]), 2) + Math.pow(Number(ob.y) - Number(base[1]), 2));
          if (d < Number(ob.r) + 0.35) push('Rock ' + (k + 1) + ' is on top of the base, so the rover would start inside it.');
        }
      }
      // A sample inside a rock is visible but unreachable: collision stops the
      // rover before collect_sample() can get close enough. Refuse the arena
      // instead of letting a correct pupil program fail forever.
      for (var smi = 0; smi < samples.length; smi++) {
        var sample = samples[smi];
        if (!Array.isArray(sample)) continue;
        for (var obi = 0; obi < obstacles.length; obi++) {
          var rock = obstacles[obi] || {};
          var gap = Math.hypot(Number(sample[0]) - Number(rock.x), Number(sample[1]) - Number(rock.y));
          if (isFiniteNum(gap) && gap < Number(rock.r) + 0.2) {
            push('Sample ' + (smi + 1) + ' is inside rock ' + (obi + 1) + ', so the rover cannot collect it.');
          }
        }
      }
    }

    // --- criteria ---
    var criteria = doc.criteria;
    if (!Array.isArray(criteria) || criteria.length === 0) {
      push('The lesson needs at least one goal, or every program passes it.');
    } else {
      if (criteria.length > 8) push('A lesson can have at most 8 goals.');
      var seenCriteria = {};
      for (var c = 0; c < criteria.length; c++) {
        var cr = criteria[c];
        if (!cr || typeof cr !== 'object') { push('Goal ' + (c + 1) + ' is not valid.'); continue; }
        var keys = Object.keys(cr);
        if (keys.length !== 1) { push('Goal ' + (c + 1) + ' must set exactly one thing.'); continue; }
        var key = keys[0];
        if (CRITERION_KEYS.indexOf(key) < 0) { push('Goal ' + (c + 1) + ' uses an unknown rule "' + key + '".'); continue; }
        if (seenCriteria[key]) warnings.push('Goal ' + (c + 1) + ' repeats "' + key + '". Keep one value so the pupil sees one clear rule.');
        seenCriteria[key] = true;
        var val = cr[key];
        if (key === 'uses_construct' && CONSTRUCTS.indexOf(val) < 0) {
          push('Goal ' + (c + 1) + ' asks for an unknown construct "' + String(val) + '".');
        }
        if (key === 'calls_in_order' && (!Array.isArray(val) || !val.length || !val.every(function (n) { return typeof n === 'string' && n; }))) {
          push('Goal ' + (c + 1) + ' needs a list of function names.');
        }
        if ((key === 'samples_collected' || key === 'max_steps') && !(Number(val) >= 0)) {
          push('Goal ' + (c + 1) + ' needs a number of 0 or more.');
        }
        if ((key === 'max_battery_used' || key === 'min_distance_travelled') && !(Number(val) >= 0)) {
          push('Goal ' + (c + 1) + ' needs a distance or percentage of 0 or more.');
        }
        if ((key === 'no_collisions' || key === 'returns_to_base') && val !== true) {
          push('Goal ' + (c + 1) + ' must be switched on or removed.');
        }
      }
      // A samples_collected goal larger than the number of samples placed can
      // never be met. The pupil would fail forever with a correct program.
      var need = null;
      for (var n = 0; n < criteria.length; n++) {
        if (criteria[n] && criteria[n].samples_collected !== undefined) need = Number(criteria[n].samples_collected);
      }
      var have = (doc.world && Array.isArray(doc.world.samples)) ? doc.world.samples.length : 0;
      if (need !== null && need > have) {
        push('The goal asks for ' + need + ' sample' + (need === 1 ? '' : 's') + ' but the arena only has ' + have + '.');
      }
    }

    // --- hints ---
    var hints = doc.hints || {};
    ['onFailure', 'onSuccess'].forEach(function (bank) {
      var arr = hints[bank];
      if (arr === undefined) return;
      if (!Array.isArray(arr)) { push('Hints must be a list.'); return; }
      if (arr.length > 6) push('At most 6 hints per bank.');
      arr.forEach(function (h) {
        if (typeof h !== 'string' || h.length > MAX_HINT) push('Each hint must be text under ' + MAX_HINT + ' characters.');
      });
    });
    if (!Array.isArray(hints.onFailure) || hints.onFailure.length === 0) {
      warnings.push('This lesson has no hints. A pupil who gets stuck will have nothing to fall back on.');
    }

    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  // --- translation --------------------------------------------------------

  // The grader half of the document: exactly the shape lesson-grader.jsx's
  // generated LESSON_DATA entries have. Nothing here is Studio-specific.
  function toEntry(doc) {
    return {
      world: {
        base: [Number(doc.world.base[0]), Number(doc.world.base[1])],
        samples: (doc.world.samples || []).map(function (s) { return [Number(s[0]), Number(s[1])]; }),
        obstacles: (doc.world.obstacles || []).map(function (o) {
          return { x: Number(o.x), y: Number(o.y), r: Number(o.r) };
        }),
        width: Number(doc.world.width),
        height: Number(doc.world.height),
      },
      criteria: (doc.criteria || []).slice(),
      hints: {
        onFailure: ((doc.hints || {}).onFailure || []).slice(),
        onSuccess: ((doc.hints || {}).onSuccess || []).slice(),
      },
    };
  }

  // The UI half: the same ten camelCase keys BridgeAPI._lesson_to_dict emits,
  // so an authored lesson is indistinguishable from a shipped one to every
  // component that renders a lesson, plus the two the Studio adds.
  function toRow(doc) {
    return {
      id: doc.id,
      title: doc.title,
      keyStage: doc.keyStage,
      concepts: (doc.concepts || []).slice(),
      prereqs: (doc.prereqs || []).slice(),
      intro: doc.intro,
      starterCode: doc.starterCode,
      solutionCode: doc.solutionCode || null,
      terrain: doc.terrain,
      maxLines: Number(doc.maxLines) || 40,
      readingAge: doc.readingAge === undefined ? null : doc.readingAge,
      glossary: doc.glossary || {},
      // The two extra keys. `authored` drives the "Made here" badge, so a
      // pupil always knows whether a lesson came from the curriculum or from
      // someone in the room.
      authored: true,
      savedAt: doc.savedAt || 0,
    };
  }

  // --- on-device library --------------------------------------------------

  function readAll() {
    var raw;
    try {
      raw = store().getItem(STORAGE_KEY);
    } catch (e) {
      return [];
    }
    if (!raw) return [];
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // A corrupt record is not recoverable and is not the user's fault to
      // debug. Report empty rather than throwing on every render; the next
      // save overwrites it.
      return [];
    }
    if (!parsed || !Array.isArray(parsed.lessons)) return [];
    return parsed.lessons;
  }

  function writeAll(lessons) {
    try {
      store().setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, lessons: lessons }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function list() {
    return readAll();
  }

  function get(id) {
    var all = readAll();
    for (var i = 0; i < all.length; i++) if (all[i] && all[i].id === id) return all[i];
    return null;
  }

  // Save one lesson. Validates first, then writes, then registers with the
  // grader. Returns {ok, errors, warnings}. A storage failure is reported, not
  // swallowed: this is the user's own work and losing it quietly is the worst
  // thing this feature could do.
  function save(doc) {
    var v = validate(doc);
    if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings };
    var all = readAll();
    var idx = -1;
    for (var i = 0; i < all.length; i++) if (all[i] && all[i].id === doc.id) idx = i;
    if (idx < 0 && all.length >= MAX_LESSONS) {
      return { ok: false, errors: ['You already have ' + MAX_LESSONS + ' lessons on this device. Delete one first.'], warnings: v.warnings };
    }
    var stamped = JSON.parse(JSON.stringify(doc));
    stamped.savedAt = doc.savedAt || nowMs();
    if (idx < 0) all.push(stamped); else all[idx] = stamped;
    if (!writeAll(all)) {
      return {
        ok: false,
        errors: ['This device would not store the lesson. Its storage may be full or blocked. Export it to a file so your work is not lost.'],
        warnings: v.warnings,
      };
    }
    var reg = registerOne(stamped);
    if (!reg.ok) {
      // Written but ungradable is the two-table split this whole design exists
      // to prevent, so undo the write rather than leave a lesson that opens and
      // then cannot be marked.
      all.splice(idx < 0 ? all.length - 1 : idx, 1);
      writeAll(all);
      return { ok: false, errors: reg.errors, warnings: v.warnings };
    }
    return { ok: true, errors: [], warnings: v.warnings, id: stamped.id };
  }

  function remove(id) {
    var all = readAll();
    var kept = all.filter(function (l) { return l && l.id !== id; });
    if (kept.length === all.length) return false;
    if (!writeAll(kept)) return false;
    var G = window.KodroLessonGrader;
    if (G && G.unregisterAuthored) G.unregisterAuthored(id);
    return true;
  }

  function registerOne(doc) {
    var G = window.KodroLessonGrader;
    if (!G || !G.registerAuthored) return { ok: false, errors: ['The grader is not loaded.'] };
    return G.registerAuthored(doc.id, toEntry(doc));
  }

  // Hand every stored lesson to the grader. Called once at start-up. A record
  // the grader refuses is skipped rather than half-registered, and reported, so
  // it can never become a lesson that opens but cannot be marked.
  function hydrate() {
    var all = readAll();
    var ok = [], bad = [];
    for (var i = 0; i < all.length; i++) {
      var doc = all[i];
      if (!doc || !doc.id) continue;
      var v = validate(doc);
      if (!v.ok) { bad.push({ id: doc.id, errors: v.errors }); continue; }
      var r = registerOne(doc);
      if (r.ok) ok.push(doc.id); else bad.push({ id: doc.id, errors: r.errors });
    }
    return { registered: ok, rejected: bad };
  }

  // --- file in, file out --------------------------------------------------

  function serialize(doc) {
    return JSON.stringify(doc, null, 2) + '\n';
  }

  function fileName(doc) {
    return slug(doc && doc.title) + '.kodrolesson';
  }

  // Parse a file someone sent. Returns {ok, doc, errors, warnings}. Unknown
  // top-level keys are dropped and reported rather than trusted, because the
  // document is rebuilt field by field from a whitelist (the project.js rule).
  function parse(text) {
    if (typeof text !== 'string') return { ok: false, errors: ['Nothing to read.'], warnings: [] };
    if (text.length > MAX_TEXT) return { ok: false, errors: ['That file is larger than 256 KB, so it is not a lesson.'], warnings: [] };
    var raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return { ok: false, errors: ['That file is not readable as a lesson (it is not valid JSON).'], warnings: [] };
    }
    var KEEP = ['kodroLesson', 'savedAt', 'id', 'title', 'keyStage', 'concepts', 'prereqs', 'terrain',
      'intro', 'starterCode', 'solutionCode', 'readingAge', 'glossary', 'maxLines',
      'world', 'criteria', 'hints'];
    var doc = {}, dropped = [];
    Object.keys(raw || {}).forEach(function (k) {
      if (KEEP.indexOf(k) >= 0) doc[k] = raw[k]; else dropped.push(k);
    });
    var v = validate(doc);
    var warnings = v.warnings.slice();
    if (dropped.length) warnings.push('Ignored unrecognised field(s): ' + dropped.join(', ') + '.');
    if (!v.ok) return { ok: false, errors: v.errors, warnings: warnings };
    return { ok: true, doc: doc, errors: [], warnings: warnings };
  }

  // A fresh document with everything filled in, so the Studio opens on
  // something that already works rather than an empty form. This default is
  // itself a valid, passable lesson.
  function blank(salt) {
    var title = 'My lesson';
    return {
      kodroLesson: VERSION,
      savedAt: 0,
      id: makeId(title, salt === undefined ? nowMs() : salt),
      title: title,
      keyStage: 'KS2',
      concepts: ['sequence'],
      prereqs: [],
      terrain: 'earth',
      intro: 'Drive the rover to the flag and pick up the sample.',
      starterCode: 'move_forward(1)\n',
      solutionCode: 'move_forward(3)\ncollect_sample()\n',
      readingAge: null,
      glossary: {},
      maxLines: 40,
      world: {
        base: [1, 1],
        samples: [[4, 1]],
        obstacles: [],
        width: 8,
        height: 8,
      },
      criteria: [{ samples_collected: 1 }, { no_collisions: true }],
      hints: {
        onFailure: ['Drive forward until the rover is on the flag, then call collect_sample().'],
        onSuccess: [],
      },
    };
  }

  // Date.now via an indirection so the QA gate can pin it and assert
  // deterministic ids without patching the global.
  function nowMs() {
    return (window.KODRO_NOW ? window.KODRO_NOW() : Date.now());
  }

  // --- lesson packs ------------------------------------------------------
  //
  // One lesson per file is right for sharing a single idea and wrong for
  // sharing a term of work. A teacher who has built six lessons for a half term
  // should send one file, not six, and the colleague who receives it should get
  // all six or a clear account of which ones were refused and why.
  //
  // A pack is deliberately just a list of the same documents, with the same
  // validator applied to each. There is no pack-specific lesson format, so a
  // lesson cannot be valid inside a pack and invalid outside it.
  var PACK_VERSION = 1;
  //: A pack has to stay inside the same 256 KB ceiling as everything else the
  //: app reads from disk, so the cap is on the FILE, and the per-lesson count is
  //: capped separately so one pack cannot fill the whole device library.
  var MAX_PACK_LESSONS = 40;

  function packSerialize(name, docs) {
    return JSON.stringify({
      kodroPack: PACK_VERSION,
      name: String(name || 'Kodro lessons'),
      savedAt: nowMs(),
      lessons: docs,
    }, null, 2) + '\n';
  }

  function packFileName(name) {
    return slug(name || 'kodro-lessons') + '.kodropack';
  }

  // Read a pack file. Returns {ok, name, accepted:[doc], rejected:[{title,errors}],
  // warnings}. A pack with some bad lessons is NOT rejected wholesale: the good
  // ones are offered and the bad ones are named, because throwing away five
  // working lessons over one broken one helps nobody.
  function packParse(text) {
    if (typeof text !== 'string') return { ok: false, errors: ['Nothing to read.'], accepted: [], rejected: [], warnings: [] };
    if (text.length > MAX_TEXT) return { ok: false, errors: ['That file is larger than 256 KB.'], accepted: [], rejected: [], warnings: [] };
    var raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return { ok: false, errors: ['That file is not readable (it is not valid JSON).'], accepted: [], rejected: [], warnings: [] };
    }
    if (!raw || raw.kodroPack !== PACK_VERSION) {
      return {
        ok: false, accepted: [], rejected: [], warnings: [],
        errors: [raw && raw.kodroLesson
          ? 'That is a single lesson, not a pack. Use "Open a lesson file" instead.'
          : 'That file is not a Kodro lesson pack.'],
      };
    }
    if (!Array.isArray(raw.lessons) || raw.lessons.length === 0) {
      return { ok: false, errors: ['That pack contains no lessons.'], accepted: [], rejected: [], warnings: [] };
    }
    var accepted = [], rejected = [], warnings = [];
    for (var i = 0; i < raw.lessons.length; i++) {
      if (accepted.length >= MAX_PACK_LESSONS) {
        warnings.push('The pack held more than ' + MAX_PACK_LESSONS + ' lessons; the rest were not read.');
        break;
      }
      // Route every lesson through the SAME parser a single file uses, so an
      // unknown field is dropped and reported here exactly as it would be there.
      var one = parse(JSON.stringify(raw.lessons[i]));
      if (one.ok) { accepted.push(one.doc); one.warnings.forEach(function (w) { warnings.push(w); }); }
      else rejected.push({ title: (raw.lessons[i] && raw.lessons[i].title) || 'lesson ' + (i + 1), errors: one.errors });
    }
    return {
      ok: accepted.length > 0,
      name: String(raw.name || 'Kodro lessons'),
      accepted: accepted, rejected: rejected, warnings: warnings,
      errors: accepted.length ? [] : ['None of the lessons in that pack could be read.'],
    };
  }

  // Save every accepted lesson from a pack. Returns a per-lesson outcome rather
  // than one boolean, because "it half worked" is the likely case (a name
  // collision, a full device) and the teacher needs to know which ones landed.
  function packInstall(docs) {
    var saved = [], failed = [];
    for (var i = 0; i < docs.length; i++) {
      var r = save(docs[i]);
      if (r.ok) saved.push(docs[i].title);
      else failed.push({ title: docs[i].title, errors: r.errors });
    }
    return { saved: saved, failed: failed };
  }

  window.KodroLessonStore = {
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY,
    MAX_LESSONS: MAX_LESSONS,
    TERRAINS: TERRAINS,
    KEY_STAGES: KEY_STAGES,
    CT_CONCEPTS: CT_CONCEPTS,
    CRITERION_KEYS: CRITERION_KEYS,
    CONSTRUCTS: CONSTRUCTS,
    validate: validate,
    toEntry: toEntry,
    toRow: toRow,
    list: list,
    get: get,
    save: save,
    remove: remove,
    hydrate: hydrate,
    serialize: serialize,
    fileName: fileName,
    parse: parse,
    blank: blank,
    makeId: makeId,
    PACK_VERSION: PACK_VERSION,
    MAX_PACK_LESSONS: MAX_PACK_LESSONS,
    packSerialize: packSerialize,
    packFileName: packFileName,
    packParse: packParse,
    packInstall: packInstall,
  };
})();
