/* Offline unit QA for the streaming city chunks (city-stream.js).
 *
 * The CITY world used to be a 90-unit hand-placed block sitting in the middle
 * of a 400-unit empty plane: past the last building the pupil looked out over
 * bare ground to a fog wall, and the world read as a diorama on a table.
 * city-stream.js grows a deterministic city around that authored block, loading
 * chunks ahead of the camera and freeing them behind it.
 *
 * That buys realism only if four things hold, and every one of them is a way
 * this could quietly break the product rather than just look wrong:
 *
 *   1. SCENERY ONLY. Streamed content must never reach the collidable obstacle
 *      set or the agent list, because sim-physics.js reads both every frame for
 *      collision AND for the distance sensor. A single streamed building in
 *      `obstacles` would change a graded lesson result.
 *   2. DETERMINISTIC. Leaving a chunk and driving back must rebuild it
 *      identically, or the city reshuffles itself behind the pupil's back.
 *   3. POOLED RESOURCES SURVIVE UNLOAD. Geometry and materials are shared by
 *      every chunk. Disposing them on a chunk unload would blank the rest of
 *      the city; they are freed once, at teardown.
 *   4. AMORTISED. Crossing a chunk line builds at most `budget` chunks, so it
 *      costs a slice of a frame rather than a visible stall.
 *
 * Loaded under Node with a bare THREE shim: no browser, no WebGL, no React.
 * Exit 0 on all-pass, exit 1 on any failure.
 */
import { readFileSync } from 'node:fs';

const SRC_PATH = new URL('../src/kodro/assets/web/city-stream.js', import.meta.url);
const SRC = readFileSync(SRC_PATH, 'utf8');

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; } else { fail++; fails.push(name + (detail ? '  -> ' + detail : '')); }
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '   [' + detail + ']' : ''));
}

/* ---------------------------------------------------------------------------
   A THREE shim just deep enough to record what the streamer builds. Every
   geometry / material counts its own dispose() calls, which is how check 3
   distinguishes "freed at teardown" from "freed on unload".
   ------------------------------------------------------------------------- */
function vec3() {
  return { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } };
}
class Disposable {
  constructor(kind) { this.kind = kind; this.disposed = 0; }
  dispose() { this.disposed++; }
}
class Obj3D {
  constructor() { this.children = []; this.position = vec3(); this.rotation = vec3(); this.scale = vec3(); this.castShadow = false; this.receiveShadow = false; }
  add(c) { this.children.push(c); return this; }
  remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return this; }
  traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
}
const THREE = {
  RepeatWrapping: 1000,
  BoxGeometry: class extends Disposable { constructor() { super('box'); } },
  PlaneGeometry: class extends Disposable { constructor() { super('plane'); } },
  CylinderGeometry: class extends Disposable { constructor() { super('cyl'); } },
  IcosahedronGeometry: class extends Disposable { constructor() { super('ico'); } },
  SphereGeometry: class extends Disposable { constructor() { super('sph'); } },
  MeshStandardMaterial: class extends Disposable { constructor(o) { super('mat'); Object.assign(this, o || {}); } },
  CanvasTexture: class extends Disposable { constructor() { super('tex'); this.repeat = vec3(); } },
  Color: class { setHex(h) { this.hex = h; return this; } },
  Vector3: function () { return vec3(); },
  Quaternion: function () { return {}; },
  Matrix4: function () {
    return { elements: null, compose(p, q, s) { this.elements = [p.x, p.y, p.z, s.x, s.y, s.z]; return this; } };
  },
  Group: class extends Obj3D {},
  Mesh: class extends Obj3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } },
  InstancedMesh: class extends Obj3D {
    constructor(g, m, n) {
      super();
      this.geometry = g; this.material = m; this.count = n;
      this.isInstancedMesh = true; this.disposed = 0;
      this.matrices = []; this.colours = [];
      this.instanceMatrix = { needsUpdate: false };
      this.instanceColor = null;
    }
    setMatrixAt(i, m) { this.matrices[i] = m.elements.slice(); }
    setColorAt(i, c) { this.colours[i] = c.hex; this.instanceColor = { needsUpdate: false }; }
    dispose() { this.disposed++; }
  }
};
THREE.Vector3.prototype = {};
THREE.Quaternion.prototype = {};
THREE.Matrix4.prototype = {};

function newScene() { return new THREE.Group(); }

// Load the IIFE. No `document`, so the canvas textures degrade to flat colour
// (that fallback is check 8 below) and no `module`, so it registers on window.
const win = {};
new Function('window', 'document', SRC)(win, undefined);
const CS = win.KodroCityStream;

console.log('== CITY STREAM: module loads ==');
check('window.KodroCityStream exposes create + CHUNK',
  CS && typeof CS.create === 'function' && CS.CHUNK === 100, CS ? Object.keys(CS).join(',') : 'no module');
check('create() returns null without THREE or scene rather than throwing',
  CS.create({}) === null && CS.create({ THREE }) === null, '');

/* 1. SCENERY ONLY -- the assessment-critical guarantee.
   sim-physics.js reads terrain.obstacles and window.KodroAgents.list() for both
   collision and the distance sensor. The streamer must be provably absent from
   both, so this is a source-level check as well as a runtime one: a future edit
   that adds a push into `obstacles` fails here. */
console.log('\n== CITY STREAM: streamed content is scenery, never simulation ==');
check('source never references terrain.obstacles', !/\bobstacles\b/.test(SRC), '');
check('source never references KodroAgents', !/KodroAgents/.test(SRC), '');
check('module defines exactly one global (KodroCityStream)',
  Object.keys(win).length === 1 && Object.keys(win)[0] === 'KodroCityStream', Object.keys(win).join(','));

/* 2. DETERMINISM. */
console.log('\n== CITY STREAM: chunk content is a pure function of (ix, iz, seed) ==');
{
  const h = CS._hash2;
  check('hash2 stays a uint32 at large coordinates (Math.imul, not float multiply)',
    Number.isInteger(h(1e6, -1e6, 99)) && h(1e6, -1e6, 99) >= 0 && h(1e6, -1e6, 99) < 4294967296,
    String(h(1e6, -1e6, 99)));
  check('hash2 is stable across calls', h(3, -7, 5) === h(3, -7, 5), '');
  check('hash2 separates neighbouring chunks', h(3, -7, 5) !== h(4, -7, 5) && h(3, -7, 5) !== h(3, -6, 5), '');
  const r = CS._mulberry32(12345);
  const draws = [r(), r(), r(), r()];
  check('mulberry32 stays in [0,1)', draws.every((v) => v >= 0 && v < 1), draws.map((v) => v.toFixed(4)).join(','));
  const r2 = CS._mulberry32(12345);
  check('mulberry32 replays identically from the same seed',
    JSON.stringify([r2(), r2(), r2(), r2()]) === JSON.stringify(draws), '');
}

// Snapshot every instanced transform in the chunk whose group sits at (gx,0,gz).
function snapshot(scene, gx, gz) {
  const g = scene.children.find((c) => c.position.x === gx && c.position.z === gz);
  if (!g) return null;
  const out = [];
  g.traverse((o) => { if (o.isInstancedMesh) out.push([o.count, o.matrices, o.colours]); });
  return JSON.stringify(out);
}
function drain(s, x, z, max) {
  for (let i = 0; i < (max || 200); i++) s.update(x, z, 0.016);
}

{
  const scene = newScene();
  const s = CS.create({ THREE, scene, seed: 4242, radius: 2, budget: 1, traffic: true });
  drain(s, 0, 0);
  const first = snapshot(scene, 100, 0);
  check('chunk (1,0) was built and has instanced content', !!first && first.length > 10, first ? first.length + ' chars' : 'missing');

  // Drive far enough away that (1,0) falls outside keepRadius, then come back.
  drain(s, 100 * 12, 0);
  check('driving away unloads the distant chunk', snapshot(scene, 100, 0) === null, '');
  drain(s, 0, 0);
  check('driving back rebuilds chunk (1,0) byte-identically', snapshot(scene, 100, 0) === first, '');
  s.dispose();
}
{
  // Same coordinates, different seed -> different city. Guards against a hash
  // that silently ignores the seed.
  const a = newScene(), b = newScene();
  const sa = CS.create({ THREE, scene: a, seed: 1, radius: 1, budget: 8 });
  const sb = CS.create({ THREE, scene: b, seed: 2, radius: 1, budget: 8 });
  drain(sa, 0, 0); drain(sb, 0, 0);
  check('a different seed yields a different city', snapshot(a, 100, 0) !== snapshot(b, 100, 0), '');
  sa.dispose(); sb.dispose();
}

/* The authored city owns chunk (0,0). */
console.log('\n== CITY STREAM: the authored block keeps chunk (0,0) ==');
{
  const scene = newScene();
  const s = CS.create({ THREE, scene, seed: 7, radius: 2, budget: 8 });
  drain(s, 0, 0);
  check('chunk (0,0) is never built (skipOrigin default)',
    !scene.children.some((c) => c.position.x === 0 && c.position.z === 0), String(scene.children.length) + ' chunks');
  check('the full ring minus the origin is loaded', s.stats().loaded === 24, JSON.stringify(s.stats()));
  s.dispose();
}

/* 4. AMORTISED BUILD. */
console.log('\n== CITY STREAM: build cost is amortised across frames ==');
{
  const scene = newScene();
  const s = CS.create({ THREE, scene, seed: 7, radius: 2, budget: 1 });
  s.update(0, 0, 0.016);
  check('budget 1 builds exactly one chunk on the first frame', s.stats().built === 1, JSON.stringify(s.stats()));
  s.update(0, 0, 0.016);
  check('budget 1 builds exactly one more on the next frame', s.stats().built === 2, JSON.stringify(s.stats()));
  check('the rest of the ring is queued, not built', s.stats().pending === 22, JSON.stringify(s.stats()));
  s.dispose();
}
{
  const scene = newScene();
  const s = CS.create({ THREE, scene, seed: 7, radius: 2, budget: 3 });
  s.update(0, 0, 0.016);
  check('budget 3 builds exactly three chunks per frame', s.stats().built === 3, JSON.stringify(s.stats()));
  s.dispose();
}

/* Hysteresis: the keep radius is one wider than the load radius, so sitting on
   a chunk boundary must not thrash chunks in and out every frame. */
console.log('\n== CITY STREAM: hysteresis stops boundary thrash ==');
{
  const scene = newScene();
  const s = CS.create({ THREE, scene, seed: 7, radius: 1, budget: 8 });
  drain(s, 0, 0);
  const built0 = s.stats().built;                 // 3x3 ring minus the authored origin = 8
  drain(s, 100, 0);                               // one chunk east
  const built1 = s.stats().built, kept1 = s.stats().loaded;
  drain(s, 0, 0);                                 // straight back
  check('the first ring is 3x3 minus the authored origin', built0 === 8, 'built=' + built0);
  check('stepping one chunk east builds only the new column (3), not the whole ring',
    built1 === built0 + 3, built0 + ' -> ' + built1);
  check('chunks behind the camera stay loaded (keepRadius = radius + 1)',
    kept1 === built1, 'loaded=' + kept1 + ' built=' + built1);
  check('returning to the previous centre rebuilds nothing',
    s.stats().built === built1, 'built=' + s.stats().built + ' expected ' + built1);
  s.dispose();
}

/* 3. POOLED RESOURCES. */
console.log('\n== CITY STREAM: pooled geometry and materials outlive a chunk unload ==');
{
  const scene = newScene();
  const s = CS.create({ THREE, scene, seed: 7, radius: 1, budget: 8, traffic: true, lit: true });
  drain(s, 0, 0);
  // Collect the pool by walking what is actually in the scene.
  const geos = new Set(), mats = new Set(), ims = [];
  scene.traverse((o) => { if (o.geometry) geos.add(o.geometry); if (o.material) mats.add(o.material); if (o.isInstancedMesh) ims.push(o); });
  check('a loaded chunk shares the pooled primitives (few geometries, many meshes)',
    geos.size <= 5 && ims.length > 8, geos.size + ' geometries / ' + ims.length + ' instanced meshes');
  check('streamed content neither casts nor receives shadows (outside the sun frustum anyway)',
    ims.every((m) => m.castShadow === false && m.receiveShadow === false), '');

  drain(s, 100 * 12, 0);   // force every one of those chunks out
  check('unloading a chunk disposes NO pooled geometry',
    [...geos].every((g) => g.disposed === 0), [...geos].map((g) => g.kind + ':' + g.disposed).join(','));
  check('unloading a chunk disposes NO pooled material',
    [...mats].every((m) => m.disposed === 0), [...mats].map((m) => m.disposed).join(','));
  check('unloading DOES free the per-instance attribute buffers',
    ims.every((m) => m.disposed === 1), ims.map((m) => m.disposed).join(','));

  s.dispose();
  check('teardown disposes every pooled geometry exactly once',
    [...geos].every((g) => g.disposed === 1), [...geos].map((g) => g.kind + ':' + g.disposed).join(','));
  check('teardown disposes every pooled material exactly once',
    [...mats].every((m) => m.disposed === 1), [...mats].map((m) => m.disposed).join(','));
  check('the scene is empty after teardown', scene.children.length === 0, String(scene.children.length));
  s.dispose();
  check('a second dispose() is a no-op, not a double free',
    [...geos].every((g) => g.disposed === 1) && [...mats].every((m) => m.disposed === 1), '');
  check('update() after dispose() is inert', (s.update(0, 0, 0.016), scene.children.length === 0), '');
}

/* Traffic is decorative motion only, and must survive a backgrounded tab. */
console.log('\n== CITY STREAM: decorative traffic ==');
{
  const scene = newScene();
  const s = CS.create({ THREE, scene, seed: 7, radius: 1, budget: 8, traffic: true });
  drain(s, 0, 0);
  const g = scene.children[0];
  const car = g.children.find((c) => c instanceof THREE.Group);
  check('a chunk carries one moving car group', !!car, '');
  const p0 = car.position.x + car.position.z;
  s.update(0, 0, 0.5);
  check('the car moves when the clock advances', car.position.x + car.position.z !== p0, '');
  const p1 = { x: car.position.x, z: car.position.z };
  s.update(0, 0, 600);   // a backgrounded tab: dt is clamped, not applied raw
  const moved = Math.abs(car.position.x - p1.x) + Math.abs(car.position.z - p1.z);
  check('a huge frame delta is clamped, so traffic cannot teleport', moved <= 100, moved.toFixed(2) + ' units');
  s.dispose();
}
{
  const scene = newScene();
  const s = CS.create({ THREE, scene, seed: 7, radius: 1, budget: 8, traffic: false });
  drain(s, 0, 0);
  check('traffic:false builds no cars (the low quality tier)',
    !scene.children[0].children.some((c) => c instanceof THREE.Group), '');
  s.dispose();
}

/* Night lighting is emissive geometry, never per-lamp lights: a real SpotLight
   per lamp post would blow the light budget on an integrated GPU. */
console.log('\n== CITY STREAM: night dressing stays within the light budget ==');
{
  const day = newScene(), night = newScene();
  const sd = CS.create({ THREE, scene: day, seed: 7, radius: 1, budget: 8, lit: false });
  const sn = CS.create({ THREE, scene: night, seed: 7, radius: 1, budget: 8, lit: true });
  drain(sd, 0, 0); drain(sn, 0, 0);
  let dn = 0, nn = 0;
  day.traverse((o) => { if (o.isInstancedMesh) dn++; });
  night.traverse((o) => { if (o.isInstancedMesh) nn++; });
  check('lit:true adds lamp posts and bulbs', nn > dn, dn + ' -> ' + nn);
  check('lit:true adds no light objects (emissive material only)', !/new THREE\.(Spot|Point|Directional)Light/.test(SRC), '');
  sd.dispose(); sn.dispose();
}

/* 8. Headless fallback: no document means no canvas, and the module must fall
   back to flat colour rather than throwing (this whole harness proves it, but
   pin the fallback explicitly so a future edit cannot make document mandatory). */
console.log('\n== CITY STREAM: degrades without a DOM ==');
{
  const scene = newScene();
  const s = CS.create({ THREE, scene, seed: 7, radius: 1, budget: 8, lit: true });
  drain(s, 0, 0);
  const mats = new Set();
  scene.traverse((o) => { if (o.material) mats.add(o.material); });
  check('a full city builds with document === undefined', mats.size > 0 && scene.children.length === 8,
    mats.size + ' materials / ' + scene.children.length + ' chunks');
  check('every material fell back to flat colour (no canvas texture was made)',
    [...mats].every((m) => !m.map), [...mats].filter((m) => m.map).length + ' textured');
  s.dispose();
}
check('road material takes the canvas texture when a DOM is present',
  /map: roadTex \|\| null/.test(SRC) && /roadTex \? 0xffffff : 0x23272f/.test(SRC), '');

console.log('\n' + '='.repeat(60));
console.log('CITY STREAM QA: ' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('\nFAILURES:'); fails.forEach((f) => console.log('  - ' + f)); }
process.exit(fail ? 1 : 0);
