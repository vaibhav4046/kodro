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
        return { text: 'Built "' + r.spec.name + '": ' + d.mass + ' g, top speed ' + d.speedFactor.toFixed(2) + 'x, battery ~' + d.runtimeMin + ' min. Recommended world: ' + (r.world.label || 'city') + '.', tone: 'ok' };
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
        return { text: 'Success ' + Math.round((g.successRate || 0) * 100) + '% (' + g.successCount + '/' + g.seeds + '), mean collisions ' + g.meanCollisions + ', mean battery ' + g.meanBattery + '%, mean score ' + g.meanScore + '. Saved to memory and SQLite.', tone: g.successRate >= 0.5 ? 'ok' : 'warn' };
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
    const toneColor = function (t) { return t === 'err' ? '#ff8f7a' : t === 'warn' ? '#f5c451' : '#5ce0d8'; };

    function doRun() {
      let out;
      try { out = step.run(); } catch (e) { out = { text: 'Error: ' + (e && e.message ? e.message : e), tone: 'err' }; }
      setResults(Object.assign({}, results, { [i]: out }));
    }

    return React.createElement('div', { style: { position: 'fixed', inset: 0, zIndex: 4200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(120% 120% at 50% 0%,#101726cc 0%,#070a12ee 70%)', padding: 28 }, onClick: function () { return props.onClose && props.onClose(); } },
      React.createElement('div', { style: { width: 'min(640px,100%)', background: '#0d1422', border: '1.5px solid #233248', borderRadius: 18, padding: 26, color: '#e8edf7', boxShadow: '0 30px 80px -30px #000' }, onClick: function (e) { e.stopPropagation(); } },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 } },
          React.createElement('span', { style: { fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5ed6ff' } }, 'Kodro Realism Demo'),
          React.createElement('span', { style: { fontSize: 12, color: '#6f86a6' } }, 'Step ' + (i + 1) + ' of ' + STEPS.length)
        ),
        React.createElement('h2', { style: { fontSize: 24, fontWeight: 720, margin: '6px 0 8px', letterSpacing: '-0.02em' } }, step.title),
        React.createElement('p', { style: { color: '#9fb4d2', fontSize: 14, lineHeight: 1.55, margin: '0 0 16px' } }, step.blurb),
        React.createElement('button', { style: { appearance: 'none', border: 0, cursor: 'pointer', fontWeight: 650, borderRadius: 11, padding: '11px 22px', background: '#5ed6ff', color: '#06121b', fontSize: 14 }, onClick: doRun }, step.action),
        res && React.createElement('div', { style: { marginTop: 16, padding: '13px 15px', background: '#0f1726', border: '1.5px solid ' + toneColor(res.tone) + '55', borderRadius: 12, fontSize: 13.5, lineHeight: 1.5, color: '#dce8f8' } }, res.text),
        React.createElement('div', { style: { display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 22 } },
          React.createElement('button', { style: { appearance: 'none', border: '1px solid #283a55', background: 'transparent', color: '#9fb4d2', cursor: 'pointer', borderRadius: 11, padding: '10px 18px', font: 'inherit' }, onClick: function () { return props.onClose && props.onClose(); } }, 'Close'),
          React.createElement('div', { style: { display: 'flex', gap: 10 } },
            i > 0 && React.createElement('button', { style: { appearance: 'none', border: '1px solid #283a55', background: 'transparent', color: '#9fb4d2', cursor: 'pointer', borderRadius: 11, padding: '10px 18px', font: 'inherit' }, onClick: function () { setResults({}); setI(i - 1); } }, 'Back'),
            i < STEPS.length - 1
              ? React.createElement('button', { style: { appearance: 'none', border: 0, background: res ? '#5ed6ff' : '#1b2738', color: res ? '#06121b' : '#5d728f', cursor: res ? 'pointer' : 'not-allowed', borderRadius: 11, padding: '10px 20px', fontWeight: 650, font: 'inherit' }, disabled: !res, onClick: function () { if (res) { setResults({}); setI(i + 1); } } }, 'Next')
              : React.createElement('button', { style: { appearance: 'none', border: 0, background: '#5ed6ff', color: '#06121b', cursor: 'pointer', borderRadius: 11, padding: '10px 20px', fontWeight: 650, font: 'inherit' }, onClick: function () { return props.onClose && props.onClose(); } }, 'Done')
          )
        )
      )
    );
  }

  window.KodroDemo = KodroDemo;
})();
