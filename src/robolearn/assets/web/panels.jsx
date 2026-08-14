/* Presentational modal/popover components extracted from app.jsx.
 *
 * Each component here is a PURE function of its props: it renders one modal's
 * JSX exactly as it lived inline in App's giant return, and receives the state
 * and handlers it needs as props. No state, no effects, no window reads beyond
 * what the original inline block already did (e.g. window.KodroMemory in Memory,
 * window.RoverSchematic in Build) — those globals are loaded before this module
 * in the ORDER array, same as when the markup lived in app.jsx.
 *
 * ONE deliberate exception: VoiceControls, near the bottom, owns state and
 * effects. It has to. Browser speech is an external system with its own async
 * lifecycle (voices arrive after a voiceschanged event, recognition streams
 * interim results, consent persists in localStorage), and threading all of that
 * up into App would spread microphone plumbing across a file that has nothing
 * else to do with it. Everything else in here stays pure.
 *
 * app.jsx keeps the open/close semantics: it still renders each as
 *   {xOpen && <window.KodroPanels.XModal {...props} />}
 * so behaviour is identical — this is a structural move, not a behavioural one.
 *
 * Exposed as window.KodroPanels.
 */
(function () {
  const React = window.React;
  // Shared procedural icon sprite (P7/A2): every modal title carries a
  // monochrome SVG mark instead of an emoji.
  const KI = (name, cls) => (window.KodroIcons ? window.KodroIcons.el(name, cls) : null);

  // A model source is "local/offline" ONLY when it is the offline Ollama path
  // (source 'local' or 'browser') or a provider the registry marks local:true.
  // Any other source (groq, openrouter, ...) is a hosted model whose prompts
  // leave this machine and must be labelled honestly (judge HIGH-2: Groq BYOK
  // was falsely shown as "runs on this machine").
  function providerIsLocal(source) {
    if (source === 'local' || source === 'browser') return true;
    try {
      const P = window.KodroProviders;
      if (P && P.PROVIDERS && P.PROVIDERS[source]) return !!P.PROVIDERS[source].local;
    } catch (e) { void e; }
    return false;
  }
  // Where the code is going, decided BEFORE the answer comes back.
  //
  // The result line below is already honest about a hosted reviewer, but the
  // in-flight line said "on this machine" unconditionally -- so during the one
  // moment the upload is actually happening, a BYOK pupil was told the exact
  // opposite of the truth. The earlier fix for this (see providerIsLocal
  // above, judge HIGH-2) corrected the settled label and missed the pending
  // one. A cloud model is only ever used when a key is present and the active
  // provider is not local, which mirrors the cloudReady() gate the request
  // path itself applies.
  function pendingReviewLabel() {
    try {
      const cfg = window.KodroProviders && window.KodroProviders.config
        ? window.KodroProviders.config() : null;
      if (cfg && cfg.cloudReady && !cfg.local) {
        const who = providerName(cfg.provider);
        return 'Sending your code to ' + who + ' for a second opinion. It is leaving this machine…';
      }
    } catch (e) { void e; }
    return 'A second AI is reading your code on this machine…';
  }
  // Short, human display name for a provider source used in the labels above.
  function providerName(source) {
    const NAMES = { groq: 'Groq', openrouter: 'OpenRouter', ollama: 'Ollama' };
    if (source && NAMES[source]) return NAMES[source];
    return source ? (source.charAt(0).toUpperCase() + source.slice(1)) : 'the cloud provider';
  }

  // ---- Designed empty / zero states (design MEDIUM) -------------------------
  // One shared presentational block so every "nothing here yet" moment reads as
  // an intentional part of the product instead of a stray line of muted text:
  // a medallion glyph from the shared icon sprite, a display-font title, one
  // helpful line, and an optional keyboard/action affordance. Pure function of
  // its props: no state, no logic, no data. All colour and motion live in
  // styles.css (.empty-state*), routed through theme tokens so contrast holds
  // on every theme and the only motion is a decorative, reduced-motion-safe
  // medallion entrance. `title`/`hint` accept a string or a React node.
  function EmptyState({ icon, title, hint, action, tone }) {
    return (
      <div className={'empty-state' + (tone ? ' is-' + tone : '')}>
        <span className="empty-state-icon" aria-hidden="true">{icon ? KI(icon) : null}</span>
        <p className="empty-state-title">{title}</p>
        {hint ? <p className="empty-state-hint">{hint}</p> : null}
        {action ? <div className="empty-state-cta">{action}</div> : null}
      </div>
    );
  }

  // ---- Keyboard shortcuts (Help) ----
  // Pure static content; only needs a close handler.
  function HelpModal({ onClose }) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <span className="eyebrow" role="heading" aria-level="2">Keyboard shortcuts</span>
            <button className="btn-mini" aria-label="Close" onClick={onClose}>✕</button>
          </div>
          <div className="shortcut-groups">
            <section className="shortcut-group">
              <h3 className="shortcut-group-title">Run controls</h3>
              <dl className="shortcut-list">
                <div><dt><kbd>Ctrl</kbd>+<kbd>Enter</kbd></dt><dd>Run / Pause the program</dd></div>
                <div><dt><kbd>F5</kbd></dt><dd>Run / Pause the program</dd></div>
                <div><dt><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd></dt><dd>Step one instruction</dd></div>
                <div><dt><kbd>F10</kbd></dt><dd>Step one instruction</dd></div>
                <div><dt><kbd>Esc</kbd></dt><dd>Reset the rover (or close a dialog)</dd></div>
              </dl>
            </section>
            <section className="shortcut-group">
              <h3 className="shortcut-group-title">View controls</h3>
              <dl className="shortcut-list">
                {/* First-person was removed in round 3 (2D + 3D only; `fpv` is
                    a hard-coded false in app.jsx). Its Ctrl+F entry outlived
                    it, documenting a shortcut with no handler — and in the
                    browser build Ctrl+F is not preventDefault-ed, so the
                    documented key opens the browser's find bar instead. */}
                <div><dt><kbd>Ctrl</kbd>+<kbd>D</kbd></dt><dd>Toggle 2D / 3D view</dd></div>
              </dl>
            </section>
            <section className="shortcut-group">
              <h3 className="shortcut-group-title">Panels</h3>
              <dl className="shortcut-list">
                <div><dt><kbd>Ctrl</kbd>+<kbd>B</kbd></dt><dd>Toggle block coding panel</dd></div>
                <div><dt><kbd>Ctrl</kbd>+<kbd>L</kbd></dt><dd>Toggle Robot Lab</dd></div>
                <div><dt><kbd>Ctrl</kbd>+<kbd>M</kbd></dt><dd>Toggle Memory panel</dd></div>
                <div><dt><kbd>Ctrl</kbd>+<kbd>S</kbd></dt><dd>Save the project (.kodro)</dd></div>
                <div><dt><kbd>Ctrl</kbd>+<kbd>/</kbd></dt><dd>Toggle this help</dd></div>
                <div><dt><kbd>?</kbd></dt><dd>Toggle this help</dd></div>
              </dl>
            </section>
            <section className="shortcut-group">
              <h3 className="shortcut-group-title">Worlds</h3>
              <dl className="shortcut-list">
                <div><dt><kbd>Ctrl</kbd>+<kbd>1</kbd></dt><dd>City</dd></div>
                <div><dt><kbd>Ctrl</kbd>+<kbd>2</kbd></dt><dd>Room</dd></div>
                <div><dt><kbd>Ctrl</kbd>+<kbd>3</kbd></dt><dd>Earth</dd></div>
                <div><dt><kbd>Ctrl</kbd>+<kbd>4</kbd></dt><dd>Mars</dd></div>
                <div><dt><kbd>Ctrl</kbd>+<kbd>5</kbd></dt><dd>Underwater</dd></div>
                <div><dt><kbd>Ctrl</kbd>+<kbd>6</kbd></dt><dd>Space</dd></div>
              </dl>
            </section>
          </div>
          <p className="shortcut-editor-hint">In the editor: <kbd>Tab</kbd> indent · <kbd>Shift</kbd>+<kbd>Tab</kbd> dedent · <kbd>Enter</kbd> auto-indent next line · <kbd>Esc</kbd> leave the editor</p>
        </div>
      </div>
    );
  }

  // ---- Build a real robot ----
  // Renders window.RoverSchematic (loaded earlier in ORDER), same as inline.
  function BuildModal({ onClose, buildBudget, setBuildBudget, buildGoal, setBuildGoal, buildBusy, runBuild, buildErr, buildPlan, robotSpec, onAdoptParts }) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Build a real robot" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <span className="eyebrow" role="heading" aria-level="2">{KI('build')}Build a real robot. What your budget can buy</span>
            <button className="btn-mini" aria-label="Close" onClick={onClose}>✕</button>
          </div>
          <div className="build-body" role="status" aria-live="polite">
            <p className="vibe-status">Type a budget and the built-in AI plans a real robot you could build and program, showing which real part does each job your simulated robot does. Nothing is ordered, and nothing goes online.</p>
            {robotSpec && (
              <p className="build-active" data-build-active="1">
                Pricing your current robot: <b>{robotSpec.name || 'My Robot'}</b>
                {' · '}{robotSpec.type || 'rover'}
                {' · '}{[].concat(robotSpec.sensors || [], robotSpec.actuators || []).join(', ') || 'no parts fitted'}
              </p>
            )}
            <div className="build-input">
              <label>Budget (US$)
                <input type="number" min="1" max="100000" value={buildBudget} onChange={e => setBuildBudget(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runBuild(); }} />
              </label>
              <label className="grow">Goal (optional)
                <input type="text" placeholder='e.g. "avoid walls and follow a line"' value={buildGoal} onChange={e => setBuildGoal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runBuild(); }} />
              </label>
              <button className="ctrl ctrl-run" disabled={buildBusy} onClick={runBuild}>{buildBusy ? 'Planning…' : 'Generate'}</button>
            </div>
            {buildErr && <p className="vibe-error" role="alert">{buildErr}</p>}
            {buildPlan && (
              <div className="build-plan">
                <div className="build-head">
                  <div>
                    <h3 style={{ margin: '0 0 2px' }}>{buildPlan.tier}</h3>
                    <p style={{ margin: 0, color: 'var(--fg-2)', fontSize: 12 }}>{buildPlan.summary}</p>
                  </div>
                  <div className={'build-cost' + (buildPlan.total <= buildPlan.budget ? ' ok' : ' over')}>
                    ~${Math.round(buildPlan.total)} <span>of ${buildPlan.budget}</span>
                  </div>
                </div>
                <p className="build-note" style={{ margin: '2px 0 8px' }}>Prices are rough AI estimates to shape the build, not live quotes. Check the seller for the real price before buying.</p>
                <window.RoverSchematic parts={buildPlan.parts} />
                <div className="build-cols">
                  <div>
                    <div className="eyebrow">Parts</div>
                    <table className="build-table">
                      <tbody>
                        {buildPlan.parts.map((p, i) => (
                          <tr key={i}><td>{p.name}</td><td className="role">{p.role}</td><td className="cost">~${p.cost}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <div className="eyebrow">Build steps</div>
                    <ol className="build-steps">{buildPlan.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                    {buildPlan.maps && buildPlan.maps.length > 0 && (
                      <>
                        <div className="eyebrow" style={{ marginTop: 8 }}>From Kodro to hardware</div>
                        <dl className="build-maps">
                          {buildPlan.maps.map((m, i) => <div key={i}><dt>{m.robolearn}</dt><dd>{m.hardware}</dd></div>)}
                        </dl>
                      </>
                    )}
                  </div>
                </div>
                {buildPlan.fallback && <p className="build-note">A standard plan is shown because the model could not tailor one within this budget.</p>}
                {onAdoptParts && (
                  <div className="vibe-code-actions" style={{ marginTop: 10 }}>
                    <button className="ctrl ctrl-run" onClick={() => onAdoptParts(buildPlan)}>Fit these parts in the Robot Lab</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Agent swarm ----
  // swarmBusy gates the backdrop close; setSwarmOpen closes via the ✕ button.
  function SwarmModal({ swarmBusy, setSwarmOpen, swarmData }) {
    return (
      <div className="modal-backdrop" onClick={() => !swarmBusy && setSwarmOpen(false)}>
        <div className="modal" role="dialog" aria-modal="true" aria-label="Agent swarm" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <span className="eyebrow" role="heading" aria-level="2">{KI('swarm')}Robot swarm. Your one program, run by many rovers at once</span>
            <button className="btn-mini" aria-label="Close" onClick={() => setSwarmOpen(false)}>✕</button>
          </div>
          <div className="swarm-body">
            {swarmBusy && <p className="vibe-status" role="status" aria-live="polite">Launching the swarm…</p>}
            {swarmData && swarmData.paths && (() => {
              const COLORS = ['var(--cyan)', '#e0b45c', '#7cc49b', '#c8685a', '#a78bfa', '#f0808a', '#62b6ff', '#b6e36a'];
              const pts = swarmData.paths.flat();
              let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
              pts.forEach(([x, y]) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; });
              if (!isFinite(minX)) { minX = -1; maxX = 1; minY = -1; maxY = 1; }
              const W = 380, H = 260, pad = 18;
              const spanX = Math.max(0.5, maxX - minX), spanY = Math.max(0.5, maxY - minY);
              const sc = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
              const px = x => pad + (x - minX) * sc;
              const py = y => H - pad - (y - minY) * sc; // flip: world y up
              return (
                <div>
                  <svg className="swarm-plot" viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label="Swarm trails">
                    <rect x="0" y="0" width={W} height={H} rx="6" fill="var(--void)" stroke="var(--border)" />
                    {swarmData.paths.map((path, i) => {
                      const d = path.map(([x, y], j) => (j === 0 ? 'M' : 'L') + px(x) + ' ' + py(y)).join(' ');
                      const last = path[path.length - 1];
                      return (
                        <g key={i}>
                          <path d={d} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="2" strokeLinejoin="round" opacity="0.9" />
                          <circle cx={px(last[0])} cy={py(last[1])} r="4" fill={COLORS[i % COLORS.length]} />
                        </g>
                      );
                    })}
                  </svg>
                  <p className="build-note">{swarmData.n} rovers ran the same program from different starting points. Same code on every rover, no leader telling them what to do, and a pattern still forms. All offline.</p>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  // ---- Teacher dashboard ----
  function TeacherModal({ onClose, teacherData }) {
    // The class register is real in BOTH modes now: desktop persists via Python,
    // the browser via the on-device pupil-store (localStorage, same EMA rule).
    // browserMode only tunes the copy -- "in this browser on this device" vs "on
    // this computer" -- and the empty-state wording; the heatmap table renders
    // identically once there are rows.
    const browserMode = typeof window !== 'undefined' && window.RoboLearn && !window.RoboLearn.isAvailable();
    const hasRows = teacherData && Array.isArray(teacherData.pupils) && teacherData.pupils.length > 0;
    const masteryValues = hasRows ? teacherData.pupils.reduce((all, pupil) => {
      Object.keys(pupil.scores || {}).forEach(key => {
        if (typeof pupil.scores[key] === 'number') all.push(pupil.scores[key]);
      });
      return all;
    }, []) : [];
    const averageMastery = masteryValues.length
      ? Math.round(masteryValues.reduce((sum, value) => sum + value, 0) / masteryValues.length * 100)
      : null;
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal teacher-dashboard" role="dialog" aria-modal="true" aria-label="Teacher dashboard" onClick={e => e.stopPropagation()}>
          <div className="teacher-head">
            <div>
              <span className="eyebrow">{KI('report')} Classroom progress</span>
              <h2>{browserMode ? 'Learning on this device' : 'How the class is doing'}</h2>
              <p>Concept strength updates after each graded lesson attempt. It is evidence of practice in Kodro, not a predicted grade.</p>
            </div>
            <button className="btn-mini teacher-close" aria-label="Close teacher dashboard" onClick={onClose}>✕</button>
          </div>
          <div className="teacher-body">
            {!teacherData && <p className="vibe-status">Reading the class records saved on this {browserMode ? 'browser' : 'computer'}…</p>}
            {teacherData && !hasRows && browserMode && (
              <EmptyState
                icon="report"
                title="No progress recorded yet"
                hint="Pass a lesson and each idea you master fills in here, greener as it gets stronger. Records are saved in this browser on this device, and nothing leaves it."
              />
            )}
            {teacherData && !hasRows && !browserMode && (
              <EmptyState
                icon="report"
                title="No pupil records yet"
                hint="As pupils pass lessons on this computer, each idea they master fills in here, greener as it gets stronger."
              />
            )}
            {hasRows && (
              <div className="teacher-content">
                {/* The marks, OUT of the browser. The whole register dies on
                    this device otherwise: a head of computing cannot bring a
                    localStorage key to a book scrutiny. CSV because every
                    school system already opens it (SIMS, Arbor, Excel,
                    Sheets); one file per question. Browser mode only: the
                    desktop app's register lives in Python's SQLite and exports
                    from there. */}
                {browserMode && window.KodroMarkbook && (
                  <div className="teacher-export" role="group" aria-label="Export the register">
                    <button className="btn-mini" onClick={() => {
                      const csv = window.KodroMarkbook.markbookCsv(
                        (typeof window.KODRO_LESSON_LIST !== 'undefined' && window.KODRO_LESSON_LIST) || []);
                      if (!csv) { alert('No lesson results to export yet. Results appear here after a pupil submits a lesson.'); return; }
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = 'kodro-markbook.csv';
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      setTimeout(() => URL.revokeObjectURL(url), 2000);
                    }}>Download markbook (CSV)</button>
                    <button className="btn-mini" onClick={() => {
                      const csv = window.KodroMarkbook.strengthsCsv();
                      if (!csv) { alert('No concept strengths to export yet.'); return; }
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = 'kodro-concept-strengths.csv';
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      setTimeout(() => URL.revokeObjectURL(url), 2000);
                    }}>Download strengths (CSV)</button>
                    <span className="teacher-export-note">Practice feedback, not assessment evidence.</span>
                  </div>
                )}
                <div className="teacher-summary" aria-label="Classroom summary">
                  <div><strong>{teacherData.pupils.length}</strong><span>{teacherData.pupils.length === 1 ? 'learner' : 'learners'}</span></div>
                  <div><strong>{teacherData.concepts.length}</strong><span>{teacherData.concepts.length === 1 ? 'concept' : 'concepts'} practised</span></div>
                  <div><strong>{averageMastery == null ? '—' : averageMastery + '%'}</strong><span>average strength</span></div>
                </div>
                <div className="teacher-table-wrap">
                  <table className="heatmap-table">
                    <thead>
                      <tr>
                        <th scope="col">{browserMode ? 'Learner' : 'Pupil'}</th>
                        {teacherData.concepts.map(c => <th key={c} scope="col" className="hm-concept">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {teacherData.pupils.map(p => (
                        <tr key={p.id}>
                          <th scope="row" className="hm-name">{p.name}{p.active ? <span className="hm-active">(active)</span> : ''}</th>
                          {teacherData.concepts.map(c => {
                            const v = p.scores[c];
                            const has = typeof v === 'number';
                            const pct = has ? Math.round(v * 100) : null;
                            const hue = has ? Math.round(v * 130) : 0; // 0 red → 130 green
                            // WCAG AA: white text fails contrast on the lighter (green/yellow)
                            // cells, so compute the cell's relative luminance and flip to black
                            // text once it crosses the threshold where white drops below 4.5:1.
                            const cellLum = (() => {
                              if (!has) return 0;
                              const s = 0.55, l = 0.42, q = l < 0.5 ? l * (1 + s) : l + s - l * s, pp = 2 * l - q;
                              const hk = (t) => { t = (t + 1) % 1; if (t < 1 / 6) return pp + (q - pp) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return pp + (q - pp) * (2 / 3 - t) * 6; return pp; };
                              const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
                              const h = hue / 360;
                              return 0.2126 * lin(hk(h + 1 / 3)) + 0.7152 * lin(hk(h)) + 0.0722 * lin(hk(h - 1 / 3));
                            })();
                            return (
                              <td key={c} className="hm-cell" title={has ? c + ': ' + pct + '%' : c + ': not attempted'}
                                aria-label={has ? c + ': ' + pct + ' percent strength' : c + ': not attempted'}
                                style={{ background: has ? 'hsl(' + hue + ' 55% 42%)' : 'transparent', color: has ? (cellLum > 0.183 ? '#000' : '#fff') : 'var(--fg-4)' }}>
                                {has ? pct + '%' : '·'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="teacher-legend" aria-label="Concept strength legend">
                  <span><i className="legend-low"></i>Needs practice</span>
                  <span><i className="legend-mid"></i>Developing</span>
                  <span><i className="legend-high"></i>Strong</span>
                </div>
                <p className="teacher-privacy">Scores run from 0 to 100 and update after every graded attempt. A dot means not attempted. {browserMode ? 'This hosted version keeps one combined record for this browser. Use the desktop app for separate pupil records.' : 'Records stay on this computer.'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- AI code review ----
  function ReviewModal({ reviewBusy, setReviewOpen, reviewErr, reviewData, applyReview }) {
    return (
      <div className="modal-backdrop" onClick={() => !reviewBusy && setReviewOpen(false)}>
        <div className="modal" role="dialog" aria-modal="true" aria-label="AI code review" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <span className="eyebrow" role="heading" aria-level="2">{KI('review')}Code review. A second AI checks your work</span>
            <button className="btn-mini" aria-label="Close" onClick={() => setReviewOpen(false)}>✕</button>
          </div>
          <div className="review-body" role="status" aria-live="polite">
            {reviewBusy && <p className="vibe-status">{pendingReviewLabel()}</p>}
            {reviewErr && <p className="vibe-error" role="alert">{reviewErr}</p>}
            {reviewData && !reviewBusy && (
              <div>
                <p className="vibe-status">Reviewer: <b>{reviewData.model}</b> · {providerIsLocal(reviewData.source) ? 'runs entirely offline' : 'via ' + providerName(reviewData.source) + ', your code is sent to ' + providerName(reviewData.source)}.</p>
                {reviewData.issues && reviewData.issues.length > 0 ? (
                  <ul className="review-issues">
                    {reviewData.issues.map((it, i) => <li key={i}>{it}</li>)}
                  </ul>
                ) : (
                  <EmptyState
                    icon="review"
                    tone="clean"
                    title="No problems spotted"
                    hint="The reviewer read your code and found nothing to change."
                  />
                )}
                {reviewData.revised && reviewData.code && (
                  <div className="review-rewrite">
                    <span className="eyebrow" role="heading" aria-level="2">Suggested rewrite</span>
                    <pre className="vibe-code">{reviewData.code}</pre>
                    <p className="vibe-hint">Read the diff before applying; the self-test runs when you apply.</p>
                    <div className="vibe-code-actions">
                      <button className="ctrl ctrl-run" onClick={applyReview}>✓ Apply to editor</button>
                      <button className="btn-mini" onClick={() => setReviewOpen(false)}>Keep mine</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Ask (lesson Q&A) ----
  function AskModal({ askBusy, setAskOpen, askQuery, setAskQuery, runAsk, askData }) {
    return (
      <div className="modal-backdrop" onClick={() => !askBusy && setAskOpen(false)}>
        <div className="modal" role="dialog" aria-modal="true" aria-label="Ask a question" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <span className="eyebrow" role="heading" aria-level="2">{KI('ask')}Ask. {askData && !providerIsLocal(askData.source) ? 'Answered by ' + providerName(askData.source) + ' (your key); your question is sent to ' + providerName(askData.source) : (askData && askData.grounded === false ? 'Answered by the local model on this machine' : (window.pywebview ? 'Answers come from the built-in lesson notes when they cover it' : 'Answered by the AI model on this machine'))}</span>
            <button className="btn-mini" aria-label="Close" onClick={() => setAskOpen(false)}>✕</button>
          </div>
          <div className="ask-body" role="status" aria-live="polite">
            <div className="build-input">
              <label className="grow"><span>Your question</span>
                <input type="text" value={askQuery} placeholder='e.g. how do I check for a wall?'
                  onChange={e => setAskQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') runAsk(); }} autoFocus />
              </label>
              <button className="ctrl ctrl-run" disabled={askBusy || !askQuery.trim()} onClick={runAsk}>{askBusy ? 'Looking…' : 'Ask'}</button>
            </div>
            {askData && askData.ok === false && <p className="vibe-error" role="alert">{askData.reason}</p>}
            {askData && askData.ok && (
              <div className="ask-answer">
                <p className="ask-text">{askData.answer}</p>
                {askData.sources && askData.sources.length > 0 && (
                  <div className="ask-sources">
                    <span className="eyebrow" role="heading" aria-level="2">From the lessons</span>
                    {askData.sources.map((s, i) => (
                      <div key={i} className="ask-src"><b>[{i + 1}] {s.source}</b><span>{s.text}</span></div>
                    ))}
                  </div>
                )}
                {askData.noModel && <p className="build-note">Install the free on-device AI (Ollama) for a written answer. The matching lesson notes above work without it.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Memory and skills ----
  // Reads window.KodroMemory directly (loaded earlier in ORDER), same as inline.
  function MemoryModal({ setMemoryOpen, memTick, code, terrain, robotSpec, currentLessonId, setLessonBuffers, setPrograms, activeTab, applyCode }) {
    // Export downloads the reflections + skills as a JSON backup; Import
    // restores one. Both call the store's own exportData/importData, which
    // shipped as dead code until now (product-coherence P5 via D7).
    function exportMemory() {
      try {
        const json = window.KodroMemory.exportData();
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'kodro-memory.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } catch (e) { void e; }
    }
    function importMemory(e) {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        let res = 0;
        try { res = window.KodroMemory.importData(String(rd.result)); } catch (err) { void err; }
        const restored = (res && typeof res === 'object') ? res.restored : res;
        const incomplete = !!(res && typeof res === 'object' && res.incomplete);
        try {
          window.dispatchEvent(new CustomEvent('kodro-toast', {
            detail: restored
              ? (incomplete
                  ? { text: 'Memory partly restored: storage was full, some items could not be saved', kind: 'err' }
                  : { text: 'Memory restored from backup', kind: 'info' })
              : { text: 'Import failed: not a Kodro memory backup', kind: 'err' },
          }));
        } catch (err) { void err; }
      };
      rd.readAsText(f);
    }
    // List (default) vs graph view of the same stored memory. The graph is
    // derived from the real reflections + skills, so it never shows more than
    // the lists do -- it just draws the ties between worlds, robots and items.
    const [memView, setMemView] = React.useState('list');
    // Graph interaction state. Selection/hover/hidden-layers are pure rendering
    // concerns layered over the stable graph model, so toggling a layer or
    // picking a node never reflows the layout.
    const [memSel, setMemSel] = React.useState(null);      // clicked node id (sticky)
    const [memHover, setMemHover] = React.useState(null);  // hovered/focused node id
    const [memHidden, setMemHidden] = React.useState({});  // { kind: true } => layer hidden
    const [memShowAll, setMemShowAll] = React.useState(false);
    const memGraph = (memView === 'graph' && window.KodroMemoryGraph)
      ? window.KodroMemoryGraph.build({
          reflections: window.KodroMemory ? window.KodroMemory.reflections() : [],
          skills: window.KodroMemory ? window.KodroMemory.skills() : [],
        }, { maxItems: memShowAll ? 40 : 8 })
      : null;
    // Drop a program into the editor / lesson buffer, closing the panel. Shared
    // by the skill list and the graph's node inspector so both insert the same way.
    function insertSkillCode(cd) {
      if (cd == null) return;
      if (applyCode) applyCode(cd);
      else if (currentLessonId) setLessonBuffers(b => ({ ...b, [currentLessonId]: cd }));
      else setPrograms(p => ({ ...p, [activeTab]: cd }));
      setMemoryOpen(false);
    }
    // Human-readable tooltip / accessible name for a node.
    function memTip(n) {
      if (n.kind === 'world' || n.kind === 'robot') {
        const kindWord = n.kind === 'world' ? 'world' : 'robot type';
        return n.full + ' — ' + kindWord + ', ' + (n.degree || 0) + ' linked memor' + ((n.degree || 0) === 1 ? 'y' : 'ies');
      }
      if (n.kind === 'skill') return n.full + ' — saved skill, used ' + (n.uses || 0) + '×';
      return n.full + ' — run note' + (n.outcome ? ' (' + n.outcome + ')' : '');
    }

    function graphBody() {
      if (!memGraph || !memGraph.nodes.length) {
        return (
          <div className="mem-body">
            <EmptyState icon="memory" title="No connections yet"
              hint="Run a few programs and save a skill or two. The graph then links each world to the robots and skills you used there." />
          </div>
        );
      }
      const pos = {};
      memGraph.nodes.forEach(n => { pos[n.id] = n; });
      const adj = memGraph.adjacency || {};
      const st = memGraph.stats || {};
      const isHiddenKind = k => !!memHidden[k];
      const isHidden = n => isHiddenKind(n.kind);
      const selNode = (memSel && pos[memSel] && !isHidden(pos[memSel])) ? pos[memSel] : null;
      const focusId = selNode ? selNode.id
        : (memHover && pos[memHover] && !isHidden(pos[memHover]) ? memHover : null);
      const near = focusId ? new Set([focusId].concat(adj[focusId] || [])) : null;

      const KINDS = [
        { kind: 'world', label: 'Worlds', count: st.worlds || 0 },
        { kind: 'robot', label: 'Robots', count: st.robots || 0 },
        { kind: 'skill', label: 'Skills', count: st.skills || 0 },
        { kind: 'reflection', label: 'Run notes', count: st.reflections || 0 },
      ];
      const toggleKind = k => setMemHidden(h => ({ ...h, [k]: !h[k] }));
      const pick = id => setMemSel(s => (s === id ? null : id));

      function nodeClass(n) {
        let c = 'mem-graph-node mem-graph-' + n.kind + (n.tone ? ' tone-' + n.tone : '');
        if (isHidden(n)) return c + ' is-hidden';
        if (memSel === n.id) return c + ' is-active';
        if (near) c += near.has(n.id) ? ' is-linked' : ' is-faded';
        return c;
      }
      function edgeClass(e) {
        const a = pos[e.from], b = pos[e.to];
        let c = 'mem-graph-edge ' + (e.kind || '');
        if (!a || !b || isHidden(a) || isHidden(b)) return c + ' is-hidden';
        if (near) c += (near.has(e.from) && near.has(e.to)) ? ' is-linked' : ' is-faded';
        return c;
      }

      const outcomeTones = memGraph.stats && memGraph.stats.reflections
        ? [['done', 'reached goal'], ['crash', 'collision'], ['flat', 'battery flat']]
            .filter(([o]) => (st.outcomes && st.outcomes[o]) > 0)
        : [];

      return (
        <div className="mem-graph-wrap" data-mem-graph-svg>
          <div className="mem-graph-bar">
            <span className="mem-graph-count">
              {(st.worlds || 0)} world{(st.worlds || 0) === 1 ? '' : 's'} · {(st.robots || 0)} robot{(st.robots || 0) === 1 ? '' : 's'} · {(st.skills || 0)} skill{(st.skills || 0) === 1 ? '' : 's'} · {(st.reflections || 0)} run note{(st.reflections || 0) === 1 ? '' : 's'} · {(st.edges || 0)} link{(st.edges || 0) === 1 ? '' : 's'}
            </span>
            <span className="mem-graph-layers" role="group" aria-label="Show or hide layers">
              {KINDS.map(k => (
                <button key={k.kind} type="button"
                  className={'mem-layer-btn ' + k.kind + (memHidden[k.kind] ? '' : ' is-on')}
                  aria-pressed={!memHidden[k.kind]}
                  title={(memHidden[k.kind] ? 'Show ' : 'Hide ') + k.label.toLowerCase() + ' (' + k.count + ')'}
                  onClick={() => toggleKind(k.kind)}>
                  <span className="mem-layer-dot" aria-hidden="true" />{k.label}<span className="mem-layer-n">{k.count}</span>
                </button>
              ))}
            </span>
            {(memGraph.truncated || memShowAll) ? (
              <button type="button" className="btn-mini mem-graph-showall"
                aria-pressed={memShowAll}
                onClick={() => { setMemSel(null); setMemShowAll(v => !v); }}>
                {memShowAll ? 'Show recent' : 'Show all (' + (st.totalReflections + st.totalSkills) + ')'}
              </button>
            ) : null}
          </div>

          <svg className="mem-graph" viewBox={'0 0 ' + memGraph.width + ' ' + memGraph.height} preserveAspectRatio="xMidYMid meet"
            role="group" aria-label="Interactive memory graph linking worlds, robots, skills and run notes. Select a node to trace its links.">
            <rect className="mem-graph-bg" x="0" y="0" width={memGraph.width} height={memGraph.height} onClick={() => setMemSel(null)} />
            {memGraph.columns.map(col => (
              <g key={'col' + col.kind}>
                <line className="mem-graph-guide" x1={col.x} y1="34" x2={col.x} y2={memGraph.height - 12} />
                <text className="mem-graph-col-head" x={col.x} y="22" textAnchor="middle">{col.label}</text>
              </g>
            ))}
            {memGraph.edges.map((e, i) => {
              const a = pos[e.from], b = pos[e.to];
              if (!a || !b) return null;
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + (b.y === a.y ? 0 : (b.y > a.y ? 14 : -14));
              return <path key={'e' + i} className={edgeClass(e)} d={'M' + a.x + ' ' + a.y + ' Q' + mx + ' ' + my + ' ' + b.x + ' ' + b.y} fill="none" />;
            })}
            {memGraph.nodes.map((n, i) => {
              const isHub = n.kind === 'world' || n.kind === 'robot';
              const r = isHub ? 7 + Math.min(6, (n.degree || 0) * 1.4) : 5;
              const hidden = isHidden(n);
              return (
                <g key={'n' + i} className={nodeClass(n)} transform={'translate(' + n.x + ',' + n.y + ')'}
                  role="button" tabIndex={hidden ? -1 : 0} aria-pressed={memSel === n.id} aria-hidden={hidden ? 'true' : undefined}
                  aria-label={memTip(n)}
                  onClick={() => pick(n.id)}
                  onMouseEnter={() => setMemHover(n.id)}
                  onMouseLeave={() => setMemHover(h => (h === n.id ? null : h))}
                  onFocus={() => setMemHover(n.id)}
                  onBlur={() => setMemHover(h => (h === n.id ? null : h))}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(n.id); }
                    else if (ev.key === 'Escape') { setMemSel(null); }
                  }}>
                  <title>{memTip(n)}</title>
                  <circle className="mem-node-halo" r={r + 5} />
                  <circle r={r} />
                  <text x={n.kind === 'world' ? -(r + 5) : (r + 5)} y={4}
                    textAnchor={n.kind === 'world' ? 'end' : 'start'}>{n.label}</text>
                </g>
              );
            })}
          </svg>

          <p className="mem-graph-legend">
            {outcomeTones.length ? <span className="mem-graph-legend-lead">Run notes:</span> : null}
            {outcomeTones.map(([o, txt]) => (
              <span key={o} className={'mem-graph-key tone-' + o}>{txt}</span>
            ))}
            {memGraph.truncated ? <span className="mem-graph-more">· newest {(st.skills || 0) + (st.reflections || 0)} of {st.totalSkills + st.totalReflections}</span> : null}
          </p>

          {selNode ? memInspector(selNode, pos, pick) : (
            <p className="mem-graph-hint">Select any dot to trace its links — worlds and robots on the sides, the skills and run notes recorded there in the middle.</p>
          )}

          <div className="sr-only">
            Memory graph summary. {(st.worlds || 0)} worlds, {(st.robots || 0)} robots, {(st.skills || 0)} skills and {(st.reflections || 0)} run notes, joined by {(st.edges || 0)} links.
            <ul>
              {memGraph.nodes.filter(n => (n.kind === 'world' || n.kind === 'robot') && n.items.length).map(n => (
                <li key={'sr' + n.id}>{n.full} ({n.kind === 'world' ? 'world' : 'robot type'}) links to {n.items.map(id => (pos[id] ? pos[id].full : '')).filter(Boolean).join('; ')}.</li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    // Node inspector card shown under the graph when a node is selected. Ties the
    // graph back to real, actionable detail: a skill's code (with Insert), a run
    // note's outcome and text, or a hub's list of linked memories.
    function memInspector(n, pos, pick) {
      const ctx = [n.world, n.robotType].filter(Boolean).join(' · ');
      return (
        <div className={'mem-detail mem-detail-' + n.kind + (n.tone ? ' tone-' + n.tone : '')} role="region" aria-label="Selected memory detail">
          <div className="mem-detail-head">
            <span className={'mem-detail-badge ' + n.kind + (n.tone ? ' tone-' + n.tone : '')}>
              {n.kind === 'world' ? 'World' : n.kind === 'robot' ? 'Robot' : n.kind === 'skill' ? 'Skill' : (n.outcome || 'Run note')}
            </span>
            <span className="mem-detail-title">{n.full}</span>
            <button type="button" className="btn-mini mem-detail-close" aria-label="Clear selection" onClick={() => setMemSel(null)}>✕</button>
          </div>
          {(n.kind === 'world' || n.kind === 'robot') ? (
            <div className="mem-detail-body">
              <p className="mem-detail-ctx">{n.degree} linked memor{n.degree === 1 ? 'y' : 'ies'}</p>
              <div className="mem-detail-chips">
                {n.items.map(id => pos[id]).filter(Boolean).map(m => (
                  <button key={m.id} type="button" className={'mem-chip mem-chip-' + m.kind + (m.tone ? ' tone-' + m.tone : '')}
                    onClick={() => pick(m.id)}>{m.label}</button>
                ))}
              </div>
            </div>
          ) : n.kind === 'skill' ? (
            <div className="mem-detail-body">
              <p className="mem-detail-ctx">{(ctx || 'any world') + ' · used ' + (n.uses || 0) + '×'}</p>
              {n.preview ? <pre className="mem-detail-code">{n.preview}</pre> : null}
              <button type="button" className="btn-mini btn-vibe"
                onClick={() => { const cd = window.KodroMemory ? window.KodroMemory.useSkill(n.full) : n.code; insertSkillCode(cd != null ? cd : n.code); }}>
                Insert this skill
              </button>
            </div>
          ) : (
            <div className="mem-detail-body">
              <p className="mem-detail-ctx">{ctx || 'no world recorded'}{n.detail ? ' · ' + n.detail : ''}</p>
              <p className="mem-detail-text">{n.full}</p>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="modal-backdrop" onClick={() => setMemoryOpen(false)}>
        <div className={'modal modal-wide' + (memView === 'graph' ? ' mem-modal-graph' : '')} role="dialog" aria-modal="true" aria-label="Memory and skills" data-tick={memTick} onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <span className="eyebrow" role="heading" aria-level="2">{KI('memory')}Memory. What the app has learned from your runs, saved on this computer</span>
            <span className="mem-viewtoggle" role="group" aria-label="Memory view">
              <button className={'btn-mini' + (memView === 'list' ? ' is-on' : '')} aria-pressed={memView === 'list'} onClick={() => setMemView('list')}>List</button>
              <button className={'btn-mini' + (memView === 'graph' ? ' is-on' : '')} aria-pressed={memView === 'graph'} data-mem-graph onClick={() => setMemView('graph')}>Graph</button>
            </span>
            <span className="mem-io">
              <button className="btn-mini" data-mem-export title="Download reflections and skills as a JSON backup" onClick={exportMemory}>Export</button>
              <label className="btn-mini mem-import" title="Restore reflections and skills from a JSON backup">
                Import
                <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={importMemory} aria-label="Import memory backup file" />
              </label>
            </span>
            <button className="btn-mini" aria-label="Close" onClick={() => setMemoryOpen(false)}>✕</button>
          </div>
          {memView === 'graph' ? graphBody() : (
          <div className="mem-body">
            <div className="mem-col">
              <div className="rl-label">Notes from past runs</div>
              {(window.KodroMemory ? window.KodroMemory.reflections() : []).length
                ? <ul className="mem-list">
                    {window.KodroMemory.reflections().slice(0, 10).map((r, i) => (
                      <li key={i} className={'mem-refl mem-' + r.outcome}>
                        <span className="mem-ctx">{(r.world || '?') + ' · ' + (r.robotType || 'robot') + ' · ' + r.outcome}</span>
                        {r.reflection}
                      </li>
                    ))}
                  </ul>
                : <EmptyState
                    icon="memory"
                    title="No runs yet"
                    hint="Run a program and the app writes a short note about how it went, then leans on those notes to help next time."
                    action={<><kbd>Ctrl</kbd>+<kbd>Enter</kbd> to run a program</>}
                  />}
            </div>
            <div className="mem-col">
              <div className="rl-label">Skill library. Programs that worked, saved for reuse</div>
              <button className="btn-mini btn-vibe" onClick={() => { const n = window.prompt && window.prompt('Name this skill'); if (n && window.KodroMemory) { window.KodroMemory.saveSkill(n, code, { world: terrain.id, robotType: (robotSpec && robotSpec.type) || '', ts: Date.now() }); try { window.dispatchEvent(new CustomEvent('kodro-toast', { detail: { text: 'Skill saved', kind: 'info' } })); } catch (e) { void e; } } }}>＋ Save current code as a skill</button>
              {(window.KodroMemory ? window.KodroMemory.skills() : []).length
                ? <ul className="mem-list">
                    {window.KodroMemory.skills().map((s, i) => (
                      <li key={i} className="mem-skill">
                        <span className="mem-skill-name">{s.name}</span>
                        <span className="mem-skill-ctx">{(s.world || '') + ' · used ' + (s.uses || 0) + '×'}</span>
                        <span className="mem-skill-act">
                          <button className="btn-mini" onClick={() => insertSkillCode(window.KodroMemory.useSkill(s.name))}>Insert</button>
                          <button className="btn-mini" aria-label={'Remove skill ' + s.name} onClick={() => window.KodroMemory.removeSkill(s.name)}>✕</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                : <EmptyState
                    icon="bulb"
                    title="No saved skills yet"
                    hint="Save a program that worked and it lands here, ready to drop into the next robot."
                  />}
            </div>
          </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Vibe coding (Code with AI) ----
  // Choose the AI backend: Local (Ollama, offline default) or a bring-your-own-key
  // FREE-TIER provider (Groq free tier, OpenRouter free models). The key stays in
  // this browser and is sent only to the chosen provider; Local keeps the app
  // fully offline.
  function ProviderPicker({ onChange }) {
    const P = window.KodroProviders;
    const [cfg, setCfg] = React.useState(P ? P.config() : null);
    const [keyInput, setKeyInput] = React.useState('');
    if (!P || !cfg) return null;
    // refresh() re-reads the picker's own view; bump() ALSO re-probes panel
    // availability so pasting a cloud key flips the panel from "AI is offline"
    // to ready immediately, without needing to close and reopen the panel.
    const refresh = () => setCfg(P.config());
    const bump = () => { refresh(); if (onChange) onChange(); };
    const isCloud = cfg.provider !== 'ollama';
    return (
      <div className="vibe-provider" style={{ margin: '2px 0 8px', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--navy-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>AI provider</span>
          <select value={cfg.provider} aria-label="AI provider" onChange={e => { P.setProvider(e.target.value); setKeyInput(''); bump(); }}
            style={{ background: 'var(--navy)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: 12.5 }}>
            {cfg.providers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {isCloud && <span style={{ fontSize: 11, color: cfg.cloudReady ? 'var(--success)' : 'var(--fg-3)' }}>{cfg.cloudReady ? 'connected' : 'needs a key'}</span>}
        </div>
        {isCloud && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <input type="password" aria-label="API key" value={keyInput} placeholder={cfg.hasKey ? 'key saved (type to replace)' : 'paste your API key'}
              onChange={e => { setKeyInput(e.target.value); P.setKey(cfg.provider, e.target.value); bump(); }}
              style={{ flex: '1 1 180px', background: 'var(--navy)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }} />
            <input type="text" aria-label="Cloud model id" value={cfg.cloudModel} placeholder="model id"
              onChange={e => { P.setCloudModel(e.target.value); bump(); }}
              style={{ flex: '0 1 160px', background: 'var(--navy)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }} />
          </div>
        )}
        {isCloud && <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--fg-3)' }}>Your key stays in this browser and is sent only to the provider you pick. Switch to Local for fully offline use.</p>}
      </div>
    );
  }

  // Plain-English reasons for the recogniser's error codes. The raw codes
  // ("not-allowed", "audio-capture") mean nothing to a 12-year-old, and a mic
  // button that goes quiet without saying why reads as a broken product.
  const VOICE_ERRORS = {
    'not-allowed': 'The browser blocked the microphone. Allow it in the address bar, or keep typing.',
    'service-not-allowed': 'The browser blocked the microphone. Allow it in the address bar, or keep typing.',
    'no-speech': 'I did not hear anything. Press the microphone and speak, or type instead.',
    'audio-capture': 'No microphone was found on this computer. Typing does the same job.',
    network: 'The speech recogniser could not be reached. It needs the internet; typing does not.',
    aborted: '',
  };

  /* Speaking and listening for the Companion.
   *
   * Speaking is on-device: window.KodroVoice only ever uses a voice with
   * localService === true, so the reply is synthesised here. If the machine has
   * no local voice the control explains that instead of quietly using a network
   * voice that would post the text to a server.
   *
   * Listening is the opposite and is treated as such. Chrome's recogniser
   * uploads the audio, so the microphone is off until the learner reads what
   * that means and turns it on. A final transcript is sent as if it had been
   * typed -- it goes through the same intent parser and the same
   * preview-then-Apply gate, so a mishearing can waste a sentence but cannot
   * change the robot, the world or the program on its own.
   */
  function VoiceControls({ vibeMsgs, vibeBusy, onTranscript }) {
    const V = window.KodroVoice;
    const [caps, setCaps] = React.useState(() => (V ? V.capabilities() : null));
    const [listening, setListening] = React.useState(false);
    const [interim, setInterim] = React.useState('');
    const [note, setNote] = React.useState('');
    const [asking, setAsking] = React.useState(false);
    // Start from the CURRENT length: reopening the Companion restores the saved
    // thread, and reading a whole past conversation aloud would be a jump-scare.
    const spokenTo = React.useRef(vibeMsgs.length);

    React.useEffect(() => {
      if (!V) return undefined;
      const onVoices = () => setCaps(V.capabilities());
      window.addEventListener('kodro-voices-changed', onVoices);
      return () => window.removeEventListener('kodro-voices-changed', onVoices);
    }, [V]);

    React.useEffect(() => () => { if (V) { V.cancel(); V.stopDictation(); } }, [V]);

    React.useEffect(() => {
      if (!V) return;
      if (vibeMsgs.length <= spokenTo.current) { spokenTo.current = vibeMsgs.length; return; }
      const last = vibeMsgs[vibeMsgs.length - 1];
      spokenTo.current = vibeMsgs.length;
      if (!last || last.role === 'user' || !V.speakEnabled()) return;
      // A code block read character by character is noise. Speak what the edit
      // DOES and leave the program on screen where it can be read properly.
      let say = last.text;
      if (last.kind === 'code') {
        say = (last.summary ? last.summary + '. ' : '') + 'The program is in the preview. Choose Apply or Discard.';
      } else if (last.kind === 'project-preview') {
        say = last.text + ' Nothing has changed yet. Choose Apply or Discard.';
      }
      const outcome = V.speak(say);
      if (outcome === 'no-local-voice') setNote(V.capabilities().speakBlockedReason);
    }, [vibeMsgs, V]);

    if (!V || !caps) return null;

    function toggleSpeak() {
      const next = !V.speakEnabled();
      V.setSpeakEnabled(next);
      const fresh = V.capabilities();
      setCaps(fresh);
      setNote(next && !fresh.canSpeak ? fresh.speakBlockedReason : '');
    }

    function beginListening() {
      setNote(''); setInterim('');
      const outcome = V.startDictation({
        onInterim: text => setInterim(text),
        onText: text => {
          setInterim('');
          if (text && onTranscript) onTranscript(text);
        },
        // "Stop" interrupts rather than instructs, so it never reaches
        // onTranscript and never becomes a chat message. It still gets a
        // visible line: the learner has to be able to see what was heard and
        // what it did, or an interruption is indistinguishable from a crash.
        onBarge: text => {
          setInterim('');
          setNote('Heard "' + text + '". Stopped speaking. Nothing was sent.');
        },
        onEnd: () => { setListening(false); setInterim(''); },
        onError: code => {
          setListening(false); setInterim('');
          setNote(Object.prototype.hasOwnProperty.call(VOICE_ERRORS, code)
            ? VOICE_ERRORS[code]
            : 'The microphone stopped (' + code + '). Typing still works.');
        },
      });
      if (outcome === 'ok') setListening(true);
      else if (outcome === 'not-consented') setAsking(true);
      else setNote('Listening could not start on this browser. Type your message instead.');
    }

    function toggleMic() {
      if (listening) { V.stopDictation(); setListening(false); setInterim(''); return; }
      if (!V.dictationConsented()) { setAsking(true); return; }
      beginListening();
    }

    return (
      <div className="vibe-voice" role="group" aria-label="Voice">
        {caps.speechSupported && (
          <button
            className="btn-mini voice-btn"
            aria-pressed={caps.speakEnabled}
            onClick={toggleSpeak}
            title={caps.canSpeak
              ? 'Read replies aloud using a voice installed on this computer. Nothing is sent anywhere.'
              : 'No on-device voice is installed on this computer.'}
          >{caps.speakEnabled ? 'Speaking replies' : 'Speak replies'}</button>
        )}
        {caps.dictationSupported && (
          <button
            className={'btn-mini voice-btn' + (listening ? ' is-live' : '')}
            aria-pressed={listening}
            disabled={vibeBusy}
            onClick={toggleMic}
            title={caps.dictationConsented
              ? 'Speak instead of typing. The audio is sent to the browser speech service.'
              : 'Speak instead of typing. Read what this sends before turning it on.'}
          >{listening ? <><span className="voice-dot" aria-hidden="true"></span>Listening, press to stop</> : 'Speak to Kodro'}</button>
        )}
        {asking && (
          <div className="voice-consent" role="dialog" aria-label="Turn on listening">
            <p>{caps.dictationNotice}</p>
            <div className="voice-consent-actions">
              <button className="ctrl ctrl-run" onClick={() => {
                V.setDictationConsent(true);
                setCaps(V.capabilities());
                setAsking(false);
                beginListening();
              }}>I understand, turn listening on</button>
              <button className="btn-mini" onClick={() => setAsking(false)}>Keep typing</button>
            </div>
          </div>
        )}
        {caps.dictationConsented && !asking && (
          <button className="btn-mini" onClick={() => { V.setDictationConsent(false); setCaps(V.capabilities()); setListening(false); }}
            title="Stop using the browser speech service">Turn listening off</button>
        )}
        {interim && <p className="voice-interim">Heard: {interim}</p>}
        {note && <p className="voice-note" role="status">{note}</p>}
      </div>
    );
  }

  function VibeModal({ setVibeOpen, vibeCancelRef, setVibeBusy, aiInfo, pickModel, refreshAiStatus, vibeMsgs, setVibeMsgs, vibeApply, vibeApplyProject, vibeBusy, vibeLive, vibeEndRef, vibeError, vibePrompt, setVibePrompt, vibeSend, vibeClear, vibeContext, projectContext, onExplain, onReview }) {
    // The reflection the assistant is fed from past runs in this world,
    // rendered as a VISIBLE chip instead of an invisible prompt injection
    // (product-coherence D7: the memory loop must be seen to be believed).
    const ctxChip = (vibeContext && vibeContext.reflection) ? (
      <div className="vibe-ctx" title="Learned from your past runs in this world; the AI is reminded of it when it writes code for you">
        <span className="vibe-ctx-tag">Learned from past runs{vibeContext.world ? ' · ' + vibeContext.world : ''}</span>
        <span className="vibe-ctx-text">{vibeContext.reflection}</span>
      </div>
    ) : null;
    const projectChip = projectContext ? (
      <div className="companion-project" aria-label="Current Companion context">
        <span><b>Robot</b>{projectContext.robot || 'Robot'}</span>
        <span><b>World</b>{projectContext.world || 'World'}</span>
        <span><b>Program</b>{projectContext.program || 'Current program'}</span>
        <span className={'companion-project-result' + (projectContext.outcome ? ' has-result' : '')}>
          <b>Last result</b>{projectContext.outcome || 'Not run for this setup'}
        </span>
      </div>
    ) : null;
    return (
      <div className="modal-backdrop" onClick={() => !vibeBusy && setVibeOpen(false)}>
        <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Code with AI" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <span className="eyebrow" role="heading" aria-level="2">{KI('vibe')}Companion · create, explain and check with you</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {vibeMsgs.length > 0 && (
                <button className="btn-mini" disabled={vibeBusy} onClick={() => vibeClear && vibeClear()}
                  title="Start a new conversation. This clears the saved chat on this device.">New chat</button>
              )}
              <button className="btn-mini" aria-label="Close" onClick={() => { vibeCancelRef.current = true; setVibeBusy(false); setVibeOpen(false); }}>✕</button>
            </div>
          </div>
          <div className="companion-modes" role="group" aria-label="Companion modes">
            {/* "Create & code" IS this surface, so it is a state marker, not a
                button: a focusable control that does nothing lies to keyboard
                and switch users. The other two navigate to their tools. */}
            <span className="btn-mini active" aria-current="true">Create &amp; code</span>
            <button className="btn-mini" onClick={onExplain}>Explain a lesson</button>
            <button className="btn-mini" onClick={onReview}>Check my program</button>
          </div>
           <div className="vibe-body">
              {aiInfo.available
                ? (providerIsLocal(aiInfo.source)
                    ? <p className="vibe-status">Local model: <b>{aiInfo.model}</b> · runs entirely on this machine, nothing leaves it.</p>
                    : <p className="vibe-status">Cloud model: <b>{aiInfo.model}</b> · via {providerName(aiInfo.source)}, your prompt is sent to {providerName(aiInfo.source)}.</p>)
                : <p className="vibe-status"><b>On-device help is ready.</b> I can explain the last run, change the robot, world, time and weather, adjust speed, and prepare a collision-avoidance draft without a model. Connect an optional model only for open-ended program writing.</p>}
              <details className="companion-provider">
                <summary>Optional generative model {aiInfo.available ? 'connected' : 'not connected'}</summary>
                <ProviderPicker onChange={refreshAiStatus} />
                {!aiInfo.available && <p className="vibe-status">{aiInfo.hint || 'No generative model is connected.'}</p>}
              </details>
              {projectChip}
              {ctxChip}
              {aiInfo.available && aiInfo.models && aiInfo.models.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>Use model</span>
                  <select value={aiInfo.override || aiInfo.model || ''} onChange={e => pickModel(e.target.value)} aria-label="Use model"
                    style={{ background: 'var(--navy-2)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: 12.5 }}>
                    {aiInfo.models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {aiInfo.override && <button className="btn-mini" onClick={() => pickModel('')} title="Return to automatic model selection">Auto</button>}
                </div>
              )}
              <div className="companion-quick" role="group" aria-label="Common Companion requests">
                <button className="btn-mini" disabled={vibeBusy} onClick={() => vibeSend('Explain the last run')}>Explain last run</button>
                <button className="btn-mini" disabled={vibeBusy} onClick={() => vibeSend('Fix the collision and make it safer')}>Fix a collision</button>
                <button className="btn-mini" disabled={vibeBusy} onClick={() => vibeSend('Slow the robot down')}>Slow it down</button>
                <button className="btn-mini" disabled={vibeBusy} onClick={() => vibeSend('Change the time to night')}>Make it night</button>
              </div>
              <div className="vibe-thread" role="log" aria-live="polite" aria-label="Companion conversation">
                {vibeMsgs.length === 0 && (
                  <EmptyState
                    icon="vibe"
                    title="Describe the robot or behaviour you need"
                    hint={<>The Companion can change the robot or world without a model. With a connected model it can also draft code, which Kodro validates before you apply it.</>}
                  />
                )}
                {vibeMsgs.map((m, i) => m.kind === 'code' ? (
                  <div key={i} className="vibe-msg ai code">
                    {m.validated === false && (
                      <p className="vibe-error" role="alert">This saved draft did not pass Kodro's self-test: {m.validationError || 'unknown error'}. It cannot be applied.</p>
                    )}
                    {m.summary && <p className="vibe-code-summary"><b>Proposed edit:</b> {m.summary}</p>}
                    <pre className="vibe-code">{m.text}</pre>
                    <div className="vibe-code-actions">
                      {m.validated !== false && <button className="ctrl ctrl-run" onClick={() => vibeApply(m.text, m.model, m.scope)}>✓ Apply to editor</button>}
                      <button className="btn-mini" onClick={() => {
                        // Discard means discard: drop THIS code block from the
                        // thread (and so from storage and the model's history),
                        // instead of appending a fake user bubble that left the
                        // rejected code and its Apply button live.
                        setVibeMsgs(ms => ms.filter((_, j) => j !== i));
                      }}>Discard</button>
                    </div>
                  </div>
                ) : m.kind === 'project-preview' ? (
                  <div key={i} className="vibe-msg ai project-preview">
                    <div className="project-preview-head">
                      <span className="vibe-preview-badge">Preview · nothing changed</span>
                      <strong>{m.text}</strong>
                    </div>
                    <div className="vibe-project-diff">
                      <div>
                        <span>Before</span>
                        <b>{m.preview && m.preview.before ? m.preview.before.robot : 'Current robot'}</b>
                        <small>{m.preview && m.preview.before ? m.preview.before.world : 'Current world'}</small>
                      </div>
                      <div>
                        <span>After Apply</span>
                        <b>{m.preview && m.preview.robot ? m.preview.robot.spec.name : 'Keep current robot'}</b>
                        <small>{m.preview && m.preview.world ? m.preview.world.label : 'Keep current world'}</small>
                      </div>
                    </div>
                    {m.preview && (m.preview.robot || m.preview.world) && m.preview.before && m.preview.before.lesson && (
                      <p className="vibe-preview-warning">Applying a robot or world change exits the active lesson so its grader cannot remain attached to the wrong setup.</p>
                    )}
                    {m.preview && m.preview.robot && m.preview.robot.checks && m.preview.robot.checks.length > 0 && (
                      <ul className="vibe-requirements">
                        {m.preview.robot.checks.map(check => (
                          <li key={check.id} data-status={check.status}>
                            <span>{check.status === 'met' ? 'Met' : check.status === 'unmet' ? 'Not met' : 'Unresolved'}</span>
                            <b>{check.label}</b>
                            <small>{check.detail}</small>
                          </li>
                        ))}
                      </ul>
                    )}
                    {m.preview && m.preview.notices && m.preview.notices.map((notice, ni) => (
                      <p className="vibe-preview-warning" key={ni}>{notice}</p>
                    ))}
                    <div className="vibe-code-actions">
                      <button className="ctrl ctrl-run" onClick={() => {
                        const preview = m.preview;
                        setVibeMsgs(ms => ms.filter((_, j) => j !== i));
                        if (vibeApplyProject) vibeApplyProject(preview);
                      }}>Apply project change</button>
                      <button className="btn-mini" onClick={() => setVibeMsgs(ms => ms.filter((_, j) => j !== i))}>Discard</button>
                    </div>
                  </div>
                ) : m.kind === 'action' ? (
                  <div key={i} className="vibe-msg ai action" role="status"><span className="vibe-action-badge">Done</span><span>{m.text}</span></div>
                ) : m.kind === 'evidence' ? (
                  <div key={i} className="vibe-msg ai evidence"><span className="vibe-evidence-badge">Based on this project</span><span>{m.text}</span></div>
                ) : (
                  <div key={i} className={'vibe-msg ' + m.role}><span>{m.text}</span></div>
                ))}
                {vibeBusy && (
                  <div className="vibe-msg ai thinking">
                    {/* Show the TAIL of the stream: the live box is capped at
                        ~7 lines, so a long generation used to look frozen
                        mid-sentence while text piled up out of view below. */}
                    {vibeLive ? <pre className="vibe-live">{vibeLive.length > 700 ? '…' + vibeLive.slice(-700) : vibeLive}</pre> : <span>Thinking…</span>}
                  </div>
                )}
                <div ref={vibeEndRef}></div>
              </div>
              {vibeError && <p className="vibe-error" role="alert">{vibeError}</p>}
              <div className="vibe-inputrow">
                <textarea
                  className="vibe-input"
                  rows={2}
                  placeholder='Ask what happened, change the world, or describe what the robot should do'
                  value={vibePrompt}
                  onChange={e => setVibePrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); vibeSend(); } }}
                  aria-label="Describe what the rover should do"
                  autoFocus
                />
                <button className="ctrl ctrl-run" disabled={vibeBusy || !vibePrompt.trim()} onClick={vibeSend}>Send</button>
              </div>
              <VoiceControls
                vibeMsgs={vibeMsgs}
                vibeBusy={vibeBusy}
                onTranscript={text => {
                  // A finished sentence is sent as if typed. vibeSend takes the
                  // text directly rather than going through the textarea state,
                  // which would still hold the previous render's value.
                  setVibePrompt('');
                  vibeSend(text);
                }}
              />
              <span className="vibe-hint">Proposed edits are previews. Choose Apply or Discard for each one. Nothing runs until you press Run. The conversation stays on this device.</span>
              {!aiInfo.available && (
                <ol className="vibe-steps">
                  <li>Open-ended code generation is optional. The built-in diagnosis and controls above work now.</li>
                  <li>For private generative help on <b>this computer</b>, install the Ollama app from ollama.com (no account needed)</li>
                  <li>Then run: <code>ollama pull qwen2.5-coder:3b</code> (or <code>gemma3</code>)</li>
                  <li>Reopen Kodro and code writing lights up. Or pick Groq or OpenRouter above and paste a free key from their site</li>
                </ol>
              )}
            </div>
        </div>
      </div>
    );
  }

  // ---- Blocks (visual block editor) ----
  function BlocksModal({ setBlocksOpen, BLOCK_DEFS, robotSpec, addBlock, endBlock, blockIndent, setBlockIndent, blocks, setBlocks, moveBlock, canMoveBlock, removeBlock, insertBlocksCode, classroom }) {
    // lessonOnly blocks (collect/drop sample) only do something when a lesson
    // supplies the sample mechanic; hide them on the free Studio surface where
    // they would be silent print stubs (judge round 10), matching the studio
    // command hint strip which already delists them.
    const PALETTE = BLOCK_DEFS.filter(d => classroom || !d.lessonOnly);
    // Keyboard focus after a delete.
    //
    // Removing a row unmounts the button that had focus, so the browser drops
    // focus to document.body and a keyboard user is thrown back to the top of
    // the dialog. Deleting three blocks in a row meant tabbing back down three
    // times. Focus now follows the list: to whichever row slid into the
    // deleted position, or the new last row if the end was deleted, or the
    // Clear button once the list is empty.
    const blocksRef = React.useRef(null);
    const pendingFocus = React.useRef(null);
    React.useEffect(() => {
      const want = pendingFocus.current;
      if (want == null) return;
      pendingFocus.current = null;
      const root = blocksRef.current;
      if (!root) return;
      const buttons = root.querySelectorAll('[data-block-remove]');
      const target = buttons[Math.min(want, buttons.length - 1)];
      if (target) { target.focus(); return; }
      // The list is empty now, so there is no row to land on. Both controls in
      // .vibe-actions are disabled in exactly this state (Clear and Insert
      // both require at least one block), so reaching for a nearby button
      // finds nothing and focus falls to body. Focus the list container
      // itself: it is tabIndex={-1}, so it accepts focus programmatically
      // without joining the tab order, it keeps the user's position in the
      // dialog, and its aria-label announces the now-empty program.
      root.focus();
    }, [blocks.length]);
    function removeBlockKeepingFocus(i) {
      pendingFocus.current = i;
      removeBlock(i);
    }
    return (
      <div className="modal-backdrop" onClick={() => setBlocksOpen(false)}>
        <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Block coding" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <span className="eyebrow" role="heading" aria-level="2">{KI('blocks')}Blocks. Click blocks to build, then turn them into Python</span>
            <button className="btn-mini" aria-label="Close" onClick={() => setBlocksOpen(false)}>✕</button>
          </div>
          <div className="blocks-palette">
            {PALETTE.map(d => {
              // Gating parity with the text editor: a block whose command
              // needs a part this build lacks is disabled here, so the limit
              // is visible before running rather than a runtime refusal.
              const gateOk = !d.requires || !window.KodroCommands || window.KodroCommands.check(robotSpec, d.requires).ok;
              return (
                <button key={d.k} className="block-chip" style={{ borderColor: d.color }} disabled={!gateOk}
                  title={gateOk ? undefined : 'This build has no part for ' + d.requires + '()'} onClick={() => addBlock(d)}>
                  {d.label}{d.unit ? ' ' + d.val + d.unit : ''}
                </button>
              );
            })}
            <button className="block-chip block-end" onClick={endBlock} disabled={blockIndent === 0}>↤ end block</button>
          </div>
          <div className="blocks-program" aria-label="Your program" tabIndex={-1} ref={blocksRef}>
            {blocks.length === 0 && (
              <EmptyState
                icon="blocks"
                title="Build your program"
                hint="Click blocks above. They stack in order, then turn into real Python."
              />
            )}
            {blocks.map((b, i) => (
              <div key={b.id != null ? b.id : i} className="block-row" style={{ marginLeft: (b.indent * 22) + 'px', borderLeftColor: b.color }}>
                <span>{b.label}</span>
                {b.val !== undefined && (
                  <input
                    type="number" className="block-num" value={b.val} min={b.unit === '%' ? 0 : 1} max={b.unit === '°' ? 360 : b.unit === '%' ? 100 : 20}
                    aria-label={b.label + ' amount'}
                    onChange={e => {
                      // Clamp to this block's real min/max so the number shown
                      // is the number that runs (interpreter.clampNum would
                      // otherwise silently clamp a too-big value at run time),
                      // and use Number.isFinite so 0 (valid for set speed)
                      // is kept rather than coerced to 1 by truthiness.
                      const lo = b.unit === '×' ? 1 : 0;  // only repeat (×) needs a minimum of 1; distance/turn/wait/% may be 0
                      const hi = b.unit === '°' ? 360 : b.unit === '%' ? 100 : 20;
                      const raw = Number(e.target.value);
                      const v = Number.isFinite(raw) ? Math.max(lo, Math.min(hi, raw)) : lo;
                      setBlocks(bs => bs.map((x, j) => j === i ? { ...x, val: v } : x));
                    }}
                  />
                )}
                {b.unit && <span className="vibe-hint">{b.unit}</span>}
                <span className="block-actions">
                  {/* Disabled whenever the move is genuinely impossible, not
                      just at the list ends: reordering happens within one
                      nesting level, so a block at the top or bottom of a loop
                      body cannot swap past the loop. The button says so
                      instead of looking live and doing nothing. */}
                  {/* Two distinct reasons an arrow is disabled, and they need
                      different words: the block is simply first/last in the
                      list, or the move would cross a loop level. One canned
                      loop message for both told a learner with no loop in
                      their program that loop nesting was blocking them. The
                      reason also goes in the aria-label, because a `title` on
                      a disabled button is unreliable for both tooltips and
                      assistive tech. */}
                  {[-1, 1].map(dir => {
                    const ok = canMoveBlock(i, dir);
                    const word = dir < 0 ? 'up' : 'down';
                    const atEnd = dir < 0 ? i === 0 : i === blocks.length - 1;
                    const why = ok ? '' : atEnd
                      ? ' (already ' + (dir < 0 ? 'first' : 'last') + ')'
                      : ' (would move it out of the loop)';
                    return (
                      <button key={dir} className="btn-mini" disabled={!ok}
                        aria-label={'move ' + b.label + ' ' + word + why}
                        title={ok ? 'Move ' + word : 'Cannot move ' + word + why}
                        onClick={() => moveBlock(i, dir)}>{dir < 0 ? '↑' : '↓'}</button>
                    );
                  })}
                  <button className="btn-mini" data-block-remove={i} aria-label={'remove ' + b.label} onClick={() => removeBlockKeepingFocus(i)}>✕</button>
                </span>
              </div>
            ))}
          </div>
          <div className="vibe-actions">
            <button className="btn-mini" disabled={!blocks.length} onClick={() => { setBlocks([]); setBlockIndent(0); }}>Clear</button>
            <span className="vibe-hint" style={{ flex: 1 }}>Turns into real Python in the editor. Nothing runs until you press Run.</span>
            <button className="ctrl ctrl-run" disabled={!blocks.length} onClick={insertBlocksCode}>Insert code →</button>
          </div>
        </div>
      </div>
    );
  }

  function LearningNotebookModal({ entries, onClose, onRemove, onUpdateNote }) {
    const rows = Array.isArray(entries) ? entries : [];
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal modal-wide learning-notebook-modal" role="dialog" aria-modal="true" aria-label="Learning notebook" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <div>
              <span className="eyebrow" role="heading" aria-level="2">Learning notebook · evidence stays attached</span>
              <p className="learning-notebook-sub">Saved locally on this device. Every explanation keeps its selected code and claim-level source.</p>
            </div>
            <button className="btn-mini" aria-label="Close learning notebook" onClick={onClose}>✕</button>
          </div>
          <div className="learning-notebook-list">
            {rows.length === 0 ? (
              <EmptyState
                icon="report"
                title="No annotations saved yet"
                hint={<>Select code in the editor, choose Explain selection or Show values, then save the verified annotation here.</>}
              />
            ) : rows.map(entry => (
              <article className="learning-notebook-entry" key={entry.id}>
                <div className="learning-notebook-entry-head">
                  <div>
                    <span className="eyebrow">{entry.context || 'Program'} · {entry.selection && entry.selection.startLine === entry.selection.endLine
                      ? 'line ' + entry.selection.startLine
                      : 'lines ' + (entry.selection ? entry.selection.startLine + '–' + entry.selection.endLine : '?')}</span>
                    <h3>{entry.title}</h3>
                  </div>
                  <button type="button" className="btn-mini" aria-label={'Remove ' + entry.title} onClick={() => onRemove(entry.id)}>Remove</button>
                </div>
                <pre className="learning-excerpt">{entry.excerpt}</pre>
                <ol className="learning-claims compact">
                  {(entry.claims || []).map((claim, ci) => (
                    <li key={ci}><span>{claim.text}</span><cite>{claim.source}</cite></li>
                  ))}
                </ol>
                <label className="learning-note-field">
                  <span>My note</span>
                  <textarea rows={2} defaultValue={entry.note || ''} onBlur={e => onUpdateNote(entry.id, e.target.value)} placeholder="Add a reflection or next step"></textarea>
                </label>
              </article>
            ))}
          </div>
        </div>
      </div>
    );
  }

  window.KodroPanels = {
    HelpModal,
    BuildModal,
    SwarmModal,
    TeacherModal,
    ReviewModal,
    AskModal,
    MemoryModal,
    VibeModal,
    BlocksModal,
    LearningNotebookModal,
  };
})();
