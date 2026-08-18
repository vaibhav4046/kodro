/* GPU capability probe.
 *
 * The first-run quality heuristic used to read only navigator.deviceMemory and
 * navigator.hardwareConcurrency. Those describe the CPU and RAM, never the GPU,
 * so a machine with plenty of both but no working hardware GL -- a VM, a remote
 * desktop session, a blocklisted or missing driver -- started at the 'high'
 * tier (shadow maps plus a 1.5x pixel ratio) and crawled until the runtime
 * frame monitor stepped it down some seconds later. That is exactly the
 * configuration this project measures as its own slow case, so the tier is now
 * chosen from what actually rasterises the pixels.
 *
 * classifyRenderer() is deliberately a pure string function: the whole point is
 * that it can be gated offline under Node, with no WebGL context in sight.
 */
(function () {
  'use strict';

  // Substrings that identify a CPU rasteriser rather than a real GPU. Matched
  // case-insensitively against the UNMASKED_RENDERER_WEBGL string.
  //   swiftshader  - Chrome's bundled software GL (also reported via ANGLE)
  //   llvmpipe/softpipe/gallium - Mesa's software paths on Linux
  //   microsoft basic render - the Windows fallback adapter with no driver
  //   generic renderer / software adapter - assorted VM presentations
  var SOFTWARE_MARKERS = [
    'swiftshader',
    'llvmpipe',
    'softpipe',
    'microsoft basic render',
    'generic renderer',
    'software adapter',
    'software rasterizer',
  ];

  /**
   * Classify a raw WebGL renderer string.
   * Returns 'software', 'hardware', or 'unknown' when the string is absent or
   * empty (some browsers withhold it for fingerprinting reasons -- absence is
   * NOT evidence of software rendering, so it must not be treated as such).
   */
  function classifyRenderer(raw) {
    if (typeof raw !== 'string') return 'unknown';
    var s = raw.trim().toLowerCase();
    if (!s) return 'unknown';
    for (var i = 0; i < SOFTWARE_MARKERS.length; i++) {
      if (s.indexOf(SOFTWARE_MARKERS[i]) !== -1) return 'software';
    }
    return 'hardware';
  }

  /**
   * Read the unmasked renderer string from a live WebGL context.
   * Returns '' when unavailable; every step is guarded because the debug
   * extension is optional and absent in locked-down browsers.
   */
  function rendererString(gl) {
    try {
      if (!gl || typeof gl.getExtension !== 'function') return '';
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (!ext) return '';
      var v = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      return typeof v === 'string' ? v : '';
    } catch (e) {
      void e;
      return '';
    }
  }

  /**
   * Probe this device once and report how it rasterises.
   * Creates a throwaway context and releases it immediately, so it costs a few
   * milliseconds at startup and holds no GPU memory afterwards.
   *
   * Returns { rendererClass, renderer, webglAvailable }.
   */
  function detect() {
    var out = { rendererClass: 'unknown', renderer: '', webglAvailable: false };
    try {
      if (typeof document === 'undefined' || !document.createElement) return out;
      var c = document.createElement('canvas');
      var gl = null;
      try {
        gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      } catch (e) { void e; }
      if (!gl) {
        // No WebGL at all: the 3D view cannot run here regardless of tier, and
        // the app falls back to the 2.5D viewport. Reported honestly rather
        // than being folded into 'software'.
        return out;
      }
      out.webglAvailable = true;
      out.renderer = rendererString(gl);
      out.rendererClass = classifyRenderer(out.renderer);
      // Release the probe context rather than waiting for GC; browsers cap the
      // number of live WebGL contexts and the real viewport needs one.
      try {
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose && lose.loseContext) lose.loseContext();
      } catch (e) { void e; }
    } catch (e) { void e; }
    return out;
  }

  /**
   * Recommended first-run quality tier.
   * cpuTier is what the existing deviceMemory/hardwareConcurrency heuristic
   * decided; this only ever lowers it, never raises it, so a weak CPU still
   * wins even when the GPU is real.
   */
  function recommendedTier(cpuTier, caps) {
    var c = caps || {};
    // Software rasterisation is fill-rate bound: shadow maps and a >1 pixel
    // ratio are the two costs that hurt most, and 'low' is the tier that drops
    // both. No WebGL at all lands here too -- the 2.5D fallback is cheap, and
    // if the context is somehow created later it should not start expensive.
    if (c.rendererClass === 'software') return 'low';
    if (c.webglAvailable === false) return 'low';
    return cpuTier;
  }

  window.KodroGpuCaps = {
    classifyRenderer: classifyRenderer,
    rendererString: rendererString,
    detect: detect,
    recommendedTier: recommendedTier,
    SOFTWARE_MARKERS: SOFTWARE_MARKERS,
  };
})();
