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
  // Mission sites: REAL places with real physics. Each derives from a base
  // terrain renderer but overrides the environment (gravity, temperature,
  // pressure, light), traction and the obstacle field -- so the same program
  // behaves differently in the Sahara, under the Mariana Trench, or on
  // Europa, and the pupil can SEE and MEASURE why.
  // ----------------------------------------------------------------------
  const SITES = {
    sahara: {
      base: 'earth', label: 'SAHARA', name: 'Sahara Desert',
      coord: '23.4162° N, 25.6628° E',
      env: { temp: 38, tempLabel: 'AIR TEMP', light: 100 },
      traction: 0.74,  // loose sand slips
      seed: 201, count: 10, minR: 40, maxR: 80, decorSeed: 211, decorCount: 64,
      groundBg: {
        background: 'radial-gradient(circle at 42% 38%, #d9b36c, #b08a4a 58%, #8a6a36 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(245,215,150,0.5) 0 2px, transparent 2px), radial-gradient(circle at 68% 64%, rgba(140,105,60,0.45) 0 2.5px, transparent 3px)',
        texSize: '24px 24px',
      },
      obFill: 'radial-gradient(circle at 38% 24%, #d6ab64, #94703c 66%, #5e472a)',
    },
    amazon: {
      base: 'earth', label: 'AMAZON', name: 'Amazon Rainforest',
      coord: '3.4653° S, 62.2159° W',
      env: { temp: 27, light: 38 },  // canopy shade
      traction: 0.68,  // mud + roots
      seed: 202, count: 22, minR: 44, maxR: 100, decorSeed: 212, decorCount: 70,
      groundBg: {
        background: 'radial-gradient(circle at 40% 35%, #38522c, #243a1e 58%, #182a16 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(90,130,70,0.5) 0 2.5px, transparent 3px), radial-gradient(circle at 70% 60%, rgba(20,40,18,0.55) 0 3px, transparent 4px)',
        texSize: '26px 26px',
      },
      obFill: 'radial-gradient(circle at 38% 24%, #5d8a44, #2e4a22 66%, #1c2f16)',
    },
    antarctica: {
      base: 'earth', label: 'ANTARCTICA', name: 'Antarctica - Ross Ice Shelf',
      coord: '81.5000° S, 175.0000° W',
      env: { temp: -55, light: 88 },
      traction: 0.45,  // ICE: drives slow, drains hard
      seed: 203, count: 8, minR: 50, maxR: 110, decorSeed: 213, decorCount: 40,
      groundBg: {
        background: 'radial-gradient(circle at 44% 38%, #eef3f8, #c6d6e4 56%, #93acc2 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(255,255,255,0.7) 0 2px, transparent 2.5px), radial-gradient(circle at 68% 62%, rgba(130,160,190,0.4) 0 3px, transparent 4px)',
        texSize: '30px 30px',
      },
      obFill: 'radial-gradient(circle at 38% 24%, #e8f2fa, #a9c2d6 64%, #6e8ba2)',
    },
    india: {
      base: 'earth', label: 'INDIA', name: 'India - Thar Desert, Rajasthan',
      coord: '27.0238° N, 70.0000° E',
      env: { temp: 42, light: 100 },
      traction: 0.7,  // dry scrub + sand
      seed: 301, count: 14, minR: 40, maxR: 86, decorSeed: 311, decorCount: 60,
      groundBg: {
        background: 'radial-gradient(circle at 42% 38%, #e3b878, #c08a4c 56%, #95673a 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(245,210,150,0.45) 0 2px, transparent 2px), radial-gradient(circle at 68% 64%, rgba(150,105,60,0.4) 0 2.5px, transparent 3px)',
        texSize: '24px 24px',
      },
      obFill: 'radial-gradient(circle at 38% 24%, #d9a85e, #9a6e38 66%, #5f4424)',
    },
    kenya: {
      base: 'earth', label: 'KENYA', name: 'Kenya - Maasai Mara Savanna',
      coord: '1.4910° S, 35.1430° E',
      env: { temp: 29, light: 96 },
      traction: 0.82,  // firm dry grass
      seed: 302, count: 16, minR: 42, maxR: 92, decorSeed: 312, decorCount: 66,
      groundBg: {
        background: 'radial-gradient(circle at 40% 36%, #c7b15e, #9c8a3e 58%, #6f6228 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(210,200,120,0.5) 0 2px, transparent 2.5px), radial-gradient(circle at 70% 62%, rgba(110,98,40,0.45) 0 3px, transparent 4px)',
        texSize: '26px 26px',
      },
      obFill: 'radial-gradient(circle at 38% 24%, #b8a24e, #756328 66%, #46401a)',
    },
    japan: {
      base: 'earth', label: 'JAPAN', name: 'Japan - Mount Fuji Slopes',
      coord: '35.3606° N, 138.7274° E',
      env: { temp: 8, light: 80 },
      traction: 0.6,  // volcanic ash + scree
      seed: 303, count: 13, minR: 46, maxR: 100, decorSeed: 313, decorCount: 50,
      groundBg: {
        background: 'radial-gradient(circle at 44% 40%, #5a5560, #3c3842 58%, #26232c 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(200,196,206,0.3) 0 2px, transparent 2.5px), radial-gradient(circle at 68% 62%, rgba(30,28,34,0.5) 0 3px, transparent 4px)',
        texSize: '24px 24px',
      },
      obFill: 'radial-gradient(circle at 38% 24%, #6a6470, #403c48 66%, #232029)',
    },
    egypt: {
      base: 'earth', label: 'EGYPT', name: 'Egypt - Giza Plateau',
      coord: '29.9792° N, 31.1342° E',
      env: { temp: 36, light: 100 },
      traction: 0.72,
      seed: 304, count: 11, minR: 44, maxR: 96, decorSeed: 314, decorCount: 52,
      groundBg: {
        background: 'radial-gradient(circle at 42% 38%, #e6cf9a, #cbab6e 58%, #a3814a 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(250,235,190,0.45) 0 2px, transparent 2px), radial-gradient(circle at 68% 64%, rgba(160,125,75,0.4) 0 2.5px, transparent 3px)',
        texSize: '24px 24px',
      },
      obFill: 'radial-gradient(circle at 38% 24%, #ddc184, #a8824c 66%, #6a512c)',
    },
    iceland: {
      base: 'earth', label: 'ICELAND', name: 'Iceland - Lava Field',
      coord: '64.8000° N, 17.6700° W',
      env: { temp: 4, light: 74 },
      traction: 0.55,  // jagged basalt
      seed: 305, count: 18, minR: 48, maxR: 108, decorSeed: 315, decorCount: 44,
      groundBg: {
        background: 'radial-gradient(circle at 44% 40%, #3a3a40, #26262b 58%, #161619 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(120,150,120,0.22) 0 2px, transparent 2.5px), radial-gradient(circle at 68% 62%, rgba(10,10,12,0.55) 0 3px, transparent 4px)',
        texSize: '22px 22px',
      },
      obFill: 'radial-gradient(circle at 38% 24%, #4a4a52, #28282e 66%, #131316)',
    },
    nepal: {
      base: 'earth', label: 'NEPAL', name: 'Nepal - Himalayan Foothills',
      coord: '28.0000° N, 84.0000° E',
      env: { temp: -6, light: 90 },
      traction: 0.5,  // snow-dusted rock
      seed: 306, count: 12, minR: 50, maxR: 112, decorSeed: 316, decorCount: 38,
      groundBg: {
        background: 'radial-gradient(circle at 44% 40%, #cdd6dd, #9fb0bd 56%, #748794 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(255,255,255,0.6) 0 2px, transparent 2.5px), radial-gradient(circle at 68% 62%, rgba(110,135,155,0.4) 0 3px, transparent 4px)',
        texSize: '28px 28px',
      },
      obFill: 'radial-gradient(circle at 38% 24%, #d7e0e8, #9fb2bf 64%, #6b8090)',
    },
    reef: {
      base: 'underwater', label: 'CORAL REEF', name: 'Great Barrier Reef',
      coord: '18.2871° S, 147.6992° E',
      env: { temp: 24, pressure: 12, pressureLabel: 'DEPTH', pressureUnit: 'm', light: 62 },
      traction: 0.72,
      seed: 204, count: 20, minR: 44, maxR: 96, decorSeed: 214, decorCount: 64,
      groundBg: {
        background: 'radial-gradient(circle at 48% 42%, #3f96a4, #2a7080 58%, #1c5260 100%)',
        texture: 'radial-gradient(circle at 35% 35%, rgba(230,245,245,0.35) 0 2px, transparent 3px), radial-gradient(circle at 70% 65%, rgba(20,70,80,0.4) 0 3px, transparent 4px)',
        texSize: '26px 26px',
      },
      obFill: 'radial-gradient(circle at 40% 26%, #e08a96, #a04a62 66%, #5e2a3c)',
    },
    mariana: {
      base: 'underwater', label: 'MARIANA', name: 'Mariana Trench - Challenger Deep',
      coord: '11.3733° N, 142.5917° E',
      env: { temp: 2, pressure: 10994, pressureLabel: 'DEPTH', pressureUnit: 'm', light: 0 },
      traction: 0.6,
      seed: 205, count: 9, minR: 52, maxR: 116, decorSeed: 215, decorCount: 34,
      groundBg: {
        background: 'radial-gradient(circle at 50% 45%, #14303e, #0c2030 60%, #061420 100%)',
        texture: 'radial-gradient(circle at 35% 35%, rgba(120,160,170,0.16) 0 2px, transparent 3px)',
        texSize: '32px 32px',
      },
      obFill: 'radial-gradient(circle at 40% 26%, #3c5a66, #1e3540 66%, #101e26)',
    },
    olympus: {
      base: 'mars', label: 'OLYMPUS MONS', name: 'Mars - Olympus Mons',
      coord: '18.6500° N, 226.2000° E',
      env: { temp: -73, light: 40 },
      traction: 0.8,
      seed: 206, count: 17, minR: 42, maxR: 104, decorSeed: 216, decorCount: 56,
      groundBg: {
        background: 'radial-gradient(circle at 45% 40%, #8a4630, #66301e 58%, #481f12 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(190,110,80,0.45) 0 2px, transparent 2px), radial-gradient(circle at 65% 70%, rgba(80,35,20,0.5) 0 2.5px, transparent 3px)',
        texSize: '22px 22px',
      },
    },
    tycho: {
      base: 'space', label: 'TYCHO', name: 'Moon - Tycho Crater',
      coord: '43.3100° S, 11.3600° W',
      env: { gravity: 1.62, temp: -173, light: 100 },
      traction: 1.18,
      seed: 207, count: 14, minR: 44, maxR: 100, decorSeed: 217, decorCount: 52,
    },
    europa: {
      base: 'space', label: 'EUROPA', name: 'Jupiter - Europa Ice Crust',
      coord: '9.1000° S, 152.8000° W',
      env: { gravity: 1.315, temp: -160, light: 4 },
      traction: 0.5,  // moon-ice
      seed: 208, count: 12, minR: 46, maxR: 102, decorSeed: 218, decorCount: 44,
      groundBg: {
        background: 'radial-gradient(circle at 46% 40%, #cfdcea, #9fb4ca 56%, #6c8098 100%)',
        texture: 'linear-gradient(115deg, transparent 48%, rgba(120,90,80,0.25) 49%, transparent 51%), radial-gradient(circle at 34% 34%, rgba(255,255,255,0.5) 0 2px, transparent 2.5px)',
        texSize: '64px 64px, 28px 28px',
      },
      obFill: 'radial-gradient(circle at 38% 24%, #e2ecf6, #a2b8cc 64%, #66809a)',
    },
  };

  // Resolve a terrain OR site id into a renderable terrain object.
  function resolveSite(id) {
    if (TERRAINS[id]) return TERRAINS[id];
    const s = SITES[id];
    if (!s) return TERRAINS.earth;
    const base = TERRAINS[s.base];
    return {
      ...base,
      siteId: id,
      label: s.label,
      name: s.name,
      coord: s.coord,
      env: { ...base.env, ...s.env },
      traction: s.traction != null ? s.traction : base.traction,
      obstacles: genObstacles(s.seed, s.count, s.minR, s.maxR),
      decor: genDecor(s.decorSeed, s.decorCount),
      groundBg: s.groundBg || null,
      obFill: s.obFill || null,
    };
  }
  window.SITES = SITES;
  window.resolveSite = resolveSite;

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
          background: terrain.obFill || OB_FILL[id],
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

  // ----------------------------------------------------------------------
  // Real-world Earth landscape: farmland patchwork, forests, roads and a
  // meandering river painted across the ground square. Purely decorative --
  // none of it collides; it just makes the base Earth read like a map you
  // could fly over. Only the temperate base Earth gets it (not the Sahara,
  // Amazon or Antarctica sites, where farmland and rivers would be wrong).
  // ----------------------------------------------------------------------
  const FIELD_FILL = [
    '#6f8f4e', '#7ba055', '#c9b067', '#8a6b46', '#9bbf6a', '#93925a', '#5f8048', '#b6a85e',
  ];
  function EarthFeatures() {
    const { fields, forests } = useMemo(() => {
      const r = rng(404);
      const fl = [];
      let guard = 0;
      while (fl.length < 30 && guard++ < 600) {
        const w = 220 + r() * 320, h = 200 + r() * 300;
        const x = r() * (GROUND - w), y = r() * (GROUND - h);
        // leave the rover's start clearing (centre) free of hard patches
        if (Math.abs(x + w / 2 - GROUND / 2) < 260 && Math.abs(y + h / 2 - GROUND / 2) < 260) continue;
        fl.push({ x, y, w, h, c: FIELD_FILL[(r() * FIELD_FILL.length) | 0], rot: (r() - 0.5) * 8, row: 20 + r() * 120 });
      }
      const fo = [];
      for (let i = 0; i < 8; i++) {
        const cx = 200 + r() * (GROUND - 400), cy = 200 + r() * (GROUND - 400);
        const trees = [];
        const n = 12 + ((r() * 10) | 0);
        for (let t = 0; t < n; t++) {
          const a = r() * Math.PI * 2, d = r() * (90 + r() * 80);
          trees.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, s: 13 + r() * 18, v: r() });
        }
        fo.push(trees);
      }
      return { fields: fl, forests: fo };
    }, []);

    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 8, overflow: 'hidden' }}>
        {/* farmland patchwork */}
        {fields.map((f, i) => (
          <div key={'f' + i} style={{
            position: 'absolute', left: f.x, top: f.y, width: f.w, height: f.h,
            background: f.c, opacity: 0.74, transform: `rotate(${f.rot}deg)`,
            backgroundImage: `repeating-linear-gradient(90deg, rgba(0,0,0,0.14) 0 2px, transparent 2px ${f.row}px)`,
            outline: '2.5px solid rgba(40,56,30,0.55)', outlineOffset: -1, borderRadius: 3,
          }}></div>
        ))}
        {/* river + roads */}
        <svg viewBox={`0 0 ${GROUND} ${GROUND}`} width={GROUND} height={GROUND} style={{ position: 'absolute', inset: 0 }}>
          <path d="M 300 -60 C 760 560, 240 1120, 880 1640 S 1500 2680, 1180 3460" fill="none"
            stroke="#2f6ea6" strokeWidth="48" strokeLinecap="round" opacity="0.92" />
          <path d="M 300 -60 C 760 560, 240 1120, 880 1640 S 1500 2680, 1180 3460" fill="none"
            stroke="#8fc3e6" strokeWidth="16" strokeLinecap="round" opacity="0.7" />
          <path d="M -60 1180 Q 1700 940 3460 1340" fill="none" stroke="#cabd96" strokeWidth="22" opacity="0.9" />
          <path d="M 2240 -60 Q 1960 1700 2480 3460" fill="none" stroke="#cabd96" strokeWidth="20" opacity="0.85" />
          <path d="M -60 1180 Q 1700 940 3460 1340" fill="none" stroke="#f0dc8e" strokeWidth="3" strokeDasharray="18 22" opacity="0.85" />
          <path d="M 2240 -60 Q 1960 1700 2480 3460" fill="none" stroke="#f0dc8e" strokeWidth="3" strokeDasharray="18 22" opacity="0.8" />
        </svg>
        {/* forests (drawn last so canopies sit above fields and roads) */}
        {forests.map((trees, i) => (
          <div key={'fo' + i}>
            {trees.map((t, j) => (
              <div key={j} style={{
                position: 'absolute', left: t.x - t.s / 2, top: t.y - t.s / 2, width: t.s, height: t.s,
                borderRadius: '50%', boxShadow: '1px 2px 3px rgba(0,0,0,0.4)',
                background: t.v < 0.5
                  ? 'radial-gradient(circle at 38% 30%, #4e7a3e, #1f3a18)'
                  : 'radial-gradient(circle at 38% 30%, #5f9148, #244a1c)',
              }}></div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  function TerrainGround({ terrain, children, showGrid }) {
    const g = terrain.groundBg || groundBg(terrain.id);
    const isEarth = terrain.id === 'earth';
    return (
      <div className="ground" style={{
        position: 'absolute', left: -GROUND / 2, top: -GROUND / 2, width: GROUND, height: GROUND,
        background: g.background, borderRadius: 8
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: g.texture, backgroundSize: g.texSize, opacity: 0.6, borderRadius: 8 }}></div>
        {isEarth ? <EarthFeatures /> : null}
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
