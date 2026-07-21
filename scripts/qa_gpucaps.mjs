/* Offline gate for the GPU capability probe (src/robolearn/assets/web/gpu-caps.js).
 *
 * The first-run quality tier is chosen from what actually rasterises the
 * pixels, not from CPU/RAM proxies. That decision has to keep working without
 * a browser in the loop, so the classifier is a pure string function and this
 * gate drives it directly under Node.
 *
 * Run: node scripts/qa_gpucaps.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'robolearn', 'assets', 'web', 'gpu-caps.js');

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(SRC, 'utf8'), ctx, { filename: 'gpu-caps.js' });

const C = ctx.window.KodroGpuCaps;

let pass = 0;
const failures = [];
function check(name, cond) {
  if (cond) { pass++; return; }
  failures.push(name);
}
function eq(name, got, want) {
  check(`${name} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`, got === want);
}

// ---- module surface -------------------------------------------------------
check('exports classifyRenderer', typeof C.classifyRenderer === 'function');
check('exports detect', typeof C.detect === 'function');
check('exports recommendedTier', typeof C.recommendedTier === 'function');

// ---- real software-rasteriser strings -------------------------------------
// These are verbatim UNMASKED_RENDERER_WEBGL values reported by the software
// paths this app is expected to survive on.
const SOFTWARE = [
  'Google SwiftShader',
  'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
  'Mesa OffScreen (LLVMpipe)',
  'llvmpipe (LLVM 15.0.7, 256 bits)',
  'Microsoft Basic Render Driver',
  'softpipe',
];
for (const s of SOFTWARE) eq(`software: ${s.slice(0, 40)}`, C.classifyRenderer(s), 'software');

// ---- real hardware strings ------------------------------------------------
// Critically these must NOT be misread as software: a wrong 'software' verdict
// would pin a capable machine to the Low tier forever.
const HARDWARE = [
  'ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'Apple M2',
  'Mali-G78',
  'Adreno (TM) 730',
];
for (const s of HARDWARE) eq(`hardware: ${s.slice(0, 40)}`, C.classifyRenderer(s), 'hardware');

// ---- absent / withheld renderer string ------------------------------------
// Some browsers withhold the string to resist fingerprinting. Absence is NOT
// evidence of software rendering and must not be reported as such, or every
// privacy-hardened browser gets silently pinned to Low.
eq('empty string -> unknown', C.classifyRenderer(''), 'unknown');
eq('whitespace -> unknown', C.classifyRenderer('   '), 'unknown');
eq('null -> unknown', C.classifyRenderer(null), 'unknown');
eq('undefined -> unknown', C.classifyRenderer(undefined), 'unknown');
eq('number -> unknown', C.classifyRenderer(42), 'unknown');
eq('object -> unknown', C.classifyRenderer({}), 'unknown');

// ---- case insensitivity ---------------------------------------------------
eq('uppercase swiftshader', C.classifyRenderer('GOOGLE SWIFTSHADER'), 'software');
eq('mixed case llvmpipe', C.classifyRenderer('Mesa LLVMpipe'), 'software');

// ---- tier recommendation: only ever lowers --------------------------------
const SW = { rendererClass: 'software', webglAvailable: true };
const HW = { rendererClass: 'hardware', webglAvailable: true };
const UNK = { rendererClass: 'unknown', webglAvailable: true };
const NOGL = { rendererClass: 'unknown', webglAvailable: false };

eq('software pins high -> low', C.recommendedTier('high', SW), 'low');
eq('software pins med -> low', C.recommendedTier('med', SW), 'low');
eq('software keeps low', C.recommendedTier('low', SW), 'low');
eq('no webgl -> low', C.recommendedTier('high', NOGL), 'low');

// Hardware must never be raised above what the CPU heuristic allowed: a strong
// GPU on a 2-core 2GB netbook is still a 2-core 2GB netbook.
eq('hardware keeps high', C.recommendedTier('high', HW), 'high');
eq('hardware does not raise med', C.recommendedTier('med', HW), 'med');
eq('hardware does not raise low', C.recommendedTier('low', HW), 'low');

// Unknown must be treated as "no evidence to lower on", not as software.
eq('unknown keeps high', C.recommendedTier('high', UNK), 'high');
eq('unknown keeps med', C.recommendedTier('med', UNK), 'med');

// Missing caps object must not throw or silently downgrade.
eq('missing caps keeps tier', C.recommendedTier('high', undefined), 'high');
eq('null caps keeps tier', C.recommendedTier('high', null), 'high');

// ---- detect() is safe with no DOM -----------------------------------------
// Under Node there is no document; detect() must degrade rather than throw,
// because it runs inside the quality useState initialiser.
let detectThrew = false;
let d = null;
try { d = C.detect(); } catch (e) { void e; detectThrew = true; }
check('detect() does not throw without a DOM', !detectThrew);
check('detect() returns an object', d && typeof d === 'object');
eq('detect() reports no webgl without a DOM', d && d.webglAvailable, false);
eq('detect() reports unknown class without a DOM', d && d.rendererClass, 'unknown');

// ---- wiring: the app must actually consult this ---------------------------
// A perfect classifier nobody calls is worthless, so assert the call site.
const appSrc = fs.readFileSync(path.join(ROOT, 'src', 'robolearn', 'assets', 'web', 'app.jsx'), 'utf8');
check('app.jsx calls KodroGpuCaps.detect', /KodroGpuCaps\s*&&\s*window\.KodroGpuCaps\.detect/.test(appSrc));
check('app.jsx uses recommendedTier for the first-run tier', /KodroGpuCaps\.recommendedTier\(/.test(appSrc));

// And the bundle actually ships it (build ORDER regression guard).
const orderSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'build_web.cjs'), 'utf8');
check('gpu-caps.js is in the build ORDER', /'gpu-caps\.js'/.test(orderSrc));

const bundle = fs.readFileSync(path.join(ROOT, 'src', 'robolearn', 'assets', 'web', 'bundle.js'), 'utf8');
check('bundle.js contains KodroGpuCaps', bundle.indexOf('KodroGpuCaps') !== -1);

// ---- honesty: fps figures must carry the renderer class -------------------
// A software fps number is not comparable to a hardware one. The performance
// report has to say which it measured, or any quoted figure overstates.
const vpSrc = fs.readFileSync(path.join(ROOT, 'src', 'robolearn', 'assets', 'web', 'Viewport3D.jsx'), 'utf8');
check('performance report carries rendererClass', /rendererClass:/.test(vpSrc));

// ---- resilience: a restored GPU context must be recoverable ---------------
check('webglcontextrestored is handled', /webglcontextrestored/.test(vpSrc));
check('restore listener is cleaned up', /removeEventListener\('webglcontextrestored'/.test(vpSrc));
check('host remounts on restore', /kodro-webgl-restored/.test(appSrc));

if (failures.length) {
  console.error(`qa_gpucaps: ${failures.length} FAILED, ${pass} passed`);
  for (const f of failures) console.error('  FAIL ' + f);
  process.exitCode = 1;
} else {
  console.log(`${pass} passed`);
}
