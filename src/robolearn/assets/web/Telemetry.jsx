/* ============================================================================
   ORBITAL ROVER — Telemetry rail
   Live instrument cluster: compass, speed, proximity, battery, odometer, and
   the terrain environment readout (gravity, temperature, pressure, light).
   Exposes window.Telemetry
   ========================================================================== */
(function () {
  function norm(deg) { return ((deg % 360) + 360) % 360; }
  function cardinal(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(norm(deg) / 45) % 8];
  }

  function Compass({ heading, accent }) {
    const h = norm(heading);
    const ticks = [];
    for (let a = 0; a < 360; a += 30) {
      const major = a % 90 === 0;
      const r1 = major ? 27 : 30;
      const x1 = 37 + Math.sin(a * Math.PI / 180) * r1;
      const y1 = 37 - Math.cos(a * Math.PI / 180) * r1;
      const x2 = 37 + Math.sin(a * Math.PI / 180) * 33;
      const y2 = 37 - Math.cos(a * Math.PI / 180) * 33;
      ticks.push(<line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(245,240,228,0.35)" strokeWidth={major ? 1.4 : 0.8} />);
    }
    return (
      <svg className="compass" viewBox="0 0 74 74">
        <circle cx="37" cy="37" r="35" fill="#08090f" stroke="rgba(245,240,228,0.12)" strokeWidth="1" />
        {ticks}
        <text x="37" y="13" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="8" fill="rgba(245,240,228,0.55)">N</text>
        {/* rotating needle */}
        <g transform={`rotate(${h} 37 37)`} style={{ transition: 'transform 200ms cubic-bezier(0.22,0.61,0.36,1)' }}>
          <polygon points="37,10 32,40 42,40" fill={accent} />
          <polygon points="37,64 32,40 42,40" fill="rgba(245,240,228,0.22)" />
        </g>
        <circle cx="37" cy="37" r="3.2" fill="#08090f" stroke={accent} strokeWidth="1.4" />
      </svg>
    );
  }

  function Bar({ k, v, pct, color }) {
    return (
      <div>
        <div className="bm-row"><span className="bm-k">{k}</span><span className="bm-v">{v}</span></div>
        <div className="bar-track" style={{ marginTop: 4 }}>
          <div className="bar-fill" style={{ width: Math.max(0, Math.min(100, pct)) + '%', background: color }}></div>
        </div>
      </div>
    );
  }

  function Telemetry({ rover, terrain, sensorDist, odometer }) {
    const accent = terrain.accent;
    const env = terrain.env;
    const battery = rover.battery;
    const batColor = battery > 50 ? 'var(--success)' : battery > 20 ? 'var(--warning)' : 'var(--danger)';
    const speedPct = (rover.speed / 100) * 100;
    const dist = sensorDist == null ? 600 : sensorDist;
    const distState = dist < 80 ? 'danger' : dist < 200 ? 'warn' : '';
    const distColor = dist < 80 ? 'var(--danger)' : dist < 200 ? 'var(--warning)' : accent;

    return (
      <div className="tele-body">
        <div className="tele-section">
          <span className="eyebrow">Navigation</span>
          <div className="compass-wrap">
            <Compass heading={rover.heading} accent={accent} />
            <div className="compass-info">
              <div className="ci-deg">{norm(rover.heading) | 0}°</div>
              <div className="ci-card">{cardinal(rover.heading)}</div>
            </div>
          </div>
          <div className="bar-meter" style={{ marginTop: 14 }}>
            <Bar k="Velocity" v={rover.speed.toFixed(0) + ' cm/s'} pct={speedPct} color={accent} />
          </div>
        </div>

        <div className="tele-section">
          <span className="eyebrow">Proximity · Front Lidar</span>
          <div className={'dist-readout ' + distState}>
            <span className="dr-val">{dist >= 600 ? '600+' : dist.toFixed(0)}</span>
            <span className="dr-unit">cm to obstacle</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: Math.min(100, (dist / 600) * 100) + '%', background: distColor }}></div>
          </div>
        </div>

        <div className="tele-section">
          <span className="eyebrow">Systems</span>
          <div className="bar-meter">
            <Bar k="Battery" v={battery.toFixed(0) + '%'} pct={battery} color={batColor} />
            <Bar k="Traction" v={(terrain.traction * 100).toFixed(0) + '%'} pct={terrain.traction * 85} color={accent} />
          </div>
          <div className="gauges" style={{ marginTop: 12 }}>
            <div className="gauge">
              <span className="g-label">Odometer</span>
              <span className="g-val">{(odometer / 100).toFixed(1)}<span className="g-unit">m</span></span>
            </div>
            <div className="gauge">
              <span className="g-label">Status</span>
              <span className="g-val" style={{ fontSize: 13, color: rover.moving ? accent : 'var(--fg-3)', paddingTop: 4 }}>
                {rover.moving ? 'DRIVING' : 'IDLE'}
              </span>
            </div>
          </div>
        </div>

        <div className="tele-section" style={{ borderBottom: 'none' }}>
          <span className="eyebrow">Environment</span>
          <div className="gauges">
            <div className="gauge">
              <span className="g-label">Gravity</span>
              <span className="g-val">{env.gravity}<span className="g-unit">m/s²</span></span>
            </div>
            <div className="gauge">
              <span className="g-label">{env.tempLabel}</span>
              <span className="g-val">{env.temp}<span className="g-unit">°C</span></span>
            </div>
            <div className="gauge">
              <span className="g-label">{env.pressureLabel}</span>
              <span className="g-val">{env.pressure}<span className="g-unit">{env.pressureUnit}</span></span>
            </div>
            <div className="gauge">
              <span className="g-label">Light</span>
              <span className="g-val">{env.light}<span className="g-unit">%</span></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.Telemetry = Telemetry;
})();
