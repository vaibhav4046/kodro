/*
 * Realism dashboard.
 *
 * A read-only debug panel that makes the simulation's honesty visible: it shows
 * that the robot the user built actually drives the physics, the sensors, the
 * command registry and the last validation run. Nothing here computes new
 * state; it reflects the single sources of truth (getKodroRobot, KodroCommands,
 * KodroMemory, TERRAINS) so a viewer can see at a glance that the spec matters.
 *
 *   window.KodroRealism({ onClose })
 */
(function () {
  const SENSOR_LABEL = {
    ultrasonic: 'Ultrasonic range', line: 'Line follower', imu: 'IMU (gyro + accel)',
    camera: 'Camera', gps: 'GPS', bumper: 'Bumper switch',
  };

  function card(title, rows, accent) {
    return React.createElement('div', { style: { background: '#0f1726', border: '1.5px solid #233248', borderRadius: 14, padding: '14px 16px' } },
      React.createElement('div', { style: { fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: accent || '#5ed6ff', marginBottom: 10 } }, title),
      React.createElement('div', { style: { display: 'grid', gap: 7 } }, rows)
    );
  }
  function row(label, value, color) {
    return React.createElement('div', { key: label, style: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, lineHeight: 1.4 } },
      React.createElement('span', { style: { color: '#8da3c0' } }, label),
      React.createElement('span', { style: { color: color || '#dce8f8', fontWeight: 600, textAlign: 'right' } }, value)
    );
  }

  function KodroRealism(props) {
    const robot = (window.getKodroRobot && window.getKodroRobot()) || {};
    const terrains = window.TERRAINS || {};
    const terrain = (robot.world && terrains[robot.world]) || terrains[Object.keys(terrains)[0]] || { name: '-', env: {}, traction: 1, id: '-' };
    const env = terrain.env || {};
    const massFac = robot.massFactor || 1;
    const speedFac = robot.speedFactor || 1;
    // Qualitative acceleration: heavier mass -> slower to reach top speed.
    const accel = massFac >= 1.4 ? 'slow (heavy)' : massFac >= 1.0 ? 'moderate' : 'brisk (light)';
    const avail = (window.KodroCommands && window.KodroCommands.availability(robot)) || [];
    const reports = (window.KodroMemory && window.KodroMemory.scenarioReports && window.KodroMemory.scenarioReports()) || [];
    const last = reports[0] || null;
    const agg = last && last.aggregate;

    // Physics card.
    const physics = card('Robot physics', [
      row('Mass', (robot.mass || '-') + ' g'),
      row('Top speed', speedFac.toFixed(2) + '×'),
      row('Acceleration', accel),
      row('Terrain friction', (terrain.traction != null ? terrain.traction.toFixed(2) : '-')),
      row('Battery / charge', '~' + (robot.runtimeMin || '-') + ' min'),
    ]);

    // Sensor card.
    const sensorRows = (robot.sensors && robot.sensors.length)
      ? robot.sensors.map(function (s) { return row(SENSOR_LABEL[s] || s, 'active', '#5ce0d8'); })
      : [row('Sensors', 'none fitted', '#f5c451')];
    sensorRows.push(row('Sensor noise', last && last.scenario ? 'randomised per seed' : 'nominal'));
    const sensors = card('Sensors', sensorRows, '#5ce0d8');

    // Scenario score card.
    const scoreRows = agg ? [
      row('Scenario', (last.scenario && last.scenario.name) || '-'),
      row('Success rate', Math.round((agg.successRate || 0) * 100) + '%  (' + (agg.successCount || 0) + '/' + (agg.seeds || 0) + ')', (agg.successRate >= 0.6 ? '#5ce0d8' : '#f5c451')),
      row('Mean collisions', String(agg.meanCollisions != null ? agg.meanCollisions : '-')),
      row('Mean time to goal', agg.meanTimeToGoal != null ? agg.meanTimeToGoal + ' steps' : 'n/a'),
      row('Mean battery used', (agg.meanBattery != null ? agg.meanBattery : '-') + '%'),
      row('Base seed', String((last.scenario && last.scenario.seed) != null ? last.scenario.seed : '-')),
    ] : [row('Validation', 'no runs yet', '#f5c451'), row('Tip', 'Run "Validate across seeds"')];
    const score = card('Scenario score', scoreRows, '#ffb86b');

    // Environment card.
    const environment = card('Environment', [
      row('Preset', terrain.name || terrain.id || '-'),
      row('Lighting', env.light != null ? env.light.toFixed(2) : '-'),
      row('Gravity', env.gravity != null ? env.gravity + ' m/s2' : '-'),
      row('Friction', terrain.traction != null ? terrain.traction.toFixed(2) : '-'),
      row('Moving agents', (window.KodroAgents && window.KodroAgents.list && window.KodroAgents.world && window.KodroAgents.world() === terrain.id) ? String(window.KodroAgents.list().length) : '0'),
    ], '#9fb4d2');

    // Command registry card.
    const okCmds = avail.filter(function (c) { return c.available; });
    const noCmds = avail.filter(function (c) { return !c.available; });
    const cmdRows = [];
    okCmds.forEach(function (c) { cmdRows.push(row(c.name + '()', 'available', '#5ce0d8')); });
    noCmds.forEach(function (c) { cmdRows.push(row(c.name + '()', 'needs ' + (c.partLabel || c.requires), '#ff8f7a')); });
    const registry = card('Command registry', cmdRows.length ? cmdRows : [row('Commands', 'base only')], '#c8a8ff');

    return React.createElement('div', { className: 'modal-backdrop', onClick: function () { return props.onClose && props.onClose(); } },
      React.createElement('div', { className: 'modal modal-wide', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Realism dashboard', style: { maxWidth: 860 }, onClick: function (e) { e.stopPropagation(); } },
        React.createElement('div', { className: 'modal-head' },
          React.createElement('span', { className: 'eyebrow' }, '📊 Realism dashboard. The build drives the simulation'),
          React.createElement('button', { className: 'btn-mini', 'aria-label': 'Close', onClick: function () { return props.onClose && props.onClose(); } }, '✕')
        ),
        React.createElement('div', { style: { padding: 16 } },
          React.createElement('p', { style: { color: '#8da3c0', fontSize: 13, margin: '0 0 14px' } },
            'Robot: ', React.createElement('b', { style: { color: '#dce8f8' } }, robot.name || 'My Robot'),
            ' · type ', robot.type || '-', ' · board ', robot.board || '-'),
          React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 } },
            physics, sensors, score, environment, registry
          )
        )
      )
    );
  }

  window.KodroRealism = KodroRealism;
})();
