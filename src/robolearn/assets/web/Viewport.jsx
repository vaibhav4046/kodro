/* ============================================================================
   ORBITAL ROVER — Viewport (3D diorama)
   A tilted, camera-tracked world: ground + perspective grid + standing
   obstacles + trail + a lifted rover that casts a shadow, kicks up dust while
   driving, and emits scan ripples. HUD stays in screen space.
   Exposes window.Viewport
   ========================================================================== */
(function () {
  const { useMemo } = React;
  const GROUND = window.TERRAIN_GROUND;
  const WALL = window.TERRAINS.WALL;

  const DUST = { earth: '#b9a878', mars: '#d89a6a', underwater: 'rgba(190,220,222,0.55)', space: '#9a9ca6' };
  const HORIZON = { earth: 'rgba(28,46,31,0.5)', mars: 'rgba(46,22,16,0.5)', underwater: 'rgba(4,22,31,0.55)', space: 'rgba(7,8,15,0.55)' };

  function Trail({ segments, accent }) {
    if (!segments || !segments.length) return null;
    return (
      <svg width={GROUND} height={GROUND} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }}>
        {segments.map((seg, i) => {
          if (seg.length < 2) return null;
          const d = seg.map((p, j) => (j === 0 ? 'M' : 'L') + (GROUND / 2 + p.x).toFixed(1) + ' ' + (GROUND / 2 + p.y).toFixed(1)).join(' ');
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="#000" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.18" />
              <path d={d} fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.78" />
            </g>
          );
        })}
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

  function Viewport({ terrain, rover, trail, sensorDist, say, crashKey, zoom, showGrid, showFx, trailColor, tilt, yaw, onTilt }) {
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
