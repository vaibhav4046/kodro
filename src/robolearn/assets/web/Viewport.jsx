/* ============================================================================
   KODRO — Viewport (3D diorama)
   A tilted, camera-tracked world: ground + perspective grid + standing
   obstacles + trail + a lifted rover that casts a shadow, kicks up dust while
   driving, and emits scan ripples. HUD stays in screen space.
   Exposes window.Viewport
   ========================================================================== */
(function () {
  const { useMemo, memo } = React;
  const GROUND = window.TERRAIN_GROUND;
  const WALL = window.TERRAINS.WALL;

  const DUST = { city: '#8a909c', room: '#c8b48c', earth: '#b9a878', mars: '#d89a6a', underwater: 'rgba(190,220,222,0.55)', space: '#9a9ca6' };
  const HORIZON = { city: 'rgba(26,31,40,0.5)', room: 'rgba(110,82,52,0.5)', earth: 'rgba(28,46,31,0.5)', mars: 'rgba(46,22,16,0.5)', underwater: 'rgba(4,22,31,0.55)', space: 'rgba(7,8,15,0.55)' };

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
    if (d === undefined) { d = buildPath(seg); pathCache.set(seg, d); }
    return d;
  }

  function TrailPath({ d, accent }) {
    return (
      <g>
        <path d={d} fill="none" stroke="#000" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.18" />
        <path d={d} fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.78" />
      </g>
    );
  }

  // Completed segments (all but the last) are immutable, so this layer only
  // re-renders when a new leg starts (count grows) or the colour changes — NOT
  // on every animation frame. memo with a count-based compare skips it during a
  // move, when only the live segment is growing. (A naive memo on `segments`
  // identity would wrongly skip: the array ref is stable while the last segment
  // mutates in place — see app.jsx, setTrail only fires on segment add/reset.)
  const CompletedTrail = memo(
    function CompletedTrail({ segments, count, accent }) {
      const paths = [];
      for (let i = 0; i < count; i++) {
        const seg = segments[i];
        if (seg.length < 2) continue;
        paths.push(<TrailPath key={i} d={cachedPath(seg)} accent={accent} />);
      }
      return paths;
    },
    (a, b) => a.accent === b.accent && a.count === b.count
  );

  function Trail({ segments, accent }) {
    if (!segments || !segments.length) return null;
    const last = segments[segments.length - 1];
    return (
      <svg width={GROUND} height={GROUND} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }}>
        <CompletedTrail segments={segments} count={segments.length - 1} accent={accent} />
        {/* in-progress leg: rebuilt each frame, bounded by the decimation + per-segment cap in pushTrailPoint */}
        {last && last.length >= 2 ? <TrailPath d={buildPath(last)} accent={accent} /> : null}
      </svg>
    );
  }

  function DustKick({ color }) {
    const motes = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
      dx: (Math.random() - 0.5) * 46, dy: 30 + Math.random() * 44, delay: -(i / 8) * 0.9, left: (Math.random() - 0.5) * 30
    })), []);
    return (
      <div className="dust-kick" style={{ ['--dust']: color }}>
        {motes.map((m, i) => (
          <span key={i} style={{ left: m.left, ['--dx']: m.dx + 'px', ['--dy']: m.dy + 'px', animationDelay: m.delay + 's' }}></span>
        ))}
      </div>
    );
  }

  // World props placed by pupil code (place("flag") etc). Billboarded like
  // obstacles so they stand up out of the tilted ground. Visual only.
  function Prop({ p, photoUrl }) {
    const cx = GROUND / 2 + p.x, cy = GROUND / 2 + p.y;
    const bill = { transform: 'rotateZ(calc(-1 * var(--yaw, 0deg))) rotateX(calc(-1 * var(--tilt, 46deg)))', transformOrigin: '50% 100%' };
    let body = null;
    switch (p.kind) {
      case 'photo':
        body = (
          <div style={{ ...bill, position: 'absolute', left: -26, bottom: 0, width: 52, height: 66 }}>
            <div style={{ position: 'absolute', left: 24, bottom: 0, width: 4, height: 14, background: 'linear-gradient(180deg,#9aa0b4,#5a5f70)', borderRadius: 2 }}></div>
            <div style={{ position: 'absolute', left: 0, top: 0, width: 52, height: 52, background: '#f5f0e4', borderRadius: 4, padding: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
              {photoUrl
                ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2 }} />
                : <div style={{ width: '100%', height: '100%', borderRadius: 2, background: 'linear-gradient(135deg,#5ce0d8,#1a6f6a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#06121b' }}>{window.KodroIcons ? window.KodroIcons.el('camera') : null}</div>}
            </div>
          </div>
        );
        break;
      case 'drone':
        body = (
          <div className="prop-drone" style={{ ...bill, position: 'absolute', left: -16, bottom: 26, width: 32, height: 18 }}>
            <div style={{ position: 'absolute', left: 8, top: 7, width: 16, height: 8, borderRadius: 3, background: 'linear-gradient(180deg,#aeb8e8,#5a6390)' }}></div>
            <div style={{ position: 'absolute', left: 0, top: 4, width: 12, height: 2, borderRadius: 2, background: '#cfd6f5', opacity: 0.85 }}></div>
            <div style={{ position: 'absolute', right: 0, top: 4, width: 12, height: 2, borderRadius: 2, background: '#cfd6f5', opacity: 0.85 }}></div>
            <div className="prop-pulse" style={{ position: 'absolute', left: 14, bottom: 0, width: 4, height: 4, borderRadius: '50%', background: '#5ce0d8' }}></div>
          </div>
        );
        break;
      case 'beacon':
        body = (
          <div style={{ ...bill, position: 'absolute', left: -5, bottom: 0, width: 10, height: 52 }}>
            <div style={{ position: 'absolute', left: 3, bottom: 0, width: 4, height: 44, background: 'linear-gradient(180deg,#9aa0b4,#5a5f70)', borderRadius: 2 }}></div>
            <div className="prop-pulse" style={{ position: 'absolute', left: 0, top: 0, width: 10, height: 10, borderRadius: '50%', background: '#5ce0d8', boxShadow: '0 0 12px #5ce0d8' }}></div>
          </div>
        );
        break;
      case 'rock':
        body = <div style={{ ...bill, position: 'absolute', left: -14, bottom: 0, width: 28, height: 22, borderRadius: '48% 52% 45% 55% / 70% 64% 36% 30%', background: 'radial-gradient(circle at 38% 26%, #8d8f99, #4c4e58 70%, #33353d)' }}></div>;
        break;
      case 'tree':
        body = (
          <div style={{ ...bill, position: 'absolute', left: -16, bottom: 0, width: 32, height: 58 }}>
            <div style={{ position: 'absolute', left: 13, bottom: 0, width: 6, height: 20, background: 'linear-gradient(180deg,#7a5a3a,#4c3722)', borderRadius: 2 }}></div>
            <div style={{ position: 'absolute', left: 0, top: 0, width: 32, height: 40, borderRadius: '50% 50% 46% 46%', background: 'radial-gradient(circle at 38% 28%, #7fae62, #3f6030 72%, #2c4422)' }}></div>
          </div>
        );
        break;
      case 'person':
        body = (
          <div style={{ ...bill, position: 'absolute', left: -9, bottom: 0, width: 18, height: 46 }}>
            <div style={{ position: 'absolute', left: 4, top: 0, width: 10, height: 10, borderRadius: '50%', background: '#e8c9a8' }}></div>
            <div style={{ position: 'absolute', left: 2, top: 11, width: 14, height: 22, borderRadius: '5px 5px 3px 3px', background: 'linear-gradient(180deg,#e0b45c,#a87f38)' }}></div>
            <div style={{ position: 'absolute', left: 4, top: 33, width: 4, height: 13, background: '#3a4356', borderRadius: 2 }}></div>
            <div style={{ position: 'absolute', left: 10, top: 33, width: 4, height: 13, background: '#3a4356', borderRadius: 2 }}></div>
          </div>
        );
        break;
      case 'crate':
        body = <div style={{ ...bill, position: 'absolute', left: -12, bottom: 0, width: 24, height: 22, background: 'linear-gradient(180deg,#a8845c,#6e5538)', border: '2px solid #4c3a24', borderRadius: 3, boxShadow: 'inset 0 0 0 2px rgba(255,235,200,0.12)' }}></div>;
        break;
      default: // flag
        body = (
          <div style={{ ...bill, position: 'absolute', left: -2, bottom: 0, width: 26, height: 54 }}>
            <div style={{ position: 'absolute', left: 0, bottom: 0, width: 3, height: 54, background: 'linear-gradient(180deg,#d8d3c4,#8b8678)', borderRadius: 2 }}></div>
            <div style={{ position: 'absolute', left: 3, top: 2, width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: '22px solid #5ce0d8' }}></div>
          </div>
        );
    }
    return (
      <div style={{ position: 'absolute', left: cx, top: cy, zIndex: 4 }}>
        <div style={{ position: 'absolute', left: -10, top: -4, width: 20, height: 8, borderRadius: '50%', background: 'rgba(0,0,0,0.3)', filter: 'blur(2px)' }}></div>
        {body}
      </div>
    );
  }

  function Viewport({ terrain, rover, trail, props, photoUrl, sensorDist, say, crashKey, zoom, showGrid, showFx, trailColor, tilt, yaw, onTilt }) {
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

    return (
      <div className="viewport" style={{ ['--horizon']: HORIZON[terrain.id] }}>
        <Backdrop terrain={terrain} />
        <Sky terrain={terrain} />

        {/* camera-tracked, tilted world */}
        <div className="world" style={{ transform: `rotateX(${tl}deg) scale(${z}) rotateZ(${yw}deg) translate(${-rover.x}px, ${-rover.y}px)`, ['--tilt']: tl + 'deg', ['--yaw']: yw + 'deg' }}>
          <Ground terrain={terrain} showGrid={showGrid}>
            <Trail segments={trail} accent={trailColor || terrain.accent} />
            {(props || []).map(p => <Prop key={p.id} p={p} photoUrl={photoUrl} />)}
          </Ground>

          {/* rover */}
          <div className="rover-wrap" style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${rover.x}px, ${rover.y}px)`, zIndex: 5 }}>
            {/* sensor range ring (flat on ground) */}
            <div className="sensor-ring" style={{
              position: 'absolute', left: -600, top: -600, width: 1200, height: 1200, borderRadius: '50%',
              border: '1px solid ' + terrain.accent, opacity: 0.07, pointerEvents: 'none'
            }}></div>

            {/* scan ripples */}
            {rover.scanning && (
              <div className="scan-ripple">
                <i style={{ width: 900, height: 900, animationDelay: '0s' }}></i>
                <i style={{ width: 900, height: 900, animationDelay: '0.5s' }}></i>
                <i style={{ width: 900, height: 900, animationDelay: '1s' }}></i>
              </div>
            )}

            {/* heading rotator (rotates on the ground plane) */}
            <div className="heading-rot" style={{ transform: `rotate(${rover.heading}deg)`, transformOrigin: 'center', position: 'absolute', left: 0, top: 0 }}>
              {/* forward sensor beam */}
              <div style={{
                position: 'absolute', left: -1.5, top: -beamLen - 30, width: 3, height: beamLen,
                background: `linear-gradient(180deg, transparent, ${terrain.accent})`, opacity: 0.55, pointerEvents: 'none'
              }}></div>
              {beamLen < 600 && (
                <div style={{
                  position: 'absolute', left: -6, top: -beamLen - 36, width: 12, height: 12, borderRadius: '50%',
                  background: terrain.accent, opacity: 0.85, boxShadow: '0 0 10px ' + terrain.accent
                }}></div>
              )}

              {/* dust kick (behind the rover) */}
              {rover.moving && <DustKick color={DUST[terrain.id]} />}

              {/* ground shadow */}
              <div className="rover-shadow"></div>

              {/* lifted rover body */}
              <div className="rover-lift" style={{ transform: 'translate(-50%,-50%) translateZ(16px)', position: 'absolute', left: 0, top: 0 }}>
                <Rover moving={rover.moving} accent={terrain.accent} led={rover.led} scanning={rover.scanning} />
              </div>
            </div>

            {say && (
              <div style={{ position: 'absolute', left: 0, top: -70, transform: counter, transformOrigin: 'center bottom' }}>
                <div className="say-bubble" style={{ left: 0, top: 0 }}>{say}</div>
              </div>
            )}
          </div>
        </div>

        {showFx !== false ? <Ambient terrain={terrain} /> : null}
        {showFx !== false ? <div className="vignette"></div> : null}
        {showFx !== false ? <div className="grain"></div> : null}

        {crashKey ? <div className="crash-flash" key={crashKey}></div> : null}

        {/* terrain name */}
        <div className="hud-tr">
          <div className="terrain-name">{terrain.name}</div>
          <div className="terrain-coord">{terrain.coord}</div>
        </div>

        {/* bottom-left mini HUD */}
        <div className="hud-bl">
          <div className="hl"><span>Pos X</span><span>{rover.x.toFixed(0)} cm</span></div>
          <div className="hl"><span>Pos Y</span><span>{(-rover.y).toFixed(0)} cm</span></div>
          <div className="hl"><span>Heading</span><span>{((rover.heading % 360) + 360) % 360 | 0}°</span></div>
        </div>

        {/* view mode toggle */}
        {onTilt && (
          <div className="view-mode-pill">
            <button className={tl <= 4 ? 'on' : ''} onClick={() => onTilt(0)}>2D</button>
            <button className={tl > 4 ? 'on' : ''} onClick={() => onTilt(46)}>3D</button>
          </div>
        )}
        <div className="orbit-hint">Drag to orbit · scroll to zoom</div>
      </div>
    );
  }

  window.Viewport = Viewport;
})();
