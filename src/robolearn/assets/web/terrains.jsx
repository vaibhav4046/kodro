/* ============================================================================
   ORBITAL ROVER — terrains
   Each terrain defines: accent color, telemetry environment (gravity, temp,
   pressure, light), a static backdrop layer, a camera-tracked ground layer,
   ambient particles, and a deterministic obstacle field used by the live
   distance sensor and collision detection.
   Exposes: window.TERRAINS, window.TerrainBackdrop, window.TerrainGround
   ========================================================================== */
(function () {
  const { useMemo } = React;

  // simple seeded RNG
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // World half-extent; arena walls sit at ±WALL (cm). Rover starts at (0,0).
  const WALL = 1500;

  function genObstacles(seed, count, minR, maxR) {
    const r = rng(seed);
    const out = [];
    let guard = 0;
    while (out.length < count && guard++ < 2000) {
      const ang = r() * Math.PI * 2;
      const dist = 240 + r() * (WALL - 360);
      const x = Math.cos(ang) * dist;
      const y = Math.sin(ang) * dist;
      const rad = minR + r() * (maxR - minR);
      // keep a clear starting corridor
      if (Math.hypot(x, y) < 220) continue;
      let ok = true;
      for (const o of out) if (Math.hypot(o.x - x, o.y - y) < o.r + rad + 90) { ok = false; break; }
      if (ok) out.push({ x, y, r: rad, rot: r() * 360, v: r() });
    }
    return out;
  }

  // Decorative micro-features (pebbles, tufts, ripples, shells, micro-craters).
  // Purely visual -- they are NOT in the obstacles array, so they never
  // collide; they just make the ground read like a real place.
  function genDecor(seed, count) {
    const r = rng(seed);
    const out = [];
    for (let i = 0; i < count; i++) {
      const ang = r() * Math.PI * 2;
      const dist = 120 + r() * (WALL - 160);
      out.push({
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist,
        r: 5 + r() * 14,
        rot: r() * 360,
        v: r(),
      });
    }
    return out;
  }

  const TERRAINS = {
    earth: {
      id: 'earth', name: 'Earth', label: 'EARTH', coord: '48.8566° N, 2.3522° E',
      accent: '#7cc49b', dot: '#7cc49b',
      env: { gravity: 9.81, temp: 18, tempLabel: 'AIR TEMP', pressure: 1.0, pressureLabel: 'PRESSURE', pressureUnit: 'atm', light: 92 },
      traction: 1.0, obstacleLabel: 'BOULDER',
      obstacles: genObstacles(7, 14, 46, 96),
      decor: genDecor(101, 44),
      backdrop: 'earth'
    },
    mars: {
      id: 'mars', name: 'Mars', label: 'MARS', coord: '18.4470° N, 77.4508° E',
      accent: '#d98b6a', dot: '#c8685a',
      env: { gravity: 3.71, temp: -63, tempLabel: 'SURFACE TEMP', pressure: 0.006, pressureLabel: 'PRESSURE', pressureUnit: 'atm', light: 43 },
      traction: 0.82, obstacleLabel: 'RILLE ROCK',
      obstacles: genObstacles(21, 17, 40, 104),
      decor: genDecor(102, 52),
      backdrop: 'mars'
    },
    underwater: {
      id: 'underwater', name: 'Abyssal', label: 'UNDERWATER', coord: '11.3733° N, 142.5917° E',
      accent: '#5ce0d8', dot: '#5ce0d8',
      env: { gravity: 9.81, temp: 3, tempLabel: 'WATER TEMP', pressure: 38, pressureLabel: 'DEPTH', pressureUnit: 'm', light: 12 },
      traction: 0.66, obstacleLabel: 'CORAL HEAD',
      obstacles: genObstacles(48, 15, 50, 110),
      decor: genDecor(103, 46),
      backdrop: 'underwater'
    },
    space: {
      id: 'space', name: 'Lunar', label: 'SPACE', coord: '0.6741° N, 23.4730° E',
      accent: '#aeb8e8', dot: '#aeb8e8',
      env: { gravity: 1.62, temp: -173, tempLabel: 'SURFACE TEMP', pressure: 0, pressureLabel: 'VACUUM', pressureUnit: 'Pa', light: 100 },
      traction: 1.18, obstacleLabel: 'EJECTA BLOCK',
      obstacles: genObstacles(77, 15, 44, 100),
      decor: genDecor(104, 50),
      backdrop: 'space'
    }
  };
  TERRAINS.WALL = WALL;

  // ----------------------------------------------------------------------
  // Base fill (sits behind everything; mostly covered by the tilted ground)
  // ----------------------------------------------------------------------
  const BASE_FILL = {
    earth: 'linear-gradient(180deg, #2c4426 0%, #1c2e1f 100%)',
    mars: 'linear-gradient(180deg, #5e2a1c 0%, #2e1610 100%)',
    underwater: 'linear-gradient(180deg, #07293a 0%, #04161f 100%)',
    space: 'radial-gradient(ellipse at 70% 18%, #11142a 0%, #07080f 70%, #050509 100%)'
  };
  function TerrainBackdrop({ terrain }) {
    return <div className="bd" style={{ position: 'absolute', inset: 0, background: BASE_FILL[terrain.id] }}></div>;
  }

  // ----------------------------------------------------------------------
  // Sky band — screen-space horizon (gradient + celestial + stars), painted
  // over the far/receding ground and feathered into it at the bottom.
  // ----------------------------------------------------------------------
  const SKY_GRAD = {
    earth: 'linear-gradient(180deg, #5d86b6 0%, #8fb0c2 55%, #b6cdba 100%)',
    mars: 'linear-gradient(180deg, #5a2415 0%, #8a4026 60%, #a85636 100%)',
    underwater: 'linear-gradient(180deg, #0c5066 0%, #0b3a4c 60%, #0a2a38 100%)',
    space: 'linear-gradient(180deg, #06070d 0%, #0b0e1f 70%, #11142a 100%)'
  };

  function TerrainSky({ terrain }) {
    const id = terrain.id;
    const stars = useMemo(() => {
      const r = rng(99);
      return Array.from({ length: 90 }, () => ({
        x: r() * 100, y: r() * 78, s: r() * 1.7 + 0.3, o: 0.3 + r() * 0.7, tw: 2 + r() * 5, delay: -r() * 6
      }));
    }, []);

    let celestial = null, glow = null;
    if (id === 'space') {
      celestial = (
        <div className="celestial" style={{
          right: '9%', top: '14%', width: 150, height: 150,
          background: 'radial-gradient(circle at 38% 36%, #cfe0ff 0%, #6c95cf 36%, #305285 60%, #16294e 80%, #0a1530 100%)',
          boxShadow: 'inset -14px -10px 36px rgba(0,0,0,0.6), 0 0 70px rgba(90,140,210,0.35)'
        }}>
          <div style={{ position: 'absolute', left: '22%', top: '32%', width: '32%', height: '18%', borderRadius: '50%', background: 'rgba(120,200,160,0.4)', filter: 'blur(4px)' }}></div>
          <div style={{ position: 'absolute', left: '54%', top: '54%', width: '24%', height: '15%', borderRadius: '50%', background: 'rgba(120,200,160,0.3)', filter: 'blur(4px)' }}></div>
        </div>
      );
    } else if (id === 'mars') {
      celestial = <div className="celestial" style={{ right: '22%', top: '26%', width: 46, height: 46, background: 'radial-gradient(circle at 45% 45%, #fff4e2, #f0cfa0 55%, rgba(240,200,150,0) 80%)' }}></div>;
      glow = 'radial-gradient(ellipse at 78% 30%, rgba(255,200,150,0.3), transparent 55%)';
    } else if (id === 'earth') {
      celestial = <div className="celestial" style={{ right: '16%', top: '20%', width: 92, height: 92, background: 'radial-gradient(circle at 45% 45%, #fffdf2, #fff0c2 50%, rgba(255,230,160,0) 74%)', filter: 'blur(1px)' }}></div>;
      glow = 'radial-gradient(ellipse at 80% 36%, rgba(255,245,210,0.32), transparent 50%)';
    } else {
      glow = 'radial-gradient(ellipse at 50% -10%, rgba(150,225,235,0.4), transparent 60%)';
    }

    return (
      <div className="sky-band" style={{ background: SKY_GRAD[id] }}>
        {id === 'space' && stars.map((s, i) => (
          <span key={i} style={{
            left: s.x + '%', top: s.y + '%', width: s.s, height: s.s, position: 'absolute',
            borderRadius: '99px', background: '#fff', opacity: s.o, animation: `twk ${s.tw}s ease-in-out ${s.delay}s infinite`
          }}></span>
        ))}
        {id === 'underwater' && (
          <div className="shafts">
            <i style={{ left: '14%' }}></i>
            <i style={{ left: '40%', animationDelay: '-3s' }}></i>
            <i style={{ left: '64%', animationDelay: '-6s' }}></i>
            <i style={{ left: '86%', animationDelay: '-1.5s' }}></i>
          </div>
        )}
        {celestial}
        {glow && <div style={{ position: 'absolute', inset: 0, background: glow }}></div>}
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // Foreground ambient particles drifting over the whole scene.
  // ----------------------------------------------------------------------
  function TerrainAmbient({ terrain }) {
    const id = terrain.id;
    const motes = useMemo(() => {
      const r = rng(id === 'mars' ? 5 : id === 'underwater' ? 9 : 23);
      return Array.from({ length: id === 'space' ? 0 : 40 }, () => ({
        x: r() * 100, y: r() * 100, s: 0.8 + r() * 2.4,
        d: 7 + r() * 14, delay: -r() * 16, drift: (r() - 0.5) * 50
      }));
    }, [id]);
    if (!motes.length) return null;
    return (
      <div className="ambient-fg">
        {motes.map((m, i) => {
          if (id === 'underwater') {
            return <span key={i} className="bubble" style={{
              left: m.x + '%', bottom: -10, width: m.s * 2.2, height: m.s * 2.2, position: 'absolute',
              borderRadius: '99px', border: '1px solid rgba(180,230,235,0.5)', background: 'rgba(160,220,230,0.1)',
              animation: `bub ${m.d}s linear ${m.delay}s infinite`, ['--drift']: m.drift + 'px'
            }}></span>;
          }
          return <span key={i} style={{
            left: m.x + '%', top: m.y + '%', width: m.s, height: m.s, position: 'absolute',
            borderRadius: '99px', background: id === 'mars' ? 'rgba(235,180,130,0.5)' : 'rgba(200,225,180,0.4)',
            animation: `dust ${m.d}s linear ${m.delay}s infinite`, ['--drift']: m.drift + 'px'
          }}></span>;
        })}
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // Ground plane content (panned by the camera in Viewport).
  // Renders ground texture + obstacles. Size: big square centered on world 0,0.
  // ----------------------------------------------------------------------
  const GROUND = 3400; // px square (1cm = 1px world unit)

  function groundBg(id) {
    switch (id) {
      case 'earth':
        return {
          background: 'radial-gradient(circle at 40% 35%, #5b7d49, #3c5a32 60%, #2c4426 100%)',
          texture: 'radial-gradient(circle at 30% 30%, rgba(120,150,90,0.5) 0 2px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(90,120,70,0.4) 0 3px, transparent 3px)',
          texSize: '26px 26px'
        };
      case 'mars':
        return {
          background: 'radial-gradient(circle at 45% 40%, #a8533a, #7e3a26 58%, #5c2a1b 100%)',
          texture: 'radial-gradient(circle at 30% 30%, rgba(210,130,90,0.45) 0 2px, transparent 2px), radial-gradient(circle at 65% 70%, rgba(120,55,35,0.5) 0 2.5px, transparent 3px)',
          texSize: '22px 22px'
        };
      case 'underwater':
        return {
          background: 'radial-gradient(circle at 50% 45%, #2a6577, #1c4655 60%, #123442 100%)',
          texture: 'radial-gradient(circle at 35% 35%, rgba(200,225,225,0.18) 0 2px, transparent 3px), radial-gradient(circle at 70% 65%, rgba(20,60,70,0.4) 0 3px, transparent 4px)',
          texSize: '30px 30px'
        };
      default: // space / lunar
        return {
          background: 'radial-gradient(circle at 50% 45%, #4a4c55, #34363f 58%, #25262d 100%)',
          texture: 'radial-gradient(circle at 30% 30%, rgba(180,182,195,0.25) 0 2px, transparent 2px), radial-gradient(circle at 68% 66%, rgba(20,20,26,0.5) 0 2.5px, transparent 3px)',
          texSize: '24px 24px'
        };
    }
  }

  const OB_FILL = {
    earth: 'radial-gradient(circle at 38% 24%, #7d9a60, #45592f 66%, #2c3a20)',
    mars: 'radial-gradient(circle at 38% 24%, #b05a3c, #6b2f1f 68%, #401a10)',
    underwater: 'radial-gradient(circle at 40% 26%, #58a6ac, #2c6068 66%, #173a42)',
    space: 'radial-gradient(circle at 40% 26%, #797b86, #44464e 66%, #282a30)'
  };
  const CRATER_FILL = {
    earth: 'radial-gradient(circle at 50% 42%, #28361d, #3c5028 62%, #51683a)',
    mars: 'radial-gradient(circle at 50% 42%, #3a190f, #5e2818 60%, #84402a)',
    underwater: 'radial-gradient(circle at 50% 42%, #102a31, #1c4651 60%, #2e6470)',
    space: 'radial-gradient(circle at 50% 42%, #1c1d23, #303138 60%, #54565f)'
  };

  function Obstacle({ o, terrain }) {
    const id = terrain.id;
    const size = o.r * 2;
    const cx = GROUND / 2 + o.x, cy = GROUND / 2 + o.y;

    // ~32% of features are flat craters (lie on the ground); rest stand up as rocks
    if (o.v < 0.32) {
      return (
        <div style={{
          position: 'absolute', left: cx - o.r, top: cy - o.r, width: size, height: size,
          borderRadius: '50%', background: CRATER_FILL[id],
          boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.55), inset 0 -3px 8px rgba(255,255,255,0.10)',
          border: '1px solid rgba(0,0,0,0.22)', transform: `rotate(${o.rot}deg)`
        }}></div>
      );
    }

    const h = size; // billboard stands ~as tall as wide
    return (
      <div className="obstacle" style={{ position: 'absolute', left: cx - o.r, top: cy - h, width: size, height: h }}>
        <div className="ob-shadow" style={{ left: '50%', top: '100%', width: size * 1.25, height: o.r * 1.1 }}></div>
        <div className="ob-body" style={{
          transform: `rotateZ(calc(-1 * var(--yaw, 0deg))) rotateX(calc(-1 * var(--tilt, 46deg)))`,
          background: OB_FILL[id],
          borderRadius: id === 'underwater' ? '46% 54% 44% 56% / 64% 60% 40% 36%' : '48% 52% 50% 50% / 60% 58% 42% 40%'
        }}>
          <div className="ob-spec"></div>
        </div>
      </div>
    );
  }

  // Per-terrain decorative micro-feature (visual only; never collides).
  function Decor({ d, id }) {
    const cx = GROUND / 2 + d.x, cy = GROUND / 2 + d.y;
    const base = { position: 'absolute', pointerEvents: 'none', transform: `rotate(${d.rot}deg)` };
    if (id === 'earth') {
      // grass tuft (v<0.55) or pebble
      if (d.v < 0.55) {
        return <div style={{ ...base, left: cx, top: cy, width: 2, height: d.r * 1.4, borderRadius: 2, background: 'linear-gradient(180deg, #86a861, #4c6436)', boxShadow: '3px 1px 0 -0.5px #6d8c4e, -3px 2px 0 -0.5px #5a7440' }}></div>;
      }
      return <div style={{ ...base, left: cx - d.r / 2, top: cy - d.r / 3, width: d.r, height: d.r * 0.66, borderRadius: '50%', background: 'radial-gradient(circle at 38% 30%, #74875c, #44522f)' }}></div>;
    }
    if (id === 'mars') {
      // wind ripple (v<0.5) or pebble
      if (d.v < 0.5) {
        return <div style={{ ...base, left: cx - d.r, top: cy, width: d.r * 2.6, height: 2, borderRadius: 2, background: 'linear-gradient(90deg, transparent, rgba(220,140,95,0.5), transparent)' }}></div>;
      }
      return <div style={{ ...base, left: cx - d.r / 2, top: cy - d.r / 3, width: d.r, height: d.r * 0.6, borderRadius: '50%', background: 'radial-gradient(circle at 36% 28%, #b06245, #69311e)' }}></div>;
    }
    if (id === 'underwater') {
      // sand ripple (v<0.45), shell (v<0.75) or coral speck
      if (d.v < 0.45) {
        return <div style={{ ...base, left: cx - d.r, top: cy, width: d.r * 2.4, height: 2, borderRadius: 2, background: 'linear-gradient(90deg, transparent, rgba(180,215,215,0.28), transparent)' }}></div>;
      }
      if (d.v < 0.75) {
        return <div style={{ ...base, left: cx - d.r / 2, top: cy - d.r / 2, width: d.r * 0.9, height: d.r * 0.7, borderRadius: '60% 60% 45% 45%', background: 'radial-gradient(circle at 40% 25%, #d8d4c2, #8d8a78)' }}></div>;
      }
      return <div style={{ ...base, left: cx - d.r / 2, top: cy - d.r / 2, width: d.r * 0.7, height: d.r * 0.7, borderRadius: '50%', background: 'radial-gradient(circle at 40% 30%, #5ca6ac, #2c5a62)' }}></div>;
    }
    // space: micro-crater (v<0.6) or regolith speck
    if (d.v < 0.6) {
      return <div style={{ ...base, left: cx - d.r / 2, top: cy - d.r / 2, width: d.r, height: d.r, borderRadius: '50%', background: CRATER_FILL.space, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), inset 0 -1px 3px rgba(255,255,255,0.08)' }}></div>;
    }
    return <div style={{ ...base, left: cx - d.r / 3, top: cy - d.r / 3, width: d.r * 0.6, height: d.r * 0.5, borderRadius: '50%', background: 'radial-gradient(circle at 38% 30%, #84868f, #4a4c54)' }}></div>;
  }

  function TerrainGround({ terrain, children, showGrid }) {
    const g = groundBg(terrain.id);
    return (
      <div className="ground" style={{
        position: 'absolute', left: -GROUND / 2, top: -GROUND / 2, width: GROUND, height: GROUND,
        background: g.background, borderRadius: 8
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: g.texture, backgroundSize: g.texSize, opacity: 0.6, borderRadius: 8 }}></div>
        {showGrid !== false ? <div className="ground-grid"></div> : null}
        {/* arena boundary */}
        <div style={{
          position: 'absolute', left: GROUND / 2 - WALL, top: GROUND / 2 - WALL, width: WALL * 2, height: WALL * 2,
          border: '2px dashed ' + terrain.accent, opacity: 0.2, borderRadius: 12, pointerEvents: 'none'
        }}></div>
        {(terrain.decor || []).map((d, i) => <Decor key={'d' + i} d={d} id={terrain.id} />)}
        {/* trail canvas slot */}
        {children}
        {terrain.obstacles.map((o, i) => <Obstacle key={i} o={o} terrain={terrain} />)}
      </div>
    );
  }

  window.TERRAINS = TERRAINS;
  window.TERRAIN_GROUND = GROUND;
  window.TerrainBackdrop = TerrainBackdrop;
  window.TerrainSky = TerrainSky;
  window.TerrainAmbient = TerrainAmbient;
  window.TerrainGround = TerrainGround;
})();
