/* Ambient life: small, cheap, characterful per-world motion so a world reads
 * as alive rather than a still stage set. All procedural (boxes, cones,
 * triangles, point clouds -- no assets), all driven by the host viewport's ONE
 * clock through update(t, dt), and every object is a child of the scene so the
 * viewport's existing teardown traverse disposes the geometry and materials.
 *
 * Per world (full tier):
 *   earth      -- circling birds (flap-glide, banking) + drifting butterflies
 *   city       -- gulls over the rooftops (birds only; street life is agents)
 *   mars       -- drifting fine dust + an occasional rotating dust devil
 *   underwater -- rising bubbles + a boids-lite fish school (cohesion+separation)
 *   space      -- slow-tumbling debris chunks + a distant glinting satellite
 *   room       -- a cat that wanders between waypoints and sits + swaying curtains
 *
 * Mission sites override the base world's life through SITE_LIFE (W4): a
 * per-site gating table (no butterflies at minus 55 C Antarctica) plus two
 * recolour variants reusing existing systems -- blowing snow (the dust drift,
 * recoloured white) and steam vents (the dust devil, slowed and paled).
 *
 * Gates (non-negotiable):
 *   - the host does NOT build this at all under prefers-reduced-motion;
 *   - quality low keeps only the cheapest system per world (no boids, no
 *     butterflies); a live drop to low also hides the extras (checked each
 *     update from window.KODRO_QUALITY);
 *   - update() reuses preallocated vectors and arrays: no per-frame allocation.
 *
 *   window.KodroAmbient.build(THREE, scene, worldId, {quality, siteId})
 *     -> { update(t, dt), dispose(), flags: [system names] } | null
 */
(function () {
  // W4: per-site ambient-life gating. Keys override the base world's defaults;
  // a missing key keeps the base behaviour. This is what stops butterflies
  // flitting over the Ross Ice Shelf and puts steam vents on a lava field.
  const SITE_LIFE = {
    sahara: { butterflies: false },
    india: { butterflies: false },
    egypt: { butterflies: false },
    kenya: {},
    // The rainforest's birds are parrots (warm red, named for the harness)
    // and the understorey carries more butterflies than a temperate field.
    amazon: { birdColor: 0xc84a30, birdName: 'parrots', butterflies: 7 },
    japan: {},
    antarctica: { birds: false, butterflies: false, snow: true },
    nepal: { butterflies: false, snow: true },
    iceland: { birds: false, butterflies: false, steam: true },
    reef: {},
    // 10994 m down: no fish school, no rising bubbles -- marine snow drifting
    // DOWN through the robot's headlight beam is the trench's only life.
    mariana: { fish: false, bubbles: false, marinesnow: true },
    // Thinner dust for the altitude (the caldera sits above most of the
    // atmosphere); the storm toggle trebles whatever this leaves.
    olympus: { dustMul: 0.45 },
    tycho: {},
    europa: {},
  };
  // What each base world runs when no site overrides it.
  const BASE_LIFE = {
    earth: { birds: true, butterflies: true },
    city: { gulls: true },
    mars: { dust: true, devil: true },
    underwater: { bubbles: true, fish: true },
    space: { debris: true, satellite: true },
    room: { cat: true, curtains: true },
  };

  function build(THREE, scene, worldId, opts) {
    if (!THREE || !scene) return null;
    opts = opts || {};
    const sid = opts.siteId;
    // Indoor test bays (lab/warehouse/debug) resolve to the room base but are
    // working spaces: no cat, no curtains.
    if (sid === 'lab' || sid === 'warehouse' || sid === 'debug_grid') return null;
    const low = (opts.quality || 'high') === 'low';

    // Two layers: `base` always animates; `extra` is the richer set that a low
    // tier never builds and a live drop to low hides mid-session.
    const root = new THREE.Group();
    const baseGrp = new THREE.Group();
    const extraGrp = new THREE.Group();
    root.add(baseGrp); root.add(extraGrp);
    const systems = []; // { fn(t, dt), extra: bool, name: string }
    // Shared scratch vectors so update() never allocates.
    const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();

    // R1: a 16x16 radial-gradient sprite so point particles render as ROUND
    // dots (bubbles, dust, snow) instead of the square unmasked default.
    // Built lazily per scene so the teardown traverse owns its disposal via
    // the materials that reference it; null (headless) keeps the old squares.
    let dotTex;
    const roundDot = () => {
      if (dotTex !== undefined) return dotTex;
      dotTex = null;
      try {
        if (typeof document !== 'undefined' && document.createElement) {
          const cv = document.createElement('canvas'); cv.width = cv.height = 16;
          const c2 = cv.getContext('2d');
          if (c2) {
            const g = c2.createRadialGradient(8, 8, 0, 8, 8, 8);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.55, 'rgba(255,255,255,0.7)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c2.fillStyle = g; c2.fillRect(0, 0, 16, 16);
            dotTex = new THREE.CanvasTexture(cv);
          }
        }
      } catch (e) { dotTex = null; }
      return dotTex;
    };

    // One triangle (three verts), the whole wing budget for a bird/butterfly.
    const triGeo = (chord, span, lift) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-chord / 2, 0, 0, chord / 2, 0, 0, 0, lift, span], 3));
      return g;
    };

    // ---- birds: wandering orbits, banking into turns, flap-glide (R3) -------
    function birds(n, colorHex, name) {
      const geo = triGeo(0.95, 1.6, 0.1);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex != null ? colorHex : 0x2c3038, side: THREE.DoubleSide });
      const flock = [];
      for (let i = 0; i < n; i++) {
        const b = new THREE.Group();
        // Wings hang off an inner group so banking (roll about the flight
        // axis, local +x) composes cleanly under the outer yaw.
        const bank = new THREE.Group(); b.add(bank);
        const wR = new THREE.Mesh(geo, mat); bank.add(wR);
        const wL = new THREE.Mesh(geo, mat); wL.scale.z = -1; bank.add(wL);
        b.scale.setScalar(0.8 + Math.random() * 0.5); // size scatter 0.8..1.3
        baseGrp.add(b);
        flock.push({
          b, bank, wR, wL,
          cx: (Math.random() - 0.5) * 18, cz: (Math.random() - 0.5) * 18,
          r: 13 + Math.random() * 9, h: 12 + Math.random() * 7,
          w: (0.14 + Math.random() * 0.1) * (i % 2 ? 1 : -1),
          ph: Math.random() * 6.28, fq: 6 + Math.random() * 2.5,
          wob: 0.6 + Math.random() * 0.5, glide: 0, bankNow: 0,
        });
      }
      systems.push({ extra: false, name: name || (colorHex != null ? 'gulls' : 'birds'), fn: (t, dt) => {
        const k1 = Math.min(1, (dt || 0.016) * 3);
        const k2 = Math.min(1, (dt || 0.016) * 2.5);
        for (let i = 0; i < flock.length; i++) {
          const k = flock[i];
          const ang = t * k.w + k.ph;
          // wandering orbit: the radius breathes on two incommensurate sines
          // so no two laps trace the same circle
          const rr = k.r * (1 + 0.16 * Math.sin(t * 0.171 * k.wob + k.ph) + 0.1 * Math.sin(t * 0.293 * k.wob + k.ph * 1.7));
          const x = k.cx + Math.cos(ang) * rr, z = k.cz + Math.sin(ang) * rr;
          k.b.position.set(x, k.h + Math.sin(t * 0.5 + k.ph) * 1.1, z);
          // face along the tangent of the circle (forward = local +x)
          const vx = -Math.sin(ang) * k.w, vz = Math.cos(ang) * k.w;
          k.b.rotation.y = Math.atan2(-vz, vx);
          // bank INTO the turn: for this yaw convention local +z is the bird's
          // right and the orbit centre sits to its left when w > 0, so roll
          // negative (left wing down) when circling anticlockwise.
          const bankT = -(k.w > 0 ? 1 : -1) * Math.min(0.42, k.w * k.w * rr * 2.2);
          k.bankNow += (bankT - k.bankNow) * k1;
          k.bank.rotation.x = k.bankNow;
          // flap-glide state machine: flap while climbing, hold a shallow V
          // while descending (vy is the derivative of the height sine)
          const vy = 0.55 * Math.cos(t * 0.5 + k.ph);
          k.glide += ((vy < -0.12 ? 1 : 0) - k.glide) * k2;
          const amp = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.33 + k.ph * 2));
          const f = Math.sin(t * k.fq + k.ph) * amp * (1 - k.glide);
          const vhold = 0.26 * k.glide; // shallow-V wing hold while gliding
          k.wR.rotation.x = -f - vhold;
          k.wL.rotation.x = f + vhold;
        }
      } });
    }
    function butterflies(n) {
      const geo = triGeo(0.34, 0.5, 0.05);
      const mats = [
        new THREE.MeshBasicMaterial({ color: 0xe08a3a, side: THREE.DoubleSide }),
        new THREE.MeshBasicMaterial({ color: 0x9a6fd0, side: THREE.DoubleSide }),
      ];
      const flit = [];
      for (let i = 0; i < n; i++) {
        const m = mats[i % mats.length];
        const b = new THREE.Group();
        const wR = new THREE.Mesh(geo, m); b.add(wR);
        const wL = new THREE.Mesh(geo, m); wL.scale.z = -1; b.add(wL);
        extraGrp.add(b);
        const a = Math.random() * 6.28, d = 7 + Math.random() * 7;
        flit.push({ b, wR, wL, hx: Math.cos(a) * d, hz: Math.sin(a) * d, ph: Math.random() * 6.28, fq: 9 + Math.random() * 4 });
      }
      systems.push({ extra: true, name: 'butterflies', fn: (t) => {
        for (let i = 0; i < flit.length; i++) {
          const k = flit[i];
          const x = k.hx + Math.sin(t * 0.5 + k.ph) * 2.4 + Math.sin(t * 1.7 + k.ph) * 0.5;
          const z = k.hz + Math.cos(t * 0.43 + k.ph) * 2.2;
          const f = Math.sin(t * k.fq + k.ph);
          k.b.position.set(x, 0.9 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.9 + k.ph)) + Math.abs(f) * 0.06, z);
          const dx = 1.2 * Math.cos(t * 0.5 + k.ph) + 0.85 * Math.cos(t * 1.7 + k.ph);
          const dz = -0.95 * Math.sin(t * 0.43 + k.ph);
          k.b.rotation.y = Math.atan2(-dz, dx);
          const fb = f * 1.05 + 0.12;
          k.wR.rotation.x = -fb; k.wL.rotation.x = fb;
        }
      } });
    }

    // ---- wind-borne particle drift: Mars dust, and blowing snow (W4) --------
    function windDrift(n, name, colorHex, size, opacity, speedMul) {
      const g = new THREE.BufferGeometry();
      const arr = new Float32Array(n * 3);
      const spd = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = (Math.random() - 0.5) * 90;
        arr[i * 3 + 1] = 0.3 + Math.random() * 6.5;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 90;
        spd[i] = (1.6 + Math.random() * 2.2) * (speedMul || 1);
      }
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const mat = new THREE.PointsMaterial({ color: colorHex, size, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
      const dot = roundDot();
      if (dot) { mat.map = dot; mat.alphaTest = 0.02; } // R1: round sprites, not squares
      const pts = new THREE.Points(g, mat);
      pts.frustumCulled = false; // points drift beyond the initial bounds
      baseGrp.add(pts);
      systems.push({ extra: false, name, fn: (t, dt) => {
        const p = g.attributes.position.array;
        for (let i = 0; i < n; i++) {
          p[i * 3] += spd[i] * dt;                     // wind blows +x
          p[i * 3 + 2] += spd[i] * 0.22 * dt;          // with a slight slew
          if (p[i * 3] > 45) p[i * 3] = -45;
          if (p[i * 3 + 2] > 45) p[i * 3 + 2] = -45;
        }
        g.attributes.position.needsUpdate = true;
      } });
    }
    const marsDust = (n, spd) => windDrift(n, 'dust', 0xd9a06a, 0.32, 0.35, spd || 1);
    // Blowing snow: the same drift, recoloured white and pushed harder.
    const snow = (n) => windDrift(n, 'snow', 0xeaf2f8, 0.26, 0.5, 1.5);
    function dustDevil() {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 15, 9, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xc98a5a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
      );
      cone.position.y = 7.5; cone.visible = false;
      extraGrp.add(cone);
      systems.push({ extra: true, name: 'devil', fn: (t, dt) => {
        // life cycle: fades in, wanders while spinning, fades out, rests
        const cyc = Math.sin(t * 0.07 + 1.3);
        const op = Math.max(0, cyc - 0.15) / 0.85 * 0.18;
        cone.visible = op > 0.004;
        if (!cone.visible) return;
        cone.material.opacity = op;
        cone.rotation.y += dt * 6;
        cone.position.x = 8 + Math.sin(t * 0.043) * 24;
        cone.position.z = -6 + Math.cos(t * 0.05) * 20;
        cone.rotation.z = 0.05 * Math.sin(t * 0.5);
      } });
    }
    // Steam vents (W4): the dust devil recoloured and slowed into a plume that
    // rises from a fixed fissure instead of wandering. Two vents per field.
    function steamVents() {
      const spots = [[13, -9], [-17, 11]];
      const cones = [];
      for (let i = 0; i < spots.length; i++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(1.6, 12, 8, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xc6d0d8, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
        );
        cone.position.set(spots[i][0], 6, spots[i][1]);
        extraGrp.add(cone);
        cones.push({ cone, ph: i * 2.4 });
      }
      systems.push({ extra: true, name: 'steam', fn: (t, dt) => {
        for (let i = 0; i < cones.length; i++) {
          const k = cones[i];
          k.cone.rotation.y += dt * 1.4; // slow twist, not a vortex
          k.cone.material.opacity = 0.08 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.6 + k.ph));
          const s = 1 + 0.08 * Math.sin(t * 0.45 + k.ph);
          k.cone.scale.set(s, 1 + 0.05 * Math.sin(t * 0.3 + k.ph), s);
        }
      } });
    }

    // Marine snow (mariana): organic flecks sinking slowly through the dark,
    // the inverse of the bubble column -- the trench's only visible life,
    // caught in the robot's headlight beam. Base tier: it IS the site.
    function marineSnow(n) {
      const g = new THREE.BufferGeometry();
      const arr = new Float32Array(n * 3);
      const spd = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = (Math.random() - 0.5) * 44;
        arr[i * 3 + 1] = Math.random() * 14;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 44;
        spd[i] = 0.35 + Math.random() * 0.5;
      }
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const mat = new THREE.PointsMaterial({ color: 0xcfd8dc, size: 0.17, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true });
      const dot = roundDot();
      if (dot) { mat.map = dot; mat.alphaTest = 0.02; }
      const pts = new THREE.Points(g, mat);
      pts.frustumCulled = false;
      baseGrp.add(pts);
      systems.push({ extra: false, name: 'marinesnow', fn: (t, dt) => {
        const p = g.attributes.position.array;
        for (let i = 0; i < n; i++) {
          p[i * 3 + 1] -= spd[i] * dt;
          if (p[i * 3 + 1] < 0.1) p[i * 3 + 1] = 14;
          p[i * 3] += Math.sin(t * 0.5 + i * 2.1) * 0.5 * dt; // lazy sideways sway
        }
        g.attributes.position.needsUpdate = true;
      } });
    }

    // ---- underwater: bubbles rising, a small school keeping loosely together --
    function bubbles(n) {
      const g = new THREE.BufferGeometry();
      const arr = new Float32Array(n * 3);
      const baseX = new Float32Array(n);
      const spd = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        baseX[i] = (Math.random() - 0.5) * 38;
        arr[i * 3] = baseX[i];
        arr[i * 3 + 1] = Math.random() * 14;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 38;
        spd[i] = 0.9 + Math.random() * 1.4;
      }
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const mat = new THREE.PointsMaterial({ color: 0xcfeef7, size: 0.34, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true });
      const dot = roundDot();
      if (dot) { mat.map = dot; mat.alphaTest = 0.02; } // R1: round bubbles
      const pts = new THREE.Points(g, mat);
      pts.frustumCulled = false;
      baseGrp.add(pts);
      systems.push({ extra: false, name: 'bubbles', fn: (t, dt) => {
        const p = g.attributes.position.array;
        for (let i = 0; i < n; i++) {
          p[i * 3 + 1] += spd[i] * dt;
          if (p[i * 3 + 1] > 15) p[i * 3 + 1] = 0.3;
          p[i * 3] = baseX[i] + Math.sin(t * 1.8 + i * 1.7) * 0.2; // wobble
        }
        g.attributes.position.needsUpdate = true;
      } });
    }
    function fishSchool(n) {
      const geo = new THREE.ConeGeometry(0.22, 0.85, 5);
      geo.rotateX(Math.PI / 2); // nose forward (+z) so lookAt() aims the fish
      const mat = new THREE.MeshStandardMaterial({ color: 0x8fc3cf, roughness: 0.6, metalness: 0.3, emissive: 0x1d4a55, emissiveIntensity: 0.35, flatShading: true });
      const fish = [];
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(geo, mat);
        extraGrp.add(m);
        fish.push({
          m,
          p: new THREE.Vector3((Math.random() - 0.5) * 8, 4 + Math.random() * 3, (Math.random() - 0.5) * 8),
          v: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).multiplyScalar(3),
        });
      }
      systems.push({ extra: true, name: 'fish', fn: (t, dt) => {
        // boids-lite: cohesion toward the school centre + a slowly circling
        // anchor, separation from close neighbours. No alignment (cheap on
        // purpose) -- the speed clamp keeps the motion fluid anyway.
        V1.set(0, 0, 0);
        for (let i = 0; i < fish.length; i++) V1.add(fish[i].p);
        V1.divideScalar(fish.length);
        const ax = Math.cos(t * 0.11) * 13, az = Math.sin(t * 0.11) * 13;
        const ay = 5.2 + Math.sin(t * 0.07) * 1.6;
        for (let i = 0; i < fish.length; i++) {
          const f = fish[i];
          V2.set(ax, ay, az).sub(f.p).multiplyScalar(0.5);           // anchor pull
          V3.copy(V1).sub(f.p).multiplyScalar(0.35); V2.add(V3);     // cohesion
          for (let j = 0; j < fish.length; j++) {                    // separation
            if (j === i) continue;
            V3.copy(f.p).sub(fish[j].p);
            const d = V3.length();
            if (d > 0.001 && d < 1.6) { V3.multiplyScalar((1.6 - d) / (d * d) * 2.2); V2.add(V3); }
          }
          if (f.p.y < 2.2) V2.y += 3; else if (f.p.y > 9.5) V2.y -= 3; // stay off floor/surface
          f.v.addScaledVector(V2, dt);
          const sp = f.v.length();
          if (sp > 4.5) f.v.multiplyScalar(4.5 / sp);
          else if (sp < 1.8 && sp > 0.001) f.v.multiplyScalar(1.8 / sp);
          f.p.addScaledVector(f.v, dt);
          f.m.position.copy(f.p);
          V3.copy(f.p).add(f.v);
          f.m.lookAt(V3);
        }
      } });
    }

    // ---- space: tumbling debris and a far satellite that catches the sun -----
    function debris(n) {
      const geo = new THREE.DodecahedronGeometry(0.9, 0);
      const mat = new THREE.MeshStandardMaterial({ color: 0x6a6d76, roughness: 1, flatShading: true });
      const rocks = [];
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.scale.setScalar(0.7 + Math.random() * 0.9);
        baseGrp.add(m);
        rocks.push({ m, r: 18 + Math.random() * 14, h: 6 + Math.random() * 7, w: (0.015 + Math.random() * 0.015) * (i % 2 ? 1 : -1), ph: Math.random() * 6.28, rx: 0.2 + Math.random() * 0.3, ry: 0.15 + Math.random() * 0.3 });
      }
      systems.push({ extra: false, name: 'debris', fn: (t) => {
        for (let i = 0; i < rocks.length; i++) {
          const k = rocks[i];
          const ang = t * k.w + k.ph;
          k.m.position.set(Math.cos(ang) * k.r, k.h + Math.sin(t * 0.05 + k.ph) * 1.5, Math.sin(ang) * k.r);
          k.m.rotation.x = t * k.rx + k.ph;
          k.m.rotation.y = t * k.ry;
        }
      } });
    }
    function satellite() {
      const sat = new THREE.Group();
      const bodyM = new THREE.MeshBasicMaterial({ color: 0xb9c2d4, fog: false });
      const panelM = new THREE.MeshBasicMaterial({ color: 0x4a6fb5, fog: false, side: THREE.DoubleSide });
      sat.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 1.1), bodyM));
      const pan = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.8), panelM); sat.add(pan);
      extraGrp.add(sat);
      systems.push({ extra: true, name: 'satellite', fn: (t) => {
        const ang = t * 0.012 + 0.8;
        sat.position.set(Math.cos(ang) * 210, 95 + Math.sin(t * 0.009) * 25, Math.sin(ang) * 210);
        sat.rotation.y = t * 0.05;
        // glint: a sharp periodic flare as its panels catch the sun
        const g = Math.pow(Math.max(0, Math.sin(t * 0.35 + 1)), 24);
        sat.scale.setScalar(2.2 * (1 + g * 2.4));
      } });
    }

    // ---- room: a wandering cat with a sit habit, and curtains in a draught ---
    function cat() {
      const furM = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 });
      const grp = new THREE.Group();
      const torso = new THREE.Group(); torso.position.y = 0.55; grp.add(torso);
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.42, 0.4), furM); body.castShadow = true; torso.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.32), furM); head.position.set(0.62, 0.2, 0); head.castShadow = true; torso.add(head);
      const earGeo = new THREE.ConeGeometry(0.07, 0.16, 4);
      [-0.1, 0.1].forEach((z) => { const e = new THREE.Mesh(earGeo, furM); e.position.set(0.6, 0.42, z); torso.add(e); });
      const tail = new THREE.Group(); tail.position.set(-0.5, 0.1, 0); torso.add(tail);
      const tailM = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.55, 5), furM);
      tailM.position.set(-0.14, 0.24, 0); tailM.rotation.z = 0.6; tail.add(tailM);
      const legGeo = new THREE.BoxGeometry(0.09, 0.34, 0.09);
      const legs = [];
      [[0.38, 0.13], [0.38, -0.13], [-0.38, 0.13], [-0.38, -0.13]].forEach((p) => {
        const l = new THREE.Mesh(legGeo, furM); l.position.set(p[0], -0.32, p[1]); torso.add(l); legs.push(l);
      });
      baseGrp.add(grp);
      const WPS = [[8, 6], [-6, 13], [15, -4], [-19, 3], [3, -9], [-12, -17]];
      const st = { x: 8, z: 6, heading: 0, wp: 1, mode: 'walk', sitT: 0, sitLean: 0 };
      grp.position.set(st.x, 0, st.z);
      systems.push({ extra: false, name: 'cat', fn: (t, dt) => {
        const k = Math.min(1, dt * 4);
        if (st.mode === 'walk') {
          const tx = WPS[st.wp][0], tz = WPS[st.wp][1];
          const dx = tx - st.x, dz = tz - st.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.5) {
            if (Math.random() < 0.6) { st.mode = 'sit'; st.sitT = 2.5 + Math.random() * 2.5; }
            let nxt = (Math.random() * WPS.length) | 0;
            if (nxt === st.wp) nxt = (nxt + 1) % WPS.length;
            st.wp = nxt;
          } else {
            // 3D yaw convention: +x forward, so heading = atan2(-dz, dx)
            let want = Math.atan2(-dz, dx) - st.heading;
            while (want > Math.PI) want -= Math.PI * 2; while (want < -Math.PI) want += Math.PI * 2;
            st.heading += want * Math.min(1, dt * 3);
            st.x += Math.cos(st.heading) * 2.0 * dt;
            st.z += -Math.sin(st.heading) * 2.0 * dt;
          }
          st.sitLean += (0 - st.sitLean) * k;
          torso.position.y = 0.55 + Math.abs(Math.sin(t * 7)) * 0.03;   // trot bob
          const lp = Math.sin(t * 7) * 0.35;
          legs[0].rotation.z = lp; legs[1].rotation.z = -lp; legs[2].rotation.z = -lp; legs[3].rotation.z = lp;
          tail.rotation.x = Math.sin(t * 2.5) * 0.2;
        } else {
          st.sitT -= dt;
          st.sitLean += (0.5 - st.sitLean) * k;
          torso.position.y += (0.46 - torso.position.y) * k;
          legs[0].rotation.z *= 0.9; legs[1].rotation.z *= 0.9; legs[2].rotation.z *= 0.9; legs[3].rotation.z *= 0.9;
          tail.rotation.x = Math.sin(t * 1.4) * 0.3;                    // idle tail flick
          if (st.sitT <= 0) st.mode = 'walk';
        }
        torso.rotation.z = st.sitLean;   // nose up, haunches down when sitting
        grp.position.set(st.x, 0, st.z);
        grp.rotation.y = st.heading;
      } });
    }
    function curtains() {
      const geo = new THREE.PlaneGeometry(2.0, 5.4);
      const mat = new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 1, side: THREE.DoubleSide });
      const pivots = [];
      [-7.9, -0.1].forEach((z, i) => {
        const pv = new THREE.Group(); pv.position.set(29.45, 10.7, z);
        const panel = new THREE.Mesh(geo, mat); panel.rotation.y = -Math.PI / 2; panel.position.y = -2.7;
        pv.add(panel); extraGrp.add(pv);
        pivots.push({ pv, ph: i * 2.1 });
      });
      systems.push({ extra: true, name: 'curtains', fn: (t) => {
        for (let i = 0; i < pivots.length; i++) {
          const k = pivots[i];
          k.pv.rotation.z = 0.045 * Math.sin(t * 0.6 + k.ph) + 0.02 * Math.sin(t * 1.7 + k.ph);
        }
      } });
    }

    // Resolve this scene's life: the base world's defaults overridden by the
    // site gating table (W4). Missing keys keep the base behaviour.
    const life = Object.assign({}, BASE_LIFE[worldId] || {}, (sid && SITE_LIFE[sid]) || {});
    // R10: the weather toggle reuses these systems -- global snow outdoors,
    // trebled faster dust in a Mars storm (the devil hides inside a storm).
    const wthr = opts.weather || 'clear';
    if (worldId === 'earth' || worldId === 'city') {
      if (life.gulls) birds(low ? 2 : 3, 0xd8dee6, 'gulls');   // R3: city gulls
      if (life.birds) birds(low ? 2 : 3, life.birdColor != null ? life.birdColor : null, life.birdName || null);
      if (life.butterflies && !low) butterflies(typeof life.butterflies === 'number' ? life.butterflies : 4);
      if (life.snow || wthr === 'snow') snow(low ? 140 : 280);
      if (life.steam && !low) steamVents();
    } else if (worldId === 'mars') {
      const storm = wthr === 'storm' && !low;
      if (life.dust) marsDust(Math.round((low ? 160 : 320) * (life.dustMul || 1) * (storm ? 3 : 1)), storm ? 2.6 : 1);
      if (life.devil && !low && !storm) dustDevil();
    } else if (worldId === 'underwater') {
      if (life.bubbles !== false) bubbles(low ? 24 : 44);
      if (life.fish !== false && !low) fishSchool(10);
      if (life.marinesnow) marineSnow(low ? 90 : 170);
    } else if (worldId === 'space') {
      if (life.debris) debris(low ? 2 : 3);
      if (life.satellite && !low) satellite();
    } else if (worldId === 'room') {
      if (life.cat) cat();
      if (life.curtains && !low) curtains();
    } else return null;
    if (!systems.length) return null;

    extraGrp.visible = !low;
    scene.add(root);
    let alive = true;
    return {
      update(t, dt) {
        if (!alive) return;
        // A live quality drop to low hides + skips the extras mid-session.
        const lowNow = ((typeof window !== 'undefined' && window.KODRO_QUALITY) || opts.quality) === 'low';
        if (extraGrp.visible !== !lowNow) extraGrp.visible = !lowNow;
        for (let i = 0; i < systems.length; i++) {
          if (lowNow && systems[i].extra) continue;
          systems[i].fn(t, dt);
        }
      },
      // What actually got built, for the harness (mount.dataset.ambient) and
      // the W4 acceptance asserts (no butterflies on the Ross Ice Shelf).
      flags: systems.map((s) => s.name),
      // Stop animating. The meshes stay in the scene ON PURPOSE: the viewport's
      // teardown traverse is the single owner of geometry/material disposal.
      dispose() { alive = false; systems.length = 0; },
    };
  }

  window.KodroAmbient = { build };
})();
