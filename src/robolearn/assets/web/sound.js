/* RoboLearn sound design — synthesised offline with the Web Audio API.
 * No audio files, no network: every cue is generated from oscillators +
 * noise, so it ships inside the app and works on a locked-down machine.
 * Exposes window.RLSound. Respects a mute flag and only starts the
 * AudioContext after a user gesture (browsers block autoplay).
 *
 * R6 additions: a live MOTOR LOOP voiced per robot type (car deeper, home
 * servo whine, arm stepper ticks) whose pitch and level track the sim's
 * speed profile; looped filtered-noise AMBIENCE BEDS per world (wind,
 * underwater brown noise, city hum with traffic swells panned toward the
 * nearest car, room HVAC; space stays silent -- vacuum); and CRASH VARIANTS
 * keyed to what was actually hit. All node graphs are built once and driven
 * by cheap AudioParam automation: no per-frame allocation.
 */
(function () {
  "use strict";
  var ctx = null;
  var muted = (function () {
    try { return localStorage.getItem("or_muted") !== "0"; } catch (e) { return true; }  // muted by default; opt in via Settings
  })();

  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ctx = null; }
    }
    return ctx;
  }

  function tone(freq, dur, type, gain, when) {
    var c = ac();
    if (!c || muted) return;
    var t = when || c.currentTime;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain || 0.07, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, gain) {
    var c = ac();
    if (!c || muted) return;
    var len = Math.floor(c.sampleRate * dur);
    var b = c.createBuffer(1, len, c.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    var n = c.createBufferSource();
    n.buffer = b;
    var g = c.createGain();
    g.gain.value = gain || 0.14;
    n.connect(g); g.connect(c.destination);
    n.start();
  }

  function seq(notes, type, gain, step) {
    var c = ac();
    if (!c) return;
    var t = c.currentTime;
    for (var i = 0; i < notes.length; i++) tone(notes[i], 0.18, type, gain, t + i * (step || 0.09));
  }

  // A 2-second looping noise buffer: white for wind/city, integrated
  // ("brown") for the deep-water and HVAC rumbles.
  function noiseBuffer(c, seconds, brown) {
    var len = Math.floor(c.sampleRate * seconds);
    var b = c.createBuffer(1, len, c.sampleRate);
    var d = b.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return b;
  }

  // ---- R6: motor loop -----------------------------------------------------
  // One persistent voice (two detuned oscillators through a lowpass) whose
  // pitch, brightness and level chase the sim's live speed. Voiced per robot
  // type: the car sits deeper, the home robot is a clean servo whine, the
  // arm ticks like a stepper, the rover hums in between.
  var motor = null; // { o1, o2, f, g, type, base }
  function motorKill() {
    if (!motor) return;
    try { motor.o1.stop(); motor.o2.stop(); } catch (e) { void e; }
    try { motor.g.disconnect(); } catch (e) { void e; }
    motor = null;
  }
  function motorEnsure(type) {
    var c = ctx; // never CREATE the context for a motor tick (gesture gate)
    if (!c || c.state !== "running" || muted) return null;
    if (motor && motor.type === type) return motor;
    motorKill();
    try {
      var g = c.createGain(); g.gain.value = 0.0001;
      var f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 320; f.Q.value = 0.8;
      var o1 = c.createOscillator(); var o2 = c.createOscillator();
      if (type === "home") { o1.type = "sine"; o2.type = "triangle"; }
      else if (type === "arm") { o1.type = "square"; o2.type = "square"; }
      else { o1.type = "sawtooth"; o2.type = "triangle"; }
      var base = type === "car" ? 42 : type === "home" ? 180 : type === "arm" ? 26 : 55;
      o1.frequency.value = base; o2.frequency.value = base * 1.02 + 1;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(c.destination);
      o1.start(); o2.start();
      motor = { o1: o1, o2: o2, f: f, g: g, type: type, base: base };
    } catch (e) { motor = null; }
    return motor;
  }
  function motorSet(type, v) {
    var m = motorEnsure(type);
    if (!m) return;
    if (v < 0) v = 0; else if (v > 1) v = 1;
    var t = ctx.currentTime;
    m.g.gain.setTargetAtTime(0.006 + v * 0.045, t, 0.06);
    var fq = m.base * (0.7 + 1.6 * v);
    m.o1.frequency.setTargetAtTime(fq, t, 0.08);
    m.o2.frequency.setTargetAtTime(fq * 1.02 + 1.5, t, 0.08);
    m.f.frequency.setTargetAtTime(200 + 900 * v, t, 0.08);
  }
  function motorIdle() {
    if (!motor || !ctx) return;
    motor.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
  }

  // ---- R6: per-world ambience beds -----------------------------------------
  var bed = null;         // live node graph
  var desiredBed = null;  // { world, base } requested before audio unlocked
  function bedStop() {
    if (!bed) return;
    try { bed.src.stop(); } catch (e) { void e; }
    if (bed.lfo) { try { bed.lfo.stop(); } catch (e) { void e; } }
    (bed.extra || []).forEach(function (n) { try { n.stop(); } catch (e) { void e; } });
    if (bed.iv) { try { clearInterval(bed.iv); } catch (e) { void e; } }
    try { bed.g.disconnect(); } catch (e) { void e; }
    (bed.gains || []).forEach(function (g) { try { g.disconnect(); } catch (e) { void e; } });
    bed = null;
  }
  function bedStart(world, base) {
    var c = ctx;
    if (!c || c.state !== "running" || muted) return;
    bedStop();
    try {
      // Space is a vacuum: honest silence, no bed at all.
      var cfg = base === "underwater" ? { t: "lowpass", fq: world === "mariana" ? 110 : 220, gain: 0.02, brown: true }
        : base === "room" ? { t: "lowpass", fq: 150, gain: 0.008, brown: true }
          : base === "city" ? { t: "bandpass", fq: 420, gain: 0.011, brown: false }
            : base === "mars" ? { t: "bandpass", fq: 640, gain: 0.013, brown: false }
              : base === "earth" ? { t: "bandpass", fq: 520, gain: 0.01, brown: false }
                : null;
      if (!cfg) return;
      var src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 2, cfg.brown);
      src.loop = true;
      var f = c.createBiquadFilter();
      f.type = cfg.t; f.frequency.value = cfg.fq; f.Q.value = base === "city" ? 0.5 : 0.7;
      var g = c.createGain(); g.gain.value = 0.0001;
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start();
      g.gain.setTargetAtTime(cfg.gain, c.currentTime, 0.8);
      bed = { src: src, f: f, g: g, extra: [], gains: [], world: world };
      // The wind breathes: a very slow LFO wobbles the filter centre.
      var lfo = c.createOscillator(); lfo.frequency.value = 0.13;
      var lg = c.createGain(); lg.gain.value = cfg.fq * 0.35;
      lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      bed.lfo = lfo; bed.gains.push(lg);
      if (base === "city") {
        // Mains hum under the noise, and a traffic swell that follows the
        // shared agent sim: louder as the nearest car passes, stereo-panned
        // toward it. Polled at 4 Hz -- no per-frame work.
        var hum = c.createOscillator(); hum.type = "sine"; hum.frequency.value = 50;
        var hg = c.createGain(); hg.gain.value = 0.004;
        hum.connect(hg); hg.connect(c.destination); hum.start();
        var sw = c.createBufferSource(); sw.buffer = noiseBuffer(c, 2, false); sw.loop = true;
        var sf = c.createBiquadFilter(); sf.type = "bandpass"; sf.frequency.value = 280; sf.Q.value = 0.6;
        var sg = c.createGain(); sg.gain.value = 0.0001;
        var pan = c.createStereoPanner ? c.createStereoPanner() : null;
        sw.connect(sf); sf.connect(sg);
        if (pan) { sg.connect(pan); pan.connect(c.destination); } else { sg.connect(c.destination); }
        sw.start();
        var iv = setInterval(function () {
          try {
            if (!bed || muted) return;
            var KA = window.KodroAgents, rov = window.KODRO_ROVER;
            if (!KA || !KA.list) return;
            var L = KA.list(), best = null, bd = 1e9;
            for (var i = 0; i < L.length; i++) {
              var a = L[i];
              if (a.kind !== "car") continue;
              var dd = Math.hypot(a.x - (rov ? rov.x : 0), a.y - (rov ? rov.y : 0));
              if (dd < bd) { bd = dd; best = a; }
            }
            var t2 = c.currentTime;
            var lvl = best ? Math.max(0, 1 - bd / 900) * Math.min(1, (best.vel || 0) / 240) : 0;
            sg.gain.setTargetAtTime(0.001 + lvl * 0.02, t2, 0.2);
            if (pan && best) pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, (best.x - (rov ? rov.x : 0)) / 600)), t2, 0.25);
          } catch (e) { void e; }
        }, 250);
        bed.extra.push(hum, sw); bed.gains.push(hg, sg); bed.iv = iv;
      }
    } catch (e) { bed = null; }
  }
  function bedKick() {
    if (desiredBed && !bed && !muted && ctx && ctx.state === "running") {
      bedStart(desiredBed.world, desiredBed.base);
    }
  }

  var SFX = {
    move: function () { tone(170, 0.11, "sine", 0.045); },
    turn: function () { tone(330, 0.07, "triangle", 0.05); },
    scan: function () {
      var c = ac(); if (!c) return;
      var t = c.currentTime;
      tone(400, 0.26, "sawtooth", 0.035, t);
      tone(880, 0.26, "sawtooth", 0.025, t);
    },
    beep: function () { tone(680, 0.1, "square", 0.055); },
    led: function () { tone(520, 0.06, "sine", 0.035); },
    say: function () { tone(440, 0.09, "sine", 0.035); },
    pass: function () { seq([523, 659, 784, 1047], "triangle", 0.07, 0.09); },
    fail: function () { seq([392, 330, 262], "sine", 0.06, 0.1); },
    // R6: the crash names what was hit. A wall is a dull thud, a rock is the
    // old crack, metal-on-metal clangs, and hitting a person is a soft thump
    // followed by an urgent double alert (deliberately NOT fun).
    crash: function (detail) {
      var d = detail || "obstacle";
      var c = ac();
      if (d === "wall") { noise(0.22, 0.14); tone(58, 0.34, "sine", 0.09); }
      else if (d === "pedestrian") {
        tone(140, 0.18, "sine", 0.05);
        if (c) { tone(880, 0.1, "square", 0.045, c.currentTime + 0.12); tone(880, 0.1, "square", 0.045, c.currentTime + 0.3); }
      } else if (d === "vehicle" || d === "robot") { noise(0.3, 0.15); tone(331, 0.2, "square", 0.045); tone(196, 0.28, "square", 0.04); }
      else { noise(0.28, 0.16); tone(80, 0.3, "sawtooth", 0.07); }
    },
  };

  window.RLSound = {
    play: function (kind, opt) { try { (SFX[kind] || function () {})(opt); bedKick(); } catch (e) { void e; } },
    // R6: motor loop control. motor(type, v) starts/tunes the voice (v 0..1
    // follows the trapezoid speed profile); motorIdle() lets it fall silent
    // between commands without tearing the node graph down.
    motor: function (type, v) { try { motorSet(type || "rover", v == null ? 0.5 : v); } catch (e) { void e; } },
    motorIdle: function () { try { motorIdle(); } catch (e) { void e; } },
    // R6: per-world ambience. Remembered if audio is still locked and started
    // on the first gesture-driven resume()/play().
    ambience: function (world, base) {
      desiredBed = { world: world, base: base };
      try {
        if (bed && bed.world !== world) bedStop();
        bedKick();
      } catch (e) { void e; }
    },
    setMuted: function (m) {
      muted = !!m;
      try { localStorage.setItem("or_muted", muted ? "1" : "0"); } catch (e) {}
      if (muted) { bedStop(); motorKill(); }
      else this.resume();
    },
    isMuted: function () { return muted; },
    resume: function () {
      var c = ac();
      if (c && c.state === "suspended") {
        try { c.resume().then(function () { bedKick(); }); } catch (e) { void e; }
      } else { bedKick(); }
    },
  };
})();
