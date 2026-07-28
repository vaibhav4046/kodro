/* ============================================================================
   KODRO - Lesson Studio: make your own lesson.

   Kodro shipped 18 lessons and no way to write a nineteenth. A teacher whose
   class was doing something specific that week had to use ours or nothing, and
   a pupil who wanted to set a challenge for a friend had no way to.

   This is the authoring surface. The data half (document shape, validator,
   on-device store, file format) lives in lesson-studio.js; this file is only
   the form and the map.

   Two decisions worth stating, because they are the reason this is not just a
   JSON editor with a nicer font:

   1. YOU CANNOT SAVE A LESSON YOU HAVE NOT SOLVED. The Check button runs your
      worked answer through the same grader a pupil will be marked by, and Save
      stays disabled until it passes. Every one of the 18 built-in lessons is
      held to exactly this standard by a test; it would be strange to hold a
      teacher's lesson to a lower one. A lesson whose own answer fails is a
      lesson that sends a child in circles.

   2. YOU PLACE THINGS BY CLICKING. Typing coordinates into a form and hoping
      is how you get a rock sitting on the start point and a sample outside the
      wall. The map below is the arena, to scale, and the thing you click is
      the thing the grader marks.

   Exposes window.KodroLessonStudio.
   ========================================================================== */
(function () {
  'use strict';

  var e = React.createElement;

  // Arena metres -> preview pixels. The map is square-ish and scales to fit
  // whatever arena the author sets, so a 6 m room and a 40 m field both fill it.
  var MAP_PX = 320;

  // The goals a lesson can set, in the order they read most naturally to
  // someone building a lesson rather than in the order the grader checks them.
  // `unit` and `hint` exist so the form can explain itself without a manual.
  var GOAL_KINDS = [
    { key: 'samples_collected', label: 'Collect samples', kind: 'int', dflt: 1, unit: 'samples', hint: 'How many of the flags the rover must pick up.' },
    { key: 'returns_to_base', label: 'Come back to base', kind: 'bool', dflt: true, unit: '', hint: 'The rover must finish where it started.' },
    { key: 'no_collisions', label: 'Do not hit anything', kind: 'bool', dflt: true, unit: '', hint: 'Touching a rock or a wall fails the lesson.' },
    { key: 'min_distance_travelled', label: 'Travel at least', kind: 'num', dflt: 3, unit: 'metres', hint: 'Useful when there is nothing to collect.' },
    { key: 'uses_construct', label: 'Use a', kind: 'construct', dflt: 'if', unit: '', hint: 'Forces the pupil to solve it the way you are teaching, not by guessing a route.' },
    { key: 'calls_in_order', label: 'Call these in order', kind: 'list', dflt: ['move_forward'], unit: '', hint: 'For lessons about sequence. Other calls may appear in between.' },
    { key: 'max_battery_used', label: 'Limit battery use to', kind: 'num', dflt: 30, unit: '% battery', hint: 'Rewards a shorter route.' },
    { key: 'max_steps', label: 'Limit program to', kind: 'int', dflt: 40, unit: 'commands', hint: 'Rewards a loop over a long list of moves.' },
  ];

  var CONSTRUCT_LABEL = {
    if: 'an if statement', while: 'a while loop', for: 'a for loop',
    function_def: 'a function', function_call: 'a function call',
    comparison: 'a comparison', recursion: 'recursion', assignment: 'a variable',
  };

  var WORLD_LABEL = { earth: 'Earth', mars: 'Mars', underwater: 'Underwater', space: 'Space' };
  var CONCEPT_LABEL = {
    sequence: 'Sequence', selection: 'Selection (if / else)', iteration: 'Loops and iteration',
    functions: 'Functions', decomposition: 'Decomposition', abstraction: 'Abstraction',
    recursion: 'Recursion', algorithmic_efficiency: 'Algorithmic efficiency',
  };

  function num(v, dflt) {
    var n = parseFloat(v);
    return isFinite(n) ? n : dflt;
  }

  // Round to the nearest 0.5 m. Placing by hand should give tidy numbers a
  // pupil can reason about, not 3.847 metres.
  function snap(v) {
    return Math.round(v * 2) / 2;
  }

  function LessonStudio(props) {
    var Store = window.KodroLessonStore;
    var Grader = window.KodroLessonGrader;

    var initial = props.doc || Store.blank(Date.now());
    var state = React.useState(initial);
    var doc = state[0], setDoc = state[1];
    // 'base' | 'sample' | 'rock' | null. Null means clicking the map does
    // nothing, which is the resting state so a stray click cannot move the base.
    var toolState = React.useState(null);
    var tool = toolState[0], setTool = toolState[1];
    var checkState = React.useState(null);
    var checked = checkState[0], setChecked = checkState[1];
    var msgState = React.useState(null);
    var msg = msgState[0], setMsg = msgState[1];
    // The selected marker is edited numerically below the map. Clicking is
    // fast; the inspector makes the exact position and radius visible and
    // editable instead of forcing a teacher to repeatedly undo and re-place.
    var selectedState = React.useState(null);
    var selected = selectedState[0], setSelected = selectedState[1];

    var w = doc.world;
    var scale = MAP_PX / Math.max(w.width, w.height);
    var liveValidation = Store.validate(doc);

    // Any edit invalidates the last check: a lesson proved solvable before you
    // moved the rock is not proved solvable now.
    function patch(next) {
      setChecked(null);
      setMsg(null);
      setDoc(next);
    }
    function patchWorld(nextWorld) {
      patch(Object.assign({}, doc, { world: Object.assign({}, doc.world, nextWorld) }));
    }

    function mapClick(ev) {
      if (!tool) return;
      var box = ev.currentTarget.getBoundingClientRect();
      var mx = snap(((ev.clientX - box.left) / box.width) * w.width);
      var my = snap(w.height - ((ev.clientY - box.top) / box.height) * w.height);
      mx = Math.max(0, Math.min(w.width, mx));
      my = Math.max(0, Math.min(w.height, my));
      if (tool === 'base') patchWorld({ base: [mx, my] });
      else if (tool === 'sample') patchWorld({ samples: (w.samples || []).concat([[mx, my]]) });
      else if (tool === 'rock') patchWorld({ obstacles: (w.obstacles || []).concat([{ x: mx, y: my, r: 0.5 }]) });
    }

    // Metres -> SVG pixels. y is flipped because the arena's origin is bottom
    // left (as the pupil's coordinates read) and SVG's is top left.
    function px(mx, my) {
      return { cx: mx * scale, cy: (w.height - my) * scale };
    }

    function selectFromKey(ev, value) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      setSelected(value);
    }

    // Run the author's own worked answer through the grader a pupil will face.
    // This is the gate on Save.
    function runCheck() {
      var v = Store.validate(doc);
      if (!v.ok) {
        setChecked({ ok: false, reasons: v.errors, stage: 'form' });
        return;
      }
      if (!doc.solutionCode || !doc.solutionCode.trim()) {
        setChecked({ ok: false, stage: 'form', reasons: ['Write a worked answer, so we can check the lesson can actually be finished.'] });
        return;
      }
      // Register under a scratch id so checking never disturbs a saved lesson
      // of the same name, then hand it the same criteria dispatch as lesson 01.
      var probeId = 'authored:studio-check-0';
      Grader.unregisterAuthored(probeId);
      var reg = Grader.registerAuthored(probeId, Store.toEntry(doc));
      if (!reg.ok) {
        setChecked({ ok: false, stage: 'form', reasons: reg.errors });
        return;
      }
      var r = Grader.gradeSync({ id: probeId, terrain: doc.terrain }, doc.solutionCode);
      Grader.unregisterAuthored(probeId);
      if (r.ok === false) {
        setChecked({ ok: false, stage: 'grade', reasons: [r.reason || 'The grader could not run this lesson.'] });
        return;
      }
      var starterResult = null;
      var s = Grader.registerAuthored(probeId, Store.toEntry(doc));
      if (s.ok) {
        starterResult = Grader.gradeSync({ id: probeId, terrain: doc.terrain }, doc.starterCode || '');
        Grader.unregisterAuthored(probeId);
      }
      setChecked({
        ok: r.passed === true,
        stage: 'grade',
        score: r.score,
        reasons: r.reasons || [],
        events: r.events || [],
        starterPasses: !!(starterResult && starterResult.passed),
        starterScore: starterResult ? starterResult.score : null,
        starterReasons: starterResult ? (starterResult.reasons || []) : [],
        warnings: v.warnings || [],
      });
      if (r.passed && starterResult && starterResult.passed) {
        setMsg({ tone: 'warn', text: 'Careful: the starter program already passes, so there is nothing for the pupil to work out.' });
      }
    }

    function doSave(openAfter) {
      var r = Store.save(doc);
      if (!r.ok) {
        setMsg({ tone: 'err', text: r.errors.join(' ') });
        return;
      }
      setMsg({ tone: 'ok', text: 'Saved. It is in the lesson library now, marked as made here.' });
      if (props.onSaved) props.onSaved(doc);
      if (openAfter && props.onOpen) props.onOpen(doc);
    }

    var canSave = !!(checked && checked.ok);
    var arenaIssues = liveValidation.errors.filter(function (x) { return /(arena|sample|rock|base|world)/i.test(x); });
    var goalIssues = liveValidation.errors.filter(function (x) { return /goal/i.test(x); });
    var arenaReady = arenaIssues.length === 0;
    var goalsReady = doc.criteria.length > 0 && goalIssues.length === 0;
    var programsReady = !!(doc.starterCode && doc.starterCode.trim() && doc.solutionCode && doc.solutionCode.trim());

    // --- goals ---
    function setGoal(i, key) {
      var kind = null;
      for (var g = 0; g < GOAL_KINDS.length; g++) if (GOAL_KINDS[g].key === key) kind = GOAL_KINDS[g];
      var next = doc.criteria.slice();
      var o = {};
      o[key] = kind ? kind.dflt : true;
      next[i] = o;
      patch(Object.assign({}, doc, { criteria: next }));
    }
    function setGoalValue(i, key, value) {
      var next = doc.criteria.slice();
      var o = {};
      o[key] = value;
      next[i] = o;
      patch(Object.assign({}, doc, { criteria: next }));
    }

    function goalRow(c, i) {
      var key = Object.keys(c || {})[0] || 'no_collisions';
      var kind = null;
      for (var g = 0; g < GOAL_KINDS.length; g++) if (GOAL_KINDS[g].key === key) kind = GOAL_KINDS[g];
      var value = c[key];
      return e('div', { className: 'ls-goal', key: 'goal' + i },
        e('select', {
          'aria-label': 'Goal ' + (i + 1) + ' type',
          value: key,
          onChange: function (ev) { setGoal(i, ev.target.value); },
        }, GOAL_KINDS.map(function (k) {
          return e('option', { key: k.key, value: k.key }, k.label);
        })),
        kind && kind.kind === 'construct' && e('select', {
          'aria-label': 'Goal ' + (i + 1) + ' construct',
          value: value,
          onChange: function (ev) { setGoalValue(i, key, ev.target.value); },
        }, Store.CONSTRUCTS.map(function (c2) {
          return e('option', { key: c2, value: c2 }, CONSTRUCT_LABEL[c2] || c2);
        })),
        kind && (kind.kind === 'int' || kind.kind === 'num') && e('input', {
          type: 'number', 'aria-label': 'Goal ' + (i + 1) + ' amount',
          value: value, min: 0, step: kind.kind === 'int' ? 1 : 0.5,
          onChange: function (ev) { setGoalValue(i, key, num(ev.target.value, 0)); },
        }),
        kind && kind.kind === 'list' && e('input', {
          type: 'text', 'aria-label': 'Goal ' + (i + 1) + ' function names',
          value: (value || []).join(', '),
          placeholder: 'move_forward, beep, log',
          onChange: function (ev) {
            setGoalValue(i, key, ev.target.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean));
          },
        }),
        kind && kind.unit ? e('span', { className: 'ls-unit' }, kind.unit) : null,
        e('button', {
          className: 'btn-mini', 'aria-label': 'Remove goal ' + (i + 1),
          onClick: function () {
            patch(Object.assign({}, doc, { criteria: doc.criteria.filter(function (_, j) { return j !== i; }) }));
          },
        }, 'Remove'),
        kind ? e('p', { className: 'ls-goal-hint' }, kind.hint) : null);
    }

    return e('div', { className: 'modal-backdrop', onClick: props.onClose },
      e('div', {
        className: 'modal modal-wide lesson-studio-modal',
        role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Lesson Studio',
        onClick: function (ev) { ev.stopPropagation(); },
      },
        e('div', { className: 'modal-head' },
          e('div', null,
            e('span', { className: 'eyebrow' }, 'Lesson Studio'),
            e('h2', null, 'Make your own lesson')),
          e('button', { className: 'btn-mini', onClick: props.onClose, 'aria-label': 'Close the Lesson Studio' }, 'Close')),

        e('p', { className: 'ls-lede' },
          'Draw the arena, say what counts as finished, and write one answer that works. ',
          'You cannot save until your own answer passes, because a lesson nobody can finish is worse than no lesson.'),
        e('ol', { className: 'ls-pipeline', 'aria-label': 'Lesson authoring stages' },
          [
            ['1', 'Arena', arenaReady],
            ['2', 'Goals', goalsReady],
            ['3', 'Programs', programsReady],
            ['4', 'Check and try', canSave],
          ].map(function (step) {
            return e('li', { key: step[0], className: step[2] ? 'is-done' : '' },
              e('span', null, step[0]), e('b', null, step[1]), e('small', null, step[2] ? 'Ready' : 'Needs attention'));
          })),
        e('div', {
          className: 'ls-live-check ' + (liveValidation.ok ? 'ok' : 'bad'),
          role: 'status', 'aria-live': 'polite',
        },
          e('b', null, liveValidation.ok
            ? 'Live checks: the lesson form is valid.'
            : 'Live checks: ' + liveValidation.errors.length + ' thing' + (liveValidation.errors.length === 1 ? '' : 's') + ' to fix.'),
          !liveValidation.ok && e('ul', null, liveValidation.errors.slice(0, 4).map(function (err, i) {
            return e('li', { key: 'live' + i }, err);
          })),
          liveValidation.warnings.length > 0 && e('p', null, liveValidation.warnings.join(' '))),

        e('div', { className: 'ls-grid' },

          // ---- left: the map ----
          e('section', { className: 'ls-map-pane', 'aria-label': 'Arena' },
            e('h3', null, 'The arena'),
            e('div', { className: 'ls-tools', role: 'group', 'aria-label': 'Placing tool' },
              ['base', 'sample', 'rock'].map(function (t) {
                return e('button', {
                  key: t,
                  className: 'btn-mini' + (tool === t ? ' ls-tool-on' : ''),
                  'aria-pressed': tool === t ? 'true' : 'false',
                  onClick: function () { setTool(tool === t ? null : t); },
                }, t === 'base' ? 'Move the start' : t === 'sample' ? 'Add a flag' : 'Add a rock');
              }),
              e('button', {
                className: 'btn-mini',
                onClick: function () { patchWorld({ samples: [], obstacles: [] }); },
              }, 'Clear')),
            e('p', { className: 'ls-tool-hint' },
              tool ? 'Click the map to place it.' : 'Pick a tool, then click the map.'),
            e('svg', {
              className: 'ls-map',
              width: MAP_PX, height: MAP_PX,
              viewBox: '0 0 ' + (w.width * scale) + ' ' + (w.height * scale),
              onClick: mapClick,
              role: 'img',
              'aria-label': 'Arena map, ' + w.width + ' by ' + w.height + ' metres, '
                + (w.samples || []).length + ' flags and ' + (w.obstacles || []).length + ' rocks',
            },
              e('rect', { x: 0, y: 0, width: w.width * scale, height: w.height * scale, className: 'ls-map-floor' }),
              // metre grid, so distances are readable at a glance
              Array.from({ length: Math.floor(w.width) + 1 }).map(function (_, i) {
                return e('line', { key: 'vx' + i, x1: i * scale, y1: 0, x2: i * scale, y2: w.height * scale, className: 'ls-map-grid' });
              }),
              Array.from({ length: Math.floor(w.height) + 1 }).map(function (_, i) {
                return e('line', { key: 'hz' + i, x1: 0, y1: i * scale, x2: w.width * scale, y2: i * scale, className: 'ls-map-grid' });
              }),
              (w.obstacles || []).map(function (o, i) {
                var p = px(o.x, o.y);
                var isSelected = selected && selected.kind === 'rock' && selected.index === i;
                return e('g', {
                  key: 'ob' + i, role: 'button', tabIndex: 0,
                  className: isSelected ? 'ls-map-selected' : '',
                  'aria-label': 'Rock ' + (i + 1) + ' at ' + o.x + ', ' + o.y + ' metres. Select to edit.',
                  onClick: function (ev) { ev.stopPropagation(); setSelected({ kind: 'rock', index: i }); },
                  onKeyDown: function (ev) { selectFromKey(ev, { kind: 'rock', index: i }); },
                },
                  e('circle', { cx: p.cx, cy: p.cy, r: Math.max(4, o.r * scale), className: 'ls-map-rock' }),
                  e('text', { x: p.cx, y: p.cy + 3, className: 'ls-map-label', textAnchor: 'middle' }, 'R' + String(i + 1)));
              }),
              (w.samples || []).map(function (s, i) {
                var p = px(s[0], s[1]);
                var isSelected = selected && selected.kind === 'sample' && selected.index === i;
                return e('g', {
                  key: 'sm' + i, role: 'button', tabIndex: 0,
                  className: isSelected ? 'ls-map-selected' : '',
                  'aria-label': 'Flag ' + (i + 1) + ' at ' + s[0] + ', ' + s[1] + ' metres. Select to edit.',
                  onClick: function (ev) { ev.stopPropagation(); setSelected({ kind: 'sample', index: i }); },
                  onKeyDown: function (ev) { selectFromKey(ev, { kind: 'sample', index: i }); },
                },
                  e('circle', { cx: p.cx, cy: p.cy, r: 6, className: 'ls-map-flag' }),
                  e('text', { x: p.cx, y: p.cy - 9, className: 'ls-map-label', textAnchor: 'middle' }, String(i + 1)));
              }),
              (function () {
                var p = px(w.base[0], w.base[1]);
                return e('g', {
                  role: 'button', tabIndex: 0,
                  className: selected && selected.kind === 'base' ? 'ls-map-selected' : '',
                  'aria-label': 'Start at ' + w.base[0] + ', ' + w.base[1] + ' metres. Select to edit.',
                  onClick: function (ev) { ev.stopPropagation(); setSelected({ kind: 'base', index: 0 }); },
                  onKeyDown: function (ev) { selectFromKey(ev, { kind: 'base', index: 0 }); },
                },
                  e('circle', { cx: p.cx, cy: p.cy, r: 9, className: 'ls-map-base' }),
                  e('text', { x: p.cx, y: p.cy + 4, className: 'ls-map-label', textAnchor: 'middle' }, 'S'));
              })()),
            selected && (function () {
              var item = selected.kind === 'base' ? { x: w.base[0], y: w.base[1] }
                : selected.kind === 'sample' && w.samples[selected.index]
                  ? { x: w.samples[selected.index][0], y: w.samples[selected.index][1] }
                  : selected.kind === 'rock' && w.obstacles[selected.index]
                    ? w.obstacles[selected.index] : null;
              if (!item) return null;
              function setPoint(axis, value) {
                var n = snap(num(value, item[axis]));
                if (selected.kind === 'base') {
                  var base = w.base.slice();
                  base[axis === 'x' ? 0 : 1] = n;
                  patchWorld({ base: base });
                } else if (selected.kind === 'sample') {
                  var samples = w.samples.map(function (s, i) {
                    if (i !== selected.index) return s;
                    var next = s.slice();
                    next[axis === 'x' ? 0 : 1] = n;
                    return next;
                  });
                  patchWorld({ samples: samples });
                } else {
                  patchWorld({ obstacles: w.obstacles.map(function (o, i) {
                    return i === selected.index ? Object.assign({}, o, { [axis]: n }) : o;
                  }) });
                }
              }
              function removeSelected() {
                if (selected.kind === 'sample') patchWorld({ samples: w.samples.filter(function (_, i) { return i !== selected.index; }) });
                if (selected.kind === 'rock') patchWorld({ obstacles: w.obstacles.filter(function (_, i) { return i !== selected.index; }) });
                setSelected(null);
              }
              var name = selected.kind === 'base' ? 'Start'
                : selected.kind === 'sample' ? 'Flag ' + (selected.index + 1)
                  : 'Rock ' + (selected.index + 1);
              return e('div', { className: 'ls-inspector', 'aria-label': name + ' details' },
                e('b', null, name),
                e('label', null, 'X',
                  e('input', { type: 'number', min: 0, max: w.width, step: 0.5, value: item.x, onChange: function (ev) { setPoint('x', ev.target.value); } })),
                e('label', null, 'Y',
                  e('input', { type: 'number', min: 0, max: w.height, step: 0.5, value: item.y, onChange: function (ev) { setPoint('y', ev.target.value); } })),
                selected.kind === 'rock' && e('label', null, 'Radius',
                  e('input', {
                    type: 'number', min: 0.1, max: 3, step: 0.1, value: item.r,
                    onChange: function (ev) {
                      patchWorld({ obstacles: w.obstacles.map(function (o, i) {
                        return i === selected.index ? Object.assign({}, o, { r: num(ev.target.value, 0.5) }) : o;
                      }) });
                    },
                  })),
                selected.kind !== 'base' && e('button', { className: 'btn-mini', onClick: removeSelected }, 'Remove'));
            })(),
            e('div', { className: 'ls-size' },
              e('label', null, 'Width',
                e('input', {
                  type: 'number', min: 2, max: 40, step: 1, value: w.width,
                  'aria-label': 'Arena width in metres',
                  onChange: function (ev) { patchWorld({ width: num(ev.target.value, 8) }); },
                })),
              e('label', null, 'Height',
                e('input', {
                  type: 'number', min: 2, max: 40, step: 1, value: w.height,
                  'aria-label': 'Arena height in metres',
                  onChange: function (ev) { patchWorld({ height: num(ev.target.value, 8) }); },
                })),
              e('span', { className: 'ls-unit' }, 'metres')),
            (w.samples || []).length > 0 && e('button', {
              className: 'btn-mini',
              onClick: function () { patchWorld({ samples: w.samples.slice(0, -1) }); },
            }, 'Undo last flag'),
            (w.obstacles || []).length > 0 && e('button', {
              className: 'btn-mini',
              onClick: function () { patchWorld({ obstacles: w.obstacles.slice(0, -1) }); },
            }, 'Undo last rock')),

          // ---- right: everything else ----
          e('div', { className: 'ls-form-pane' },
            e('section', { 'aria-label': 'About this lesson' },
              e('h3', null, 'About'),
              e('label', { className: 'ls-field' }, 'Title',
                e('input', {
                  type: 'text', value: doc.title, maxLength: 80,
                  onChange: function (ev) { patch(Object.assign({}, doc, { title: ev.target.value })); },
                })),
              e('div', { className: 'ls-row' },
                e('label', { className: 'ls-field' }, 'Age group',
                  e('select', {
                    value: doc.keyStage,
                    onChange: function (ev) { patch(Object.assign({}, doc, { keyStage: ev.target.value })); },
                  }, Store.KEY_STAGES.map(function (k) { return e('option', { key: k, value: k }, k); }))),
                e('label', { className: 'ls-field' }, 'World',
                  e('select', {
                    value: doc.terrain,
                    onChange: function (ev) { patch(Object.assign({}, doc, { terrain: ev.target.value })); },
                  }, Store.TERRAINS.map(function (t) { return e('option', { key: t, value: t }, WORLD_LABEL[t] || t); }))),
                e('label', { className: 'ls-field' }, 'Main concept',
                  e('select', {
                    value: (doc.concepts && doc.concepts[0]) || 'sequence',
                    onChange: function (ev) { patch(Object.assign({}, doc, { concepts: [ev.target.value] })); },
                  }, Store.CT_CONCEPTS.map(function (c) { return e('option', { key: c, value: c }, CONCEPT_LABEL[c] || c); })))),
              e('label', { className: 'ls-field' }, 'What the pupil should do',
                e('textarea', {
                  rows: 3, value: doc.intro, maxLength: 1200,
                  onChange: function (ev) { patch(Object.assign({}, doc, { intro: ev.target.value })); },
                }))),

            e('section', { 'aria-label': 'Goals' },
              e('h3', null, 'Finished when'),
              doc.criteria.map(goalRow),
              doc.criteria.length < 8 && e('button', {
                className: 'btn-mini',
                onClick: function () { patch(Object.assign({}, doc, { criteria: doc.criteria.concat([{ no_collisions: true }]) })); },
              }, 'Add a goal')),

            e('section', { 'aria-label': 'Programs' },
              e('h3', null, 'The programs'),
              e('label', { className: 'ls-field' }, 'What the pupil starts with',
                e('textarea', {
                  className: 'ls-code', rows: 5, value: doc.starterCode, spellCheck: false,
                  onChange: function (ev) { patch(Object.assign({}, doc, { starterCode: ev.target.value })); },
                })),
              e('label', { className: 'ls-field' }, 'One answer that works',
                e('textarea', {
                  className: 'ls-code', rows: 7, value: doc.solutionCode || '', spellCheck: false,
                  onChange: function (ev) { patch(Object.assign({}, doc, { solutionCode: ev.target.value })); },
                })),
              e('p', { className: 'ls-note' },
                'The answer is shown to a pupil only after they have used every hint.')),

            e('section', { 'aria-label': 'Hints' },
              e('h3', null, 'Hints'),
              ((doc.hints && doc.hints.onFailure) || []).map(function (h, i) {
                return e('div', { className: 'ls-hint-row', key: 'h' + i },
                  e('input', {
                    type: 'text', value: h, maxLength: 400,
                    'aria-label': 'Hint ' + (i + 1),
                    onChange: function (ev) {
                      var next = doc.hints.onFailure.slice();
                      next[i] = ev.target.value;
                      patch(Object.assign({}, doc, { hints: Object.assign({}, doc.hints, { onFailure: next }) }));
                    },
                  }),
                  e('button', {
                    className: 'btn-mini', 'aria-label': 'Remove hint ' + (i + 1),
                    onClick: function () {
                      patch(Object.assign({}, doc, {
                        hints: Object.assign({}, doc.hints, {
                          onFailure: doc.hints.onFailure.filter(function (_, j) { return j !== i; }),
                        }),
                      }));
                    },
                  }, 'Remove'));
              }),
              ((doc.hints && doc.hints.onFailure) || []).length < 6 && e('button', {
                className: 'btn-mini',
                onClick: function () {
                  patch(Object.assign({}, doc, {
                    hints: Object.assign({}, doc.hints || {}, {
                      onFailure: ((doc.hints && doc.hints.onFailure) || []).concat(['']),
                    }),
                  }));
                },
              }, 'Add a hint')))),

        // ---- the gate ----
        e('div', { className: 'ls-check' },
          e('button', { className: 'ctrl ctrl-run', onClick: runCheck }, 'Check my lesson works'),
          checked && e('div', {
            className: 'ls-check-out ' + (checked.ok ? 'ok' : 'bad'),
            role: 'status',
          },
            checked.ok
              ? e('div', null,
                e('p', null, 'Your worked answer passes this lesson, ' + checked.score + ' out of 100.'),
                e('div', { className: 'ls-check-metrics' },
                  e('span', null, e('b', null, String((checked.events || []).filter(function (x) { return x.kind === 'call'; }).length)), ' API calls'),
                  e('span', null, e('b', null, String((checked.events || []).filter(function (x) { return x.kind === 'collision'; }).length)), ' collisions'),
                  e('span', null, e('b', null, String(checked.starterScore == null ? 'Not run' : checked.starterScore)), ' starter score')),
                e('p', { className: checked.starterPasses ? 'ls-starter-warn' : 'ls-starter-ok' },
                  checked.starterPasses
                    ? 'The pupil starter already passes. Change it if the pupil should have something to solve.'
                    : 'The pupil starter does not pass yet, so the lesson contains a real task.'),
                checked.warnings && checked.warnings.length > 0
                  ? e('p', { className: 'ls-starter-warn' }, checked.warnings.join(' ')) : null)
              : e('div', null,
                e('p', null, checked.stage === 'form'
                  ? 'This lesson is not ready yet:'
                  : 'Your own answer does not pass this lesson yet:'),
                e('ul', null, (checked.reasons || []).map(function (r, i) {
                  return e('li', { key: 'r' + i }, r);
                })))),
          msg && e('p', { className: 'ls-msg ls-msg-' + msg.tone, role: 'status' }, msg.text)),

        e('div', { className: 'ls-actions' },
          e('button', {
            className: 'ctrl ctrl-run', disabled: !canSave, onClick: function () { doSave(false); },
            title: canSave ? '' : 'Check your lesson works first',
          }, 'Save to my lessons'),
          props.onOpen && e('button', {
            className: 'ctrl ctrl-run', disabled: !canSave,
            onClick: function () { doSave(true); },
            title: canSave ? 'Save, close the Studio and open the lesson exactly as a pupil sees it' : 'Check your lesson works first',
          }, 'Save and try as a pupil'),
          e('button', {
            className: 'btn-mini', disabled: !canSave,
            onClick: function () { if (props.onExport) props.onExport(doc); },
          }, 'Save to a file'),
          e('button', { className: 'btn-mini', onClick: props.onImport }, 'Open a lesson file'),
          props.onExportPack && Store.list().length > 1 && e('button', {
            className: 'btn-mini', onClick: props.onExportPack,
            title: 'Save every lesson you have made as one file',
          }, 'Save all ' + Store.list().length + ' to one file'),
          props.onDelete && Store.get(doc.id) && e('button', {
            className: 'btn-mini', onClick: function () { props.onDelete(doc.id); },
          }, 'Delete this lesson'))));
  }

  window.KodroLessonStudio = LessonStudio;
})();
