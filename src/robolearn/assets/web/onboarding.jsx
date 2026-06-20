/*
 * Kodro onboarding / landing flow.
 *
 * A self-contained, skippable first-run experience that sits in front of the
 * studio: a landing hero, a "what do you want to build" robot picker, and the
 * assistant's world recommendation for that robot. Decoupled from app.jsx -
 * it reuses RobotLab's canonical catalogue (TYPES / WORLD_FOR / selectType) so
 * choosing a robot here drives exactly the same world selection the Robot Lab
 * would. Mounting and persistence ("seen it already") are owned by App; this
 * module only renders the flow and calls onClose() when the user is done.
 *
 * Exposes: window.KodroOnboarding({ onClose })
 */
(function () {
  const { useState, useEffect } = React;

  // Brand mark: the same orbit + trajectory + robot-node mark used in the navbar
  // (ORBIT_SVG), inlined so onboarding has no dependency on app.jsx.
  const MARK = (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="32" cy="32" r="21" stroke="currentColor" strokeWidth="2.4" opacity="0.2" />
      <path d="M15 44 A21 21 0 1 1 44 15" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" opacity="0.9" />
      <circle cx="15" cy="44" r="2.6" fill="currentColor" opacity="0.45" />
      <circle cx="44" cy="15" r="6.4" fill="currentColor" />
    </svg>
  );

  const CSS = `
  .konb-root{position:fixed;inset:0;z-index:4000;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(120% 120% at 50% 0%,#101726 0%,#070a12 70%);
    color:#e8edf7;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    animation:konb-fade .35s ease both;overflow:auto;padding:32px}
  @keyframes konb-fade{from{opacity:0}to{opacity:1}}
  @keyframes konb-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .konb-card{width:min(720px,100%);animation:konb-rise .4s ease both}
  .konb-mark{width:72px;height:72px;color:#5ed6ff;margin:0 auto 22px;display:block}
  .konb-mark svg{width:100%;height:100%}
  .konb-title{font-size:clamp(34px,6vw,52px);font-weight:750;letter-spacing:-.03em;text-align:center;margin:0}
  .konb-tag{font-size:clamp(17px,3vw,22px);font-weight:600;text-align:center;margin:14px 0 6px;color:#cfe0f5}
  .konb-sub{text-align:center;color:#8da3c0;max-width:460px;margin:0 auto;line-height:1.5}
  .konb-steps{display:flex;gap:7px;justify-content:center;margin:26px 0 4px}
  .konb-dot{width:7px;height:7px;border-radius:50%;background:#2b3a55;transition:background .25s,width .25s}
  .konb-dot.done{background:#5ed6ff;width:7px;border-radius:50%}
  .konb-dot.on{background:#5ed6ff;width:20px;border-radius:4px}
  .konb-actions{display:flex;gap:12px;justify-content:center;margin-top:32px;flex-wrap:wrap}
  .konb-btn{appearance:none;border:0;cursor:pointer;font:inherit;font-weight:650;border-radius:11px;
    padding:13px 26px;transition:transform .12s ease,background .2s,box-shadow .2s}
  .konb-btn:active{transform:translateY(1px)}
  .konb-btn.primary{background:#5ed6ff;color:#06121b;box-shadow:0 8px 26px -10px #5ed6ff}
  .konb-btn.primary:hover{background:#7ee0ff}
  .konb-btn.ghost{background:transparent;color:#9fb4d2;border:1px solid #283a55}
  .konb-btn.ghost:hover{color:#dce8f8;border-color:#3b567a}
  .konb-btn[disabled]{opacity:.4;cursor:not-allowed}
  .konb-btn.primary[disabled]{background:#1b2738;color:#5d728f;box-shadow:none;opacity:1;cursor:not-allowed}
  .konb-h2{font-size:clamp(24px,4vw,32px);font-weight:720;letter-spacing:-.02em;text-align:center;margin:0 0 8px}
  .konb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-top:26px}
  @media (max-width:560px){.konb-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  .konb-tile{text-align:left;background:#0f1726;border:1.5px solid #233248;border-radius:14px;padding:17px 17px 15px;
    cursor:pointer;transition:border-color .18s,transform .12s,background .18s;color:inherit;font:inherit}
  .konb-tile:hover{border-color:#3d5a80;transform:translateY(-2px)}
  .konb-tile.sel{border-color:#5ed6ff;background:#11202e;box-shadow:0 0 0 1px #5ed6ff inset}
  .konb-emoji{font-size:30px;line-height:1}
  .konb-tname{font-weight:680;margin:9px 0 4px;font-size:16px}
  .konb-blurb{color:#8da3c0;font-size:13px;line-height:1.45}
  .konb-rec{background:#0f1726;border:1.5px solid #233248;border-radius:16px;padding:24px;margin-top:24px;text-align:center}
  .konb-rec .konb-world{font-size:26px;font-weight:720;color:#5ed6ff;margin:6px 0}
  .konb-rec .konb-why{color:#9fb4d2;line-height:1.5;max-width:440px;margin:6px auto 0}
  .konb-skip{position:absolute;top:20px;right:24px}
  .konb-skip button{background:none;border:0;color:#6f86a6;cursor:pointer;font:inherit;font-size:14px}
  .konb-skip button:hover{color:#cfe0f5}
  .konb-agent{margin-top:22px}
  .konb-agent-row{display:flex;gap:9px;align-items:center}
  .konb-agent-input{flex:1;min-width:0;background:#0e1726;border:1.5px solid #233248;border-radius:11px;
    color:#e8edf7;font:inherit;font-size:15px;padding:12px 14px;outline:none;transition:border-color .18s}
  .konb-agent-input:focus{border-color:#5ed6ff}
  .konb-agent-mic{padding:12px 14px}
  .konb-agent-or{text-align:center;color:#6f86a6;font-size:13px;margin:14px 0 0;letter-spacing:.02em}
  .konb-agent-err{text-align:center;color:#ffb4a8;font-size:13px;margin:10px 0 0;line-height:1.4}
  .konb-built{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:12px 0 0}
  .konb-chip{background:#11202e;border:1px solid #2a4258;border-radius:999px;color:#bfe6ff;font-size:12px;padding:4px 11px}
  `;

  function Step({ n, current }) {
    return (
      <div className="konb-steps" role="group" aria-label={"Step " + (current + 1) + " of 3"}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={"konb-dot" + (i === current ? " on" : i < current ? " done" : "")} />
        ))}
      </div>
    );
  }

  function KodroOnboarding({ onClose }) {
    const [step, setStep] = useState(0); // 0 land, 1 pick, 2 recommend
    const [type, setType] = useState(null);
    // Onboarding agent: describe a robot in words and it is built from the
    // validated parts catalogue (RobotLab.buildFromText). `built` holds the
    // result so step 2 can show the exact parts the agent fitted.
    const [agentText, setAgentText] = useState("");
    const [built, setBuilt] = useState(null);
    const [agentBusy, setAgentBusy] = useState(false);
    const [agentErr, setAgentErr] = useState("");

    useEffect(() => {
      const tag = "kodro-onb-style";
      if (!document.getElementById(tag)) {
        const el = document.createElement("style");
        el.id = tag;
        el.textContent = CSS;
        document.head.appendChild(el);
      }
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const TYPES = (window.RobotLab && window.RobotLab.TYPES) || {};
    const WORLD_FOR = (window.RobotLab && window.RobotLab.WORLD_FOR) || {};
    const order = ["rover", "car", "home", "arm", "custom"].filter((id) => TYPES[id]);
    const rec = (type && WORLD_FOR[type]) || {};
    // Prefer the curated, place-like label ("Open terrain", "Riverside City")
    // over the raw terrain name ("Earth"), which reads oddly under the why-copy.
    const worldName = rec.label || (window.TERRAINS && rec.id && window.TERRAINS[rec.id] && window.TERRAINS[rec.id].name) || "the city";
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

    function enterStudio() {
      try {
        // The agent-built spec is already saved with its full parts; only fall
        // back to the bare type when nothing was built from a description.
        if (!built && window.RobotLab && type) window.RobotLab.selectType(type);
      } catch (e) { void e; }
      onClose();
    }

    // Build a robot from a free-text (or spoken) description, validated through
    // the parts catalogue, then jump to the world recommendation for it.
    function buildFromAgent(text) {
      const q = (text != null ? text : agentText).trim();
      if (!q) return;
      // If the build assistant could not load, do not fail silently: tell the
      // user and point them at the tile picker right below, which needs no
      // assistant. (RobotLab is bundled, so this is a defensive fallback.)
      if (!window.RobotLab || !window.RobotLab.buildFromText) {
        setAgentErr("The build assistant could not load. Pick a starting point below instead.");
        return;
      }
      setAgentErr("");
      const res = window.RobotLab.buildFromText(q);
      setBuilt(res);
      setType(res.spec.type);
      setStep(2);
    }
    function agentVoice() {
      if (agentBusy || !window.RoboLearn || !window.RoboLearn.isAvailable || !window.RoboLearn.isAvailable()) return;
      const listen = window.RoboLearn.listen || window.RoboLearn.voiceCommand;
      if (!listen) return;
      setAgentBusy(true); setAgentErr("");
      Promise.resolve(listen(6)).then(function (r) {
        const txt = r && (r.text || r.transcript || (typeof r === "string" ? r : ""));
        if (txt && txt.trim()) { setAgentText(txt); buildFromAgent(txt); }
        // Do not fail silently: an empty/failed capture tells the user to retry
        // or type, rather than leaving the button looking stuck.
        else { setAgentErr((r && r.reason) || "Did not catch that. Try again, or type your robot below."); }
      }).catch(function (e) {
        setAgentErr((e && e.message) || "Voice input failed. Try again, or type your robot below.");
      }).then(function () { setAgentBusy(false); });
    }

    return (
      <div className="konb-root" role="dialog" aria-modal="true" aria-label="Welcome to Kodro">
        <div className="konb-skip"><button onClick={onClose}>Skip</button></div>
        <div className="konb-card">
          {step === 0 && (
            <div>
              <div className="konb-mark">{MARK}</div>
              <h1 className="konb-title">Kodro</h1>
              <p className="konb-tag">Design a robot. Program it. Watch it work.</p>
              <p className="konb-sub">An offline robot design and simulation studio. Build a machine, write its behaviour, and validate it in a world that fits it - all on your own computer, no account, no cloud.</p>
              <Step current={0} />
              <div className="konb-actions">
                <button className="konb-btn primary" autoFocus onClick={() => setStep(1)}>Get started</button>
                <button className="konb-btn ghost" onClick={onClose}>Skip to studio</button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="konb-h2">What do you want to build?</h2>
              <p className="konb-sub">Describe it in your own words and the assistant builds it, or pick a starting point. You can redesign every part later in the Robot Lab.</p>
              <div className="konb-agent">
                <div className="konb-agent-row">
                  <input
                    className="konb-agent-input"
                    value={agentText}
                    placeholder="e.g. a self-driving car with a camera and an obstacle sensor"
                    aria-label="Describe your robot"
                    onChange={(e) => setAgentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") buildFromAgent(); }}
                  />
                  {window.RoboLearn && window.RoboLearn.isAvailable && window.RoboLearn.isAvailable() && (
                    <button className="konb-btn ghost konb-agent-mic" type="button" title="Describe by voice" disabled={agentBusy} onClick={agentVoice}>{agentBusy ? "…" : "🎤"}</button>
                  )}
                  <button className="konb-btn primary" type="button" disabled={!agentText.trim()} onClick={() => buildFromAgent()}>Build it</button>
                </div>
                {agentErr && <p className="konb-agent-err" role="alert">{agentErr}</p>}
                <p className="konb-agent-or">or pick a starting point</p>
              </div>
              <div className="konb-grid" role="radiogroup" aria-label="Robot type">
                {order.map((id) => {
                  const t = TYPES[id];
                  return (
                    <button
                      key={id}
                      role="radio"
                      aria-checked={type === id}
                      className={"konb-tile" + (type === id ? " sel" : "")}
                      onClick={() => setType(id)}
                    >
                      <div className="konb-emoji">{t.emoji}</div>
                      <div className="konb-tname">{t.name}</div>
                      <div className="konb-blurb">{t.blurb}</div>
                    </button>
                  );
                })}
              </div>
              <Step current={1} />
              <div className="konb-actions">
                <button className="konb-btn ghost" onClick={() => setStep(0)}>Back</button>
                <button className="konb-btn primary" disabled={!type} title={!type ? "Pick a robot to continue" : undefined} onClick={() => setStep(2)}>Continue</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="konb-h2">Where it gets tested first</h2>
              <p className="konb-sub">The assistant picks a world that suits your robot. Test it there, then try the others.</p>
              <div className="konb-rec">
                <div className="konb-emoji">{(TYPES[type] && TYPES[type].emoji) || "🤖"}</div>
                {built && built.spec && (
                  <div className="konb-built" aria-label="Parts the assistant fitted">
                    {[built.spec.board].concat(built.spec.sensors || [], built.spec.actuators || []).map((p, i) => (
                      <span key={i} className="konb-chip">{p}</span>
                    ))}
                  </div>
                )}
                <div className="konb-world">{worldName}</div>
                <div className="konb-why">{cap(rec.why) || "Start in the busy city, then try the others."}</div>
              </div>
              <Step current={2} />
              <div className="konb-actions">
                <button className="konb-btn ghost" onClick={() => setStep(1)}>Back</button>
                <button className="konb-btn primary" onClick={enterStudio}>Enter studio</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  window.KodroOnboarding = KodroOnboarding;
})();
