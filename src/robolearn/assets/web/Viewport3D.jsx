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
    earth: 0x9ec7e8, mars: 0xd98a5a, underwater: 0x0b3a4c, space: 0x05060d,
  };
  const GROUND = {
    earth: 0x4a6b39, mars: 0x9a4a2e, underwater: 0x1c4a55, space: 0x3a3c44,
  };
  const FOG = {
    earth: 0xb6cdba, mars: 0xc08050, underwater: 0x0a2a38, space: 0x05060d,
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

      // Lights.
      scene.add(new THREE.HemisphereLight(0xffffff, 0x404048, id === 'space' ? 0.5 : 0.95));
      const sun = new THREE.DirectionalLight(0xfff4e2, id === 'space' ? 0.7 : 1.0);
      sun.position.set(40, 80, 30);
      sun.castShadow = true;
      sun.shadow.mapSize.set(512, 512); // gentle on integrated GPUs
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 300;
      sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
      sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
      scene.add(sun);

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
      scene.add(ground);
      const grid = new THREE.GridHelper(400, 80, 0x000000, 0x000000);
      grid.material.opacity = 0.08; grid.material.transparent = true;
      scene.add(grid);

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
      obstacles.forEach((o) => {
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
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(sx * 0.9, 0.45, sz * 0.85);
        wheel.castShadow = true; rov.add(wheel);
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

      // Third-person orbit controlled by drag + wheel.
      let azim = 2.4, elev = 0.62, dist = 26, dragging = false, lx = 0, ly = 0;
      const dom = renderer.domElement;
      const onDown = (e) => { dragging = true; lx = e.clientX; ly = e.clientY; };
      const onUp = () => { dragging = false; };
      const onMove = (e) => {
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
      const tick = () => {
        if (disposed) return;
        const s = stateRef.current;
        const tx = s.x * SCALE, tz = -s.y * SCALE;
        const tr = (s.heading || 0) * Math.PI / 180;
        // Glide the rover toward the live state instead of snapping to it.
        cur.x += (tx - cur.x) * posLerp;
        cur.z += (tz - cur.z) * posLerp;
        curHeading = angLerp(curHeading, tr, posLerp);
        rov.position.set(cur.x, 0, cur.z);
        rov.rotation.y = curHeading;
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
