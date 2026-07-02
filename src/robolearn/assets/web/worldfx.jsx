/* World FX: per-site identity landmarks, underwater optics, weather and
 * time-of-day presets for the 3D viewport. All procedural (vendored Three.js
 * r137 core primitives plus canvas textures), zero downloaded assets, zero
 * network. Every mesh is added as a scene child so the viewport's existing
 * teardown traverse (the single owner of disposal) frees geometry, materials
 * and canvas textures. update() paths reuse closures and typed arrays: no
 * per-frame allocation. Heavy layers gate on quality tier; anything that
 * moves respects the caller's reduce flag (the caller simply skips update()).
 *
 *   window.KodroWorldFX.landmarks(THREE, scene, ctx)  -> {update,names}|null
 *   window.KodroWorldFX.underwater(THREE, scene, ctx) -> {update,flags}|null
 *   window.KodroWorldFX.weather(THREE, scene, ctx)    -> {update,flag,wet}|null
 *   window.KodroWorldFX.todShift(tod)                 -> descriptor|null
 *   window.KodroWorldFX.applyTod(terrain, tod, weather) -> terrain'
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // R8: time-of-day presets. todShift() returns the colour/intensity
  // descriptor Viewport3D folds into its sky, fog, dome and lights at build
  // time; applyTod() is the app-side half that scales terrain.env.light so
  // the LIGHT gauge, the sensors and the picture all agree (the product's
  // honesty promise). Noon is the identity: zero change to any baseline.
  // ---------------------------------------------------------------------
  const TOD_PRESETS = {
    dawn: { sky: ['#ffb890', 0.28], fog: ['#ffc9a0', 0.22], sun: ['#ffb070', 0.5], sunMul: 0.9, hemiMul: 0.8, sunPos: [70, 20, 14], light: 0.78 },
    dusk: { sky: ['#b05a34', 0.4], fog: ['#b06a48', 0.34], sun: ['#ff9550', 0.6], sunMul: 0.7, hemiMul: 0.6, sunPos: [-64, 16, 28], light: 0.62 },
    night: { sky: ['#070d1c', 0.86], fog: ['#080e1c', 0.8], sun: ['#9fb6e8', 0.7], sunMul: 0.22, hemiMul: 0.34, sunPos: [-30, 55, -40], light: 0.2 },
  };
  const WEATHER_LIGHT = { storm: 0.45, rain: 0.75, snow: 0.85 };

  function todShift(tod) {
    return TOD_PRESETS[tod] || null;
  }

  // Pure: returns a NEW terrain object with env.light scaled by the active
  // preset and the tod/weather tags stamped on for the viewport. Indoor
  // bases (room) have no sky, so presets do not apply there. Weather only
  // dims where it can actually render (storm on Mars, rain/snow outdoors).
  function applyTod(terrain, tod, weather) {
    if (!terrain) return terrain;
    const indoor = terrain.id === 'room';
    const p = !indoor && TOD_PRESETS[tod];
    const wOk = !indoor && weather && weather !== 'clear'
      && ((weather === 'storm' && terrain.id === 'mars')
        || ((weather === 'rain' || weather === 'snow') && (terrain.id === 'earth' || terrain.id === 'city')));
    if (!p && !wOk) return terrain;
    let light = (terrain.env && terrain.env.light != null) ? terrain.env.light : 100;
    if (p) light *= p.light;
    if (wOk) light *= WEATHER_LIGHT[weather] || 1;
    return {
      ...terrain,
      env: { ...terrain.env, light: Math.round(light) },
      tod: p ? tod : 'noon',
      weather: wOk ? weather : 'clear',
    };
  }

  // ---------------------------------------------------------------------
  // Per-site landmarks: the one-off identity props the obstacle-driven prop
  // kits cannot place (a torii gate, prayer flags, Jupiter, Tycho's rays).
  // ctx: { THREE-free } { sid, id, groundY(wx,wz), lightK, fogColor, quality }
  // ---------------------------------------------------------------------
  function landmarks(THREE, scene, ctx) {
    const sid = ctx.sid;
    if (!sid) return null;
    const gy = ctx.groundY || (() => 0);
    const names = [];
    const updates = [];
    const std = (params) => new THREE.MeshStandardMaterial(params);

    if (sid === 'japan') {
      // A torii gate: two pillars, a curved-read double lintel, black caps.
      const red = std({ color: 0xc03a2b, roughness: 0.7 });
      const dark = std({ color: 0x1c1a20, roughness: 0.8 });
      const gate = new THREE.Group();
      [-2.2, 2.2].forEach((z) => {
        const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 6.2, 10), red);
        pil.position.set(0, 3.1, z); pil.castShadow = true; gate.add(pil);
      });
      const kasagi = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.42, 6.6), red);
      kasagi.position.y = 6.3; kasagi.castShadow = true; gate.add(kasagi);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 6.8), dark);
      cap.position.y = 6.58; gate.add(cap);
      const nuki = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 5.6), red);
      nuki.position.y = 5.1; gate.add(nuki);
      const gx = 13, gz = -9;
      gate.position.set(gx, gy(gx, gz), gz);
      gate.rotation.y = 0.5;
      gate.userData.kodroLandmark = 'torii';
      scene.add(gate); names.push('torii');
      // Red-maple accent bushes on the dark scoria.
      const maple = std({ color: 0xb84632, roughness: 0.9, flatShading: true });
      [[-9, 6], [7, 12], [-4, -14]].forEach((p) => {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 0), maple);
        m.position.set(p[0], gy(p[0], p[1]) + 0.8, p[1]);
        m.scale.y = 0.75; m.castShadow = true;
        m.userData.kodroLandmark = 'maple';
        scene.add(m);
      });
      names.push('maple');
    } else if (sid === 'nepal') {
      // A prayer-flag string on a catenary between two poles, plus cairns.
      const poleM = std({ color: 0x6a5a44, roughness: 0.9 });
      const flagCols = [0x3a6fd8, 0xf2f2f2, 0xd84a3a, 0x3f9e4d, 0xe8c93a];
      const grp = new THREE.Group();
      const x0 = -7, x1 = 7, zf = -11, top = 4.4, sag = 1.5;
      [x0, x1].forEach((x) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, top + 0.4, 6), poleM);
        pole.position.set(x, (top + 0.4) / 2, zf); pole.castShadow = true; grp.add(pole);
      });
      const flags = [];
      const N = 11;
      const flagGeo = new THREE.PlaneGeometry(0.72, 0.5);
      for (let i = 1; i < N; i++) {
        const t = i / N;
        const x = x0 + (x1 - x0) * t;
        const y = top - Math.sin(t * Math.PI) * sag; // catenary-ish dip
        const f = new THREE.Mesh(flagGeo, std({ color: flagCols[i % flagCols.length], roughness: 1, side: THREE.DoubleSide }));
        f.position.set(x, y - 0.3, zf);
        grp.add(f); flags.push({ f, ph: i * 0.9 });
      }
      grp.position.y = gy(0, zf);
      grp.userData.kodroLandmark = 'prayerflags';
      scene.add(grp); names.push('prayerflags');
      // Flags flutter gently; the caller skips update() under reduced motion.
      updates.push((t) => {
        for (let i = 0; i < flags.length; i++) {
          const k = flags[i];
          k.f.rotation.x = 0.22 * Math.sin(t * 2.1 + k.ph) + 0.1 * Math.sin(t * 3.7 + k.ph * 1.7);
          k.f.rotation.y = 0.12 * Math.sin(t * 1.3 + k.ph);
        }
      });
      const stoneM = std({ color: 0x8a8f96, roughness: 1, flatShading: true });
      [[9, 4], [-11, -3]].forEach((p) => {
        const cairn = new THREE.Group();
        for (let s = 0; s < 4; s++) {
          const r = 0.7 - s * 0.14;
          const st = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), stoneM);
          st.scale.y = 0.55; st.position.y = 0.2 + s * 0.5; st.castShadow = true; cairn.add(st);
        }
        cairn.position.set(p[0], gy(p[0], p[1]), p[1]);
        cairn.userData.kodroLandmark = 'cairn';
        scene.add(cairn);
      });
      names.push('cairn');
    } else if (sid === 'europa') {
      // Jupiter, the identifier: a big banded sphere low on the horizon.
      // Canvas-painted cloud bands plus the Great Red Spot; fog:false so it
      // reads beyond the fog plane exactly like the skyline landforms.
      let map = null;
      try {
        if (typeof document !== 'undefined' && document.createElement) {
          const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
          const c2 = cv.getContext('2d');
          if (c2) {
            const cols = ['#c9a988', '#a87e5e', '#e0cbaa', '#b89170', '#d9c4a0', '#96705a', '#cbb090', '#ad8668'];
            const bh = 128 / cols.length;
            for (let i = 0; i < cols.length; i++) {
              c2.fillStyle = cols[i];
              c2.fillRect(0, i * bh, 256, bh + 1);
            }
            // soften band edges with translucent overlaps
            c2.globalAlpha = 0.35;
            for (let i = 1; i < cols.length; i++) {
              c2.fillStyle = cols[i - 1];
              c2.fillRect(0, i * bh - 2, 256, 4);
            }
            c2.globalAlpha = 1;
            // the Great Red Spot
            c2.fillStyle = '#b0503a';
            c2.beginPath(); c2.ellipse(158, 82, 20, 10, 0, 0, 6.283); c2.fill();
            c2.fillStyle = '#c86a4e';
            c2.beginPath(); c2.ellipse(158, 82, 13, 6, 0, 0, 6.283); c2.fill();
            map = new THREE.CanvasTexture(cv);
          }
        }
      } catch (e) { map = null; }
      const jupM = map
        ? new THREE.MeshBasicMaterial({ map, fog: false })
        : new THREE.MeshBasicMaterial({ color: 0xc9a988, fog: false });
      const jup = new THREE.Mesh(new THREE.SphereGeometry(85, 26, 20), jupM);
      const az = -0.46; // ~334 deg: in the open sky beside the terrain switch
      jup.position.set(Math.cos(az) * 720, 62, Math.sin(az) * 720);
      jup.rotation.z = 0.25; // banded axis tilted against the horizon
      jup.userData.kodroLandmark = 'jupiter';
      scene.add(jup); names.push('jupiter');
    } else if (sid === 'tycho') {
      // High-albedo ejecta rays radiating from the crater's centre across the
      // ground plane: the Moon's most recognisable ray system.
      const rayM = new THREE.MeshBasicMaterial({ color: 0xb8bac4, transparent: true, opacity: 0.16, depthWrite: false });
      const rayGeo = new THREE.PlaneGeometry(110, 2.4);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.35;
        const ray = new THREE.Mesh(rayGeo, rayM);
        ray.rotation.x = -Math.PI / 2;
        ray.rotation.z = -a;
        const d = 70;
        ray.position.set(Math.cos(a) * d, 0.06 + gy(Math.cos(a) * d, Math.sin(a) * d), Math.sin(a) * d);
        ray.userData.kodroLandmark = 'rays';
        scene.add(ray);
      }
      names.push('rays');
    } else if (sid === 'iceland') {
      // Bright moss-green decals over the dark basalt gravel.
      const mossM = new THREE.MeshBasicMaterial({ color: 0x4a7a3a, transparent: true, opacity: 0.3, depthWrite: false });
      [[6, -8, 3.2], [-11, 5, 2.4], [14, 9, 2.8], [-5, -15, 2.2], [2, 13, 3.6]].forEach((p) => {
        const moss = new THREE.Mesh(new THREE.CircleGeometry(p[2], 14), mossM);
        moss.rotation.x = -Math.PI / 2;
        moss.position.set(p[0], gy(p[0], p[1]) + 0.05, p[1]);
        moss.userData.kodroLandmark = 'moss';
        scene.add(moss);
      });
      names.push('moss');
    } else if (sid === 'kenya') {
      // Termite mounds: tapered cones in the golden grass.
      const mudM = std({ color: 0x8a6a42, roughness: 1, flatShading: true });
      [[8, -11], [-13, 7], [4, 15]].forEach((p, i) => {
        const mound = new THREE.Mesh(new THREE.ConeGeometry(1.1 + (i % 2) * 0.3, 2.2 + i * 0.4, 7), mudM);
        mound.position.set(p[0], gy(p[0], p[1]) + (2.2 + i * 0.4) / 2 - 0.2, p[1]);
        mound.castShadow = true;
        mound.userData.kodroLandmark = 'termite';
        scene.add(mound);
      });
      names.push('termite');
    } else if (sid === 'sahara' || sid === 'india') {
      // Rare dry shrubs; India additionally gets its khejri silhouettes from
      // the prop kit, so the two deserts stop reading as clones.
      const twigM = std({ color: 0x6a5638, roughness: 1 });
      const spots = sid === 'sahara' ? [[10, -12], [-14, 8]] : [[9, 11], [-8, -13], [15, -4]];
      spots.forEach((p) => {
        const shrub = new THREE.Group();
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.045, 1.1, 4), twigM);
          tw.position.set(Math.cos(a) * 0.16, 0.5, Math.sin(a) * 0.16);
          tw.rotation.z = Math.cos(a) * 0.5; tw.rotation.x = Math.sin(a) * 0.5;
          shrub.add(tw);
        }
        shrub.position.set(p[0], gy(p[0], p[1]), p[1]);
        shrub.userData.kodroLandmark = 'shrub';
        scene.add(shrub);
      });
      names.push('shrub');
    } else if (sid === 'amazon') {
      // A canopy wall closing the horizon: the rainforest reads as being
      // INSIDE a forest, not a park. Pre-blended toward the fog colour and
      // fog:false so the ring stays readable at distance (skyline pattern).
      const fogC = ctx.fogColor || new THREE.Color(0x3f5c40);
      const wallC = new THREE.Color(0x1c3518).lerp(fogC, 0.45).multiplyScalar(ctx.lightK || 1);
      const wallM = new THREE.MeshBasicMaterial({ color: wallC, fog: false, side: THREE.DoubleSide });
      const wallGeo = new THREE.PlaneGeometry(85, 26);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const wall = new THREE.Mesh(wallGeo, wallM);
        wall.position.set(Math.cos(a) * 165, 11, Math.sin(a) * 165);
        wall.rotation.y = -a + Math.PI / 2;
        wall.userData.kodroLandmark = 'canopywall';
        scene.add(wall);
      }
      names.push('canopywall');
    } else {
      return null;
    }
    if (!names.length) return null;
    return {
      names,
      update: updates.length ? (t, dt) => { for (let i = 0; i < updates.length; i++) updates[i](t, dt); } : null,
    };
  }

  // ---------------------------------------------------------------------
  // R7: underwater optics. A water surface overhead (med+), scrolling
  // caustic dapple on the seabed (med+), additive god rays (high+). The
  // Challenger Deep opts out: darkness is its signature and light shafts at
  // 10994 m would be a lie.
  // ctx: { sid, quality, groundY }
  // ---------------------------------------------------------------------
  function underwater(THREE, scene, ctx) {
    if (ctx.sid === 'mariana') return null;
    const Q = ctx.quality || 'high';
    if (Q === 'low') return null;
    const reef = ctx.sid === 'reef';
    const flags = [];
    const updates = [];

    // Water surface: a ceiling plane whose normal map scrolls two ways.
    try {
      const surfM = new THREE.MeshStandardMaterial({
        color: reef ? 0x2a7a90 : 0x1d5a70,
        roughness: 0.32, metalness: 0.12,
        transparent: true, opacity: 0.9,
        side: THREE.DoubleSide,
      });
      const gm = (typeof window !== 'undefined' && window.KodroTextures && window.KodroTextures.groundMaps)
        ? window.KodroTextures.groundMaps(THREE, surfM.color.getHex(), 'underwater') : null;
      if (gm && gm.normal) {
        surfM.normalMap = gm.normal;
        surfM.normalMap.repeat.set(7, 7);
        if (surfM.normalScale) surfM.normalScale.set(1.3, 1.3);
        updates.push((t) => {
          surfM.normalMap.offset.x = t * 0.014;
          surfM.normalMap.offset.y = t * 0.01;
        });
      }
      const surf = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), surfM);
      surf.rotation.x = Math.PI / 2; // face down at the scene
      surf.position.y = 15;
      surf.userData.kodroWaterFX = 'surface';
      scene.add(surf);
      flags.push('surface');
    } catch (e) { if (typeof console !== 'undefined') console.warn('WorldFX water surface failed:', e); }

    // Caustic dapple: an additive plane just above the seabed scrolled slowly.
    try {
      let ctex = null;
      if (typeof document !== 'undefined' && document.createElement) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 256;
        const c2 = cv.getContext('2d');
        if (c2) {
          c2.fillStyle = '#000000'; c2.fillRect(0, 0, 256, 256);
          c2.strokeStyle = 'rgba(150,235,225,0.5)';
          c2.lineWidth = 1.6;
          // Voronoi-ish web: overlapping wobbly cells drawn as bright rings.
          for (let i = 0; i < 70; i++) {
            const x = Math.random() * 256, y = Math.random() * 256, r = 9 + Math.random() * 22;
            c2.beginPath();
            for (let a = 0; a <= 14; a++) {
              const th = (a / 14) * Math.PI * 2;
              const rr = r * (0.82 + 0.18 * Math.sin(th * 3 + i));
              const px = x + Math.cos(th) * rr, py = y + Math.sin(th) * rr;
              if (a === 0) c2.moveTo(px, py); else c2.lineTo(px, py);
            }
            c2.stroke();
          }
          ctex = new THREE.CanvasTexture(cv);
          ctex.wrapS = ctex.wrapT = THREE.RepeatWrapping;
          ctex.repeat.set(9, 9);
        }
      }
      if (ctex) {
        let usedBase = false;
        const mkLayer = (opacity, sx, sy) => {
          // The first layer takes the base texture; the second takes a clone
          // (shared canvas image, independent offset) so the two dapple
          // fields can scroll against each other.
          const tex = usedBase ? ctex.clone() : ctex;
          usedBase = true;
          tex.needsUpdate = true;
          const m = new THREE.MeshBasicMaterial({
            map: tex, transparent: true, opacity,
            blending: THREE.AdditiveBlending, depthWrite: false,
          });
          const layer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), m);
          layer.rotation.x = -Math.PI / 2;
          layer.position.y = 0.07;
          layer.userData.kodroWaterFX = 'caustics';
          scene.add(layer);
          updates.push((t) => { m.map.offset.x = t * sx; m.map.offset.y = t * sy; });
        };
        mkLayer(reef ? 0.26 : 0.15, 0.011, 0.008);
        if (Q === 'high' || Q === 'cinematic') mkLayer(reef ? 0.14 : 0.08, -0.008, 0.012);
        flags.push('caustics');
      }
    } catch (e) { if (typeof console !== 'undefined') console.warn('WorldFX caustics failed:', e); }

    // God rays: a handful of faint additive cones from the surface (high+).
    if (Q === 'high' || Q === 'cinematic') {
      try {
        const rayM = new THREE.MeshBasicMaterial({
          color: 0x9fe8dc, transparent: true, opacity: 0.05,
          blending: THREE.AdditiveBlending, depthWrite: false,
          side: THREE.DoubleSide, fog: false,
        });
        const rays = [];
        [[14, -8, 0.16], [-18, 6, -0.13], [4, 20, 0.1], [-8, -22, -0.18]].forEach((p) => {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(5.5, 16, 8, 1, true), rayM);
          cone.position.set(p[0], 8, p[1]);
          cone.rotation.z = p[2];
          cone.userData.kodroWaterFX = 'rays';
          scene.add(cone);
          rays.push({ cone, ph: p[0] });
        });
        updates.push((t) => {
          rayM.opacity = 0.04 + 0.025 * (0.5 + 0.5 * Math.sin(t * 0.4));
          for (let i = 0; i < rays.length; i++) rays[i].cone.rotation.y = t * 0.05 + rays[i].ph;
        });
        flags.push('rays');
      } catch (e) { if (typeof console !== 'undefined') console.warn('WorldFX god rays failed:', e); }
    }

    if (!flags.length) return null;
    return {
      flags,
      update(t, dt) { for (let i = 0; i < updates.length; i++) updates[i](t, dt); },
    };
  }

  // ---------------------------------------------------------------------
  // R10: weather particles. Rain (streak line segments in a robot-following
  // box) and snow (round drifting points) for the outdoor Earth-family
  // worlds, both high-tier gated by the caller's quality. The Mars dust
  // storm is fog/sun/dust-count work done by the viewport and the ambient
  // module; there is deliberately no particle system for it here.
  // ctx: { id, weather, quality }
  // ---------------------------------------------------------------------
  function weather(THREE, scene, ctx) {
    const w = ctx.weather;
    if (!w || w === 'clear' || w === 'storm') return null;
    if (ctx.id !== 'earth' && ctx.id !== 'city') return null;
    const Q = ctx.quality || 'high';
    if (Q !== 'high' && Q !== 'cinematic') return null;
    const grp = new THREE.Group();
    grp.userData.kodroWeather = w;
    const BOX = 64, TOP = 30;

    if (w === 'rain') {
      const N = 1500;
      const arr = new Float32Array(N * 2 * 3);
      const spd = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const x = (Math.random() - 0.5) * BOX, y = Math.random() * TOP, z = (Math.random() - 0.5) * BOX;
        arr[i * 6] = x; arr[i * 6 + 1] = y; arr[i * 6 + 2] = z;
        arr[i * 6 + 3] = x; arr[i * 6 + 4] = y + 0.7; arr[i * 6 + 5] = z;
        spd[i] = 22 + Math.random() * 10;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb8cc, transparent: true, opacity: 0.38 }));
      rain.frustumCulled = false;
      grp.add(rain);
      scene.add(grp);
      return {
        flag: 'rain', wet: true,
        update(t, dt, cx, cz) {
          grp.position.set(cx || 0, 0, cz || 0);
          for (let i = 0; i < N; i++) {
            let y = arr[i * 6 + 1] - spd[i] * dt;
            if (y < 0) y = TOP;
            arr[i * 6 + 1] = y; arr[i * 6 + 4] = y + 0.7;
          }
          g.attributes.position.needsUpdate = true;
        },
      };
    }

    // snow: slow, swaying round flakes.
    const N = 900;
    const arr = new Float32Array(N * 3);
    const spd = new Float32Array(N);
    const ph = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      arr[i * 3] = (Math.random() - 0.5) * BOX;
      arr[i * 3 + 1] = Math.random() * TOP;
      arr[i * 3 + 2] = (Math.random() - 0.5) * BOX;
      spd[i] = 1.6 + Math.random() * 1.6;
      ph[i] = Math.random() * 6.28;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({ color: 0xf2f7fb, size: 0.3, transparent: true, opacity: 0.7, depthWrite: false, sizeAttenuation: true });
    try {
      if (typeof document !== 'undefined' && document.createElement) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 16;
        const c2 = cv.getContext('2d');
        if (c2) {
          const gr = c2.createRadialGradient(8, 8, 0, 8, 8, 8);
          gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          c2.fillStyle = gr; c2.fillRect(0, 0, 16, 16);
          mat.map = new THREE.CanvasTexture(cv); mat.alphaTest = 0.02;
        }
      }
    } catch (e) { void e; }
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    grp.add(pts);
    scene.add(grp);
    return {
      flag: 'snow', wet: false,
      update(t, dt, cx, cz) {
        grp.position.set(cx || 0, 0, cz || 0);
        for (let i = 0; i < N; i++) {
          let y = arr[i * 3 + 1] - spd[i] * dt;
          if (y < 0) y = TOP;
          arr[i * 3 + 1] = y;
          arr[i * 3] += Math.sin(t * 0.8 + ph[i]) * 0.9 * dt;
        }
        g.attributes.position.needsUpdate = true;
      },
    };
  }

  if (typeof window !== 'undefined') {
    window.KodroWorldFX = { landmarks, underwater, weather, todShift, applyTod, TOD_PRESETS };
  }
})();
