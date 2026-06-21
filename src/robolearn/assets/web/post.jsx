/* Hand-written offline post-processing for the Cinematic quality tier.
 *
 * Three.js ships EffectComposer and the bloom pass only in its examples/ tree,
 * which is NOT vendored here and cannot be fetched under the zero-network
 * offline guarantee. So this is a small, self-contained bloom + vignette pass
 * written directly against the core renderer: no EffectComposer, no examples,
 * no new vendored binary.
 *
 * Design for safety. The proven base image is rendered to the canvas exactly
 * as the non-Cinematic path renders it. The scene is then rendered once more
 * into an offscreen target used ONLY as a bloom source; the bloom is composited
 * ADDITIVELY on top and a vignette MULTIPLY darkens the corners. Because the
 * base is never replaced, the worst case is "looks like the normal render".
 * create() returns null on any GPU/allocation failure, and the caller falls
 * back to a plain renderer.render. Gated by the caller to Cinematic only, off
 * under prefers-reduced-motion and after the slow-GPU auto-downgrade.
 *
 * Exposed as window.KodroPost.create(THREE, renderer, w, h).
 */
(function () {
  'use strict';

  const VERT = [
    'varying vec2 vUv;',
    'void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  ].join('\n');

  const BRIGHT_FS = [
    'uniform sampler2D tDiffuse; uniform float threshold; uniform float knee; varying vec2 vUv;',
    'void main(){',
    '  vec3 c = texture2D(tDiffuse, vUv).rgb;',
    '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '  float k = smoothstep(threshold, threshold + knee, l);',
    '  gl_FragColor = vec4(c * k, 1.0);',
    '}',
  ].join('\n');

  // 5-tap separable Gaussian (sigma ~ the classic 0.227/0.316/0.070 weights).
  const BLUR_FS = [
    'uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;',
    'void main(){',
    '  vec4 s = texture2D(tDiffuse, vUv) * 0.227027;',
    '  s += texture2D(tDiffuse, vUv + dir * 1.3846) * 0.316216;',
    '  s += texture2D(tDiffuse, vUv - dir * 1.3846) * 0.316216;',
    '  s += texture2D(tDiffuse, vUv + dir * 3.2307) * 0.070270;',
    '  s += texture2D(tDiffuse, vUv - dir * 3.2307) * 0.070270;',
    '  gl_FragColor = s;',
    '}',
  ].join('\n');

  // Additive bloom overlay. The source target is linear (tone-mapped); convert
  // to approximate display space so the glow adds in the same space the canvas
  // base already lives in.
  const BLOOM_FS = [
    'uniform sampler2D tBloom; uniform float intensity; varying vec2 vUv;',
    'void main(){',
    '  vec3 b = max(texture2D(tBloom, vUv).rgb * intensity, 0.0);',
    '  b = pow(b, vec3(1.0 / 2.2));',
    '  gl_FragColor = vec4(b, 1.0);',
    '}',
  ].join('\n');

  // Multiply vignette: 1.0 in the centre, darkening toward the corners.
  const VIG_FS = [
    'uniform float strength; varying vec2 vUv;',
    'void main(){',
    '  vec2 p = vUv - 0.5;',
    '  float d = dot(p, p);',
    '  float v = 1.0 - strength * smoothstep(0.12, 0.7, d);',
    '  gl_FragColor = vec4(vec3(v), 1.0);',
    '}',
  ].join('\n');

  function create(THREE, renderer, w, h) {
    try {
      if (!THREE || !renderer || !THREE.WebGLRenderTarget || !THREE.ShaderMaterial) return null;
      w = Math.max(2, w | 0); h = Math.max(2, h | 0);
      let hw = Math.max(1, (w / 2) | 0), hh = Math.max(1, (h / 2) | 0);

      const rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
      // HalfFloat lets bright highlights exceed 1.0 so the bloom has something to
      // bloom from; fall back to the default byte target if unsupported.
      if (THREE.HalfFloatType != null) rtOpts.type = THREE.HalfFloatType;
      const sceneRT = new THREE.WebGLRenderTarget(w, h, rtOpts);
      const bloomA = new THREE.WebGLRenderTarget(hw, hh, rtOpts);
      const bloomB = new THREE.WebGLRenderTarget(hw, hh, rtOpts);

      // Fullscreen triangle: vertices already in clip space, so the vertex
      // shader passes them straight through and the camera is irrelevant.
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));

      // ShaderMaterial (not RawShaderMaterial) so Three injects the `position`
      // and `uv` attribute declarations and the precision qualifier the shaders
      // below rely on; the injected MVP matrices are simply ignored because the
      // fullscreen triangle is already in clip space.
      const mk = (fs, uniforms, blending) => new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: fs, uniforms,
        depthTest: false, depthWrite: false,
        blending: (blending == null ? THREE.NoBlending : blending),
        transparent: blending != null,
      });
      // Threshold raised + intensity lowered so bloom accents real highlights
      // (lights, sky, emissive) instead of blooming the whole lit ground, which
      // washed bright worlds (Earth) into a blown-out haze.
      const brightMat = mk(BRIGHT_FS, { tDiffuse: { value: sceneRT.texture }, threshold: { value: 0.9 }, knee: { value: 0.2 } });
      const blurMat = mk(BLUR_FS, { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } });
      const bloomMat = mk(BLOOM_FS, { tBloom: { value: bloomA.texture }, intensity: { value: 0.42 } }, THREE.AdditiveBlending);
      const vigMat = mk(VIG_FS, { strength: { value: 0.4 } }, THREE.MultiplyBlending);

      const quadScene = new THREE.Scene();
      const quadMesh = new THREE.Mesh(geo, brightMat);
      quadMesh.frustumCulled = false;
      quadScene.add(quadMesh);
      const quadCam = new THREE.Camera();

      const drawPass = (mat, target) => {
        quadMesh.material = mat;
        renderer.setRenderTarget(target || null);
        renderer.render(quadScene, quadCam);
      };

      function render(scene, camera) {
        const prevAutoClear = renderer.autoClear;
        const prevTarget = renderer.getRenderTarget ? renderer.getRenderTarget() : null;
        try {
          // 1. Proven base image straight to the canvas (identical to the
          //    non-post path), so nothing about the trusted render changes.
          renderer.autoClear = true;
          renderer.setRenderTarget(null);
          renderer.render(scene, camera);
          // 2. Re-render the same frame into an offscreen target as the bloom
          //    source (tone-mapped, linear).
          renderer.setRenderTarget(sceneRT);
          renderer.render(scene, camera);
          // 3. Bright-pass into the half-res bloom buffer.
          brightMat.uniforms.tDiffuse.value = sceneRT.texture;
          drawPass(brightMat, bloomA);
          // 4. Separable blur: horizontal A->B, vertical B->A.
          blurMat.uniforms.tDiffuse.value = bloomA.texture;
          blurMat.uniforms.dir.value.set(1.5 / hw, 0);
          drawPass(blurMat, bloomB);
          blurMat.uniforms.tDiffuse.value = bloomB.texture;
          blurMat.uniforms.dir.value.set(0, 1.5 / hh);
          drawPass(blurMat, bloomA);
          // 5. Composite onto the canvas WITHOUT clearing the base.
          renderer.autoClear = false;
          bloomMat.uniforms.tBloom.value = bloomA.texture;
          drawPass(bloomMat, null);
          drawPass(vigMat, null);
        } finally {
          renderer.setRenderTarget(prevTarget || null);
          renderer.autoClear = prevAutoClear;
        }
      }

      function setSize(nw, nh) {
        nw = Math.max(2, nw | 0); nh = Math.max(2, nh | 0);
        hw = Math.max(1, (nw / 2) | 0); hh = Math.max(1, (nh / 2) | 0);
        sceneRT.setSize(nw, nh);
        bloomA.setSize(hw, hh);
        bloomB.setSize(hw, hh);
      }

      function dispose() {
        sceneRT.dispose(); bloomA.dispose(); bloomB.dispose();
        geo.dispose();
        brightMat.dispose(); blurMat.dispose(); bloomMat.dispose(); vigMat.dispose();
      }

      return { render, setSize, dispose };
    } catch (e) { void e; return null; }
  }

  if (typeof window !== 'undefined') {
    window.KodroPost = { create };
  }
})();
