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

  function Viewport3D({ terrain, rover, fpv, robotType }) {
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
      // Site-aware 3D ground colour. An Earth-based site (Sahara, Kenya, Egypt)
      // or a Mars/space variant carries its own palette in groundBg/obFill, used
      // by the 2D view. Pull the dominant hex so the 3D ground MATCHES the site
      // instead of always rendering the base terrain's colour (the green-Sahara
      // bug). Falls back to the base map when a site has no palette.
      const hexFromCss = (str) => { if (!str) return null; const m = String(str).match(/#([0-9a-fA-F]{6})/g); if (!m || !m.length) return null; return parseInt((m[1] || m[0]).slice(1), 16); };
      const siteGround = hexFromCss(terrain && terrain.groundBg && terrain.groundBg.background);
      const groundColor = (siteGround != null) ? siteGround : (GROUND[id] != null ? GROUND[id] : GROUND.earth);
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
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
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
      // Performance mode (window.KODRO_QUALITY: 'low'|'med'|'high'|'cinematic').
      // Bounds the two biggest costs, shadow resolution and pixel ratio, so a
      // laptop without a discrete GPU stays smooth on Low while Cinematic maxes
      // fidelity for a screenshot. Read at (re)build time so a change reapplies
      // when the viewport remounts.
      const Q = (window.KODRO_QUALITY || 'high');
      const _dpr = (window.devicePixelRatio || 1);
      renderer.setPixelRatio(Q === 'low' ? 1 : Q === 'med' ? Math.min(1.25, _dpr) : Q === 'cinematic' ? Math.min(2, _dpr * 1.5) : Math.min(1.5, _dpr));
      renderer.shadowMap.enabled = (Q !== 'low');
      if (THREE.ACESFilmicToneMapping != null) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; }
      if (THREE.SRGBColorSpace != null) renderer.outputColorSpace = THREE.SRGBColorSpace;
      else if (THREE.sRGBEncoding != null) renderer.outputEncoding = THREE.sRGBEncoding;
      const canvas = renderer.domElement;
      canvas.setAttribute('tabindex', '0');
      canvas.setAttribute('aria-label', 'Three dimensional world. Drag or use the arrow keys to orbit, plus and minus to zoom.');
      const onContextLost = (e) => { e.preventDefault(); mount.classList.add('vp3d-lost'); };
      canvas.addEventListener('webglcontextlost', onContextLost, false);
      mount.appendChild(canvas);

      // Cinematic post-processing (offline bloom + vignette). Gated to the
      // Cinematic tier and disabled under reduced motion; null on any GPU
      // allocation failure, in which case tick() renders straight to the canvas
      // exactly as before. Created after the renderer so it shares its context.
      let post = null;
      if ((Q === 'cinematic') && !reduce && window.KodroPost && window.KodroPost.create) {
        post = window.KodroPost.create(THREE, renderer, w, h);
      }

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(SKY[id] != null ? SKY[id] : SKY.earth);
      // Underwater murk swallows distance much sooner than open air; the Moon
      // has no atmosphere so its fog is pushed far back so the stars stay visible.
      if (id === 'underwater') scene.fog = new THREE.FogExp2(FOG[id], 0.025);
      else scene.fog = new THREE.Fog(FOG[id] != null ? FOG[id] : FOG.earth, id === 'space' ? 200 : 60, id === 'space' ? 800 : 220);

      const camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 2000);

      // Lights. Indoors (room) is warm and soft; outdoors is daylight.
      const indoor = id === 'room';
      const skyCol2 = indoor ? 0xfff1de : 0xffffff;
      const grndCol2 = indoor ? 0x3a2f28 : 0x404048;
      // Each world carries its own light mood: the Moon is dim and contrasty,
      // the abyss is dark and blue, Mars is dusty and half-lit, indoors is warm.
      const hemiInt = id === 'space' ? 0.4 : id === 'underwater' ? 0.45 : indoor ? 0.62 : id === 'mars' ? 0.52 : 0.6;
      scene.add(new THREE.HemisphereLight(skyCol2, grndCol2, hemiInt));
      const sunCol = indoor ? 0xffe9c4 : id === 'underwater' ? 0x6fb7c9 : id === 'mars' ? 0xffd9b0 : 0xfff4e2;
      const sunInt = id === 'space' ? 0.9 : id === 'underwater' ? 0.6 : indoor ? 1.05 : id === 'mars' ? 1.05 : 1.4;
      const sun = new THREE.DirectionalLight(sunCol, sunInt);
      sun.position.set(indoor ? 18 : 40, indoor ? 38 : 80, indoor ? 22 : 30);
      sun.castShadow = true;
      const _shMap = Q === 'low' ? 512 : Q === 'med' ? 1024 : Q === 'cinematic' ? 2048 : (indoor ? 2048 : 1024);
      sun.shadow.mapSize.set(_shMap, _shMap); // quality-scaled: lighter on iGPUs at Low/Med, crisp at High/Cinematic
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 320;
      sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
      sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
      sun.shadow.bias = -0.0003;
      if (sun.shadow.radius != null) sun.shadow.radius = 5;
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
      // The Moon has no atmosphere, so its sky is full of stars. Cheap Points
      // cloud on the upper hemisphere (it is a scene child, so teardown disposes it).
      if (id === 'space') {
        const sg = new THREE.BufferGeometry();
        const N = 800, arr = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
          const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
          arr[i * 3] = Math.cos(th) * rr * 850; arr[i * 3 + 1] = Math.abs(u) * 850; arr[i * 3 + 2] = Math.sin(th) * rr * 850;
        }
        sg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
      }

      // Ground.
      const groundMat = new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1 });
      const openWorld = id !== 'city' && id !== 'room';
      // Open terrain gets a subdivided, gently displaced surface (dunes, swells)
      // so light grazes real undulations instead of reading as a billiard-flat
      // plane. City and room keep a flat floor.
      const groundGeo = openWorld ? new THREE.PlaneGeometry(400, 400, 96, 96) : new THREE.PlaneGeometry(400, 400);
      if (openWorld) {
        const amp = id === 'underwater' ? 2.6 : id === 'space' ? 1.8 : 3.0;
        const pos = groundGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i); // plane is in XY before rotation
          const h = Math.sin(x * 0.05) * Math.cos(y * 0.045) * 0.6
                  + Math.sin(x * 0.013 + y * 0.017) * 0.3
                  + Math.sin((x + y) * 0.09) * 0.12;
          pos.setZ(i, h * amp);
        }
        groundGeo.computeVertexNormals();
      }
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      // City and room floors get a touch of metalness and lower roughness for a
      // slightly reflective sheen; open terrain stays rough and matte.
      if (!openWorld) { groundMat.roughness = 0.85; groundMat.metalness = 0.1; }
      scene.add(ground);
      if (id !== 'city' && id !== 'room') {
        // Give the open ground a procedural grain texture so it reads as a
        // surface (sand, regolith, seabed) instead of a flat coloured plane,
        // which was the biggest tell that the world was a tech demo.
        const gtex = (typeof document !== 'undefined') && (function () {
          const cv = document.createElement('canvas'); cv.width = cv.height = 256;
          const c2 = cv.getContext('2d'); if (!c2) return null;
          const base = new THREE.Color(groundColor);
          c2.fillStyle = '#' + base.getHexString(); c2.fillRect(0, 0, 256, 256);
          const speckle = (n, amp, alpha) => {
            for (let i = 0; i < n; i++) {
              const x = Math.random() * 256, y = Math.random() * 256, r = Math.random() * 1.8 + 0.4;
              const cc = base.clone(); cc.offsetHSL(0, 0, (Math.random() < 0.5 ? -1 : 1) * (amp * 0.5 + Math.random() * amp));
              c2.fillStyle = 'rgba(' + Math.round(cc.r * 255) + ',' + Math.round(cc.g * 255) + ',' + Math.round(cc.b * 255) + ',' + alpha + ')';
              c2.beginPath(); c2.arc(x, y, r, 0, 6.283); c2.fill();
            }
          };
          speckle(id === 'underwater' ? 1400 : 2600, 0.12, 0.6); // grain
          for (let i = 0; i < 14; i++) { // soft larger patches for variation
            const x = Math.random() * 256, y = Math.random() * 256, r = 12 + Math.random() * 34;
            const cc = base.clone(); cc.offsetHSL(0, 0, (Math.random() < 0.5 ? -1 : 1) * 0.06);
            const g = c2.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, 'rgba(' + Math.round(cc.r * 255) + ',' + Math.round(cc.g * 255) + ',' + Math.round(cc.b * 255) + ',0.4)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            c2.fillStyle = g; c2.beginPath(); c2.arc(x, y, r, 0, 6.283); c2.fill();
          }
          // A handful of broad colour regions with a gentle hue shift so the
          // terrain reads as real ground with mineral/vegetation variation, not
          // a uniform field of speckles.
          for (let i = 0; i < 6; i++) {
            const x = Math.random() * 256, y = Math.random() * 256, r = 40 + Math.random() * 60;
            const cc = base.clone(); cc.offsetHSL((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.08, (Math.random() < 0.5 ? -1 : 1) * 0.05);
            const g = c2.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, 'rgba(' + Math.round(cc.r * 255) + ',' + Math.round(cc.g * 255) + ',' + Math.round(cc.b * 255) + ',0.35)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            c2.fillStyle = g; c2.beginPath(); c2.arc(x, y, r, 0, 6.283); c2.fill();
          }
          const t = new THREE.CanvasTexture(cv);
          t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9);
          return t;
        })();
        if (gtex) { groundMat.map = gtex; groundMat.needsUpdate = true; }
        // Surface relief: a Sobel-derived normal map plus a roughness map so the
        // PBR sun and fill light graze real micro-relief (sand sheen, regolith
        // pits, seabed ripple) instead of a glass-smooth coloured plane. Headless
        // or canvas-less devices get nulls and render exactly as before.
        const gmaps = (window.KodroTextures && window.KodroTextures.groundMaps)
          ? window.KodroTextures.groundMaps(THREE, groundColor, id) : null;
        if (gmaps) {
          if (gmaps.normal) { groundMat.normalMap = gmaps.normal; if (groundMat.normalScale) groundMat.normalScale.set(0.7, 0.7); }
          if (gmaps.rough) { groundMat.roughnessMap = gmaps.rough; }
          groundMat.needsUpdate = true;
        }
      }

      // An environment map captured from the sky and ground, so metal surfaces
      // (car paint, hubs, the chassis) actually reflect the world and catch
      // highlights rather than reading as flat plastic. Guarded: if the device
      // cannot generate it, the scene simply renders without reflections.
      try {
        if (THREE.PMREMGenerator) {
          const pmrem = new THREE.PMREMGenerator(renderer);
          scene.environment = pmrem.fromScene(scene, 0.04, 1, 1200).texture;
          pmrem.dispose();
        }
      } catch (e) { void e; }

      // Moving agents (city pedestrians and cars); each gets an update(t) called
      // every frame so the world is alive, not a still set of props.
      const agents = [];

      // Obstacles as 3D meshes (trees + rocks on Earth, rocks elsewhere).
      const siteRock = hexFromCss(terrain && terrain.obFill);
      const rockMat = new THREE.MeshStandardMaterial({ color: siteRock != null ? siteRock : (id === 'mars' ? 0x7e3a26 : id === 'underwater' ? 0x2c6068 : 0x6a6a64), roughness: 1, flatShading: true });
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4f2c, roughness: 1 });
      // Foliage harmonised with the biome: on a sandy site the canopy dries to a
      // muted olive instead of a cartoon jungle green; a green biome stays green.
      const _leafCol = (siteGround != null) ? new THREE.Color(0x4a7a30).lerp(new THREE.Color(groundColor), 0.42) : new THREE.Color(0x356b2a);
      const leafMat = new THREE.MeshStandardMaterial({ color: _leafCol, roughness: 1, flatShading: true });
      const coralMat = new THREE.MeshStandardMaterial({ color: 0xc9607a, roughness: 0.85, flatShading: true });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x3a3c44, roughness: 1, flatShading: true });
      // Vary the rock silhouette by world and by the obstacle's own value so a
      // boulder field does not read as one shape stamped repeatedly: Mars gets
      // eroded icosahedra, the Moon sharp ejecta, the abyss rounded rocks.
      const mkRock = (r, px, pz, v, rot) => {
        const geo = id === 'mars' ? new THREE.IcosahedronGeometry(r, 0)
          : id === 'space' ? new THREE.OctahedronGeometry(r, 0)
          : id === 'underwater' ? new THREE.DodecahedronGeometry(r, 1)
          : new THREE.DodecahedronGeometry(r, 0);
        const rock = new THREE.Mesh(geo, rockMat);
        rock.position.set(px, r * 0.5, pz);
        rock.rotation.set(v * 3, rot || 0, v * 2);
        rock.scale.set(1 + v * 0.4, 0.7 + v * 0.5, 1 + (1 - v) * 0.4);
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
          // crater: a low rim sunk into the surface with a dark basin floor, so
          // it reads as a depression rather than a ring lying on top of the ground.
          const crater = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.2, 6, 16), rimMat);
          crater.rotation.x = Math.PI / 2;
          crater.position.set(px, -r * 0.1, pz);
          crater.receiveShadow = true;
          scene.add(crater);
          const basin = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 18), new THREE.MeshStandardMaterial({ color: 0x26282f, roughness: 1 }));
          basin.rotation.x = -Math.PI / 2; basin.position.set(px, 0.02, pz);
          scene.add(basin);
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
      // A detailed car: a tapered hull, a raked cabin and windshield, head and
      // tail lights, mirrors, bumpers and rimmed wheels. Forward is +x.
      function carBody(parent, col) {
        const bodyM = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.24, metalness: 0.72, envMapIntensity: 1.1, clearcoat: 1.0, clearcoatRoughness: 0.1, sheen: 0.3 });
        const trimM = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.6, metalness: 0.3 });
        const glassM = new THREE.MeshPhysicalMaterial({ color: 0x9fcae6, transmission: 0.0, roughness: 0.02, metalness: 0.0, transparent: true, opacity: 0.5, envMapIntensity: 1.8, clearcoat: 1.0 });
        const headM = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff0c0, emissiveIntensity: 0.9 });
        const tailM = new THREE.MeshStandardMaterial({ color: 0xff5a4a, emissive: 0xff3322, emissiveIntensity: 0.8 });
        // lower hull, slightly narrower at the base for a tapered look
        const hull = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.62, 1.7), bodyM); hull.position.y = 0.62; hull.castShadow = true; parent.add(hull);
        const skirt = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.34, 1.5), bodyM); skirt.position.y = 0.34; parent.add(skirt);
        // hood (front) and boot (rear), lower than the cabin
        const hood = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.34, 1.55), bodyM); hood.position.set(1.05, 1.05, 0); hood.castShadow = true; parent.add(hood);
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.34, 1.55), bodyM); boot.position.set(-1.2, 1.05, 0); boot.castShadow = true; parent.add(boot);
        // cabin: a box narrowed at the top, with a forward rake
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.74, 1.5), bodyM); cabin.position.set(-0.05, 1.5, 0); cabin.castShadow = true; parent.add(cabin);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 1.36), bodyM); roof.position.set(-0.15, 1.92, 0); parent.add(roof);
        // glass: a raked windscreen, a rear screen and side windows
        const wind = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 1.34), glassM); wind.position.set(0.82, 1.55, 0); wind.rotation.z = 0.5; parent.add(wind);
        const rear = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.66, 1.34), glassM); rear.position.set(-0.92, 1.55, 0); rear.rotation.z = -0.5; parent.add(rear);
        const sideL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.06), glassM); sideL.position.set(-0.05, 1.55, 0.74); parent.add(sideL);
        const sideR = sideL.clone(); sideR.position.z = -0.74; parent.add(sideR);
        // lights
        [[1.78, 0.55], [1.78, -0.55]].forEach((p) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.34), headM); l.position.set(p[0], 0.72, p[1]); parent.add(l); });
        [[-1.78, 0.55], [-1.78, -0.55]].forEach((p) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.3), tailM); l.position.set(p[0], 0.74, p[1]); parent.add(l); });
        // bumpers and mirrors
        const fB = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 1.72), trimM); fB.position.set(1.78, 0.45, 0); parent.add(fB);
        const rB = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 1.72), trimM); rB.position.set(-1.78, 0.45, 0); parent.add(rB);
        [[0.55, 0.92], [0.55, -0.92]].forEach((p) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.3), bodyM); m.position.set(p[0], 1.5, p[1]); parent.add(m); });
      }
      function carWheels(parent, register) {
        const wM = new THREE.MeshStandardMaterial({ color: 0x121319, roughness: 0.85 });
        const rimM = new THREE.MeshStandardMaterial({ color: 0xb6bcc8, roughness: 0.3, metalness: 0.75, envMapIntensity: 1.2 });
        [[1.15, 0.92], [1.15, -0.92], [-1.15, 0.92], [-1.15, -0.92]].forEach((p) => {
          const wheel = new THREE.Group();
          const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.36, 18), wM); tyre.rotation.x = Math.PI / 2; tyre.castShadow = true;
          const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.4, 8), rimM); rim.rotation.x = Math.PI / 2;
          wheel.add(tyre); wheel.add(rim); wheel.position.set(p[0], 0.5, p[1]); parent.add(wheel);
          if (register) register(wheel, tyre, p[0] > 0);
        });
      }
      function mkCar(col) {
        const car = new THREE.Group();
        carBody(car, col);
        carWheels(car, null);
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
      // A small autonomous robot for the roaming fleet: a coloured rover body on
      // four wheels with a glowing eye, so the other machines read as robots.
      function mkRobotAgent(col) {
        const g = new THREE.Group();
        const bodyM = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.4 });
        const eyeM = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8 });
        const hull = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 1.1), bodyM); hull.position.y = 0.62; hull.castShadow = true; g.add(hull);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), bodyM); dome.position.set(0.1, 1.05, 0); dome.castShadow = true; g.add(dome);
        const eye = new THREE.Mesh(new THREE.CircleGeometry(0.12, 14), eyeM); eye.position.set(0.78, 0.7, 0); eye.rotation.y = Math.PI / 2; g.add(eye);
        const wm = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.85 });
        const wheels = [];
        [[0.55, 0.62], [0.55, -0.62], [-0.55, 0.62], [-0.55, -0.62]].forEach((p) => {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 12), wm); w.rotation.x = Math.PI / 2; w.position.set(p[0], 0.3, p[1]); w.castShadow = true; g.add(w); wheels.push(w);
        });
        g._wheels = wheels;
        return g;
      }
      // Render every KodroAgents entity (cars, people, roaming robots) as a 3D
      // mesh driven by the shared sim, so what the collision test sees is what
      // the eye sees. Used by the city and the open terrain worlds.
      function renderAgents() {
        const KA = window.KodroAgents;
        if (!KA) return;
        KA.list().forEach((ag, i) => {
          let mesh;
          if (ag.kind === 'car') mesh = mkCar(ag.color != null ? ag.color : 0x2c6fb0);
          else if (ag.kind === 'robot') mesh = mkRobotAgent(ag.color != null ? ag.color : 0x5ce0d8);
          else mesh = mkPerson(ag.color != null ? ag.color : 0x5aa0d8);
          scene.add(mesh);
          agents.push({ mesh, update: () => {
            const a = KA.list()[i]; if (!a) return;
            mesh.position.set(a.x * SCALE, 0, -a.y * SCALE);
            mesh.rotation.y = Math.atan2(a.dy, a.dx);
            if (ag.kind === 'person' && mesh._legs) { mesh._legs[0].rotation.x = a.leg * 0.5; mesh._legs[1].rotation.x = -a.leg * 0.5; }
            if (ag.kind === 'robot' && mesh._wheels) { for (let k = 0; k < mesh._wheels.length; k++) mesh._wheels[k].rotation.y = a.leg; }
          } });
        });
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
            const w = Math.max(3, o.r * SCALE * 1.4), hgt = w * (1.4 + o.v * 3.2);
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
        // The base window texture is only a clone source: each building got its
        // own independent clone, so the base can be freed now (it is never rendered).
        if (winTex) winTex.dispose();
        // Render the shared moving agents as 3D meshes, driven by the same
        // simulation the collision test reads, so a pedestrian the robot can
        // see in the world is one it can actually hit.
        renderAgents();
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
        const TX = -14.1, TZ = -11.4; // matches the table collision obstacle, clear of the robot's start
        const table = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 4), woodM); table.position.set(TX, 2.2, TZ); table.castShadow = true; scene.add(table);
        [[2.5, 1.8], [2.5, -1.8], [-2.5, 1.8], [-2.5, -1.8]].forEach((p) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), woodM); leg.position.set(TX + p[0], 1.1, TZ + p[1]); scene.add(leg); });
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(8, 9, 1.2), woodM); shelf.position.set(R - 2, 4.5, -8); shelf.castShadow = true; scene.add(shelf);
        for (let s = 0; s < 3; s++) { const bk = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.4, 1.0), new THREE.MeshStandardMaterial({ color: 0x6a4f2c, roughness: 1 })); bk.position.set(R - 2, 2 + s * 3, -8); scene.add(bk); }
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 1.8, 10), new THREE.MeshStandardMaterial({ color: 0xb56a45, roughness: 1 })); pot.position.set(-R + 4, 0.9, -R + 4); pot.castShadow = true; scene.add(pot);
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 0), new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 1, flatShading: true })); leaf.position.set(-R + 4, 3.4, -R + 4); leaf.castShadow = true; scene.add(leaf);
        const lamp = new THREE.SpotLight(0xffd9a0, 1.2, 80, 0.6, 0.4); lamp.position.set(R - 8, 11, 8); lamp.target.position.set(R - 8, 0, 8); lamp.castShadow = false; scene.add(lamp); scene.add(lamp.target);
        // People moving in the room, from the shared agent simulation, so the
        // companion robot has someone to avoid.
        const KAr = window.KodroAgents;
        if (KAr) {
          KAr.list().forEach((ag, i) => {
            if (ag.kind !== 'person') return;
            const pr = mkPerson(ag.color != null ? ag.color : 0x6aa0d8); scene.add(pr);
            agents.push({ mesh: pr, update: () => {
              const a = KAr.list()[i]; if (!a) return;
              pr.position.set(a.x * SCALE, 0, -a.y * SCALE);
              pr.rotation.y = Math.atan2(a.dy, a.dx);
              if (pr._legs) { pr._legs[0].rotation.x = a.leg * 0.5; pr._legs[1].rotation.x = -a.leg * 0.5; }
            } });
          });
        }
      }
      // Make sure the shared agent sim is built for THIS world before we render
      // its meshes (the viewport effect can run before App's build effect).
      if (window.KodroAgents && window.KodroAgents.world() !== id) window.KodroAgents.build(id);
      if (id === 'city') buildCity();
      else if (id === 'room') buildRoom();
      else renderAgents(); // open terrain worlds: render the roaming robot fleet

      // The robot: built to match the kind the user designed in Robot Lab, so
      // a rover, a car, a home companion or an arm each look like themselves.
      const accent = new THREE.Color((terrain && terrain.accent) || '#5ce0d8');
      const rType = robotType || (window.getKodroRobot && window.getKodroRobot().type) || 'rover';
      // Per-type motion feel: a car throws its weight around; a heavy rover is
      // measured and stable; a humanoid stays upright and barely banks; a fixed
      // manipulator arm does not pitch or roll as it works.
      const MOTION = {
        car: { pitch: 1.0, roll: 1.0, susp: 1.0 },
        rover: { pitch: 0.5, roll: 0.45, susp: 0.6 },
        home: { pitch: 0.28, roll: 0.22, susp: 0.4 },
        arm: { pitch: 0, roll: 0, susp: 0 },
      };
      const feel = MOTION[rType] || { pitch: 0.6, roll: 0.55, susp: 0.7 };
      const rov = new THREE.Group();
      const body = new THREE.Group(); rov.add(body); // non-wheel parts: leans with weight transfer
      const wheels = [];
      const steer = []; // front wheel groups, turned toward the heading change
      const Cap = THREE.CapsuleGeometry || null;
      let ledIndicator = null; // rover mast LED, pulsed each frame in tick()
      // DoubleSide so flat accent discs (the rover eye, the home chest) stay
      // visible when the orbit camera swings round behind the robot.
      const accMat = () => new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5, side: THREE.DoubleSide });
      const addWheels = (positions, r) => {
        const wm = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.85 });
        const hubM = new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: 0.4, metalness: 0.6 });
        positions.forEach((p) => {
          const wheel = new THREE.Group();
          const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.32, 16), wm); tyre.rotation.x = Math.PI / 2; tyre.castShadow = true;
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.42, 0.34, 8), hubM); hub.rotation.x = Math.PI / 2;
          wheel.add(tyre); wheel.add(hub); wheel.position.set(p[0], r, p[1]); rov.add(wheel); wheels.push(tyre);
          if (p[0] > 0) steer.push(wheel); // front axle steers
        });
      };
      const arrow = (y) => { const a = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 4), accMat()); a.rotation.z = -Math.PI / 2; a.position.set(0.2, y, 0); body.add(a); };
      if (rType === 'car') {
        carBody(body, 0x2c6fb0);
        carWheels(rov, (wheel, tyre, front) => { wheels.push(tyre); if (front) steer.push(wheel); });
        arrow(2.05);
        // Headlights as real spotlights (children of rov so they track the car).
        // Forward is +x; only the left one casts a shadow to keep the cost down.
        [[0.55], [-0.55]].forEach((zArr, idx) => {
          const sl = new THREE.SpotLight(0xfff5e0, 1.5, 60, 0.4, 0.5);
          sl.position.set(1.78, 0.72, zArr[0]);
          sl.target.position.set(20, 0.2, zArr[0]);
          sl.castShadow = idx === 0;
          if (sl.castShadow) { sl.shadow.mapSize.set(512, 512); sl.shadow.bias = -0.0003; }
          rov.add(sl); rov.add(sl.target);
        });
      } else if (rType === 'home') {
        const botM = new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.4, metalness: 0.1 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.05, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.6 })); base.position.y = 0.25; base.castShadow = true; body.add(base);
        const torso = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.78, 1.1, 6, 16) : new THREE.CylinderGeometry(0.78, 0.78, 1.9, 16), botM); torso.position.y = 1.55; torso.castShadow = true; body.add(torso);
        const chest = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16), accMat()); chest.position.set(0.74, 1.6, 0); chest.rotation.y = Math.PI / 2; body.add(chest);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.66, 20, 16), botM); head.position.y = 2.75; head.castShadow = true; body.add(head);
        const visor = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12), new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.2, metalness: 0.4 })); visor.scale.set(1, 0.7, 0.6); visor.position.set(0.42, 2.78, 0); body.add(visor);
        [[0.78, 0.18], [0.78, -0.18]].forEach((p) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), accMat()); e.position.set(p[0], 2.82, p[1]); body.add(e); });
        // arms: a companion robot needs hands. Shoulder + upper arm + elbow +
        // forearm per side, hanging at rest, accent-coloured joints.
        const armMatH = new THREE.MeshStandardMaterial({ color: 0xd7dbe2, roughness: 0.45, metalness: 0.15 });
        [0.86, -0.86].forEach((z) => {
          const sh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), accMat()); sh.position.set(0, 2.0, z); body.add(sh);
          const up = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.17, 0.66, 4, 8) : new THREE.CylinderGeometry(0.17, 0.17, 1.0, 8), armMatH); up.position.set(0.06, 1.52, z); up.castShadow = true; body.add(up);
          const el = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), accMat()); el.position.set(0.12, 1.08, z); body.add(el);
          const fo = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.14, 0.52, 4, 8) : new THREE.CylinderGeometry(0.14, 0.14, 0.8, 8), armMatH); fo.position.set(0.18, 0.66, z); fo.castShadow = true; body.add(fo);
        });
        // wheels pushed out past the base skirt so they are actually visible
        // (at the old 0.55 they were buried inside the ~1.0-radius base).
        addWheels([[0, 1.05], [0, -1.05]], 0.32);
        arrow(3.5);
      } else if (rType === 'arm') {
        const armM = new THREE.MeshStandardMaterial({ color: 0xc7ccd4, roughness: 0.35, metalness: 0.6 });
        const jointM = accMat();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.7, 20), new THREE.MeshStandardMaterial({ color: 0x39414c, roughness: 0.6 })); base.position.y = 0.35; base.castShadow = true; body.add(base);
        const j1 = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), jointM); j1.position.y = 0.9; body.add(j1);
        const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.5), armM); seg1.position.set(0.2, 2.0, 0); seg1.rotation.z = -0.5; seg1.castShadow = true; body.add(seg1);
        const j2 = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), jointM); j2.position.set(1.1, 2.9, 0); body.add(j2);
        const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 0.4), armM); seg2.position.set(1.9, 3.4, 0); seg2.rotation.z = -1.2; seg2.castShadow = true; body.add(seg2);
        // wrist joint capping seg2 so the gripper reads as articulated, not floating
        const j3 = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), jointM); j3.position.set(2.55, 3.62, 0); body.add(j3);
        const g1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), armM); g1.position.set(2.7, 3.7, 0.22); body.add(g1);
        const g2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), armM); g2.position.set(2.7, 3.7, -0.22); body.add(g2);
        arrow(1.3);
      } else {
        // rover (and custom): chassis, solar deck, sensor mast with a camera eye.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.42, metalness: 0.45, envMapIntensity: 1.0 });
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.7), bodyMat); chassis.position.y = 0.92; chassis.castShadow = true; body.add(chassis);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 1.4), new THREE.MeshStandardMaterial({ color: 0x1b2740, roughness: 0.3, metalness: 0.5 })); deck.position.set(-0.2, 1.34, 0); body.add(deck);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8), bodyMat); mast.position.set(0.85, 1.75, 0); body.add(mast);
        const camHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.72), bodyMat); camHead.position.set(0.85, 2.3, 0); camHead.castShadow = true; body.add(camHead);
        const eye = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), accMat()); eye.position.set(1.12, 2.3, 0); eye.rotation.y = Math.PI / 2; body.add(eye);
        // A small status LED atop the mast that pulses each frame (see tick()).
        const ledMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.6 });
        ledIndicator = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), ledMat);
        ledIndicator.position.set(0.85, 2.6, 0); body.add(ledIndicator);
        // running lights on the leading edge of the chassis
        const litM = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff0c0, emissiveIntensity: 0.9 });
        [[1.3, 0.55], [1.3, -0.55]].forEach((p) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.28), litM); l.position.set(p[0], 0.85, p[1]); body.add(l); });
        addWheels([[0.95, 0.95], [0.95, -0.95], [-0.95, 0.95], [-0.95, -0.95]], 0.5);
        arrow(2.05);
      }
      // Sensor attachments: small modules on the body reflecting the FITTED
      // parts, so the robot the user designed is visible. Mounted on `body` so
      // they lean with weight transfer. Forward is +x. Guarded so a bad spec or
      // a missing global can never break the scene build.
      try {
        const fitted = (window.getKodroRobot && window.getKodroRobot().sensors) || [];
        const sy = rType === 'home' ? 1.6 : rType === 'arm' ? 1.0 : 1.15; // mount height by build
        const fx = rType === 'car' ? 1.55 : rType === 'home' ? 0.7 : 1.25;  // front face by build
        const darkM = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.7, metalness: 0.3 });
        if (rType !== 'arm') {
          if (fitted.indexOf('ultrasonic') >= 0) {
            [0.2, -0.2].forEach((z) => {
              const e = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.13, 16), darkM); e.rotation.z = Math.PI / 2; e.position.set(fx, sy, z); body.add(e);
              const r = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), accMat()); r.position.set(fx + 0.08, sy, z); r.rotation.y = Math.PI / 2; body.add(r);
            });
          }
          if (fitted.indexOf('camera') >= 0) {
            const cam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.34), darkM); cam.position.set(fx - 0.05, sy + 0.4, 0); body.add(cam);
            const lens = new THREE.Mesh(new THREE.CircleGeometry(0.09, 14), accMat()); lens.position.set(fx + 0.07, sy + 0.4, 0); lens.rotation.y = Math.PI / 2; body.add(lens);
          }
          if (fitted.indexOf('bumper') >= 0) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 1.2), new THREE.MeshStandardMaterial({ color: 0xb84a3a, roughness: 0.6 })); bar.position.set(fx + 0.05, 0.55, 0); body.add(bar);
          }
          if (fitted.indexOf('line') >= 0) {
            const ls = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.5), darkM); ls.position.set(fx - 0.2, 0.35, 0); body.add(ls);
          }
        }
        if (fitted.indexOf('gps') >= 0) {
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x9aa0ad, metalness: 0.6, roughness: 0.4 })); ant.position.set(-0.2, sy + 0.9, 0.3); body.add(ant);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), accMat()); tip.position.set(-0.2, sy + 1.25, 0.3); body.add(tip);
        }
        if (fitted.indexOf('imu') >= 0) {
          const chip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.16), new THREE.MeshStandardMaterial({ color: 0x2c7a4a, roughness: 0.5 })); chip.position.set(-0.1, sy + 0.1, -0.3); body.add(chip);
        }
      } catch (e) { void e; }
      // Practical scale: a robot indoors shares a small room with furniture, so
      // it is sized down to fit rather than towering over the sofa.
      // Give the robot real presence: it was reading as a distant toy. Scale it
      // up so the build and its sensor pods are legible (indoors stays a touch
      // smaller so it does not tower over the furniture).
      rov.scale.setScalar(id === 'room' ? 1.05 : 1.4);
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
      // Motion feel: a real vehicle transfers weight, so the body pitches when
      // it accelerates or brakes, banks into turns, and the suspension settles.
      let prevSpeed = 0, prevHead = 0, bodyPitch = 0, bodyRoll = 0, susp = 0, vsmooth = 0;
      const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
      const camPos = new THREE.Vector3(0, 20, 30);

      // Third-person orbit: drag to rotate, wheel or two-finger pinch to zoom,
      // so it works on a tablet or Chromebook as well as a mouse.
      let azim = 2.4, elev = 0.62, dist = id === 'room' ? 13 : 19, dragging = false, lx = 0, ly = 0;
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
        if (post) post.setSize(w, h);
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
        // Rover status LED: pulses on a slow sine and tracks the live LED colour
        // (s.led is a hex string set by led("cyan") etc.), falling back to accent.
        if (ledIndicator) {
          ledIndicator.material.emissiveIntensity = 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(now * 0.004));
          if (s.led && s.led !== ledIndicator.userData.led) {
            ledIndicator.userData.led = s.led;
            const lc = new THREE.Color(s.led);
            ledIndicator.material.color.copy(lc); ledIndicator.material.emissive.copy(lc);
          }
        }
        // ---- weight transfer, banking, suspension and steering ----
        const accel = moved - prevSpeed; prevSpeed = moved;
        vsmooth += (moved - vsmooth) * 0.2;
        let turn = curHeading - prevHead; prevHead = curHeading;
        if (turn > Math.PI) turn -= Math.PI * 2; else if (turn < -Math.PI) turn += Math.PI * 2;
        // pitch: nose lifts under acceleration, dips under braking (about the lateral axis = local z)
        bodyPitch += (clamp(-accel * 7, -0.16, 0.16) * feel.pitch - bodyPitch) * 0.18;
        // roll: lean into the turn (about the forward axis = local x), more at speed
        bodyRoll += (clamp(turn * 9 + turn * vsmooth * 22, -0.24, 0.24) * feel.roll - bodyRoll) * 0.16;
        // suspension: a small settle driven by acceleration, eased back to rest
        susp += (clamp(-accel * 1.6, -0.18, 0.18) * feel.susp - susp) * 0.22;
        body.rotation.z = bodyPitch;
        body.rotation.x = bodyRoll;
        body.position.y = -Math.abs(susp) * 0.35;
        // front wheels steer toward the heading change
        if (steer.length) { const sa = clamp(turn * 26, -0.5, 0.5); steer.forEach((wg) => { wg.rotation.y += (sa - wg.rotation.y) * 0.3; }); }
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
        // Cinematic uses the offline bloom/vignette pass; every other tier (and
        // the post-downgrade slow-GPU path) renders straight to the canvas. If
        // the post pass ever throws at frame time (e.g. an old GPU that cannot
        // linear-filter the half-float bloom target), disable it permanently and
        // fall back to the plain render so the view never freezes.
        if (post && !downgraded) {
          try { post.render(scene, camera); }
          catch (e) { void e; try { post.dispose(); } catch (e2) { void e2; } post = null; renderer.setRenderTarget(null); renderer.render(scene, camera); }
        } else {
          renderer.render(scene, camera);
        }
        raf = window.requestAnimationFrame(tick);
      };
      tick();

      return () => {
        disposed = true;
        window.cancelAnimationFrame(raf);
        if (post) { try { post.dispose(); } catch (e) { void e; } post = null; }
        window.removeEventListener('resize', onResize);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointermove', onMove);
        dom.removeEventListener('pointerdown', onDown);
        dom.removeEventListener('wheel', onWheel);
        dom.removeEventListener('keydown', onKey);
        canvas.removeEventListener('webglcontextlost', onContextLost);
        trailGeo.dispose();
        renderer.dispose();
        // The PMREM environment map is a render-target texture and is not a
        // scene-graph child, so traverse never reaches it: dispose it directly.
        if (scene.environment) scene.environment.dispose();
        scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => {
            // Material.dispose() does not free textures it references (they may be
            // shared), so dispose the maps too. dispose() is idempotent.
            if (m.map) m.map.dispose();
            if (m.emissiveMap) m.emissiveMap.dispose();
            if (m.normalMap) m.normalMap.dispose();
            if (m.roughnessMap) m.roughnessMap.dispose();
            m.dispose();
          });
        });
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      };
    }, [terrain && terrain.id, robotType]);

    return React.createElement('div', { className: 'viewport3d', ref: mountRef });
  }

  window.Viewport3D = Viewport3D;
})();
