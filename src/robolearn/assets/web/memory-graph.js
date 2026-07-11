/* Memory graph builder. Turns the flat KodroMemory store (reflections + skills)
 * into a small relationship graph so the learner can SEE what the app has tied
 * together, instead of two flat lists.
 *
 * Honest by construction: every node and edge is derived from real stored data.
 * Hubs are the worlds and robot types the learner actually used; item nodes are
 * their saved skills and past-run reflections, each linked to the world and
 * robot type it was recorded under. Nothing is invented, and the layout is
 * deterministic (no physics/randomness) so it is testable and stable.
 *
 * The builder is data-only: it computes node positions, edges, an adjacency map
 * (for neighbour highlighting), per-column headers and summary stats, and it
 * carries each node's real detail (a reflection's text/outcome, a skill's code
 * and use count) so the panel can render an inspector without re-querying the
 * store. All interaction (select, hover, layer filtering) is a rendering concern
 * layered on top of this stable graph, so toggling a layer never reflows it.
 *
 *   build({reflections, skills}, {maxItems})
 *     -> {nodes, edges, adjacency, columns, width, height, truncated, stats}
 */
(function () {
  'use strict';

  var WIDTH = 680;
  var X_WORLD = 120;
  var X_ITEM = 340;
  var X_ROBOT = 560;
  var PAD_TOP = 52;    // headroom for the column headers
  var PAD_BOT = 26;    // breathing room under the last row
  var ROW_GAP = 34;    // vertical spacing between rows in the tallest column
  var MIN_H = 300;
  var MAX_H = 700;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function colY(i, n, height) {
    if (n <= 1) return (PAD_TOP + height - PAD_BOT) / 2;
    return PAD_TOP + (height - PAD_TOP - PAD_BOT) * i / (n - 1);
  }

  function shortLabel(text, max) {
    text = String(text || '');
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  function firstLines(code, n) {
    var lines = String(code || '').replace(/\r\n/g, '\n').split('\n');
    var head = lines.slice(0, n).join('\n');
    return lines.length > n ? head + '\n…' : head;
  }

  // build({reflections, skills}, {maxItems}) -> graph model (see file header)
  function build(mem, opts) {
    mem = mem || {};
    opts = opts || {};
    var maxItems = opts.maxItems || 8; // per kind, keeps the picture readable

    var allSkills = Array.isArray(mem.skills) ? mem.skills : [];
    var allReflections = Array.isArray(mem.reflections) ? mem.reflections : [];
    var skills = allSkills.slice(0, maxItems);
    var reflections = allReflections.slice(0, maxItems);
    var truncated = allSkills.length > skills.length || allReflections.length > reflections.length;

    // Collect the world and robot-type hubs actually referenced by shown items.
    var worldSet = {}, robotSet = {};
    function note(it) {
      if (it && it.world) worldSet[it.world] = true;
      if (it && it.robotType) robotSet[it.robotType] = true;
    }
    skills.forEach(note);
    reflections.forEach(note);
    var worlds = Object.keys(worldSet).sort();
    var robots = Object.keys(robotSet).sort();

    var items = [];
    skills.forEach(function (s, i) {
      items.push({
        id: 'skill:' + i + ':' + String(s.name || ''),
        label: shortLabel(s.name || 'skill', 18), full: String(s.name || 'skill'),
        kind: 'skill', world: s.world || '', robotType: s.robotType || '',
        uses: s.uses || 0, code: String(s.code || ''), preview: firstLines(s.code, 5), ts: s.ts || 0,
      });
    });
    reflections.forEach(function (r, i) {
      var outcome = String(r.outcome || '');
      items.push({
        id: 'refl:' + i,
        label: shortLabel(r.reflection || r.outcome || 'run', 22),
        full: String(r.reflection || r.outcome || 'run note'),
        kind: 'reflection', tone: outcome, outcome: outcome, detail: String(r.detail || ''),
        world: r.world || '', robotType: r.robotType || '', ts: r.ts || 0,
      });
    });
    // Sort items by (world, robotType) so edges to the same hubs leave from
    // neighbouring rows -- far fewer crossings than insertion order.
    items.sort(function (a, b) {
      var k1 = (a.world || '~') + '|' + (a.robotType || '~');
      var k2 = (b.world || '~') + '|' + (b.robotType || '~');
      return k1 < k2 ? -1 : k1 > k2 ? 1 : 0;
    });

    // Height grows with the tallest column so a busy memory does not cram its
    // rows together; a sparse one stays compact. Deterministic given the data.
    var rows = Math.max(worlds.length, items.length, robots.length, 1);
    var height = clamp(PAD_TOP + PAD_BOT + (rows > 1 ? (rows - 1) * ROW_GAP : ROW_GAP), MIN_H, MAX_H);

    var nodes = [];
    var edges = [];
    var adjacency = {};
    var hubById = {};

    function link(aId, bId) {
      (adjacency[aId] || (adjacency[aId] = [])).push(bId);
      (adjacency[bId] || (adjacency[bId] = [])).push(aId);
    }

    worlds.forEach(function (w, i) {
      var n = { id: 'world:' + w, label: shortLabel(w, 16), full: String(w), kind: 'world', degree: 0, items: [], x: X_WORLD, y: colY(i, worlds.length, height) };
      hubById[n.id] = n; nodes.push(n);
    });
    robots.forEach(function (t, i) {
      var n = { id: 'robot:' + t, label: shortLabel(t, 16), full: String(t), kind: 'robot', degree: 0, items: [], x: X_ROBOT, y: colY(i, robots.length, height) };
      hubById[n.id] = n; nodes.push(n);
    });

    items.forEach(function (it, i) {
      it.x = X_ITEM;
      it.y = colY(i, items.length, height);
      nodes.push(it);
      var wHub = hubById['world:' + it.world];
      if (wHub) {
        edges.push({ from: it.id, to: wHub.id, kind: 'world' });
        wHub.degree += 1; wHub.items.push(it.id); link(it.id, wHub.id);
      }
      var rHub = hubById['robot:' + it.robotType];
      if (rHub) {
        edges.push({ from: it.id, to: rHub.id, kind: 'robot' });
        rHub.degree += 1; rHub.items.push(it.id); link(it.id, rHub.id);
      }
    });

    var outcomes = { done: 0, crash: 0, flat: 0, other: 0 };
    reflections.forEach(function (r) {
      var o = String(r.outcome || '');
      if (o === 'done' || o === 'crash' || o === 'flat') outcomes[o] += 1; else outcomes.other += 1;
    });

    return {
      nodes: nodes,
      edges: edges,
      adjacency: adjacency,
      columns: [
        { kind: 'world', x: X_WORLD, label: 'Worlds', count: worlds.length },
        { kind: 'item', x: X_ITEM, label: 'Memories', count: items.length },
        { kind: 'robot', x: X_ROBOT, label: 'Robots', count: robots.length },
      ],
      width: WIDTH,
      height: height,
      truncated: truncated,
      stats: {
        worlds: worlds.length,
        robots: robots.length,
        skills: skills.length,
        reflections: reflections.length,
        edges: edges.length,
        totalSkills: allSkills.length,
        totalReflections: allReflections.length,
        outcomes: outcomes,
      },
    };
  }

  window.KodroMemoryGraph = { build: build };
})();
