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

      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      renderer.shadowMap.enabled = true;
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(SKY[id] != null ? SKY[id] : SKY.earth);
      scene.fog = new THREE.Fog(FOG[id] != null ? FOG[id] : FOG.earth, 60, 220);

      const camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 2000);

      // Lights.
      scene.add(new THREE.HemisphereLight(0xffffff, 0x404048, id === 'space' ? 0.5 : 0.95));
      const sun = new THREE.DirectionalLight(0xfff4e2, id === 'space' ? 0.7 : 1.0);
      sun.position.set(40, 80, 30);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 300;
      sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
      sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
      scene.add(sun);

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
      const obstacles = (terrain && terrain.obstacles) || [];
      obstacles.forEach((o) => {
        const r = Math.max(0.6, o.r * SCALE);
        const px = o.x * SCALE, pz = -o.y * SCALE;
        if (id === 'earth' && o.v >= 0.5) {
          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.24, r * 1.4, 6), trunkMat);
          trunk.position.y = r * 0.7; trunk.castShadow = true;
          const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 1.1, 0), leafMat);
          canopy.position.y = r * 1.9; canopy.castShadow = true;
          tree.add(trunk); tree.add(canopy);
          tree.position.set(px, 0, pz);
          scene.add(tree);
        } else {
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat);
          rock.position.set(px, r * 0.55, pz);
          rock.rotation.set(o.v * 3, o.rot || 0, o.v * 2);
          rock.castShadow = true; rock.receiveShadow = true;
          scene.add(rock);
        }
      });

      // Rover: a body + a bright nose so its facing is obvious, on four wheels.
      const rov = new THREE.Group();
      const accent = new THREE.Color((terrain && terrain.accent) || '#5ce0d8');
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 1.6), new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.6, metalness: 0.2 }));
      body.position.y = 0.85; body.castShadow = true;
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 1.2), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5 }));
      nose.position.set(1.35, 0.9, 0);
      rov.add(body); rov.add(nose);
      const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.9 });
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(sx * 0.9, 0.45, sz * 0.85);
        wheel.castShadow = true; rov.add(wheel);
      });
      scene.add(rov);

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
      dom.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointermove', onMove);
      dom.addEventListener('wheel', onWheel, { passive: false });

      const onResize = () => {
        w = mount.clientWidth || w; h = mount.clientHeight || h;
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize);

      let raf = 0;
      const tmp = new THREE.Vector3();
      const tick = () => {
        const s = stateRef.current;
        const hx = s.x * SCALE, hz = -s.y * SCALE;
        const hr = (s.heading || 0) * Math.PI / 180;
        rov.position.set(hx, 0, hz);
        rov.rotation.y = hr;
        const fwd = new THREE.Vector3(Math.cos(hr), 0, -Math.sin(hr));
        if (fpvRef.current) {
          // First person: sit in the rover, look the way it drives.
          camera.position.set(hx + fwd.x * 1.2, 2.4, hz + fwd.z * 1.2);
          tmp.set(hx + fwd.x * 20, 1.8, hz + fwd.z * 20);
          camera.lookAt(tmp);
        } else {
          // Third person orbit around the rover.
          const ox = Math.cos(azim) * Math.cos(elev) * dist;
          const oy = Math.sin(elev) * dist;
          const oz = Math.sin(azim) * Math.cos(elev) * dist;
          camera.position.set(hx + ox, oy + 4, hz + oz);
          camera.lookAt(hx, 2, hz);
        }
        renderer.render(scene, camera);
        raf = window.requestAnimationFrame(tick);
      };
      tick();

      return () => {
        window.cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointermove', onMove);
        dom.removeEventListener('pointerdown', onDown);
        dom.removeEventListener('wheel', onWheel);
        renderer.dispose();
        scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
        });
        if (dom.parentNode) dom.parentNode.removeChild(dom);
      };
    }, [terrain && terrain.id]);

    return React.createElement('div', { className: 'viewport3d', ref: mountRef });
  }

  window.Viewport3D = Viewport3D;
})();
