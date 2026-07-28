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

  function Viewport3D({ terrain, rover, fpv, robotType, quality, focusKey, onFail, props }) {
    const mountRef = useRef(null);
    const stateRef = useRef({ x: 0, y: 0, heading: 0 });
    const fpvRef = useRef(!!fpv);
    // Handles to the live GL objects so a quality change applies in place
    // (pixel ratio, shadows) instead of remounting and rebuilding the scene.
    const glRef = useRef(null);
    stateRef.current = rover || stateRef.current;
    fpvRef.current = !!fpv;

    // Apply a render-quality change in place. Low/Med/High differ only by pixel
    // ratio and shadow resolution, all adjustable on the live renderer, so the
    // Low/Med/High switch no longer tears down and rebuilds the whole scene
    // (which cost 200-500ms and a fresh GL context). Cinematic still remounts
    // via the key because it needs the offline post pipeline built at setup.
    useEffect(() => {
      const g = glRef.current;
      if (!g || !g.renderer) return;
      const Q = quality || 'high';
      const dpr = (window.devicePixelRatio || 1);
      g.renderer.setPixelRatio(Q === 'low' ? 1 : Q === 'med' ? Math.min(1.25, dpr) : Q === 'cinematic' ? Math.min(2, dpr * 1.5) : Math.min(1.5, dpr));
      const wantShadow = (Q !== 'low');
      g.renderer.shadowMap.enabled = wantShadow;
      g.renderer.shadowMap.needsUpdate = true;
      if (g.sun) {
        g.sun.castShadow = wantShadow;
        const n = Q === 'low' ? 512 : Q === 'med' ? 1024 : Q === 'cinematic' ? 2048 : (g.indoor ? 2048 : 1024);
        if (g.sun.shadow.mapSize.x !== n) {
          g.sun.shadow.mapSize.set(n, n);
          // Drop the cached shadow map so Three.js reallocates it at the new size.
          if (g.sun.shadow.map) { g.sun.shadow.map.dispose(); g.sun.shadow.map = null; }
        }
      }
    }, [quality]);

    useEffect(() => {
      const THREE = (typeof window !== 'undefined') && window.THREE;
      const mount = mountRef.current;
      if (!mount) return undefined;
      // THREE present but broken/absent (vendored file failed to define the
      // global): show a calm message and auto-switch to the working 2.5D view
      // instead of leaving a blank panel.
      if (!THREE) {
        mount.innerHTML = '<div class="vp3d-fail">3D is unavailable on this machine. Showing the 2.5D view.</div>';
        if (typeof onFail === 'function') { try { onFail(); } catch (e) { void e; } }
        return undefined;
      }

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
      // Live, not read-once: if the OS setting changes while the view is open,
      // a matchMedia listener flips the smoothing immediately (tick() reads
      // these each frame), so the preference never goes stale.
      const reduceMql = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)')) || null;
      let reduce = !!(reduceMql && reduceMql.matches);
      let posLerp = reduce ? 1 : 0.16;
      let camLerp = reduce ? 1 : 0.12;
      const onReduceChange = (e) => { reduce = !!e.matches; posLerp = reduce ? 1 : 0.16; camLerp = reduce ? 1 : 0.12; };
      if (reduceMql) {
        if (reduceMql.addEventListener) reduceMql.addEventListener('change', onReduceChange);
        else if (reduceMql.addListener) reduceMql.addListener(onReduceChange); // older Safari
      }

      // Guard WebGL: a failed context (old GPU, lost context) shows a calm
      // message and the pupil can fall back to the flat view, never a blank box.
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
      } catch (err) {
        mount.innerHTML = '<div class="vp3d-fail">3D needs a graphics card this machine cannot give. Showing the 2.5D view.</div>';
        if (typeof onFail === 'function') { try { onFail(); } catch (e) { void e; } }
        return undefined;
      }
      let disposed = false;
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
      // Normally the app's first-run quality probe has already populated this.
      // The performance harness mounts the viewport on its own, though, so
      // without a lazy probe here the evidence file recorded its renderer as
      // 'unknown' -- an fps figure that cannot say whether a GPU or a CPU drew
      // it is not evidence of much, so detect once if nobody has yet.
      if (!window.KODRO_GPU_CAPS && window.KodroGpuCaps && window.KodroGpuCaps.detect) {
        try { window.KODRO_GPU_CAPS = window.KodroGpuCaps.detect(); } catch (e) { void e; }
      }
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
      // A lost context used to be terminal: the notice appeared and 3D stayed
      // dead until the whole viewport remounted. GPU resets are routine on the
      // laptops this is aimed at (lid close, sleep, driver recovery, switching
      // graphics), so honour the restore event. preventDefault() above is what
      // makes the browser willing to send it. Rebuilding the scene graph from
      // here is not safe mid-teardown, so ask the host to remount cleanly.
      const onContextRestored = () => {
        mount.classList.remove('vp3d-lost');
        try {
          window.dispatchEvent(new CustomEvent('kodro-webgl-restored'));
        } catch (err) { void err; }
      };
      canvas.addEventListener('webglcontextrestored', onContextRestored, false);
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
      else if (id === 'mars') scene.fog = new THREE.FogExp2(FOG[id], 0.008);
      else scene.fog = new THREE.Fog(FOG[id] != null ? FOG[id] : FOG.earth, id === 'space' ? 200 : 60, id === 'space' ? 800 : (id === 'earth' ? 280 : 220));
      // Indoor test bays (lab/warehouse/debug) resolve to the room base, so they
      // inherited the room's warm cream sky and the grey props washed out into a
      // void. Give each its own backdrop + fog so the walls and props read.
      const _sid = terrain && terrain.siteId;
      // Scene-rebuild marker: stamp WHICH world/site this scene was built for
      // on the mount node, so the UI harness can assert that a mission-site
      // switch really rebuilt the scene (F1) instead of trusting the label.
      try { mount.dataset.world = id + (_sid ? ':' + _sid : ''); } catch (e) { void e; }
      if (_sid === 'lab') { scene.background = new THREE.Color(0xaeb6c2); scene.fog = new THREE.Fog(0xaeb6c2, 70, 240); }
      else if (_sid === 'warehouse') { scene.background = new THREE.Color(0x383b42); scene.fog = new THREE.Fog(0x383b42, 50, 200); }
      else if (_sid === 'debug_grid') { scene.background = new THREE.Color(0x0a0c10); scene.fog = new THREE.Fog(0x0a0c10, 90, 320); }

      // W1: per-site atmosphere. A mission site carries its own sky, fog, sun
      // and hemisphere values (terrain.atmos, authored in terrains.jsx), and
      // the site's env.light drives every light intensity through a
      // playability floor -- so the Challenger Deep (light 0) and Europa
      // (light 4) finally render dark, while the scene stays navigable
      // instead of going pitch black. Base worlds keep their tuned defaults.
      const atmos = (terrain && terrain.atmos) || null;
      const _envLight = (terrain && terrain.env && terrain.env.light != null) ? terrain.env.light : 100;
      const lightK = atmos ? 0.25 + 0.75 * Math.max(0, Math.min(100, _envLight)) / 100 : 1;
      if (atmos) {
        if (atmos.sky) scene.background = new THREE.Color(atmos.sky);
        if (atmos.fog) {
          const fogHex = new THREE.Color(atmos.fog).getHex();
          if (scene.fog && scene.fog.isFogExp2) scene.fog = new THREE.FogExp2(fogHex, atmos.fogDensity || scene.fog.density);
          else scene.fog = new THREE.Fog(fogHex, atmos.fogNear || (scene.fog ? scene.fog.near : 60), atmos.fogFar || (scene.fog ? scene.fog.far : 220));
        } else if (atmos.fogDensity && scene.fog && scene.fog.isFogExp2) {
          scene.fog.density = atmos.fogDensity;
        }
        // Stamp the wiring for the QA harness: this scene applied a site row.
        try { mount.dataset.atmos = '1'; } catch (e) { void e; }
      }

      const indoor = id === 'room';
      // ---- R8 time-of-day + R10 Mars dust storm: build-time atmosphere.
      // App already scaled terrain.env.light through KodroWorldFX.applyTod, so
      // the LIGHT gauge, the light() sensor and this picture agree. Low tier
      // keeps noon/clear (med+ static per the plan); a preset change remounts
      // the viewport through the app-side key, so this is build-time only.
      // Time-of-day applies at EVERY quality tier: the app-side applyTod
      // already scaled env.light (the LIGHT gauge and the light() sensor), so
      // gating the visuals on quality left Low users with a noon-bright scene
      // while their gauge read 20% -- picture and instruments must agree. The
      // tod light maths is cheap; only the streetlamp cones stay gated below.
      const _tod = (!indoor && terrain && terrain.tod) || 'noon';
      const todAdj = (_tod !== 'noon' && window.KodroWorldFX && window.KodroWorldFX.todShift) ? window.KodroWorldFX.todShift(_tod) : null;
      const _weather = (!indoor && terrain && terrain.weather) || 'clear';
      const storm = _weather === 'storm' && id === 'mars' && Q !== 'low';
      if (todAdj) {
        if (scene.background && scene.background.isColor) scene.background.lerp(new THREE.Color(todAdj.sky[0]), todAdj.sky[1]);
        if (scene.fog) scene.fog.color.lerp(new THREE.Color(todAdj.fog[0]), todAdj.fog[1]);
        try { mount.dataset.tod = _tod; } catch (e) { void e; }
      }
      if (storm) {
        // Three lines of mood: the murk trebles, the sky stains dust-red, and
        // the sun chokes (sunInt/hemiInt scale below). The dust particle count
        // trebles in the ambient build, which receives the weather flag.
        if (scene.fog && scene.fog.isFogExp2) scene.fog.density *= 3.2;
        if (scene.background && scene.background.isColor) scene.background.lerp(new THREE.Color(0x7a3c24), 0.45);
        if (scene.fog) scene.fog.color.lerp(new THREE.Color(0x7a3c24), 0.45);
        try { mount.dataset.weather = 'storm'; } catch (e) { void e; }
      }

      const camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 2000);

      // Lights. Indoors (room) is warm and soft; outdoors is daylight.
      const skyCol2 = indoor ? 0xfff1de : 0xffffff;
      const grndCol2 = indoor ? 0x3a2f28 : 0x404048;
      // Each world carries its own light mood: the Moon is dim and contrasty,
      // the abyss is dark and blue, Mars is dusty and half-lit, indoors is warm.
      const hemiBase = id === 'space' ? 0.4 : id === 'underwater' ? 0.45 : indoor ? 0.85 : id === 'mars' ? 0.52 : 0.6;
      const hemiInt = (atmos && atmos.hemiInt != null ? atmos.hemiInt : hemiBase) * lightK
        * (todAdj ? todAdj.hemiMul : 1) * (storm ? 0.65 : 1);
      scene.add(new THREE.HemisphereLight(skyCol2, grndCol2, hemiInt));
      const sunCol = (atmos && atmos.sun) ? new THREE.Color(atmos.sun).getHex()
        : indoor ? 0xffe9c4 : id === 'underwater' ? 0x6fb7c9 : id === 'mars' ? 0xffd9b0 : 0xfff4e2;
      const sunBase = id === 'space' ? 0.9 : id === 'underwater' ? 0.6 : indoor ? 1.05 : id === 'mars' ? 1.05 : 1.4;
      const sunInt = (atmos && atmos.sunInt != null ? atmos.sunInt : sunBase) * lightK
        * (todAdj ? todAdj.sunMul : 1) * (storm ? 0.4 : 1);
      // R8: the preset recolours and repositions the sun (a low warm dawn sun,
      // a cold high moon at night); noon keeps the tuned default exactly.
      const sunCol3 = new THREE.Color(sunCol);
      if (todAdj) sunCol3.lerp(new THREE.Color(todAdj.sun[0]), todAdj.sun[1]);
      const sun = new THREE.DirectionalLight(sunCol3, sunInt);
      sun.position.set(indoor ? 18 : 40, indoor ? 38 : 80, indoor ? 22 : 30);
      if (todAdj && todAdj.sunPos) sun.position.set(todAdj.sunPos[0], todAdj.sunPos[1], todAdj.sunPos[2]);
      sun.castShadow = true;
      const _shMap = Q === 'low' ? 512 : Q === 'med' ? 1024 : Q === 'cinematic' ? 2048 : (indoor ? 2048 : 1024);
      sun.shadow.mapSize.set(_shMap, _shMap); // quality-scaled: lighter on iGPUs at Low/Med, crisp at High/Cinematic
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 320;
      sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
      sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
      sun.shadow.bias = -0.0004;
      if (sun.shadow.radius != null) sun.shadow.radius = 5;
      scene.add(sun);
      // A soft fill from the opposite side so shadowed faces are not black.
      const fill = new THREE.DirectionalLight(0xbcd2ff, (indoor ? 0.18 : 0.28) * lightK);
      fill.position.set(-30, 26, -22);
      scene.add(fill);
      // A second warm fill for indoor rooms so furniture and the robot are not
      // lost in under-lit corners; positioned 45 degrees off the first fill.
      if (indoor) {
        const warmFill = new THREE.DirectionalLight(0xffe8c0, 0.3);
        warmFill.position.set(-6, 26, -37);
        scene.add(warmFill);
      }

      // A gradient sky dome so the world has a horizon, not a flat wall of fog.
      const skyTop = new THREE.Color(SKY[id] != null ? SKY[id] : SKY.earth);
      const skyBot = new THREE.Color(FOG[id] != null ? FOG[id] : FOG.earth);
      // Indoor bays: the dome is the visible backdrop, so colour it to match the
      // bay instead of the room's cream, or the grey props wash out into it.
      if (_sid === 'lab') { skyTop.set(0xc2c8d2); skyBot.set(0xaeb6c2); }
      else if (_sid === 'warehouse') { skyTop.set(0x44474e); skyBot.set(0x2c2f35); }
      else if (_sid === 'debug_grid') { skyTop.set(0x10141c); skyBot.set(0x06080c); }
      // W1: a site atmosphere recolours the dome to match its sky and fog.
      if (atmos) {
        if (atmos.sky) skyTop.set(atmos.sky);
        if (atmos.fog) skyBot.set(atmos.fog);
      }
      // R8/R10: the dome follows the same time-of-day / storm shift the scene
      // background took, so the horizon never disagrees with the sky.
      if (todAdj) {
        skyTop.lerp(new THREE.Color(todAdj.sky[0]), todAdj.sky[1]);
        skyBot.lerp(new THREE.Color(todAdj.fog[0]), todAdj.fog[1]);
      }
      if (storm) { skyTop.lerp(new THREE.Color(0x7a3c24), 0.45); skyBot.lerp(new THREE.Color(0x7a3c24), 0.5); }
      const skyGeo = new THREE.SphereGeometry(900, 24, 12);
      const skyCol = [];
      const pos = skyGeo.attributes.position;
      // Horizon haze: a soft warm/cyan glow band near the horizon line (y~0,
      // t~0.5) so the sky has depth instead of a flat gradient. Earth/Mars get
      // a sunset-orange band; underwater gets a cyan-green glow; space is skipped.
      // A site row may override the haze colour or switch it off (haze: null).
      const baseHaze = id === 'underwater' ? new THREE.Color(0x3adfc4)
        : (id === 'earth' || id === 'mars') ? new THREE.Color(0xffa050) : null;
      // Night kills the warm horizon band (there is no sunset at midnight).
      const hazeCol = (_tod === 'night') ? null
        : (atmos && ('haze' in atmos)) ? (atmos.haze ? new THREE.Color(atmos.haze) : null) : baseHaze;
      for (let i = 0; i < pos.count; i++) {
        const t = Math.max(0, Math.min(1, (pos.getY(i) / 900) * 0.5 + 0.5));
        const c = skyBot.clone().lerp(skyTop, t);
        if (hazeCol) {
          const band = Math.exp(-Math.pow((t - 0.5) * 3.2, 2)); // gaussian centred on horizon
          c.lerp(hazeCol, band * 0.35);
        }
        skyCol.push(c.r, c.g, c.b);
      }
      skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyCol, 3));
      const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
      scene.add(sky);
      // The Moon has no atmosphere, so its sky is full of stars. Cheap Points
      // cloud on the upper hemisphere (it is a scene child, so teardown disposes it).
      if (id === 'space') {
        const sg = new THREE.BufferGeometry();
        const N = 1200, arr = new Float32Array(N * 3), colArr = new Float32Array(N * 3), sizeArr = new Float32Array(N);
        const starCols = [[1, 1, 1], [0.7, 0.8, 1.0], [1.0, 0.95, 0.8]]; // white, pale blue, pale yellow
        for (let i = 0; i < N; i++) {
          const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
          arr[i * 3] = Math.cos(th) * rr * 850; arr[i * 3 + 1] = Math.abs(u) * 850; arr[i * 3 + 2] = Math.sin(th) * rr * 850;
          const col = starCols[(Math.random() * starCols.length) | 0];
          colArr[i * 3] = col[0]; colArr[i * 3 + 1] = col[1]; colArr[i * 3 + 2] = col[2];
          sizeArr[i] = 0.8 + Math.random() * 1.6; // 0.8 to 2.4
        }
        sg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        sg.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
        sg.setAttribute('size', new THREE.BufferAttribute(sizeArr, 1));
        // PointsMaterial in r137 lacks per-vertex size, so a core ShaderMaterial
        // gives both per-vertex colours and sizes in a single BufferGeometry.
        const starMat = new THREE.ShaderMaterial({
          vertexShader: 'attribute float size;\nattribute vec3 color;\nvarying vec3 vColor;\nvoid main(){vColor=color;gl_PointSize=size;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
          fragmentShader: 'varying vec3 vColor;\nvoid main(){vec2 c=gl_PointCoord-0.5;float d=length(c);if(d>0.5)discard;float a=smoothstep(0.5,0.15,d);gl_FragColor=vec4(vColor,a);}',
          transparent: true, depthWrite: false, fog: false,
        });
        scene.add(new THREE.Points(sg, starMat));
      }

      // ---- W2: skyline landforms. One data-driven helper places 1 to 6
      // fog-tinted low-poly silhouettes (cone, ridge, pyramid, crater rim,
      // shield, wedge) at 250 to 400 units, so a mission site has a horizon
      // identity -- Fuji's cone, Giza's pyramids, Tycho's rim -- instead of a
      // featureless void. fog:false with a colour pre-blended toward the fog
      // keeps them readable beyond the fog far plane; every mesh is a scene
      // child so the teardown traverse frees it. Under 2k triangles per site.
      // Rows: k kind, a azimuth deg, d distance, w width, h height,
      //       c colour, t fog-tint 0..1 (default 0.55), snow adds a snow cap.
      // Hero landforms sit 15 to 20 deg OFF the default view centre (azimuth
      // ~318 deg for the default orbit): dead-centre sky is hidden behind the
      // terrain-switch overlay, so the identity silhouettes rise in the open
      // sky columns beside it, apexes inside the 62 deg frame.
      const SKYLINES = {
        japan: [
          { k: 'cone', a: 334, d: 360, w: 280, h: 105, c: '#4a4550', t: 0.35, snow: true },
          { k: 'ridge', a: 296, d: 390, w: 340, h: 52, c: '#4a4550' },
          { k: 'ridge', a: 356, d: 390, w: 300, h: 44, c: '#4a4550' },
        ],
        egypt: [
          // M5: the pyramids washed into the pale desert sky (fog-tint too high
          // over a near-white sky). Drop the tint hard and darken to a sunlit-
          // sandstone shadow tone, and raise the apexes so the triangles clearly
          // break the horizon instead of ghosting into it.
          { k: 'pyramid', a: 330, d: 300, w: 190, h: 132, c: '#9a6f38', t: 0.1 },
          { k: 'pyramid', a: 344, d: 330, w: 150, h: 104, c: '#8f6430', t: 0.14 },
          { k: 'pyramid', a: 318, d: 356, w: 118, h: 80, c: '#845b2c', t: 0.2 },
        ],
        nepal: [
          { k: 'ridge', a: 0, d: 380, w: 360, h: 150, c: '#e8eef4', t: 0.3 },
          { k: 'ridge', a: 55, d: 395, w: 320, h: 190, c: '#dfe8f0', t: 0.3 },
          { k: 'ridge', a: 118, d: 385, w: 340, h: 165, c: '#e8eef4', t: 0.35 },
          { k: 'ridge', a: 208, d: 390, w: 330, h: 175, c: '#dfe8f0', t: 0.35 },
          { k: 'ridge', a: 292, d: 380, w: 300, h: 145, c: '#e8eef4', t: 0.3 },
        ],
        kenya: [{ k: 'wedge', a: 334, d: 380, w: 420, h: 55, c: '#8a7a4e' }],
        antarctica: [
          // M5: the whole frame was a near-white void -- ice-white landforms on
          // a near-white sky and fog. Give the ice shelf a real horizon: a long
          // shadowed ice cliff (bluer, near-zero tint) with taller bergs behind
          // it, so an ice wall clearly separates ground from sky at first glance.
          { k: 'wedge', a: 332, d: 355, w: 520, h: 96, c: '#7d9cba', t: 0.05 },
          { k: 'ridge', a: 300, d: 385, w: 260, h: 150, c: '#8fadc8', t: 0.08 },
          { k: 'ridge', a: 356, d: 380, w: 230, h: 120, c: '#88a6c2', t: 0.1 },
        ],
        sahara: [
          { k: 'ridge', a: 300, d: 340, w: 320, h: 42, c: '#c9a05e' },
          { k: 'ridge', a: 338, d: 385, w: 380, h: 55, c: '#bd9354' },
        ],
        india: [{ k: 'ridge', a: 322, d: 350, w: 300, h: 38, c: '#c99a58' }],
        iceland: [
          { k: 'shield', a: 334, d: 380, w: 420, h: 80, c: '#3c4148' },
          { k: 'ridge', a: 296, d: 360, w: 260, h: 50, c: '#464b52' },
        ],
        amazon: [
          { k: 'ridge', a: 65, d: 300, w: 420, h: 60, c: '#24401e', t: 0.4 },
          { k: 'ridge', a: 175, d: 310, w: 400, h: 55, c: '#28451f', t: 0.4 },
          { k: 'ridge', a: 285, d: 305, w: 410, h: 58, c: '#24401e', t: 0.4 },
        ],
        olympus: [
          // M5: no shield volcano read at all -- one low, far, heavily fog-tinted
          // dome vanished into the dusty sky. Olympus Mons is the tallest volcano
          // in the solar system: bring the shield closer and much taller, drop
          // the tint, and stack a broad lower flank so the frame is unmistakably
          // dominated by an enormous gently-domed mountain.
          { k: 'shield', a: 332, d: 330, w: 620, h: 230, c: '#7a3a24', t: 0.12 },
          { k: 'shield', a: 332, d: 366, w: 940, h: 120, c: '#6e3320', t: 0.22 },
        ],
        tycho: [
          { k: 'craterrim', d: 400, h: 46, c: '#5a5c66', t: 0.25 },
          { k: 'cone', a: 334, d: 260, w: 150, h: 80, c: '#6a6c76', t: 0.2 },
        ],
        europa: [
          { k: 'ridge', a: 298, d: 330, w: 380, h: 26, c: '#7a5a50', t: 0.3 },
          { k: 'ridge', a: 342, d: 350, w: 420, h: 30, c: '#7a5a50', t: 0.3 },
        ],
        // The reef's identity is the coral field itself; the Challenger Deep's
        // identity is darkness. Neither gets a horizon landform on purpose.
      };
      try {
        const skyRows = (_sid && SKYLINES[_sid]) || null;
        if (skyRows && skyRows.length) {
          const fogTint = new THREE.Color(scene.fog ? scene.fog.color : (FOG[id] != null ? FOG[id] : FOG.earth));
          const kinds = [];
          skyRows.forEach((rw) => {
            const col = new THREE.Color(rw.c || groundColor).lerp(fogTint, rw.t != null ? rw.t : 0.55)
              .multiplyScalar(lightK * (todAdj ? todAdj.hemiMul : 1));
            const lfM = new THREE.MeshBasicMaterial({ color: col, fog: false });
            const aRad = (rw.a || 0) * Math.PI / 180;
            let lf = null;
            if (rw.k === 'cone') lf = new THREE.Mesh(new THREE.ConeGeometry(rw.w / 2, rw.h, 10), lfM);
            else if (rw.k === 'pyramid') { lf = new THREE.Mesh(new THREE.ConeGeometry(rw.w * 0.7, rw.h, 4), lfM); lf.rotation.y = Math.PI / 4; }
            else if (rw.k === 'ridge') { lf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), lfM); lf.scale.set(rw.w, rw.h, rw.w * 0.18); lf.rotation.y = aRad + Math.PI / 2; }
            else if (rw.k === 'shield') lf = new THREE.Mesh(new THREE.ConeGeometry(rw.w / 2, rw.h, 12), lfM);
            else if (rw.k === 'wedge') { lf = new THREE.Mesh(new THREE.BoxGeometry(rw.w, rw.h, rw.h * 0.7), lfM); lf.rotation.y = aRad + Math.PI / 2; }
            else if (rw.k === 'craterrim') { lf = new THREE.Mesh(new THREE.TorusGeometry(rw.d, rw.h, 6, 28), lfM); lf.rotation.x = Math.PI / 2; }
            if (!lf) return;
            if (rw.k === 'craterrim') lf.position.set(0, 0, 0); // the rim RINGS the play area
            else lf.position.set(Math.cos(aRad) * rw.d, rw.h / 2, Math.sin(aRad) * rw.d);
            if (rw.snow) {
              // snow cap: a smaller cone whose apex coincides with the peak
              const capCol = new THREE.Color('#eef4fa').lerp(fogTint, 0.3).multiplyScalar(lightK);
              const cap = new THREE.Mesh(new THREE.ConeGeometry(rw.w * 0.17, rw.h * 0.36, 10), new THREE.MeshBasicMaterial({ color: capCol, fog: false }));
              cap.position.y = rw.h * 0.32;
              lf.add(cap);
            }
            lf.userData.kodroSkyline = rw.k;
            kinds.push(rw.k);
            scene.add(lf);
          });
          if (kinds.length) { try { mount.dataset.skyline = kinds.join(','); } catch (e) { void e; } }
        }
      } catch (e) { if (window.console) console.warn('Viewport3D skyline failed:', e); }

      // Ground.
      const groundMat = new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1 });
      const openWorld = id !== 'city' && id !== 'room';
      // Open terrain gets a subdivided, gently displaced surface (dunes, swells)
      // so light grazes real undulations instead of reading as a billiard-flat
      // plane. City and room keep a flat floor.
      const groundGeo = openWorld ? new THREE.PlaneGeometry(400, 400, 96, 96) : new THREE.PlaneGeometry(400, 400);
      // R5: ONE displacement field shared by the ground mesh, the robot, the
      // props, the agents, the trail, the FPV camera and the scenario markers.
      // The plane is authored in XY before its -90deg X rotation, so plane
      // (px, py) maps to world (px, -pz): groundY converts from world coords.
      const dispAmp = openWorld ? (id === 'underwater' ? 2.6 : id === 'space' ? 1.8 : 3.0) : 0;
      const dispField = (px, py) => Math.sin(px * 0.05) * Math.cos(py * 0.045) * 0.6
        + Math.sin(px * 0.013 + py * 0.017) * 0.3
        + Math.sin((px + py) * 0.09) * 0.12;
      const groundY = (wx, wz) => dispAmp ? dispField(wx, -wz) * dispAmp : 0;
      if (openWorld) {
        const pos = groundGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          pos.setZ(i, dispField(pos.getX(i), pos.getY(i)) * dispAmp);
        }
        groundGeo.computeVertexNormals();
      }
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      // City and room floors get a touch of metalness and lower roughness for a
      // slightly reflective sheen; open terrain stays rough and matte.
      if (!openWorld) { groundMat.roughness = 0.85; groundMat.metalness = 0.1; }
      // Indoor/city floors: a subtle canvas texture (tile grid for rooms, faint
      // road markings for city) so the ground reads as a real surface, not a
      // flat colour slab. RepeatWrapping tiles the pattern across the floor.
      if (id === 'room' || id === 'city') {
        const ftex = (typeof document !== 'undefined') && (function () {
          const cv = document.createElement('canvas'); cv.width = cv.height = 128;
          const c2 = cv.getContext('2d'); if (!c2) return null;
          c2.fillStyle = '#ffffff'; c2.fillRect(0, 0, 128, 128); // white base: material colour shows through
          if (id === 'room') {
            // light tile grid lines at low opacity
            c2.strokeStyle = 'rgba(0,0,0,0.10)'; c2.lineWidth = 1;
            c2.beginPath(); c2.moveTo(0, 0.5); c2.lineTo(128, 0.5); c2.moveTo(0.5, 0); c2.lineTo(0.5, 128); c2.stroke();
          } else {
            // faint road markings: dashed centre line and edge lines
            c2.strokeStyle = 'rgba(230,216,134,0.20)'; c2.lineWidth = 2;
            c2.setLineDash([16, 12]);
            c2.beginPath(); c2.moveTo(64, 0); c2.lineTo(64, 128); c2.stroke();
            c2.setLineDash([]);
            c2.strokeStyle = 'rgba(232,236,242,0.12)'; c2.lineWidth = 1;
            c2.beginPath(); c2.moveTo(24, 0); c2.lineTo(24, 128); c2.moveTo(104, 0); c2.lineTo(104, 128); c2.stroke();
          }
          const t = new THREE.CanvasTexture(cv);
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(id === 'room' ? 6 : 4, id === 'room' ? 6 : 4);
          return t;
        })();
        if (ftex) { groundMat.map = ftex; groundMat.needsUpdate = true; }
      }
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
          let pmrem = null;
          // dispose in finally so the generator's internal render targets are
          // freed even if fromScene throws on a GPU that cannot allocate them.
          try { pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(scene, 0.04, 1, 1200).texture; }
          finally { if (pmrem) pmrem.dispose(); }
        }
      } catch (e) { void e; }

      // Moving agents (city pedestrians and cars); each gets an update(t) called
      // every frame so the world is alive, not a still set of props.
      const agents = [];

      // R2: a soft radial-gradient blob shared by the robot's contact shadow,
      // the prop AO discs and the agents' feet, so everything stays grounded
      // even on Low tier where the shadow map is off. Black with an alpha
      // falloff; the teardown traverse disposes it through its materials.
      const shadowTex = (typeof document !== 'undefined') && (function () {
        try {
          const cv = document.createElement('canvas'); cv.width = cv.height = 64;
          const c2 = cv.getContext('2d'); if (!c2) return null;
          const grad = c2.createRadialGradient(32, 32, 2, 32, 32, 32);
          grad.addColorStop(0, 'rgba(0,0,0,0.62)');
          grad.addColorStop(0.55, 'rgba(0,0,0,0.34)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          c2.fillStyle = grad; c2.fillRect(0, 0, 64, 64);
          return new THREE.CanvasTexture(cv);
        } catch (e) { return null; }
      })();
      // Shared blob material for the moving agents' feet (one instance across
      // every car/person/robot in the scene; dispose() is idempotent).
      const blobMat = shadowTex
        ? new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
        : new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
      const addBlob = (parent, w, d, y) => {
        const b = new THREE.Mesh(new THREE.PlaneGeometry(w, d), blobMat);
        b.rotation.x = -Math.PI / 2; b.position.y = y; b.castShadow = false;
        parent.add(b);
      };

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
        rock.position.set(px, groundY(px, pz) + r * 0.5, pz);
        rock.rotation.set(v * 3, rot || 0, v * 2);
        // Keep the HORIZONTAL footprint close to o.r so the visible rock edge
        // lines up with the collision circle (the robot noses up to it instead
        // of sinking into an oversized boulder); height still varies for relief.
        rock.scale.set(1 + v * 0.18, 0.7 + v * 0.5, 1 + (1 - v) * 0.18);
        rock.castShadow = true; rock.receiveShadow = true;
        scene.add(rock);
      };

      // ---- W3: per-site prop kits. Replaces the "every Earth site gets the
      // same mint tree" rule with a species palette per mission site: dunes on
      // the Sahara, ice blocks on the Ross Ice Shelf, acacia on the Mara,
      // basalt columns on the lava field, limestone blocks at Giza, pines on
      // the foothills, fan corals on the reef, tube worms in the trench and
      // pressure-ridge ice on Europa. All primitives, all scene children.
      const PROP_KITS = {
        sahara: 'dune', india: 'khejri', antarctica: 'iceblock', europa: 'iceblock',
        kenya: 'acacia', iceland: 'basalt', egypt: 'limestone', japan: 'pine',
        nepal: 'pine', amazon: 'canopy', reef: 'coralfan', mariana: 'tubeworm',
      };
      const kitMats = {};
      const km = (key, params) => kitMats[key] || (kitMats[key] = new THREE.MeshStandardMaterial(params));
      const kitLift = (hex, dl) => '#' + new THREE.Color(hex).offsetHSL(0, 0, dl).getHexString();
      function kitProp(kind, o, r, px, pz) {
        const gy = groundY(px, pz);
        const g = new THREE.Group();
        g.userData.kodroProp = kind;
        if (kind === 'dune' || (kind === 'khejri' && o.v < 0.72)) {
          // an elongated, wind-aligned dune ridge (smooth half-ellipsoid);
          // the Thar's dunes are lower and more broken than the Sahara's
          const dm = km('dune', { color: kitLift(siteGround != null ? siteGround : 0xc9a05e, 0.06), roughness: 1 });
          const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), dm);
          m.scale.set(kind === 'khejri' ? 1.7 : 2.3, kind === 'khejri' ? 0.34 : 0.45, 1.0);
          m.rotation.y = 0.5 + (o.v - 0.5) * 0.3; // one prevailing wind direction
          m.castShadow = true; m.receiveShadow = true; g.add(m);
        } else if (kind === 'khejri') {
          // the Thar's identity tree: a sparse flat-topped khejri (thin trunk,
          // wide low ellipsoid canopy in dry olive) -- props, not palette,
          // are what distinguish India from the Sahara (world-coherence)
          const tm = km('khejriTrunk', { color: 0x5e4a2c, roughness: 1 });
          const cm = km('khejriCanopy', { color: 0x55702c, roughness: 1, flatShading: true });
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.08, r * 0.13, r * 1.4, 6), tm);
          trunk.position.y = r * 0.7; trunk.rotation.z = 0.06; trunk.castShadow = true; g.add(trunk);
          const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.95, 0), cm);
          canopy.position.y = r * 1.55; canopy.scale.y = 0.42; canopy.castShadow = true; g.add(canopy);
        } else if (kind === 'iceblock') {
          const im = km('ice', { color: 0xdfe9f2, roughness: 0.55, flatShading: true });
          const n = 2 + ((o.v * 2) | 0);
          for (let k = 0; k < n; k++) {
            const bw = r * (0.9 - k * 0.18);
            const b = new THREE.Mesh(new THREE.BoxGeometry(bw * 1.6, bw * 0.7, bw), im);
            b.position.set((k - (n - 1) / 2) * r * 0.5, bw * 0.3, (k % 2 ? 1 : -1) * r * 0.16);
            b.rotation.y = o.rot * 0.02 + k * 0.6; b.rotation.z = (o.v - 0.5) * 0.16;
            b.castShadow = true; b.receiveShadow = true; g.add(b);
          }
        } else if (kind === 'acacia') {
          const tm = km('acaciaTrunk', { color: 0x5e4426, roughness: 1 });
          const cm = km('acaciaCanopy', { color: 0x5f7a30, roughness: 1, flatShading: true });
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.09, r * 0.16, r * 1.7, 6), tm);
          trunk.position.y = r * 0.85; trunk.rotation.z = 0.08; trunk.castShadow = true; g.add(trunk);
          const canopy = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.3, r * 0.55, r * 0.45, 8), cm);
          canopy.position.y = r * 1.85; canopy.castShadow = true; g.add(canopy); // the flat top IS the acacia
        } else if (kind === 'basalt') {
          const bm = km('basalt', { color: 0x3f454e, roughness: 0.95, flatShading: true });
          const n = 4 + ((o.v * 3) | 0);
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2 + o.v;
            const hgt = r * (0.7 + ((k * 29) % 7) / 7);
            const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.26, r * 0.26, hgt, 6), bm);
            col.position.set(Math.cos(a) * r * 0.42, hgt / 2, Math.sin(a) * r * 0.42);
            col.castShadow = true; col.receiveShadow = true; g.add(col);
          }
        } else if (kind === 'limestone') {
          const lm = km('limestone', { color: 0xd8c294, roughness: 1, flatShading: true });
          for (let k = 0; k < 3; k++) {
            const bw = r * (1.15 - k * 0.3);
            const b = new THREE.Mesh(new THREE.BoxGeometry(bw * 1.3, bw * 0.6, bw), lm);
            b.position.set((k % 2 ? 1 : -1) * r * 0.18 * k, bw * 0.3 + k * r * 0.32, (k % 2 ? -1 : 1) * r * 0.1 * k);
            b.rotation.y = o.rot * 0.01 + k * 0.28;
            b.castShadow = true; b.receiveShadow = true; g.add(b);
          }
        } else if (kind === 'pine') {
          const tm = km('pineTrunk', { color: 0x4a3824, roughness: 1 });
          const pm = km('pine', { color: 0x2c4a30, roughness: 1, flatShading: true });
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.1, r * 0.16, r * 0.9, 6), tm);
          trunk.position.y = r * 0.45; trunk.castShadow = true; g.add(trunk);
          for (let k = 0; k < 3; k++) {
            const cw = r * (1.0 - k * 0.26);
            const tier = new THREE.Mesh(new THREE.ConeGeometry(cw, r * 0.9, 7), pm);
            tier.position.y = r * (1.0 + k * 0.62); tier.castShadow = true; g.add(tier);
          }
        } else if (kind === 'canopy') {
          // rainforest: a two-tier canopy tree at 2 to 3x the temperate height
          const tm = km('canopyTrunk', { color: 0x5a4326, roughness: 1 });
          const c1 = km('canopyHi', { color: 0x2e5a24, roughness: 1, flatShading: true });
          const c2 = km('canopyLo', { color: 0x3c6e2c, roughness: 1, flatShading: true });
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.14, r * 0.2, r * 2.6, 6), tm);
          trunk.position.y = r * 1.3; trunk.castShadow = true; g.add(trunk);
          const hi = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 1.2, 0), c1);
          hi.position.y = r * 3.0; hi.scale.y = 0.7; hi.castShadow = true; g.add(hi);
          const lo = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.85, 0), c2);
          lo.position.set(r * 0.5, r * 2.1, r * 0.25); lo.scale.y = 0.65; lo.castShadow = true; g.add(lo);
        } else if (kind === 'coralfan') {
          const fm = km('fan', { color: 0xe08a96, roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
          const bm2 = km('brain', { color: 0xd8a878, roughness: 0.9 });
          const fan = new THREE.Mesh(new THREE.SphereGeometry(r * 0.9, 10, 8), fm);
          fan.scale.set(1, 1, 0.16); fan.position.y = r * 0.7;
          fan.rotation.y = o.rot * 0.02; fan.castShadow = true; g.add(fan);
          const brain = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 10, 8), bm2);
          brain.scale.y = 0.7; brain.position.set(r * 0.55, r * 0.3, r * 0.4); brain.castShadow = true; g.add(brain);
        } else if (kind === 'tubeworm') {
          // sediment mound + a cluster of tube worms with red plumes
          const sm = km('sediment', { color: 0x24404c, roughness: 1 });
          const wm2 = km('tube', { color: 0x9aa8b0, roughness: 0.7 });
          const plm = km('plume', { color: 0xd85a5a, emissive: 0x7a1e1e, emissiveIntensity: 0.35, roughness: 0.6 });
          const mound = new THREE.Mesh(new THREE.SphereGeometry(r * 0.8, 10, 8), sm);
          mound.scale.y = 0.35; mound.receiveShadow = true; g.add(mound);
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 + o.v;
            const hgt = r * (0.7 + ((k * 31) % 5) / 10);
            const tube = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.05, r * 0.06, hgt, 5), wm2);
            tube.position.set(Math.cos(a) * r * 0.32, hgt / 2 + r * 0.15, Math.sin(a) * r * 0.32);
            tube.rotation.z = Math.cos(a) * 0.16; tube.rotation.x = Math.sin(a) * 0.16;
            g.add(tube);
            const plume = new THREE.Mesh(new THREE.SphereGeometry(r * 0.09, 6, 5), plm);
            plume.position.set(tube.position.x - Math.sin(tube.rotation.z) * hgt * 0.5, tube.position.y + hgt * 0.5, tube.position.z + Math.sin(tube.rotation.x) * hgt * 0.5);
            g.add(plume);
          }
        } else {
          return false;
        }
        g.position.set(px, gy, pz);
        scene.add(g);
        return true;
      }
      const propKit = _sid ? PROP_KITS[_sid] : null;
      let kitCount = 0;

      const obstacles = (terrain && terrain.obstacles) || [];
      if (id !== 'city' && id !== 'room') obstacles.forEach((o) => {
        const r = Math.max(0.6, o.r * SCALE);
        const px = o.x * SCALE, pz = -o.y * SCALE;
        if (propKit && o.v >= 0.4) {
          if (kitProp(propKit, o, r, px, pz)) { kitCount++; return; }
          mkRock(r, px, pz, o.v, o.rot);
        } else if (!propKit && id === 'earth' && (o.v >= 0.5 || o.kind === 'tree')) {
          // tree: trunk + canopy
          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.24, r * 1.4, 6), trunkMat);
          trunk.position.y = r * 0.7; trunk.castShadow = true;
          const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 1.1, 0), leafMat);
          canopy.position.y = r * 1.9; canopy.castShadow = true;
          tree.add(trunk); tree.add(canopy);
          tree.position.set(px, groundY(px, pz), pz);
          scene.add(tree);
        } else if (!propKit && id === 'underwater' && o.v >= 0.45) {
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
          coral.position.set(px, groundY(px, pz), pz);
          scene.add(coral);
        } else if (id === 'space' && o.v >= 0.5 && !propKit) {
          // crater: a low rim sunk into the surface with a dark basin floor, so
          // it reads as a depression rather than a ring lying on top of the ground.
          const gy = groundY(px, pz);
          const crater = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.2, 6, 16), rimMat);
          crater.rotation.x = Math.PI / 2;
          crater.position.set(px, gy - r * 0.1, pz);
          crater.receiveShadow = true;
          scene.add(crater);
          const basin = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 18), new THREE.MeshStandardMaterial({ color: 0x26282f, roughness: 1 }));
          basin.rotation.x = -Math.PI / 2; basin.position.set(px, gy + 0.02, pz);
          scene.add(basin);
        } else {
          mkRock(r, px, pz, o.v, o.rot);
        }
      });
      if (kitCount) { try { mount.dataset.propkit = propKit; } catch (e) { void e; } }

      // ---- Per-site identity landmarks (KodroWorldFX): the one-off props
      // the obstacle-driven kits cannot place -- a torii gate on Fuji's
      // slopes, prayer flags in the foothills, termite mounds on the Mara,
      // Jupiter over Europa, Tycho's ejecta rays, the Amazon's canopy wall.
      let landmarkFx = null;
      try {
        if (window.KodroWorldFX && window.KodroWorldFX.landmarks) {
          landmarkFx = window.KodroWorldFX.landmarks(THREE, scene, {
            sid: _sid, id, groundY, lightK,
            fogColor: scene.fog ? scene.fog.color : null, quality: Q,
          });
          if (landmarkFx && landmarkFx.names) { try { mount.dataset.landmark = landmarkFx.names.join(','); } catch (e) { void e; } }
        }
      } catch (e) { if (window.console) console.warn('Viewport3D landmarks failed:', e); landmarkFx = null; }

      // R2: instanced AO discs under every standing prop so the Low tier
      // (shadow map off) keeps its grounding. Slope-aligned at build time from
      // the shared displacement field; zero per-frame cost.
      try {
        if (shadowTex && id !== 'city' && id !== 'room' && THREE.InstancedMesh && obstacles.length) {
          const standing = obstacles.filter((o) => o.v >= 0.32);
          if (standing.length) {
            const aoGeo = new THREE.CircleGeometry(1, 18);
            const aoMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.85 });
            const aoInst = new THREE.InstancedMesh(aoGeo, aoMat, standing.length);
            const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
            const up = new THREE.Vector3(0, 0, 1), nrm = new THREE.Vector3();
            standing.forEach((o, k) => {
              const r = Math.max(0.6, o.r * SCALE) * 1.18;
              const px = o.x * SCALE, pz = -o.y * SCALE;
              const gy = groundY(px, pz);
              // face the local surface normal so the disc hugs a slope
              nrm.set(-(groundY(px + 0.5, pz) - groundY(px - 0.5, pz)), 1, -(groundY(px, pz + 0.5) - groundY(px, pz - 0.5))).normalize();
              q4.setFromUnitVectors(up, nrm);
              m4.compose(v3.set(px + nrm.x * 0.04, gy + nrm.y * 0.04, pz + nrm.z * 0.04), q4, s3.set(r, r, r));
              aoInst.setMatrixAt(k, m4);
            });
            aoInst.instanceMatrix.needsUpdate = true;
            scene.add(aoInst);
          }
        }
      } catch (e) { if (window.console) console.warn('Viewport3D AO discs failed:', e); }

      // ---- Proper 3D city and room scenes (meshes, not generic rocks). ----
      function makeWindowTex(litProb) {
        try {
          if (!document || !document.createElement) return null;
          const cv = document.createElement('canvas'); cv.width = 64; cv.height = 96;
          const g = cv.getContext && cv.getContext('2d'); if (!g) return null;
          g.fillStyle = '#39414f'; g.fillRect(0, 0, 64, 96);
          for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 4; xx++) {
            g.fillStyle = (Math.random() < (litProb == null ? 0.5 : litProb)) ? '#ffe6a0' : '#222a38';
            g.fillRect(6 + xx * 14, 6 + yy * 11, 9, 7);
          }
          const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
        } catch (e) { return null; }
      }
      // A detailed car: a tapered hull, a raked cabin and windshield, head and
      // tail lights, mirrors, bumpers and rimmed wheels. Forward is +x.
      function carBody(parent, col) {
        const bodyM = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.24, metalness: 0.72, envMapIntensity: 1.3, clearcoat: 1.0, clearcoatRoughness: 0.1, sheen: 0.3 });
        const trimM = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.6, metalness: 0.3 });
        const glassM = new THREE.MeshPhysicalMaterial({ color: 0x9fcae6, transmission: 0.0, roughness: 0.02, metalness: 0.0, transparent: true, opacity: 0.5, envMapIntensity: 1.8, clearcoat: 1.0 });
        const headM = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff0c0, emissiveIntensity: 0.9 });
        const tailM = new THREE.MeshStandardMaterial({ color: 0xff5a4a, emissive: 0xff3322, emissiveIntensity: 0.8 });
        parent._tailM = tailM; // R4: the agent updater flares this on braking
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
          // The faceted rim is a CHILD of the tyre so it inherits the roll spin
          // (as a sibling it stayed frozen, and the smooth tyre alone shows no
          // visible rotation -- wheels looked motionless while driving).
          const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.4, 8), rimM);
          tyre.add(rim);
          wheel.add(tyre); wheel.position.set(p[0], 0.5, p[1]); parent.add(wheel);
          if (register) register(wheel, tyre, p[0] > 0);
        });
      }
      function mkCar(col) {
        const car = new THREE.Group();
        carBody(car, col);
        const tyres = [];
        carWheels(car, (wheel, tyre) => { tyres.push(tyre); });
        car._tyres = tyres; // spun by the agent updater at road speed
        addBlob(car, 4.6, 2.4, 0.045); // R2: grounded even with shadows off
        return car;
      }
      // Shared limb/torso geometry and cloth materials across every pedestrian
      // in the scene (only the shirt colour is unique), so ten people cost the
      // geometry of one. Built lazily; the teardown traverse disposes them
      // (dispose() is idempotent, so shared use is safe).
      const personShared = {};
      function mkPerson(shirt) {
        const p = new THREE.Group();
        const Cap = THREE.CapsuleGeometry ? THREE.CapsuleGeometry : null;
        if (!personShared.torso) {
          personShared.torso = Cap ? new THREE.CapsuleGeometry(0.42, 0.8, 4, 8) : new THREE.CylinderGeometry(0.42, 0.42, 1.4, 8);
          personShared.head = new THREE.SphereGeometry(0.36, 14, 12);
          personShared.leg = Cap ? new THREE.CapsuleGeometry(0.16, 0.75, 3, 6) : new THREE.CylinderGeometry(0.16, 0.16, 1.05, 6);
          personShared.arm = Cap ? new THREE.CapsuleGeometry(0.12, 0.6, 3, 6) : new THREE.CylinderGeometry(0.12, 0.12, 0.85, 6);
          personShared.legM = new THREE.MeshStandardMaterial({ color: 0x2f3646, roughness: 0.9 });
          personShared.skinM = new THREE.MeshStandardMaterial({ color: 0xe8c9a8, roughness: 0.7 });
        }
        const shirtM = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
        const torso = new THREE.Mesh(personShared.torso, shirtM); torso.position.y = 1.7; torso.castShadow = true;
        const head = new THREE.Mesh(personShared.head, personShared.skinM); head.position.y = 2.5; head.castShadow = true;
        p.add(torso); p.add(head);
        // Limbs pivot at the hip/shoulder (a group at the joint, the mesh hung
        // below it) so a swing reads as a stride, not a scissor about the shin.
        // Forward is local +x, so legs sit ACROSS the walk axis (z) and swing
        // fore-aft via rotation.z -- they were one-behind-the-other swinging
        // sideways before, which is exactly why the walk looked wrong.
        const limb = (geo, mat, y, z, drop) => {
          const g = new THREE.Group(); g.position.set(0, y, z);
          const m = new THREE.Mesh(geo, mat); m.position.y = drop; m.castShadow = true;
          g.add(m); p.add(g); return g;
        };
        p._legs = [limb(personShared.leg, personShared.legM, 1.25, -0.2, -0.55), limb(personShared.leg, personShared.legM, 1.25, 0.2, -0.55)];
        p._arms = [limb(personShared.arm, shirtM, 2.12, -0.56, -0.42), limb(personShared.arm, shirtM, 2.12, 0.56, -0.42)];
        addBlob(p, 1.15, 1.15, 0.03); // R2: soft feet shadow on every tier
        return p;
      }
      // Gait pose shared by every world's pedestrian renderer: legs stride from
      // the sim's phase, arms counter-swing, the body bobs at step frequency.
      // Amplitudes drop to zero under prefers-reduced-motion (live variable).
      const posePerson = (mesh, a) => {
        const g = reduce ? 0 : (a.leg || 0);
        mesh._legs[0].rotation.z = g * 0.55;
        mesh._legs[1].rotation.z = -g * 0.55;
        mesh._arms[0].rotation.z = -g * 0.38;
        mesh._arms[1].rotation.z = g * 0.38;
        mesh.position.y = Math.abs(g) * 0.075;
      };
      // Loop-wrap fade: the sim sets fade 0..1 near a lane's wrap ends, so the
      // teleport happens while the agent is invisible instead of on camera.
      const applyFade = (mesh, a) => {
        const f = (a.fade == null) ? 1 : a.fade;
        mesh.visible = f > 0.02;
        if (f < 1) mesh.scale.setScalar(Math.max(f, 0.001));
        else if (mesh.scale.x !== 1) mesh.scale.setScalar(1);
      };
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
        addBlob(g, 2.3, 1.6, 0.04); // R2: grounded even with shadows off
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
          let spin = 0; // accumulated tyre roll for cars (per-agent closure)
          agents.push({ mesh, update: (t, dts) => {
            const a = KA.list()[i]; if (!a) return;
            const axx = a.x * SCALE, azz = -a.y * SCALE;
            mesh.position.set(axx, groundY(axx, azz), azz); // R5: agents ride the terrain
            mesh.rotation.y = Math.atan2(a.dy, a.dx);
            if (ag.kind === 'person' && mesh._legs) posePerson(mesh, a);
            else if (ag.kind === 'car' && mesh._tyres) {
              spin += (a.speed || 0) * SCALE * 2 * (dts || 0); // v/r, r=0.5
              // Negative: the axle is the tyre's local +Y (parent +Z), and a
              // positive turn about it rolls the wheel BACKWARD for +x travel.
              for (let k = 0; k < mesh._tyres.length; k++) mesh._tyres[k].rotation.y = -spin;
              // R4: brake lights flare while the car is slowing or held
              if (mesh._tailM) mesh._tailM.emissiveIntensity = (a.vel != null && a.base && a.vel < a.base * 0.6) ? 1.9 : 0.8;
            }
            if (ag.kind === 'robot' && mesh._wheels) { for (let k = 0; k < mesh._wheels.length; k++) mesh._wheels[k].rotation.y = a.leg; }
            else applyFade(mesh, a); // lane agents melt out at the loop wrap
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
        // R8: after dark most windows light up (a night city is defined by
        // its lit windows, not its silhouettes); dusk is the in-between.
        const winTex = makeWindowTex(_tod === 'night' ? 0.85 : _tod === 'dusk' ? 0.65 : 0.5);
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
            // Muted automotive palette (charcoal / gunmetal / silver / slate /
            // deep green / off-white), keyed on o.v so parked cars vary without
            // the old candy red+blue that read as a toy set under bright light.
            const PARKED = [0x2b3039, 0x40474f, 0xa6acb2, 0x35414f, 0x33413a, 0xc4c8cc];
            const car = mkCar(PARKED[Math.min(PARKED.length - 1, (o.v * PARKED.length) | 0)]);
            car.position.set(px, 0, pz); car.rotation.y = (o.rot || 0) * Math.PI / 180; scene.add(car);
          }
        });
        // The base window texture is only a clone source: each building got its
        // own independent clone, so the base can be freed now (it is never rendered).
        if (winTex) winTex.dispose();
        // Traffic lights at the intersection: thin pole + 3 small spheres.
        // R4: the heads CYCLE. Each pole reads the shared sim's light state
        // (one per road axis) every frame, so the lamp the cars obey is the
        // lamp the eye sees -- red holds traffic, green releases it.
        try {
          const poleM = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.6, metalness: 0.3 });
          [[ROADW / 2 + 2, 2, true], [-(ROADW / 2 + 2), -2, false]].forEach((p) => {
            const tl = new THREE.Group();
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 8), poleM); pole.position.y = 2.5; pole.castShadow = true; tl.add(pole);
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.3), poleM); box.position.y = 5.6; tl.add(box);
            const redM2 = new THREE.MeshStandardMaterial({ color: 0xff3322, emissive: 0xff3322, emissiveIntensity: 0.9 });
            const yelM2 = new THREE.MeshStandardMaterial({ color: 0xffaa22, emissive: 0xffaa22, emissiveIntensity: 0.08 });
            const grnM2 = new THREE.MeshStandardMaterial({ color: 0x33cc44, emissive: 0x33cc44, emissiveIntensity: 0.08 });
            const red = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), redM2); red.position.set(0, 6.0, 0.18); tl.add(red);
            const yel = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), yelM2); yel.position.set(0, 5.6, 0.18); tl.add(yel);
            const grn = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), grnM2); grn.position.set(0, 5.2, 0.18); tl.add(grn);
            tl.position.set(p[0], 0, p[1]); scene.add(tl);
            const horizAxis = p[2];
            agents.push({ mesh: tl, update: () => {
              const KA2 = window.KodroAgents;
              if (!KA2 || !KA2.lightState) return;
              const st = KA2.lightState(horizAxis);
              redM2.emissiveIntensity = st === 'red' ? 1.1 : 0.08;
              yelM2.emissiveIntensity = st === 'amber' ? 1.1 : 0.08;
              grnM2.emissiveIntensity = st === 'green' ? 1.0 : 0.08;
            } });
          });
        } catch (e) { if (window.console) console.warn('Viewport3D traffic lights failed:', e); }
        // Street trees along the pavement: cylinder trunk + icosahedron foliage.
        try {
          const sTrunkM = new THREE.MeshStandardMaterial({ color: 0x6b4f2c, roughness: 1 });
          const sLeafM = new THREE.MeshStandardMaterial({ color: 0x3a6b2a, roughness: 1, flatShading: true });
          [[ROADW / 2 + 6, 10], [ROADW / 2 + 6, -10], [ROADW / 2 + 6, 25], [-(ROADW / 2 + 6), -25], [-(ROADW / 2 + 6), 15]].forEach((p) => {
            const t = new THREE.Group();
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 3, 6), sTrunkM); trunk.position.y = 1.5; trunk.castShadow = true; t.add(trunk);
            const fol = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), sLeafM); fol.position.y = 3.8; fol.castShadow = true; t.add(fol);
            t.position.set(p[0], 0, p[1]); scene.add(t);
          });
        } catch (e) { if (window.console) console.warn('Viewport3D street trees failed:', e); }
        // R8: night/dusk street lighting -- lamp posts whose warm cones pool
        // on the pavement, so a night city is lit by its own furniture.
        if ((_tod === 'night' || _tod === 'dusk') && Q !== 'low') {
          try {
            const lampPoleM = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.6, metalness: 0.4 });
            const bulbM = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffd9a0, emissiveIntensity: 1.4 });
            [[ROADW / 2 + 3, 14], [-(ROADW / 2 + 3), -14], [ROADW / 2 + 3, -30]].forEach((p) => {
              const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.5, 8), lampPoleM);
              pole.position.set(p[0], 3.25, p[1]); pole.castShadow = true; scene.add(pole);
              const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bulbM);
              bulb.position.set(p[0], 6.6, p[1]); scene.add(bulb);
              const sl = new THREE.SpotLight(0xffd9a0, 1.6, 30, 0.7, 0.5);
              sl.position.set(p[0], 6.5, p[1]);
              sl.target.position.set(p[0], 0, p[1]);
              sl.castShadow = false;
              scene.add(sl); scene.add(sl.target);
            });
          } catch (e) { if (window.console) console.warn('Viewport3D streetlamps failed:', e); }
        }
        // Render the shared moving agents as 3D meshes, driven by the same
        // simulation the collision test reads, so a pedestrian the robot can
        // see in the world is one it can actually hit.
        renderAgents();
      }
      function buildRoom() {
        const R = 30;
        const wallM = new THREE.MeshStandardMaterial({ color: 0xaea28f, roughness: 0.95, side: THREE.DoubleSide });
        const wallH = 14;
        const mkWall = (w, x, z, ry) => { const ww = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 0.6), wallM); ww.position.set(x, wallH / 2, z); ww.rotation.y = ry; ww.receiveShadow = true; scene.add(ww); };
        mkWall(R * 2, 0, -R, 0); mkWall(R * 2, -R, 0, Math.PI / 2); mkWall(R * 2, R, 0, Math.PI / 2);
        // Window on the right wall: sky-blue backing with a cross frame.
        try {
          const winFrameM = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.8 });
          const winGlassM = new THREE.MeshStandardMaterial({ color: 0x8ec5e8, roughness: 0.2, metalness: 0.1, emissive: 0x4a7a9a, emissiveIntensity: 0.25 });
          const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), winGlassM);
          winGlass.rotation.y = -Math.PI / 2; winGlass.position.set(R - 0.35, 8, -4); scene.add(winGlass);
          const barH = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 5.2), winFrameM); barH.position.set(R - 0.32, 8, -4); scene.add(barH);
          const barV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 5.2, 0.2), winFrameM); barV.position.set(R - 0.32, 8, -4); scene.add(barV);
          const fT = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 7.3), winFrameM); fT.position.set(R - 0.33, 10.6, -4); scene.add(fT);
          const fB = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 7.3), winFrameM); fB.position.set(R - 0.33, 5.4, -4); scene.add(fB);
          const fL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 5.5, 0.3), winFrameM); fL.position.set(R - 0.33, 8, -7.5); scene.add(fL);
          const fR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 5.5, 0.3), winFrameM); fR.position.set(R - 0.33, 8, -0.5); scene.add(fR);
        } catch (e) { if (window.console) console.warn('Viewport3D window failed:', e); }
        // Rug under the table with a subtle warm red/brown canvas pattern.
        try {
          const rugTex = (typeof document !== 'undefined') && (function () {
            const cv = document.createElement('canvas'); cv.width = cv.height = 128;
            const c2 = cv.getContext('2d'); if (!c2) return null;
            c2.fillStyle = '#8a4a3e'; c2.fillRect(0, 0, 128, 128);
            c2.strokeStyle = 'rgba(180,120,80,0.35)'; c2.lineWidth = 2;
            c2.strokeRect(6, 6, 116, 116); c2.strokeRect(16, 16, 96, 96);
            for (let i = 0; i < 6; i++) { c2.beginPath(); c2.arc(64, 64, 18 + i * 10, 0, 6.283); c2.strokeStyle = 'rgba(160,90,70,' + (0.3 - i * 0.04) + ')'; c2.stroke(); }
            return new THREE.CanvasTexture(cv);
          })();
          const rugM = new THREE.MeshStandardMaterial({ color: 0x9a5f54, roughness: 1 });
          if (rugTex) { rugM.map = rugTex; rugM.needsUpdate = true; }
          const rug = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), rugM);
          rug.rotation.x = -Math.PI / 2; rug.position.set(-14.1, 0.03, -11.4); scene.add(rug);
        } catch (e) { if (window.console) console.warn('Viewport3D rug failed:', e); }
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
        // Books on the shelf: thin boxes of varying colours.
        try {
          const bookCols = [0x8b3a3a, 0x2c5f8a, 0x5a7a3a, 0x8a6a2c, 0x6a3a6a, 0x3a6a5a];
          for (let s = 0; s < 2; s++) {
            const shelfY = 2 + s * 3 + 0.3;
            for (let b = 0; b < 6; b++) {
              const bw = 0.5 + (b % 3) * 0.15;
              const bh = 1.4 + (b % 2) * 0.4;
              const book = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.7), new THREE.MeshStandardMaterial({ color: bookCols[b % bookCols.length], roughness: 0.8 }));
              book.position.set(R - 5 + b * 1.0, shelfY + bh / 2, -8);
              book.castShadow = true; scene.add(book);
            }
          }
        } catch (e) { if (window.console) console.warn('Viewport3D books failed:', e); }
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 1.8, 10), new THREE.MeshStandardMaterial({ color: 0xb56a45, roughness: 1 })); pot.position.set(-R + 4, 0.9, -R + 4); pot.castShadow = true; scene.add(pot);
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 0), new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 1, flatShading: true })); leaf.position.set(-R + 4, 3.4, -R + 4); leaf.castShadow = true; scene.add(leaf);
        const lamp = new THREE.SpotLight(0xffd9a0, 1.2, 80, 0.6, 0.4); lamp.position.set(R - 8, 11, 8); lamp.target.position.set(R - 8, 0, 8); lamp.castShadow = false; scene.add(lamp); scene.add(lamp.target);
        // Ceiling light fixture: short cylinder + glowing sphere, centered above.
        try {
          const ceilM = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.5, metalness: 0.3 });
          const ceilArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 8), ceilM);
          ceilArm.position.set(0, wallH - 0.8, 0); scene.add(ceilArm);
          const ceilBulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfff5d0, emissive: 0xffe8a0, emissiveIntensity: 0.6 }));
          ceilBulb.position.set(0, wallH - 1.8, 0); scene.add(ceilBulb);
        } catch (e) { if (window.console) console.warn('Viewport3D ceiling light failed:', e); }
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
              if (pr._legs) posePerson(pr, a);
              applyFade(pr, a);
            } });
          });
        }
      }
      // Structured indoor worlds (lab, warehouse, debug grid) all resolve to the
      // room base, so without this they rendered as identical copies of the
      // living room. Each now gets walls plus props that match its identity, and
      // the props sit on the REAL collision obstacles, so what the robot can hit
      // is what the eye sees and every world reads as itself.
      function buildIndoor(kind) {
        const R = 30, wallH = 14;
        const wallCol = kind === 'warehouse' ? 0x4a4d54 : kind === 'debug_grid' ? 0x12161d : 0xd3d8df;
        const wallM = new THREE.MeshStandardMaterial({ color: wallCol, roughness: 0.92, metalness: kind === 'warehouse' ? 0.2 : 0.05, side: THREE.DoubleSide });
        const mkWall = (w, x, z, ry) => { const ww = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 0.6), wallM); ww.position.set(x, wallH / 2, z); ww.rotation.y = ry; ww.receiveShadow = true; scene.add(ww); };
        mkWall(R * 2, 0, -R, 0); mkWall(R * 2, -R, 0, Math.PI / 2); mkWall(R * 2, R, 0, Math.PI / 2);
        if (kind === 'debug_grid' && THREE.GridHelper) {
          const grid = new THREE.GridHelper(R * 2, 30, 0x5ce0d8, 0x2a6f6a);
          if (grid.material) { grid.material.transparent = true; grid.material.opacity = 0.5; grid.material.fog = false; }
          grid.position.y = 0.05; scene.add(grid);
        }
        // Floor grid for the lab/warehouse so the floor reads as a real surface
        // (epoxy joints / painted bay lines) instead of a flat void.
        if ((kind === 'lab' || kind === 'warehouse') && THREE.GridHelper) {
          const fg = new THREE.GridHelper(R * 2, kind === 'lab' ? 20 : 12, kind === 'lab' ? 0x9aa3b0 : 0x555a62, kind === 'lab' ? 0xc4ccd6 : 0x3f444c);
          fg.position.y = 0.04; scene.add(fg);
        }
        const ceil = new THREE.PointLight(kind === 'warehouse' ? 0xffe6c0 : 0xffffff, kind === 'warehouse' ? 0.5 : 0.85, 160);
        ceil.position.set(0, wallH + 6, 0); scene.add(ceil);
        const benchM = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.5, metalness: 0.35 });
        const steelM = new THREE.MeshStandardMaterial({ color: 0x8d939c, roughness: 0.4, metalness: 0.7 });
        const crateM = new THREE.MeshStandardMaterial({ color: 0xb07a3a, roughness: 0.8 });
        const rackM = new THREE.MeshStandardMaterial({ color: 0x3a4654, roughness: 0.5, metalness: 0.6 });
        const markM = new THREE.MeshStandardMaterial({ color: 0x5ce0d8, emissive: 0x5ce0d8, emissiveIntensity: 0.6 });
        obstacles.forEach((o) => {
          const px = o.x * SCALE, pz = -o.y * SCALE, r = Math.max(0.8, o.r * SCALE);
          if (kind === 'lab') {
            const top = new THREE.Mesh(new THREE.BoxGeometry(r * 2.2, 0.5, r * 1.4), benchM); top.position.set(px, 2.0, pz); top.castShadow = true; top.receiveShadow = true; scene.add(top);
            const inst = new THREE.Mesh(new THREE.BoxGeometry(r * 0.8, r * 0.7, r * 0.8), steelM); inst.position.set(px, 2.25 + r * 0.35, pz); inst.castShadow = true; scene.add(inst);
            [[-1, -0.6], [1, -0.6], [-1, 0.6], [1, 0.6]].forEach((c) => { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.0, 0.18), steelM); lg.position.set(px + c[0] * r, 1.0, pz + c[1] * r); scene.add(lg); });
          } else if (kind === 'warehouse') {
            // An open shelving rack (posts + shelves + crates), size-capped so a
            // big obstacle radius does not become a giant solid slab.
            const rw = Math.min(2.6, 1.2 + r * 0.5), rd = Math.min(1.8, 1.0 + r * 0.3), h = Math.min(9, 5 + r * 0.8);
            const frame = new THREE.Group();
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((c) => { const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, 0.18), rackM); post.position.set(c[0] * rw, h / 2, c[1] * rd); post.castShadow = true; frame.add(post); });
            for (let s = 0; s < 3; s++) {
              const y = 0.5 + s * (h / 3);
              const shelf = new THREE.Mesh(new THREE.BoxGeometry(rw * 2 + 0.2, 0.12, rd * 2 + 0.2), rackM); shelf.position.set(0, y, 0); shelf.receiveShadow = true; frame.add(shelf);
              const cr = new THREE.Mesh(new THREE.BoxGeometry(rw * 1.3, 0.9, rd * 1.3), crateM); cr.position.set(0, y + 0.55, 0); cr.castShadow = true; frame.add(cr);
            }
            frame.position.set(px, 0, pz); scene.add(frame);
          } else {
            const m = new THREE.Mesh(new THREE.ConeGeometry(r * 0.6, r * 1.4, 4), markM); m.position.set(px, r * 0.7, pz); m.castShadow = true; scene.add(m);
          }
        });
        // Render the shared agent people (workers) so an unseen agent cannot be
        // hit; the bare debug grid stays empty by design.
        const KAr = window.KodroAgents;
        if (KAr && kind !== 'debug_grid') {
          KAr.list().forEach((ag, i) => {
            if (ag.kind !== 'person') return;
            const pr = mkPerson(ag.color != null ? ag.color : 0x9fb0c4); scene.add(pr);
            agents.push({ mesh: pr, update: () => {
              const a = KAr.list()[i]; if (!a) return;
              pr.position.set(a.x * SCALE, 0, -a.y * SCALE);
              pr.rotation.y = Math.atan2(a.dy, a.dx);
              if (pr._legs) posePerson(pr, a);
              applyFade(pr, a);
            } });
          });
        }
      }
      // ---- Scenario markers: the mission Validate grades, drawn in the world.
      // The active world's validation scenario (goal beacon, start pad, and the
      // scenario's obstacle outlines) renders as procedural primitives so the
      // Validate button grades a mission the user can SEE, instead of scoring
      // an invisible goal (product-coherence D1). Everything is a scene child,
      // so the teardown traverse disposes it with the rest of the world.
      try {
        if (window.KodroScenario && window.KodroScenario.defaultFor) {
          const scn = window.KodroScenario.defaultFor(id);
          if (scn && scn.goalPose) {
            // Markers sit on the shared groundY surface (R5), not inside a swell.
            const gp = scn.goalPose;
            const gx = gp.x * SCALE, gz = -gp.y * SCALE;
            const gr = Math.max(1.2, (gp.r || 120) * SCALE);
            const beacon = new THREE.Group();
            beacon.userData.kodroGoal = true;
            const ringMatG = new THREE.MeshBasicMaterial({ color: 0x5ce0d8, transparent: true, opacity: 0.85 });
            const ringG = new THREE.Mesh(new THREE.TorusGeometry(gr, 0.09, 8, 48), ringMatG);
            ringG.rotation.x = -Math.PI / 2; ringG.position.y = 0.16;
            beacon.add(ringG);
            const ringInner = new THREE.Mesh(new THREE.TorusGeometry(gr * 0.55, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: 0x5ce0d8, transparent: true, opacity: 0.4 }));
            ringInner.rotation.x = -Math.PI / 2; ringInner.position.y = 0.14;
            beacon.add(ringInner);
            const beam = new THREE.Mesh(
              new THREE.CylinderGeometry(gr * 0.16, gr * 0.28, 9, 16, 1, true),
              new THREE.MeshBasicMaterial({ color: 0x5ce0d8, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide })
            );
            beam.position.y = 4.5;
            beacon.add(beam);
            beacon.position.set(gx, groundY(gx, gz), gz);
            scene.add(beacon);
            if (scn.startPose) {
              const sp = scn.startPose;
              const sx = sp.x * SCALE, sz = -sp.y * SCALE;
              const pad = new THREE.Mesh(
                new THREE.RingGeometry(0.9, 1.25, 32),
                new THREE.MeshBasicMaterial({ color: 0xe0b45c, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
              );
              pad.rotation.x = -Math.PI / 2;
              pad.position.set(sx, groundY(sx, sz) + 0.14, sz);
              pad.userData.kodroGoal = true;
              scene.add(pad);
            }
            (scn.obstacles || []).forEach((o) => {
              const orad = Math.max(0.8, o.r * SCALE);
              const ox = o.x * SCALE, oz = -o.y * SCALE;
              const ring = new THREE.Mesh(
                new THREE.RingGeometry(orad * 0.93, orad, 40),
                new THREE.MeshBasicMaterial({ color: 0xffb86b, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
              );
              ring.rotation.x = -Math.PI / 2;
              ring.position.set(ox, groundY(ox, oz) + 0.12, oz);
              ring.userData.kodroGoal = true;
              scene.add(ring);
            });
            // Marker for the UI harness: the goal beacon exists in this scene.
            try { mount.dataset.goal = '1'; } catch (e) { void e; }
          }
        }
      } catch (e) { if (window.console) console.warn('scenario markers failed:', e); }

      // Make sure the shared agent sim is built for THIS world before we render
      // its meshes (the viewport effect can run before App's build effect).
      // One id everywhere: the agent world key is the SITE id when a site is
      // active (matching App's build(terrainId)), never the base id, so the
      // collision test, the sensors and the realism dashboard all agree on
      // which agents exist (world-coherence BUG-4).
      const _agentWorld = _sid || id;
      if (window.KodroAgents && window.KodroAgents.world() !== _agentWorld) window.KodroAgents.build(_agentWorld);
      const _siteId = terrain && terrain.siteId;
      if (_siteId === 'lab' || _siteId === 'warehouse' || _siteId === 'debug_grid') buildIndoor(_siteId);
      else if (id === 'city') buildCity();
      else if (id === 'room') buildRoom();
      else {
        renderAgents(); // open terrain worlds: render the roaming robot fleet
        // Rover base camp on open terrain (earth/mars/space): a landing pad,
        // instrument boxes with antenna sticks, and a tilted solar panel so the
        // rover is not sitting in a void. Guarded so a failure never breaks the scene.
        try {
          const _rt = robotType || (window.getKodroRobot && window.getKodroRobot().type) || 'rover';
          if (_rt === 'rover' && (id === 'earth' || id === 'mars' || id === 'space')) {
            const _accent = new THREE.Color((terrain && terrain.accent) || '#5ce0d8');
            // landing pad: flat disc (radius 60cm, height 2cm), dark metallic
            const padM = new THREE.MeshStandardMaterial({ color: 0x2a2d34, roughness: 0.4, metalness: 0.7 });
            const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.02, 24), padM);
            pad.position.set(0, 0.011, 0); pad.receiveShadow = true; scene.add(pad);
            // instrument boxes with emissive antenna sticks
            const boxM = new THREE.MeshStandardMaterial({ color: 0x6a7079, roughness: 0.5, metalness: 0.4 });
            const antM = new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: 0.3, metalness: 0.7 });
            const tipM = new THREE.MeshStandardMaterial({ color: _accent, emissive: _accent, emissiveIntensity: 0.8 });
            [[0.85, 0.5], [-0.75, 0.6], [0.6, -0.75]].forEach((p) => {
              const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), boxM);
              box.position.set(p[0], 0.12, p[1]); box.castShadow = true; scene.add(box);
              const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 6), antM);
              ant.position.set(p[0], 0.42, p[1]); scene.add(ant);
              const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), tipM);
              tip.position.set(p[0], 0.63, p[1]); scene.add(tip);
            });
            // solar panel: flat box tilted 30deg, dark blue with grid lines
            const panelTex = (typeof document !== 'undefined') && (function () {
              const cv = document.createElement('canvas'); cv.width = cv.height = 64;
              const c2 = cv.getContext('2d'); if (!c2) return null;
              c2.fillStyle = '#1b2740'; c2.fillRect(0, 0, 64, 64);
              c2.strokeStyle = '#3a5a8a'; c2.lineWidth = 1;
              for (let i = 0; i <= 4; i++) { c2.beginPath(); c2.moveTo(i * 16, 0); c2.lineTo(i * 16, 64); c2.stroke(); }
              for (let i = 0; i <= 4; i++) { c2.beginPath(); c2.moveTo(0, i * 16); c2.lineTo(64, i * 16); c2.stroke(); }
              const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
            })();
            const panelM = new THREE.MeshStandardMaterial({ color: 0x1b2740, roughness: 0.3, metalness: 0.5 });
            if (panelTex) { panelM.map = panelTex; panelM.needsUpdate = true; }
            const panel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.5), panelM);
            panel.position.set(-0.9, 0.3, -0.5); panel.rotation.z = 30 * Math.PI / 180; panel.castShadow = true; scene.add(panel);
          }
        } catch (e) { if (window.console) console.warn('Viewport3D base camp failed:', e); }
      }

      // Per-world ambient life (birds, dust devils, fish, debris, a cat) from
      // the KodroAmbient module: quality-capped, never built under reduced
      // motion, and added as scene children only, so the teardown traverse
      // below disposes everything it created. A build failure downgrades to a
      // still world rather than breaking the scene.
      let ambient = null;
      try {
        if (!reduce && window.KodroAmbient && window.KodroAmbient.build) {
          ambient = window.KodroAmbient.build(THREE, scene, id, { quality: Q, siteId: _siteId, weather: _weather });
        }
      } catch (e) { if (window.console) console.warn('Viewport3D ambient life failed:', e); ambient = null; }

      // R7: underwater optics -- water surface overhead (med+), scrolling
      // caustic dapple on the seabed (med+), god rays (high+). The Challenger
      // Deep opts out inside the module: darkness is its identity.
      let waterFx = null;
      try {
        if (id === 'underwater' && window.KodroWorldFX && window.KodroWorldFX.underwater) {
          waterFx = window.KodroWorldFX.underwater(THREE, scene, { sid: _sid, quality: Q, groundY });
          if (waterFx && waterFx.flags) { try { mount.dataset.waterfx = waterFx.flags.join(','); } catch (e) { void e; } }
        }
      } catch (e) { if (window.console) console.warn('Viewport3D underwater FX failed:', e); waterFx = null; }
      // R10: rain/snow particle weather (high+, outdoor Earth-family only;
      // the module returns null everywhere else). Rain wets the ground.
      let weatherFx = null;
      try {
        if (!reduce && window.KodroWorldFX && window.KodroWorldFX.weather) {
          weatherFx = window.KodroWorldFX.weather(THREE, scene, { id, weather: _weather, quality: Q });
          if (weatherFx) {
            try { mount.dataset.weather = weatherFx.flag; } catch (e) { void e; }
            if (weatherFx.wet && groundMat) { groundMat.roughness = Math.min(groundMat.roughness, 0.42); groundMat.needsUpdate = true; }
          }
        }
      } catch (e) { if (window.console) console.warn('Viewport3D weather failed:', e); weatherFx = null; }
      // Stamp what the coherence infrastructure actually built onto the mount
      // node, so the headless QA sweep can assert the W4/W5 gating from the
      // DOM without a GPU read: which ambient systems run here, and how many
      // live agents share the world (0 at a quiet site like the Challenger Deep).
      try {
        if (ambient && ambient.flags) mount.dataset.ambient = ambient.flags.join(',');
        if (window.KodroAgents && window.KodroAgents.list) mount.dataset.agents = String(window.KodroAgents.list().length);
      } catch (e) { void e; }

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
      // One shared accent material (identical params at every site); reused
      // across the build instead of allocating a fresh material per part. The
      // teardown traverse-dispose already frees it.
      const accMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5, side: THREE.DoubleSide });
      const addWheels = (positions, r) => {
        const wm = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.85 });
        const hubM = new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: 0.4, metalness: 0.6 });
        positions.forEach((p) => {
          const wheel = new THREE.Group();
          const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.32, 16), wm); tyre.rotation.x = Math.PI / 2; tyre.castShadow = true;
          // The 8-facet hub is a CHILD of the tyre so it spins with the roll;
          // as a sibling it stayed frozen and the smooth tyre alone reads as a
          // motionless wheel.
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.42, 0.34, 8), hubM);
          tyre.add(hub);
          tyre.userData.side = p[1] >= 0 ? 1 : -1; // R9: left/right for counter-rotation
          wheel.add(tyre); wheel.position.set(p[0], r, p[1]); rov.add(wheel); wheels.push(tyre);
          if (p[0] > 0) steer.push(wheel); // front axle steers
        });
      };
      // Heading indicator: a flat chevron painted on the robot's NOSE, apex
      // forward (+x). The old version was a pyramid floating at mast height,
      // which read as a light beam spraying BACKWARD out of the mast bulb (a
      // real user reported exactly that). Painted on the body surface at the
      // front, it reads as direction and nothing else. rotation.z = -PI/2
      // points the cone's +Y axis along +x; scale.x then flattens the local X
      // axis (vertical after that rotation) so it lies like a decal.
      const arrow = (x, y) => {
        const a = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 3), accMat);
        a.rotation.z = -Math.PI / 2;
        a.scale.x = 0.22;
        a.position.set(x, y, 0);
        body.add(a);
      };
      if (rType === 'car') {
        carBody(body, 0x2c6fb0);
        carWheels(rov, (wheel, tyre, front) => { wheels.push(tyre); if (front) steer.push(wheel); });
        arrow(1.1, 1.26);
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
        const chest = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16), accMat); chest.position.set(0.74, 1.6, 0); chest.rotation.y = Math.PI / 2; body.add(chest);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.66, 20, 16), botM); head.position.y = 2.75; head.castShadow = true; body.add(head);
        const visor = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12), new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.2, metalness: 0.4 })); visor.scale.set(1, 0.7, 0.6); visor.position.set(0.42, 2.78, 0); body.add(visor);
        [[0.78, 0.18], [0.78, -0.18]].forEach((p) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), accMat); e.position.set(p[0], 2.82, p[1]); body.add(e); });
        // arms: a companion robot needs hands. Shoulder + upper arm + elbow +
        // forearm per side, hanging at rest, accent-coloured joints.
        const armMatH = new THREE.MeshStandardMaterial({ color: 0xd7dbe2, roughness: 0.45, metalness: 0.15 });
        [0.86, -0.86].forEach((z) => {
          const sh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), accMat); sh.position.set(0, 2.0, z); body.add(sh);
          const up = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.17, 0.66, 4, 8) : new THREE.CylinderGeometry(0.17, 0.17, 1.0, 8), armMatH); up.position.set(0.06, 1.52, z); up.castShadow = true; body.add(up);
          const el = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), accMat); el.position.set(0.12, 1.08, z); body.add(el);
          const fo = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.14, 0.52, 4, 8) : new THREE.CylinderGeometry(0.14, 0.14, 0.8, 8), armMatH); fo.position.set(0.18, 0.66, z); fo.castShadow = true; body.add(fo);
        });
        // wheels pushed out past the base skirt so they are actually visible
        // (at the old 0.55 they were buried inside the ~1.0-radius base).
        addWheels([[0, 1.05], [0, -1.05]], 0.32);
        arrow(0.6, 0.56);
      } else if (rType === 'arm') {
        const armM = new THREE.MeshStandardMaterial({ color: 0xc7ccd4, roughness: 0.35, metalness: 0.6 });
        const jointM = accMat;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.7, 20), new THREE.MeshStandardMaterial({ color: 0x39414c, roughness: 0.6 })); base.position.y = 0.35; base.castShadow = true; body.add(base);
        const j1 = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), jointM); j1.position.y = 0.9; body.add(j1);
        const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.5), armM); seg1.position.set(0.2, 2.0, 0); seg1.rotation.z = -0.5; seg1.castShadow = true; body.add(seg1);
        const j2 = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), jointM); j2.position.set(1.1, 2.9, 0); body.add(j2);
        const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 0.4), armM); seg2.position.set(1.9, 3.4, 0); seg2.rotation.z = -1.2; seg2.castShadow = true; body.add(seg2);
        // wrist joint capping seg2 so the gripper reads as articulated, not floating
        const j3 = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), jointM); j3.position.set(2.55, 3.62, 0); body.add(j3);
        const g1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), armM); g1.position.set(2.7, 3.7, 0.22); body.add(g1);
        const g2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), armM); g2.position.set(2.7, 3.7, -0.22); body.add(g2);
        arrow(0.68, 0.74);
      } else {
        // rover (and custom): chassis, solar deck, sensor mast with a camera eye.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.42, metalness: 0.45, envMapIntensity: 1.15 });
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.7), bodyMat); chassis.position.y = 0.92; chassis.castShadow = true; body.add(chassis);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 1.4), new THREE.MeshStandardMaterial({ color: 0x1b2740, roughness: 0.3, metalness: 0.5 })); deck.position.set(-0.2, 1.34, 0); body.add(deck);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8), bodyMat); mast.position.set(0.85, 1.75, 0); body.add(mast);
        const camHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.72), bodyMat); camHead.position.set(0.85, 2.3, 0); camHead.castShadow = true; body.add(camHead);
        const eye = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), accMat); eye.position.set(1.12, 2.3, 0); eye.rotation.y = Math.PI / 2; body.add(eye);
        // A small status LED atop the mast that pulses each frame (see tick()).
        const ledMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.6 });
        ledIndicator = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), ledMat);
        ledIndicator.position.set(0.85, 2.6, 0); body.add(ledIndicator);
        // running lights on the leading edge of the chassis
        const litM = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff0c0, emissiveIntensity: 0.9 });
        [[1.3, 0.55], [1.3, -0.55]].forEach((p) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.28), litM); l.position.set(p[0], 0.85, p[1]); body.add(l); });
        addWheels([[0.95, 0.95], [0.95, -0.95], [-0.95, 0.95], [-0.95, -0.95]], 0.5);
        arrow(1.02, 1.32);
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
            // SI2: an imported KRS spec mounts the pod WHERE the builder put
            // it - forward/left offset plus yaw, scaled from cm into body
            // units (the front face fx stands for the 30 cm body radius). A
            // catalogue build keeps the default front-face mount exactly.
            const spPose = (window.getKodroRobot && window.getKodroRobot().phys && window.getKodroRobot().phys.sensor) || null;
            const CM2U = fx / 30;
            const pod = new THREE.Group();
            [0.2, -0.2].forEach((z) => {
              const e = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.13, 16), darkM); e.rotation.z = Math.PI / 2; e.position.set(0, 0, z); pod.add(e);
              const r = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), accMat); r.position.set(0.08, 0, z); r.rotation.y = Math.PI / 2; pod.add(r);
            });
            pod.position.set(spPose ? spPose.fwdCm * CM2U : fx, sy, spPose ? -spPose.leftCm * CM2U : 0);
            if (spPose && spPose.yawDeg) pod.rotation.y = -spPose.yawDeg * Math.PI / 180;
            body.add(pod);
          }
          if (fitted.indexOf('camera') >= 0) {
            const cam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.34), darkM); cam.position.set(fx - 0.05, sy + 0.4, 0); body.add(cam);
            const lens = new THREE.Mesh(new THREE.CircleGeometry(0.09, 14), accMat); lens.position.set(fx + 0.07, sy + 0.4, 0); lens.rotation.y = Math.PI / 2; body.add(lens);
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
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), accMat); tip.position.set(-0.2, sy + 1.25, 0.3); body.add(tip);
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
      // Contact shadow (R2): a soft radial-gradient blob under the robot,
      // scaled to the build's footprint, replacing the old hard-edged uniform
      // disc. Child of rov so it follows the robot; castShadow=false so it
      // never pollutes the shadow map. tick() compresses it slightly with the
      // suspension so it participates in the motion instead of being a decal.
      let contactShadow = null;
      try {
        const SHADOW_R = { car: 2.4, rover: 2.05, home: 1.5, arm: 1.7 };
        const shadowGeo = new THREE.CircleGeometry(SHADOW_R[rType] || 2.0, 24);
        const shadowMat = shadowTex
          ? new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
          : new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false });
        contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
        contactShadow.rotation.x = -Math.PI / 2;
        contactShadow.position.y = 0.04;
        contactShadow.castShadow = false;
        rov.add(contactShadow);
      } catch (e) { if (window.console) console.warn('Viewport3D contact shadow failed:', e); }
      // Challenger Deep (atmos.headlight): the robot's own headlight is the
      // only real light in the trench -- a forward spotlight that tracks the
      // build, plus a visible lamp lens. Reuses the car headlight pattern.
      if (atmos && atmos.headlight) {
        try {
          const hlY = rType === 'home' ? 1.6 : rType === 'arm' ? 1.2 : 1.15;
          const hlX = rType === 'car' ? 1.78 : rType === 'home' ? 0.75 : 1.3;
          const hl = new THREE.SpotLight(0xd8ecf2, 2.6, 70, 0.52, 0.45);
          hl.position.set(hlX, hlY, 0);
          hl.target.position.set(26, 0, 0);
          rov.add(hl); rov.add(hl.target);
          const lampM = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0xcfe8ff, emissiveIntensity: 1.6, side: THREE.DoubleSide });
          const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), lampM);
          lamp.position.set(hlX + 0.02, hlY, 0); lamp.rotation.y = Math.PI / 2;
          body.add(lamp);
          try { mount.dataset.headlight = '1'; } catch (e) { void e; }
        } catch (e) { if (window.console) console.warn('Viewport3D headlight failed:', e); }
      }
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
      // R5: smoothed terrain-conformance angles (3-point wheel sample).
      let terrPitch = 0, terrRoll = 0;
      // R9: render-side lateral drift on low-traction turn exit (ice, sand).
      const traction = (terrain && terrain.traction != null) ? terrain.traction : 1;
      let driftV = 0;
      const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
      const camPos = new THREE.Vector3(0, 20, 30);

      // Third-person orbit: drag to rotate, wheel or two-finger pinch to zoom,
      // so it works on a tablet or Chromebook as well as a mouse.
      // Open worlds default to a LOW orbit (elev 0.25): at the old 0.62 the
      // look-down angle exceeded the half-FOV, so the horizon -- and with it
      // every skyline landform, Fuji's cone, Giza's pyramids, Jupiter -- was
      // geometrically off-frame at first glance. Indoors keeps the overview.
      const ELEV0 = id === 'room' ? 0.62 : 0.16;
      const DIST0 = id === 'room' ? 13 : 24;
      let azim = 2.4, elev = ELEV0, dist = DIST0, dragging = false, lx = 0, ly = 0;
      // Cinematic auto-orbit (window.KODRO_CINEMATIC): when on and the user is
      // not dragging, the camera slowly revolves around the robot for a
      // hands-free showcase turntable.
      let cinematic = false;
      window.KODRO_CINEMATIC = false;
      // Smooth camera reset (window.KODRO_RESET_CAM): animates azim/elev/dist
      // back to the world's default over 30 frames with smoothstep easing.
      let resetFrames = 0, resetStartAzim = 0, resetStartElev = 0, resetStartDist = 0;
      window.KODRO_RESET_CAM = function () { resetStartAzim = azim; resetStartElev = elev; resetStartDist = dist; resetFrames = 30; };
      // Baseline fog near plane, saved so the fake-DOF tick can modulate it
      // relative to the original value instead of drift-accumulating.
      const fogNear0 = (scene.fog && scene.fog.near != null) ? scene.fog.near : null;
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
      // The workspace can resize without the browser window changing (Simple
      // mode hides/reveals Evidence, onboarding closes, and draggable columns
      // move). A window-only listener left the WebGL canvas at its 800x500
      // bootstrap size and exposed a black strip below it. Observe the actual
      // mount so the drawing buffer always fills the product surface.
      let resizeObserver = null;
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(mount);
      }
      window.requestAnimationFrame(onResize);

      let raf = 0;
      const tmp = new THREE.Vector3();
      const camTarget = new THREE.Vector3();
      const UP_Y = new THREE.Vector3(0, 1, 0); // cinematic sun-drift axis (preallocated)
      const angLerp = (a, b, t) => {
        let d = (b - a) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        return a + d * t;
      };
      // Auto-quality: if the first couple of seconds run slow on a weak GPU,
      // drop shadows and the pixel ratio once so the view stays usable.
      let frames = 0, slow = 0, downgraded = false, last = (window.performance && window.performance.now) ? window.performance.now() : 0;
      let frameIntervals = [], renderWork = [], budgetMissWindows = 0;
      const downgradeQuality = () => {
        if (downgraded) return;
        renderer.shadowMap.enabled = false; sun.castShadow = false;
        renderer.setPixelRatio(1); downgraded = true;
        // Propagate the drop to every quality-gated system, not just the
        // renderer: ambient reads window.KODRO_QUALITY live each frame, and
        // heavy weather particle buffers should stop with the tier.
        try { window.KODRO_QUALITY = 'low'; } catch (e) { void e; }
        if (weatherFx && weatherFx.dispose) { try { weatherFx.dispose(); } catch (e) { void e; } }
        weatherFx = null;
      };
      const publishPerformance = () => {
        if (frameIntervals.length < 120 || renderWork.length < 120) return;
        const framesSorted = frameIntervals.slice().sort((a, b) => a - b);
        const workSorted = renderWork.slice().sort((a, b) => a - b);
        const p95i = framesSorted[Math.floor((framesSorted.length - 1) * 0.95)];
        const p95w = workSorted[Math.floor((workSorted.length - 1) * 0.95)];
        const median = framesSorted[Math.floor((framesSorted.length - 1) * 0.5)];
        const avg = frameIntervals.reduce((a, b) => a + b, 0) / frameIntervals.length;
        const report = {
          schemaVersion: 1,
          sampleFrames: frameIntervals.length,
          measuredFps: Number((1000 / Math.max(0.001, avg)).toFixed(1)),
          refreshEstimateHz: Number((1000 / Math.max(0.001, median)).toFixed(1)),
          p95FrameIntervalMs: Number(p95i.toFixed(2)),
          p95RenderSubmissionMs: Number(p95w.toFixed(2)),
          target240HzFrameMs: 4.17,
          highRefreshSubmissionReady: p95w <= 4.17,
          actual240FpsGuaranteed: false,
          actualFpsBoundary: 'Displayed FPS is bounded by the monitor, browser scheduler, GPU, scene and device.',
          quality: downgraded ? 'low-adaptive' : (window.KODRO_QUALITY || Q),
          // What actually rasterises these frames. A software figure is not
          // comparable to a hardware one, so any fps number quoted from this
          // report has to carry the class alongside it or it overstates the
          // result. 'unknown' when the browser withholds the renderer string.
          rendererClass: (window.KODRO_GPU_CAPS && window.KODRO_GPU_CAPS.rendererClass) || 'unknown',
          downgraded,
        };
        try { window.KodroPerformance = report; } catch (e) { void e; }
        try {
          mount.dataset.perfFps = String(report.measuredFps);
          mount.dataset.perfRefreshHz = String(report.refreshEstimateHz);
          mount.dataset.perfP95FrameMs = String(report.p95FrameIntervalMs);
          mount.dataset.perfP95WorkMs = String(report.p95RenderSubmissionMs);
          mount.dataset.perf240Ready = report.highRefreshSubmissionReady ? 'true' : 'false';
          mount.dataset.perfQuality = report.quality;
          window.dispatchEvent(new CustomEvent('kodro-performance', { detail: report }));
        } catch (e) { void e; }
        // Two sustained windows outside the normal 40 FPS / 120 Hz work
        // budgets trigger the same safe Low-tier fallback as the legacy
        // long-frame detector. One noisy window never changes the scene.
        if (p95i > 25 || p95w > 8.33) budgetMissWindows++; else budgetMissWindows = Math.max(0, budgetMissWindows - 1);
        if (budgetMissWindows >= 2) downgradeQuality();
        frameIntervals = []; renderWork = [];
      };
      const tick = () => {
        if (disposed) return;
        // Backgrounded tab: do no render or sim work. rAF is already throttled
        // when hidden, but a frame can still fire (picture-in-picture, a second
        // monitor), so skip the body and reset the clock so the first visible
        // frame sees a small dt instead of a multi-second jump.
        if (typeof document !== 'undefined' && document.hidden) {
          last = (window.performance && window.performance.now) ? window.performance.now() : last;
          raf = window.requestAnimationFrame(tick);
          return;
        }
        // Covered by a modal, a popover or the evidence drawer: the canvas is
        // not visible, so rendering it is pure cost on a machine that has none
        // to spare. app.jsx owns the class (see simIdle there).
        //
        // This is safe to skip because the SIMULATION does not live here. The
        // run advances on setTimeout in hooks.jsx, deliberately, so that logic
        // keeps moving when the tab is backgrounded; this loop only draws the
        // rover toward a state something else computed. Pausing it cannot
        // change a distance, a collision count or a grade.
        //
        // It is also what lets the translucent surfaces exist at all: styles.css
        // only enables backdrop blur under body.kodro-sim-idle, so a blurred
        // panel and a live WebGL canvas never compete for the same frame.
        if (typeof document !== 'undefined' && document.body
          && document.body.classList.contains('kodro-sim-idle')) {
          last = (window.performance && window.performance.now) ? window.performance.now() : last;
          raf = window.requestAnimationFrame(tick);
          return;
        }
        const now = (window.performance && window.performance.now) ? window.performance.now() : last + 16;
        const dt = now - last; last = now;
        if (!downgraded && ++frames > 12) {
          if (dt > 40) slow++; else slow = Math.max(0, slow - 1);
          if (slow > 30) {
            downgradeQuality();
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
        // R5: the robot rides the SAME displacement field the ground mesh was
        // built from, so it climbs swells and settles into dips instead of
        // hovering at y=0. Render-side only: the cm-space sim is untouched.
        const gy = groundY(cur.x, cur.z);
        rov.position.set(cur.x, gy, cur.z);
        // The engine advances by (sin h, -cos h); after the z-flip the 3D travel
        // direction is (sin h, cos h). The mesh is built forward = local +x, and
        // a Y-rotation of +x by theta gives (cos theta, -sin theta), so theta
        // must be curHeading - 90deg for the mesh to face the way it actually
        // moves (it was crabbing 90deg before). Matches how the agents face.
        rov.rotation.y = curHeading - Math.PI / 2;
        const moved = Math.hypot(cur.x - px0, cur.z - pz0);
        // Negative: a positive turn about the axle (tyre local +Y, parent +Z)
        // rolls the wheel backward relative to +x travel; wheels were spinning
        // the wrong way (same sign family as the backward-reading heading cone).
        if (moved > 0.001) wheels.forEach((wh) => wh.rotateY(-moved * 1.6));
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
        // R9: skid-steer counter-rotation -- a pivoting rover visibly spins
        // its left and right wheels opposite ways (a car arcs instead of
        // pivoting, so its wheels keep rolling forward).
        if (rType !== 'car' && Math.abs(turn) > 0.0006 && moved < 0.02) {
          for (let i = 0; i < wheels.length; i++) wheels[i].rotateY(turn * 5.5 * (wheels[i].userData.side || 1));
        }
        // R9: low-traction drift -- on ice or loose sand the tail steps out on
        // turn exit and settles over ~0.3 s. Render-side offset only: the
        // cm-space sim, the collision test and the trail are untouched.
        if (Q !== 'low' && !reduce && traction < 0.7) {
          const dsec = Math.min(0.1, dt / 1000);
          driftV += turn * vsmooth * 26 * (0.7 - traction);
          driftV *= Math.max(0, 1 - dsec * 3.4);
          if (driftV > 0.9) driftV = 0.9; else if (driftV < -0.9) driftV = -0.9;
          if (Math.abs(driftV) > 0.002) {
            rov.position.x += -Math.cos(curHeading) * driftV;
            rov.position.z += Math.sin(curHeading) * driftV;
          }
        }
        // pitch: nose lifts under acceleration, dips under braking (about the lateral axis = local z)
        // Positive: rotation.z > 0 lifts the nose (+x toward +y), and real
        // weight transfer lifts the nose under acceleration, dips it braking.
        // The old -accel had it exactly backwards.
        bodyPitch += (clamp(accel * 7, -0.16, 0.16) * feel.pitch - bodyPitch) * 0.18;
        // roll: lean into the turn (about the forward axis = local x), more at speed
        bodyRoll += (clamp(turn * 9 + turn * vsmooth * 22, -0.24, 0.24) * feel.roll - bodyRoll) * 0.16;
        // suspension: a small settle driven by acceleration, eased back to rest
        susp += (clamp(-accel * 1.6, -0.18, 0.18) * feel.susp - susp) * 0.22;
        // R5: terrain conformance. Sample the shared displacement field along
        // the wheel line (ahead/behind and right/left of the hull) and ease
        // the body onto that slope, so climbing a swell reads as the chassis
        // pitching up it rather than staying bolt upright through a hill.
        // Forward is local +x = world (sin h, cos h); right is (-cos h, sin h).
        if (dispAmp) {
          const fx2 = Math.sin(curHeading), fz2 = Math.cos(curHeading);
          const hf = groundY(cur.x + fx2 * 1.4, cur.z + fz2 * 1.4), hb = groundY(cur.x - fx2 * 1.4, cur.z - fz2 * 1.4);
          const hr = groundY(cur.x - fz2 * 1.4, cur.z + fx2 * 1.4), hl = groundY(cur.x + fz2 * 1.4, cur.z - fx2 * 1.4);
          terrPitch += (clamp(Math.atan2(hf - hb, 2.8), -0.3, 0.3) - terrPitch) * 0.14;
          terrRoll += (clamp(-Math.atan2(hr - hl, 2.8), -0.3, 0.3) - terrRoll) * 0.14;
        }
        body.rotation.z = bodyPitch + terrPitch;
        body.rotation.x = bodyRoll + terrRoll;
        body.position.y = -Math.abs(susp) * 0.35;
        // R2: the contact shadow participates in the motion -- suspension
        // compression squeezes it slightly so it reads as carried weight,
        // not a decal painted on the ground.
        if (contactShadow) { const csq = 1 - Math.abs(susp) * 0.5; contactShadow.scale.set(csq, csq, 1); }
        // front wheels steer toward the heading change
        if (steer.length) { const sa = clamp(turn * 26, -0.5, 0.5); steer.forEach((wg) => { wg.rotation.y += (sa - wg.rotation.y) * 0.3; }); }
        // First-person forward is the real 3D travel direction (sin h, cos h),
        // the same vector the rover mesh now faces, so the driver view looks
        // where the robot actually drives rather than 90deg off to the side.
        const fwd = tmp.set(Math.sin(curHeading), 0, Math.cos(curHeading));

        // Grow the trail when the rover has actually moved.
        if (trailN === 0 || Math.hypot(cur.x - trailPos[(trailN - 1) * 3], cur.z - trailPos[(trailN - 1) * 3 + 2]) > 0.25) {
          if (trailN >= MAXPTS) {
            trailPos.copyWithin(0, 3);
            trailN = MAXPTS - 1;
          }
          trailPos[trailN * 3] = cur.x;
          trailPos[trailN * 3 + 1] = gy + 0.3; // R5: the trail hugs the terrain
          trailPos[trailN * 3 + 2] = cur.z;
          trailN += 1;
          trailGeo.setDrawRange(0, trailN);
          trailGeo.attributes.position.needsUpdate = true;
        }

        // Drive the live agents (pedestrians, traffic, roaming robots) and the
        // per-world ambient life, all off this ONE clock. dt is clamped so a
        // stray long frame cannot fling the integrators; a throwing ambient
        // update disables itself instead of error-looping every frame.
        const dts = Math.min(0.1, dt / 1000);
        if (agents.length) { const tsec = now / 1000; for (let i = 0; i < agents.length; i++) agents[i].update(tsec, dts); }
        if (ambient && !reduce) {
          try { ambient.update(now / 1000, dts); }
          catch (e) { if (window.console) console.warn('KodroAmbient update failed; ambient life stopped:', e); ambient = null; }
        }
        // World FX driven off the same clock; a throwing system disables
        // itself (its meshes stay for the teardown traverse to dispose).
        if (landmarkFx && landmarkFx.update && !reduce) {
          try { landmarkFx.update(now / 1000, dts); } catch (e) { landmarkFx = null; }
        }
        if (waterFx && !reduce) {
          try { waterFx.update(now / 1000, dts); } catch (e) { waterFx = null; }
        }
        if (weatherFx && !reduce) {
          try { weatherFx.update(now / 1000, dts, cur.x, cur.z); } catch (e) { weatherFx = null; }
        }
        // R8: at Cinematic the sun drifts slowly across the sky (a filmic
        // day passing); static presets everywhere else.
        if (cinematic && !reduce && todAdj) sun.position.applyAxisAngle(UP_Y, dts * 0.01);

        // Sync the cinematic toggle from the host app each frame.
        cinematic = !!window.KODRO_CINEMATIC;
        // Cinematic auto-orbit: slowly revolve around the robot when enabled and
        // the user is not dragging (third person only). 0.15 deg/frame -> a full
        // turn in about 40 seconds, slow enough to feel like a film dolly.
        if (cinematic && !dragging && !fpvRef.current && !reduce) {
          azim += 0.15 * Math.PI / 180;
        }
        // Smooth camera reset: ease azim/elev/dist back to the default over 30
        // frames with smoothstep so the reset glides instead of snapping.
        if (resetFrames > 0) {
          const rt = (30 - resetFrames) / 30;      // 0 -> 1
          const re = rt * rt * (3 - 2 * rt);       // smoothstep
          azim = resetStartAzim + (2.4 - resetStartAzim) * re;
          elev = resetStartElev + (ELEV0 - resetStartElev) * re;
          dist = resetStartDist + (DIST0 - resetStartDist) * re;
          resetFrames--;
        }
        if (fpvRef.current) {
          // First person: sit in the rover, look the way it drives.
          // Head-bob: a small vertical sway (amplitude 0.02) whose frequency
          // rises with speed, so FPV feels alive instead of a camera glued to
          // rails. Bob fades to zero when the robot is still.
          const sp = vsmooth;
          const bobAmt = Math.min(1, sp * 6);
          const bob = reduce ? 0 : Math.sin(now * 0.015 * (1 + sp * 12)) * 0.02 * bobAmt;
          // R5: the driver's eye rides the terrain too, and looks at a point
          // on the surface ahead, so FPV pitches naturally through the swells.
          camPos.set(cur.x + fwd.x * 1.2, gy + 2.4 + bob, cur.z + fwd.z * 1.2);
          camera.position.copy(camPos);
          camera.lookAt(cur.x + fwd.x * 20, groundY(cur.x + fwd.x * 20, cur.z + fwd.z * 20) + 1.8 + bob, cur.z + fwd.z * 20);
        } else {
          // Third person orbit, damped so it eases rather than jumps.
          // Frame-rate independent damping: the follow feels the same at 30 or
          // 144 fps. alpha = 1 - (1 - 0.12)^(dt*60), dt in seconds.
          const ox = Math.cos(azim) * Math.cos(elev) * dist;
          const oy = Math.sin(elev) * dist + 4;
          const oz = Math.sin(azim) * Math.cos(elev) * dist;
          const camAlpha = reduce ? 1 : (1 - Math.pow(1 - 0.12, (dt / 1000) * 60));
          // R5: orbit height and aim track the robot's terrain height (gy is a
          // smooth field, so the camera glides over swells with the robot).
          camPos.lerp(camTarget.set(cur.x + ox, gy + oy, cur.z + oz), camAlpha);
          camera.position.copy(camPos);
          camera.lookAt(cur.x, gy + 2, cur.z);
        }
        // Fake depth of field: pull the fog near plane closer when the camera is
        // far from the robot, so distant scenery softens into haze for a
        // photographic depth feel without a post-processing pass. Subtle (up to
        // 35% nearer) so it never looks like a wall of fog.
        if (scene.fog && scene.fog.near != null && fogNear0 != null) {
          const camDist = camera.position.distanceTo(cur);
          const dofT = Math.max(0, Math.min(1, (camDist - 18) / 50));
          scene.fog.near = fogNear0 * (1 - 0.35 * dofT);
        }
        // Cinematic uses the offline bloom/vignette pass; every other tier (and
        // the post-downgrade slow-GPU path) renders straight to the canvas. If
        // the post pass ever throws at frame time (e.g. an old GPU that cannot
        // linear-filter the half-float bloom target), disable it permanently and
        // fall back to the plain render so the view never freezes.
        const renderStarted = (window.performance && window.performance.now) ? window.performance.now() : now;
        if (post && !downgraded) {
          try { post.render(scene, camera); }
          catch (e) { void e; try { post.dispose(); } catch (e2) { void e2; } post = null; renderer.setRenderTarget(null); renderer.render(scene, camera); }
        } else {
          renderer.render(scene, camera);
        }
        const renderEnded = (window.performance && window.performance.now) ? window.performance.now() : renderStarted;
        if (dt > 0 && dt < 250) frameIntervals.push(dt);
        renderWork.push(Math.max(0, renderEnded - renderStarted));
        publishPerformance();
        raf = window.requestAnimationFrame(tick);
      };
      // Expose the live renderer + sun so the in-place quality effect can adjust
      // pixel ratio and shadows without a remount. Set after the scene is built.
      glRef.current = { renderer, sun, indoor, scene, THREE };
      tick();

      return () => {
        disposed = true;
        // Drop the window hooks this instance exposed so a stale KODRO_RESET_CAM
        // cannot write into a disposed closure after a remount.
        try { window.KODRO_CINEMATIC = undefined; } catch (e) { void e; }
        try { window.KODRO_RESET_CAM = undefined; } catch (e) { void e; }
        glRef.current = null;
        if (reduceMql) {
          if (reduceMql.removeEventListener) reduceMql.removeEventListener('change', onReduceChange);
          else if (reduceMql.removeListener) reduceMql.removeListener(onReduceChange);
        }
        window.cancelAnimationFrame(raf);
        // Stop the ambient systems; their meshes stay in the scene so the
        // traverse below (the single owner of disposal) frees GPU resources.
        if (ambient) { try { ambient.dispose(); } catch (e) { void e; } ambient = null; }
        if (post) { try { post.dispose(); } catch (e) { void e; } post = null; }
        if (resizeObserver) { try { resizeObserver.disconnect(); } catch (e) { void e; } resizeObserver = null; }
        window.removeEventListener('resize', onResize);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointermove', onMove);
        dom.removeEventListener('pointerdown', onDown);
        dom.removeEventListener('wheel', onWheel);
        dom.removeEventListener('keydown', onKey);
        canvas.removeEventListener('webglcontextlost', onContextLost);
        canvas.removeEventListener('webglcontextrestored', onContextRestored);
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
      // siteId is a dep: a mission-site switch on the SAME base world (earth ->
      // sahara) must tear down and rebuild the scene, or the site's obstacle
      // field and palette silently never appear (world-coherence BUG-1).
      //
      // terrain.obstacles is a dep for the same reason one level down: entering
      // or leaving a lesson swaps the collidable set WITHOUT changing the world
      // id, so the scene kept drawing the free-play scenery while the physics
      // used the lesson's -- the rover crashed into invisible trees on a plane
      // that looked empty. `terrain` is a useMemo, so this reference changes
      // exactly when the collidable set does.
    }, [terrain && terrain.id, terrain && terrain.siteId, terrain && terrain.obstacles, robotType]);

    // Lesson goal markers. The props layer carries the lesson's sample flags
    // (app.jsx lessonMarks); the 3D viewport is the DEFAULT view and never
    // received them, so the arena the pupil is marked in was drawn only in the
    // flat 2D view most people never open. Kept in its own group so it can be
    // rebuilt on every props change without touching the scene build.
    const marksRef = useRef(null);
    useEffect(() => {
      const g = glRef.current;
      if (!g || !g.scene || !g.THREE) return undefined;
      const THREE = g.THREE;
      const group = new THREE.Group();
      g.scene.add(group);
      marksRef.current = group;
      const flags = (props || []).filter((p) => p && p.kind === 'flag');
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6 });
      const clothMat = new THREE.MeshStandardMaterial({
        color: 0xffc83d, emissive: 0x6b4a00, emissiveIntensity: 0.55,
        roughness: 0.5, side: THREE.DoubleSide,
      });
      const discMat = new THREE.MeshStandardMaterial({
        color: 0xffc83d, emissive: 0x6b4a00, emissiveIntensity: 0.4,
        transparent: true, opacity: 0.35,
      });
      const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8);
      const clothGeo = new THREE.PlaneGeometry(1.0, 0.62);
      const discGeo = new THREE.CircleGeometry(0.9, 24);
      for (const f of flags) {
        const px = f.x * SCALE, pz = -f.y * SCALE;
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(px, 1.1, pz);
        pole.castShadow = true;
        group.add(pole);
        const cloth = new THREE.Mesh(clothGeo, clothMat);
        cloth.position.set(px + 0.5, 1.85, pz);
        group.add(cloth);
        // A ring on the ground so the target is findable from the low chase
        // camera, where a thin pole disappears against the horizon.
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(px, 0.03, pz);
        group.add(disc);
      }
      // The base pad. Lessons that ask the rover to come home were marking a
      // spot with nothing drawn on it.
      const baseMark = (props || []).find((p) => p && p.lessonBase);
      if (baseMark) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.0, 1.4, 32),
          new THREE.MeshStandardMaterial({
            color: 0x32cd32, emissive: 0x0d3a0d, emissiveIntensity: 0.5,
            transparent: true, opacity: 0.55, side: THREE.DoubleSide,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(baseMark.x * SCALE, 0.02, -baseMark.y * SCALE);
        group.add(ring);
      }
      return () => {
        g.scene.remove(group);
        // This effect re-runs every time a sample is collected, so anything it
        // allocated has to be released or each pickup leaks a mesh's worth of
        // GPU memory for the rest of the session.
        group.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
        [poleGeo, clothGeo, discGeo, poleMat, clothMat, discMat].forEach((o) => o.dispose());
        marksRef.current = null;
      };
    }, [props]);

    // Move keyboard focus to the canvas when the user explicitly opens the 3D
    // view (focusKey bumps on that click only). focusKey starts at 0 so the
    // initial page load never steals focus. Declared AFTER the build effect so
    // on a fresh mount the canvas is already appended when this runs (React
    // runs effects in declaration order).
    useEffect(() => {
      if (!focusKey) return;
      const mount = mountRef.current;
      const cv = mount && mount.querySelector('canvas');
      if (cv && cv.focus) { try { cv.focus(); } catch (e) { void e; } }
    }, [focusKey]);

    // Keep the canvas's screen-reader label honest per camera mode: orbit and
    // zoom only exist in third person; in first person those inputs no-op, so
    // promising them (in the label or the caption below) is a lie.
    useEffect(() => {
      const cv = mountRef.current && mountRef.current.querySelector('canvas');
      if (!cv) return;
      cv.setAttribute('aria-label', fpv
        ? 'Three dimensional world, first person view riding the robot.'
        : 'Three dimensional world. Drag or use the arrow keys to orbit, plus and minus to zoom.');
    }, [fpv]);

    // A caption that surfaces the keyboard controls. It is hidden until the
    // canvas is focused (see .vp3d-help in styles.css), so sighted keyboard
    // users get a visible hint the moment they tab in, without cluttering the
    // pointer-driven view. aria-hidden because the canvas's own aria-label
    // already announces the same controls to screen readers.
    // W6: the site identity chip -- name plus coordinates, previously only in
    // the 2.5D view, so a 3D mission site never says where it is.
    return React.createElement(
      'div', { className: 'viewport3d', ref: mountRef },
      React.createElement('div', { className: 'vp3d-help', 'aria-hidden': 'true' },
        fpv ? 'First person · riding the robot' : 'Arrow keys orbit  ·  +/- zoom  ·  drag to look'),
      (terrain && terrain.name) ? React.createElement(
        'div', { className: 'vp3d-site' },
        React.createElement('span', { className: 'vp3d-site-name' }, terrain.name),
        terrain.coord ? React.createElement('span', { className: 'vp3d-site-coord' }, terrain.coord) : null,
      ) : null,
    );
  }

  window.Viewport3D = Viewport3D;
})();
