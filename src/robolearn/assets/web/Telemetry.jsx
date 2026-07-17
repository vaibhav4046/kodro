/* ============================================================================
   KODRO — Telemetry rail
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

  function Telemetry({ rover, terrain, sensorDist, odometer, robot, runState }) {
    const [performanceReport, setPerformanceReport] = React.useState(() => window.KodroPerformance || null);
    React.useEffect(() => {
      const receivePerformance = (event) => setPerformanceReport(event.detail || window.KodroPerformance || null);
      window.addEventListener('kodro-performance', receivePerformance);
      if (window.KodroPerformance) setPerformanceReport(window.KodroPerformance);
      return () => window.removeEventListener('kodro-performance', receivePerformance);
    }, []);
    const accent = terrain.accent;
    const env = terrain.env;
    const battery = rover.battery;
    const batColor = battery > 50 ? 'var(--success)' : battery > 20 ? 'var(--warning)' : 'var(--danger)';
    const dist = sensorDist == null ? 600 : sensorDist;
    // Honest instrumentation: the proximity cluster only reads when the build
    // actually carries the range sensor the reading comes from. A build
    // without an ultrasonic shows a NO RANGE SENSOR state instead of a
    // confident number from hardware that is not fitted (product-coherence D3).
    const hasRange = !window.KodroCommands || window.KodroCommands.check(robot || null, 'distance').ok;
    // Shared status vocabulary (app-data.jsx): the mission bar renders the
    // same labels, so the two surfaces can never contradict each other.
    const statusWord = ((window.KodroStatusLabels || {})[runState] || (rover.moving ? 'Running' : 'Standby')).toUpperCase();
    const statusColor = runState === 'error' ? 'var(--danger)'
      : (runState === 'running' || rover.moving) ? accent
      : runState === 'done' ? 'var(--success)' : 'var(--fg-3)';
    const distState = dist < 80 ? 'danger' : dist < 200 ? 'warn' : '';
    const distColor = dist < 80 ? 'var(--danger)' : dist < 200 ? 'var(--warning)' : accent;
    // A text cue for proximity so the state is not signalled by colour alone
    // (WCAG 1.4.1).
    const distWord = distState === 'danger' ? 'Obstacle close' : distState === 'warn' ? 'Caution' : 'Clear';
    // A single coarse status message for a polite live region. It is a CATEGORY,
    // not the live number, so it changes only when the rover crosses a threshold
    // and the screen reader announces once per change instead of every frame
    // (WCAG 4.1.3 without the per-frame spam a naive aria-live on the number
    // would cause).
    const liveMsg = distState === 'danger' ? 'Warning: obstacle close ahead'
      : battery <= 20 ? 'Battery low'
      : rover.moving ? 'Driving' : 'Idle';
    const srOnly = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };

    return (
      <div className="tele-body">
        <div role="status" aria-live="polite" style={srOnly}>{liveMsg}</div>
        <div className="tele-section">
          <span className="eyebrow" role="heading" aria-level="2">Navigation</span>
          <div className="compass-wrap" role="img" aria-label={'Heading ' + (Math.round(norm(rover.heading)) % 360) + ' degrees, ' + cardinal(rover.heading)}>
            <Compass heading={rover.heading} accent={accent} />
            <div className="compass-info">
              <div className="ci-deg">{Math.round(norm(rover.heading)) % 360}°</div>
              <div className="ci-card">{cardinal(rover.heading)}</div>
            </div>
          </div>
          <div className="bar-meter" style={{ marginTop: 14 }}>
            <Bar k="Power" v={rover.speed.toFixed(0) + '%'} pct={rover.speed} color={accent} />
          </div>
        </div>

        <div className="tele-section">
          <span className="eyebrow" role="heading" aria-level="2">{hasRange ? 'Proximity · Ultrasonic range' : 'Proximity'}</span>
          {hasRange ? (
            <>
              <div className={'dist-readout ' + distState} aria-label={distWord + ', ' + (dist >= 600 ? '600 plus' : dist.toFixed(0)) + ' centimetres to obstacle'}>
                <span className="dr-val">{dist >= 600 ? '600+' : dist.toFixed(0)}</span>
                <span className="dr-unit">cm to obstacle</span>
                {distState ? <span className="dr-state" style={{ color: distColor, fontWeight: 600, marginLeft: 8 }}>{distWord}</span> : null}
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: Math.min(100, (dist / 600) * 100) + '%', background: distColor }}></div>
              </div>
            </>
          ) : (
            <div className="dist-readout no-range" aria-label="No range sensor fitted; proximity readings unavailable">
              <span className="dr-val" style={{ fontSize: 15, color: 'var(--warning)' }}>NO RANGE SENSOR</span>
              <span className="dr-unit">fit an Ultrasonic in the Robot Lab to read distance</span>
            </div>
          )}
        </div>

        <div className="tele-section">
          <span className="eyebrow" role="heading" aria-level="2">Systems</span>
          <div className="bar-meter">
            <Bar k="Battery" v={battery.toFixed(0) + '%'} pct={battery} color={batColor} />
            <Bar k="Grip" v={Math.min(100, Math.round(terrain.traction * 100)) + '%'} pct={Math.min(100, Math.round(terrain.traction * 100))} color={accent} />
          </div>
          <div className="gauges" style={{ marginTop: 12 }}>
            <div className="gauge">
              <span className="g-label">Distance driven</span>
              <span className="g-val">{(odometer / 100).toFixed(1)}<span className="g-unit">m</span></span>
            </div>
            <div className="gauge">
              <span className="g-label">Status</span>
              <span className="g-val" style={{ fontSize: 13, color: statusColor, paddingTop: 4 }}>
                {statusWord}
              </span>
            </div>
          </div>
        </div>

        <div className="tele-section renderer-evidence" aria-label="Measured renderer evidence">
          <span className="eyebrow" role="heading" aria-level="2">Renderer</span>
          {performanceReport ? (
            <>
              <div className="gauges">
                <div className="gauge">
                  <span className="g-label">Observed cadence</span>
                  <span className="g-val">{performanceReport.measuredFps}<span className="g-unit">fps</span></span>
                </div>
                <div className="gauge">
                  <span className="g-label">P95 submission</span>
                  <span className="g-val">{performanceReport.p95RenderSubmissionMs}<span className="g-unit">ms</span></span>
                </div>
                <div className="gauge">
                  <span className="g-label">240 Hz work budget</span>
                  <span className="g-val" style={{ fontSize: 12, color: performanceReport.highRefreshSubmissionReady ? 'var(--success)' : 'var(--warning)', paddingTop: 4 }}>
                    {performanceReport.highRefreshSubmissionReady ? 'MET HERE' : 'NOT MET HERE'}
                  </span>
                </div>
                <div className="gauge">
                  <span className="g-label">Effective quality</span>
                  <span className="g-val" style={{ fontSize: 12, paddingTop: 4 }}>{String(performanceReport.quality || 'unknown').toUpperCase()}</span>
                </div>
              </div>
              <p className="renderer-boundary">A 120-frame sample on this browser. Displayed FPS remains bounded by the display, browser, GPU, scene and device.</p>
            </>
          ) : (
            <p className="renderer-boundary">Sampling the 3D renderer. Evidence appears after 120 visible frames.</p>
          )}
        </div>

        <div className="tele-section" style={{ borderBottom: 'none' }}>
          <span className="eyebrow" role="heading" aria-level="2">Environment</span>
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
