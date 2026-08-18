/* Procedural surface maps for the 3D viewport (offline, no asset files).
 *
 * The ground already carries a baked albedo grain canvas. What made it still
 * read as a flat coloured plane was the lack of any SURFACE RELIEF: light hit
 * it as if it were glass-smooth. This module adds a tangent-space normal map
 * (Sobel-derived from a tileable height field) and a roughness map, so the
 * existing PBR sun and fill lights graze real micro-relief -- sand catches a
 * sheen, regolith pits read as pits, the seabed ripples.
 *
 * Everything is generated in-canvas at scene build time. No network, no files,
 * no new vendored binary. Headless-safe: with no `document` the generators
 * return null and the caller simply renders without the maps (exactly the old
 * look), so the offline bundle-render test never touches a canvas.
 *
 * Exposed as window.KodroTextures.groundMaps(THREE, color, id).
 */
(function () {
  'use strict';

  function _doc() { return (typeof document !== 'undefined') ? document : null; }
  function _canvas(size) {
    const d = _doc();
    if (!d || !d.createElement) return null;
    const cv = d.createElement('canvas');
    cv.width = cv.height = size;
    return cv;
  }

  // A tileable grayscale height field. Layered value-noise sines give the broad
  // dunes/swells; scattered radial bumps give grain; the seabed gets directional
  // ripples. Drawn so opposite edges meet (the sines are periodic over `size`),
  // which keeps the derived normal map seamless under RepeatWrapping.
  function heightCanvas(size, id) {
    const cv = _canvas(size);
    if (!cv) return null;
    const g = cv.getContext('2d');
    if (!g) return null;
    const img = g.createImageData(size, size);
    const d = img.data;
    const TAU = Math.PI * 2;
    // Two periodic octaves plus a finer one; all use integer wave counts over
    // the canvas so the field wraps exactly at the seam.
    const ripple = (id === 'underwater');
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        let h = 0.5
          + 0.16 * Math.sin(TAU * (2 * u)) * Math.cos(TAU * (2 * v))
          + 0.10 * Math.sin(TAU * (5 * u + 3 * v))
          + 0.06 * Math.sin(TAU * (8 * v - 4 * u));
        if (ripple) h += 0.12 * Math.sin(TAU * (11 * v)); // seabed ripples
        const c = Math.max(0, Math.min(1, h)) * 255;
        const i = (y * size + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = c; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // Scatter a few hundred soft bumps for grain. Radial gradients keep them
    // smooth so the normal map does not spike into harsh facets.
    const bumps = ripple ? 180 : 340;
    for (let i = 0; i < bumps; i++) {
      const x = Math.random() * size, y = Math.random() * size, r = 1.5 + Math.random() * 4.5;
      const up = Math.random() < 0.5;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.12 + Math.random() * 0.16;
      grad.addColorStop(0, (up ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + a + ')');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
    return cv;
  }

  // Tangent-space normal map from a height canvas via a wrap-around Sobel.
  // strength scales the relief; nz is kept at 1 so a flat patch reads as a
  // neutral (0.5,0.5,1) normal.
  function normalFromHeight(THREE, hcv, strength) {
    const size = hcv.width;
    const hc = hcv.getContext('2d');
    if (!hc) return null;
    const hd = hc.getImageData(0, 0, size, size).data;
    const out = _canvas(size);
    if (!out) return null;
    const oc = out.getContext('2d');
    const od = oc.createImageData(size, size);
    const o = od.data;
    const H = (x, y) => {
      x = (x + size) % size; y = (y + size) % size;
      return hd[(y * size + x) * 4] / 255;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (H(x - 1, y) - H(x + 1, y)) * strength;
        const dy = (H(x, y - 1) - H(x, y + 1)) * strength;
        let nx = dx, ny = dy, nz = 1;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len; ny /= len; nz /= len;
        const i = (y * size + x) * 4;
        o[i] = (nx * 0.5 + 0.5) * 255;
        o[i + 1] = (ny * 0.5 + 0.5) * 255;
        o[i + 2] = (nz * 0.5 + 0.5) * 255;
        o[i + 3] = 255;
      }
    }
    oc.putImageData(od, 0, 0);
    const t = new THREE.CanvasTexture(out);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // A gentle roughness map: mostly rough ground with softer, slightly smoother
  // patches (compacted soil, polished stone, wet seabed) so specular highlights
  // pool unevenly instead of being uniform. Lower value = smoother (shinier).
  function roughCanvas(size, id) {
    const cv = _canvas(size);
    if (!cv) return null;
    const g = cv.getContext('2d');
    if (!g) return null;
    const base = (id === 'underwater') ? 168 : (id === 'city' || id === 'room') ? 150 : 200;
    g.fillStyle = 'rgb(' + base + ',' + base + ',' + base + ')';
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 22; i++) {
      const x = Math.random() * size, y = Math.random() * size, r = 14 + Math.random() * 40;
      const dark = Math.random() < 0.5;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, (dark ? 'rgba(70,70,70,0.45)' : 'rgba(235,235,235,0.4)'));
      grad.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
    return cv;
  }

  // Build the relief + roughness maps for a ground material. Returns nulls when
  // headless or when canvas is unavailable, so the caller stays unconditional.
  function groundMaps(THREE, color, id) {
    try {
      if (!THREE || !_doc()) return { normal: null, rough: null };
      const size = 256;
      const strength = (id === 'space') ? 3.4 : (id === 'underwater') ? 2.2 : (id === 'mars') ? 3.0 : 2.6;
      const hcv = heightCanvas(size, id);
      if (!hcv) return { normal: null, rough: null };
      const normal = normalFromHeight(THREE, hcv, strength);
      if (normal) normal.repeat.set(9, 9);
      const rcv = roughCanvas(size, id);
      let rough = null;
      if (rcv) {
        rough = new THREE.CanvasTexture(rcv);
        rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
        rough.repeat.set(9, 9);
      }
      return { normal, rough };
    } catch (e) { void e; return { normal: null, rough: null }; }
  }

  if (typeof window !== 'undefined') {
    window.KodroTextures = { groundMaps };
  }
})();
