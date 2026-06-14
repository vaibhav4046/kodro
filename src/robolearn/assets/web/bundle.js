/* AUTO-GENERATED from the .jsx sources by scripts/build_web.cjs. Do not edit. */

;(function () {
/* ============================================================================
   ORBITAL ROVER — terrains
   Each terrain defines: accent color, telemetry environment (gravity, temp,
   pressure, light), a static backdrop layer, a camera-tracked ground layer,
   ambient particles, and a deterministic obstacle field used by the live
   distance sensor and collision detection.
   Exposes: window.TERRAINS, window.TerrainBackdrop, window.TerrainGround
   ========================================================================== */
(function () {
  const {
    useMemo
  } = React;

  // simple seeded RNG
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = s * 1664525 + 1013904223 >>> 0;
      return s / 4294967296;
    };
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
      for (const o of out) if (Math.hypot(o.x - x, o.y - y) < o.r + rad + 90) {
        ok = false;
        break;
      }
      if (ok) out.push({
        x,
        y,
        r: rad,
        rot: r() * 360,
        v: r()
      });
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
        v: r()
      });
    }
    return out;
  }

  // City street: real, collidable furniture (buildings along the edges, parked
  // cars beside the road) laid out around a cross roads with the rover's start
  // clear. Pedestrians and a moving car are added on top as live agents.
  function genCity(seed) {
    const r = rng(seed);
    const out = [];
    // buildings ring the block, well away from the central crossing
    for (let i = 0; i < 10; i++) {
      const ang = i / 10 * Math.PI * 2 + 0.2;
      const dist = 760 + r() * 520;
      const x = Math.cos(ang) * dist,
        y = Math.sin(ang) * dist;
      if (Math.abs(x) < 230 || Math.abs(y) < 230) continue; // keep the roads clear
      out.push({
        x,
        y,
        r: 150 + r() * 90,
        rot: 0,
        v: r(),
        kind: 'building'
      });
    }
    // parked cars line the kerb of the horizontal road
    for (let i = 0; i < 6; i++) {
      const x = -1100 + i * 380 + r() * 40;
      const y = (i % 2 ? 1 : -1) * (250 + r() * 18);
      if (Math.abs(x) < 240) continue; // leave the junction open
      out.push({
        x,
        y,
        r: 70,
        rot: i % 2 ? 92 : 88,
        v: r(),
        kind: 'car'
      });
    }
    return out;
  }
  const TERRAINS = {
    city: {
      id: 'city',
      name: 'Riverside City',
      label: 'CITY',
      coord: '51.5072° N, 0.1276° W',
      accent: '#6fb4e8',
      dot: '#6fb4e8',
      env: {
        gravity: 9.81,
        temp: 16,
        tempLabel: 'AIR TEMP',
        pressure: 1.0,
        pressureLabel: 'PRESSURE',
        pressureUnit: 'atm',
        light: 80
      },
      traction: 0.98,
      obstacleLabel: 'PARKED CAR',
      obstacles: genCity(2027),
      decor: [],
      backdrop: 'city'
    },
    room: {
      id: 'room',
      name: 'Living Room',
      label: 'ROOM',
      coord: 'Indoor test space',
      accent: '#e0a36a',
      dot: '#e0a36a',
      env: {
        gravity: 9.81,
        temp: 21,
        tempLabel: 'ROOM TEMP',
        pressure: 1.0,
        pressureLabel: 'PRESSURE',
        pressureUnit: 'atm',
        light: 70
      },
      traction: 1.05,
      obstacleLabel: 'FURNITURE',
      // A few collidable pieces so a companion robot must navigate the room.
      obstacles: [{
        x: 0,
        y: 720,
        r: 150,
        rot: 0,
        v: 0.2,
        kind: 'sofa'
      }, {
        x: 0,
        y: 60,
        r: 110,
        rot: 0,
        v: 0.5,
        kind: 'table'
      }, {
        x: 840,
        y: -260,
        r: 130,
        rot: 0,
        v: 0.8,
        kind: 'shelf'
      }, {
        x: -880,
        y: -880,
        r: 70,
        rot: 0,
        v: 0.9,
        kind: 'plant'
      }],
      decor: [],
      backdrop: 'room'
    },
    earth: {
      id: 'earth',
      name: 'Earth',
      label: 'EARTH',
      coord: '48.8566° N, 2.3522° E',
      accent: '#7cc49b',
      dot: '#7cc49b',
      env: {
        gravity: 9.81,
        temp: 18,
        tempLabel: 'AIR TEMP',
        pressure: 1.0,
        pressureLabel: 'PRESSURE',
        pressureUnit: 'atm',
        light: 92
      },
      traction: 1.0,
      obstacleLabel: 'BOULDER',
      obstacles: genObstacles(7, 14, 46, 96),
      decor: genDecor(101, 44),
      backdrop: 'earth'
    },
    mars: {
      id: 'mars',
      name: 'Mars',
      label: 'MARS',
      coord: '18.4470° N, 77.4508° E',
      accent: '#d98b6a',
      dot: '#c8685a',
      env: {
        gravity: 3.71,
        temp: -63,
        tempLabel: 'SURFACE TEMP',
        pressure: 0.006,
        pressureLabel: 'PRESSURE',
        pressureUnit: 'atm',
        light: 43
      },
      traction: 0.82,
      obstacleLabel: 'RILLE ROCK',
      obstacles: genObstacles(21, 17, 40, 104),
      decor: genDecor(102, 52),
      backdrop: 'mars'
    },
    underwater: {
      id: 'underwater',
      name: 'Abyssal',
      label: 'UNDERWATER',
      coord: '11.3733° N, 142.5917° E',
      accent: '#5ce0d8',
      dot: '#5ce0d8',
      env: {
        gravity: 9.81,
        temp: 3,
        tempLabel: 'WATER TEMP',
        pressure: 38,
        pressureLabel: 'DEPTH',
        pressureUnit: 'm',
        light: 12
      },
      traction: 0.66,
      obstacleLabel: 'CORAL HEAD',
      obstacles: genObstacles(48, 15, 50, 110),
      decor: genDecor(103, 46),
      backdrop: 'underwater'
    },
    space: {
      id: 'space',
      name: 'Lunar',
      label: 'SPACE',
      coord: '0.6741° N, 23.4730° E',
      accent: '#aeb8e8',
      dot: '#aeb8e8',
      env: {
        gravity: 1.62,
        temp: -173,
        tempLabel: 'SURFACE TEMP',
        pressure: 0,
        pressureLabel: 'VACUUM',
        pressureUnit: 'Pa',
        light: 100
      },
      traction: 1.18,
      obstacleLabel: 'EJECTA BLOCK',
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
      base: 'earth',
      label: 'SAHARA',
      name: 'Sahara Desert',
      coord: '23.4162° N, 25.6628° E',
      env: {
        temp: 38,
        tempLabel: 'AIR TEMP',
        light: 100
      },
      traction: 0.74,
      // loose sand slips
      seed: 201,
      count: 10,
      minR: 40,
      maxR: 80,
      decorSeed: 211,
      decorCount: 64,
      groundBg: {
        background: 'radial-gradient(circle at 42% 38%, #d9b36c, #b08a4a 58%, #8a6a36 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(245,215,150,0.5) 0 2px, transparent 2px), radial-gradient(circle at 68% 64%, rgba(140,105,60,0.45) 0 2.5px, transparent 3px)',
        texSize: '24px 24px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #d6ab64, #94703c 66%, #5e472a)'
    },
    amazon: {
      base: 'earth',
      label: 'AMAZON',
      name: 'Amazon Rainforest',
      coord: '3.4653° S, 62.2159° W',
      env: {
        temp: 27,
        light: 38
      },
      // canopy shade
      traction: 0.68,
      // mud + roots
      seed: 202,
      count: 22,
      minR: 44,
      maxR: 100,
      decorSeed: 212,
      decorCount: 70,
      groundBg: {
        background: 'radial-gradient(circle at 40% 35%, #38522c, #243a1e 58%, #182a16 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(90,130,70,0.5) 0 2.5px, transparent 3px), radial-gradient(circle at 70% 60%, rgba(20,40,18,0.55) 0 3px, transparent 4px)',
        texSize: '26px 26px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #5d8a44, #2e4a22 66%, #1c2f16)'
    },
    antarctica: {
      base: 'earth',
      label: 'ANTARCTICA',
      name: 'Antarctica - Ross Ice Shelf',
      coord: '81.5000° S, 175.0000° W',
      env: {
        temp: -55,
        light: 88
      },
      traction: 0.45,
      // ICE: drives slow, drains hard
      seed: 203,
      count: 8,
      minR: 50,
      maxR: 110,
      decorSeed: 213,
      decorCount: 40,
      groundBg: {
        background: 'radial-gradient(circle at 44% 38%, #eef3f8, #c6d6e4 56%, #93acc2 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(255,255,255,0.7) 0 2px, transparent 2.5px), radial-gradient(circle at 68% 62%, rgba(130,160,190,0.4) 0 3px, transparent 4px)',
        texSize: '30px 30px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #e8f2fa, #a9c2d6 64%, #6e8ba2)'
    },
    india: {
      base: 'earth',
      label: 'INDIA',
      name: 'India - Thar Desert, Rajasthan',
      coord: '27.0238° N, 70.0000° E',
      env: {
        temp: 42,
        light: 100
      },
      traction: 0.7,
      // dry scrub + sand
      seed: 301,
      count: 14,
      minR: 40,
      maxR: 86,
      decorSeed: 311,
      decorCount: 60,
      groundBg: {
        background: 'radial-gradient(circle at 42% 38%, #e3b878, #c08a4c 56%, #95673a 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(245,210,150,0.45) 0 2px, transparent 2px), radial-gradient(circle at 68% 64%, rgba(150,105,60,0.4) 0 2.5px, transparent 3px)',
        texSize: '24px 24px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #d9a85e, #9a6e38 66%, #5f4424)'
    },
    kenya: {
      base: 'earth',
      label: 'KENYA',
      name: 'Kenya - Maasai Mara Savanna',
      coord: '1.4910° S, 35.1430° E',
      env: {
        temp: 29,
        light: 96
      },
      traction: 0.82,
      // firm dry grass
      seed: 302,
      count: 16,
      minR: 42,
      maxR: 92,
      decorSeed: 312,
      decorCount: 66,
      groundBg: {
        background: 'radial-gradient(circle at 40% 36%, #c7b15e, #9c8a3e 58%, #6f6228 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(210,200,120,0.5) 0 2px, transparent 2.5px), radial-gradient(circle at 70% 62%, rgba(110,98,40,0.45) 0 3px, transparent 4px)',
        texSize: '26px 26px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #b8a24e, #756328 66%, #46401a)'
    },
    japan: {
      base: 'earth',
      label: 'JAPAN',
      name: 'Japan - Mount Fuji Slopes',
      coord: '35.3606° N, 138.7274° E',
      env: {
        temp: 8,
        light: 80
      },
      traction: 0.6,
      // volcanic ash + scree
      seed: 303,
      count: 13,
      minR: 46,
      maxR: 100,
      decorSeed: 313,
      decorCount: 50,
      groundBg: {
        background: 'radial-gradient(circle at 44% 40%, #5a5560, #3c3842 58%, #26232c 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(200,196,206,0.3) 0 2px, transparent 2.5px), radial-gradient(circle at 68% 62%, rgba(30,28,34,0.5) 0 3px, transparent 4px)',
        texSize: '24px 24px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #6a6470, #403c48 66%, #232029)'
    },
    egypt: {
      base: 'earth',
      label: 'EGYPT',
      name: 'Egypt - Giza Plateau',
      coord: '29.9792° N, 31.1342° E',
      env: {
        temp: 36,
        light: 100
      },
      traction: 0.72,
      seed: 304,
      count: 11,
      minR: 44,
      maxR: 96,
      decorSeed: 314,
      decorCount: 52,
      groundBg: {
        background: 'radial-gradient(circle at 42% 38%, #e6cf9a, #cbab6e 58%, #a3814a 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(250,235,190,0.45) 0 2px, transparent 2px), radial-gradient(circle at 68% 64%, rgba(160,125,75,0.4) 0 2.5px, transparent 3px)',
        texSize: '24px 24px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #ddc184, #a8824c 66%, #6a512c)'
    },
    iceland: {
      base: 'earth',
      label: 'ICELAND',
      name: 'Iceland - Lava Field',
      coord: '64.8000° N, 17.6700° W',
      env: {
        temp: 4,
        light: 74
      },
      traction: 0.55,
      // jagged basalt
      seed: 305,
      count: 18,
      minR: 48,
      maxR: 108,
      decorSeed: 315,
      decorCount: 44,
      groundBg: {
        background: 'radial-gradient(circle at 44% 40%, #3a3a40, #26262b 58%, #161619 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(120,150,120,0.22) 0 2px, transparent 2.5px), radial-gradient(circle at 68% 62%, rgba(10,10,12,0.55) 0 3px, transparent 4px)',
        texSize: '22px 22px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #4a4a52, #28282e 66%, #131316)'
    },
    nepal: {
      base: 'earth',
      label: 'NEPAL',
      name: 'Nepal - Himalayan Foothills',
      coord: '28.0000° N, 84.0000° E',
      env: {
        temp: -6,
        light: 90
      },
      traction: 0.5,
      // snow-dusted rock
      seed: 306,
      count: 12,
      minR: 50,
      maxR: 112,
      decorSeed: 316,
      decorCount: 38,
      groundBg: {
        background: 'radial-gradient(circle at 44% 40%, #cdd6dd, #9fb0bd 56%, #748794 100%)',
        texture: 'radial-gradient(circle at 32% 32%, rgba(255,255,255,0.6) 0 2px, transparent 2.5px), radial-gradient(circle at 68% 62%, rgba(110,135,155,0.4) 0 3px, transparent 4px)',
        texSize: '28px 28px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #d7e0e8, #9fb2bf 64%, #6b8090)'
    },
    reef: {
      base: 'underwater',
      label: 'CORAL REEF',
      name: 'Great Barrier Reef',
      coord: '18.2871° S, 147.6992° E',
      env: {
        temp: 24,
        pressure: 12,
        pressureLabel: 'DEPTH',
        pressureUnit: 'm',
        light: 62
      },
      traction: 0.72,
      seed: 204,
      count: 20,
      minR: 44,
      maxR: 96,
      decorSeed: 214,
      decorCount: 64,
      groundBg: {
        background: 'radial-gradient(circle at 48% 42%, #3f96a4, #2a7080 58%, #1c5260 100%)',
        texture: 'radial-gradient(circle at 35% 35%, rgba(230,245,245,0.35) 0 2px, transparent 3px), radial-gradient(circle at 70% 65%, rgba(20,70,80,0.4) 0 3px, transparent 4px)',
        texSize: '26px 26px'
      },
      obFill: 'radial-gradient(circle at 40% 26%, #e08a96, #a04a62 66%, #5e2a3c)'
    },
    mariana: {
      base: 'underwater',
      label: 'MARIANA',
      name: 'Mariana Trench - Challenger Deep',
      coord: '11.3733° N, 142.5917° E',
      env: {
        temp: 2,
        pressure: 10994,
        pressureLabel: 'DEPTH',
        pressureUnit: 'm',
        light: 0
      },
      traction: 0.6,
      seed: 205,
      count: 9,
      minR: 52,
      maxR: 116,
      decorSeed: 215,
      decorCount: 34,
      groundBg: {
        background: 'radial-gradient(circle at 50% 45%, #14303e, #0c2030 60%, #061420 100%)',
        texture: 'radial-gradient(circle at 35% 35%, rgba(120,160,170,0.16) 0 2px, transparent 3px)',
        texSize: '32px 32px'
      },
      obFill: 'radial-gradient(circle at 40% 26%, #3c5a66, #1e3540 66%, #101e26)'
    },
    olympus: {
      base: 'mars',
      label: 'OLYMPUS MONS',
      name: 'Mars - Olympus Mons',
      coord: '18.6500° N, 226.2000° E',
      env: {
        temp: -73,
        light: 40
      },
      traction: 0.8,
      seed: 206,
      count: 17,
      minR: 42,
      maxR: 104,
      decorSeed: 216,
      decorCount: 56,
      groundBg: {
        background: 'radial-gradient(circle at 45% 40%, #8a4630, #66301e 58%, #481f12 100%)',
        texture: 'radial-gradient(circle at 30% 30%, rgba(190,110,80,0.45) 0 2px, transparent 2px), radial-gradient(circle at 65% 70%, rgba(80,35,20,0.5) 0 2.5px, transparent 3px)',
        texSize: '22px 22px'
      }
    },
    tycho: {
      base: 'space',
      label: 'TYCHO',
      name: 'Moon - Tycho Crater',
      coord: '43.3100° S, 11.3600° W',
      env: {
        gravity: 1.62,
        temp: -173,
        light: 100
      },
      traction: 1.18,
      seed: 207,
      count: 14,
      minR: 44,
      maxR: 100,
      decorSeed: 217,
      decorCount: 52
    },
    europa: {
      base: 'space',
      label: 'EUROPA',
      name: 'Jupiter - Europa Ice Crust',
      coord: '9.1000° S, 152.8000° W',
      env: {
        gravity: 1.315,
        temp: -160,
        light: 4
      },
      traction: 0.5,
      // moon-ice
      seed: 208,
      count: 12,
      minR: 46,
      maxR: 102,
      decorSeed: 218,
      decorCount: 44,
      groundBg: {
        background: 'radial-gradient(circle at 46% 40%, #cfdcea, #9fb4ca 56%, #6c8098 100%)',
        texture: 'linear-gradient(115deg, transparent 48%, rgba(120,90,80,0.25) 49%, transparent 51%), radial-gradient(circle at 34% 34%, rgba(255,255,255,0.5) 0 2px, transparent 2.5px)',
        texSize: '64px 64px, 28px 28px'
      },
      obFill: 'radial-gradient(circle at 38% 24%, #e2ecf6, #a2b8cc 64%, #66809a)'
    }
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
      env: {
        ...base.env,
        ...s.env
      },
      traction: s.traction != null ? s.traction : base.traction,
      obstacles: genObstacles(s.seed, s.count, s.minR, s.maxR),
      decor: genDecor(s.decorSeed, s.decorCount),
      groundBg: s.groundBg || null,
      obFill: s.obFill || null
    };
  }
  window.SITES = SITES;
  window.resolveSite = resolveSite;

  // ----------------------------------------------------------------------
  // Base fill (sits behind everything; mostly covered by the tilted ground)
  // ----------------------------------------------------------------------
  const BASE_FILL = {
    room: 'linear-gradient(180deg, #c9b48f 0%, #8a6a44 100%)',
    city: 'linear-gradient(180deg, #2a3340 0%, #1a1f28 100%)',
    earth: 'linear-gradient(180deg, #2c4426 0%, #1c2e1f 100%)',
    mars: 'linear-gradient(180deg, #5e2a1c 0%, #2e1610 100%)',
    underwater: 'linear-gradient(180deg, #07293a 0%, #04161f 100%)',
    space: 'radial-gradient(ellipse at 70% 18%, #11142a 0%, #07080f 70%, #050509 100%)'
  };
  function TerrainBackdrop({
    terrain
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "bd",
      style: {
        position: 'absolute',
        inset: 0,
        background: BASE_FILL[terrain.id]
      }
    });
  }

  // ----------------------------------------------------------------------
  // Sky band — screen-space horizon (gradient + celestial + stars), painted
  // over the far/receding ground and feathered into it at the bottom.
  // ----------------------------------------------------------------------
  const SKY_GRAD = {
    room: 'linear-gradient(180deg, #d8c6a4 0%, #c2ac86 55%, #a98e64 100%)',
    city: 'linear-gradient(180deg, #6f93b8 0%, #93acc0 55%, #b3c2cc 100%)',
    earth: 'linear-gradient(180deg, #5d86b6 0%, #8fb0c2 55%, #b6cdba 100%)',
    mars: 'linear-gradient(180deg, #5a2415 0%, #8a4026 60%, #a85636 100%)',
    underwater: 'linear-gradient(180deg, #0c5066 0%, #0b3a4c 60%, #0a2a38 100%)',
    space: 'linear-gradient(180deg, #06070d 0%, #0b0e1f 70%, #11142a 100%)'
  };
  function TerrainSky({
    terrain
  }) {
    const id = terrain.id;
    const stars = useMemo(() => {
      const r = rng(99);
      return Array.from({
        length: 90
      }, () => ({
        x: r() * 100,
        y: r() * 78,
        s: r() * 1.7 + 0.3,
        o: 0.3 + r() * 0.7,
        tw: 2 + r() * 5,
        delay: -r() * 6
      }));
    }, []);
    let celestial = null,
      glow = null;
    if (id === 'space') {
      celestial = /*#__PURE__*/React.createElement("div", {
        className: "celestial",
        style: {
          right: '9%',
          top: '14%',
          width: 150,
          height: 150,
          background: 'radial-gradient(circle at 38% 36%, #cfe0ff 0%, #6c95cf 36%, #305285 60%, #16294e 80%, #0a1530 100%)',
          boxShadow: 'inset -14px -10px 36px rgba(0,0,0,0.6), 0 0 70px rgba(90,140,210,0.35)'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: '22%',
          top: '32%',
          width: '32%',
          height: '18%',
          borderRadius: '50%',
          background: 'rgba(120,200,160,0.4)',
          filter: 'blur(4px)'
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: '54%',
          top: '54%',
          width: '24%',
          height: '15%',
          borderRadius: '50%',
          background: 'rgba(120,200,160,0.3)',
          filter: 'blur(4px)'
        }
      }));
    } else if (id === 'mars') {
      celestial = /*#__PURE__*/React.createElement("div", {
        className: "celestial",
        style: {
          right: '22%',
          top: '26%',
          width: 46,
          height: 46,
          background: 'radial-gradient(circle at 45% 45%, #fff4e2, #f0cfa0 55%, rgba(240,200,150,0) 80%)'
        }
      });
      glow = 'radial-gradient(ellipse at 78% 30%, rgba(255,200,150,0.3), transparent 55%)';
    } else if (id === 'earth') {
      celestial = /*#__PURE__*/React.createElement("div", {
        className: "celestial",
        style: {
          right: '16%',
          top: '20%',
          width: 92,
          height: 92,
          background: 'radial-gradient(circle at 45% 45%, #fffdf2, #fff0c2 50%, rgba(255,230,160,0) 74%)',
          filter: 'blur(1px)'
        }
      });
      glow = 'radial-gradient(ellipse at 80% 36%, rgba(255,245,210,0.32), transparent 50%)';
    } else {
      glow = 'radial-gradient(ellipse at 50% -10%, rgba(150,225,235,0.4), transparent 60%)';
    }
    return /*#__PURE__*/React.createElement("div", {
      className: "sky-band",
      style: {
        background: SKY_GRAD[id]
      }
    }, id === 'space' && stars.map((s, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        left: s.x + '%',
        top: s.y + '%',
        width: s.s,
        height: s.s,
        position: 'absolute',
        borderRadius: '99px',
        background: '#fff',
        opacity: s.o,
        animation: `twk ${s.tw}s ease-in-out ${s.delay}s infinite`
      }
    })), id === 'underwater' && /*#__PURE__*/React.createElement("div", {
      className: "shafts"
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        left: '14%'
      }
    }), /*#__PURE__*/React.createElement("i", {
      style: {
        left: '40%',
        animationDelay: '-3s'
      }
    }), /*#__PURE__*/React.createElement("i", {
      style: {
        left: '64%',
        animationDelay: '-6s'
      }
    }), /*#__PURE__*/React.createElement("i", {
      style: {
        left: '86%',
        animationDelay: '-1.5s'
      }
    })), celestial, glow && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        background: glow
      }
    }));
  }

  // ----------------------------------------------------------------------
  // Foreground ambient particles drifting over the whole scene.
  // ----------------------------------------------------------------------
  function TerrainAmbient({
    terrain
  }) {
    const id = terrain.id;
    const motes = useMemo(() => {
      const r = rng(id === 'mars' ? 5 : id === 'underwater' ? 9 : 23);
      return Array.from({
        length: id === 'space' ? 0 : 40
      }, () => ({
        x: r() * 100,
        y: r() * 100,
        s: 0.8 + r() * 2.4,
        d: 7 + r() * 14,
        delay: -r() * 16,
        drift: (r() - 0.5) * 50
      }));
    }, [id]);
    if (!motes.length) return null;
    return /*#__PURE__*/React.createElement("div", {
      className: "ambient-fg"
    }, motes.map((m, i) => {
      if (id === 'underwater') {
        return /*#__PURE__*/React.createElement("span", {
          key: i,
          className: "bubble",
          style: {
            left: m.x + '%',
            bottom: -10,
            width: m.s * 2.2,
            height: m.s * 2.2,
            position: 'absolute',
            borderRadius: '99px',
            border: '1px solid rgba(180,230,235,0.5)',
            background: 'rgba(160,220,230,0.1)',
            animation: `bub ${m.d}s linear ${m.delay}s infinite`,
            ['--drift']: m.drift + 'px'
          }
        });
      }
      return /*#__PURE__*/React.createElement("span", {
        key: i,
        style: {
          left: m.x + '%',
          top: m.y + '%',
          width: m.s,
          height: m.s,
          position: 'absolute',
          borderRadius: '99px',
          background: id === 'mars' ? 'rgba(235,180,130,0.5)' : 'rgba(200,225,180,0.4)',
          animation: `dust ${m.d}s linear ${m.delay}s infinite`,
          ['--drift']: m.drift + 'px'
        }
      });
    }));
  }

  // ----------------------------------------------------------------------
  // Ground plane content (panned by the camera in Viewport).
  // Renders ground texture + obstacles. Size: big square centered on world 0,0.
  // ----------------------------------------------------------------------
  const GROUND = 3400; // px square (1cm = 1px world unit)

  function groundBg(id) {
    switch (id) {
      case 'city':
        return {
          background: 'radial-gradient(circle at 50% 45%, #3a4150, #2b313d 60%, #20242e 100%)',
          texture: 'radial-gradient(circle at 30% 30%, rgba(150,160,175,0.10) 0 2px, transparent 3px)',
          texSize: '34px 34px'
        };
      case 'room':
        return {
          background: 'radial-gradient(circle at 45% 40%, #b08a5c, #8c6a44 62%, #6e5234 100%)',
          texture: 'repeating-linear-gradient(90deg, rgba(60,40,20,0.18) 0 2px, transparent 2px 64px)',
          texSize: '64px 64px'
        };
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
      default:
        // space / lunar
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
  function Obstacle({
    o,
    terrain
  }) {
    const id = terrain.id;
    const size = o.r * 2;
    const cx = GROUND / 2 + o.x,
      cy = GROUND / 2 + o.y;

    // Room furniture for the indoor companion-robot world.
    if (id === 'room') {
      const palette = {
        sofa: '#3f6f8c',
        table: '#7a5536',
        shelf: '#6a4f2c',
        plant: '#3f7d3a'
      };
      const col = palette[o.kind] || '#7a5536';
      const w = size * (o.kind === 'sofa' ? 2.2 : o.kind === 'plant' ? 0.9 : 1.5);
      const h = size * (o.kind === 'shelf' ? 1.8 : o.kind === 'plant' ? 1.2 : 0.9);
      return /*#__PURE__*/React.createElement("div", {
        className: "obstacle",
        style: {
          position: 'absolute',
          left: cx - w / 2,
          top: cy - h,
          width: w,
          height: h
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "ob-shadow",
        style: {
          left: '50%',
          top: '100%',
          width: w * 1.05,
          height: o.r * 0.6
        }
      }), o.kind === 'plant' ? /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: w,
          height: h
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: w * 0.5,
          height: h * 0.4,
          background: '#b56a45',
          borderRadius: '3px 3px 5px 5px'
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: '50%',
          bottom: h * 0.3,
          transform: 'translateX(-50%)',
          width: w,
          height: w,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 30%, #5fa04a, #2c5226)'
        }
      })) : /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          inset: 0,
          borderRadius: 6,
          background: `linear-gradient(180deg, ${col}, rgba(0,0,0,0.45))`,
          boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.18), 1px 3px 6px rgba(0,0,0,0.4)'
        }
      }));
    }

    // City furniture: buildings and parked cars stand up out of the street.
    // Collision still uses o.r, so what the rover must avoid is unchanged.
    if (id === 'city') {
      if (o.kind === 'building') {
        const w = size,
          h = size * (1.4 + o.v % 0.6);
        const hue = 196 + Math.round(o.v * 40);
        return /*#__PURE__*/React.createElement("div", {
          className: "obstacle",
          style: {
            position: 'absolute',
            left: cx - w / 2,
            top: cy - h,
            width: w,
            height: h
          }
        }, /*#__PURE__*/React.createElement("div", {
          className: "ob-shadow",
          style: {
            left: '50%',
            top: '100%',
            width: w * 1.1,
            height: o.r * 0.7
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            inset: 0,
            borderRadius: 3,
            background: `linear-gradient(160deg, hsl(${hue} 16% 42%), hsl(${hue} 18% 26%))`,
            boxShadow: '2px 5px 8px rgba(0,0,0,0.4)',
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,235,180,0.0) 0 14px, rgba(255,235,180,0.16) 14px 20px), repeating-linear-gradient(90deg, transparent 0 12px, rgba(0,0,0,0.18) 12px 14px)'
          }
        }));
      }
      // parked car: a rounded body with a cabin and two windows, oriented by rot
      const cw = size * 1.7,
        ch = size * 0.92;
      return /*#__PURE__*/React.createElement("div", {
        className: "obstacle",
        style: {
          position: 'absolute',
          left: cx - cw / 2,
          top: cy - ch / 2,
          width: cw,
          height: ch,
          transform: `rotate(${o.rot}deg)`
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "ob-shadow",
        style: {
          left: '50%',
          top: '94%',
          width: cw * 0.96,
          height: ch * 0.5
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          inset: 0,
          borderRadius: ch * 0.42,
          background: o.v < 0.5 ? 'linear-gradient(180deg,#d24b4b,#8d2a2a)' : 'linear-gradient(180deg,#3f7fc4,#244e84)',
          boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.25), 1px 3px 6px rgba(0,0,0,0.45)'
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: '26%',
          right: '26%',
          top: '20%',
          height: '60%',
          borderRadius: 4,
          background: 'linear-gradient(180deg, rgba(190,225,245,0.92), rgba(120,160,190,0.85))'
        }
      }));
    }

    // Earth reads like a game map: most stand-up features are trees and
    // bushes rather than bare rocks. Collision still uses o.r, so the world
    // the grader sees is unchanged -- only the picture differs.
    if (id === 'earth' && o.v >= 0.32) {
      const h = size * 1.35;
      if (o.v < 0.66) {
        // tree: a trunk under a layered canopy
        const cw = size * 1.15;
        return /*#__PURE__*/React.createElement("div", {
          className: "obstacle",
          style: {
            position: 'absolute',
            left: cx - cw / 2,
            top: cy - h,
            width: cw,
            height: h
          }
        }, /*#__PURE__*/React.createElement("div", {
          className: "ob-shadow",
          style: {
            left: '50%',
            top: '100%',
            width: cw * 1.1,
            height: o.r * 0.9
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: '50%',
            bottom: 0,
            width: Math.max(4, o.r * 0.34),
            height: h * 0.42,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(90deg, #5a4326, #7a5c36 55%, #46341d)',
            borderRadius: 2
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: '50%',
            bottom: h * 0.3,
            width: cw,
            height: cw,
            transform: 'translateX(-50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 30%, #5f9148, #2c5023 70%, #1f3a18)',
            boxShadow: '2px 4px 5px rgba(0,0,0,0.35)'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: '34%',
            bottom: h * 0.46,
            width: cw * 0.62,
            height: cw * 0.62,
            transform: 'translateX(-50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 32%, #6fa455, #305726)'
          }
        }));
      }
      if (o.v < 0.82) {
        // bush: a low cluster of leafy lobes
        const bw = size * 1.1;
        return /*#__PURE__*/React.createElement("div", {
          className: "obstacle",
          style: {
            position: 'absolute',
            left: cx - bw / 2,
            top: cy - bw * 0.7,
            width: bw,
            height: bw * 0.7
          }
        }, /*#__PURE__*/React.createElement("div", {
          className: "ob-shadow",
          style: {
            left: '50%',
            top: '100%',
            width: bw,
            height: o.r * 0.7
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: bw * 0.62,
            height: bw * 0.62,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 32%, #6c9a4c, #355a26)'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: bw * 0.58,
            height: bw * 0.58,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 32%, #5f8e44, #2e4f22)'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: '50%',
            bottom: bw * 0.14,
            width: bw * 0.6,
            height: bw * 0.6,
            transform: 'translateX(-50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 30%, #74a356, #335828)'
          }
        }));
      }
      // else fall through to the rock billboard below
    }

    // ~32% of features are flat craters (lie on the ground); rest stand up as rocks
    if (o.v < 0.32) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: cx - o.r,
          top: cy - o.r,
          width: size,
          height: size,
          borderRadius: '50%',
          background: CRATER_FILL[id],
          boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.55), inset 0 -3px 8px rgba(255,255,255,0.10)',
          border: '1px solid rgba(0,0,0,0.22)',
          transform: `rotate(${o.rot}deg)`
        }
      });
    }
    const h = size; // billboard stands ~as tall as wide
    return /*#__PURE__*/React.createElement("div", {
      className: "obstacle",
      style: {
        position: 'absolute',
        left: cx - o.r,
        top: cy - h,
        width: size,
        height: h
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "ob-shadow",
      style: {
        left: '50%',
        top: '100%',
        width: size * 1.25,
        height: o.r * 1.1
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "ob-body",
      style: {
        transform: `rotateZ(calc(-1 * var(--yaw, 0deg))) rotateX(calc(-1 * var(--tilt, 46deg)))`,
        background: terrain.obFill || OB_FILL[id],
        borderRadius: id === 'underwater' ? '46% 54% 44% 56% / 64% 60% 40% 36%' : '48% 52% 50% 50% / 60% 58% 42% 40%'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "ob-spec"
    })));
  }

  // Per-terrain decorative micro-feature (visual only; never collides).
  function Decor({
    d,
    id
  }) {
    const cx = GROUND / 2 + d.x,
      cy = GROUND / 2 + d.y;
    const base = {
      position: 'absolute',
      pointerEvents: 'none',
      transform: `rotate(${d.rot}deg)`
    };
    if (id === 'earth') {
      // grass tuft (v<0.55) or pebble
      if (d.v < 0.55) {
        return /*#__PURE__*/React.createElement("div", {
          style: {
            ...base,
            left: cx,
            top: cy,
            width: 2,
            height: d.r * 1.4,
            borderRadius: 2,
            background: 'linear-gradient(180deg, #86a861, #4c6436)',
            boxShadow: '3px 1px 0 -0.5px #6d8c4e, -3px 2px 0 -0.5px #5a7440'
          }
        });
      }
      return /*#__PURE__*/React.createElement("div", {
        style: {
          ...base,
          left: cx - d.r / 2,
          top: cy - d.r / 3,
          width: d.r,
          height: d.r * 0.66,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 30%, #74875c, #44522f)'
        }
      });
    }
    if (id === 'mars') {
      // wind ripple (v<0.5) or pebble
      if (d.v < 0.5) {
        return /*#__PURE__*/React.createElement("div", {
          style: {
            ...base,
            left: cx - d.r,
            top: cy,
            width: d.r * 2.6,
            height: 2,
            borderRadius: 2,
            background: 'linear-gradient(90deg, transparent, rgba(220,140,95,0.5), transparent)'
          }
        });
      }
      return /*#__PURE__*/React.createElement("div", {
        style: {
          ...base,
          left: cx - d.r / 2,
          top: cy - d.r / 3,
          width: d.r,
          height: d.r * 0.6,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 36% 28%, #b06245, #69311e)'
        }
      });
    }
    if (id === 'underwater') {
      // sand ripple (v<0.45), shell (v<0.75) or coral speck
      if (d.v < 0.45) {
        return /*#__PURE__*/React.createElement("div", {
          style: {
            ...base,
            left: cx - d.r,
            top: cy,
            width: d.r * 2.4,
            height: 2,
            borderRadius: 2,
            background: 'linear-gradient(90deg, transparent, rgba(180,215,215,0.28), transparent)'
          }
        });
      }
      if (d.v < 0.75) {
        return /*#__PURE__*/React.createElement("div", {
          style: {
            ...base,
            left: cx - d.r / 2,
            top: cy - d.r / 2,
            width: d.r * 0.9,
            height: d.r * 0.7,
            borderRadius: '60% 60% 45% 45%',
            background: 'radial-gradient(circle at 40% 25%, #d8d4c2, #8d8a78)'
          }
        });
      }
      return /*#__PURE__*/React.createElement("div", {
        style: {
          ...base,
          left: cx - d.r / 2,
          top: cy - d.r / 2,
          width: d.r * 0.7,
          height: d.r * 0.7,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 30%, #5ca6ac, #2c5a62)'
        }
      });
    }
    // space: micro-crater (v<0.6) or regolith speck
    if (d.v < 0.6) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          ...base,
          left: cx - d.r / 2,
          top: cy - d.r / 2,
          width: d.r,
          height: d.r,
          borderRadius: '50%',
          background: CRATER_FILL.space,
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), inset 0 -1px 3px rgba(255,255,255,0.08)'
        }
      });
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...base,
        left: cx - d.r / 3,
        top: cy - d.r / 3,
        width: d.r * 0.6,
        height: d.r * 0.5,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 30%, #84868f, #4a4c54)'
      }
    });
  }

  // ----------------------------------------------------------------------
  // Real-world Earth landscape: farmland patchwork, forests, roads and a
  // meandering river painted across the ground square. Purely decorative --
  // none of it collides; it just makes the base Earth read like a map you
  // could fly over. Only the temperate base Earth gets it (not the Sahara,
  // Amazon or Antarctica sites, where farmland and rivers would be wrong).
  // ----------------------------------------------------------------------
  const FIELD_FILL = ['#6f8f4e', '#7ba055', '#c9b067', '#8a6b46', '#9bbf6a', '#93925a', '#5f8048', '#b6a85e'];
  function EarthFeatures() {
    const {
      fields,
      forests
    } = useMemo(() => {
      const r = rng(404);
      const fl = [];
      let guard = 0;
      while (fl.length < 30 && guard++ < 600) {
        const w = 220 + r() * 320,
          h = 200 + r() * 300;
        const x = r() * (GROUND - w),
          y = r() * (GROUND - h);
        // leave the rover's start clearing (centre) free of hard patches
        if (Math.abs(x + w / 2 - GROUND / 2) < 260 && Math.abs(y + h / 2 - GROUND / 2) < 260) continue;
        fl.push({
          x,
          y,
          w,
          h,
          c: FIELD_FILL[r() * FIELD_FILL.length | 0],
          rot: (r() - 0.5) * 8,
          row: 20 + r() * 120
        });
      }
      const fo = [];
      for (let i = 0; i < 8; i++) {
        const cx = 200 + r() * (GROUND - 400),
          cy = 200 + r() * (GROUND - 400);
        const trees = [];
        const n = 12 + (r() * 10 | 0);
        for (let t = 0; t < n; t++) {
          const a = r() * Math.PI * 2,
            d = r() * (90 + r() * 80);
          trees.push({
            x: cx + Math.cos(a) * d,
            y: cy + Math.sin(a) * d,
            s: 13 + r() * 18,
            v: r()
          });
        }
        fo.push(trees);
      }
      return {
        fields: fl,
        forests: fo
      };
    }, []);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        borderRadius: 8,
        overflow: 'hidden'
      }
    }, fields.map((f, i) => /*#__PURE__*/React.createElement("div", {
      key: 'f' + i,
      style: {
        position: 'absolute',
        left: f.x,
        top: f.y,
        width: f.w,
        height: f.h,
        background: f.c,
        opacity: 0.74,
        transform: `rotate(${f.rot}deg)`,
        backgroundImage: `repeating-linear-gradient(90deg, rgba(0,0,0,0.14) 0 2px, transparent 2px ${f.row}px)`,
        outline: '2.5px solid rgba(40,56,30,0.55)',
        outlineOffset: -1,
        borderRadius: 3
      }
    })), /*#__PURE__*/React.createElement("svg", {
      viewBox: `0 0 ${GROUND} ${GROUND}`,
      width: GROUND,
      height: GROUND,
      style: {
        position: 'absolute',
        inset: 0
      }
    }, /*#__PURE__*/React.createElement("path", {
      d: "M 300 -60 C 760 560, 240 1120, 880 1640 S 1500 2680, 1180 3460",
      fill: "none",
      stroke: "#2f6ea6",
      strokeWidth: "48",
      strokeLinecap: "round",
      opacity: "0.92"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M 300 -60 C 760 560, 240 1120, 880 1640 S 1500 2680, 1180 3460",
      fill: "none",
      stroke: "#8fc3e6",
      strokeWidth: "16",
      strokeLinecap: "round",
      opacity: "0.7"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M -60 1180 Q 1700 940 3460 1340",
      fill: "none",
      stroke: "#cabd96",
      strokeWidth: "22",
      opacity: "0.9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M 2240 -60 Q 1960 1700 2480 3460",
      fill: "none",
      stroke: "#cabd96",
      strokeWidth: "20",
      opacity: "0.85"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M -60 1180 Q 1700 940 3460 1340",
      fill: "none",
      stroke: "#f0dc8e",
      strokeWidth: "3",
      strokeDasharray: "18 22",
      opacity: "0.85"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M 2240 -60 Q 1960 1700 2480 3460",
      fill: "none",
      stroke: "#f0dc8e",
      strokeWidth: "3",
      strokeDasharray: "18 22",
      opacity: "0.8"
    })), forests.map((trees, i) => /*#__PURE__*/React.createElement("div", {
      key: 'fo' + i
    }, trees.map((t, j) => /*#__PURE__*/React.createElement("div", {
      key: j,
      style: {
        position: 'absolute',
        left: t.x - t.s / 2,
        top: t.y - t.s / 2,
        width: t.s,
        height: t.s,
        borderRadius: '50%',
        boxShadow: '1px 2px 3px rgba(0,0,0,0.4)',
        background: t.v < 0.5 ? 'radial-gradient(circle at 38% 30%, #4e7a3e, #1f3a18)' : 'radial-gradient(circle at 38% 30%, #5f9148, #244a1c)'
      }
    })))));
  }

  // ----------------------------------------------------------------------
  // City street furniture painted on the ground: two roads crossing, a zebra
  // crossing, lane lines and pavements. Decorative; collision uses the
  // building and car obstacles, not this paint.
  // ----------------------------------------------------------------------
  const C = GROUND / 2;
  const ROAD = 150; // half-width of a carriageway (px)
  function CityFeatures() {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        borderRadius: 8,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: 0,
        top: C - ROAD - 70,
        width: GROUND,
        height: (ROAD + 70) * 2,
        background: '#4a525f'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: C - ROAD - 70,
        top: 0,
        width: (ROAD + 70) * 2,
        height: GROUND,
        background: '#4a525f'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: 0,
        top: C - ROAD,
        width: GROUND,
        height: ROAD * 2,
        background: '#23272f'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: C - ROAD,
        top: 0,
        width: ROAD * 2,
        height: GROUND,
        background: '#23272f'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: 0,
        top: C - 3,
        width: GROUND,
        height: 6,
        backgroundImage: 'repeating-linear-gradient(90deg, #e6d886 0 46px, transparent 46px 92px)',
        opacity: 0.9
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: C - 3,
        top: 0,
        width: 6,
        height: GROUND,
        backgroundImage: 'repeating-linear-gradient(0deg, #e6d886 0 46px, transparent 46px 92px)',
        opacity: 0.9
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: C + ROAD + 30,
        top: C - ROAD,
        width: 150,
        height: ROAD * 2,
        backgroundImage: 'repeating-linear-gradient(90deg, #e8ecf2 0 20px, transparent 20px 44px)',
        opacity: 0.92
      }
    }));
  }

  // Live agents: pedestrians stroll the pavements and a car drives the road.
  // Self contained animation; positions are visual only.
  function CityAgents() {
    const [t, setT] = React.useState(0);
    React.useEffect(() => {
      let raf, start;
      if (typeof requestAnimationFrame !== 'function') return undefined;
      const loop = ts => {
        if (start == null) start = ts;
        setT((ts - start) / 1000);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => {
        if (raf) cancelAnimationFrame(raf);
      };
    }, []);
    const agents = React.useMemo(() => {
      const r = rng(77);
      const a = [];
      // pedestrians: walk back and forth along the two pavements
      for (let i = 0; i < 7; i++) {
        const horiz = r() < 0.6;
        a.push({
          kind: 'person',
          horiz,
          lane: C - ROAD - 36 + (r() < 0.5 ? 0 : (ROAD + 70) * 2 - 8),
          span: 900 + r() * 1100,
          off: r() * 6,
          sp: 26 + r() * 22,
          shirt: ['#d98c4a', '#5aa0d8', '#8a6fc0', '#5bbf86'][r() * 4 | 0]
        });
      }
      // a car cruising the horizontal carriageway
      a.push({
        kind: 'car',
        horiz: true,
        lane: C - 64,
        span: GROUND,
        off: 0,
        sp: 150,
        body: '#e3c33f'
      });
      a.push({
        kind: 'car',
        horiz: false,
        lane: C + 60,
        span: GROUND,
        off: 3,
        sp: 130,
        body: '#46b07a'
      });
      return a;
    }, []);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none'
      }
    }, agents.map((ag, i) => {
      const phase = (t * ag.sp / ag.span + ag.off) % 2;
      const tri = phase < 1 ? phase : 2 - phase; // 0..1..0 ping-pong
      const along = tri * ag.span + (GROUND - ag.span) / 2;
      const x = ag.horiz ? along : ag.lane;
      const y = ag.horiz ? ag.lane : along;
      const bill = {
        transform: 'rotateZ(calc(-1 * var(--yaw, 0deg))) rotateX(calc(-1 * var(--tilt, 46deg)))',
        transformOrigin: '50% 100%'
      };
      if (ag.kind === 'person') {
        const bob = Math.sin(t * 6 + ag.off * 3) * 2;
        return /*#__PURE__*/React.createElement("div", {
          key: i,
          style: {
            position: 'absolute',
            left: x,
            top: y,
            zIndex: 4
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: -9,
            top: -3,
            width: 18,
            height: 7,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.32)',
            filter: 'blur(2px)'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -7,
            bottom: 0 - bob,
            width: 14,
            height: 40
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 3,
            top: 0,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#e8c9a8'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 1,
            top: 9,
            width: 12,
            height: 18,
            borderRadius: '4px 4px 3px 3px',
            background: ag.shirt
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 3,
            top: 27,
            width: 3,
            height: 12,
            background: '#2f3646',
            borderRadius: 2
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 8,
            top: 27,
            width: 3,
            height: 12,
            background: '#2f3646',
            borderRadius: 2
          }
        })));
      }
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        style: {
          position: 'absolute',
          left: x,
          top: y,
          zIndex: 4
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: -34,
          top: -2,
          width: 68,
          height: 14,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.34)',
          filter: 'blur(3px)'
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          ...bill,
          position: 'absolute',
          left: -34,
          bottom: 0,
          width: 68,
          height: 30,
          transform: bill.transform + (ag.horiz ? '' : ' rotateZ(90deg)')
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          inset: 0,
          borderRadius: 13,
          background: `linear-gradient(180deg, ${ag.body}, rgba(0,0,0,0.4))`,
          boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.3), 1px 3px 6px rgba(0,0,0,0.45)'
        }
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          position: 'absolute',
          left: '24%',
          right: '24%',
          top: '24%',
          height: '52%',
          borderRadius: 4,
          background: 'linear-gradient(180deg, rgba(190,225,245,0.92), rgba(120,160,190,0.85))'
        }
      })));
    }));
  }
  function TerrainGround({
    terrain,
    children,
    showGrid
  }) {
    const g = terrain.groundBg || groundBg(terrain.id);
    const isEarth = terrain.id === 'earth';
    return /*#__PURE__*/React.createElement("div", {
      className: "ground",
      style: {
        position: 'absolute',
        left: -GROUND / 2,
        top: -GROUND / 2,
        width: GROUND,
        height: GROUND,
        background: g.background,
        borderRadius: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        backgroundImage: g.texture,
        backgroundSize: g.texSize,
        opacity: 0.6,
        borderRadius: 8
      }
    }), isEarth ? /*#__PURE__*/React.createElement(EarthFeatures, null) : null, terrain.id === 'city' ? /*#__PURE__*/React.createElement(CityFeatures, null) : null, showGrid !== false && terrain.id !== 'city' ? /*#__PURE__*/React.createElement("div", {
      className: "ground-grid"
    }) : null, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: GROUND / 2 - WALL,
        top: GROUND / 2 - WALL,
        width: WALL * 2,
        height: WALL * 2,
        border: '2px dashed ' + terrain.accent,
        opacity: 0.2,
        borderRadius: 12,
        pointerEvents: 'none'
      }
    }), (terrain.decor || []).map((d, i) => /*#__PURE__*/React.createElement(Decor, {
      key: 'd' + i,
      d: d,
      id: terrain.id
    })), children, terrain.obstacles.map((o, i) => /*#__PURE__*/React.createElement(Obstacle, {
      key: i,
      o: o,
      terrain: terrain
    })), terrain.id === 'city' ? /*#__PURE__*/React.createElement(CityAgents, null) : null);
  }
  window.TERRAINS = TERRAINS;
  window.TERRAIN_GROUND = GROUND;
  window.TerrainBackdrop = TerrainBackdrop;
  window.TerrainSky = TerrainSky;
  window.TerrainAmbient = TerrainAmbient;
  window.TerrainGround = TerrainGround;
})();
})();

;(function () {
/* ============================================================================
   ORBITAL ROVER — Rover render
   Top-down 4-wheel rover drawn in SVG. Points "up" (north) at heading 0.
   Wheels animate when moving; a headlight cone and status LED respond to state.
   Exposes window.Rover
   ========================================================================== */
(function () {
  function Wheel({
    x,
    y,
    moving
  }) {
    return /*#__PURE__*/React.createElement("g", {
      transform: `translate(${x},${y})`
    }, /*#__PURE__*/React.createElement("rect", {
      x: "-7",
      y: "-12",
      width: "14",
      height: "24",
      rx: "4",
      fill: "#1a1d2a",
      stroke: "#000",
      strokeWidth: "0.5"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "-7",
      y: "-12",
      width: "14",
      height: "24",
      rx: "4",
      fill: "url(#tread)",
      opacity: "0.9"
    }), moving && /*#__PURE__*/React.createElement("g", {
      opacity: "0.5"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "-4.5",
      y: "-9",
      width: "9",
      height: "2",
      rx: "1",
      fill: "#5ce0d8"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "-4.5",
      y: "0",
      width: "9",
      height: "2",
      rx: "1",
      fill: "#5ce0d8"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "-4.5",
      y: "7",
      width: "9",
      height: "2",
      rx: "1",
      fill: "#5ce0d8"
    })));
  }
  function Rover({
    moving,
    accent,
    led,
    scanning
  }) {
    const ledColor = led || accent || '#5ce0d8';
    return /*#__PURE__*/React.createElement("svg", {
      width: "92",
      height: "108",
      viewBox: "-46 -54 92 108",
      style: {
        display: 'block',
        overflow: 'visible'
      }
    }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: "tread",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "0"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#2a2e3d"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "0.5",
      stopColor: "#0c0e16"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#2a2e3d"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "chassis",
      x1: "0",
      y1: "-1",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#e8e2d2"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "0.5",
      stopColor: "#c7c0ad"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#9d9684"
    })), /*#__PURE__*/React.createElement("radialGradient", {
      id: "beam",
      cx: "0.5",
      cy: "1",
      r: "0.9"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: ledColor,
      stopOpacity: "0.55"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: ledColor,
      stopOpacity: "0"
    }))), /*#__PURE__*/React.createElement("path", {
      d: "M-16 -22 L-30 -78 L30 -78 L16 -22 Z",
      fill: "url(#beam)",
      opacity: scanning ? 0.95 : 0.7
    }), /*#__PURE__*/React.createElement("ellipse", {
      cx: "2",
      cy: "6",
      rx: "34",
      ry: "40",
      fill: "#000",
      opacity: "0.32"
    }), /*#__PURE__*/React.createElement(Wheel, {
      x: -26,
      y: -22,
      moving: moving
    }), /*#__PURE__*/React.createElement(Wheel, {
      x: 26,
      y: -22,
      moving: moving
    }), /*#__PURE__*/React.createElement(Wheel, {
      x: -26,
      y: 22,
      moving: moving
    }), /*#__PURE__*/React.createElement(Wheel, {
      x: 26,
      y: 22,
      moving: moving
    }), /*#__PURE__*/React.createElement("rect", {
      x: "-24",
      y: "-34",
      width: "48",
      height: "68",
      rx: "11",
      fill: "url(#chassis)",
      stroke: "#3a3528",
      strokeWidth: "1.2"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "-18",
      y: "-26",
      width: "36",
      height: "52",
      rx: "7",
      fill: "#15171f",
      stroke: "#3a3e4d",
      strokeWidth: "0.8"
    }), /*#__PURE__*/React.createElement("g", {
      stroke: "#2b3550",
      strokeWidth: "0.8",
      opacity: "0.9"
    }, /*#__PURE__*/React.createElement("line", {
      x1: "-18",
      y1: "-13",
      x2: "18",
      y2: "-13"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "-18",
      y1: "0",
      x2: "18",
      y2: "0"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "-18",
      y1: "13",
      x2: "18",
      y2: "13"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "-6",
      y1: "-26",
      x2: "-6",
      y2: "26"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "6",
      y1: "-26",
      x2: "6",
      y2: "26"
    })), /*#__PURE__*/React.createElement("rect", {
      x: "-24",
      y: "-2.5",
      width: "48",
      height: "5",
      fill: accent,
      opacity: "0.85"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "0",
      cy: "-26",
      r: "6.5",
      fill: "#0c0e16",
      stroke: ledColor,
      strokeWidth: "1.4"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "0",
      cy: "-26",
      r: "2.6",
      fill: ledColor
    }, scanning && /*#__PURE__*/React.createElement("animate", {
      attributeName: "opacity",
      values: "1;0.3;1",
      dur: "0.6s",
      repeatCount: "indefinite"
    })), /*#__PURE__*/React.createElement("circle", {
      cx: "0",
      cy: "28",
      r: "3",
      fill: ledColor,
      opacity: "0.9"
    }, /*#__PURE__*/React.createElement("animate", {
      attributeName: "opacity",
      values: "0.9;0.4;0.9",
      dur: "2s",
      repeatCount: "indefinite"
    })), /*#__PURE__*/React.createElement("line", {
      x1: "16",
      y1: "-30",
      x2: "24",
      y2: "-42",
      stroke: "#9d9684",
      strokeWidth: "1.4"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "24",
      cy: "-42",
      r: "2.4",
      fill: accent
    }));
  }
  window.Rover = Rover;
})();
})();

;(function () {
/* ============================================================================
   ORBITAL ROVER — Viewport (3D diorama)
   A tilted, camera-tracked world: ground + perspective grid + standing
   obstacles + trail + a lifted rover that casts a shadow, kicks up dust while
   driving, and emits scan ripples. HUD stays in screen space.
   Exposes window.Viewport
   ========================================================================== */
(function () {
  const {
    useMemo,
    memo
  } = React;
  const GROUND = window.TERRAIN_GROUND;
  const WALL = window.TERRAINS.WALL;
  const DUST = {
    city: '#8a909c',
    room: '#c8b48c',
    earth: '#b9a878',
    mars: '#d89a6a',
    underwater: 'rgba(190,220,222,0.55)',
    space: '#9a9ca6'
  };
  const HORIZON = {
    city: 'rgba(26,31,40,0.5)',
    room: 'rgba(110,82,52,0.5)',
    earth: 'rgba(28,46,31,0.5)',
    mars: 'rgba(46,22,16,0.5)',
    underwater: 'rgba(4,22,31,0.55)',
    space: 'rgba(7,8,15,0.55)'
  };

  // The rover pushes one segment array per pen-down move and appends points to
  // the LAST segment as it drives (app.jsx pushTrailPoint, in place). Earlier
  // segments are never mutated again, so a finished segment's SVG path string
  // can be built once and cached by array identity — only the in-progress leg
  // is rebuilt per frame. This turns the old per-frame rebuild of every path
  // (O(N) per frame, O(N^2) cumulative over an N-point spiral) into work that
  // scales with the current leg, not the whole trail.
  const pathCache = new WeakMap();
  function buildPath(seg) {
    return seg.map((p, j) => (j === 0 ? 'M' : 'L') + (GROUND / 2 + p.x).toFixed(1) + ' ' + (GROUND / 2 + p.y).toFixed(1)).join(' ');
  }
  function cachedPath(seg) {
    let d = pathCache.get(seg);
    if (d === undefined) {
      d = buildPath(seg);
      pathCache.set(seg, d);
    }
    return d;
  }
  function TrailPath({
    d,
    accent
  }) {
    return /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: "#000",
      strokeWidth: "7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      opacity: "0.18"
    }), /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: accent,
      strokeWidth: "4",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      opacity: "0.78"
    }));
  }

  // Completed segments (all but the last) are immutable, so this layer only
  // re-renders when a new leg starts (count grows) or the colour changes — NOT
  // on every animation frame. memo with a count-based compare skips it during a
  // move, when only the live segment is growing. (A naive memo on `segments`
  // identity would wrongly skip: the array ref is stable while the last segment
  // mutates in place — see app.jsx, setTrail only fires on segment add/reset.)
  const CompletedTrail = memo(function CompletedTrail({
    segments,
    count,
    accent
  }) {
    const paths = [];
    for (let i = 0; i < count; i++) {
      const seg = segments[i];
      if (seg.length < 2) continue;
      paths.push(/*#__PURE__*/React.createElement(TrailPath, {
        key: i,
        d: cachedPath(seg),
        accent: accent
      }));
    }
    return paths;
  }, (a, b) => a.accent === b.accent && a.count === b.count);
  function Trail({
    segments,
    accent
  }) {
    if (!segments || !segments.length) return null;
    const last = segments[segments.length - 1];
    return /*#__PURE__*/React.createElement("svg", {
      width: GROUND,
      height: GROUND,
      style: {
        position: 'absolute',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        overflow: 'visible'
      }
    }, /*#__PURE__*/React.createElement(CompletedTrail, {
      segments: segments,
      count: segments.length - 1,
      accent: accent
    }), last && last.length >= 2 ? /*#__PURE__*/React.createElement(TrailPath, {
      d: buildPath(last),
      accent: accent
    }) : null);
  }
  function DustKick({
    color
  }) {
    const motes = useMemo(() => Array.from({
      length: 8
    }, (_, i) => ({
      dx: (Math.random() - 0.5) * 46,
      dy: 30 + Math.random() * 44,
      delay: -(i / 8) * 0.9,
      left: (Math.random() - 0.5) * 30
    })), []);
    return /*#__PURE__*/React.createElement("div", {
      className: "dust-kick",
      style: {
        ['--dust']: color
      }
    }, motes.map((m, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        left: m.left,
        ['--dx']: m.dx + 'px',
        ['--dy']: m.dy + 'px',
        animationDelay: m.delay + 's'
      }
    })));
  }

  // World props placed by pupil code (place("flag") etc). Billboarded like
  // obstacles so they stand up out of the tilted ground. Visual only.
  function Prop({
    p,
    photoUrl
  }) {
    const cx = GROUND / 2 + p.x,
      cy = GROUND / 2 + p.y;
    const bill = {
      transform: 'rotateZ(calc(-1 * var(--yaw, 0deg))) rotateX(calc(-1 * var(--tilt, 46deg)))',
      transformOrigin: '50% 100%'
    };
    let body = null;
    switch (p.kind) {
      case 'photo':
        body = /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -26,
            bottom: 0,
            width: 52,
            height: 66
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 24,
            bottom: 0,
            width: 4,
            height: 14,
            background: 'linear-gradient(180deg,#9aa0b4,#5a5f70)',
            borderRadius: 2
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 0,
            top: 0,
            width: 52,
            height: 52,
            background: '#f5f0e4',
            borderRadius: 4,
            padding: 3,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
          }
        }, photoUrl ? /*#__PURE__*/React.createElement("img", {
          src: photoUrl,
          alt: "",
          style: {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 2
          }
        }) : /*#__PURE__*/React.createElement("div", {
          style: {
            width: '100%',
            height: '100%',
            borderRadius: 2,
            background: 'linear-gradient(135deg,#5ce0d8,#1a6f6a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20
          }
        }, "\uD83D\uDCF7")));
        break;
      case 'drone':
        body = /*#__PURE__*/React.createElement("div", {
          className: "prop-drone",
          style: {
            ...bill,
            position: 'absolute',
            left: -16,
            bottom: 26,
            width: 32,
            height: 18
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 8,
            top: 7,
            width: 16,
            height: 8,
            borderRadius: 3,
            background: 'linear-gradient(180deg,#aeb8e8,#5a6390)'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 0,
            top: 4,
            width: 12,
            height: 2,
            borderRadius: 2,
            background: '#cfd6f5',
            opacity: 0.85
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            right: 0,
            top: 4,
            width: 12,
            height: 2,
            borderRadius: 2,
            background: '#cfd6f5',
            opacity: 0.85
          }
        }), /*#__PURE__*/React.createElement("div", {
          className: "prop-pulse",
          style: {
            position: 'absolute',
            left: 14,
            bottom: 0,
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: '#5ce0d8'
          }
        }));
        break;
      case 'beacon':
        body = /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -5,
            bottom: 0,
            width: 10,
            height: 52
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 3,
            bottom: 0,
            width: 4,
            height: 44,
            background: 'linear-gradient(180deg,#9aa0b4,#5a5f70)',
            borderRadius: 2
          }
        }), /*#__PURE__*/React.createElement("div", {
          className: "prop-pulse",
          style: {
            position: 'absolute',
            left: 0,
            top: 0,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#5ce0d8',
            boxShadow: '0 0 12px #5ce0d8'
          }
        }));
        break;
      case 'rock':
        body = /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -14,
            bottom: 0,
            width: 28,
            height: 22,
            borderRadius: '48% 52% 45% 55% / 70% 64% 36% 30%',
            background: 'radial-gradient(circle at 38% 26%, #8d8f99, #4c4e58 70%, #33353d)'
          }
        });
        break;
      case 'tree':
        body = /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -16,
            bottom: 0,
            width: 32,
            height: 58
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 13,
            bottom: 0,
            width: 6,
            height: 20,
            background: 'linear-gradient(180deg,#7a5a3a,#4c3722)',
            borderRadius: 2
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 0,
            top: 0,
            width: 32,
            height: 40,
            borderRadius: '50% 50% 46% 46%',
            background: 'radial-gradient(circle at 38% 28%, #7fae62, #3f6030 72%, #2c4422)'
          }
        }));
        break;
      case 'person':
        body = /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -9,
            bottom: 0,
            width: 18,
            height: 46
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 4,
            top: 0,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#e8c9a8'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 2,
            top: 11,
            width: 14,
            height: 22,
            borderRadius: '5px 5px 3px 3px',
            background: 'linear-gradient(180deg,#e0b45c,#a87f38)'
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 4,
            top: 33,
            width: 4,
            height: 13,
            background: '#3a4356',
            borderRadius: 2
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 10,
            top: 33,
            width: 4,
            height: 13,
            background: '#3a4356',
            borderRadius: 2
          }
        }));
        break;
      case 'crate':
        body = /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -12,
            bottom: 0,
            width: 24,
            height: 22,
            background: 'linear-gradient(180deg,#a8845c,#6e5538)',
            border: '2px solid #4c3a24',
            borderRadius: 3,
            boxShadow: 'inset 0 0 0 2px rgba(255,235,200,0.12)'
          }
        });
        break;
      default:
        // flag
        body = /*#__PURE__*/React.createElement("div", {
          style: {
            ...bill,
            position: 'absolute',
            left: -2,
            bottom: 0,
            width: 26,
            height: 54
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: 3,
            height: 54,
            background: 'linear-gradient(180deg,#d8d3c4,#8b8678)',
            borderRadius: 2
          }
        }), /*#__PURE__*/React.createElement("div", {
          style: {
            position: 'absolute',
            left: 3,
            top: 2,
            width: 0,
            height: 0,
            borderTop: '9px solid transparent',
            borderBottom: '9px solid transparent',
            borderLeft: '22px solid #5ce0d8'
          }
        }));
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: cx,
        top: cy,
        zIndex: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: -10,
        top: -4,
        width: 20,
        height: 8,
        borderRadius: '50%',
        background: 'rgba(0,0,0,0.3)',
        filter: 'blur(2px)'
      }
    }), body);
  }
  function Viewport({
    terrain,
    rover,
    trail,
    props,
    photoUrl,
    sensorDist,
    say,
    crashKey,
    zoom,
    showGrid,
    showFx,
    trailColor,
    tilt,
    yaw,
    onTilt
  }) {
    const Rover = window.Rover;
    const Backdrop = window.TerrainBackdrop;
    const Sky = window.TerrainSky;
    const Ambient = window.TerrainAmbient;
    const Ground = window.TerrainGround;
    const z = zoom || 1;
    const tl = tilt == null ? 46 : tilt;
    const yw = yaw || 0;
    const beamLen = Math.min(sensorDist != null ? sensorDist : 600, 600);
    const counter = `rotateZ(${-yw}deg) rotateX(${-tl}deg)`;
    return /*#__PURE__*/React.createElement("div", {
      className: "viewport",
      style: {
        ['--horizon']: HORIZON[terrain.id]
      }
    }, /*#__PURE__*/React.createElement(Backdrop, {
      terrain: terrain
    }), /*#__PURE__*/React.createElement(Sky, {
      terrain: terrain
    }), /*#__PURE__*/React.createElement("div", {
      className: "world",
      style: {
        transform: `rotateX(${tl}deg) scale(${z}) rotateZ(${yw}deg) translate(${-rover.x}px, ${-rover.y}px)`,
        ['--tilt']: tl + 'deg',
        ['--yaw']: yw + 'deg'
      }
    }, /*#__PURE__*/React.createElement(Ground, {
      terrain: terrain,
      showGrid: showGrid
    }, /*#__PURE__*/React.createElement(Trail, {
      segments: trail,
      accent: trailColor || terrain.accent
    }), (props || []).map(p => /*#__PURE__*/React.createElement(Prop, {
      key: p.id,
      p: p,
      photoUrl: photoUrl
    }))), /*#__PURE__*/React.createElement("div", {
      className: "rover-wrap",
      style: {
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate(${rover.x}px, ${rover.y}px)`,
        zIndex: 5
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "sensor-ring",
      style: {
        position: 'absolute',
        left: -600,
        top: -600,
        width: 1200,
        height: 1200,
        borderRadius: '50%',
        border: '1px solid ' + terrain.accent,
        opacity: 0.07,
        pointerEvents: 'none'
      }
    }), rover.scanning && /*#__PURE__*/React.createElement("div", {
      className: "scan-ripple"
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        width: 900,
        height: 900,
        animationDelay: '0s'
      }
    }), /*#__PURE__*/React.createElement("i", {
      style: {
        width: 900,
        height: 900,
        animationDelay: '0.5s'
      }
    }), /*#__PURE__*/React.createElement("i", {
      style: {
        width: 900,
        height: 900,
        animationDelay: '1s'
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "heading-rot",
      style: {
        transform: `rotate(${rover.heading}deg)`,
        transformOrigin: 'center',
        position: 'absolute',
        left: 0,
        top: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: -1.5,
        top: -beamLen - 30,
        width: 3,
        height: beamLen,
        background: `linear-gradient(180deg, transparent, ${terrain.accent})`,
        opacity: 0.55,
        pointerEvents: 'none'
      }
    }), beamLen < 600 && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: -6,
        top: -beamLen - 36,
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: terrain.accent,
        opacity: 0.85,
        boxShadow: '0 0 10px ' + terrain.accent
      }
    }), rover.moving && /*#__PURE__*/React.createElement(DustKick, {
      color: DUST[terrain.id]
    }), /*#__PURE__*/React.createElement("div", {
      className: "rover-shadow"
    }), /*#__PURE__*/React.createElement("div", {
      className: "rover-lift",
      style: {
        transform: 'translate(-50%,-50%) translateZ(16px)',
        position: 'absolute',
        left: 0,
        top: 0
      }
    }, /*#__PURE__*/React.createElement(Rover, {
      moving: rover.moving,
      accent: terrain.accent,
      led: rover.led,
      scanning: rover.scanning
    }))), say && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: 0,
        top: -70,
        transform: counter,
        transformOrigin: 'center bottom'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "say-bubble",
      style: {
        left: 0,
        top: 0
      }
    }, say)))), showFx !== false ? /*#__PURE__*/React.createElement(Ambient, {
      terrain: terrain
    }) : null, showFx !== false ? /*#__PURE__*/React.createElement("div", {
      className: "vignette"
    }) : null, showFx !== false ? /*#__PURE__*/React.createElement("div", {
      className: "grain"
    }) : null, crashKey ? /*#__PURE__*/React.createElement("div", {
      className: "crash-flash",
      key: crashKey
    }) : null, /*#__PURE__*/React.createElement("div", {
      className: "hud-tr"
    }, /*#__PURE__*/React.createElement("div", {
      className: "terrain-name"
    }, terrain.name), /*#__PURE__*/React.createElement("div", {
      className: "terrain-coord"
    }, terrain.coord)), /*#__PURE__*/React.createElement("div", {
      className: "hud-bl"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hl"
    }, /*#__PURE__*/React.createElement("span", null, "Pos X"), /*#__PURE__*/React.createElement("span", null, rover.x.toFixed(0), " cm")), /*#__PURE__*/React.createElement("div", {
      className: "hl"
    }, /*#__PURE__*/React.createElement("span", null, "Pos Y"), /*#__PURE__*/React.createElement("span", null, (-rover.y).toFixed(0), " cm")), /*#__PURE__*/React.createElement("div", {
      className: "hl"
    }, /*#__PURE__*/React.createElement("span", null, "Heading"), /*#__PURE__*/React.createElement("span", null, (rover.heading % 360 + 360) % 360 | 0, "\xB0"))), onTilt && /*#__PURE__*/React.createElement("div", {
      className: "view-mode-pill"
    }, /*#__PURE__*/React.createElement("button", {
      className: tl <= 4 ? 'on' : '',
      onClick: () => onTilt(0)
    }, "2D"), /*#__PURE__*/React.createElement("button", {
      className: tl > 4 ? 'on' : '',
      onClick: () => onTilt(46)
    }, "3D")), /*#__PURE__*/React.createElement("div", {
      className: "orbit-hint"
    }, "Drag to orbit \xB7 scroll to zoom"));
  }
  window.Viewport = Viewport;
})();
})();

;(function () {
/* Real WebGL 3D viewport (Three.js, vendored offline).
 *
 * Renders the world and the rover as actual 3D geometry, driven by the same
 * live rover state the 2.5D view uses. Two cameras: a third-person orbit you
 * can drag to revolve around the rover, and a first-person view mounted on the
 * rover looking the way it drives. All Three.js work lives inside useEffect so
 * the offline bundle-render test (which has no WebGL) never touches it.
 */
(function () {
  const {
    useRef,
    useEffect
  } = React;

  // Engine world is in centimetres (roughly +/-1500). Scale it down to a
  // comfortable number of 3D units.
  const SCALE = 0.03;
  const SKY = {
    room: 0xe9ddc8,
    city: 0x93acc0,
    earth: 0x9ec7e8,
    mars: 0xd98a5a,
    underwater: 0x0b3a4c,
    space: 0x05060d
  };
  const GROUND = {
    room: 0x9c7b50,
    city: 0x2b313d,
    earth: 0x4a6b39,
    mars: 0x9a4a2e,
    underwater: 0x1c4a55,
    space: 0x3a3c44
  };
  const FOG = {
    room: 0xe9ddc8,
    city: 0xb3c2cc,
    earth: 0xb6cdba,
    mars: 0xc08050,
    underwater: 0x0a2a38,
    space: 0x05060d
  };
  function Viewport3D({
    terrain,
    rover,
    fpv
  }) {
    const mountRef = useRef(null);
    const stateRef = useRef({
      x: 0,
      y: 0,
      heading: 0
    });
    const fpvRef = useRef(!!fpv);
    stateRef.current = rover || stateRef.current;
    fpvRef.current = !!fpv;
    useEffect(() => {
      const THREE = typeof window !== 'undefined' && window.THREE;
      const mount = mountRef.current;
      if (!THREE || !mount) return undefined;
      const id = terrain && terrain.id || 'earth';
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
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true
        });
      } catch (err) {
        mount.innerHTML = '<div class="vp3d-fail">3D needs a graphics card this machine cannot give. Switch to the 2.5D view in the bar.</div>';
        return undefined;
      }
      let disposed = false;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      renderer.shadowMap.enabled = true;
      // Softer shadows and filmic tone mapping lift the look out of the flat,
      // plasticky default that read as generic.
      if (THREE.PCFSoftShadowMap != null) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (THREE.ACESFilmicToneMapping != null) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
      }
      if (THREE.SRGBColorSpace != null) renderer.outputColorSpace = THREE.SRGBColorSpace;else if (THREE.sRGBEncoding != null) renderer.outputEncoding = THREE.sRGBEncoding;
      const canvas = renderer.domElement;
      canvas.setAttribute('tabindex', '0');
      canvas.setAttribute('aria-label', 'Three dimensional world. Drag or use the arrow keys to orbit, plus and minus to zoom.');
      const onContextLost = e => {
        e.preventDefault();
        mount.classList.add('vp3d-lost');
      };
      canvas.addEventListener('webglcontextlost', onContextLost, false);
      mount.appendChild(canvas);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(SKY[id] != null ? SKY[id] : SKY.earth);
      scene.fog = new THREE.Fog(FOG[id] != null ? FOG[id] : FOG.earth, 60, 220);
      const camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 2000);

      // Lights. Indoors (room) is warm and soft; outdoors is daylight.
      const indoor = id === 'room';
      const skyCol2 = indoor ? 0xfff1de : 0xffffff;
      const grndCol2 = indoor ? 0x3a2f28 : 0x404048;
      scene.add(new THREE.HemisphereLight(skyCol2, grndCol2, id === 'space' ? 0.45 : indoor ? 0.7 : 0.9));
      const sun = new THREE.DirectionalLight(indoor ? 0xffe9c4 : 0xfff4e2, id === 'space' ? 0.7 : indoor ? 0.85 : 1.05);
      sun.position.set(indoor ? 18 : 40, indoor ? 38 : 80, indoor ? 22 : 30);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024); // sharper than the old 512, still light on iGPUs
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 320;
      sun.shadow.camera.left = -120;
      sun.shadow.camera.right = 120;
      sun.shadow.camera.top = 120;
      sun.shadow.camera.bottom = -120;
      sun.shadow.bias = -0.0006;
      if (sun.shadow.radius != null) sun.shadow.radius = 3;
      scene.add(sun);
      // A soft fill from the opposite side so shadowed faces are not black.
      const fill = new THREE.DirectionalLight(0xbcd2ff, indoor ? 0.18 : 0.28);
      fill.position.set(-30, 26, -22);
      scene.add(fill);

      // A gradient sky dome so the world has a horizon, not a flat wall of fog.
      const skyTop = new THREE.Color(SKY[id] != null ? SKY[id] : SKY.earth);
      const skyBot = new THREE.Color(FOG[id] != null ? FOG[id] : FOG.earth);
      const skyGeo = new THREE.SphereGeometry(900, 24, 12);
      const skyCol = [];
      const pos = skyGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const t = Math.max(0, Math.min(1, pos.getY(i) / 900 * 0.5 + 0.5));
        const c = skyBot.clone().lerp(skyTop, t);
        skyCol.push(c.r, c.g, c.b);
      }
      skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyCol, 3));
      const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        fog: false
      }));
      scene.add(sky);

      // Ground.
      const groundMat = new THREE.MeshStandardMaterial({
        color: GROUND[id] != null ? GROUND[id] : GROUND.earth,
        roughness: 1
      });
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      if (indoor) {
        groundMat.roughness = 0.7;
        groundMat.metalness = 0.05;
      }
      scene.add(ground);
      if (id !== 'city' && id !== 'room') {
        const grid = new THREE.GridHelper(400, 80, 0x000000, 0x000000);
        grid.material.opacity = 0.08;
        grid.material.transparent = true;
        scene.add(grid);
      }

      // Moving agents (city pedestrians and cars); each gets an update(t) called
      // every frame so the world is alive, not a still set of props.
      const agents = [];

      // Obstacles as 3D meshes (trees + rocks on Earth, rocks elsewhere).
      const rockMat = new THREE.MeshStandardMaterial({
        color: id === 'mars' ? 0x7e3a26 : id === 'underwater' ? 0x2c6068 : 0x6a6a64,
        roughness: 1,
        flatShading: true
      });
      const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x6b4f2c,
        roughness: 1
      });
      const leafMat = new THREE.MeshStandardMaterial({
        color: 0x356b2a,
        roughness: 1,
        flatShading: true
      });
      const coralMat = new THREE.MeshStandardMaterial({
        color: 0xc9607a,
        roughness: 0.85,
        flatShading: true
      });
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0x4a4c54,
        roughness: 1,
        flatShading: true
      });
      const mkRock = (r, px, pz, v, rot) => {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat);
        rock.position.set(px, r * 0.55, pz);
        rock.rotation.set(v * 3, rot || 0, v * 2);
        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);
      };
      const obstacles = terrain && terrain.obstacles || [];
      if (id !== 'city' && id !== 'room') obstacles.forEach(o => {
        const r = Math.max(0.6, o.r * SCALE);
        const px = o.x * SCALE,
          pz = -o.y * SCALE;
        if (id === 'earth' && o.v >= 0.5) {
          // tree: trunk + canopy
          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.24, r * 1.4, 6), trunkMat);
          trunk.position.y = r * 0.7;
          trunk.castShadow = true;
          const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 1.1, 0), leafMat);
          canopy.position.y = r * 1.9;
          canopy.castShadow = true;
          tree.add(trunk);
          tree.add(canopy);
          tree.position.set(px, 0, pz);
          scene.add(tree);
        } else if (id === 'underwater' && o.v >= 0.45) {
          // coral: a small clump of upright branches
          const coral = new THREE.Group();
          const n = 3 + (o.v * 4 | 0);
          for (let k = 0; k < n; k++) {
            const a = k / n * Math.PI * 2;
            const br = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, r * (1.0 + k % 2 * 0.6), 5), coralMat);
            br.position.set(Math.cos(a) * r * 0.4, r * 0.6, Math.sin(a) * r * 0.4);
            br.rotation.z = Math.cos(a) * 0.3;
            br.rotation.x = Math.sin(a) * 0.3;
            br.castShadow = true;
            coral.add(br);
          }
          coral.position.set(px, 0, pz);
          scene.add(coral);
        } else if (id === 'space' && o.v >= 0.5) {
          // crater: a low rim ring lying on the ground
          const crater = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.34, 6, 16), rimMat);
          crater.rotation.x = Math.PI / 2;
          crater.position.set(px, r * 0.18, pz);
          crater.receiveShadow = true;
          crater.castShadow = true;
          scene.add(crater);
        } else {
          mkRock(r, px, pz, o.v, o.rot);
        }
      });

      // ---- Proper 3D city and room scenes (meshes, not generic rocks). ----
      function makeWindowTex() {
        try {
          if (!document || !document.createElement) return null;
          const cv = document.createElement('canvas');
          cv.width = 64;
          cv.height = 96;
          const g = cv.getContext && cv.getContext('2d');
          if (!g) return null;
          g.fillStyle = '#39414f';
          g.fillRect(0, 0, 64, 96);
          for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 4; xx++) {
            g.fillStyle = Math.random() < 0.5 ? '#ffe6a0' : '#222a38';
            g.fillRect(6 + xx * 14, 6 + yy * 11, 9, 7);
          }
          const t = new THREE.CanvasTexture(cv);
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          return t;
        } catch (e) {
          return null;
        }
      }
      function mkCar(col) {
        const car = new THREE.Group();
        const bodyM = new THREE.MeshStandardMaterial({
          color: col,
          roughness: 0.35,
          metalness: 0.45
        });
        const lower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 1.7), bodyM);
        lower.position.y = 0.7;
        lower.castShadow = true;
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 1.5), bodyM);
        cabin.position.set(-0.2, 1.45, 0);
        cabin.castShadow = true;
        const glassM = new THREE.MeshStandardMaterial({
          color: 0xaad4ee,
          roughness: 0.1,
          metalness: 0.3,
          transparent: true,
          opacity: 0.7
        });
        const glass = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.66, 1.36), glassM);
        glass.position.set(-0.2, 1.45, 0);
        car.add(lower);
        car.add(cabin);
        car.add(glass);
        const wM = new THREE.MeshStandardMaterial({
          color: 0x14161b,
          roughness: 0.9
        });
        [[1.1, 0.95], [1.1, -0.95], [-1.1, 0.95], [-1.1, -0.95]].forEach(([wx, wz]) => {
          const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.34, 14), wM);
          wh.rotation.x = Math.PI / 2;
          wh.position.set(wx, 0.5, wz);
          wh.castShadow = true;
          car.add(wh);
        });
        return car;
      }
      function mkPerson(shirt) {
        const p = new THREE.Group();
        const legM = new THREE.MeshStandardMaterial({
          color: 0x2f3646,
          roughness: 0.9
        });
        const shirtM = new THREE.MeshStandardMaterial({
          color: shirt,
          roughness: 0.85
        });
        const skinM = new THREE.MeshStandardMaterial({
          color: 0xe8c9a8,
          roughness: 0.7
        });
        const Cap = THREE.CapsuleGeometry ? THREE.CapsuleGeometry : null;
        const torso = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.42, 0.8, 4, 8) : new THREE.CylinderGeometry(0.42, 0.42, 1.4, 8), shirtM);
        torso.position.y = 1.7;
        torso.castShadow = true;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12), skinM);
        head.position.y = 2.5;
        head.castShadow = true;
        const lLeg = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.18, 0.7, 3, 6) : new THREE.CylinderGeometry(0.18, 0.18, 1.0, 6), legM);
        lLeg.position.set(-0.2, 0.85, 0);
        const rLeg = new THREE.Mesh(Cap ? new THREE.CapsuleGeometry(0.18, 0.7, 3, 6) : new THREE.CylinderGeometry(0.18, 0.18, 1.0, 6), legM);
        rLeg.position.set(0.2, 0.85, 0);
        p.add(torso);
        p.add(head);
        p.add(lLeg);
        p.add(rLeg);
        p._legs = [lLeg, rLeg];
        return p;
      }
      function buildCity() {
        const HALF = 1500 * SCALE; // 45 units
        const ROADW = 150 * SCALE * 2; // 9 units carriageway
        const asphalt = new THREE.MeshStandardMaterial({
          color: 0x23272f,
          roughness: 0.95
        });
        const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, ROADW), asphalt);
        hRoad.rotation.x = -Math.PI / 2;
        hRoad.position.y = 0.02;
        hRoad.receiveShadow = true;
        scene.add(hRoad);
        const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROADW, HALF * 2), asphalt);
        vRoad.rotation.x = -Math.PI / 2;
        vRoad.position.y = 0.021;
        vRoad.receiveShadow = true;
        scene.add(vRoad);
        const dashM = new THREE.MeshBasicMaterial({
          color: 0xe6d886
        });
        for (let i = -HALF; i < HALF; i += 4.2) {
          if (Math.abs(i) < ROADW / 2) continue;
          const d1 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.22), dashM);
          d1.rotation.x = -Math.PI / 2;
          d1.position.set(i, 0.03, 0);
          scene.add(d1);
          const d2 = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 2.2), dashM);
          d2.rotation.x = -Math.PI / 2;
          d2.position.set(0, 0.03, i);
          scene.add(d2);
        }
        const zM = new THREE.MeshBasicMaterial({
          color: 0xe8ecf2
        });
        for (let k = 0; k < 6; k++) {
          const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.7, ROADW * 0.92), zM);
          bar.rotation.x = -Math.PI / 2;
          bar.position.set(ROADW / 2 + 1.4 + k * 1.3, 0.03, 0);
          scene.add(bar);
        }
        const winTex = makeWindowTex();
        obstacles.forEach(o => {
          const px = o.x * SCALE,
            pz = -o.y * SCALE;
          if (o.kind === 'building') {
            const w = Math.max(3, o.r * SCALE * 1.4),
              hgt = w * (1.7 + o.v % 0.7);
            const m = winTex ? new THREE.MeshStandardMaterial({
              map: winTex.clone(),
              color: 0x8b94a1,
              roughness: 0.8
            }) : new THREE.MeshStandardMaterial({
              color: 0x5a6472,
              roughness: 0.85
            });
            if (m.map) {
              m.map.repeat.set(2, Math.max(2, Math.round(hgt / 4)));
              m.map.needsUpdate = true;
            }
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, w), m);
            b.position.set(px, hgt / 2, pz);
            b.castShadow = true;
            b.receiveShadow = true;
            scene.add(b);
            const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.4, w * 1.05), new THREE.MeshStandardMaterial({
              color: 0x343b45,
              roughness: 1
            }));
            roof.position.set(px, hgt + 0.2, pz);
            scene.add(roof);
          } else if (o.kind === 'car') {
            const car = mkCar(o.v < 0.5 ? 0xc0392b : 0x2c6fb0);
            car.position.set(px, 0, pz);
            car.rotation.y = (o.rot || 0) * Math.PI / 180;
            scene.add(car);
          }
        });
        const PAVE = ROADW / 2 + 2.6;
        const shirts = [0xd98c4a, 0x5aa0d8, 0x8a6fc0, 0x5bbf86, 0xd35d7a];
        for (let i = 0; i < 7; i++) {
          const horiz = i % 2 === 0;
          const lane = (i % 4 < 2 ? 1 : -1) * PAVE;
          const sp = 2.2 + i % 3 * 0.7,
            off = i * 0.9,
            span = 56;
          const pr = mkPerson(shirts[i % shirts.length]);
          scene.add(pr);
          agents.push({
            mesh: pr,
            update: t => {
              const ph = (t * sp / span + off) % 2;
              const tri = ph < 1 ? ph : 2 - ph;
              const along = (tri - 0.5) * span;
              pr.position.set(horiz ? along : lane, 0, horiz ? lane : along);
              pr.rotation.y = horiz ? ph < 1 ? Math.PI / 2 : -Math.PI / 2 : ph < 1 ? 0 : Math.PI;
              const sw = Math.sin(t * 6 + off * 3) * 0.5;
              if (pr._legs) {
                pr._legs[0].rotation.x = sw;
                pr._legs[1].rotation.x = -sw;
              }
            }
          });
        }
        [[true, -2.2, 6.0, 0x2c6fb0], [false, 2.2, 5.2, 0x4aa564]].forEach((cfg, i) => {
          const h = cfg[0],
            lane = cfg[1],
            sp = cfg[2],
            col = cfg[3];
          const car = mkCar(col);
          scene.add(car);
          agents.push({
            mesh: car,
            update: t => {
              const ph = (t * sp / (HALF * 2) + i * 0.4) % 2;
              const tri = ph < 1 ? ph : 2 - ph;
              const along = (tri - 0.5) * (HALF * 2);
              car.position.set(h ? along : lane, 0, h ? lane : along);
              car.rotation.y = h ? ph < 1 ? -Math.PI / 2 : Math.PI / 2 : ph < 1 ? Math.PI : 0;
            }
          });
        });
      }
      function buildRoom() {
        const R = 30;
        const wallM = new THREE.MeshStandardMaterial({
          color: 0xcdbfa8,
          roughness: 0.95,
          side: THREE.DoubleSide
        });
        const wallH = 14;
        const mkWall = (w, x, z, ry) => {
          const ww = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 0.6), wallM);
          ww.position.set(x, wallH / 2, z);
          ww.rotation.y = ry;
          ww.receiveShadow = true;
          scene.add(ww);
        };
        mkWall(R * 2, 0, -R, 0);
        mkWall(R * 2, -R, 0, Math.PI / 2);
        mkWall(R * 2, R, 0, Math.PI / 2);
        const rug = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), new THREE.MeshStandardMaterial({
          color: 0x9a5f54,
          roughness: 1
        }));
        rug.rotation.x = -Math.PI / 2;
        rug.position.y = 0.03;
        scene.add(rug);
        const sofaM = new THREE.MeshStandardMaterial({
          color: 0x3f6f8c,
          roughness: 0.85
        });
        const sofa = new THREE.Group();
        const seat = new THREE.Mesh(new THREE.BoxGeometry(10, 1.4, 4), sofaM);
        seat.position.y = 1.6;
        seat.castShadow = true;
        const back = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 1), sofaM);
        back.position.set(0, 2.8, -1.7);
        back.castShadow = true;
        const aL = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 4), sofaM);
        aL.position.set(-5.5, 2.2, 0);
        const aR = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 4), sofaM);
        aR.position.set(5.5, 2.2, 0);
        sofa.add(seat);
        sofa.add(back);
        sofa.add(aL);
        sofa.add(aR);
        sofa.position.set(0, 0, -R + 6);
        scene.add(sofa);
        const woodM = new THREE.MeshStandardMaterial({
          color: 0x7a5536,
          roughness: 0.7
        });
        const table = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 4), woodM);
        table.position.set(0, 2.2, 2);
        table.castShadow = true;
        scene.add(table);
        [[3, 1.8], [3, -1.8], [-3, 1.8], [-3, -1.8]].forEach(p => {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), woodM);
          leg.position.set(p[0], 1.1, 2 + p[1]);
          scene.add(leg);
        });
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(8, 9, 1.2), woodM);
        shelf.position.set(R - 2, 4.5, -8);
        shelf.castShadow = true;
        scene.add(shelf);
        for (let s = 0; s < 3; s++) {
          const bk = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.4, 1.0), new THREE.MeshStandardMaterial({
            color: 0x6a4f2c,
            roughness: 1
          }));
          bk.position.set(R - 2, 2 + s * 3, -8);
          scene.add(bk);
        }
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 1.8, 10), new THREE.MeshStandardMaterial({
          color: 0xb56a45,
          roughness: 1
        }));
        pot.position.set(-R + 4, 0.9, -R + 4);
        pot.castShadow = true;
        scene.add(pot);
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 0), new THREE.MeshStandardMaterial({
          color: 0x3f7d3a,
          roughness: 1,
          flatShading: true
        }));
        leaf.position.set(-R + 4, 3.4, -R + 4);
        leaf.castShadow = true;
        scene.add(leaf);
        const lamp = new THREE.PointLight(0xffd9a0, 0.7, 70);
        lamp.position.set(R - 8, 11, 8);
        scene.add(lamp);
      }
      if (id === 'city') buildCity();else if (id === 'room') buildRoom();

      // Rover: a body + a bright nose so its facing is obvious, on four wheels.
      const rov = new THREE.Group();
      const accent = new THREE.Color(terrain && terrain.accent || '#5ce0d8');
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 1.6), new THREE.MeshStandardMaterial({
        color: 0x2b2f3a,
        roughness: 0.6,
        metalness: 0.2
      }));
      body.position.y = 0.85;
      body.castShadow = true;
      const noseMat = new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: 0.5
      });
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 1.2), noseMat);
      nose.position.set(1.35, 0.9, 0);
      // A raised arrow on top, pointing forward, so the facing reads from any
      // orbit angle and in low-contrast worlds (the QA flagged the bare nose).
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 4), noseMat);
      arrow.rotation.z = -Math.PI / 2; // point along +x (forward)
      arrow.position.set(0.2, 2.0, 0);
      rov.add(body);
      rov.add(nose);
      rov.add(arrow);
      const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12);
      const wheelMat = new THREE.MeshStandardMaterial({
        color: 0x111317,
        roughness: 0.9
      });
      const wheels = [];
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(sx * 0.9, 0.45, sz * 0.85);
        wheel.castShadow = true;
        rov.add(wheel);
        wheels.push(wheel);
      });
      scene.add(rov);

      // A trail ribbon that grows as the rover drives.
      const MAXPTS = 600;
      const trailPos = new Float32Array(MAXPTS * 3);
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
      trailGeo.setDrawRange(0, 0);
      const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.85
      }));
      scene.add(trail);
      let trailN = 0;

      // Smoothed render state (lerped toward the live rover each frame).
      const cur = new THREE.Vector3(0, 0, 0);
      let curHeading = 0;
      const camPos = new THREE.Vector3(0, 20, 30);

      // Third-person orbit: drag to rotate, wheel or two-finger pinch to zoom,
      // so it works on a tablet or Chromebook as well as a mouse.
      let azim = 2.4,
        elev = 0.62,
        dist = 26,
        dragging = false,
        lx = 0,
        ly = 0;
      const dom = renderer.domElement;
      const ptrs = new Map();
      let pinch = 0;
      const pinchGap = () => {
        const v = [...ptrs.values()];
        return v.length < 2 ? 0 : Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
      };
      const onDown = e => {
        ptrs.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY
        });
        if (ptrs.size === 1) {
          dragging = true;
          lx = e.clientX;
          ly = e.clientY;
        } else {
          dragging = false;
          pinch = pinchGap();
        }
      };
      const onUp = e => {
        ptrs.delete(e.pointerId);
        if (ptrs.size < 2) pinch = 0;
        if (ptrs.size === 0) dragging = false;
      };
      const onMove = e => {
        if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY
        });
        if (ptrs.size >= 2) {
          const g = pinchGap();
          if (pinch) dist = Math.max(8, Math.min(80, dist + (pinch - g) * 0.05));
          pinch = g;
          return;
        }
        if (!dragging) return;
        azim -= (e.clientX - lx) * 0.008;
        elev = Math.max(0.12, Math.min(1.45, elev - (e.clientY - ly) * 0.006));
        lx = e.clientX;
        ly = e.clientY;
      };
      const onWheel = e => {
        dist = Math.max(8, Math.min(80, dist + e.deltaY * 0.03));
        e.preventDefault();
      };
      // Keyboard control so the orbit camera works without a pointer drag
      // (the QA flagged this as a WCAG keyboard-access gap).
      const onKey = e => {
        const k = e.key;
        if (k === 'ArrowLeft') azim -= 0.12;else if (k === 'ArrowRight') azim += 0.12;else if (k === 'ArrowUp') elev = Math.min(1.45, elev + 0.08);else if (k === 'ArrowDown') elev = Math.max(0.12, elev - 0.08);else if (k === '+' || k === '=') dist = Math.max(8, dist - 2);else if (k === '-' || k === '_') dist = Math.min(80, dist + 2);else return;
        e.preventDefault();
      };
      dom.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointermove', onMove);
      dom.addEventListener('wheel', onWheel, {
        passive: false
      });
      dom.addEventListener('keydown', onKey);
      const onResize = () => {
        w = mount.clientWidth || w;
        h = mount.clientHeight || h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
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
      // Auto-quality: if the first couple of seconds run slow on a weak GPU,
      // drop shadows and the pixel ratio once so the view stays usable.
      let frames = 0,
        slow = 0,
        downgraded = false,
        last = window.performance && window.performance.now ? window.performance.now() : 0;
      const tick = () => {
        if (disposed) return;
        const now = window.performance && window.performance.now ? window.performance.now() : last + 16;
        const dt = now - last;
        last = now;
        if (!downgraded && ++frames > 12) {
          if (dt > 40) slow++;else slow = Math.max(0, slow - 1);
          if (slow > 30) {
            renderer.shadowMap.enabled = false;
            sun.castShadow = false;
            renderer.setPixelRatio(1);
            downgraded = true;
          }
        }
        const s = stateRef.current;
        const tx = s.x * SCALE,
          tz = -s.y * SCALE;
        const tr = (s.heading || 0) * Math.PI / 180;
        const px0 = cur.x,
          pz0 = cur.z;
        // Glide the rover toward the live state instead of snapping to it.
        cur.x += (tx - cur.x) * posLerp;
        cur.z += (tz - cur.z) * posLerp;
        curHeading = angLerp(curHeading, tr, posLerp);
        rov.position.set(cur.x, 0, cur.z);
        rov.rotation.y = curHeading;
        const moved = Math.hypot(cur.x - px0, cur.z - pz0);
        if (moved > 0.001) wheels.forEach(wh => wh.rotateY(moved * 1.6));
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

        // Drive the live city agents (pedestrians, traffic).
        if (agents.length) {
          const tsec = now / 1000;
          for (let i = 0; i < agents.length; i++) agents[i].update(tsec);
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
        scene.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
        });
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      };
    }, [terrain && terrain.id]);
    return React.createElement('div', {
      className: 'viewport3d',
      ref: mountRef
    });
  }
  window.Viewport3D = Viewport3D;
})();
})();

;(function () {
/* ============================================================================
   ORBITAL ROVER — Code editor
   Transparent textarea over a syntax-highlighted <pre>, with a line-number
   gutter and an active-line marker driven by the interpreter.
   Exposes window.Editor
   ========================================================================== */
(function () {
  const {
    useRef,
    useEffect
  } = React;
  const KEYWORDS = ['for', 'in', 'while', 'if', 'elif', 'else', 'def', 'return', 'break', 'continue', 'pass', 'and', 'or', 'not', 'import', 'from'];
  const CONSTS = ['True', 'False', 'None'];
  const BUILTINS = ['print', 'range', 'len', 'int', 'float', 'str', 'abs', 'round', 'min', 'max', 'sqrt', 'random'];
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function highlight(code) {
    let out = '';
    const lines = code.split('\n');
    for (let li = 0; li < lines.length; li++) {
      let line = lines[li];
      out += highlightLine(line);
      if (li < lines.length - 1) out += '\n';
    }
    return out;
  }
  function highlightLine(line) {
    let res = '';
    let i = 0;
    const n = line.length;
    const isIdStart = c => /[A-Za-z_]/.test(c);
    const isId = c => /[A-Za-z0-9_]/.test(c);
    while (i < n) {
      const c = line[i];
      // comment
      if (c === '#') {
        res += '<span class="tok-com">' + esc(line.slice(i)) + '</span>';
        break;
      }
      // string
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && line[j] !== c) {
          if (line[j] === '\\') j++;
          j++;
        }
        res += '<span class="tok-str">' + esc(line.slice(i, Math.min(j + 1, n))) + '</span>';
        i = j + 1;
        continue;
      }
      // number
      if (/[0-9]/.test(c)) {
        let j = i + 1;
        while (j < n && /[0-9.]/.test(line[j])) j++;
        res += '<span class="tok-num">' + esc(line.slice(i, j)) + '</span>';
        i = j;
        continue;
      }
      // identifier
      if (isIdStart(c)) {
        let j = i + 1;
        while (j < n && isId(line[j])) j++;
        const word = line.slice(i, j);
        const after = line.slice(j);
        // rover.method
        if (word === 'rover') {
          res += '<span class="tok-rover">rover</span>';
          i = j;
          continue;
        }
        if (KEYWORDS.indexOf(word) >= 0) res += '<span class="tok-kw">' + word + '</span>';else if (CONSTS.indexOf(word) >= 0) res += '<span class="tok-num">' + word + '</span>';else if (/^\s*\(/.test(after) || BUILTINS.indexOf(word) >= 0) res += '<span class="tok-fn">' + word + '</span>';else res += esc(word);
        i = j;
        continue;
      }
      // operator / punctuation
      if ('+-*/%<>=!&|'.indexOf(c) >= 0) {
        res += '<span class="tok-op">' + esc(c) + '</span>';
        i++;
        continue;
      }
      res += esc(c);
      i++;
    }
    return res || '&nbsp;';
  }
  const LH = 21,
    PAD = 14;
  function Editor({
    code,
    onChange,
    activeLine,
    readOnly
  }) {
    const taRef = useRef(null);
    const preRef = useRef(null);
    const wrapRef = useRef(null);

    // auto-size textarea height to content
    useEffect(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.style.height = 'auto';
      ta.style.height = Math.max(ta.scrollHeight, wrapRef.current ? wrapRef.current.clientHeight : 200) + 'px';
    }, [code]);

    // keep active line in view
    useEffect(() => {
      if (!activeLine || !wrapRef.current) return;
      const wrap = wrapRef.current;
      const top = PAD + (activeLine - 1) * LH;
      if (top < wrap.scrollTop + 30 || top > wrap.scrollTop + wrap.clientHeight - 50) {
        wrap.scrollTo({
          top: Math.max(0, top - wrap.clientHeight / 2),
          behavior: 'smooth'
        });
      }
    }, [activeLine]);
    const lines = code.split('\n');
    function handleKey(e) {
      // Escape releases the textarea so keyboard-only users are never trapped
      // by Tab-inserts-spaces (WCAG 2.1.2 No Keyboard Trap).
      if (e.key === 'Escape') {
        e.target.blur();
        return;
      }
      const ta = e.target;
      const s = ta.selectionStart,
        en = ta.selectionEnd;
      const val = ta.value;
      if (e.key === 'Tab' && e.shiftKey) {
        // Shift+Tab: dedent up to 4 leading spaces on the current line.
        e.preventDefault();
        const ls = val.lastIndexOf('\n', s - 1) + 1;
        const lead = val.slice(ls).match(/^ {1,4}/);
        if (lead) {
          const cut = lead[0].length;
          onChange(val.slice(0, ls) + val.slice(ls + cut));
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = Math.max(ls, s - cut);
          });
        }
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        onChange(val.slice(0, s) + '    ' + val.slice(en));
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = s + 4;
        });
        return;
      }
      if (e.key === 'Enter') {
        // Auto-indent: keep the current line's leading spaces, and add 4 more
        // after a line that opens a block (ends with ':').
        e.preventDefault();
        const ls = val.lastIndexOf('\n', s - 1) + 1;
        const lineToCursor = val.slice(ls, s);
        const indent = (lineToCursor.match(/^ */) || [''])[0];
        const extra = /:\s*$/.test(lineToCursor) ? '    ' : '';
        const ins = '\n' + indent + extra;
        onChange(val.slice(0, s) + ins + val.slice(en));
        const caret = s + ins.length;
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = caret;
        });
      }
    }
    return /*#__PURE__*/React.createElement("div", {
      className: "editor-wrap",
      ref: wrapRef
    }, /*#__PURE__*/React.createElement("div", {
      className: "editor-grid"
    }, /*#__PURE__*/React.createElement("div", {
      className: "gutter"
    }, lines.map((_, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      className: 'gl' + (activeLine === i + 1 ? ' active' : '')
    }, i + 1))), /*#__PURE__*/React.createElement("div", {
      className: "code-layer",
      style: {
        position: 'relative',
        minWidth: 'max-content',
        flex: 1
      }
    }, activeLine ? /*#__PURE__*/React.createElement("div", {
      className: "line-hl",
      style: {
        top: PAD + (activeLine - 1) * LH
      }
    }) : null, /*#__PURE__*/React.createElement("pre", {
      className: "code-pre",
      ref: preRef,
      dangerouslySetInnerHTML: {
        __html: highlight(code)
      }
    }), /*#__PURE__*/React.createElement("textarea", {
      ref: taRef,
      className: "code-ta",
      value: code,
      spellCheck: false,
      readOnly: readOnly,
      "aria-label": "Python code editor. Press Tab to indent, Escape to move focus out.",
      "aria-multiline": "true",
      onChange: e => onChange(e.target.value),
      onKeyDown: handleKey,
      style: {
        minWidth: 'max-content'
      }
    }))));
  }
  window.Editor = Editor;
})();
})();

;(function () {
/* ============================================================================
   ORBITAL ROVER — Telemetry rail
   Live instrument cluster: compass, speed, proximity, battery, odometer, and
   the terrain environment readout (gravity, temperature, pressure, light).
   Exposes window.Telemetry
   ========================================================================== */
(function () {
  function norm(deg) {
    return (deg % 360 + 360) % 360;
  }
  function cardinal(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(norm(deg) / 45) % 8];
  }
  function Compass({
    heading,
    accent
  }) {
    const h = norm(heading);
    const ticks = [];
    for (let a = 0; a < 360; a += 30) {
      const major = a % 90 === 0;
      const r1 = major ? 27 : 30;
      const x1 = 37 + Math.sin(a * Math.PI / 180) * r1;
      const y1 = 37 - Math.cos(a * Math.PI / 180) * r1;
      const x2 = 37 + Math.sin(a * Math.PI / 180) * 33;
      const y2 = 37 - Math.cos(a * Math.PI / 180) * 33;
      ticks.push(/*#__PURE__*/React.createElement("line", {
        key: a,
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        stroke: "rgba(245,240,228,0.35)",
        strokeWidth: major ? 1.4 : 0.8
      }));
    }
    return /*#__PURE__*/React.createElement("svg", {
      className: "compass",
      viewBox: "0 0 74 74"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "37",
      cy: "37",
      r: "35",
      fill: "#08090f",
      stroke: "rgba(245,240,228,0.12)",
      strokeWidth: "1"
    }), ticks, /*#__PURE__*/React.createElement("text", {
      x: "37",
      y: "13",
      textAnchor: "middle",
      fontFamily: "JetBrains Mono",
      fontSize: "8",
      fill: "rgba(245,240,228,0.55)"
    }, "N"), /*#__PURE__*/React.createElement("g", {
      transform: `rotate(${h} 37 37)`,
      style: {
        transition: 'transform 200ms cubic-bezier(0.22,0.61,0.36,1)'
      }
    }, /*#__PURE__*/React.createElement("polygon", {
      points: "37,10 32,40 42,40",
      fill: accent
    }), /*#__PURE__*/React.createElement("polygon", {
      points: "37,64 32,40 42,40",
      fill: "rgba(245,240,228,0.22)"
    })), /*#__PURE__*/React.createElement("circle", {
      cx: "37",
      cy: "37",
      r: "3.2",
      fill: "#08090f",
      stroke: accent,
      strokeWidth: "1.4"
    }));
  }
  function Bar({
    k,
    v,
    pct,
    color
  }) {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "bm-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "bm-k"
    }, k), /*#__PURE__*/React.createElement("span", {
      className: "bm-v"
    }, v)), /*#__PURE__*/React.createElement("div", {
      className: "bar-track",
      style: {
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "bar-fill",
      style: {
        width: Math.max(0, Math.min(100, pct)) + '%',
        background: color
      }
    })));
  }
  function Telemetry({
    rover,
    terrain,
    sensorDist,
    odometer
  }) {
    const accent = terrain.accent;
    const env = terrain.env;
    const battery = rover.battery;
    const batColor = battery > 50 ? 'var(--success)' : battery > 20 ? 'var(--warning)' : 'var(--danger)';
    const speedPct = rover.speed / 100 * 100;
    const dist = sensorDist == null ? 600 : sensorDist;
    const distState = dist < 80 ? 'danger' : dist < 200 ? 'warn' : '';
    const distColor = dist < 80 ? 'var(--danger)' : dist < 200 ? 'var(--warning)' : accent;
    return /*#__PURE__*/React.createElement("div", {
      className: "tele-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tele-section"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Navigation"), /*#__PURE__*/React.createElement("div", {
      className: "compass-wrap"
    }, /*#__PURE__*/React.createElement(Compass, {
      heading: rover.heading,
      accent: accent
    }), /*#__PURE__*/React.createElement("div", {
      className: "compass-info"
    }, /*#__PURE__*/React.createElement("div", {
      className: "ci-deg"
    }, norm(rover.heading) | 0, "\xB0"), /*#__PURE__*/React.createElement("div", {
      className: "ci-card"
    }, cardinal(rover.heading)))), /*#__PURE__*/React.createElement("div", {
      className: "bar-meter",
      style: {
        marginTop: 14
      }
    }, /*#__PURE__*/React.createElement(Bar, {
      k: "Velocity",
      v: rover.speed.toFixed(0) + ' cm/s',
      pct: speedPct,
      color: accent
    }))), /*#__PURE__*/React.createElement("div", {
      className: "tele-section"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Proximity \xB7 Front Lidar"), /*#__PURE__*/React.createElement("div", {
      className: 'dist-readout ' + distState
    }, /*#__PURE__*/React.createElement("span", {
      className: "dr-val"
    }, dist >= 600 ? '600+' : dist.toFixed(0)), /*#__PURE__*/React.createElement("span", {
      className: "dr-unit"
    }, "cm to obstacle")), /*#__PURE__*/React.createElement("div", {
      className: "bar-track"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bar-fill",
      style: {
        width: Math.min(100, dist / 600 * 100) + '%',
        background: distColor
      }
    }))), /*#__PURE__*/React.createElement("div", {
      className: "tele-section"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Systems"), /*#__PURE__*/React.createElement("div", {
      className: "bar-meter"
    }, /*#__PURE__*/React.createElement(Bar, {
      k: "Battery",
      v: battery.toFixed(0) + '%',
      pct: battery,
      color: batColor
    }), /*#__PURE__*/React.createElement(Bar, {
      k: "Traction",
      v: (terrain.traction * 100).toFixed(0) + '%',
      pct: terrain.traction * 85,
      color: accent
    })), /*#__PURE__*/React.createElement("div", {
      className: "gauges",
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "gauge"
    }, /*#__PURE__*/React.createElement("span", {
      className: "g-label"
    }, "Odometer"), /*#__PURE__*/React.createElement("span", {
      className: "g-val"
    }, (odometer / 100).toFixed(1), /*#__PURE__*/React.createElement("span", {
      className: "g-unit"
    }, "m"))), /*#__PURE__*/React.createElement("div", {
      className: "gauge"
    }, /*#__PURE__*/React.createElement("span", {
      className: "g-label"
    }, "Status"), /*#__PURE__*/React.createElement("span", {
      className: "g-val",
      style: {
        fontSize: 13,
        color: rover.moving ? accent : 'var(--fg-3)',
        paddingTop: 4
      }
    }, rover.moving ? 'DRIVING' : 'IDLE')))), /*#__PURE__*/React.createElement("div", {
      className: "tele-section",
      style: {
        borderBottom: 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Environment"), /*#__PURE__*/React.createElement("div", {
      className: "gauges"
    }, /*#__PURE__*/React.createElement("div", {
      className: "gauge"
    }, /*#__PURE__*/React.createElement("span", {
      className: "g-label"
    }, "Gravity"), /*#__PURE__*/React.createElement("span", {
      className: "g-val"
    }, env.gravity, /*#__PURE__*/React.createElement("span", {
      className: "g-unit"
    }, "m/s\xB2"))), /*#__PURE__*/React.createElement("div", {
      className: "gauge"
    }, /*#__PURE__*/React.createElement("span", {
      className: "g-label"
    }, env.tempLabel), /*#__PURE__*/React.createElement("span", {
      className: "g-val"
    }, env.temp, /*#__PURE__*/React.createElement("span", {
      className: "g-unit"
    }, "\xB0C"))), /*#__PURE__*/React.createElement("div", {
      className: "gauge"
    }, /*#__PURE__*/React.createElement("span", {
      className: "g-label"
    }, env.pressureLabel), /*#__PURE__*/React.createElement("span", {
      className: "g-val"
    }, env.pressure, /*#__PURE__*/React.createElement("span", {
      className: "g-unit"
    }, env.pressureUnit))), /*#__PURE__*/React.createElement("div", {
      className: "gauge"
    }, /*#__PURE__*/React.createElement("span", {
      className: "g-label"
    }, "Light"), /*#__PURE__*/React.createElement("span", {
      className: "g-val"
    }, env.light, /*#__PURE__*/React.createElement("span", {
      className: "g-unit"
    }, "%"))))));
  }
  window.Telemetry = Telemetry;
})();
})();

;(function () {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-omelette-chrome": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}

// Schematic of the planned real robot, drawn from the parts list. Visual aid
// for the budget builder; highlights the major components that are present.
function RoverSchematic({
  parts
}) {
  const text = (parts || []).map(p => (p.name + ' ' + (p.role || '')).toLowerCase()).join(' ');
  const has = (...keys) => keys.some(k => text.includes(k));
  const board = has('esp32') ? 'ESP32' : has('micro:bit', 'microbit') ? 'micro:bit' : has('arduino') ? 'Arduino' : has('raspberry', 'pico') ? 'Pico' : 'MCU';
  const sensor = has('ultrasonic', 'hc-sr04', 'distance', 'lidar', 'sensor');
  const driver = has('driver', 'l298', 'tb6612');
  const battery = has('batter', 'coin', 'power', 'cell');
  return /*#__PURE__*/React.createElement("svg", {
    className: "schematic",
    viewBox: "0 0 320 150",
    xmlns: "http://www.w3.org/2000/svg",
    role: "img",
    "aria-label": "Robot schematic"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "80",
    y: "30",
    width: "160",
    height: "90",
    rx: "10",
    fill: "#161a2d",
    stroke: "#5ce0d8",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "58",
    y: "40",
    width: "22",
    height: "32",
    rx: "5",
    fill: "#3a4356",
    stroke: "#aeb8e8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "58",
    y: "84",
    width: "22",
    height: "32",
    rx: "5",
    fill: "#3a4356",
    stroke: "#aeb8e8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "240",
    y: "40",
    width: "22",
    height: "32",
    rx: "5",
    fill: "#3a4356",
    stroke: "#aeb8e8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "240",
    y: "84",
    width: "22",
    height: "32",
    rx: "5",
    fill: "#3a4356",
    stroke: "#aeb8e8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "120",
    y: "48",
    width: "80",
    height: "40",
    rx: "5",
    fill: "#1f6f6a",
    stroke: "#5ce0d8"
  }), /*#__PURE__*/React.createElement("text", {
    x: "160",
    y: "72",
    textAnchor: "middle",
    fill: "#eafffd",
    fontSize: "13",
    fontFamily: "monospace"
  }, board), sensor && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "150",
    y: "14",
    width: "20",
    height: "12",
    rx: "2",
    fill: "#e0b45c"
  }), /*#__PURE__*/React.createElement("text", {
    x: "160",
    y: "9",
    textAnchor: "middle",
    fill: "#cfd6f5",
    fontSize: "8"
  }, "sensor")), driver && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "92",
    y: "96",
    width: "40",
    height: "16",
    rx: "3",
    fill: "#3a4356",
    stroke: "#7cc49b"
  }), /*#__PURE__*/React.createElement("text", {
    x: "112",
    y: "107",
    textAnchor: "middle",
    fill: "#cfe7d6",
    fontSize: "8"
  }, "driver")), battery && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "186",
    y: "96",
    width: "44",
    height: "16",
    rx: "3",
    fill: "#3a4356",
    stroke: "#e0b45c"
  }), /*#__PURE__*/React.createElement("text", {
    x: "208",
    y: "107",
    textAnchor: "middle",
    fill: "#f0dcb0",
    fontSize: "8"
  }, "battery")), /*#__PURE__*/React.createElement("line", {
    x1: "160",
    y1: "120",
    x2: "160",
    y2: "134",
    stroke: "#5ce0d8",
    strokeDasharray: "3 3"
  }), /*#__PURE__*/React.createElement("text", {
    x: "160",
    y: "146",
    textAnchor: "middle",
    fill: "#8b93a7",
    fontSize: "8"
  }, "front of rover"));
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton,
  RoverSchematic
});
})();

;(function () {
/* Robot Lab -- design a custom robot, then validate it in the world.
 *
 * The reframed core of Kodro: a user picks a robot archetype (rover, self
 * driving car, personal robot, arm or a bare microcontroller build), fits it
 * with real hobby parts (an ESP32 or micro:bit board, sensors, actuators),
 * names it, and saves it. The chosen specification is NOT cosmetic -- it
 * drives the simulation: total mass changes how fast the battery drains, the
 * motor choice sets the top speed, and the fitted sensors decide which Python
 * commands the robot actually supports. This file is self contained and
 * exposes itself on window like every other module in the bundle.
 *
 *   window.RobotLab          -- the React panel component
 *   window.getKodroRobot()   -- the saved spec + derived sim factors
 */
(function () {
  const STORE = 'kodro_robot_v1';

  // ---- parts catalogue. mass is grams; "enables" lists the Python the part unlocks.
  const BOARDS = {
    esp32: {
      id: 'esp32',
      name: 'ESP32',
      mass: 10,
      note: 'Wi-Fi + Bluetooth, dual core. The hobby default.'
    },
    microbit: {
      id: 'microbit',
      name: 'micro:bit v2',
      mass: 9,
      note: 'Classroom friendly, built-in buttons and LEDs.'
    },
    pico: {
      id: 'pico',
      name: 'Raspberry Pi Pico',
      mass: 6,
      note: 'Cheap, low power, MicroPython native.'
    },
    uno: {
      id: 'uno',
      name: 'Arduino Uno',
      mass: 25,
      note: 'Rugged and forgiving, a classic first board.'
    }
  };
  const SENSORS = {
    ultrasonic: {
      id: 'ultrasonic',
      name: 'Ultrasonic range',
      mass: 9,
      enables: 'sensor()  distance ahead',
      cmd: 'sensor'
    },
    line: {
      id: 'line',
      name: 'Line follower',
      mass: 6,
      enables: 'on_line()  follow a track',
      cmd: 'on_line'
    },
    imu: {
      id: 'imu',
      name: 'IMU (gyro + accel)',
      mass: 4,
      enables: 'heading()  stable turns',
      cmd: 'heading'
    },
    camera: {
      id: 'camera',
      name: 'Camera',
      mass: 12,
      enables: 'see()  look for a marker',
      cmd: 'see'
    },
    gps: {
      id: 'gps',
      name: 'GPS',
      mass: 8,
      enables: 'locate()  position outdoors',
      cmd: 'locate'
    },
    bumper: {
      id: 'bumper',
      name: 'Bumper switch',
      mass: 5,
      enables: 'bumped()  contact stop',
      cmd: 'bumped'
    }
  };
  const ACTUATORS = {
    motors2: {
      id: 'motors2',
      name: '2 DC motors',
      mass: 120,
      speed: 1.0,
      note: 'Two wheels, differential drive.'
    },
    motors4: {
      id: 'motors4',
      name: '4 DC motors',
      mass: 220,
      speed: 1.25,
      note: 'Four wheels, more grip and torque.'
    },
    servos: {
      id: 'servos',
      name: 'Steering servo',
      mass: 40,
      speed: 1.1,
      note: 'Car style front steering.'
    },
    gripper: {
      id: 'gripper',
      name: 'Gripper arm',
      mass: 90,
      speed: 0.9,
      enables: 'grab()  pick things up',
      cmd: 'grab'
    }
  };
  const TYPES = {
    rover: {
      id: 'rover',
      name: 'Rover',
      emoji: '🛻',
      blurb: 'A wheeled explorer for rough ground. The all rounder.',
      base: {
        board: 'esp32',
        sensors: ['ultrasonic', 'imu'],
        actuators: ['motors4']
      }
    },
    car: {
      id: 'car',
      name: 'Self-driving car',
      emoji: '🚗',
      blurb: 'A road vehicle. Validate it among pedestrians and traffic.',
      base: {
        board: 'esp32',
        sensors: ['ultrasonic', 'camera', 'gps'],
        actuators: ['motors2', 'servos']
      }
    },
    home: {
      id: 'home',
      name: 'Personal robot',
      emoji: '🤖',
      blurb: 'A helper that shares space with people indoors.',
      base: {
        board: 'pico',
        sensors: ['ultrasonic', 'bumper', 'camera'],
        actuators: ['motors2', 'gripper']
      }
    },
    arm: {
      id: 'arm',
      name: 'Robotic arm',
      emoji: '🦾',
      blurb: 'A fixed manipulator. Reach, grab and place.',
      base: {
        board: 'uno',
        sensors: ['camera'],
        actuators: ['gripper']
      }
    },
    custom: {
      id: 'custom',
      name: 'Custom build',
      emoji: '🔧',
      blurb: 'Start bare and fit exactly the parts you want.',
      base: {
        board: 'esp32',
        sensors: [],
        actuators: ['motors2']
      }
    }
  };

  // Which world a build should be validated in first, and why. This is the
  // assistant reasoning about the robot: a road vehicle belongs among traffic,
  // a home robot in a room, an explorer on open terrain.
  const WORLD_FOR = {
    rover: {
      id: 'earth',
      label: 'Open terrain',
      why: 'an explorer is tested on rough open ground first.'
    },
    car: {
      id: 'city',
      label: 'Riverside City',
      why: 'a road vehicle must cope with traffic and pedestrians.'
    },
    home: {
      id: 'room',
      label: 'Living Room',
      why: 'a companion robot shares an indoor space with people and furniture.'
    },
    arm: {
      id: 'room',
      label: 'Living Room',
      why: 'a fixed manipulator works at a table indoors.'
    },
    custom: {
      id: 'city',
      label: 'Riverside City',
      why: 'start in the busy city, then try the others.'
    }
  };
  const CHASSIS_MASS = 380; // grams, frame + battery + wiring, before parts

  function defaultSpec() {
    const t = TYPES.rover;
    return {
      type: 'rover',
      name: 'My Rover',
      board: t.base.board,
      sensors: t.base.sensors.slice(),
      actuators: t.base.actuators.slice()
    };
  }
  function specFromType(typeId, prevName) {
    const t = TYPES[typeId] || TYPES.rover;
    return {
      type: typeId,
      name: prevName || t.name,
      board: t.base.board,
      sensors: t.base.sensors.slice(),
      actuators: t.base.actuators.slice()
    };
  }

  // ---- derive the numbers the simulation cares about from a spec.
  function derive(spec) {
    let mass = CHASSIS_MASS + (BOARDS[spec.board] ? BOARDS[spec.board].mass : 10);
    (spec.sensors || []).forEach(s => {
      if (SENSORS[s]) mass += SENSORS[s].mass;
    });
    let speed = 0;
    (spec.actuators || []).forEach(a => {
      if (ACTUATORS[a]) {
        mass += ACTUATORS[a].mass;
        speed = Math.max(speed, ACTUATORS[a].speed || 0);
      }
    });
    if (speed === 0) speed = 0.8; // no drive parts: it barely crawls
    const baseline = 900; // grams ~ a typical small rover
    const massFactor = Math.min(1.8, Math.max(0.6, mass / baseline));
    const speedFactor = Math.min(1.45, Math.max(0.7, speed));
    // crude runtime estimate: lighter + fewer parts last longer on one charge
    const runtimeMin = Math.round(60 / massFactor);
    const cmds = [];
    (spec.sensors || []).forEach(s => {
      if (SENSORS[s] && SENSORS[s].cmd) cmds.push(SENSORS[s].cmd);
    });
    (spec.actuators || []).forEach(a => {
      if (ACTUATORS[a] && ACTUATORS[a].cmd) cmds.push(ACTUATORS[a].cmd);
    });
    return {
      mass,
      massFactor,
      speedFactor,
      runtimeMin,
      commands: cmds
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      void e;
    }
    return defaultSpec();
  }
  function save(spec) {
    try {
      localStorage.setItem(STORE, JSON.stringify(spec));
    } catch (e) {
      void e;
    }
    const d = derive(spec);
    const rec = WORLD_FOR[spec.type] || {};
    window.KODRO_ROBOT = Object.assign({}, spec, d, {
      world: rec.id
    });
    try {
      window.dispatchEvent(new CustomEvent('kodro-robot', {
        detail: window.KODRO_ROBOT
      }));
    } catch (e) {
      void e;
    }
  }

  // Public accessor for the simulation (battery, speed, sensor gating).
  window.getKodroRobot = function () {
    if (!window.KODRO_ROBOT) {
      const s = load();
      window.KODRO_ROBOT = Object.assign({}, s, derive(s));
    }
    return window.KODRO_ROBOT;
  };
  // Make sure a default exists from first load so the sim never sees undefined.
  window.getKodroRobot();
  function Chip(props) {
    const on = props.on;
    return React.createElement('button', {
      type: 'button',
      className: 'rl-chip' + (on ? ' rl-chip-on' : ''),
      onClick: props.onClick,
      'aria-pressed': on
    }, React.createElement('span', {
      className: 'rl-chip-name'
    }, props.label), props.sub ? React.createElement('span', {
      className: 'rl-chip-sub'
    }, props.sub) : null);
  }
  function RobotLab(props) {
    const [spec, setSpec] = React.useState(load);
    const d = derive(spec);
    const t = TYPES[spec.type] || TYPES.rover;
    const rec = WORLD_FOR[spec.type] || WORLD_FOR.rover;
    function pickType(id) {
      setSpec(specFromType(id, null));
    }
    function toggle(kind, id) {
      setSpec(s => {
        const list = (s[kind] || []).slice();
        const i = list.indexOf(id);
        if (i >= 0) list.splice(i, 1);else list.push(id);
        return Object.assign({}, s, {
          [kind]: list
        });
      });
    }
    function onSave() {
      save(spec);
      if (props.onClose) props.onClose();
    }
    return React.createElement('div', {
      className: 'modal-backdrop',
      onClick: () => props.onClose && props.onClose()
    }, React.createElement('div', {
      className: 'modal modal-wide rl-modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Robot Lab',
      onClick: e => e.stopPropagation()
    }, React.createElement('div', {
      className: 'modal-head'
    }, React.createElement('span', {
      className: 'eyebrow'
    }, '🛠 Robot Lab — design a robot, then run it in the world'), React.createElement('button', {
      className: 'btn-mini',
      'aria-label': 'Close',
      onClick: () => props.onClose && props.onClose()
    }, '✕')), React.createElement('div', {
      className: 'rl-body'
    },
    // ---- choose archetype
    React.createElement('div', {
      className: 'rl-section'
    }, React.createElement('div', {
      className: 'rl-label'
    }, '1 · Pick a robot'), React.createElement('div', {
      className: 'rl-types'
    }, Object.keys(TYPES).map(id => {
      const ty = TYPES[id];
      return React.createElement('button', {
        key: id,
        type: 'button',
        className: 'rl-type' + (spec.type === id ? ' rl-type-on' : ''),
        onClick: () => pickType(id),
        'aria-pressed': spec.type === id
      }, React.createElement('span', {
        className: 'rl-type-emoji'
      }, ty.emoji), React.createElement('span', {
        className: 'rl-type-name'
      }, ty.name));
    })), React.createElement('p', {
      className: 'rl-blurb'
    }, t.blurb)),
    // ---- name + board
    React.createElement('div', {
      className: 'rl-section rl-row2'
    }, React.createElement('label', {
      className: 'rl-field'
    }, React.createElement('span', {
      className: 'rl-label'
    }, 'Name'), React.createElement('input', {
      className: 'rl-input',
      value: spec.name,
      maxLength: 28,
      onChange: e => setSpec(s => Object.assign({}, s, {
        name: e.target.value
      }))
    })), React.createElement('label', {
      className: 'rl-field'
    }, React.createElement('span', {
      className: 'rl-label'
    }, 'Controller board'), React.createElement('select', {
      className: 'rl-input',
      value: spec.board,
      onChange: e => setSpec(s => Object.assign({}, s, {
        board: e.target.value
      }))
    }, Object.keys(BOARDS).map(id => React.createElement('option', {
      key: id,
      value: id
    }, BOARDS[id].name))))), React.createElement('p', {
      className: 'rl-note'
    }, BOARDS[spec.board] ? BOARDS[spec.board].note : ''),
    // ---- sensors
    React.createElement('div', {
      className: 'rl-section'
    }, React.createElement('div', {
      className: 'rl-label'
    }, '2 · Sensors — each unlocks a command'), React.createElement('div', {
      className: 'rl-chips'
    }, Object.keys(SENSORS).map(id => React.createElement(Chip, {
      key: id,
      on: (spec.sensors || []).indexOf(id) >= 0,
      label: SENSORS[id].name,
      sub: SENSORS[id].enables,
      onClick: () => toggle('sensors', id)
    })))),
    // ---- actuators
    React.createElement('div', {
      className: 'rl-section'
    }, React.createElement('div', {
      className: 'rl-label'
    }, '3 · Drive & actuators'), React.createElement('div', {
      className: 'rl-chips'
    }, Object.keys(ACTUATORS).map(id => React.createElement(Chip, {
      key: id,
      on: (spec.actuators || []).indexOf(id) >= 0,
      label: ACTUATORS[id].name,
      sub: ACTUATORS[id].enables || (ACTUATORS[id].speed || 1) + '× speed',
      onClick: () => toggle('actuators', id)
    })))),
    // ---- live spec readout
    React.createElement('div', {
      className: 'rl-spec'
    }, React.createElement('div', {
      className: 'rl-stat'
    }, React.createElement('b', null, d.mass + ' g'), React.createElement('span', null, 'total mass')), React.createElement('div', {
      className: 'rl-stat'
    }, React.createElement('b', null, '~' + d.runtimeMin + ' min'), React.createElement('span', null, 'battery / charge')), React.createElement('div', {
      className: 'rl-stat'
    }, React.createElement('b', null, d.speedFactor.toFixed(2) + '×'), React.createElement('span', null, 'top speed')), React.createElement('div', {
      className: 'rl-stat rl-stat-wide'
    }, React.createElement('b', null, d.commands.length ? d.commands.map(c => c + '()').join('  ') : 'move()  turn()  only'), React.createElement('span', null, 'commands this build supports'))),
    // ---- the assistant recommends where to validate this robot first
    React.createElement('div', {
      className: 'rl-rec'
    }, React.createElement('span', {
      className: 'rl-rec-tag'
    }, 'Best tested in'), React.createElement('b', null, rec.label), React.createElement('span', {
      className: 'rl-rec-why'
    }, rec.why))), React.createElement('div', {
      className: 'rl-foot'
    }, React.createElement('button', {
      className: 'btn-mini',
      onClick: () => setSpec(specFromType(spec.type, spec.name))
    }, 'Reset parts'), React.createElement('button', {
      className: 'ctrl ctrl-run',
      onClick: onSave
    }, '✓ Build & test in ' + rec.label))));
  }
  window.RobotLab = RobotLab;
})();
})();

;(function () {
/* ============================================================================
   ORBITAL ROVER — App (runtime + UI wiring)
   ========================================================================== */
(function () {
  const {
    useState,
    useRef,
    useEffect,
    useCallback
  } = React;
  const TERRAINS = window.TERRAINS;
  const WALL = TERRAINS.WALL;
  const RobotLab = window.RobotLab;
  const R = 30; // rover collision radius (cm)
  // Live check (re-evaluated per move) so toggling the OS setting takes effect.
  const PREFERS_REDUCED_MOTION = () => typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  // ---------------- example programs ----------------
  const EXAMPLES = {
    basecamp: {
      label: 'basecamp.py',
      code: `# BASE CAMP - your code BUILDS the world.
# place(kind) plants a prop right where the rover stands:
# "flag", "beacon", "person", "tree", "rock", "crate".
set_speed(80)
pen_down()
say("Building base camp")

# Mark the centre of camp with a beacon.
place("beacon")

# Drive a square and drop a crate at every corner.
for corner in range(4):
    move_forward(2)
    place("crate")
    turn_right(90)

# Plant a flag line out front.
turn_right(45)
for i in range(3):
    move_forward(1.2)
    place("flag")

# The crew arrives.
move_forward(1.5)
place("person")
turn_left(90)
move_forward(1)
place("person")

# A bit of landscaping.
turn_left(135)
move_forward(2.5)
place("tree")
move_forward(1)
place("rock")

led("green")
say("Camp ready!")
print("Base camp built: 1 beacon, 4 crates, 3 flags, 2 crew, 1 tree, 1 rock")`
    },
    autopilot: {
      label: 'autopilot.py',
      code: `# AUTOPILOT - the rover drives itself, like a self-driving car.
# Every step it reads its lidar. It ONLY moves forward when the way
# is clear, so it can never hit a boulder OR the arena wall. When
# something looms it scans, probes left + right, and steers toward
# the side with more room. Pure sense-think-act. Press Run and watch.
rover.set_speed(72)
rover.pen_down()
rover.led("cyan")
rover.say("Autopilot engaged")

legs = 0
dodges = 0
scans = 0
steps = 0

# Self-drive: it only moves forward when the lidar says the way is clear,
# so it can never hit a boulder OR the arena wall. Whenever something looms
# it scans, probes left + right, and steers toward the side with more room -
# so it roams the whole field, dodging as it goes. Always terminates.
while legs < 60 and steps < 220:
    steps = steps + 1
    ahead = rover.distance()

    if ahead < 150:
        # Boulder or wall ahead: scan, sense both sides, steer clear.
        rover.led("amber")
        rover.scan()
        scans = scans + 1
        rover.turn_left(60)
        left = rover.distance()
        rover.turn_right(120)
        right = rover.distance()
        if left > right:
            rover.turn_left(150)
        else:
            rover.turn_left(25)
        dodges = dodges + 1
        rover.led("cyan")
    else:
        rover.forward(40)
        legs = legs + 1

rover.led("green")
rover.say("Area mapped")
print("Legs driven:", legs)
print("Boulders dodged:", dodges)
print("Lidar scans:", scans)`
    },
    drive: {
      label: 'starter.py',
      code: `# Welcome to Kodro.
# Edit freely, then press Run. The API is listed below.
rover.set_speed(60)
rover.pen_down()

rover.forward(200)
rover.turn_left(90)
rover.forward(140)
rover.say("Hello, terrain")`
    },
    square: {
      label: 'square.py',
      code: `# A for-loop draws a square. Change the 4 or the 300.
rover.pen_down()
rover.set_speed(75)

for side in range(4):
    rover.forward(300)
    rover.turn_right(90)

print("Square complete.")`
    },
    spiral: {
      label: 'spiral.py',
      code: `# Variables + loops make an expanding spiral.
rover.pen_down()
rover.set_speed(85)

step = 40
for i in range(20):
    rover.forward(step)
    rover.turn_right(42)
    step = step + 20

print("Drew", i + 1, "segments.")`
    },
    avoid: {
      label: 'avoid.py',
      code: `# Obstacle avoidance: read the lidar, branch with if/else.
rover.set_speed(80)
rover.pen_down()

trips = 0
while trips < 30:
    front = rover.distance()
    if front < 150:
        rover.turn_right(55)
    else:
        rover.forward(80)
    trips = trips + 1

print("Finished after", trips, "moves.")`
    },
    survey: {
      label: 'survey.py',
      code: `# Sensors + conditionals: profile the environment.
rover.led("amber")
rover.scan()

g = rover.gravity()
t = rover.temperature()
print("Gravity:", g, "m/s^2")
print("Temperature:", t, "C")

if g < 4:
    print("Low gravity. Momentum carries far.")
else:
    print("Standard footing.")

rover.led("green")
rover.forward(240)
rover.say("Survey done")`
    }
  };
  const LED_COLORS = {
    red: '#d06a6a',
    amber: '#e0b45c',
    green: '#7cc49b',
    cyan: '#5ce0d8',
    blue: '#aeb8e8',
    white: '#f5f0e4',
    off: null
  };

  // ---------------- icons ----------------
  const I = {
    play: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "currentColor"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M8 5v14l11-7z"
    })),
    pause: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "currentColor"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M6 5h4v14H6zM14 5h4v14h-4z"
    })),
    step: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M5 5v14M9 12h11M16 7l5 5-5 5"
    })),
    reset: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M4 12a8 8 0 108-8M4 12V6M4 12h6",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }))
  };
  function App() {
    const [terrainId, setTerrainId] = useState(() => localStorage.getItem('or_terrain') || 'mars');
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('or_tab') || 'autopilot');
    const [programs, setPrograms] = useState(() => {
      try {
        const s = JSON.parse(localStorage.getItem('or_programs'));
        if (s) return s;
      } catch (e) {}
      const o = {};
      Object.keys(EXAMPLES).forEach(k => o[k] = EXAMPLES[k].code);
      return o;
    });
    const [runState, setRunState] = useState('idle');
    const [activeLine, setActiveLine] = useState(0);
    const [consoleLines, setConsoleLines] = useState([{
      type: 'sys',
      text: 'Kodro ready. Press Run to deploy.'
    }]);
    const [speedMul, setSpeedMul] = useState(1);
    const [say, setSay] = useState('');
    const [crashKey, setCrashKey] = useState(0);
    const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
    const [cam, setCam] = useState({
      tilt: 46,
      yaw: -8,
      zoom: 1
    });
    // Real WebGL 3D viewport (Three.js) with third-person orbit / first-person.
    const [view3d, setView3d] = useState(() => localStorage.getItem('or_view3d') !== '0');
    const [fpv, setFpv] = useState(() => localStorage.getItem('or_fpv') === '1');
    useEffect(() => {
      try {
        localStorage.setItem('or_view3d', view3d ? '1' : '0');
      } catch (e) {
        void e;
      }
    }, [view3d]);
    useEffect(() => {
      try {
        localStorage.setItem('or_fpv', fpv ? '1' : '0');
      } catch (e) {
        void e;
      }
    }, [fpv]);
    // Escape leaves first person fast (a quick exit for motion sensitivity).
    useEffect(() => {
      if (!fpv) return undefined;
      const onEsc = e => {
        if (e.key === 'Escape') setFpv(false);
      };
      window.addEventListener('keydown', onEsc);
      return () => window.removeEventListener('keydown', onEsc);
    }, [fpv]);
    const zoom = cam.zoom;
    const trailColor = t.trail === 'cyan' ? '#5ce0d8' : t.trail === 'amber' ? '#e0b45c' : t.trail === 'white' ? '#f5f0e4' : null;

    // terrainId may be a base terrain OR a real-world mission site id.
    const terrain = window.resolveSite ? window.resolveSite(terrainId) : TERRAINS[terrainId];

    // live rover state (authoritative for sensors/animation)
    const startState = () => ({
      x: 0,
      y: 0,
      heading: 0,
      speed: 50,
      battery: 100,
      moving: false,
      led: null,
      scanning: false,
      penDown: false
    });
    const live = useRef(startState());
    const [rover, setRover] = useState(() => ({
      ...live.current
    }));
    const trailRef = useRef([]); // array of segments; each = [{x,y}]
    const [trail, setTrail] = useState([]);
    const odoRef = useRef(0);
    const [odo, setOdo] = useState(0);
    const sensorRef = useRef(600);
    const [sensorDist, setSensorDist] = useState(600);

    // RoboLearn bridge: lessons (from Python), currently-loaded lesson id,
    // pupil + verdict + hint after a graded Run. The React app stays
    // unchanged when there's no bridge (browser preview).
    // World props placed by pupil code via place(): flags, beacons, people...
    const [props, setProps] = useState([]);
    // A pupil-chosen local image, shown in the world by place("photo").
    const [photoUrl, setPhotoUrl] = useState(null);
    async function pickPhotoClick() {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) {
        addConsole('Photo props need the desktop app.', 'err');
        return;
      }
      try {
        const r = await window.RoboLearn.pickPhoto();
        if (r && r.ok) {
          setPhotoUrl(r.dataUrl);
          addConsole('Photo "' + r.name + '" loaded - use place("photo") to put it in the world.', 'ok');
        } else if (r && r.reason !== 'cancelled') {
          addConsole('Photo: ' + (r && r.reason || 'failed'), 'err');
        }
      } catch (e) {
        addConsole('Photo: ' + e, 'err');
      }
    }
    // Live terminal line + one-deep history (ArrowUp recalls the last line).
    const [replLine, setReplLine] = useState('');
    const replHistRef = useRef('');
    const setReplHist = v => {
      if (v && v.trim()) replHistRef.current = v;
    };
    const [lessons, setLessons] = useState([]);
    // Multi-pupil: list + active id, so shared classroom machines keep each
    // pupil's progress separate (re-score / "do-all").
    const [pupils, setPupils] = useState([]);
    const [activePupilId, setActivePupilId] = useState(null);
    function reloadPupils() {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) return;
      window.RoboLearn.listPupils().then(ps => {
        if (!Array.isArray(ps)) return;
        setPupils(ps);
        const active = ps.find(p => p.active);
        if (active) setActivePupilId(active.id);
      });
    }
    useEffect(reloadPupils, []);
    async function onPupilChange(e) {
      const val = e.target.value;
      if (val === '__new__') {
        const r = await window.RoboLearn.createPupil('Pupil ' + (pupils.length + 1));
        if (r && r.ok) {
          setActivePupilId(r.id);
          reloadPupils();
        }
      } else {
        const r = await window.RoboLearn.selectPupil(val);
        if (r && r.ok) setActivePupilId(val);
      }
      // Switching identity: clear the current verdict (it was the other pupil's).
      setLessonVerdict(null);
      setConsoleLines(l => [...l, {
        type: 'sys',
        text: 'Switched pupil.'
      }]);
    }
    const [currentLessonId, setCurrentLessonId] = useState(null);
    // Lessons keep their OWN editable buffer so loading one never clobbers the
    // example tabs (autopilot.py etc.); the editor shows it while a lesson is
    // active (QA re-score rank 11).
    const [lessonBuffers, setLessonBuffers] = useState({}); // per-lesson editable code
    const [lessonVerdict, setLessonVerdict] = useState(null); // {passed,score,reasons,hint}
    // The editor's current source: a lesson's own buffer when one is loaded,
    // otherwise the active example tab. (Declared AFTER the state above to
    // avoid a temporal-dead-zone ReferenceError.)
    const code = currentLessonId ? lessonBuffers[currentLessonId] !== undefined ? lessonBuffers[currentLessonId] : '' : programs[activeTab];
    // Dyslexia-friendly / larger reading text toggle (QA re-score rank 4).
    const [readable, setReadable] = useState(() => localStorage.getItem('or_readable') === '1');
    const [muted, setMuted] = useState(() => localStorage.getItem('or_muted') === '1');
    // Visual theme. 'dark' is the default mission-control look; the rest are
    // full repaints driven by [data-theme] CSS variable swaps in styles.css.
    const [theme, setTheme] = useState(() => localStorage.getItem('or_theme') || 'dark');
    const [showHelp, setShowHelp] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    // Budget robot builder (local AI hardware guide for a real-world rover).
    const [buildOpen, setBuildOpen] = useState(false);
    const [buildBudget, setBuildBudget] = useState('30');
    const [buildGoal, setBuildGoal] = useState('');
    const [buildBusy, setBuildBusy] = useState(false);
    const [buildPlan, setBuildPlan] = useState(null);
    const [buildErr, setBuildErr] = useState(null);
    async function runBuild() {
      if (buildBusy) return;
      const usd = Math.max(1, Math.min(100000, parseFloat(buildBudget) || 30));
      setBuildBusy(true);
      setBuildErr(null);
      try {
        if (!window.RoboLearn || !window.RoboLearn.isAvailable()) {
          setBuildErr('The robot builder needs the desktop app with local AI.');
        } else {
          const r = await window.RoboLearn.budgetBuild(usd, buildGoal);
          if (r && r.ok) setBuildPlan(r);else setBuildErr(r && r.reason || 'Could not build a plan.');
        }
      } catch (e) {
        setBuildErr(String(e));
      }
      setBuildBusy(false);
    }
    // Click-away + Escape close the settings popover.
    useEffect(() => {
      if (!settingsOpen) return undefined;
      const close = e => {
        if (!e.target.closest || !e.target.closest('.settings-wrap')) setSettingsOpen(false);
      };
      const key = e => {
        if (e.key === 'Escape') setSettingsOpen(false);
      };
      document.addEventListener('pointerdown', close);
      document.addEventListener('keydown', key);
      return () => {
        document.removeEventListener('pointerdown', close);
        document.removeEventListener('keydown', key);
      };
    }, [settingsOpen]);

    // --- AI vibe coding (local Ollama: Qwen/Gemma; graceful when absent) ---
    const [aiInfo, setAiInfo] = useState({
      available: false,
      model: null
    });
    const [vibeOpen, setVibeOpen] = useState(false);
    // Robot Lab: design a custom robot whose spec drives the simulation.
    const [robotLabOpen, setRobotLabOpen] = useState(false);
    const [robotSpec, setRobotSpec] = useState(() => window.getKodroRobot ? window.getKodroRobot() : null);
    useEffect(() => {
      const onRobot = e => {
        setRobotSpec(e.detail);
        // Drop the new robot into the world the assistant recommends for it.
        const w = e.detail && e.detail.world;
        if (w && window.TERRAINS && window.TERRAINS[w]) {
          setTerrainId(w);
          try {
            localStorage.setItem('or_terrain', w);
          } catch (err) {
            void err;
          }
        }
      };
      window.addEventListener('kodro-robot', onRobot);
      return () => window.removeEventListener('kodro-robot', onRobot);
    }, []);
    // Second-agent code review (propose-then-critique on the local model).
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewBusy, setReviewBusy] = useState(false);
    const [reviewData, setReviewData] = useState(null);
    const [reviewErr, setReviewErr] = useState(null);
    // Teacher dashboard: class concept-strength heatmap (now in the web app).
    const [teacherOpen, setTeacherOpen] = useState(false);
    const [teacherData, setTeacherData] = useState(null);
    // Grounded Ask: answers from the lesson material, offline retrieval.
    const [askOpen, setAskOpen] = useState(false);
    const [askQuery, setAskQuery] = useState('');
    const [askBusy, setAskBusy] = useState(false);
    const [askData, setAskData] = useState(null);
    const [vibePrompt, setVibePrompt] = useState('');
    const [vibeBusy, setVibeBusy] = useState(false);
    const [vibeError, setVibeError] = useState(null);
    // The pywebview bridge injects asynchronously AFTER React mounts, so a
    // one-shot check at mount races it and can leave the panel "offline"
    // forever. Poll briefly at mount, and re-check every time the panel is
    // opened -- so starting Ollama later lights it up without a restart.
    function refreshAiStatus() {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) return;
      window.RoboLearn.aiStatus().then(s => {
        if (s) setAiInfo(s);
      }).catch(() => {});
    }
    useEffect(() => {
      let tries = 0;
      const t = setInterval(() => {
        tries += 1;
        if (window.RoboLearn && window.RoboLearn.isAvailable()) {
          refreshAiStatus();
          clearInterval(t);
        } else if (tries > 20) clearInterval(t);
      }, 500);
      return () => clearInterval(t);
    }, []);
    useEffect(() => {
      if (vibeOpen) refreshAiStatus();
    }, [vibeOpen]);
    // Chat thread: [{role:'user'|'ai', kind:'text'|'code', text}]
    const [vibeMsgs, setVibeMsgs] = useState([]);
    const [micBusy, setMicBusy] = useState(false);
    const [voiceGender, setVoiceGender] = useState(() => localStorage.getItem('or_voice') || 'female');
    useEffect(() => {
      try {
        localStorage.setItem('or_voice', voiceGender);
      } catch (e) {
        void e;
      }
    }, [voiceGender]);
    const vibeEndRef = useRef(null);
    useEffect(() => {
      if (vibeEndRef.current) vibeEndRef.current.scrollIntoView({
        block: 'end'
      });
    }, [vibeMsgs, vibeBusy]);

    // Streamed reply: start a job, poll ~4x/s, and show the model's text live
    // in the thread while it thinks (the response feels instant instead of a
    // long opaque spinner).
    const [vibeLive, setVibeLive] = useState('');
    async function vibeSend() {
      const text = vibePrompt.trim();
      if (vibeBusy || !text) return;
      const next = [...vibeMsgs, {
        role: 'user',
        kind: 'text',
        text
      }];
      setVibeMsgs(next);
      setVibePrompt('');
      setVibeBusy(true);
      setVibeError(null);
      setVibeLive('');
      try {
        const history = next.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          text: m.text
        }));
        const start = await window.RoboLearn.aiChatStart(history, currentLessonIdRef.current);
        if (!start || !start.ok) {
          setVibeError(start && start.reason || 'AI unavailable.');
          setVibeBusy(false);
          return;
        }
        let r = null;
        for (;;) {
          await new Promise(res => setTimeout(res, 250));
          const p = await window.RoboLearn.aiChatPoll(start.jobId);
          if (!p || !p.ok) {
            r = p;
            break;
          }
          if (p.done) {
            r = p;
            break;
          }
          setVibeLive(p.text || '');
        }
        setVibeLive('');
        if (r && r.ok && r.type === 'question') {
          setVibeMsgs(m => [...m, {
            role: 'ai',
            kind: 'text',
            text: r.text
          }]);
          if (!muted) window.RoboLearn.speak(r.text, voiceGender);
        } else if (r && r.ok && r.type === 'code') {
          setVibeMsgs(m => [...m, {
            role: 'ai',
            kind: 'code',
            text: r.code,
            model: r.model
          }]);
        } else {
          setVibeError(r && r.reason || 'Generation failed.');
        }
      } catch (e) {
        setVibeError(String(e));
      }
      setVibeBusy(false);
    }
    function vibeApply(code, model) {
      setVibeOpen(false);
      addConsole('AI (' + (model || aiInfo.model) + ') wrote a program. Read it, then press Run.', 'sys');
      typewriteCode(code);
    }
    async function runReview() {
      if (reviewBusy) return;
      const src = (code || '').trim();
      if (!src) {
        setReviewErr('Write some code first, then ask for a review.');
        setReviewOpen(true);
        return;
      }
      setReviewOpen(true);
      setReviewBusy(true);
      setReviewErr(null);
      setReviewData(null);
      try {
        const r = await window.RoboLearn.aiReviewCode(src, currentLessonId || null);
        if (r && r.ok) setReviewData(r);else setReviewErr(r && r.reason || 'Review unavailable.');
      } catch (e) {
        setReviewErr(String(e));
      }
      setReviewBusy(false);
    }
    function applyReview() {
      if (reviewData && reviewData.revised && reviewData.code) {
        setReviewOpen(false);
        addConsole('Reviewer (' + (reviewData.model || aiInfo.model) + ') tidied your code. Read it, then press Run.', 'sys');
        typewriteCode(reviewData.code);
      }
    }

    // Wave voice agent: speak to drive the rover or ask a grounded question.
    const [vaOpen, setVaOpen] = useState(false);
    const [vaBusy, setVaBusy] = useState(false);
    const [vaData, setVaData] = useState(null);
    async function runVoiceAgent() {
      if (vaBusy) return;
      setVaBusy(true);
      setVaData(null);
      try {
        const r = await window.RoboLearn.voiceAgent(6);
        setVaData(r || {
          ok: false,
          reason: 'No response.'
        });
        if (r && r.ok && r.mode === 'command' && r.code) {
          setCode(c => (c && !c.endsWith('\n') ? c + '\n' : c) + r.code + '\n');
          addConsole('Heard "' + r.text + '" → added ' + r.code, 'ok');
        }
      } catch (e) {
        setVaData({
          ok: false,
          reason: String(e)
        });
      }
      setVaBusy(false);
    }
    const [voiceBusy, setVoiceBusy] = useState(false);
    async function runVoiceCommand() {
      if (voiceBusy) return;
      setVoiceBusy(true);
      addConsole('Listening… say a command like "go forward three" or "turn left ninety".', 'sys');
      try {
        const r = await window.RoboLearn.voiceCommand(6);
        if (r && r.ok && r.code) {
          setCode(c => (c && !c.endsWith('\n') ? c + '\n' : c) + r.code + '\n');
          addConsole('Heard "' + r.text + '" → added ' + r.code, 'ok');
        } else {
          addConsole(r && r.reason || 'Voice command not understood.', 'err');
        }
      } catch (e) {
        addConsole('Voice: ' + e, 'err');
      }
      setVoiceBusy(false);
    }

    // Agent swarm: run the program on a fleet of rovers, draw their trails.
    const [swarmOpen, setSwarmOpen] = useState(false);
    const [swarmBusy, setSwarmBusy] = useState(false);
    const [swarmData, setSwarmData] = useState(null);
    async function runSwarm() {
      const src = (code || '').trim();
      if (!src) {
        addConsole('Write a program first, then launch the swarm.', 'err');
        return;
      }
      setSwarmOpen(true);
      setSwarmBusy(true);
      setSwarmData(null);
      try {
        const r = await window.RoboLearn.swarmRun(src, currentLessonId || null, 6);
        if (r && r.ok) setSwarmData(r);else {
          setSwarmOpen(false);
          addConsole(r && r.reason || 'Swarm failed.', 'err');
        }
      } catch (e) {
        setSwarmOpen(false);
        addConsole('Swarm: ' + e, 'err');
      }
      setSwarmBusy(false);
    }
    async function runAsk() {
      const q = (askQuery || '').trim();
      if (!q || askBusy) return;
      setAskBusy(true);
      setAskData(null);
      try {
        const r = await window.RoboLearn.aiAsk(q);
        setAskData(r || {
          ok: false,
          reason: 'No response.'
        });
      } catch (e) {
        setAskData({
          ok: false,
          reason: String(e)
        });
      }
      setAskBusy(false);
    }
    async function openTeacher() {
      setSettingsOpen(false);
      setTeacherOpen(true);
      setTeacherData(null);
      try {
        const r = await window.RoboLearn.getClassHeatmap();
        if (r && r.ok) setTeacherData(r);else setTeacherData({
          ok: false,
          concepts: [],
          pupils: []
        });
      } catch (e) {
        setTeacherData({
          ok: false,
          concepts: [],
          pupils: []
        });
      }
    }
    async function vibeMic() {
      if (micBusy) return;
      setMicBusy(true);
      setVibeError(null);
      try {
        const r = await window.RoboLearn.listen(6);
        if (r && r.ok) setVibePrompt(p => (p ? p + ' ' : '') + r.text);else setVibeError(r && r.reason || 'Voice input failed.');
      } catch (e) {
        setVibeError(String(e));
      }
      setMicBusy(false);
    }

    // Typewriter: animate code into the active editor buffer like live typing.
    const typeRef = useRef(null);
    function typewriteCode(codeText) {
      if (typeRef.current) {
        clearInterval(typeRef.current);
        typeRef.current = null;
      }
      const lessonId = currentLessonIdRef.current;
      const setCode = v => {
        if (lessonId) setLessonBuffers(b => ({
          ...b,
          [lessonId]: v
        }));else setPrograms(p => ({
          ...p,
          [activeTab]: v
        }));
      };
      if (PREFERS_REDUCED_MOTION() || codeText.length > 4000) {
        setCode(codeText);
        return;
      }
      let i = 0;
      setCode('');
      typeRef.current = setInterval(() => {
        i = Math.min(codeText.length, i + 3);
        setCode(codeText.slice(0, i));
        if (i >= codeText.length) {
          clearInterval(typeRef.current);
          typeRef.current = null;
        }
      }, 12);
    }

    // --- Scratch-style blocks mode -----------------------------------------
    const BLOCK_DEFS = [{
      k: 'forward',
      label: 'move forward',
      unit: 'm',
      val: 2,
      code: v => 'move_forward(' + v + ')',
      color: 'var(--cyan)'
    }, {
      k: 'back',
      label: 'move backward',
      unit: 'm',
      val: 1,
      code: v => 'move_backward(' + v + ')',
      color: 'var(--cyan)'
    }, {
      k: 'left',
      label: 'turn left',
      unit: '°',
      val: 90,
      code: v => 'turn_left(' + v + ')',
      color: 'var(--warning)'
    }, {
      k: 'right',
      label: 'turn right',
      unit: '°',
      val: 90,
      code: v => 'turn_right(' + v + ')',
      color: 'var(--warning)'
    }, {
      k: 'beep',
      label: 'beep',
      code: () => 'beep(1)',
      color: 'var(--brass)'
    }, {
      k: 'say',
      label: 'say hello',
      code: () => 'say("hello")',
      color: 'var(--brass)'
    }, {
      k: 'led',
      label: 'LED cyan',
      code: () => 'led("cyan")',
      color: 'var(--brass)'
    }, {
      k: 'scan',
      label: 'scan',
      code: () => 'scan()',
      color: 'var(--success)'
    }, {
      k: 'collect',
      label: 'collect sample',
      code: () => 'collect_sample()',
      color: 'var(--success)'
    }, {
      k: 'drop',
      label: 'drop sample',
      code: () => 'drop_sample()',
      color: 'var(--success)'
    }, {
      k: 'speed',
      label: 'set speed',
      unit: '%',
      val: 60,
      code: v => 'set_speed(' + v + ')',
      color: 'var(--cyan)'
    }, {
      k: 'wait',
      label: 'wait',
      unit: 's',
      val: 1,
      code: v => 'wait(' + v + ')',
      color: 'var(--cyan)'
    }, {
      k: 'pendown',
      label: 'pen down',
      code: () => 'pen_down()',
      color: 'var(--brass)'
    }, {
      k: 'penup',
      label: 'pen up',
      code: () => 'pen_up()',
      color: 'var(--brass)'
    }, {
      k: 'repeat',
      label: 'repeat',
      unit: '×',
      val: 4,
      container: true,
      code: v => 'for i in range(' + v + '):',
      color: 'var(--mars)'
    }, {
      k: 'ifobs',
      label: 'if obstacle ahead',
      container: true,
      code: () => 'if obstacle_ahead():',
      color: 'var(--mars)'
    }];
    const [blocksOpen, setBlocksOpen] = useState(false);
    const [blocks, setBlocks] = useState([]); // {k,label,val,indent,container,color,unit}
    const [blockIndent, setBlockIndent] = useState(0);
    function addBlock(def) {
      setBlocks(bs => [...bs, {
        k: def.k,
        label: def.label,
        val: def.val,
        indent: blockIndent,
        container: !!def.container,
        color: def.color,
        unit: def.unit
      }]);
      if (def.container) setBlockIndent(d => Math.min(3, d + 1));
      sfx('led');
    }
    function endBlock() {
      setBlockIndent(d => Math.max(0, d - 1));
    }
    function removeBlock(i) {
      setBlocks(bs => bs.filter((_, j) => j !== i));
    }
    function moveBlock(i, dir) {
      setBlocks(bs => {
        const j = i + dir;
        if (j < 0 || j >= bs.length) return bs;
        const next = bs.slice();
        const tmp = next[i];
        next[i] = next[j];
        next[j] = tmp;
        return next;
      });
      sfx('led');
    }
    function blocksToPython() {
      const defs = {};
      BLOCK_DEFS.forEach(d => {
        defs[d.k] = d;
      });
      const lines = [];
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        lines.push('    '.repeat(b.indent) + defs[b.k].code(b.val));
        if (b.container) {
          const next = blocks[i + 1];
          // An empty container needs a body to be valid Python.
          if (!next || next.indent <= b.indent) lines.push('    '.repeat(b.indent + 1) + 'pass');
        }
      }
      return lines.join('\n') + '\n';
    }
    function insertBlocksCode() {
      if (!blocks.length) return;
      setBlocksOpen(false);
      addConsole('Blocks turned into Python. Read it, then press Run.', 'sys');
      typewriteCode(blocksToPython());
    }
    function toggleSound() {
      setMuted(m => {
        const next = !m;
        if (window.RLSound) window.RLSound.setMuted(next);
        return next;
      });
    }
    useEffect(() => {
      document.body.classList.toggle('a11y-readable', readable);
      try {
        localStorage.setItem('or_readable', readable ? '1' : '0');
      } catch (e) {
        void e;
      }
    }, [readable]);
    const currentLessonIdRef = useRef(null);
    useEffect(() => {
      currentLessonIdRef.current = currentLessonId;
    }, [currentLessonId]);
    useEffect(() => {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) return;
      window.RoboLearn.listLessons().then(ls => {
        if (Array.isArray(ls)) setLessons(ls);
      });
    }, []);
    function loadLesson(lesson) {
      if (!lesson) return;
      setCurrentLessonId(lesson.id);
      setLessonVerdict(null);
      // Render the rover on the SAME world it is graded against. Without this
      // the viewport could show a persisted Mars while the grader ran the
      // lesson's real terrain, so a pass looked like it happened elsewhere.
      if (lesson.terrain && TERRAINS[lesson.terrain]) setTerrainId(lesson.terrain);
      // Seed this lesson's buffer from its starter ONLY if it has no edits yet,
      // so switching A -> B -> A preserves the pupil's work in A (rank 6).
      setLessonBuffers(b => b[lesson.id] !== undefined ? b : {
        ...b,
        [lesson.id]: lesson.starterCode || ''
      });
      setConsoleLines(l => [...l, {
        type: 'sys',
        text: '─── ' + lesson.id + ' · ' + lesson.title + ' [' + lesson.keyStage + '] ───'
      }, {
        type: 'out',
        text: (lesson.intro || '').trim()
      }]);
    }
    async function gradeWithBridge(source) {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) return;
      const lessonId = currentLessonIdRef.current;
      if (!lessonId) return;
      try {
        const r = await window.RoboLearn.submitAttempt(lessonId, source, null);
        if (!r) return;
        if (r.ok === false) {
          setConsoleLines(l => [...l, {
            type: 'err',
            text: 'Grader: ' + (r.reason || 'unknown error')
          }]);
          return;
        }
        // Persist the verdict in a panel that survives Reset (QA #3).
        setLessonVerdict({
          passed: !!r.passed,
          score: r.score,
          reasons: r.reasons || [],
          hint: r.hint || null
        });
        if (r.passed) {
          sfx('pass');
          celebrate();
        } else {
          sfx('fail');
        }
        const tag = r.passed ? 'ok' : 'err';
        setConsoleLines(l => {
          const lines = [...l, {
            type: tag,
            text: (r.passed ? '✓ PASS' : '✗ NOT YET') + '  Score: ' + r.score + '/100'
          }];
          if (!r.passed && Array.isArray(r.reasons)) r.reasons.forEach(reason => lines.push({
            type: 'err',
            text: '  · ' + reason
          }));
          if (r.hint && r.hint.message) lines.push({
            type: 'sys',
            text: '💡 Hint: ' + r.hint.message
          });
          if (Array.isArray(r.achievements)) r.achievements.forEach(a => lines.push({
            type: 'ok',
            text: (a.icon || '🏅') + ' Achievement unlocked: ' + a.title
          }));
          if (r.recommended && r.recommended.id) lines.push({
            type: 'sys',
            text: '👉 Recommended next: ' + r.recommended.id + ' — ' + r.recommended.title
          });
          return lines;
        });
      } catch (err) {
        setConsoleLines(l => [...l, {
          type: 'err',
          text: 'Bridge error: ' + err
        }]);
      }
    }

    // `token` is a monotonic run id: every reset/start/resume bumps it, so a
    // stale pump loop or a pending start setTimeout that fires after a Reset is
    // ignored. `advancing` is a synchronous single-flight latch so two advance()
    // calls can never overlap (a pump step racing a manual Step). `startTimer`
    // and `abortTimer` hold the deferred-start / abort-clear handles so any new
    // control action can cancel them. Together these fix the Run/Step/Reset
    // mash races (QA adv5).
    const ctrl = useRef({
      running: false,
      abort: false,
      advancing: false,
      token: 0,
      startTimer: null,
      abortTimer: null
    });
    const genRef = useRef(null);
    const sayTimer = useRef(null);
    const consoleEndRef = useRef(null);
    useEffect(() => {
      if (consoleEndRef.current) consoleEndRef.current.scrollTop = consoleEndRef.current.scrollHeight;
    }, [consoleLines]);

    // persist
    useEffect(() => {
      localStorage.setItem('or_terrain', terrainId);
    }, [terrainId]);
    useEffect(() => {
      try {
        localStorage.setItem('or_theme', theme);
      } catch (e) {
        void e;
      }
      const root = document.documentElement;
      if (theme && theme !== 'dark') root.setAttribute('data-theme', theme);else root.removeAttribute('data-theme');
    }, [theme]);
    useEffect(() => {
      localStorage.setItem('or_tab', activeTab);
    }, [activeTab]);
    useEffect(() => {
      try {
        localStorage.setItem('or_programs', JSON.stringify(programs));
      } catch (e) {}
    }, [programs]);
    const sync = () => {
      setRover({
        ...live.current
      });
    };
    const pushTrailPoint = () => {
      if (!live.current.penDown) return;
      const segs = trailRef.current;
      if (!segs.length) return;
      const seg = segs[segs.length - 1];
      const last = seg[seg.length - 1];
      const x = live.current.x,
        y = live.current.y;
      // Decimate (skip points <6cm from the last) + cap, so a long run can't
      // grow the trail unboundedly or rebuild a huge SVG path each frame
      // (QA re-score rank 8 performance).
      if (last && Math.abs(x - last.x) < 6 && Math.abs(y - last.y) < 6) return;
      if (seg.length > 1500) return;
      seg.push({
        x,
        y
      });
    };
    function addConsole(text, type) {
      const ts = new Date();
      const hh = String(ts.getHours()).padStart(2, '0') + ':' + String(ts.getMinutes()).padStart(2, '0') + ':' + String(ts.getSeconds()).padStart(2, '0');
      setConsoleLines(l => [...l, {
        type: type || 'out',
        text,
        ts: hh
      }]);
    }

    // Fire a synthesised sound cue (no-op if sound.js absent or muted).
    function sfx(kind) {
      try {
        if (window.RLSound) window.RLSound.play(kind);
      } catch (e) {
        void e;
      }
    }

    // Lightweight celebration: a one-shot confetti burst on a lesson pass.
    function celebrate() {
      try {
        const host = document.getElementById('editor-main') || document.body;
        const layer = document.createElement('div');
        layer.className = 'confetti-layer';
        const colors = ['#5ce0d8', '#e0b45c', '#7cc49b', '#c8685a', '#f5f0e4'];
        for (let i = 0; i < 80; i++) {
          const p = document.createElement('i');
          p.className = 'confetti';
          p.style.left = Math.round(8 + i / 80 * 84) + '%';
          p.style.background = colors[i % colors.length];
          p.style.animationDelay = i % 10 * 40 + 'ms';
          p.style.transform = 'rotate(' + i * 31 % 360 + 'deg)';
          layer.appendChild(p);
        }
        host.appendChild(layer);
        setTimeout(() => {
          if (layer.parentNode) layer.parentNode.removeChild(layer);
        }, 2600);
      } catch (e) {
        void e;
      }
    }

    // ---------- geometry / sensors ----------
    function collisionAt(x, y) {
      if (Math.abs(x) > WALL - R || Math.abs(y) > WALL - R) return {
        type: 'wall'
      };
      for (const o of terrain.obstacles) {
        if (Math.hypot(o.x - x, o.y - y) < o.r + R) return {
          type: 'obstacle',
          o
        };
      }
      return null;
    }
    function rayDistance(x, y, headingDeg) {
      const a = headingDeg * Math.PI / 180;
      const dx = Math.sin(a),
        dy = -Math.cos(a);
      let best = Infinity;
      // walls (square at ±(WALL-R))
      const lim = WALL - R;
      if (dx > 1e-6) best = Math.min(best, (lim - x) / dx);
      if (dx < -1e-6) best = Math.min(best, (-lim - x) / dx);
      if (dy > 1e-6) best = Math.min(best, (lim - y) / dy);
      if (dy < -1e-6) best = Math.min(best, (-lim - y) / dy);
      // obstacles (ray-circle)
      for (const o of terrain.obstacles) {
        const ox = o.x - x,
          oy = o.y - y;
        const tca = ox * dx + oy * dy;
        if (tca < 0) continue;
        const d2 = ox * ox + oy * oy - tca * tca;
        const rr = (o.r + R) * (o.r + R);
        if (d2 > rr) continue;
        const t = tca - Math.sqrt(rr - d2);
        if (t > 0) best = Math.min(best, t);
      }
      return Math.max(0, best);
    }
    const host = {
      sensor(name, args) {
        const s = live.current;
        switch (name) {
          case 'distance':
            {
              const d = Math.round(rayDistance(s.x, s.y, s.heading));
              sensorRef.current = d;
              setSensorDist(d);
              return d;
            }
          case 'heading':
            return Math.round((s.heading % 360 + 360) % 360);
          case 'battery':
            return Math.round(s.battery);
          case 'speed':
            return Math.round(s.speed);
          case 'x':
            return Math.round(s.x);
          case 'y':
            return Math.round(-s.y);
          case 'tilt':
            return Math.round((Math.sin(s.x * 0.01) * 6 + Math.cos(s.y * 0.013) * 5) * 10) / 10;
          case 'temperature':
            return terrain.env.temp;
          case 'gravity':
            return terrain.env.gravity;
          case 'light':
            return terrain.env.light;
          case 'ground':
            return terrain.id;
          default:
            return 0;
        }
      }
    };

    // ---------- animation primitives ----------
    // Driven by setTimeout (not rAF) so logic still advances when the iframe is
    // backgrounded; ~16ms cadence gives ~60fps while visible.
    function frames(durationMs, onFrame) {
      return new Promise(resolve => {
        // Respect prefers-reduced-motion: snap straight to the final position
        // (p=1) with no interpolation, so the rover teleports rather than
        // animating (WCAG 2.3.3, vestibular safety).
        if (PREFERS_REDUCED_MOTION()) {
          // Snap with NO animation, but still sample the swept path so a
          // boulder/wall mid-route halts the rover instead of being tunnelled
          // through (the collision check lives in onFrame). QA rank 4.
          for (const p of [0.25, 0.5, 0.75, 1]) {
            if (onFrame(p)) break;
          }
          resolve('done');
          return;
        }
        const start = performance.now();
        const tick = () => {
          if (ctrl.current.abort) {
            resolve('abort');
            return;
          }
          // Non-finite / <=0 duration completes immediately (p=1); this guards
          // against a pathological value wedging the loop at p=0 forever.
          const p = window.RoverLang.frameProgress(performance.now() - start, durationMs);
          const stop = onFrame(p);
          if (p >= 1 || stop) {
            resolve('done');
            return;
          }
          setTimeout(tick, 16);
        };
        tick();
      });
    }
    const delay = ms => new Promise(res => {
      if (ms <= 0) return res();
      const start = performance.now();
      const tick = () => {
        if (ctrl.current.abort || performance.now() - start >= ms) res();else setTimeout(tick, 16);
      };
      setTimeout(tick, 16);
    });
    async function animateMove(ev) {
      const s = live.current;
      const myToken = ctrl.current.token; // run epoch captured at move start
      const a = s.heading * Math.PI / 180;
      const dirx = Math.sin(a) * ev.dir,
        diry = -Math.cos(a) * ev.dir;
      const total = ev.distance;
      const x0 = s.x,
        y0 = s.y;
      // The robot designed in Robot Lab drives the sim: a heavier build drains
      // the battery faster, and a stronger motor set raises the top speed.
      const robot = window.getKodroRobot ? window.getKodroRobot() : null;
      const massFac = robot && robot.massFactor ? robot.massFactor : 1;
      const speedFac = robot && robot.speedFactor ? robot.speedFactor : 1;
      const sp = Math.max(8, s.speed) * speedFac;
      // 0.32s per (cm/speed); lower-traction terrain drives a little slower.
      const dur = total / sp * 1000 * 0.32 / (terrain.traction * speedMulRef.current);
      // Real physics: heavier worlds drain the battery faster, lighter worlds
      // less (Moon ~0.58x Earth) -- pupils can measure the difference.
      const gFac = 0.5 + 0.5 * ((terrain.env.gravity || 9.81) / 9.81);
      s.moving = true;
      // new trail segment if pen down
      if (s.penDown) {
        trailRef.current.push([{
          x: x0,
          y: y0
        }]);
        setTrail([...trailRef.current]);
      }
      // Battery drains smoothly across the move (was a no-op: subtracted 0).
      const b0 = s.battery;
      const drainFull = total * 0.011 * gFac * massFac / terrain.traction;
      let crashed = false;
      await frames(dur, p => {
        const nx = x0 + dirx * total * p;
        const ny = y0 + diry * total * p;
        const hit = collisionAt(nx, ny);
        if (hit) {
          crashed = hit;
          return true; // stop frame loop, keep last safe pos
        }
        s.x = nx;
        s.y = ny;
        s.battery = Math.max(0, b0 - drainFull * p);
        pushTrailPoint();
        setSensorDist(Math.round(rayDistance(s.x, s.y, s.heading)));
        sync();
        return false;
      });
      // A Reset/restart while this move was animating bumps the token: bail
      // before touching the shared odometer or halting, so a stale in-flight
      // move can't corrupt the fresh run (phantom odometer add, or a spurious
      // 'error' state stomped over the Reset the user just pressed).
      if (ctrl.current.token !== myToken) {
        s.moving = false;
        return false;
      }
      // Settle battery on the distance actually travelled (handles a crash
      // that stopped the move early), relative to the pre-move level b0.
      const travelled = Math.hypot(s.x - x0, s.y - y0);
      s.battery = Math.max(0, b0 - travelled * 0.011 * gFac * massFac / terrain.traction);
      odoRef.current += travelled;
      setOdo(odoRef.current);
      s.moving = false;
      sync();
      if (crashed) {
        setCrashKey(k => k + 1);
        const what = crashed.type === 'wall' ? 'arena boundary' : terrain.obstacleLabel.toLowerCase();
        sfx('crash');
        addConsole('Collision with ' + what + ' at (' + Math.round(s.x) + ', ' + Math.round(-s.y) + '). Rover halted.', 'err');
        haltProgram('error');
        return false;
      }
      return true;
    }
    async function animateTurn(ev) {
      const s = live.current;
      const myToken = ctrl.current.token; // run epoch captured at turn start
      const h0 = s.heading;
      const dur = Math.abs(ev.deg) / 180 * 650 / speedMulRef.current;
      s.moving = true;
      await frames(dur, p => {
        s.heading = h0 + ev.deg * p;
        setSensorDist(Math.round(rayDistance(s.x, s.y, s.heading)));
        sync();
        return false;
      });
      if (ctrl.current.token !== myToken) {
        s.moving = false;
        return false;
      } // superseded by Reset/restart
      s.heading = h0 + ev.deg;
      s.moving = false;
      s.battery = Math.max(0, s.battery - Math.abs(ev.deg) * 0.004);
      sync();
      return true;
    }

    // speedMul ref so animation reads latest
    const speedMulRef = useRef(1);
    useEffect(() => {
      speedMulRef.current = speedMul;
    }, [speedMul]);
    function showSay(text) {
      setSay(text);
      if (sayTimer.current) clearTimeout(sayTimer.current);
      sayTimer.current = setTimeout(() => setSay(''), 2200);
    }

    // ---------- one interpreter step ----------
    // `advancing` is a synchronous re-entrancy latch: a pump iteration and a
    // manual Step (or two Steps) must never drive the same generator at once,
    // or they double-consume gen.next() and run overlapping animations that
    // stomp live.current. The latch wraps the whole body (incl. the awaited
    // animation) so the next driver bails until this one settles.
    async function advance(stepMode) {
      if (ctrl.current.advancing) return false;
      ctrl.current.advancing = true;
      try {
        const gen = genRef.current;
        if (!gen) return false;
        let res;
        try {
          res = gen.next();
        } catch (e) {
          handleRuntimeError(e);
          return false;
        }
        if (res.done) {
          finishProgram();
          return false;
        }
        const ev = res.value;
        if (ev.line) setActiveLine(ev.line);
        switch (ev.type) {
          case 'step':
            await delay(stepMode ? 0 : 70 / speedMulRef.current);
            break;
          case 'print':
            addConsole(ev.text, 'out');
            await delay(stepMode ? 0 : 90 / speedMulRef.current);
            break;
          case 'move':
            sfx('move');
            return await animateMove(ev);
          case 'turn':
            sfx('turn');
            return await animateTurn(ev);
          case 'speed':
            live.current.speed = Math.max(0, Math.min(100, ev.value));
            sync();
            break;
          case 'wait':
            await delay(ev.seconds * 1000 / speedMulRef.current);
            break;
          case 'pen':
            live.current.penDown = ev.down;
            if (ev.down) {
              trailRef.current.push([{
                x: live.current.x,
                y: live.current.y
              }]);
              setTrail([...trailRef.current]);
            }
            break;
          case 'halt':
            live.current.moving = false;
            sync();
            break;
          case 'led':
            sfx('led');
            live.current.led = ev.color in LED_COLORS ? LED_COLORS[ev.color] : terrain.accent;
            sync();
            break;
          case 'say':
            sfx('say');
            // Rover speaks aloud with the OS's offline TTS voice (Windows
            // SAPI via the bridge); silent in browser preview or when muted.
            if (window.RoboLearn && window.RoboLearn.isAvailable() && (!window.RLSound || !window.RLSound.isMuted())) {
              window.RoboLearn.speak(ev.text, voiceGender);
            }
            showSay(ev.text);
            await delay(stepMode ? 0 : 200 / speedMulRef.current);
            break;
          case 'place':
            {
              const px = ev.x !== undefined ? ev.x : live.current.x;
              const py = ev.y !== undefined ? ev.y : live.current.y;
              sfx('led');
              setProps(p => p.length >= 80 ? p : [...p, {
                kind: ev.kind,
                x: px,
                y: py,
                id: p.length
              }]);
              await delay(stepMode ? 0 : 160 / speedMulRef.current);
              break;
            }
          case 'clear_props':
            setProps([]);
            break;
          case 'scan':
            sfx('scan');
            live.current.scanning = true;
            sync();
            addConsole('Scanning. Nearest obstacle ' + Math.round(rayDistance(live.current.x, live.current.y, live.current.heading)) + ' cm ahead.', 'sys');
            await delay(1000 / speedMulRef.current);
            live.current.scanning = false;
            sync();
            break;
        }
        return true;
      } finally {
        ctrl.current.advancing = false;
      }
    }
    function handleRuntimeError(e) {
      const msg = e && e.message ? e.message : String(e);
      const line = e && e.line;
      if (line) setActiveLine(line);
      addConsole((line ? 'Line ' + line + ': ' : '') + msg, 'err');
      haltProgram('error');
    }
    function finishProgram() {
      ctrl.current.running = false;
      genRef.current = null;
      live.current.moving = false;
      sync();
      setRunState('done');
      if (replRef.current) {
        replRef.current = false;
        return;
      } // terminal line: stay quiet
      addConsole('Program finished.', 'ok');
      // RoboLearn: if a lesson is loaded, grade the Run via the Python engine.
      gradeWithBridge(code);
    }

    // Live terminal: run ONE line immediately against the current world --
    // like a real Python REPL, without resetting the rover or grading.
    const replRef = useRef(false);
    function runReplLine(line) {
      const src = (line || '').trim();
      if (!src) return;
      if (window.RLSound) window.RLSound.resume();
      addConsole('>>> ' + src, 'sys');
      if (ctrl.current.running || ctrl.current.advancing) {
        addConsole('The program is still running - press Pause or Reset first.', 'err');
        return;
      }
      let gen;
      try {
        gen = window.RoverLang.compile(src).run(host);
      } catch (e) {
        addConsole(String(e && e.message || e), 'err');
        return;
      }
      replRef.current = true;
      genRef.current = gen;
      ctrl.current.token++;
      const myToken = ctrl.current.token;
      ctrl.current.abort = false;
      ctrl.current.running = true;
      setRunState('running');
      pumpLoop(myToken);
    }
    function haltProgram(state) {
      ctrl.current.running = false;
      ctrl.current.abort = false;
      genRef.current = null;
      live.current.moving = false;
      sync();
      setRunState(state || 'idle');
    }

    // ---------- compile + start ----------
    function compileFresh() {
      try {
        const interp = window.RoverLang.compile(code);
        genRef.current = interp.run(host);
        return true;
      } catch (e) {
        handleRuntimeError(e);
        genRef.current = null;
        return false;
      }
    }
    // Cancel any deferred start / abort-clear left over from a prior control
    // action so a queued Run can't fire after a Reset (the stale-callback race).
    function clearPending() {
      if (ctrl.current.startTimer) {
        clearTimeout(ctrl.current.startTimer);
        ctrl.current.startTimer = null;
      }
      if (ctrl.current.abortTimer) {
        clearTimeout(ctrl.current.abortTimer);
        ctrl.current.abortTimer = null;
      }
    }
    function resetRover(clearConsole) {
      clearPending();
      ctrl.current.abort = true;
      ctrl.current.running = false;
      ctrl.current.advancing = false; // abandon any in-flight advance latch
      ctrl.current.token++; // invalidate any in-flight pump / pending start
      live.current = startState();
      trailRef.current = [];
      setTrail([]);
      setProps([]);
      odoRef.current = 0;
      setOdo(0);
      sensorRef.current = 600;
      setSensorDist(600);
      setActiveLine(0);
      setSay('');
      sync();
      genRef.current = null;
      ctrl.current.abortTimer = setTimeout(() => {
        ctrl.current.abort = false;
        ctrl.current.abortTimer = null;
      }, 30);
      if (clearConsole) setConsoleLines([{
        type: 'sys',
        text: 'Reset. Rover at origin.'
      }]);
    }
    async function pumpLoop(myToken) {
      while (ctrl.current.running && ctrl.current.token === myToken) {
        const cont = await advance(false);
        if (!cont) break;
      }
      if (ctrl.current.token !== myToken) return; // superseded by a reset/restart/resume
      // The loop only exits with running=false. finish/halt null the generator
      // (and already set 'done'/'error'); a Reset bumps the token (returned just
      // above). So a still-live generator here means the user pressed Pause.
      // Do NOT also gate on runStateRef === 'running': the 'running' commit can
      // lag behind a fast Pause, which would drop the pause transition and then
      // wedge the UI in a phantom 'running' with no pump driving it.
      if (!ctrl.current.running && genRef.current) {
        setRunState('paused');
      }
    }
    function onRun() {
      // Resume the AudioContext here, inside the click gesture (browsers block
      // audio that starts outside a user gesture).
      if (window.RLSound) window.RLSound.resume();
      // Pause: gate on the synchronous ref, not the (stale until re-render)
      // runState closure, so a Run pressed right after a resume still pauses.
      if (ctrl.current.running) {
        ctrl.current.running = false;
        return;
      }
      // start fresh or resume
      if (runState === 'idle' || runState === 'done' || runState === 'error') {
        resetRover(false);
        const myToken = ctrl.current.token; // captured after reset's bump
        // reset clears abort after 30ms; compile after
        ctrl.current.startTimer = setTimeout(() => {
          ctrl.current.startTimer = null;
          if (ctrl.current.token !== myToken) return; // a Reset landed first
          if (!compileFresh()) return;
          ctrl.current.abort = false;
          ctrl.current.running = true;
          setRunState('running');
          addConsole('Deployed on ' + terrain.name + '.', 'sys');
          pumpLoop(myToken);
        }, 50);
      } else if (runState === 'paused') {
        // `runState` is a lagging closure: after a Reset/finish nulled the
        // generator it can still read 'paused' for a frame. Only a live
        // generator is actually resumable — resuming a null gen would spin a
        // pump that exits instantly yet leaves running=true, wedging the UI in
        // a phantom 'running'. genRef is the synchronous truth.
        if (!genRef.current) return;
        if (ctrl.current.running || ctrl.current.advancing) return; // already running / mid-step
        ctrl.current.token++; // new pump epoch: orphan any prior pump
        const myToken = ctrl.current.token;
        ctrl.current.abort = false;
        ctrl.current.running = true;
        setRunState('running');
        pumpLoop(myToken);
      }
    }
    function onStep() {
      // A Step while a pump is live pauses it (same as Run), gated on the
      // synchronous ref so it works in the gap before runState commits.
      if (ctrl.current.running) {
        ctrl.current.running = false;
        return;
      }
      if (ctrl.current.advancing) return; // a step/animation is in flight: ignore
      if (runState === 'idle' || runState === 'done' || runState === 'error') {
        resetRover(false);
        const myToken = ctrl.current.token;
        ctrl.current.startTimer = setTimeout(() => {
          ctrl.current.startTimer = null;
          if (ctrl.current.token !== myToken) return;
          if (!compileFresh()) return;
          ctrl.current.abort = false;
          setRunState('paused');
          addConsole('Stepping through on ' + terrain.name + '.', 'sys');
          advance(true);
        }, 50);
      } else if (runState === 'paused') {
        if (!genRef.current) return; // stale 'paused' after a Reset/finish: nothing to step
        ctrl.current.abort = false;
        advance(true);
      }
    }
    function onReset() {
      resetRover(true);
      setRunState('idle');
    }
    function onTerrain(id) {
      if (id === terrainId) return;
      resetRover(false);
      setTerrainId(id);
      setRunState('idle');
      setLessonVerdict(null); // verdict was graded on the lesson's own world
      setConsoleLines([{
        type: 'sys',
        text: 'Switched to ' + TERRAINS[id].name + '. ' + TERRAINS[id].coord
      }]);
    }
    function onCodeChange(v) {
      if (currentLessonId) setLessonBuffers(b => ({
        ...b,
        [currentLessonId]: v
      })); // per-lesson buffer
      else setPrograms(p => ({
        ...p,
        [activeTab]: v
      })); // edit the example tab
    }
    async function exportReportClick() {
      if (!window.RoboLearn || !window.RoboLearn.isAvailable()) {
        setConsoleLines(l => [...l, {
          type: 'warn',
          text: 'Report export needs the desktop app.'
        }]);
        return;
      }
      try {
        const r = await window.RoboLearn.exportReport();
        if (r && r.ok) {
          setConsoleLines(l => [...l, {
            type: 'ok',
            text: 'Progress report saved: ' + r.path
          }]);
        } else {
          setConsoleLines(l => [...l, {
            type: 'err',
            text: 'Report export failed: ' + (r && r.reason || 'unknown')
          }]);
        }
      } catch (e) {
        setConsoleLines(l => [...l, {
          type: 'err',
          text: 'Report export error: ' + e
        }]);
      }
    }

    // apply terrain accent to CSS var
    useEffect(() => {
      document.documentElement.style.setProperty('--terrain', terrain.accent);
    }, [terrainId]);

    // ---------- layout resizers ----------
    const [editorW, setEditorW] = useState(404);
    const [teleW, setTeleW] = useState(318);
    const [consoleH, setConsoleH] = useState(184);
    function startDrag(kind, e) {
      e.preventDefault();
      const sx = e.clientX,
        sy = e.clientY;
      const w0 = editorW,
        t0 = teleW,
        c0 = consoleH;
      const move = ev => {
        if (kind === 'editor') setEditorW(Math.max(280, Math.min(640, w0 + (ev.clientX - sx))));else if (kind === 'tele') setTeleW(Math.max(240, Math.min(460, t0 - (ev.clientX - sx))));else if (kind === 'console') setConsoleH(Math.max(90, Math.min(420, c0 - (ev.clientY - sy))));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.style.cursor = '';
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      document.body.style.cursor = kind === 'console' ? 'row-resize' : 'col-resize';
    }

    // interactive camera: drag the viewport to orbit (yaw + pitch), wheel to zoom
    function camDrag(e) {
      if (e.target.closest('.terrain-switch') || e.target.closest('.view-mode-pill')) return;
      const sx = e.clientX,
        sy = e.clientY;
      const y0 = cam.yaw,
        t0 = cam.tilt;
      let moved = false;
      const move = ev => {
        moved = true;
        setCam(c => ({
          ...c,
          yaw: Math.max(-60, Math.min(60, y0 + (ev.clientX - sx) * 0.35)),
          tilt: Math.max(0, Math.min(72, t0 - (ev.clientY - sy) * 0.32))
        }));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.style.cursor = '';
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      document.body.style.cursor = 'grabbing';
    }
    function camWheel(e) {
      setCam(c => ({
        ...c,
        zoom: Math.max(0.7, Math.min(1.7, c.zoom - e.deltaY * 0.0012))
      }));
    }

    // keyboard shortcuts
    useEffect(() => {
      const typingIn = el => el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable);
      const h = e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          onRun();
        } else if (e.key === 'F10') {
          e.preventDefault();
          onStep();
        } else if (e.key === 'Escape' && showHelp) {
          setShowHelp(false);
        } else if (e.key === '?' && !typingIn(e.target)) {
          e.preventDefault();
          setShowHelp(s => !s);
        }
      };
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    });
    const statusLabel = {
      idle: 'Standby',
      running: 'Running',
      paused: 'Stepping',
      done: 'Complete',
      error: 'Halted'
    }[runState];
    return /*#__PURE__*/React.createElement("div", {
      className: "app"
    }, /*#__PURE__*/React.createElement("a", {
      className: "skip-link",
      href: "#editor-main"
    }, "Skip to code editor"), /*#__PURE__*/React.createElement("h1", {
      className: "sr-only"
    }, "Kodro \u2014 learn to code a rover, offline"), /*#__PURE__*/React.createElement("div", {
      className: "missionbar",
      role: "banner"
    }, /*#__PURE__*/React.createElement("div", {
      className: "brand"
    }, /*#__PURE__*/React.createElement("div", {
      className: "brand-mark",
      dangerouslySetInnerHTML: {
        __html: ORBIT_SVG
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "brand-text"
    }, /*#__PURE__*/React.createElement("div", {
      className: "brand-name"
    }, "Kodro"), /*#__PURE__*/React.createElement("div", {
      className: "brand-sub"
    }, "Code a rover \xB7 Offline"))), /*#__PURE__*/React.createElement("div", {
      className: "bar-divider"
    }), /*#__PURE__*/React.createElement("div", {
      className: "run-controls"
    }, /*#__PURE__*/React.createElement("button", {
      className: 'ctrl ' + (runState === 'running' ? '' : 'ctrl-run'),
      onClick: onRun
    }, runState === 'running' ? I.pause : I.play, runState === 'running' ? 'Pause' : runState === 'paused' ? 'Resume' : 'Run'), /*#__PURE__*/React.createElement("button", {
      className: "ctrl",
      onClick: onStep,
      disabled: runState === 'running'
    }, I.step, "Step"), /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-stop",
      onClick: onReset
    }, I.reset, "Reset")), /*#__PURE__*/React.createElement("div", {
      className: "bar-divider"
    }), /*#__PURE__*/React.createElement("div", {
      className: "speed-ctrl"
    }, /*#__PURE__*/React.createElement("label", null, "Sim speed"), /*#__PURE__*/React.createElement("input", {
      type: "range",
      className: "slider",
      min: "0.4",
      max: "3",
      step: "0.1",
      value: speedMul,
      onChange: e => setSpeedMul(parseFloat(e.target.value))
    }), /*#__PURE__*/React.createElement("span", {
      className: "num",
      style: {
        fontSize: 11,
        color: 'var(--fg-2)',
        width: 30
      }
    }, speedMul.toFixed(1), "\xD7")), /*#__PURE__*/React.createElement("div", {
      className: "bar-spacer"
    }), /*#__PURE__*/React.createElement("div", {
      className: "bar-status",
      role: "status",
      "aria-live": "polite",
      "aria-label": 'Status: ' + statusLabel
    }, /*#__PURE__*/React.createElement("span", {
      className: 'status-dot ' + runState,
      "aria-hidden": "true"
    }), /*#__PURE__*/React.createElement("span", null, statusLabel)), /*#__PURE__*/React.createElement("div", {
      className: "bar-divider"
    }), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn voice-agent-btn",
      title: "Talk to Kodro \u2014 speak a command or ask a question",
      "aria-label": "Voice agent",
      onClick: () => {
        setVaOpen(true);
        setVaData(null);
        runVoiceAgent();
      }
    }, "\uD83C\uDF99"), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Robot Lab \u2014 design a custom robot",
      "aria-label": "Robot Lab",
      onClick: () => setRobotLabOpen(true)
    }, "\uD83D\uDEE0"), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Build a real robot on a budget",
      "aria-label": "Build a real robot",
      onClick: () => setBuildOpen(true)
    }, "\uD83E\uDD16"), /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Keyboard shortcuts (?)",
      "aria-label": "Keyboard shortcuts",
      onClick: () => setShowHelp(true)
    }, "?"), /*#__PURE__*/React.createElement("div", {
      className: "settings-wrap"
    }, /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Settings",
      "aria-label": "Settings",
      "aria-expanded": settingsOpen,
      onClick: () => setSettingsOpen(o => !o)
    }, "\u2699"), settingsOpen && /*#__PURE__*/React.createElement("div", {
      className: "settings-pop",
      role: "menu",
      "aria-label": "Settings"
    }, pupils.length > 0 && /*#__PURE__*/React.createElement("label", {
      className: "set-row"
    }, /*#__PURE__*/React.createElement("span", null, "Pupil"), /*#__PURE__*/React.createElement("select", {
      className: "lesson-select",
      value: activePupilId || '',
      onChange: onPupilChange,
      "aria-label": "Active pupil"
    }, pupils.map(p => /*#__PURE__*/React.createElement("option", {
      key: p.id,
      value: p.id
    }, p.displayName)), /*#__PURE__*/React.createElement("option", {
      value: "__new__"
    }, "+ New pupil\u2026"))), /*#__PURE__*/React.createElement("label", {
      className: "set-row"
    }, /*#__PURE__*/React.createElement("span", null, "Theme"), /*#__PURE__*/React.createElement("select", {
      className: "lesson-select",
      value: theme,
      onChange: e => setTheme(e.target.value),
      "aria-label": "Visual theme"
    }, /*#__PURE__*/React.createElement("option", {
      value: "dark"
    }, "Mission (dark)"), /*#__PURE__*/React.createElement("option", {
      value: "light"
    }, "Daylight (light)"), /*#__PURE__*/React.createElement("option", {
      value: "contrast"
    }, "High contrast (colour-blind safe)"), /*#__PURE__*/React.createElement("option", {
      value: "matrix"
    }, "Matrix"), /*#__PURE__*/React.createElement("option", {
      value: "pixel"
    }, "Pixel"), /*#__PURE__*/React.createElement("option", {
      value: "game"
    }, "Arcade"), /*#__PURE__*/React.createElement("option", {
      value: "lego"
    }, "Brick"), /*#__PURE__*/React.createElement("option", {
      value: "chatgpt"
    }, "Clean"), /*#__PURE__*/React.createElement("option", {
      value: "abstract"
    }, "Abstract"), /*#__PURE__*/React.createElement("option", {
      value: "wiki"
    }, "Wiki / Network"))), /*#__PURE__*/React.createElement("button", {
      className: "set-row set-btn",
      role: "menuitem",
      "aria-pressed": !muted,
      onClick: toggleSound
    }, /*#__PURE__*/React.createElement("span", null, "Sound"), /*#__PURE__*/React.createElement("span", {
      className: "set-val"
    }, muted ? 'Off' : 'On')), /*#__PURE__*/React.createElement("button", {
      className: "set-row set-btn",
      role: "menuitem",
      "aria-pressed": readable,
      onClick: () => setReadable(v => !v)
    }, /*#__PURE__*/React.createElement("span", null, "Readable text"), /*#__PURE__*/React.createElement("span", {
      className: "set-val"
    }, readable ? 'On' : 'Off')), /*#__PURE__*/React.createElement("button", {
      className: "set-row set-btn",
      role: "menuitem",
      onClick: () => setVoiceGender(v => v === 'female' ? 'male' : 'female')
    }, /*#__PURE__*/React.createElement("span", null, "Voice"), /*#__PURE__*/React.createElement("span", {
      className: "set-val"
    }, voiceGender === 'female' ? 'Female' : 'Male')), /*#__PURE__*/React.createElement("button", {
      className: "set-row set-btn",
      role: "menuitem",
      onClick: () => {
        setSettingsOpen(false);
        pickPhotoClick();
      }
    }, /*#__PURE__*/React.createElement("span", null, "Photo prop \u2014 place(\"photo\")"), /*#__PURE__*/React.createElement("span", {
      className: "set-val"
    }, photoUrl ? 'Loaded' : 'Pick…')), /*#__PURE__*/React.createElement("button", {
      className: "set-row set-btn",
      role: "menuitem",
      onClick: openTeacher
    }, /*#__PURE__*/React.createElement("span", null, "Teacher dashboard"), /*#__PURE__*/React.createElement("span", {
      className: "set-val"
    }, "\u2192")), /*#__PURE__*/React.createElement("button", {
      className: "set-row set-btn",
      role: "menuitem",
      onClick: () => {
        setSettingsOpen(false);
        exportReportClick();
      }
    }, /*#__PURE__*/React.createElement("span", null, "Export progress report"), /*#__PURE__*/React.createElement("span", {
      className: "set-val"
    }, "\u2192"))))), /*#__PURE__*/React.createElement("main", {
      id: "editor-main",
      className: "workspace",
      style: {
        ['--editor-w']: editorW + 'px',
        ['--tele-w']: teleW + 'px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "panel",
      style: {
        gridColumn: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "editor-panel",
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "panel-head"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tabs"
    }, Object.keys(EXAMPLES).map(k => /*#__PURE__*/React.createElement("button", {
      key: k,
      type: "button",
      className: 'tab' + (!currentLessonId && activeTab === k ? ' active' : ''),
      "aria-pressed": !currentLessonId && activeTab === k,
      onClick: () => {
        setCurrentLessonId(null);
        setActiveTab(k);
      }
    }, EXAMPLES[k].label))), lessons.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "lesson-picker"
    }, /*#__PURE__*/React.createElement("label", {
      htmlFor: "lesson-select",
      className: "eyebrow"
    }, "Lesson"), /*#__PURE__*/React.createElement("select", {
      id: "lesson-select",
      className: "lesson-select",
      value: currentLessonId || '',
      onChange: e => loadLesson(lessons.find(l => l.id === e.target.value))
    }, /*#__PURE__*/React.createElement("option", {
      value: "",
      disabled: true
    }, "Pick a lesson\u2026"), lessons.map(l => /*#__PURE__*/React.createElement("option", {
      key: l.id,
      value: l.id
    }, l.id, " \xB7 ", l.title, " [", l.keyStage, "]")))), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini btn-vibe",
      title: aiInfo.available ? 'Code with AI (' + aiInfo.model + ')' : 'Code with AI (needs local Ollama)',
      onClick: () => setVibeOpen(true)
    }, "\u2728 Vibe"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      title: "Build the program from blocks",
      onClick: () => setBlocksOpen(true)
    }, "\uD83E\uDDE9 Blocks"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      title: "A second AI agent reviews your code",
      onClick: runReview
    }, "\uD83D\uDD0E Review"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      title: "Ask a question, answered from the lesson material",
      onClick: () => {
        setAskOpen(true);
        setAskData(null);
      }
    }, "\u2753 Ask"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      title: "Speak a command \u2014 works offline, no AI model needed",
      disabled: voiceBusy,
      onClick: runVoiceCommand
    }, voiceBusy ? '🎙…' : '🎙 Voice'), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      title: "Run your program on a swarm of rovers at once",
      onClick: runSwarm
    }, "\uD83D\uDC1D Swarm")), /*#__PURE__*/React.createElement(window.Editor, {
      code: code,
      onChange: onCodeChange,
      activeLine: activeLine,
      readOnly: runState === 'running'
    }), /*#__PURE__*/React.createElement("div", {
      className: "api-hint"
    }, /*#__PURE__*/React.createElement("b", null, "move_forward(m)"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "move_backward(m)"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "turn_left(\xB0)"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "turn_right(\xB0)"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "set_speed(0\u2013100)"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "pen_down/up()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "scan()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "led(\"cyan\")"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "say(\"\u2026\")"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "collect_sample()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "place(\"flag\")"), /*#__PURE__*/React.createElement("span", {
      className: "sep"
    }, " \u2014 sensors return values: "), /*#__PURE__*/React.createElement("b", null, "distance()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "heading()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "battery()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "obstacle_ahead()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "gravity()"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "temperature()")), (() => {
      const lesson = lessons.find(l => l.id === currentLessonId);
      if (!lesson) return null;
      return /*#__PURE__*/React.createElement("section", {
        className: "lesson-card",
        "aria-label": "Current lesson"
      }, /*#__PURE__*/React.createElement("div", {
        className: "lesson-card-head"
      }, /*#__PURE__*/React.createElement("span", {
        className: "lesson-badge"
      }, lesson.keyStage), /*#__PURE__*/React.createElement("span", {
        className: "lesson-title"
      }, lesson.id, " \xB7 ", lesson.title), lesson.readingAge ? /*#__PURE__*/React.createElement("span", {
        className: "lesson-age",
        title: "Reading age"
      }, "Age ", lesson.readingAge, "+") : null, lessonVerdict && /*#__PURE__*/React.createElement("span", {
        className: 'lesson-verdict ' + (lessonVerdict.passed ? 'pass' : 'fail')
      }, lessonVerdict.passed ? '✓ Complete' : '✗ Not yet', " \xB7 ", lessonVerdict.score, "/100"), /*#__PURE__*/React.createElement("button", {
        className: "read-aloud",
        type: "button",
        title: "Read this lesson aloud",
        "aria-label": "Read this lesson aloud",
        onClick: () => {
          const gloss = lesson.glossary ? Object.keys(lesson.glossary).map(t => t + ': ' + lesson.glossary[t]).join('. ') : '';
          const text = (lesson.intro || '').trim() + (gloss ? '. ' + gloss : '');
          if (text && window.RoboLearn) window.RoboLearn.speak(text, voiceGender, -2);
        }
      }, "\uD83D\uDD0A Read aloud")), lesson.intro ? /*#__PURE__*/React.createElement("p", {
        className: "lesson-intro"
      }, lesson.intro.trim()) : null, lesson.glossary && Object.keys(lesson.glossary).length > 0 && /*#__PURE__*/React.createElement("dl", {
        className: "lesson-glossary"
      }, Object.keys(lesson.glossary).map(term => /*#__PURE__*/React.createElement("div", {
        key: term,
        className: "gloss-item"
      }, /*#__PURE__*/React.createElement("dt", null, term), /*#__PURE__*/React.createElement("dd", null, lesson.glossary[term])))), lessonVerdict && !lessonVerdict.passed && lessonVerdict.reasons.length > 0 && /*#__PURE__*/React.createElement("ul", {
        className: "lesson-reasons"
      }, lessonVerdict.reasons.map((r, i) => /*#__PURE__*/React.createElement("li", {
        key: i
      }, r))), lessonVerdict && lessonVerdict.hint && lessonVerdict.hint.message && /*#__PURE__*/React.createElement("p", {
        className: "lesson-hint"
      }, "\uD83D\uDCA1 ", lessonVerdict.hint.message));
    })()), /*#__PURE__*/React.createElement("div", {
      className: "resizer-row",
      onPointerDown: e => startDrag('console', e),
      style: {
        height: 5,
        cursor: 'row-resize',
        background: 'transparent',
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: '0 0',
        borderTop: '0.5px solid var(--border)'
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "console",
      style: {
        height: consoleH,
        flex: 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "console-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Console"), /*#__PURE__*/React.createElement("div", {
      className: "ph-spacer",
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      onClick: () => setConsoleLines([{
        type: 'sys',
        text: 'Console cleared.'
      }])
    }, "Clear")), /*#__PURE__*/React.createElement("div", {
      className: "console-out",
      ref: consoleEndRef,
      role: "log",
      "aria-live": "polite",
      "aria-label": "Program output and lesson feedback"
    }, consoleLines.map((l, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      role: l.type === 'err' ? 'alert' : undefined,
      className: 'cline ' + (l.type === 'err' ? 'err' : l.type === 'ok' ? 'ok' : l.type === 'sys' ? 'sys' : '')
    }, l.ts ? /*#__PURE__*/React.createElement("span", {
      className: "ts"
    }, l.ts) : null, l.text))), /*#__PURE__*/React.createElement("div", {
      className: "repl-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "repl-prompt",
      "aria-hidden": "true"
    }, ">>>"), /*#__PURE__*/React.createElement("input", {
      className: "repl-input",
      type: "text",
      spellCheck: "false",
      placeholder: "live terminal \u2014 try move_forward(1) or place(\"flag\")",
      "aria-label": "Live terminal: type one Python line and press Enter",
      value: replLine,
      onChange: e => setReplLine(e.target.value),
      onKeyDown: e => {
        if (e.key === 'Enter') {
          runReplLine(replLine);
          setReplHist(replLine);
          setReplLine('');
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (replHistRef.current) setReplLine(replHistRef.current);
        } else if (e.key === 'Escape') {
          e.target.blur();
        }
      }
    })))), /*#__PURE__*/React.createElement("div", {
      className: "resizer",
      onPointerDown: e => startDrag('editor', e),
      style: {
        gridColumn: 2
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "panel view-panel",
      style: {
        gridColumn: 3
      },
      onPointerDown: camDrag,
      onWheel: camWheel
    }, /*#__PURE__*/React.createElement("div", {
      className: "terrain-switch"
    }, ['city', 'room', 'earth', 'mars', 'underwater', 'space'].map(id => /*#__PURE__*/React.createElement("button", {
      type: "button",
      key: id,
      className: 'terrain-btn' + (terrainId === id ? ' active' : ''),
      "aria-pressed": terrainId === id,
      onClick: () => onTerrain(id)
    }, /*#__PURE__*/React.createElement("span", {
      className: "tdot",
      style: {
        background: TERRAINS[id].dot,
        boxShadow: terrainId === id ? '0 0 8px ' + TERRAINS[id].dot : 'none'
      }
    }), TERRAINS[id].label)), window.SITES && /*#__PURE__*/React.createElement("select", {
      className: "lesson-select site-select",
      value: window.SITES[terrainId] ? terrainId : '',
      onChange: e => {
        if (e.target.value) onTerrain(e.target.value);
      },
      "aria-label": "Real-world mission site",
      title: "Drop the rover at a real place \u2014 real gravity, traction and light"
    }, /*#__PURE__*/React.createElement("option", {
      value: "",
      disabled: true
    }, "\uD83C\uDF0D Mission site\u2026"), [['earth', '🌍 Earth'], ['underwater', '🌊 Underwater'], ['mars', '🔴 Mars'], ['space', '🌑 Space']].map(([base, label]) => {
      const ids = Object.keys(window.SITES).filter(id => window.SITES[id].base === base);
      return ids.length === 0 ? null : /*#__PURE__*/React.createElement("optgroup", {
        key: base,
        label: label
      }, ids.map(id => /*#__PURE__*/React.createElement("option", {
        key: id,
        value: id
      }, window.SITES[id].name)));
    })), /*#__PURE__*/React.createElement("span", {
      className: "view-toggle"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: 'terrain-btn' + (view3d ? ' active' : ''),
      title: "Real 3D view",
      onClick: () => setView3d(true)
    }, "3D"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: 'terrain-btn' + (!view3d ? ' active' : ''),
      title: "Flat 2.5D view",
      onClick: () => setView3d(false)
    }, "2.5D"), view3d && /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "terrain-btn",
      title: "Switch between orbit and first person",
      onClick: () => setFpv(f => !f)
    }, fpv ? '👁 First person' : '🛰 Orbit'))), view3d ? /*#__PURE__*/React.createElement(window.Viewport3D, {
      terrain: terrain,
      rover: rover,
      fpv: fpv
    }) : /*#__PURE__*/React.createElement(window.Viewport, {
      terrain: terrain,
      rover: rover,
      trail: trail,
      props: props,
      photoUrl: photoUrl,
      sensorDist: sensorDist,
      say: say,
      crashKey: crashKey,
      zoom: zoom,
      showGrid: t.grid,
      showFx: t.ambientFx,
      trailColor: trailColor,
      tilt: cam.tilt,
      yaw: cam.yaw,
      onTilt: v => setCam({
        tilt: v,
        yaw: v === 0 ? 0 : -8,
        zoom: 1
      })
    })), /*#__PURE__*/React.createElement("div", {
      className: "resizer",
      onPointerDown: e => startDrag('tele', e),
      style: {
        gridColumn: 4
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "panel tele-panel",
      style: {
        gridColumn: 5
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "panel-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Telemetry"), /*#__PURE__*/React.createElement("div", {
      className: "ph-spacer",
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "num",
      style: {
        fontSize: 10,
        color: 'var(--fg-3)',
        letterSpacing: '0.1em'
      }
    }, "OQ-ROVER-04")), /*#__PURE__*/React.createElement(window.Telemetry, {
      rover: rover,
      terrain: terrain,
      sensorDist: sensorDist,
      odometer: odo
    }))), /*#__PURE__*/React.createElement(window.TweaksPanel, {
      title: "Tweaks"
    }, /*#__PURE__*/React.createElement(window.TweakSection, {
      label: "Camera"
    }), /*#__PURE__*/React.createElement(window.TweakSlider, {
      label: "Perspective",
      value: cam.tilt,
      min: 0,
      max: 70,
      step: 2,
      unit: "\xB0",
      onChange: v => setCam(c => ({
        ...c,
        tilt: v
      }))
    }), /*#__PURE__*/React.createElement(window.TweakSlider, {
      label: "Orbit",
      value: cam.yaw,
      min: -45,
      max: 45,
      step: 1,
      unit: "\xB0",
      onChange: v => setCam(c => ({
        ...c,
        yaw: v
      }))
    }), /*#__PURE__*/React.createElement(window.TweakSlider, {
      label: "Zoom",
      value: cam.zoom,
      min: 0.7,
      max: 1.6,
      step: 0.05,
      onChange: v => setCam(c => ({
        ...c,
        zoom: v
      }))
    }), /*#__PURE__*/React.createElement(window.TweakSection, {
      label: "Scene"
    }), /*#__PURE__*/React.createElement(window.TweakToggle, {
      label: "Reference grid",
      value: t.grid,
      onChange: v => setTweak('grid', v)
    }), /*#__PURE__*/React.createElement(window.TweakToggle, {
      label: "Ambient FX",
      value: t.ambientFx,
      onChange: v => setTweak('ambientFx', v)
    }), /*#__PURE__*/React.createElement(window.TweakSection, {
      label: "Path trace"
    }), /*#__PURE__*/React.createElement(window.TweakRadio, {
      label: "Trail color",
      value: t.trail,
      options: ['terrain', 'cyan', 'amber'],
      onChange: v => setTweak('trail', v)
    })), swarmOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => !swarmBusy && setSwarmOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Agent swarm",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\uD83D\uDC1D Agent swarm \u2014 your one program, run by a fleet at once"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setSwarmOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "swarm-body"
    }, swarmBusy && /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "Launching the swarm\u2026"), swarmData && swarmData.paths && (() => {
      const COLORS = ['#5ce0d8', '#e0b45c', '#7cc49b', '#c8685a', '#a78bfa', '#f0808a', '#62b6ff', '#b6e36a'];
      const pts = swarmData.paths.flat();
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      pts.forEach(([x, y]) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      });
      if (!isFinite(minX)) {
        minX = -1;
        maxX = 1;
        minY = -1;
        maxY = 1;
      }
      const W = 380,
        H = 260,
        pad = 18;
      const spanX = Math.max(0.5, maxX - minX),
        spanY = Math.max(0.5, maxY - minY);
      const sc = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
      const px = x => pad + (x - minX) * sc;
      const py = y => H - pad - (y - minY) * sc; // flip: world y up
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("svg", {
        className: "swarm-plot",
        viewBox: '0 0 ' + W + ' ' + H,
        role: "img",
        "aria-label": "Swarm trails"
      }, /*#__PURE__*/React.createElement("rect", {
        x: "0",
        y: "0",
        width: W,
        height: H,
        rx: "6",
        fill: "var(--void)",
        stroke: "var(--border)"
      }), swarmData.paths.map((path, i) => {
        const d = path.map(([x, y], j) => (j === 0 ? 'M' : 'L') + px(x) + ' ' + py(y)).join(' ');
        const last = path[path.length - 1];
        return /*#__PURE__*/React.createElement("g", {
          key: i
        }, /*#__PURE__*/React.createElement("path", {
          d: d,
          fill: "none",
          stroke: COLORS[i % COLORS.length],
          strokeWidth: "2",
          strokeLinejoin: "round",
          opacity: "0.9"
        }), /*#__PURE__*/React.createElement("circle", {
          cx: px(last[0]),
          cy: py(last[1]),
          r: "4",
          fill: COLORS[i % COLORS.length]
        }));
      })), /*#__PURE__*/React.createElement("p", {
        className: "build-note"
      }, swarmData.n, " rovers ran the same program from different starting points. Identical code, no central controller, a coordinated pattern. All offline."));
    })()))), vaOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => !vaBusy && setVaOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal va-modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Talk to Kodro",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\uD83C\uDF99 Talk to Kodro \u2014 say a command, or ask a question"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setVaOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "va-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: 'va-wave' + (vaBusy ? ' live' : ''),
      "aria-hidden": "true"
    }, Array.from({
      length: 28
    }).map((_, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        ['--i']: i
      }
    }))), /*#__PURE__*/React.createElement("p", {
      className: "va-status"
    }, vaBusy ? 'Listening…' : vaData ? null : 'Tap the microphone in the bar to talk.'), vaData && vaData.text && /*#__PURE__*/React.createElement("p", {
      className: "va-heard"
    }, "\u201C", vaData.text, "\u201D"), vaData && vaData.ok === false && /*#__PURE__*/React.createElement("p", {
      className: "vibe-error",
      role: "alert"
    }, vaData.reason), vaData && vaData.ok && vaData.mode === 'command' && /*#__PURE__*/React.createElement("p", {
      className: "va-result"
    }, /*#__PURE__*/React.createElement("span", {
      className: "va-tag"
    }, "added to your code"), /*#__PURE__*/React.createElement("code", null, vaData.code)), vaData && vaData.ok && vaData.mode === 'answer' && /*#__PURE__*/React.createElement("div", {
      className: "ask-answer"
    }, /*#__PURE__*/React.createElement("p", {
      className: "ask-text"
    }, vaData.answer), vaData.sources && vaData.sources.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "ask-sources"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "From the lessons"), vaData.sources.map((s, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "ask-src"
    }, /*#__PURE__*/React.createElement("b", null, "[", i + 1, "] ", s.source), /*#__PURE__*/React.createElement("span", null, s.text))))), /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-run",
      disabled: vaBusy,
      onClick: runVoiceAgent
    }, vaBusy ? 'Listening…' : '🎙 Talk again')))), askOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => !askBusy && setAskOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Ask a question",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\u2753 Ask \u2014 answered from the lesson material, not made up"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setAskOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "ask-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "build-input"
    }, /*#__PURE__*/React.createElement("label", {
      className: "grow"
    }, /*#__PURE__*/React.createElement("span", null, "Your question"), /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: askQuery,
      placeholder: "e.g. how do I check for a wall?",
      onChange: e => setAskQuery(e.target.value),
      onKeyDown: e => {
        if (e.key === 'Enter') runAsk();
      },
      autoFocus: true
    })), /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-run",
      disabled: askBusy || !askQuery.trim(),
      onClick: runAsk
    }, askBusy ? 'Looking…' : 'Ask')), askData && askData.ok === false && /*#__PURE__*/React.createElement("p", {
      className: "vibe-error",
      role: "alert"
    }, askData.reason), askData && askData.ok && /*#__PURE__*/React.createElement("div", {
      className: "ask-answer"
    }, /*#__PURE__*/React.createElement("p", {
      className: "ask-text"
    }, askData.answer), askData.sources && askData.sources.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "ask-sources"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "From the lessons"), askData.sources.map((s, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "ask-src"
    }, /*#__PURE__*/React.createElement("b", null, "[", i + 1, "] ", s.source), /*#__PURE__*/React.createElement("span", null, s.text)))), askData.noModel && /*#__PURE__*/React.createElement("p", {
      className: "build-note"
    }, "Start a local model (Ollama) for a written answer; the lesson material above is shown offline."))))), teacherOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => setTeacherOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal modal-wide",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Teacher dashboard",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\uD83D\uDCCA Teacher dashboard \u2014 class concept strength"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setTeacherOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "teacher-body"
    }, !teacherData && /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "Reading the class memory on this machine\u2026"), teacherData && teacherData.pupils.length === 0 && /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "No pupil data yet. Pass a lesson to start the heatmap."), teacherData && teacherData.pupils.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        overflow: 'auto',
        maxHeight: '60vh'
      }
    }, /*#__PURE__*/React.createElement("table", {
      className: "heatmap-table"
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Pupil"), teacherData.concepts.map(c => /*#__PURE__*/React.createElement("th", {
      key: c,
      className: "hm-concept"
    }, c)))), /*#__PURE__*/React.createElement("tbody", null, teacherData.pupils.map(p => /*#__PURE__*/React.createElement("tr", {
      key: p.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "hm-name"
    }, p.name, p.active ? ' ·' : ''), teacherData.concepts.map(c => {
      const v = p.scores[c];
      const has = typeof v === 'number';
      const pct = has ? Math.round(v * 100) : null;
      const hue = has ? Math.round(v * 130) : 0; // 0 red → 130 green
      return /*#__PURE__*/React.createElement("td", {
        key: c,
        className: "hm-cell",
        title: has ? c + ': ' + pct + '%' : 'not attempted',
        style: {
          background: has ? 'hsl(' + hue + ' 55% 42%)' : 'transparent',
          color: has ? '#fff' : 'var(--fg-4)'
        }
      }, has ? pct : '·');
    }))))), /*#__PURE__*/React.createElement("p", {
      className: "build-note"
    }, "Each cell is a rolling strength score from 0 to 100 for that concept. Higher and greener is stronger. All data is local to this machine."))))), robotLabOpen && RobotLab && /*#__PURE__*/React.createElement(RobotLab, {
      onClose: () => setRobotLabOpen(false)
    }), reviewOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => !reviewBusy && setReviewOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "AI code review",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\uD83D\uDD0E Code review \u2014 a second AI agent checks your work"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setReviewOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "review-body"
    }, reviewBusy && /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "A reviewer agent is reading your code on this machine\u2026"), reviewErr && /*#__PURE__*/React.createElement("p", {
      className: "vibe-error",
      role: "alert"
    }, reviewErr), reviewData && !reviewBusy && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "Reviewer: ", /*#__PURE__*/React.createElement("b", null, reviewData.model), " \xB7 runs entirely offline."), reviewData.issues && reviewData.issues.length > 0 ? /*#__PURE__*/React.createElement("ul", {
      className: "review-issues"
    }, reviewData.issues.map((it, i) => /*#__PURE__*/React.createElement("li", {
      key: i
    }, it))) : /*#__PURE__*/React.createElement("p", {
      className: "review-clean"
    }, "No problems spotted. Nice work."), reviewData.revised && reviewData.code && /*#__PURE__*/React.createElement("div", {
      className: "review-rewrite"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Suggested rewrite (checked to run safely)"), /*#__PURE__*/React.createElement("pre", {
      className: "vibe-code"
    }, reviewData.code), /*#__PURE__*/React.createElement("div", {
      className: "vibe-code-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-run",
      onClick: applyReview
    }, "\u2713 Apply to editor"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      onClick: () => setReviewOpen(false)
    }, "Keep mine"))))))), vibeOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => !vibeBusy && setVibeOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal modal-wide",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Code with AI",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\u2728 Vibe coding \u2014 describe it, the AI writes it"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setVibeOpen(false)
    }, "\u2715")), aiInfo.available ? /*#__PURE__*/React.createElement("div", {
      className: "vibe-body"
    }, /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "Local model: ", /*#__PURE__*/React.createElement("b", null, aiInfo.model), " \xB7 runs entirely on this machine, nothing leaves it."), /*#__PURE__*/React.createElement("div", {
      className: "vibe-thread",
      role: "log",
      "aria-live": "polite",
      "aria-label": "AI conversation"
    }, vibeMsgs.length === 0 && /*#__PURE__*/React.createElement("p", {
      className: "vibe-empty"
    }, "Chat with the AI like a coding partner. It may ask a question first \u2014 e.g. try ", /*#__PURE__*/React.createElement("i", null, "\"explore the field\""), " or ", /*#__PURE__*/React.createElement("i", null, "\"draw a star\""), "."), vibeMsgs.map((m, i) => m.kind === 'code' ? /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "vibe-msg ai code"
    }, /*#__PURE__*/React.createElement("pre", {
      className: "vibe-code"
    }, m.text), /*#__PURE__*/React.createElement("div", {
      className: "vibe-code-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-run",
      onClick: () => vibeApply(m.text, m.model)
    }, "\u2713 Apply to editor"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      onClick: () => {
        setVibeMsgs(ms => [...ms, {
          role: 'user',
          kind: 'text',
          text: '(discarded — try again)'
        }]);
      }
    }, "Discard"))) : /*#__PURE__*/React.createElement("div", {
      key: i,
      className: 'vibe-msg ' + m.role
    }, /*#__PURE__*/React.createElement("span", null, m.text))), vibeBusy && /*#__PURE__*/React.createElement("div", {
      className: "vibe-msg ai thinking"
    }, vibeLive ? /*#__PURE__*/React.createElement("pre", {
      className: "vibe-live"
    }, vibeLive) : /*#__PURE__*/React.createElement("span", null, "Thinking\u2026")), /*#__PURE__*/React.createElement("div", {
      ref: vibeEndRef
    })), vibeError && /*#__PURE__*/React.createElement("p", {
      className: "vibe-error",
      role: "alert"
    }, vibeError), /*#__PURE__*/React.createElement("div", {
      className: "vibe-inputrow"
    }, /*#__PURE__*/React.createElement("button", {
      className: "icon-btn",
      title: "Speak your request (offline)",
      "aria-label": "Voice input",
      disabled: micBusy,
      onClick: vibeMic
    }, micBusy ? '…' : '🎤'), /*#__PURE__*/React.createElement("textarea", {
      className: "vibe-input",
      rows: 2,
      placeholder: "Say what the rover should do \u2014 the AI may ask you a question back",
      value: vibePrompt,
      onChange: e => setVibePrompt(e.target.value),
      onKeyDown: e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          vibeSend();
        }
      },
      "aria-label": "Describe what the rover should do",
      autoFocus: true
    }), /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-run",
      disabled: vibeBusy || !vibePrompt.trim(),
      onClick: vibeSend
    }, "Send")), /*#__PURE__*/React.createElement("span", {
      className: "vibe-hint"
    }, "Apply types the code into the editor \u2014 nothing runs until you press Run.")) : /*#__PURE__*/React.createElement("div", {
      className: "vibe-body"
    }, /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "AI is offline. Vibe coding uses a ", /*#__PURE__*/React.createElement("b", null, "local"), " model (no cloud, no account):"), /*#__PURE__*/React.createElement("ol", {
      className: "vibe-steps"
    }, /*#__PURE__*/React.createElement("li", null, "Install Ollama from ollama.com (free, offline after install)"), /*#__PURE__*/React.createElement("li", null, "Run: ", /*#__PURE__*/React.createElement("code", null, "ollama pull qwen2.5-coder:3b"), " (or ", /*#__PURE__*/React.createElement("code", null, "gemma3"), ")"), /*#__PURE__*/React.createElement("li", null, "Reopen Kodro \u2014 this panel lights up automatically"))))), blocksOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => setBlocksOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal modal-wide",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Block coding",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\uD83E\uDDE9 Blocks \u2014 click blocks to build, then turn them into Python"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setBlocksOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "blocks-palette"
    }, BLOCK_DEFS.map(d => /*#__PURE__*/React.createElement("button", {
      key: d.k,
      className: "block-chip",
      style: {
        borderColor: d.color
      },
      onClick: () => addBlock(d)
    }, d.label, d.unit ? ' ' + d.val + d.unit : '')), /*#__PURE__*/React.createElement("button", {
      className: "block-chip block-end",
      onClick: endBlock,
      disabled: blockIndent === 0
    }, "\u21A4 end block")), /*#__PURE__*/React.createElement("div", {
      className: "blocks-program",
      "aria-label": "Your program"
    }, blocks.length === 0 && /*#__PURE__*/React.createElement("p", {
      className: "vibe-hint"
    }, "Click blocks above \u2014 they stack here like Scratch."), blocks.map((b, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "block-row",
      style: {
        marginLeft: b.indent * 22 + 'px',
        borderLeftColor: b.color
      }
    }, /*#__PURE__*/React.createElement("span", null, b.label), b.val !== undefined && /*#__PURE__*/React.createElement("input", {
      type: "number",
      className: "block-num",
      value: b.val,
      min: b.unit === '%' ? 0 : 1,
      max: b.unit === '°' ? 360 : b.unit === '%' ? 100 : 20,
      "aria-label": b.label + ' amount',
      onChange: e => {
        const v = Number(e.target.value) || 1;
        setBlocks(bs => bs.map((x, j) => j === i ? {
          ...x,
          val: v
        } : x));
      }
    }), b.unit && /*#__PURE__*/React.createElement("span", {
      className: "vibe-hint"
    }, b.unit), /*#__PURE__*/React.createElement("span", {
      className: "block-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      disabled: i === 0,
      "aria-label": 'move ' + b.label + ' up',
      title: "Move up",
      onClick: () => moveBlock(i, -1)
    }, "\u2191"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      disabled: i === blocks.length - 1,
      "aria-label": 'move ' + b.label + ' down',
      title: "Move down",
      onClick: () => moveBlock(i, 1)
    }, "\u2193"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": 'remove ' + b.label,
      onClick: () => removeBlock(i)
    }, "\u2715"))))), /*#__PURE__*/React.createElement("div", {
      className: "vibe-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      disabled: !blocks.length,
      onClick: () => {
        setBlocks([]);
        setBlockIndent(0);
      }
    }, "Clear"), /*#__PURE__*/React.createElement("span", {
      className: "vibe-hint",
      style: {
        flex: 1
      }
    }, "Turns into real Python \u2014 watch it type itself into the editor."), /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-run",
      disabled: !blocks.length,
      onClick: insertBlocksCode
    }, "Insert code \u2192")))), showHelp && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => setShowHelp(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Keyboard shortcuts",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "Keyboard shortcuts"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setShowHelp(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("dl", {
      className: "shortcut-list"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Ctrl"), "+", /*#__PURE__*/React.createElement("kbd", null, "Enter")), /*#__PURE__*/React.createElement("dd", null, "Run / Pause the program")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "F10")), /*#__PURE__*/React.createElement("dd", null, "Step one instruction")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Tab")), /*#__PURE__*/React.createElement("dd", null, "Indent (in the editor)")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Shift"), "+", /*#__PURE__*/React.createElement("kbd", null, "Tab")), /*#__PURE__*/React.createElement("dd", null, "Dedent (in the editor)")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Enter")), /*#__PURE__*/React.createElement("dd", null, "Auto-indent the next line")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Esc")), /*#__PURE__*/React.createElement("dd", null, "Leave the editor / close this")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "?")), /*#__PURE__*/React.createElement("dd", null, "Show this help"))))), buildOpen && /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      onClick: () => setBuildOpen(false)
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal modal-wide",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Build a real robot",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "modal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "eyebrow"
    }, "\uD83E\uDD16 Build a real robot \u2014 what your budget can buy"), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": "Close",
      onClick: () => setBuildOpen(false)
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      className: "build-body"
    }, /*#__PURE__*/React.createElement("p", {
      className: "vibe-status"
    }, "Type a budget and the local AI plans a real rover you can build and program, mapping what you learned here onto real hardware. Nothing is ordered; this runs offline."), /*#__PURE__*/React.createElement("div", {
      className: "build-input"
    }, /*#__PURE__*/React.createElement("label", null, "Budget (US$)", /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "1",
      max: "100000",
      value: buildBudget,
      onChange: e => setBuildBudget(e.target.value),
      onKeyDown: e => {
        if (e.key === 'Enter') runBuild();
      }
    })), /*#__PURE__*/React.createElement("label", {
      className: "grow"
    }, "Goal (optional)", /*#__PURE__*/React.createElement("input", {
      type: "text",
      placeholder: "e.g. \"avoid walls and follow a line\"",
      value: buildGoal,
      onChange: e => setBuildGoal(e.target.value),
      onKeyDown: e => {
        if (e.key === 'Enter') runBuild();
      }
    })), /*#__PURE__*/React.createElement("button", {
      className: "ctrl ctrl-run",
      disabled: buildBusy,
      onClick: runBuild
    }, buildBusy ? 'Planning…' : 'Generate')), buildErr && /*#__PURE__*/React.createElement("p", {
      className: "vibe-error",
      role: "alert"
    }, buildErr), buildPlan && /*#__PURE__*/React.createElement("div", {
      className: "build-plan"
    }, /*#__PURE__*/React.createElement("div", {
      className: "build-head"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: '0 0 2px'
      }
    }, buildPlan.tier), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        color: 'var(--fg-2)',
        fontSize: 12
      }
    }, buildPlan.summary)), /*#__PURE__*/React.createElement("div", {
      className: 'build-cost' + (buildPlan.total <= buildPlan.budget ? ' ok' : ' over')
    }, "$", Math.round(buildPlan.total), " ", /*#__PURE__*/React.createElement("span", null, "of $", buildPlan.budget))), /*#__PURE__*/React.createElement(window.RoverSchematic, {
      parts: buildPlan.parts
    }), /*#__PURE__*/React.createElement("div", {
      className: "build-cols"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "eyebrow"
    }, "Parts"), /*#__PURE__*/React.createElement("table", {
      className: "build-table"
    }, /*#__PURE__*/React.createElement("tbody", null, buildPlan.parts.map((p, i) => /*#__PURE__*/React.createElement("tr", {
      key: i
    }, /*#__PURE__*/React.createElement("td", null, p.name), /*#__PURE__*/React.createElement("td", {
      className: "role"
    }, p.role), /*#__PURE__*/React.createElement("td", {
      className: "cost"
    }, "$", p.cost)))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "eyebrow"
    }, "Build steps"), /*#__PURE__*/React.createElement("ol", {
      className: "build-steps"
    }, buildPlan.steps.map((s, i) => /*#__PURE__*/React.createElement("li", {
      key: i
    }, s))), buildPlan.maps && buildPlan.maps.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "eyebrow",
      style: {
        marginTop: 8
      }
    }, "From Kodro to hardware"), /*#__PURE__*/React.createElement("dl", {
      className: "build-maps"
    }, buildPlan.maps.map((m, i) => /*#__PURE__*/React.createElement("div", {
      key: i
    }, /*#__PURE__*/React.createElement("dt", null, m.robolearn), /*#__PURE__*/React.createElement("dd", null, m.hardware))))))), buildPlan.fallback && /*#__PURE__*/React.createElement("p", {
      className: "build-note"
    }, "A standard plan is shown because the model could not tailor one within this budget."))))));
  }
  const TWEAK_DEFAULTS = {
    zoom: 1,
    tilt: 46,
    grid: true,
    ambientFx: true,
    trail: 'terrain'
  };
  const ORBIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
    <ellipse cx="32" cy="32" rx="28" ry="11" stroke="currentColor" stroke-width="2" transform="rotate(-22 32 32)" opacity="0.7"></ellipse>
    <ellipse cx="32" cy="32" rx="28" ry="11" stroke="currentColor" stroke-width="2" transform="rotate(22 32 32)" opacity="0.4"></ellipse>
    <circle cx="32" cy="32" r="4" fill="currentColor"></circle>
  </svg>`;

  // adjust grid columns to include resizer tracks
  const style = document.createElement('style');
  style.textContent = '.workspace{grid-template-columns:var(--editor-w) 5px 1fr 5px var(--tele-w);}';
  document.head.appendChild(style);
  ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})();
})();
