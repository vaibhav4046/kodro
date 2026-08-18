/* ============================================================================
   KODRO - streaming city chunks for the 3D CITY world.

   The authored city (buildCity in Viewport3D) is a single hand-placed block
   around the origin: one crossroad, the lesson's collidable buildings, the
   shared pedestrian and traffic agents. Past roughly +/-45 units it stopped,
   and the pupil looked out over an empty plane to a fog wall. The world read
   as a diorama on a table rather than a place.

   This module leaves that authored block exactly as it is - it owns chunk
   (0,0) and the streamer never builds there - and grows a deterministic city
   around it: a rolling window of chunks loaded ahead of the camera and freed
   behind it, so the horizon is always built and the pupil never reaches an
   edge.

   FIDELITY BOUNDARY, stated once and honestly: streamed chunks are SCENERY.
   They never enter the collidable obstacle set, are never seen by the sensor
   model, and are never graded. The robot drives inside the authored arena;
   what streams around it exists so the arena sits in a world instead of a
   void. Nothing here changes a lesson result, a collision or a sensor
   reading. This is not an open-world simulation and must not be described as
   one.

   Determinism: chunk content is a pure function of (ix, iz, seed). Leaving a
   chunk and coming back rebuilds it identically, so the city is stable rather
   than a slot machine, and the regression test can pin it.

   Cost control:
     - every chunk shares ONE pooled unit geometry per primitive and ONE
       pooled material per family, so a chunk is a transform tree and nothing
       else. Loading allocates no geometry; unloading frees none.
     - buildings, roofs, kerbs, trees and lamps are InstancedMesh, so a whole
       chunk of scenery is a handful of draw calls rather than a hundred.
     - streamed content neither casts nor receives shadows. The sun's shadow
       frustum is +/-120 units, so distant chunks fell outside it regardless;
       saying so explicitly keeps them out of the shadow pass entirely.
     - at most `budget` chunks are built per update, so crossing a chunk line
       costs a slice of a frame instead of a visible hitch.

   Plain JS, no JSX, no React, no DOM required (the canvas textures degrade to
   flat colour when there is no document). Loaded before Viewport3D in the
   bundle. Exposes window.KodroCityStream. Tested by scripts/qa_city_stream.mjs.
   ========================================================================== */
(function () {
  'use strict';

  // 100 units matches the city ground texture's tile size, so snapping the
  // ground to the chunk grid never shifts the painted road markings.
  var CHUNK = 100;
  var ROADW = 9;          // carriageway width, same as the authored crossroad
  var HALF = ROADW / 2;

  // --- deterministic PRNG -------------------------------------------------
  // A chunk's whole content derives from this, so (ix, iz) rebuilds
  // identically no matter which direction the camera arrived from.
  function hash2(ix, iz, seed) {
    var h = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul(seed | 0, 1442695041);
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- pooled textures ----------------------------------------------------
  // A lit-window facade and a dashed asphalt strip, drawn once and shared by
  // every chunk. Return null where there is no canvas (the headless test) and
  // callers fall back to flat colour rather than failing.
  function windowTexture(THREE, litProb, rnd) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    var cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    var c = cv.getContext && cv.getContext('2d');
    if (!c) return null;
    c.fillStyle = '#39404c'; c.fillRect(0, 0, 64, 64);
    for (var y = 0; y < 8; y++) {
      for (var x = 0; x < 8; x++) {
        c.fillStyle = rnd() < litProb ? 'rgba(255,226,160,0.92)' : 'rgba(24,29,38,0.85)';
        c.fillRect(x * 8 + 2, y * 8 + 2, 4, 5);
      }
    }
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  function roadTexture(THREE) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    var cv = document.createElement('canvas');
    cv.width = 32; cv.height = 128;
    var c = cv.getContext && cv.getContext('2d');
    if (!c) return null;
    c.fillStyle = '#23272f'; c.fillRect(0, 0, 32, 128);
    c.fillStyle = 'rgba(230,216,134,0.85)';           // centre dashes
    for (var i = 0; i < 128; i += 32) c.fillRect(15, i, 2, 18);
    c.fillStyle = 'rgba(232,236,242,0.30)';           // edge lines
    c.fillRect(2, 0, 1, 128); c.fillRect(29, 0, 1, 128);
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function create(opts) {
    opts = opts || {};
    var THREE = opts.THREE;
    var scene = opts.scene;
    if (!THREE || !scene) return null;

    var radius = opts.radius != null ? (opts.radius | 0) : 2;
    var keepRadius = radius + 1;            // hysteresis: no thrash on a boundary
    var budget = opts.budget != null ? Math.max(1, opts.budget | 0) : 1;
    var seed = (opts.seed != null ? opts.seed : 0x5eed) >>> 0;
    var traffic = !!opts.traffic;
    var lit = !!opts.lit;                   // dusk / night: lamps and bright windows
    var skipOrigin = opts.skipOrigin !== false;  // the authored block owns (0,0)

    // ---- pooled geometry (unit primitives, scaled per instance) ----
    var geo = {
      box: new THREE.BoxGeometry(1, 1, 1),
      plane: new THREE.PlaneGeometry(1, 1),
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
      ico: new THREE.IcosahedronGeometry(0.5, 0),
      sph: new THREE.SphereGeometry(0.5, 8, 6)
    };
    // Texture content is seeded too, so a session is reproducible end to end.
    var texRnd = mulberry32(hash2(7, 11, seed));
    var texes = [];
    var winTex = windowTexture(THREE, lit ? 0.8 : 0.45, texRnd);
    if (winTex) { winTex.repeat.set(2, 6); texes.push(winTex); }
    var roadTex = roadTexture(THREE);
    // Both road strips are the same 1x1 plane scaled (ROADW, CHUNK), so one
    // repeat serves both and the shared material stays shared.
    if (roadTex) { roadTex.repeat.set(1, CHUNK / 25); texes.push(roadTex); }

    var mat = {
      // white base: the per-instance colour carries the facade tint, so a
      // tinted material would multiply in twice and darken every building.
      facade: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, map: winTex || null }),
      roof: new THREE.MeshStandardMaterial({ color: 0x343b45, roughness: 1 }),
      road: new THREE.MeshStandardMaterial({ color: roadTex ? 0xffffff : 0x23272f, roughness: 0.95, map: roadTex || null }),
      kerb: new THREE.MeshStandardMaterial({ color: 0x6e737b, roughness: 1 }),
      trunk: new THREE.MeshStandardMaterial({ color: 0x6b4f2c, roughness: 1 }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x3a6b2a, roughness: 1, flatShading: true }),
      pole: new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.6, metalness: 0.4 }),
      bulb: new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffd9a0, emissiveIntensity: 1.4 })
    };
    // Small pooled palette so streamed traffic is not all one colour without
    // giving every car its own material.
    var carMats = [0x8d3b34, 0x2f4d6e, 0xb9bcc0, 0x33413a].map(function (c) {
      return new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.25 });
    });

    var chunks = new Map();     // "ix,iz" -> { group, cars: [] }
    var pending = [];           // queued [ix, iz, d2], nearest first
    var ci = 0, cz = 0;
    var started = false;
    var disposed = false;
    var builtCount = 0;         // lifetime chunks built (telemetry + tests)

    function key(ix, iz) { return ix + ',' + iz; }

    // One draw call for a whole family inside a chunk.
    // list entries are [x, y, z, sx, sy, sz].
    function instanced(group, geometry, material, list, colours) {
      if (!list.length) return null;
      var im = new THREE.InstancedMesh(geometry, material, list.length);
      im.castShadow = false; im.receiveShadow = false;
      var m = new THREE.Matrix4();
      var q = new THREE.Quaternion();
      var p = new THREE.Vector3();
      var s = new THREE.Vector3();
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        p.set(it[0], it[1], it[2]);
        s.set(it[3], it[4], it[5]);
        m.compose(p, q, s);
        im.setMatrixAt(i, m);
      }
      if (im.instanceMatrix) im.instanceMatrix.needsUpdate = true;
      if (colours && im.setColorAt) {
        var col = new THREE.Color();
        for (var j = 0; j < list.length; j++) { col.setHex(colours[j]); im.setColorAt(j, col); }
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
      group.add(im);
      return im;
    }

    // ---- one chunk ---------------------------------------------------------
    function buildChunk(ix, iz) {
      var k = key(ix, iz);
      if (chunks.has(k)) return;
      var rnd = mulberry32(hash2(ix, iz, seed));
      var group = new THREE.Group();
      group.position.set(ix * CHUNK, 0, iz * CHUNK);

      // Roads: a crossroad through this chunk's centre, so the grid reads as
      // one continuous street plan rather than a field of islands. Both use
      // the same 1x1 plane scaled (ROADW, CHUNK); the horizontal one is spun
      // about Y so its texture runs along the carriageway too.
      var rv = new THREE.Mesh(geo.plane, mat.road);
      rv.rotation.set(-Math.PI / 2, 0, 0);
      rv.scale.set(ROADW, CHUNK, 1); rv.position.y = 0.02;
      rv.castShadow = false; rv.receiveShadow = false; group.add(rv);
      var rh = new THREE.Mesh(geo.plane, mat.road);
      rh.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
      rh.scale.set(ROADW, CHUNK, 1); rh.position.y = 0.021;
      rh.castShadow = false; rh.receiveShadow = false; group.add(rh);

      // Kerbs framing the four quadrants.
      var lane = HALF + 1.2;
      var kerbs = [];
      var QUAD = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (var qi = 0; qi < QUAD.length; qi++) {
        var q = QUAD[qi];
        kerbs.push([q[0] * (lane + 0.3), 0.11, q[1] * CHUNK * 0.25, 0.6, 0.22, CHUNK * 0.42]);
        kerbs.push([q[0] * CHUNK * 0.25, 0.11, q[1] * (lane + 0.3), CHUNK * 0.42, 0.22, 0.6]);
      }
      instanced(group, geo.box, mat.kerb, kerbs, null);

      // Buildings: 1 to 3 lots per quadrant. Height falls off with distance
      // from the authored block, so the centre reads as downtown and the
      // outskirts as low-rise. That gradient is what sells a grid as a city.
      var tall = Math.max(0.34, 1.55 - Math.sqrt(ix * ix + iz * iz) * 0.30);
      var PALETTE = [0x8b94a1, 0x7d8794, 0x99a2ad, 0x6f7885, 0xa4a9b0, 0x848d99];
      var blds = [], roofs = [], cols = [];
      for (var q2 = 0; q2 < QUAD.length; q2++) {
        var qq = QUAD[q2];
        var n = 1 + ((rnd() * 3) | 0);
        for (var b = 0; b < n; b++) {
          var bw = 6 + rnd() * 9;
          var bh = (7 + rnd() * 30) * tall;
          var px = qq[0] * (lane + 4 + rnd() * (CHUNK * 0.42 - bw));
          var pz = qq[1] * (lane + 4 + rnd() * (CHUNK * 0.42 - bw));
          blds.push([px, bh / 2, pz, bw, bh, bw]);
          roofs.push([px, bh + 0.2, pz, bw * 1.06, 0.4, bw * 1.06]);
          cols.push(PALETTE[(rnd() * PALETTE.length) | 0]);
        }
      }
      instanced(group, geo.box, mat.facade, blds, cols);
      instanced(group, geo.box, mat.roof, roofs, null);

      // Street trees along the carriageway.
      var trunks = [], leaves = [];
      var nTree = 2 + ((rnd() * 4) | 0);
      for (var t = 0; t < nTree; t++) {
        var side = rnd() < 0.5 ? -1 : 1;
        var along = (rnd() - 0.5) * CHUNK * 0.8;
        var tx = side * (lane + 2.2), tz = along;
        if (rnd() < 0.5) { tx = along; tz = side * (lane + 2.2); }
        trunks.push([tx, 1.5, tz, 0.5, 3, 0.5]);
        leaves.push([tx, 3.8, tz, 2.8, 2.8, 2.8]);
      }
      instanced(group, geo.cyl, mat.trunk, trunks, null);
      instanced(group, geo.ico, mat.leaf, leaves, null);

      // After dark the lamp posts carry the street. Emissive bulbs only: a
      // real SpotLight per lamp would blow the light budget on an integrated
      // GPU, and at this distance the pool of light is not resolvable anyway.
      if (lit) {
        var poles = [], bulbs = [];
        for (var L = 0; L < 4; L++) {
          var lx = (L % 2 ? 1 : -1) * (lane + 0.9);
          var lz = (L < 2 ? 1 : -1) * CHUNK * 0.22;
          poles.push([lx, 3.25, lz, 0.2, 6.5, 0.2]);
          bulbs.push([lx, 6.6, lz, 0.44, 0.44, 0.44]);
        }
        instanced(group, geo.cyl, mat.pole, poles, null);
        instanced(group, geo.sph, mat.bulb, bulbs, null);
      }

      // One moving car per chunk: the cheapest thing that makes a street read
      // as inhabited rather than as an architectural model. Purely visual, it
      // is never in the collidable set and the robot cannot reach it.
      var cars = [];
      if (traffic) {
        var horiz = rnd() < 0.5;
        var dir = rnd() < 0.5 ? 1 : -1;
        var cm = carMats[(rnd() * carMats.length) | 0];
        var car = new THREE.Group();
        var body = new THREE.Mesh(geo.box, cm);
        body.scale.set(horiz ? 3.6 : 1.7, 0.9, horiz ? 1.7 : 3.6);
        body.position.y = 0.62; body.castShadow = false; car.add(body);
        var cab = new THREE.Mesh(geo.box, cm);
        cab.scale.set(horiz ? 1.8 : 1.4, 0.7, horiz ? 1.4 : 1.8);
        cab.position.y = 1.4; cab.castShadow = false; car.add(cab);
        group.add(car);
        cars.push({
          mesh: car, horiz: horiz, dir: dir,
          speed: 5 + rnd() * 7,
          offset: (rnd() - 0.5) * CHUNK,
          lane: dir * 2.2
        });
      }

      scene.add(group);
      chunks.set(k, { group: group, cars: cars });
      builtCount++;
    }

    // Unload frees the transform tree only. Geometry and materials are pooled
    // and shared with every other chunk, so disposing them here would blank
    // the rest of the city; they are freed once, in dispose(). The per-
    // instance attribute buffers are NOT pooled, so those do get freed.
    function unloadChunk(k) {
      var c = chunks.get(k);
      if (!c) return;
      scene.remove(c.group);
      c.group.traverse(function (o) {
        if (o.isInstancedMesh && o.dispose) o.dispose();
      });
      chunks.delete(k);
    }

    function enqueueRing() {
      pending.length = 0;
      for (var dx = -radius; dx <= radius; dx++) {
        for (var dz = -radius; dz <= radius; dz++) {
          var ix = ci + dx, iz = cz + dz;
          if (skipOrigin && ix === 0 && iz === 0) continue;
          if (chunks.has(key(ix, iz))) continue;
          pending.push([ix, iz, dx * dx + dz * dz]);
        }
      }
      pending.sort(function (a, b) { return a[2] - b[2]; });   // nearest first
    }

    /* Call once a frame with the world position the city should centre on
       (the robot, which is what the camera looks at) and the frame delta in
       seconds. Cheap: it only re-plans when the centre chunk actually
       changes. */
    function update(x, z, dts) {
      if (disposed) return;
      var nx = Math.round((x || 0) / CHUNK);
      var nz = Math.round((z || 0) / CHUNK);
      if (!started || nx !== ci || nz !== cz) {
        ci = nx; cz = nz; started = true;
        enqueueRing();
        var stale = [];
        chunks.forEach(function (_v, k) {
          var p = k.split(',');
          if (Math.max(Math.abs((+p[0]) - ci), Math.abs((+p[1]) - cz)) > keepRadius) stale.push(k);
        });
        for (var s = 0; s < stale.length; s++) unloadChunk(stale[s]);
      }
      // Amortised build: a slice per frame, so crossing a chunk line costs a
      // fraction of one frame instead of a visible stall.
      for (var b = 0; b < budget && pending.length; b++) {
        var next = pending.shift();
        buildChunk(next[0], next[1]);
      }
      if (traffic && dts) driveCars(dts);
    }

    function driveCars(dts) {
      var d = Math.min(0.1, dts);   // clamp: a backgrounded tab must not teleport traffic
      chunks.forEach(function (c) {
        for (var i = 0; i < c.cars.length; i++) {
          var car = c.cars[i];
          car.offset += car.dir * car.speed * d;
          if (car.offset > CHUNK / 2) car.offset -= CHUNK;
          else if (car.offset < -CHUNK / 2) car.offset += CHUNK;
          if (car.horiz) car.mesh.position.set(car.offset, 0, car.lane);
          else car.mesh.position.set(-car.lane, 0, car.offset);
        }
      });
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      var keys = [];
      chunks.forEach(function (_v, k) { keys.push(k); });
      for (var i = 0; i < keys.length; i++) unloadChunk(keys[i]);
      pending.length = 0;
      Object.keys(geo).forEach(function (g) { if (geo[g].dispose) geo[g].dispose(); });
      Object.keys(mat).forEach(function (m) { if (mat[m].dispose) mat[m].dispose(); });
      for (var c = 0; c < carMats.length; c++) if (carMats[c].dispose) carMats[c].dispose();
      for (var t = 0; t < texes.length; t++) if (texes[t].dispose) texes[t].dispose();
    }

    function stats() {
      return {
        loaded: chunks.size, pending: pending.length, built: builtCount,
        centre: [ci, cz], chunk: CHUNK, radius: radius
      };
    }

    return { update: update, dispose: dispose, stats: stats, CHUNK: CHUNK };
  }

  var api = { create: create, CHUNK: CHUNK, _hash2: hash2, _mulberry32: mulberry32 };
  if (typeof window !== 'undefined') window.KodroCityStream = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
