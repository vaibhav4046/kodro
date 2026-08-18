/* Unit test for the pure memory-graph builder (window.KodroMemoryGraph.build).
 *
 * The graph is honest-by-construction: every node/edge must be derivable from
 * the stored reflections + skills, the layout is deterministic (no randomness),
 * and it must stay robust on sparse input (0/1 items, no skills) because the UI
 * seeds only a single reflection in the smoke harness. This test loads the REAL
 * shipped builder in a fake window and asserts the model it returns.
 *
 *   node scripts/qa_memgraph.mjs      # exits non-zero on any failed assertion
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src', 'kodro', 'assets', 'web', 'memory-graph.js');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(SRC, 'utf8'), ctx, { filename: 'memory-graph.js' });
const build = ctx.window.KodroMemoryGraph.build;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass += 1; }
  else { fail += 1; console.error('FAIL  ' + msg); }
}
function eq(a, b, msg) { ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

// 1. Empty store -> no nodes, no crash.
{
  const g = build({ reflections: [], skills: [] });
  eq(g.nodes.length, 0, 'empty: no nodes');
  eq(g.edges.length, 0, 'empty: no edges');
  ok(g.width > 0 && g.height > 0, 'empty: still has a viewBox');
}

// 2. The smoke-harness fixture: a single crash reflection.
{
  const g = build({ reflections: [{ ts: 1, world: 'earth', robotType: 'rover', outcome: 'crash', detail: 'a boulder', reflection: 'Collided with a boulder.' }], skills: [] });
  const kinds = g.nodes.map(n => n.kind).sort();
  eq(JSON.stringify(kinds), JSON.stringify(['reflection', 'robot', 'world']), 'single crash: world+robot hub + reflection item');
  eq(g.edges.length, 2, 'single crash: item links to both hubs');
  const refl = g.nodes.find(n => n.kind === 'reflection');
  eq(refl.tone, 'crash', 'single crash: reflection carries its outcome as a tone');
  const world = g.nodes.find(n => n.kind === 'world');
  eq(world.degree, 1, 'single crash: world hub degree = 1');
  eq(world.items.length, 1, 'single crash: world hub lists its linked item');
  // Adjacency is symmetric.
  ok(g.adjacency[refl.id].includes(world.id) && g.adjacency[world.id].includes(refl.id), 'single crash: adjacency is bidirectional');
  eq(g.stats.outcomes.crash, 1, 'single crash: outcome tally');
}

// 3. Richer store: multiple worlds, skills + reflections, truncation + tones.
{
  const reflections = [];
  for (let i = 0; i < 10; i++) reflections.push({ ts: i, world: i % 2 ? 'earth' : 'mars', robotType: 'rover', outcome: ['done', 'crash', 'flat'][i % 3], detail: 'd' + i, reflection: 'note ' + i });
  const skills = [];
  for (let i = 0; i < 3; i++) skills.push({ name: 'skill ' + i, code: 'move_forward(3)\nturn_left()', world: 'earth', robotType: 'rover', uses: i });
  const g = build({ reflections, skills });
  const nRefl = g.nodes.filter(n => n.kind === 'reflection').length;
  const nSkill = g.nodes.filter(n => n.kind === 'skill').length;
  eq(nRefl, 8, 'rich: reflections capped at maxItems (8)');
  eq(nSkill, 3, 'rich: all 3 skills shown');
  ok(g.truncated, 'rich: truncation flag set when reflections exceed the cap');
  eq(g.stats.totalReflections, 10, 'rich: total reflection count reported');
  ok(g.nodes.filter(n => n.kind === 'world').length === 2, 'rich: both worlds surfaced as hubs');
  const skillNode = g.nodes.find(n => n.kind === 'skill');
  ok(skillNode.preview.includes('move_forward'), 'rich: skill carries a code preview for the inspector');
  ok(g.columns.length === 3 && g.columns[1].kind === 'item', 'rich: three columns with the item column in the middle');
  // Every edge endpoint resolves to a real node (no dangling links).
  const ids = new Set(g.nodes.map(n => n.id));
  ok(g.edges.every(e => ids.has(e.from) && ids.has(e.to)), 'rich: no dangling edges');
  // maxItems override raises the cap deterministically.
  const g2 = build({ reflections, skills }, { maxItems: 40 });
  eq(g2.nodes.filter(n => n.kind === 'reflection').length, 10, 'rich: maxItems override shows all reflections');
  ok(!g2.truncated, 'rich: no truncation once all items fit');
  eq(g2.height >= g.height, true, 'rich: taller graph when more rows are shown');
}

// 4. Determinism: same input -> byte-identical model.
{
  const input = { reflections: [{ ts: 2, world: 'mars', robotType: 'arm', outcome: 'done', reflection: 'ok' }], skills: [{ name: 'a', code: 'x', world: 'mars', robotType: 'arm' }] };
  eq(JSON.stringify(build(input)), JSON.stringify(build(input)), 'determinism: identical output for identical input');
}

console.log((fail ? 'FAIL' : 'PASS') + '  memory-graph builder: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
