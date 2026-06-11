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
  const TERRAINS = {
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
  // Base fill (sits behind everything; mostly covered by the tilted ground)
  // ----------------------------------------------------------------------
  const BASE_FILL = {
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
        background: OB_FILL[id],
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
  function TerrainGround({
    terrain,
    children,
    showGrid
  }) {
    const g = groundBg(terrain.id);
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
    }), showGrid !== false ? /*#__PURE__*/React.createElement("div", {
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
    })));
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
    earth: '#b9a878',
    mars: '#d89a6a',
    underwater: 'rgba(190,220,222,0.55)',
    space: '#9a9ca6'
  };
  const HORIZON = {
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
    p
  }) {
    const cx = GROUND / 2 + p.x,
      cy = GROUND / 2 + p.y;
    const bill = {
      transform: 'rotateZ(calc(-1 * var(--yaw, 0deg))) rotateX(calc(-1 * var(--tilt, 46deg)))',
      transformOrigin: '50% 100%'
    };
    let body = null;
    switch (p.kind) {
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
      p: p
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
  TweakButton
});
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
      code: `# Welcome to Orbital Rover.
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
      text: 'Orbital Rover ready. Press Run to deploy.'
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
    const zoom = cam.zoom;
    const trailColor = t.trail === 'cyan' ? '#5ce0d8' : t.trail === 'amber' ? '#e0b45c' : t.trail === 'white' ? '#f5f0e4' : null;
    const terrain = TERRAINS[terrainId];

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
    const [showHelp, setShowHelp] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
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
      try {
        const history = next.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          text: m.text
        }));
        const r = await window.RoboLearn.aiChat(history, currentLessonIdRef.current);
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
      const sp = Math.max(8, s.speed);
      // 0.32s per (cm/speed); lower-traction terrain drives a little slower.
      const dur = total / sp * 1000 * 0.32 / (terrain.traction * speedMulRef.current);
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
      const drainFull = total * 0.011 / terrain.traction;
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
      s.battery = Math.max(0, b0 - travelled * 0.011 / terrain.traction);
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
    }, "RoboLearn \u2014 Orbital Rover Python coding simulator"), /*#__PURE__*/React.createElement("div", {
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
    }, "Orbital Rover"), /*#__PURE__*/React.createElement("div", {
      className: "brand-sub"
    }, "Rover Simulator \xB7 v1.0"))), /*#__PURE__*/React.createElement("div", {
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
    }, "+ New pupil\u2026"))), /*#__PURE__*/React.createElement("button", {
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
    }, "\uD83E\uDDE9 Blocks")), /*#__PURE__*/React.createElement(window.Editor, {
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
      }, lessonVerdict.passed ? '✓ Complete' : '✗ Not yet', " \xB7 ", lessonVerdict.score, "/100")), lesson.intro ? /*#__PURE__*/React.createElement("p", {
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
    }, ['earth', 'mars', 'underwater', 'space'].map(id => /*#__PURE__*/React.createElement("button", {
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
    }), TERRAINS[id].label))), /*#__PURE__*/React.createElement(window.Viewport, {
      terrain: terrain,
      rover: rover,
      trail: trail,
      props: props,
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
    })), vibeOpen && /*#__PURE__*/React.createElement("div", {
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
    }, /*#__PURE__*/React.createElement("span", null, "Thinking\u2026")), /*#__PURE__*/React.createElement("div", {
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
    }, /*#__PURE__*/React.createElement("li", null, "Install Ollama from ollama.com (free, offline after install)"), /*#__PURE__*/React.createElement("li", null, "Run: ", /*#__PURE__*/React.createElement("code", null, "ollama pull qwen2.5-coder:3b"), " (or ", /*#__PURE__*/React.createElement("code", null, "gemma3"), ")"), /*#__PURE__*/React.createElement("li", null, "Reopen RoboLearn \u2014 this panel lights up automatically"))))), blocksOpen && /*#__PURE__*/React.createElement("div", {
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
      min: 1,
      max: b.unit === '°' ? 360 : 20,
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
    }, b.unit), /*#__PURE__*/React.createElement("button", {
      className: "btn-mini",
      "aria-label": 'remove ' + b.label,
      onClick: () => removeBlock(i)
    }, "\u2715")))), /*#__PURE__*/React.createElement("div", {
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
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Ctrl"), "+", /*#__PURE__*/React.createElement("kbd", null, "Enter")), /*#__PURE__*/React.createElement("dd", null, "Run / Pause the program")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "F10")), /*#__PURE__*/React.createElement("dd", null, "Step one instruction")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Tab")), /*#__PURE__*/React.createElement("dd", null, "Indent (in the editor)")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Shift"), "+", /*#__PURE__*/React.createElement("kbd", null, "Tab")), /*#__PURE__*/React.createElement("dd", null, "Dedent (in the editor)")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Enter")), /*#__PURE__*/React.createElement("dd", null, "Auto-indent the next line")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "Esc")), /*#__PURE__*/React.createElement("dd", null, "Leave the editor / close this")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, /*#__PURE__*/React.createElement("kbd", null, "?")), /*#__PURE__*/React.createElement("dd", null, "Show this help"))))));
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
