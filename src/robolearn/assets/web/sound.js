/* RoboLearn sound design — synthesised offline with the Web Audio API.
 * No audio files, no network: every cue is generated from oscillators +
 * noise, so it ships inside the app and works on a locked-down machine.
 * Exposes window.RLSound. Respects a mute flag and only starts the
 * AudioContext after a user gesture (browsers block autoplay).
 */
(function () {
  "use strict";
  var ctx = null;
  var muted = (function () {
    try { return localStorage.getItem("or_muted") === "1"; } catch (e) { return false; }
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
    crash: function () { noise(0.28, 0.16); tone(80, 0.3, "sawtooth", 0.07); },
  };

  window.RLSound = {
    play: function (kind) { try { (SFX[kind] || function () {})(); } catch (e) {} },
    setMuted: function (m) {
      muted = !!m;
      try { localStorage.setItem("or_muted", muted ? "1" : "0"); } catch (e) {}
      if (!muted) this.resume();
    },
    isMuted: function () { return muted; },
    resume: function () { var c = ac(); if (c && c.state === "suspended") c.resume(); },
  };
})();
