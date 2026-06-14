/* Real WebGL 3D viewport (Three.js, vendored offline).
 *
 * Renders the world and the rover as actual 3D geometry, driven by the same
 * live rover state the 2.5D view uses. Two cameras: a third-person orbit you
 * can drag to revolve around the rover, and a first-person view mounted on the
 * rover looking the way it drives. All Three.js work lives inside useEffect so
 * the offline bundle-render test (which has no WebGL) never touches it.
 */
(function () {
  const { useRef, useEffect } = React;

  // Engine world is in centimetres (roughly +/-1500). Scale it down to a
  // comfortable number of 3D units.
  const SCALE = 0.03;

  const SKY = {
    room: 0xe9ddc8, city: 0x93acc0, earth: 0x9ec7e8, mars: 0xd98a5a, underwater: 0x0b3a4c, space: 0x05060d,
  };
  const GROUND = {
    room: 0x9c7b50, city: 0x2b313d, earth: 0x4a6b39, mars: 0x9a4a2e, underwater: 0x1c4a55, space: 0x3a3c44,
  };
  const FOG = {
    room: 0xe9ddc8, city: 0xb3c2cc, earth: 0xb6cdba, mars: 0xc08050, underwater: 0x0a2a38, space: 0x05060d,
  };

  function Viewport3D({ terrain, rover, fpv }) {
    const mountRef = useRef(null);
    const stateRef = useRef({ x: 0, y: 0, heading: 0 });
    const fpvRef = useRef(!!fpv);
    stateRef.current = rover || stateRef.current;
    fpvRef.current = !!fpv;

    useEffect(() => {
      const THREE = (typeof window !== 'undefined') && window.THREE;
      const mount = mountRef.current;
      if (!THREE || !mount) return undefined;

      const id = (terrain && terrain.id) || 'earth';
      let w = mount.clientWidth || 800;
      let h = mount.clientHeight || 500;

      // Honour the pupil's motion preference: no smoothing-induced drift.
      const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const posLerp = reduce ? 1 : 0.16;
      const camLerp = reduce ? 1 : 0.12;

      // Guard WebGL: a failed context (old GPU, lost context) shows a calm
      // message and the pupil can fall back to the flat view, never a blank box.
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      } catch (err) {
        mount.innerHTML = '<div class="vp3d-fail">3D needs a graphics card this machine cannot give. Switch to the 2.5D view in the bar.</div>';
        return undefined;
      }
      let disposed = false;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      renderer.shadowMap.enabled = true;
      // Softer shadows and filmic tone mapping lift the look out of the flat,
      // plasticky default that read as generic.
      if (THREE.PCFSoftShadowMap != null) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (THREE.ACESFilmicToneMapping != null) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08; }
      if (THREE.SRGBColorSpace != null) renderer.outputColorSpace = THREE.SRGBColorSpace;
      else if (THREE.sRGBEncoding != null) renderer.outputEncoding = THREE.sRGBEncoding;
      const canvas = renderer.domElement;
      canvas.setAttribute('tabindex', '0');
      canvas.setAttribute('aria-label', 'Three dimensional world. Drag or use the arrow keys to orbit, plus and minus to zoom.');
      const onContextLost = (e) => { e.preventDefault(); mount.classList.add('vp3d-lost'); };
      canvas.addEventListener('webglcontextlost', onContextLost, false);
      mount.appendChild(canvas);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(SKY[id] != null ? SKY[id] : SKY.earth);
      scene.fog = new THREE.Fog(FOG[id] != null ? FOG[id] : FOG.earth, 60, 220);

      const camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 2000);

      // Lights. Indoors (room) is warm and soft; outdoors is daylight.
      const indoor = id === 'room';
      const skyCol2 = indoor ? 0xfff1de : 0xffffff;
      const grndCol2 = indoor ? 0x3a2f28 : 0x404048;
      scene.add(new THREE.HemisphereLight(skyCol2, grndCol2, id === 'space' ? 0.45 : indoor ? 0.7 : 0.9));
      const sun = new THREE.DirectionalLight(indoor ? 0xffe9c4 : 0xfff4e2, id === 'space' ? 0.7 : indoor ? 0.85 : 1.05);
      sun.position.set(indoor ? 18 : 40, indoor ? 38 : 80, indoor ? 22 : 30);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024); // sharper than the old 512, still light on iGPUs
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 320;
      sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
      sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
      sun.shadow.bias = -0.0006;
      if (sun.shadow.radius != null) sun.shadow.radius = 3;
      scene.add(sun);
      // A soft fill from the opposite side so shadowed faces are not black.
      const fill = new THREE.DirectionalLight(0xbcd2ff, indoor ? 0.18 : 0.28);
      fill.position.set(-30, 26, -22);
      scene.add(fill);

      // A gradient sky dome so the world has a horizon, not a flat wall of fog.
      const skyTop = new THREE.Color(SKY[id] != null ? SKY[id] : SKY.earth);
      const skyBot = new THREE.Color(FOG[id] != null ? FOG[id] : FOG.earth);
      const skyGeo = new THREE.SphereGeometry(900, 24, 12);
      const skyCol = [];
      const pos = skyGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const t = Math.max(0, Math.min(1, (pos.getY(i) / 900) * 0.5 + 0.5));
        const c = skyBot.clone().lerp(skyTop, t);
        skyCol.push(c.r, c.g, c.b);
      }
      skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyCol, 3));
      const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
      scene.add(sky);

      // Ground.
      const groundMat = new THREE.MeshStandardMaterial({ color: GROUND[id] != null ? GROUND[id] : GROUND.earth, roughness: 1 });
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      if (indoor) { groundMat.roughness = 0.7; groundMat.metalness = 0.05; }
      scene.add(ground);
      if (id !== 'city' && id !== 'room') {
        const grid = new THREE.GridHelper(400, 80, 0x000000, 0x000000);
        grid.material.opacity = 0.08; grid.material.transparent = true;
        scene.add(grid);
      }

      // Moving agents (city pedestrians and cars); each gets an update(t) called
      // every frame so the world is alive, not a still set of props.
      const agents = [];

      // Obstacles as 3D meshes (trees + rocks on Earth, rocks elsewhere).
      const rockMat = new THREE.MeshStandardMaterial({ color: id === 'mars' ? 0x7e3a26 : id === 'underwater' ? 0x2c6068 : 0x6a6a64, roughness: 1, flatShading: true });
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4f2c, roughness: 1 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x356b2a, roughness: 1, flatShading: true });
      const coralMat = new THREE.MeshStandardMaterial({ color: 0xc9607a, roughness: 0.85, flatShading: true });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x4a4c54, roughness: 1, flatShading: true });
      const mkRock = (r, px, pz, v, rot) => {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat);
        rock.position.set(px, r * 0.55, pz);
        rock.rotation.set(v * 3, rot || 0, v * 2);
        rock.castShadow = true; rock.receiveShadow = true;
        scene.add(rock);
      };
      const obstacles = (terrain && terrain.obstacles) || [];
      if (id !== 'city' && id !== 'room') obstacles.forEach((o) => {
        const r = Math.max(0.6, o.r * SCALE);
        const px = o.x * SCALE, pz = -o.y * SCALE;
        if (id === 'earth' && o.v >= 0.5) {
          // tree: trunk + canopy
          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.24, r * 1.4, 6), trunkMat);
          trunk.position.y = r * 0.7; trunk.castShadow = true;
          const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 1.1, 0), leafMat);
          canopy.position.y = r * 1.9; canopy.castShadow = true;
          tree.add(trunk); tree.add(canopy);
          tree.position.set(px, 0, pz);
          scene.add(tree);
        } else if (id === 'underwater' && o.v >= 0.45) {
          // coral: a small clump of upright branches
          const coral = new THREE.Group();
          const n = 3 + ((o.v * 4) | 0);
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            const br = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, r * (1.0 + (k % 2) * 0.6), 5), coralMat);
            br.position.set(Math.cos(a) * r * 0.4, r * 0.6, Math.sin(a) * r * 0.4);
            br.rotation.z = Math.cos(a) * 0.3; br.rotation.x = Math.sin(a) * 0.3;
            br.castShadow = true; coral.add(br);
          }
          coral.position.set(px, 0, pz);
          scene.add(coral);
        } else if (id === 'space' && o.v >= 0.5) {
          // crater: a low rim ring lying on the ground
          const crater = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.34, 6, 16), rimMat);
          crater.rotation.x = Math.PI / 2;
          crater.position.set(px, r * 0.18, pz);
          crater.receiveShadow = true; crater.castShadow = true;
          scene.add(crater);
        } else {
          mkRock(r, px, pz, o.v, o.rot);
        }
      });

      // ---- Proper 3D city and room scenes (meshes, not generic rocks). ----
      function makeWindowTex() {
        try {
          if (!document || !document.createElement) return null;
          const cv = document.createElement('canvas'); cv.width = 64; cv.height = 96;
          const g = cv.getContext && cv.getContext('2d'); if (!g) return null;
          g.fillStyle = '#39414f'; g.fillRect(0, 0, 64, 96);
          for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 4; xx++) {
            g.fillStyle = (Math.random() < 0.5) ? '#ffe6a0' : '#222a38';
            g.fillRect(6 + xx * 14, 6 + yy * 11, 9, 7);
          }
          const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
        } catch (e) { return null; }
      }
      function mkCar(col) {
        const car = new THREE.Group();
        const bodyM = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.45 });
        const lower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 1.7), bodyM); lower.position.y = 0.7; lower.castShadow = true;
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 1.5), bodyM); cabin.position.set(-0.2, 1.45, 0); cabin.castShadow = true;
        const glassM = new THREE.MeshStandardMaterial({ color: 0xaad4ee, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7 });
        const glass = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.66, 1.36), glassM); glass.position.set(-0.2, 1.45, 0);
        car.add(lower); car.add(cabin); car.add(glass);
        const wM = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.9 });
        [[1.1, 0.95], [1.1, -0.95], [-1.1, 0.95], [-1.1, -0.95]].forEach(([wx, wz]) => {
          const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.34, 14), wM);
          wh.rotation.x = Math.PI / 2; wh.position.set(wx, 0.5, wz); wh.castShadow = true; car.add(wh);
        });
        return car;
      }
      function mkPerson(shirt) {
        const p = new THREE.Group();
        const legM = new THREE.MeshStandardMaterial({ color: 0x2f3646, roughness: 0.9 });
        const shirtM = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
        const skinM = new THREE.MeshStandardMaterial({ color: 0xe8c9a8, roughness: 0.7 });
        const Cap = THREE.CapsuleGeometry ? THREE.CapsuleGeometry : null;
        const torso = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.42, 0.8, 4, 8) : new THREE.CylinderGeometry(0.42, 0.42, 1.4, 8), shirtM); torso.position.y = 1.7; torso.castShadow = true;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12), skinM); head.position.y = 2.5; head.castShadow = true;
        const lLeg = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.18, 0.7, 3, 6) : new THREE.CylinderGeometry(0.18, 0.18, 1.0, 6), legM); lLeg.position.set(-0.2, 0.85, 0);
        const rLeg = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.18, 0.7, 3, 6) : new THREE.CylinderGeometry(0.18, 0.18, 1.0, 6), legM); rLeg.position.set(0.2, 0.85, 0);
        p.add(torso); p.add(head); p.add(lLeg); p.add(rLeg);
        p._legs = [lLeg, rLeg];
        return p;
      }
      function buildCity() {
        const HALF = 1500 * SCALE;       // 45 units
        const ROADW = 150 * SCALE * 2;   // 9 units carriageway
        const asphalt = new THREE.MeshStandardMaterial({ color: 0x23272f, roughness: 0.95 });
        const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, ROADW), asphalt);
        hRoad.rotation.x = -Math.PI / 2; hRoad.position.y = 0.02; hRoad.receiveShadow = true; scene.add(hRoad);
        const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROADW, HALF * 2), asphalt);
        vRoad.rotation.x = -Math.PI / 2; vRoad.position.y = 0.021; vRoad.receiveShadow = true; scene.add(vRoad);
        const dashM = new THREE.MeshBasicMaterial({ color: 0xe6d886 });
        for (let i = -HALF; i < HALF; i += 4.2) {
          if (Math.abs(i) < ROADW / 2) continue;
          const d1 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.22), dashM); d1.rotation.x = -Math.PI / 2; d1.position.set(i, 0.03, 0); scene.add(d1);
          const d2 = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 2.2), dashM); d2.rotation.x = -Math.PI / 2; d2.position.set(0, 0.03, i); scene.add(d2);
        }
        const zM = new THREE.MeshBasicMaterial({ color: 0xe8ecf2 });
        for (let k = 0; k < 6; k++) {
          const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.7, ROADW * 0.92), zM);
          bar.rotation.x = -Math.PI / 2; bar.position.set(ROADW / 2 + 1.4 + k * 1.3, 0.03, 0); scene.add(bar);
        }
        const winTex = makeWindowTex();
        obstacles.forEach((o) => {
          const px = o.x * SCALE, pz = -o.y * SCALE;
          if (o.kind === 'building') {
            const w = Math.max(3, o.r * SCALE * 1.4), hgt = w * (1.7 + (o.v % 0.7));
            const m = winTex
              ? new THREE.MeshStandardMaterial({ map: winTex.clone(), color: 0x8b94a1, roughness: 0.8 })
              : new THREE.MeshStandardMaterial({ color: 0x5a6472, roughness: 0.85 });
            if (m.map) { m.map.repeat.set(2, Math.max(2, Math.round(hgt / 4))); m.map.needsUpdate = true; }
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, w), m);
            b.position.set(px, hgt / 2, pz); b.castShadow = true; b.receiveShadow = true; scene.add(b);
            const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.4, w * 1.05), new THREE.MeshStandardMaterial({ color: 0x343b45, roughness: 1 }));
            roof.position.set(px, hgt + 0.2, pz); scene.add(roof);
          } else if (o.kind === 'car') {
            const car = mkCar(o.v < 0.5 ? 0xc0392b : 0x2c6fb0);
            car.position.set(px, 0, pz); car.rotation.y = (o.rot || 0) * Math.PI / 180; scene.add(car);
          }
        });
        const PAVE = ROADW / 2 + 2.6;
        const shirts = [0xd98c4a, 0x5aa0d8, 0x8a6fc0, 0x5bbf86, 0xd35d7a];
        for (let i = 0; i < 7; i++) {
          const horiz = (i % 2 === 0);
          const lane = (i % 4 < 2 ? 1 : -1) * PAVE;
          const sp = 2.2 + (i % 3) * 0.7, off = i * 0.9, span = 56;
          const pr = mkPerson(shirts[i % shirts.length]); scene.add(pr);
          agents.push({ mesh: pr, update: (t) => {
            const ph = ((t * sp / span) + off) % 2; const tri = ph < 1 ? ph : 2 - ph;
            const along = (tri - 0.5) * span;
            pr.position.set(horiz ? along : lane, 0, horiz ? lane : along);
            pr.rotation.y = horiz ? (ph < 1 ? Math.PI / 2 : -Math.PI / 2) : (ph < 1 ? 0 : Math.PI);
            const sw = Math.sin(t * 6 + off * 3) * 0.5; if (pr._legs) { pr._legs[0].rotation.x = sw; pr._legs[1].rotation.x = -sw; }
          } });
        }
        [[true, -2.2, 6.0, 0x2c6fb0], [false, 2.2, 5.2, 0x4aa564]].forEach((cfg, i) => {
          const h = cfg[0], lane = cfg[1], sp = cfg[2], col = cfg[3];
          const car = mkCar(col); scene.add(car);
          agents.push({ mesh: car, update: (t) => {
            const ph = ((t * sp / (HALF * 2)) + i * 0.4) % 2; const tri = ph < 1 ? ph : 2 - ph;
            const along = (tri - 0.5) * (HALF * 2);
            car.position.set(h ? along : lane, 0, h ? lane : along);
            car.rotation.y = h ? (ph < 1 ? -Math.PI / 2 : Math.PI / 2) : (ph < 1 ? Math.PI : 0);
          } });
        });
      }
      function buildRoom() {
        const R = 30;
        const wallM = new THREE.MeshStandardMaterial({ color: 0xcdbfa8, roughness: 0.95, side: THREE.DoubleSide });
        const wallH = 14;
        const mkWall = (w, x, z, ry) => { const ww = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 0.6), wallM); ww.position.set(x, wallH / 2, z); ww.rotation.y = ry; ww.receiveShadow = true; scene.add(ww); };
        mkWall(R * 2, 0, -R, 0); mkWall(R * 2, -R, 0, Math.PI / 2); mkWall(R * 2, R, 0, Math.PI / 2);
        const rug = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), new THREE.MeshStandardMaterial({ color: 0x9a5f54, roughness: 1 }));
        rug.rotation.x = -Math.PI / 2; rug.position.y = 0.03; scene.add(rug);
        const sofaM = new THREE.MeshStandardMaterial({ color: 0x3f6f8c, roughness: 0.85 });
        const sofa = new THREE.Group();
        const seat = new THREE.Mesh(new THREE.BoxGeometry(10, 1.4, 4), sofaM); seat.position.y = 1.6; seat.castShadow = true;
        const back = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 1), sofaM); back.position.set(0, 2.8, -1.7); back.castShadow = true;
        const aL = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 4), sofaM); aL.position.set(-5.5, 2.2, 0);
        const aR = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 4), sofaM); aR.position.set(5.5, 2.2, 0);
        sofa.add(seat); sofa.add(back); sofa.add(aL); sofa.add(aR);
        sofa.position.set(0, 0, -R + 6); scene.add(sofa);
        const woodM = new THREE.MeshStandardMaterial({ color: 0x7a5536, roughness: 0.7 });
        const table = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 4), woodM); table.position.set(0, 2.2, 2); table.castShadow = true; scene.add(table);
        [[3, 1.8], [3, -1.8], [-3, 1.8], [-3, -1.8]].forEach((p) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), woodM); leg.position.set(p[0], 1.1, 2 + p[1]); scene.add(leg); });
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(8, 9, 1.2), woodM); shelf.position.set(R - 2, 4.5, -8); shelf.castShadow = true; scene.add(shelf);
        for (let s = 0; s < 3; s++) { const bk = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.4, 1.0), new THREE.MeshStandardMaterial({ color: 0x6a4f2c, roughness: 1 })); bk.position.set(R - 2, 2 + s * 3, -8); scene.add(bk); }
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 1.8, 10), new THREE.MeshStandardMaterial({ color: 0xb56a45, roughness: 1 })); pot.position.set(-R + 4, 0.9, -R + 4); pot.castShadow = true; scene.add(pot);
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 0), new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 1, flatShading: true })); leaf.position.set(-R + 4, 3.4, -R + 4); leaf.castShadow = true; scene.add(leaf);
        const lamp = new THREE.PointLight(0xffd9a0, 0.7, 70); lamp.position.set(R - 8, 11, 8); scene.add(lamp);
      }
      if (id === 'city') buildCity();
      else if (id === 'room') buildRoom();

      // Rover: a body + a bright nose so its facing is obvious, on four wheels.
      const rov = new THREE.Group();
      const accent = new THREE.Color((terrain && terrain.accent) || '#5ce0d8');
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 1.6), new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.6, metalness: 0.2 }));
      body.position.y = 0.85; body.castShadow = true;
      const noseMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5 });
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 1.2), noseMat);
      nose.position.set(1.35, 0.9, 0);
      // A raised arrow on top, pointing forward, so the facing reads from any
      // orbit angle and in low-contrast worlds (the QA flagged the bare nose).
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 4), noseMat);
      arrow.rotation.z = -Math.PI / 2; // point along +x (forward)
      arrow.position.set(0.2, 2.0, 0);
      rov.add(body); rov.add(nose); rov.add(arrow);
      const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.9 });
      const wheels = [];
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(sx * 0.9, 0.45, sz * 0.85);
        wheel.castShadow = true; rov.add(wheel); wheels.push(wheel);
      });
      scene.add(rov);

      // A trail ribbon that grows as the rover drives.
      const MAXPTS = 600;
      const trailPos = new Float32Array(MAXPTS * 3);
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
      trailGeo.setDrawRange(0, 0);
      const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.85 }));
      scene.add(trail);
      let trailN = 0;

      // Smoothed render state (lerped toward the live rover each frame).
      const cur = new THREE.Vector3(0, 0, 0);
      let curHeading = 0;
      const camPos = new THREE.Vector3(0, 20, 30);

      // Third-person orbit: drag to rotate, wheel or two-finger pinch to zoom,
      // so it works on a tablet or Chromebook as well as a mouse.
      let azim = 2.4, elev = 0.62, dist = 26, dragging = false, lx = 0, ly = 0;
      const dom = renderer.domElement;
      const ptrs = new Map();
      let pinch = 0;
      const pinchGap = () => {
        const v = [...ptrs.values()];
        return v.length < 2 ? 0 : Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
      };
      const onDown = (e) => {
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 1) { dragging = true; lx = e.clientX; ly = e.clientY; }
        else { dragging = false; pinch = pinchGap(); }
      };
      const onUp = (e) => {
        ptrs.delete(e.pointerId);
        if (ptrs.size < 2) pinch = 0;
        if (ptrs.size === 0) dragging = false;
      };
      const onMove = (e) => {
        if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size >= 2) {
          const g = pinchGap();
          if (pinch) dist = Math.max(8, Math.min(80, dist + (pinch - g) * 0.05));
          pinch = g;
          return;
        }
        if (!dragging) return;
        azim -= (e.clientX - lx) * 0.008;
        elev = Math.max(0.12, Math.min(1.45, elev - (e.clientY - ly) * 0.006));
        lx = e.clientX; ly = e.clientY;
      };
      const onWheel = (e) => { dist = Math.max(8, Math.min(80, dist + e.deltaY * 0.03)); e.preventDefault(); };
      // Keyboard control so the orbit camera works without a pointer drag
      // (the QA flagged this as a WCAG keyboard-access gap).
      const onKey = (e) => {
        const k = e.key;
        if (k === 'ArrowLeft') azim -= 0.12;
        else if (k === 'ArrowRight') azim += 0.12;
        else if (k === 'ArrowUp') elev = Math.min(1.45, elev + 0.08);
        else if (k === 'ArrowDown') elev = Math.max(0.12, elev - 0.08);
        else if (k === '+' || k === '=') dist = Math.max(8, dist - 2);
        else if (k === '-' || k === '_') dist = Math.min(80, dist + 2);
        else return;
        e.preventDefault();
      };
      dom.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointermove', onMove);
      dom.addEventListener('wheel', onWheel, { passive: false });
      dom.addEventListener('keydown', onKey);

      const onResize = () => {
        w = mount.clientWidth || w; h = mount.clientHeight || h;
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize);

      let raf = 0;
      const tmp = new THREE.Vector3();
      const camTarget = new THREE.Vector3();
      const angLerp = (a, b, t) => {
        let d = (b - a) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        return a + d * t;
      };
      // Auto-quality: if the first couple of seconds run slow on a weak GPU,
      // drop shadows and the pixel ratio once so the view stays usable.
      let frames = 0, slow = 0, downgraded = false, last = (window.performance && window.performance.now) ? window.performance.now() : 0;
      const tick = () => {
        if (disposed) return;
        const now = (window.performance && window.performance.now) ? window.performance.now() : last + 16;
        const dt = now - last; last = now;
        if (!downgraded && ++frames > 12) {
          if (dt > 40) slow++; else slow = Math.max(0, slow - 1);
          if (slow > 30) {
            renderer.shadowMap.enabled = false; sun.castShadow = false;
            renderer.setPixelRatio(1); downgraded = true;
          }
        }
        const s = stateRef.current;
        const tx = s.x * SCALE, tz = -s.y * SCALE;
        const tr = (s.heading || 0) * Math.PI / 180;
        const px0 = cur.x, pz0 = cur.z;
        // Glide the rover toward the live state instead of snapping to it.
        cur.x += (tx - cur.x) * posLerp;
        cur.z += (tz - cur.z) * posLerp;
        curHeading = angLerp(curHeading, tr, posLerp);
        rov.position.set(cur.x, 0, cur.z);
        rov.rotation.y = curHeading;
        const moved = Math.hypot(cur.x - px0, cur.z - pz0);
        if (moved > 0.001) wheels.forEach((wh) => wh.rotateY(moved * 1.6));
        const fwd = tmp.set(Math.cos(curHeading), 0, -Math.sin(curHeading));

        // Grow the trail when the rover has actually moved.
        if (trailN === 0 || Math.hypot(cur.x - trailPos[(trailN - 1) * 3], cur.z - trailPos[(trailN - 1) * 3 + 2]) > 0.25) {
          if (trailN >= MAXPTS) {
            trailPos.copyWithin(0, 3);
            trailN = MAXPTS - 1;
          }
          trailPos[trailN * 3] = cur.x;
          trailPos[trailN * 3 + 1] = 0.3;
          trailPos[trailN * 3 + 2] = cur.z;
          trailN += 1;
          trailGeo.setDrawRange(0, trailN);
          trailGeo.attributes.position.needsUpdate = true;
        }

        // Drive the live city agents (pedestrians, traffic).
        if (agents.length) { const tsec = now / 1000; for (let i = 0; i < agents.length; i++) agents[i].update(tsec); }

        if (fpvRef.current) {
          // First person: sit in the rover, look the way it drives.
          camPos.set(cur.x + fwd.x * 1.2, 2.4, cur.z + fwd.z * 1.2);
          camera.position.copy(camPos);
          camera.lookAt(cur.x + fwd.x * 20, 1.8, cur.z + fwd.z * 20);
        } else {
          // Third person orbit, damped so it eases rather than jumps.
          const ox = Math.cos(azim) * Math.cos(elev) * dist;
          const oy = Math.sin(elev) * dist + 4;
          const oz = Math.sin(azim) * Math.cos(elev) * dist;
          camPos.lerp(camTarget.set(cur.x + ox, oy, cur.z + oz), camLerp);
          camera.position.copy(camPos);
          camera.lookAt(cur.x, 2, cur.z);
        }
        renderer.render(scene, camera);
        raf = window.requestAnimationFrame(tick);
      };
      tick();

      return () => {
        disposed = true;
        window.cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointermove', onMove);
        dom.removeEventListener('pointerdown', onDown);
        dom.removeEventListener('wheel', onWheel);
        dom.removeEventListener('keydown', onKey);
        canvas.removeEventListener('webglcontextlost', onContextLost);
        trailGeo.dispose();
        renderer.dispose();
        scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
        });
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      };
    }, [terrain && terrain.id]);

    return React.createElement('div', { className: 'viewport3d', ref: mountRef });
  }

  window.Viewport3D = Viewport3D;
})();
