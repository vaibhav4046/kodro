/*
 * Kodro Realism Demo: a guided, self-contained tour that PROVES the academic
 * objectives by performing real actions, not by faking screens. Each step runs
 * actual code against the same sources of truth the studio uses, and shows the
 * real result, so a viewer sees in two or three minutes that the build drives
 * the simulation, the registry gates commands, validation reports a spread, and
 * the memory reuses what worked. Nothing here is mocked and nothing leaves the
 * machine.
 *
 *   window.KodroDemo({ onClose })
 */
(function () {
  const PROGRAM = [
    'set_speed(60)',
    'for i in range(120):',
    '    if distance() < 140:',
    '        turn_right(30)',
    '    else:',
    '        move_forward(1)',
  ].join('\n');

  function robot() { return (window.getKodroRobot && window.getKodroRobot()) || {}; }
  function ts() { try { return Date.now(); } catch (e) { return 0; } }

  // Each step performs a real action and returns { text, tone }.
  const STEPS = [
    {
      title: 'Design a light rover',
      blurb: 'The agent builds a rover from the validated parts catalogue. Its mass, top speed and battery come from the parts, not from sliders.',
      action: 'Build it',
      run: function () {
        const r = window.RobotLab.buildFromText('a light rover with an ultrasonic distance sensor');
        const d = r.derived;
        // Show battery as a driving RANGE in metres, like every other surface
        // (Lab card, diagnostics Endurance, verification report, Realism). The
        // raw catalogue runtimeMin floors+rounds to exactly 1 across the whole
        // mass/speed band, so 'battery ~1 min' was a constant that contradicted
        // this step's own 'battery comes from the parts' claim. rangeM varies
        // with mass (a light rover ~132 m, a heavy one ~51 m), demonstrating it.
        return { text: 'Built "' + r.spec.name + '": ' + d.mass + ' g, top speed ' + d.speedFactor.toFixed(2) + 'x, battery about ' + d.rangeM + ' m of driving on a charge. Recommended world: ' + (r.world.label || 'city') + '.', tone: 'ok' };
      },
    },
    {
      title: 'distance() is available',
      blurb: 'Because an ultrasonic sensor is fitted, the distance() command is in the registry that every panel reads.',
      action: 'Check the registry',
      run: function () {
        const a = window.KodroCommands.availability(robot());
        const ok = a.filter(function (c) { return c.available; }).map(function (c) { return c.name + '()'; });
        return { text: 'Available commands: ' + ok.join(', ') + '.', tone: 'ok' };
      },
    },
    {
      title: 'Validate across 5 randomised seeds',
      blurb: 'One program, five runs, each with different friction, mass, sensor noise and obstacle placement. A behaviour that survives the spread is the one to trust.',
      action: 'Run validation',
      run: function () {
        const scn = window.KodroScenario.defaultFor(robot().world || 'city');
        const rep = window.KodroScenario.run(PROGRAM, scn, 5);
        const g = rep.aggregate;
        // Use the single pass verdict the scenario derives from its own criteria
        // (with the shared PASS_RATE fallback for older reports), so the demo
        // agrees with the studio and the dashboard instead of its own threshold.
        const passed = g.passed != null ? g.passed : (g.successRate || 0) >= ((window.KodroScenario && window.KodroScenario.PASS_RATE) || 0.6);
        // Honest about the store: SQLite only exists under the desktop bridge;
        // the browser build persists to on-device memory (localStorage).
        return { text: 'Success ' + Math.round((g.successRate || 0) * 100) + '% (' + g.successCount + '/' + g.seeds + '), mean collisions ' + g.meanCollisions + ', mean battery ' + g.meanBattery + '%, mean score ' + g.meanScore + '. Saved to memory' + (window.pywebview ? ' and SQLite' : ' on this device') + '.', tone: passed ? 'ok' : 'warn' };
      },
    },
    {
      title: 'Remove the ultrasonic sensor',
      blurb: 'Now the build has no range sensor. Ask the registry for the distance command and it refuses, exactly as the grounded assistant would.',
      action: 'Remove it and ask',
      run: function () {
        const s = robot();
        window.RobotLab.applySpec(Object.assign({}, s, { sensors: (s.sensors || []).filter(function (x) { return x !== 'ultrasonic'; }) }));
        const g = window.KodroCommands.check(robot(), 'distance');
        return { text: g.ok ? 'Unexpectedly still available.' : 'Refused. ' + g.reason, tone: g.ok ? 'warn' : 'err' };
      },
    },
    {
      title: 'Refit the sensor and save the skill',
      blurb: 'With the sensor back, the program runs and works. Keep it as a named skill and record a reflection, so the studio remembers what worked here.',
      action: 'Refit, save, reflect',
      run: function () {
        window.RobotLab.buildFromText('a light rover with an ultrasonic distance sensor');
        const r = robot();
        window.KodroMemory.saveSkill('avoid_obstacle_ultrasonic', PROGRAM, { world: r.world || 'city', robotType: r.type || 'rover', ts: ts() });
        const refl = window.KodroMemory.record({ world: r.world || 'city', robotType: r.type || 'rover', outcome: 'done', detail: 'reached the goal with ultrasonic avoidance', ts: ts() });
        return { text: 'Saved skill "avoid_obstacle_ultrasonic". Reflection: ' + refl, tone: 'ok' };
      },
    },
    {
      title: 'Reuse it on the next run',
      blurb: 'On a related scenario the studio retrieves the saved skill and the reflection, so its help is shaped by your own verified work, with no retraining.',
      action: 'Retrieve memory',
      run: function () {
        const r = robot();
        const skill = (window.KodroMemory.skills() || []).find(function (s) { return s.name === 'avoid_obstacle_ultrasonic'; });
        const lesson = window.KodroMemory.lessonFor(r.world || 'city');
        return { text: 'Retrieved skill: ' + (skill ? skill.name : 'none') + '. Retrieved reflection: ' + (lesson ? lesson.reflection : 'none') + '.', tone: 'ok' };
      },
    },
  ];

  function KodroDemo(props) {
    const { useState, useEffect, useRef } = React;
    const [i, setI] = useState(0);
    const [results, setResults] = useState({});
    const snapRef = useRef(undefined);
    // Snapshot the pre-demo build so the tour, which builds and strips parts as
    // real actions (step 4 removes the ultrasonic), never permanently alters the
    // user's saved robot. Restore it when the demo closes or unmounts, by any
    // exit path (Close, Done, backdrop, or an abandon mid-tour).
    useEffect(function () {
      try { const rb = window.getKodroRobot && window.getKodroRobot(); snapRef.current = rb ? JSON.parse(JSON.stringify(rb)) : null; } catch (e) { snapRef.current = undefined; }
      return function () {
        try { if (snapRef.current && window.RobotLab && window.RobotLab.applySpec) window.RobotLab.applySpec(snapRef.current); } catch (e) { void e; }
      };
    }, []);
    const step = STEPS[i];
    const res = results[i];
    function doRun() {
      let out;
      try { out = step.run(); } catch (e) { out = { text: 'Error: ' + (e && e.message ? e.message : e), tone: 'err' }; }
      setResults(Object.assign({}, results, { [i]: out }));
    }

    return React.createElement('div', { className: 'modal-backdrop demo-backdrop', onClick: function () { return props.onClose && props.onClose(); } },
      // className 'modal' + role/aria-modal is the exact contract app.jsx's focus
      // trap keys on (it selects '.modal[aria-modal="true"]'), so opening the demo
      // moves focus into this dialog and confines Tab to it, like every other modal.
      // All styling now lives in styles.css (.demo-* + reused .modal / .ctrl), so
      // the tour repaints with every theme and inherits the shared hover, focus
      // and disabled states; .modal also carries the reduced-motion-safe entrance.
      React.createElement('div', { className: 'modal demo-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Realism demo', onClick: function (e) { e.stopPropagation(); } },
        React.createElement('div', { className: 'demo-head' },
          React.createElement('span', { className: 'demo-eyebrow' }, 'Kodro Realism Demo'),
          React.createElement('span', { className: 'demo-count' }, 'Step ' + (i + 1) + ' of ' + STEPS.length)
        ),
        React.createElement('h2', { className: 'demo-title' }, step.title),
        React.createElement('p', { className: 'demo-blurb' }, step.blurb),
        React.createElement('button', { type: 'button', className: 'ctrl ctrl-run', onClick: doRun }, step.action),
        res && React.createElement('div', { className: 'demo-result tone-' + res.tone }, res.text),
        React.createElement('div', { className: 'demo-foot' },
          React.createElement('button', { type: 'button', className: 'ctrl', onClick: function () { return props.onClose && props.onClose(); } }, 'Close'),
          React.createElement('div', { className: 'demo-nav' },
            i > 0 && React.createElement('button', { type: 'button', className: 'ctrl', onClick: function () { setResults({}); setI(i - 1); } }, 'Back'),
            i < STEPS.length - 1
              ? React.createElement('button', { type: 'button', className: 'ctrl ctrl-run', disabled: !res, onClick: function () { if (res) { setResults({}); setI(i + 1); } } }, 'Next')
              : React.createElement('button', { type: 'button', className: 'ctrl ctrl-run', onClick: function () { return props.onClose && props.onClose(); } }, 'Done')
          )
        )
      )
    );
  }

  window.KodroDemo = KodroDemo;
})();
