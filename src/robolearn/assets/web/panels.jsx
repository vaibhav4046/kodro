/* Presentational modal/popover components extracted from app.jsx.
 *
 * Each component here is a PURE function of its props: it renders one modal's
 * JSX exactly as it lived inline in App's giant return, and receives the state
 * and handlers it needs as props. No state, no effects, no window reads beyond
 * what the original inline block already did (e.g. window.KodroMemory in Memory,
 * window.RoverSchematic in Build) — those globals are loaded before this module
 * in the ORDER array, same as when the markup lived in app.jsx.
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

  // ---- Keyboard shortcuts (Help) ----
  // Pure static content; only needs a close handler.
  function HelpModal({ onClose }) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <span className="eyebrow">Keyboard shortcuts</span>
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
                <div><dt><kbd>Ctrl</kbd>+<kbd>D</kbd></dt><dd>Toggle 2D / 3D view</dd></div>
                <div><dt><kbd>Ctrl</kbd>+<kbd>F</kbd></dt><dd>Toggle first-person camera</dd></div>
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
            <span className="eyebrow">{KI('build')}Build a real robot. What your budget can buy</span>
            <button className="btn-mini" aria-label="Close" onClick={onClose}>✕</button>
          </div>
          <div className="build-body">
            <p className="vibe-status">Type a budget and the local AI plans a real robot you can build and program, mapping your simulated work onto real hardware. Nothing is ordered; this runs offline.</p>
            {robotSpec && (
              <p className="build-active" data-build-active="1">
                Pricing the active build: <b>{robotSpec.name || 'My Robot'}</b>
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
                    ${Math.round(buildPlan.total)} <span>of ${buildPlan.budget}</span>
                  </div>
                </div>
                <window.RoverSchematic parts={buildPlan.parts} />
                <div className="build-cols">
                  <div>
                    <div className="eyebrow">Parts</div>
                    <table className="build-table">
                      <tbody>
                        {buildPlan.parts.map((p, i) => (
                          <tr key={i}><td>{p.name}</td><td className="role">{p.role}</td><td className="cost">${p.cost}</td></tr>
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
            <span className="eyebrow">{KI('swarm')}Agent swarm. Your one program, run by a fleet at once</span>
            <button className="btn-mini" aria-label="Close" onClick={() => setSwarmOpen(false)}>✕</button>
          </div>
          <div className="swarm-body">
            {swarmBusy && <p className="vibe-status">Launching the swarm…</p>}
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
                  <p className="build-note">{swarmData.n} rovers ran the same program from different starting points. Identical code, no central controller, a coordinated pattern. All offline.</p>
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
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Teacher dashboard" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <span className="eyebrow">{KI('report')}Teacher dashboard. Class concept strength</span>
            <button className="btn-mini" aria-label="Close" onClick={onClose}>✕</button>
          </div>
          <div className="teacher-body">
            {!teacherData && <p className="vibe-status">Reading the class memory on this machine…</p>}
            {teacherData && teacherData.pupils.length === 0 && (
              <p className="vibe-status">No pupil data yet. Pass a lesson to start the heatmap.</p>
            )}
            {teacherData && teacherData.pupils.length > 0 && (
              <div style={{ overflow: 'auto', maxHeight: '60vh' }}>
                <table className="heatmap-table">
                  <thead>
                    <tr>
                      <th>Pupil</th>
                      {teacherData.concepts.map(c => <th key={c} className="hm-concept">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {teacherData.pupils.map(p => (
                      <tr key={p.id}>
                        <td className="hm-name">{p.name}{p.active ? ' ·' : ''}</td>
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
                            <td key={c} className="hm-cell" title={has ? c + ': ' + pct + '%' : 'not attempted'}
                              style={{ background: has ? 'hsl(' + hue + ' 55% 42%)' : 'transparent', color: has ? (cellLum > 0.183 ? '#000' : '#fff') : 'var(--fg-4)' }}>
                              {has ? pct : '·'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="build-note">Each cell is a rolling strength score from 0 to 100 for that concept. Higher and greener is stronger. All data is local to this machine.</p>
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
            <span className="eyebrow">{KI('review')}Code review. A second AI agent checks your work</span>
            <button className="btn-mini" aria-label="Close" onClick={() => setReviewOpen(false)}>✕</button>
          </div>
          <div className="review-body">
            {reviewBusy && <p className="vibe-status">A reviewer agent is reading your code on this machine…</p>}
            {reviewErr && <p className="vibe-error" role="alert">{reviewErr}</p>}
            {reviewData && !reviewBusy && (
              <div>
                <p className="vibe-status">Reviewer: <b>{reviewData.model}</b> · runs entirely offline.</p>
                {reviewData.issues && reviewData.issues.length > 0 ? (
                  <ul className="review-issues">
                    {reviewData.issues.map((it, i) => <li key={i}>{it}</li>)}
                  </ul>
                ) : (
                  <p className="review-clean">No problems spotted.</p>
                )}
                {reviewData.revised && reviewData.code && (
                  <div className="review-rewrite">
                    <span className="eyebrow">Suggested rewrite (checked to run safely)</span>
                    <pre className="vibe-code">{reviewData.code}</pre>
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
            <span className="eyebrow">{KI('ask')}Ask. {askData && askData.grounded === false ? 'Answered by the local model on this machine' : 'Grounded in the built-in material when it is available'}</span>
            <button className="btn-mini" aria-label="Close" onClick={() => setAskOpen(false)}>✕</button>
          </div>
          <div className="ask-body">
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
                    <span className="eyebrow">From the lessons</span>
                    {askData.sources.map((s, i) => (
                      <div key={i} className="ask-src"><b>[{i + 1}] {s.source}</b><span>{s.text}</span></div>
                    ))}
                  </div>
                )}
                {askData.noModel && <p className="build-note">Start a local model (Ollama) for a written answer; the lesson material above is shown offline.</p>}
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
    return (
      <div className="modal-backdrop" onClick={() => setMemoryOpen(false)}>
        <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Memory and skills" data-tick={memTick} onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <span className="eyebrow">{KI('memory')}Memory. The system refines from what it has seen, offline</span>
            <span className="mem-io">
              <button className="btn-mini" data-mem-export title="Download reflections and skills as a JSON backup" onClick={exportMemory}>Export</button>
              <label className="btn-mini mem-import" title="Restore reflections and skills from a JSON backup">
                Import
                <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={importMemory} aria-label="Import memory backup file" />
              </label>
            </span>
            <button className="btn-mini" aria-label="Close" onClick={() => setMemoryOpen(false)}>✕</button>
          </div>
          <div className="mem-body">
            <div className="mem-col">
              <div className="rl-label">Reflections from past runs</div>
              {(window.KodroMemory ? window.KodroMemory.reflections() : []).length
                ? <ul className="mem-list">
                    {window.KodroMemory.reflections().slice(0, 10).map((r, i) => (
                      <li key={i} className={'mem-refl mem-' + r.outcome}>
                        <span className="mem-ctx">{(r.world || '?') + ' · ' + (r.robotType || 'robot') + ' · ' + r.outcome}</span>
                        {r.reflection}
                      </li>
                    ))}
                  </ul>
                : <p className="vibe-status">No runs yet. Run a program and the system notes what happened, then draws on it.</p>}
            </div>
            <div className="mem-col">
              <div className="rl-label">Skill library. Programs that worked, reused</div>
              <button className="btn-mini btn-vibe" onClick={() => { const n = window.prompt && window.prompt('Name this skill'); if (n && window.KodroMemory) { window.KodroMemory.saveSkill(n, code, { world: terrain.id, robotType: (robotSpec && robotSpec.type) || '', ts: Date.now() }); try { window.dispatchEvent(new CustomEvent('kodro-toast', { detail: { text: 'Skill saved', kind: 'info' } })); } catch (e) { void e; } } }}>＋ Save current code as a skill</button>
              {(window.KodroMemory ? window.KodroMemory.skills() : []).length
                ? <ul className="mem-list">
                    {window.KodroMemory.skills().map((s, i) => (
                      <li key={i} className="mem-skill">
                        <span className="mem-skill-name">{s.name}</span>
                        <span className="mem-skill-ctx">{(s.world || '') + ' · used ' + (s.uses || 0) + '×'}</span>
                        <span className="mem-skill-act">
                          <button className="btn-mini" onClick={() => { const cd = window.KodroMemory.useSkill(s.name); if (cd != null) { if (applyCode) applyCode(cd); else if (currentLessonId) setLessonBuffers(b => ({ ...b, [currentLessonId]: cd })); else setPrograms(p => ({ ...p, [activeTab]: cd })); setMemoryOpen(false); } }}>Insert</button>
                          <button className="btn-mini" aria-label={'Remove skill ' + s.name} onClick={() => window.KodroMemory.removeSkill(s.name)}>✕</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                : <p className="vibe-status">Save a program that worked, then reuse it on the next robot.</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Vibe coding (Code with AI) ----
  function VibeModal({ setVibeOpen, vibeCancelRef, setVibeBusy, aiInfo, pickModel, vibeMsgs, setVibeMsgs, vibeApply, vibeBusy, vibeLive, vibeEndRef, vibeError, vibePrompt, setVibePrompt, vibeSend, vibeContext }) {
    // The reflection the assistant is fed from past runs in this world,
    // rendered as a VISIBLE chip instead of an invisible prompt injection
    // (product-coherence D7: the memory loop must be seen to be believed).
    const ctxChip = (vibeContext && vibeContext.reflection) ? (
      <div className="vibe-ctx" title="Learned from your past runs in this world; it is fed into the assistant's context">
        <span className="vibe-ctx-tag">Memory context{vibeContext.world ? ' · ' + vibeContext.world : ''}</span>
        <span className="vibe-ctx-text">{vibeContext.reflection}</span>
      </div>
    ) : null;
    return (
      <div className="modal-backdrop" onClick={() => !vibeBusy && setVibeOpen(false)}>
        <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Code with AI" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <span className="eyebrow">{KI('vibe')}Vibe coding. Describe it, the AI writes it</span>
            <button className="btn-mini" aria-label="Close" onClick={() => { vibeCancelRef.current = true; setVibeBusy(false); setVibeOpen(false); }}>✕</button>
          </div>
          {aiInfo.available ? (
            <div className="vibe-body">
              <p className="vibe-status">Local model: <b>{aiInfo.model}</b> · runs entirely on this machine, nothing leaves it.</p>
              {ctxChip}
              {aiInfo.models && aiInfo.models.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>Use model</span>
                  <select value={aiInfo.override || aiInfo.model || ''} onChange={e => pickModel(e.target.value)} aria-label="AI model"
                    style={{ background: 'var(--navy-2)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: 12.5 }}>
                    {aiInfo.models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {aiInfo.override && <button className="btn-mini" onClick={() => pickModel('')} title="Return to automatic model selection">Auto</button>}
                </div>
              )}
              <div className="vibe-thread" role="log" aria-live="polite" aria-label="AI conversation">
                {vibeMsgs.length === 0 && (
                  <p className="vibe-empty">Chat with the AI like a coding partner. It may ask a question first, e.g. try <i>"explore the field"</i> or <i>"draw a star"</i>.</p>
                )}
                {vibeMsgs.map((m, i) => m.kind === 'code' ? (
                  <div key={i} className="vibe-msg ai code">
                    <pre className="vibe-code">{m.text}</pre>
                    <div className="vibe-code-actions">
                      <button className="ctrl ctrl-run" onClick={() => vibeApply(m.text, m.model)}>✓ Apply to editor</button>
                      <button className="btn-mini" onClick={() => { setVibeMsgs(ms => [...ms, { role: 'user', kind: 'text', text: '(discarded, try again)' }]); }}>Discard</button>
                    </div>
                  </div>
                ) : (
                  <div key={i} className={'vibe-msg ' + m.role}><span>{m.text}</span></div>
                ))}
                {vibeBusy && (
                  <div className="vibe-msg ai thinking">
                    {vibeLive ? <pre className="vibe-live">{vibeLive}</pre> : <span>Thinking…</span>}
                  </div>
                )}
                <div ref={vibeEndRef}></div>
              </div>
              {vibeError && <p className="vibe-error" role="alert">{vibeError}</p>}
              <div className="vibe-inputrow">
                <textarea
                  className="vibe-input"
                  rows={2}
                  placeholder='Say what the rover should do. The AI may ask you a question back'
                  value={vibePrompt}
                  onChange={e => setVibePrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); vibeSend(); } }}
                  aria-label="Describe what the rover should do"
                  autoFocus
                />
                <button className="ctrl ctrl-run" disabled={vibeBusy || !vibePrompt.trim()} onClick={vibeSend}>Send</button>
              </div>
              <span className="vibe-hint">Apply types the code into the editor. Nothing runs until you press Run.</span>
            </div>
          ) : (
            <div className="vibe-body">
              <p className="vibe-status">AI is offline. Vibe coding uses a <b>local</b> model (no cloud, no account):</p>
              {ctxChip}
              <ol className="vibe-steps">
                <li>Install Ollama from ollama.com (free, offline after install)</li>
                <li>Run: <code>ollama pull qwen2.5-coder:3b</code> (or <code>gemma3</code>)</li>
                <li>Reopen Kodro. This panel lights up automatically</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Blocks (visual block editor) ----
  function BlocksModal({ setBlocksOpen, BLOCK_DEFS, robotSpec, addBlock, endBlock, blockIndent, setBlockIndent, blocks, setBlocks, moveBlock, removeBlock, insertBlocksCode }) {
    return (
      <div className="modal-backdrop" onClick={() => setBlocksOpen(false)}>
        <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Block coding" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <span className="eyebrow">{KI('blocks')}Blocks. Click blocks to build, then turn them into Python</span>
            <button className="btn-mini" aria-label="Close" onClick={() => setBlocksOpen(false)}>✕</button>
          </div>
          <div className="blocks-palette">
            {BLOCK_DEFS.map(d => {
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
          <div className="blocks-program" aria-label="Your program">
            {blocks.length === 0 && <p className="vibe-hint">Click blocks above. They stack in order to form the program.</p>}
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
                      const lo = b.unit === '%' ? 0 : 1;
                      const hi = b.unit === '°' ? 360 : b.unit === '%' ? 100 : 20;
                      const raw = Number(e.target.value);
                      const v = Number.isFinite(raw) ? Math.max(lo, Math.min(hi, raw)) : lo;
                      setBlocks(bs => bs.map((x, j) => j === i ? { ...x, val: v } : x));
                    }}
                  />
                )}
                {b.unit && <span className="vibe-hint">{b.unit}</span>}
                <span className="block-actions">
                  <button className="btn-mini" disabled={i === 0} aria-label={'move ' + b.label + ' up'} title="Move up" onClick={() => moveBlock(i, -1)}>↑</button>
                  <button className="btn-mini" disabled={i === blocks.length - 1} aria-label={'move ' + b.label + ' down'} title="Move down" onClick={() => moveBlock(i, 1)}>↓</button>
                  <button className="btn-mini" aria-label={'remove ' + b.label} onClick={() => removeBlock(i)}>✕</button>
                </span>
              </div>
            ))}
          </div>
          <div className="vibe-actions">
            <button className="btn-mini" disabled={!blocks.length} onClick={() => { setBlocks([]); setBlockIndent(0); }}>Clear</button>
            <span className="vibe-hint" style={{ flex: 1 }}>Compiles to real Python in the editor. Nothing runs until you press Run.</span>
            <button className="ctrl ctrl-run" disabled={!blocks.length} onClick={insertBlocksCode}>Insert code →</button>
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
  };
})();
