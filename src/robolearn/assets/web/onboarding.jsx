/*
 * Kodro onboarding / landing flow.
 *
 * A self-contained, skippable first-run experience that sits in front of the
 * studio: an editorial landing hero, a "what do you want to build" robot
 * picker, and the assistant's world recommendation for that robot. Decoupled
 * from app.jsx - it reuses RobotLab's canonical catalogue (TYPES / WORLD_FOR /
 * selectType) so choosing a robot here drives exactly the same world selection
 * the Robot Lab would. Mounting and persistence ("seen it already") are owned
 * by App; this module only renders the flow and calls onClose() when done.
 *
 * Visual language is unified with the studio (styles.css :root): the Orbital
 * Rover token system - void/navy surfaces, paper text, cyan = go, mars/brass
 * accents, Cormorant display + Inter Tight body + JetBrains Mono labels. The
 * landing leads with a large serif headline against a mono eyebrow, an orbital
 * brand motif on a starfield, and a capability strip - an intentional editorial
 * split, not a centred template. Atmosphere is CSS-only and GPU-friendly, and
 * the whole motion path is gated behind prefers-reduced-motion.
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

  // Capability labels for the hero strip: concrete, mono, what the studio does.
  const CAPS = ["Design the machine", "Program its behaviour", "Simulate the world", "Offline by default"];

  const CSS = `
  .konb-root{
    position:fixed; inset:0; z-index:4000; overflow:auto;
    color:var(--fg-1); font-family:var(--font-body);
    background:
      radial-gradient(120% 90% at 82% -6%, rgba(92,224,216,0.10), transparent 52%),
      radial-gradient(80% 70% at 6% 104%, rgba(200,104,90,0.08), transparent 55%),
      linear-gradient(180deg, var(--navy) 0%, var(--void) 78%);
    animation:konb-fade .4s var(--ease) both;
  }
  /* Starfield + faint orbital lines, painted CSS-only behind everything. */
  .konb-root::before{
    content:''; position:absolute; inset:0; pointer-events:none; z-index:0; opacity:0.6;
    background-image:
      radial-gradient(1px 1px at 18% 24%, rgba(245,240,228,0.7), transparent),
      radial-gradient(1px 1px at 67% 14%, rgba(245,240,228,0.5), transparent),
      radial-gradient(1.4px 1.4px at 41% 62%, rgba(245,240,228,0.55), transparent),
      radial-gradient(1px 1px at 88% 48%, rgba(92,224,216,0.6), transparent),
      radial-gradient(1px 1px at 12% 78%, rgba(245,240,228,0.45), transparent),
      radial-gradient(1.2px 1.2px at 74% 82%, rgba(245,240,228,0.4), transparent),
      radial-gradient(1px 1px at 54% 32%, rgba(201,168,106,0.5), transparent);
    background-repeat:no-repeat;
  }
  /* Fine grain over the whole panel for atmosphere (matches studio .grain). */
  .konb-root::after{
    content:''; position:absolute; inset:0; pointer-events:none; z-index:0; opacity:0.045;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  @keyframes konb-fade{from{opacity:0}to{opacity:1}}
  @keyframes konb-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
  @keyframes konb-spin{to{transform:rotate(360deg)}}

  .konb-shell{
    position:relative; z-index:1; min-height:100%;
    display:flex; flex-direction:column;
    max-width:1140px; margin:0 auto; padding:30px clamp(20px,5vw,64px) 44px;
  }
  .konb-topbar{ display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .konb-wordmark{ display:flex; align-items:center; gap:11px; }
  .konb-wordmark .wm-mark{ width:30px; height:30px; color:var(--cyan); flex:none; }
  .konb-wordmark .wm-mark svg{ width:100%; height:100%; display:block; }
  .konb-wordmark .wm-name{ font-family:var(--font-display); font-size:23px; font-weight:600; letter-spacing:.01em; line-height:1; }
  .konb-wordmark .wm-sub{ font-family:var(--font-mono); font-size:8.5px; letter-spacing:.26em; text-transform:uppercase; color:var(--fg-3); margin-top:3px; }
  .konb-skip{ background:none; border:1px solid var(--border); color:var(--fg-2);
    font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase;
    border-radius:5px; padding:9px 14px; cursor:pointer; transition:all 160ms var(--ease); }
  .konb-skip:hover{ color:var(--fg-1); border-color:var(--fg-3); background:rgba(245,240,228,.04); }

  .konb-body{ flex:1; display:flex; flex-direction:column; justify-content:center; padding:clamp(24px,5vh,56px) 0 8px; }

  /* ---- Eyebrow + section heads ---- */
  .konb-eyebrow{
    display:inline-flex; align-items:center; gap:9px;
    font-family:var(--font-mono); font-size:10.5px; font-weight:500;
    letter-spacing:.22em; text-transform:uppercase; color:var(--cyan);
  }
  .konb-eyebrow::before{ content:''; width:24px; height:1px; background:var(--cyan); opacity:.7; }

  /* ============ STEP 0 — editorial hero ============ */
  .konb-hero{ display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr); gap:clamp(28px,5vw,72px); align-items:center; animation:konb-rise .5s var(--ease) both; }
  .konb-lede{ min-width:0; }
  .konb-h1{
    font-family:var(--font-display); font-weight:600;
    font-size:clamp(46px,8.5vw,104px); line-height:.94; letter-spacing:-.015em;
    margin:18px 0 0; color:var(--fg-1);
  }
  .konb-h1 em{ font-style:italic; color:var(--cyan); }
  .konb-lead{
    font-size:clamp(15px,1.7vw,19px); line-height:1.6; color:var(--fg-2);
    max-width:48ch; margin:22px 0 0;
  }
  .konb-lead b{ color:var(--fg-1); font-weight:600; }
  .konb-caps{ display:flex; flex-wrap:wrap; gap:8px 10px; margin:26px 0 0; list-style:none; padding:0; }
  .konb-caps li{
    font-family:var(--font-mono); font-size:11px; letter-spacing:.04em; color:var(--fg-2);
    border:0.5px solid var(--border); border-left:2px solid var(--brass);
    border-radius:5px; padding:6px 11px; background:rgba(245,240,228,.02);
  }
  .konb-caps li:last-child{ border-left-color:var(--cyan); color:var(--cyan); }

  /* ---- Orbital motif panel ---- */
  .konb-orbit{ position:relative; aspect-ratio:1/1; width:100%; max-width:380px; justify-self:end; align-self:center; }
  .konb-orbit .ring{ position:absolute; inset:0; border-radius:50%; border:0.5px solid var(--border); }
  .konb-orbit .ring.r2{ inset:13%; border-color:rgba(245,240,228,.08); }
  .konb-orbit .ring.r3{ inset:27%; border-style:dashed; border-color:rgba(92,224,216,.18); }
  .konb-orbit .spin{ position:absolute; inset:13%; animation:konb-spin 38s linear infinite; }
  .konb-orbit .node{ position:absolute; top:-5px; left:50%; width:10px; height:10px; margin-left:-5px; border-radius:50%;
    background:var(--cyan); box-shadow:0 0 14px 2px rgba(92,224,216,.7); }
  .konb-orbit .spin.s2{ inset:27%; animation-duration:24s; animation-direction:reverse; }
  .konb-orbit .spin.s2 .node{ width:7px; height:7px; margin-left:-3.5px; background:var(--mars); box-shadow:0 0 12px 1px rgba(200,104,90,.6); }
  .konb-core{
    position:absolute; inset:35%; border-radius:50%;
    display:flex; align-items:center; justify-content:center; color:var(--cyan);
    background:radial-gradient(circle at 38% 30%, var(--navy-3), var(--navy) 72%);
    border:0.5px solid var(--border);
    box-shadow:0 24px 60px -22px rgba(0,0,0,.7), inset 0 1px 0 rgba(245,240,228,.05);
  }
  .konb-core svg{ width:54%; height:54%; }

  /* ============ Steps + actions ============ */
  .konb-steps{ display:flex; gap:7px; align-items:center; margin:34px 0 0; }
  .konb-dot{ width:7px; height:7px; border-radius:99px; background:var(--ink-2); transition:all .25s var(--ease); }
  .konb-dot.done{ background:var(--cyan-deep); }
  .konb-dot.on{ width:24px; border-radius:4px; background:var(--cyan); }
  .konb-progress{ font-family:var(--font-mono); font-size:10px; letter-spacing:.14em; color:var(--fg-3); text-transform:uppercase; margin-left:6px; }

  .konb-actions{ display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin:30px 0 0; }
  .konb-btn{
    appearance:none; cursor:pointer; font-family:var(--font-body); font-weight:600; font-size:14px;
    display:inline-flex; align-items:center; gap:9px; min-height:46px; padding:0 24px; border-radius:6px;
    border:1px solid var(--border); background:transparent; color:var(--fg-1);
    transition:transform 120ms var(--ease), background 180ms var(--ease), border-color 180ms var(--ease), box-shadow 180ms var(--ease);
  }
  .konb-btn .arr{ font-family:var(--font-mono); transition:transform 180ms var(--ease); }
  .konb-btn:active{ transform:translateY(1px); }
  .konb-btn.primary{ background:var(--cyan); color:var(--void); border-color:var(--cyan); font-weight:700;
    box-shadow:0 0 0 1px rgba(92,224,216,.4), 0 14px 34px -14px rgba(92,224,216,.7); }
  .konb-btn.primary:hover{ background:var(--cyan-2); border-color:var(--cyan-2); }
  .konb-btn.primary:hover .arr{ transform:translateX(4px); }
  .konb-btn.ghost:hover{ color:var(--fg-1); border-color:var(--fg-3); background:rgba(245,240,228,.05); }
  .konb-btn[disabled]{ cursor:not-allowed; opacity:1; }
  .konb-btn.primary[disabled]{ background:var(--navy-3); color:var(--fg-3); border-color:var(--border); box-shadow:none; }

  /* ============ STEP 1 / 2 — panel ============ */
  .konb-panel{ width:min(760px,100%); margin:0 auto; animation:konb-rise .45s var(--ease) both; }
  .konb-h2{ font-family:var(--font-display); font-weight:600; font-size:clamp(30px,4.4vw,46px); line-height:1.02; letter-spacing:-.01em; margin:14px 0 0; }
  .konb-sub{ font-size:14.5px; line-height:1.6; color:var(--fg-2); max-width:58ch; margin:12px 0 0; }

  /* describe-your-robot assistant row */
  .konb-agent{ margin:26px 0 0; }
  .konb-agent-row{ display:flex; gap:9px; align-items:stretch; }
  .konb-agent-input{
    flex:1; min-width:0; background:var(--void); border:1px solid var(--border); border-radius:6px;
    color:var(--fg-1); font-family:var(--font-body); font-size:14.5px; padding:0 15px; min-height:46px; outline:none;
    transition:border-color 160ms var(--ease), box-shadow 160ms var(--ease);
  }
  .konb-agent-input::placeholder{ color:var(--fg-3); }
  .konb-agent-input:focus{ border-color:var(--cyan); box-shadow:0 0 0 3px rgba(92,224,216,.18); }
  .konb-agent-err{ color:var(--mars); font-size:13px; line-height:1.45; margin:10px 0 0; }
  .konb-agent-or{ display:flex; align-items:center; gap:12px; font-family:var(--font-mono); font-size:10.5px;
    letter-spacing:.18em; text-transform:uppercase; color:var(--fg-3); margin:20px 0 4px; }
  .konb-agent-or::before, .konb-agent-or::after{ content:''; flex:1; height:0.5px; background:var(--border); }

  /* robot tiles — bento-ish, first tile spans wider on desktop */
  .konb-grid{ display:grid; grid-template-columns:repeat(6,1fr); gap:12px; margin:14px 0 0; }
  .konb-tile{
    grid-column:span 2; text-align:left; cursor:pointer; color:inherit; font:inherit; min-height:44px;
    background:linear-gradient(180deg, var(--navy-2), var(--navy));
    border:1px solid var(--border); border-radius:10px; padding:15px 16px;
    transition:transform 140ms var(--ease), border-color 160ms var(--ease), box-shadow 160ms var(--ease);
  }
  .konb-tile:hover{ transform:translateY(-2px); border-color:rgba(92,224,216,.4); box-shadow:0 16px 34px -22px rgba(0,0,0,.8); }
  .konb-tile[aria-pressed="true"]{ border-color:var(--cyan); box-shadow:inset 0 0 0 1px var(--cyan), 0 14px 34px -20px rgba(92,224,216,.5); }
  .konb-tile .t-top{ display:flex; align-items:center; justify-content:space-between; }
  .konb-emoji{ line-height:0; color:var(--cyan); }
  .konb-tile .t-check{ font-family:var(--font-mono); font-size:11px; color:var(--cyan); opacity:0; transition:opacity 140ms var(--ease); }
  .konb-tile[aria-pressed="true"] .t-check{ opacity:1; }
  .konb-tname{ font-family:var(--font-display); font-size:19px; font-weight:600; margin:11px 0 3px; line-height:1.05; }
  .konb-blurb{ color:var(--fg-2); font-size:12.5px; line-height:1.5; }

  /* world recommendation card */
  .konb-rec{
    display:flex; gap:20px; align-items:center; margin:24px 0 0; padding:22px 24px;
    background:linear-gradient(180deg, var(--navy-2), var(--navy));
    border:1px solid var(--border); border-radius:12px;
    box-shadow:0 24px 60px -30px rgba(0,0,0,.8);
  }
  .konb-rec .rec-badge{
    flex:none; width:74px; height:74px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:38px;
    background:radial-gradient(circle at 36% 28%, var(--navy-3), var(--void) 78%);
    border:0.5px solid var(--border);
  }
  .konb-rec .rec-meta{ min-width:0; }
  .konb-rec .rec-label{ font-family:var(--font-mono); font-size:10px; letter-spacing:.18em; text-transform:uppercase; color:var(--fg-3); }
  .konb-world{ font-family:var(--font-display); font-size:clamp(26px,3.4vw,34px); font-weight:600; color:var(--cyan); line-height:1.04; margin:3px 0 6px; }
  .konb-why{ color:var(--fg-2); font-size:13.5px; line-height:1.5; }
  .konb-built{ display:flex; flex-wrap:wrap; gap:6px; margin:14px 0 0; }
  .konb-chip{ font-family:var(--font-mono); font-size:11px; color:var(--cyan);
    background:rgba(92,224,216,.08); border:0.5px solid rgba(92,224,216,.3); border-radius:99px; padding:4px 11px; }

  @media (max-width:880px){
    .konb-hero{ grid-template-columns:1fr; gap:34px; }
    .konb-orbit{ max-width:280px; justify-self:start; order:-1; }
    .konb-grid{ grid-template-columns:repeat(4,1fr); }
    .konb-tile{ grid-column:span 2; }
  }
  @media (max-width:560px){
    .konb-shell{ padding:20px 18px 34px; }
    .konb-grid{ grid-template-columns:1fr; }
    .konb-tile{ grid-column:auto; }
    .konb-actions{ flex-direction:column; align-items:stretch; }
    /* Full-width is for the step-nav buttons only, not the agent-row controls. */
    .konb-actions .konb-btn{ width:100%; justify-content:center; }
    /* Phone agent-row: input on its own line, Build on the next line. */
    .konb-agent-row{ flex-wrap:wrap; }
    .konb-agent-input{ flex:1 1 100%; }
    .konb-agent-row .konb-btn.primary{ flex:1; justify-content:center; }
    .konb-orbit{ max-width:200px; }
    .konb-rec{ flex-direction:column; align-items:flex-start; text-align:left; }
  }

  /* Short laptop screens (A16): compress the hero rhythm so the primary CTA
     sits above the fold at 1280x800 instead of below it. */
  @media (max-height:820px){
    .konb-shell{ padding:18px clamp(20px,5vw,64px) 24px; }
    .konb-body{ padding:12px 0 4px; }
    .konb-h1{ font-size:clamp(36px,6.8vw,72px); margin-top:12px; }
    .konb-lead{ margin-top:14px; }
    .konb-caps{ margin-top:16px; }
    .konb-steps{ margin-top:18px; }
    .konb-actions{ margin-top:16px; }
    .konb-orbit{ max-width:290px; }
  }

  /* Visible keyboard focus on every control (AA). */
  .konb-root button:focus-visible, .konb-root input:focus-visible, .konb-root [tabindex]:focus-visible{
    outline:3px solid var(--cyan); outline-offset:2px; border-radius:6px;
  }

  /* Full reduced-motion path: no entry, no orbit, no transitions. */
  @media (prefers-reduced-motion: reduce){
    .konb-root, .konb-hero, .konb-panel{ animation:none; }
    .konb-orbit .spin{ animation:none; }
    .konb-btn, .konb-tile, .konb-dot, .konb-agent-input, .konb-skip, .konb-btn .arr, .konb-tile .t-check{ transition:none; }
  }
  `;

  function Steps({ current }) {
    return (
      <div className="konb-steps" role="group" aria-label={"Step " + (current + 1) + " of 3"}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={"konb-dot" + (i === current ? " on" : i < current ? " done" : "")} aria-hidden="true" />
        ))}
        <span className="konb-progress">{(current + 1) + " / 3"}</span>
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

    // Build a robot from a free-text description, validated through the
    // parts catalogue, then jump to the world recommendation for it.
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
    return (
      <div className="konb-root" role="dialog" aria-modal="true" aria-label="Welcome to Kodro">
        <div className="konb-shell">
          <header className="konb-topbar">
            <div className="konb-wordmark">
              <div className="wm-mark">{MARK}</div>
              <div>
                <div className="wm-name">Kodro</div>
                <div className="wm-sub">Robot design studio · Offline</div>
              </div>
            </div>
            <button type="button" className="konb-skip" onClick={onClose}>Skip to studio</button>
          </header>

          <main className="konb-body">
            {step === 0 && (
              <section className="konb-hero" aria-labelledby="konb-h1">
                <div className="konb-lede">
                  <span className="konb-eyebrow">Offline robotics workbench</span>
                  <h1 className="konb-h1" id="konb-h1">Build a robot.<br />Teach it.<br /><em>Watch it work.</em></h1>
                  <p className="konb-lead">
                    Kodro is an <b>offline robot design and simulation studio</b>. Assemble a machine from real parts,
                    write the code that drives it, and validate it in a physics world that fits the build. Everything
                    runs on your own computer, with a local AI assistant and no account needed. Offline by default; you can optionally connect your own cloud model key.
                  </p>
                  <ul className="konb-caps">
                    {CAPS.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                  <Steps current={0} />
                  <div className="konb-actions">
                    <button type="button" className="konb-btn primary" autoFocus onClick={() => setStep(1)}>
                      Start building <span className="arr" aria-hidden="true">&rarr;</span>
                    </button>
                    <button type="button" className="konb-btn ghost" onClick={onClose}>Skip to studio</button>
                  </div>
                </div>
                <div className="konb-orbit" aria-hidden="true">
                  <div className="ring r1"></div>
                  <div className="ring r2"></div>
                  <div className="ring r3"></div>
                  <div className="spin s1"><span className="node"></span></div>
                  <div className="spin s2"><span className="node"></span></div>
                  <div className="konb-core">{MARK}</div>
                </div>
              </section>
            )}

            {step === 1 && (
              <section className="konb-panel" aria-labelledby="konb-h2-pick">
                <span className="konb-eyebrow">Step two</span>
                <h2 className="konb-h2" id="konb-h2-pick">What do you want to build?</h2>
                <p className="konb-sub">Describe it in your own words and the assistant fits the parts, or pick a starting point. You can redesign every part later in the Robot Lab.</p>
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
                    <button className="konb-btn primary" type="button" disabled={!agentText.trim()} onClick={() => buildFromAgent()}>Build it</button>
                  </div>
                  {agentErr && <p className="konb-agent-err" role="alert">{agentErr}</p>}
                  <div className="konb-agent-or" aria-hidden="true">or pick a starting point</div>
                </div>
                <div className="konb-grid" role="group" aria-label="Robot starting points">
                  {order.map((id) => {
                    const t = TYPES[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={type === id}
                        aria-label={t.name + ". " + t.blurb}
                        className="konb-tile"
                        onClick={() => { setType(id); setBuilt(null); setAgentText(""); }}
                      >
                        <div className="t-top">
                          <span className="konb-emoji" aria-hidden="true">{window.KodroIcons ? window.KodroIcons.el(t.icon) : null}</span>
                          <span className="t-check" aria-hidden="true">SELECTED</span>
                        </div>
                        <div className="konb-tname">{t.name}</div>
                        <div className="konb-blurb">{t.blurb}</div>
                      </button>
                    );
                  })}
                </div>
                <Steps current={1} />
                <div className="konb-actions">
                  <button type="button" className="konb-btn ghost" onClick={() => setStep(0)}>Back</button>
                  <button type="button" className="konb-btn primary" disabled={!type} title={!type ? "Pick a robot to continue" : undefined} onClick={() => setStep(2)}>
                    Continue <span className="arr" aria-hidden="true">&rarr;</span>
                  </button>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="konb-panel" aria-labelledby="konb-h2-rec">
                <span className="konb-eyebrow">Step three</span>
                <h2 className="konb-h2" id="konb-h2-rec">Where it gets tested first</h2>
                <p className="konb-sub">The assistant picks a world that suits your robot. Test it there, then try the others from inside the studio.</p>
                <div className="konb-rec">
                  <div className="rec-badge" aria-hidden="true">{window.KodroIcons ? window.KodroIcons.el((TYPES[type] && TYPES[type].icon) || "home") : null}</div>
                  <div className="rec-meta">
                    <div className="rec-label">Recommended world</div>
                    <div className="konb-world">{worldName}</div>
                    <div className="konb-why">{cap(rec.why) || "Start in the busy city, then try the others."}</div>
                    {built && built.spec && (
                      <div className="konb-built" aria-label="Parts the assistant fitted">
                        {[built.spec.board].concat(built.spec.sensors || [], built.spec.actuators || []).map((p, i) => (
                          <span key={i} className="konb-chip">{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Steps current={2} />
                <div className="konb-actions">
                  <button type="button" className="konb-btn ghost" onClick={() => setStep(1)}>Back</button>
                  <button type="button" className="konb-btn primary" onClick={enterStudio}>
                    Enter studio <span className="arr" aria-hidden="true">&rarr;</span>
                  </button>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    );
  }

  window.KodroOnboarding = KodroOnboarding;
})();
