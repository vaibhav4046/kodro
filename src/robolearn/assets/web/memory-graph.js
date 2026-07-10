/* Memory graph builder. Turns the flat KodroMemory store (reflections + skills)
 * into a small relationship graph so the learner can SEE what the app has tied
 * together, instead of two flat lists.
 *
 * Honest by construction: every node and edge is derived from real stored data.
 * Hubs are the worlds and robot types the learner actually used; item nodes are
 * their saved skills and past-run reflections, each linked to the world and
 * robot type it was recorded under. Nothing is invented, and the layout is
 * deterministic (no physics/randomness) so it is testable and stable.
 */
(function () {
  'use strict';

  var WIDTH = 640;
  var HEIGHT = 380;
  var PAD_Y = 34;
  var X_WORLD = 96;
  var X_ITEM = 320;
  var X_ROBOT = 544;

  function colY(i, n) {
    if (n <= 1) return HEIGHT / 2;
    return PAD_Y + (HEIGHT - 2 * PAD_Y) * i / (n - 1);
  }

  function shortLabel(text, max) {
    text = String(text || '');
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  // build({reflections, skills}, {maxItems}) -> {nodes, edges, width, height, stats, truncated}
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

    var nodes = [];
    var edges = [];

    var hubById = {};
    worlds.forEach(function (w, i) {
      var n = { id: 'world:' + w, label: w, kind: 'world', degree: 0, x: X_WORLD, y: colY(i, worlds.length) };
      hubById[n.id] = n; nodes.push(n);
    });
    robots.forEach(function (t, i) {
      var n = { id: 'robot:' + t, label: t, kind: 'robot', degree: 0, x: X_ROBOT, y: colY(i, robots.length) };
      hubById[n.id] = n; nodes.push(n);
    });

    var items = [];
    skills.forEach(function (s, i) {
      items.push({ id: 'skill:' + i + ':' + String(s.name || ''), label: shortLabel(s.name || 'skill', 18), kind: 'skill', world: s.world, robotType: s.robotType });
    });
    reflections.forEach(function (r, i) {
      items.push({ id: 'refl:' + i, label: shortLabel(r.outcome || 'run', 18), kind: 'reflection', world: r.world, robotType: r.robotType });
    });
    // Sort items by (world, robotType) so edges to the same hubs leave from
    // neighbouring rows -- far fewer crossings than insertion order.
    items.sort(function (a, b) {
      var k1 = (a.world || '~') + '|' + (a.robotType || '~');
      var k2 = (b.world || '~') + '|' + (b.robotType || '~');
      return k1 < k2 ? -1 : k1 > k2 ? 1 : 0;
    });
    items.forEach(function (it, i) {
      it.x = X_ITEM;
      it.y = colY(i, items.length);
      nodes.push(it);
      if (it.world && worldSet[it.world]) {
        edges.push({ from: it.id, to: 'world:' + it.world, kind: 'world' });
        hubById['world:' + it.world].degree += 1;
      }
      if (it.robotType && robotSet[it.robotType]) {
        edges.push({ from: it.id, to: 'robot:' + it.robotType, kind: 'robot' });
        hubById['robot:' + it.robotType].degree += 1;
      }
    });

    return {
      nodes: nodes,
      edges: edges,
      width: WIDTH,
      height: HEIGHT,
      truncated: truncated,
      stats: {
        worlds: worlds.length,
        robots: robots.length,
        skills: skills.length,
        reflections: reflections.length,
        edges: edges.length,
      },
    };
  }

  window.KodroMemoryGraph = { build: build };
})();
