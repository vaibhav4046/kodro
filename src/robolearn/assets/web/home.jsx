/* Home: the front door.
 *
 * Kodro's landing surface used to be the Prove cockpit, which opens on
 * "Deterministic evidence / Five fixed seeds vary traction, mass, sensor
 * noise...", a 23-item world dropdown and a "Run 5-seed proof" button. That is
 * an auditor's screen. A newcomer could not tell what the app is, what to click
 * first, or what they could make, and the 18 lessons (the actual product) were
 * two menus deep under More tools.
 *
 * This screen answers exactly three questions in the first sentence and then
 * offers exactly three doors. Nothing else. Anything a first session does not
 * need lives behind those doors, not on this page.
 *
 * It is re-openable (the Home control in the top bar), so it is a place you can
 * return to rather than a one-off wizard you dismiss and never see again.
 *
 * Exposes: window.KodroHome({ onLessons, onDesign, onFreePlay, onClose, canClose })
 */
(function () {
  const { useEffect, useRef } = React;

  const CSS = `
.kh-back{position:fixed;inset:0;z-index:70;background:var(--void);
  display:flex;align-items:center;justify-content:center;padding:24px;overflow:auto}
.kh-wrap{width:min(940px,100%);margin:auto}
.kh-brand{display:flex;align-items:center;gap:10px;margin:0 0 26px}
.kh-brand-mark{width:26px;height:26px;color:var(--cyan);flex:none}
.kh-brand-name{font-family:var(--font-display);font-size:22px;letter-spacing:.02em;color:var(--fg-1)}
.kh-lede{font-family:var(--font-display);font-size:clamp(28px,4.4vw,44px);line-height:1.12;
  color:var(--fg-1);margin:0 0 12px;max-width:22ch}
.kh-sub{font-size:15px;line-height:1.55;color:var(--fg-2);margin:0 0 30px;max-width:56ch}
.kh-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:0 0 26px}
@media (max-width:760px){.kh-cards{grid-template-columns:1fr}}
.kh-card{display:flex;flex-direction:column;gap:8px;text-align:left;padding:20px 18px 18px;
  background:var(--navy);border:1px solid var(--border);border-radius:12px;color:var(--fg-1);
  cursor:pointer;transition:border-color .18s var(--ease),transform .18s var(--ease),background .18s var(--ease)}
.kh-card:hover,.kh-card:focus-visible{border-color:var(--cyan);background:var(--navy-2);transform:translateY(-2px)}
.kh-card:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
.kh-card-k{font-family:var(--font-mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--cyan)}
.kh-card-t{font-family:var(--font-display);font-size:21px;line-height:1.2;color:var(--fg-1)}
.kh-card-d{font-size:13.5px;line-height:1.5;color:var(--fg-2)}
.kh-card-go{margin-top:auto;padding-top:10px;font-size:12.5px;color:var(--cyan)}
.kh-make{border-top:1px solid var(--border-2);padding-top:18px}
.kh-make-h{font-family:var(--font-mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--fg-3);margin:0 0 10px}
.kh-make-list{display:flex;flex-wrap:wrap;gap:8px 22px;margin:0;padding:0;list-style:none}
.kh-make-list li{font-size:13.5px;color:var(--fg-2)}
.kh-foot{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:22px;
  font-size:12.5px;color:var(--fg-3);flex-wrap:wrap}
.kh-close{background:none;border:1px solid var(--border);border-radius:8px;color:var(--fg-2);
  padding:7px 14px;font-size:12.5px;cursor:pointer}
.kh-close:hover{border-color:var(--cyan);color:var(--fg-1)}
`;

  // What you can actually make. Concrete outcomes, not capabilities: a reader
  // should picture the finished thing, which is what "what can I make with
  // this" really asks.
  const MAKES = [
    'A rover that drives itself round a city without hitting anything',
    'A robot arm that runs a repeating routine',
    'A delivery robot you design from real motors and batteries',
  ];

  const DOORS = [
    {
      key: 'lessons',
      kicker: 'Start here',
      title: 'Learn to code',
      desc: '18 step by step lessons, ages 5 to 16. Each one gives you a working program to change, a goal, and feedback after every run.',
      go: 'Open the lessons',
      handler: 'onLessons',
    },
    {
      key: 'design',
      kicker: 'Build',
      title: 'Design a robot',
      desc: 'Fit real motors and batteries and see the speed, range and stopping distance your design would actually have.',
      go: 'Open the robot lab',
      handler: 'onDesign',
    },
    {
      key: 'play',
      kicker: 'Explore',
      title: 'Free play',
      desc: 'Write Python and drive a robot through a city, a house, Mars or the deep sea. No goals, nothing to pass.',
      go: 'Open the studio',
      handler: 'onFreePlay',
    },
  ];

  function KodroHome(props) {
    const firstRef = useRef(null);
    const backRef = useRef(null);

    useEffect(() => {
      const tag = 'kodro-home-style';
      if (!document.getElementById(tag)) {
        const el = document.createElement('style');
        el.id = tag;
        el.textContent = CSS;
        document.head.appendChild(el);
      }
      // Focus the primary door so a keyboard user lands on the thing we most
      // want them to press, not on the page container.
      if (firstRef.current) firstRef.current.focus();
    }, []);

    useEffect(() => {
      function onKey(e) {
        if (e.key === 'Escape' && props.canClose && props.onClose) props.onClose();
        if (e.key !== 'Tab') return;
        // Contain focus: this covers the whole app, so Tab must not walk into
        // the studio behind it.
        const root = backRef.current;
        if (!root) return;
        const items = [...root.querySelectorAll('button')].filter((b) => !b.disabled);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [props.canClose, props.onClose]);

    const mark = window.KodroOrbitSvg || '';

    return (
      <div className="kh-back" ref={backRef} role="dialog" aria-modal="true" aria-label="Kodro home">
        <div className="kh-wrap">
          <div className="kh-brand">
            <span className="kh-brand-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: mark }} />
            <span className="kh-brand-name">Kodro</span>
          </div>

          <h1 className="kh-lede">Design a robot. Program it. Watch it work.</h1>
          <p className="kh-sub">
            Test a robot in a simulated world before you build it for real. Everything runs on this
            machine, offline, for free.
          </p>

          <div className="kh-cards">
            {DOORS.map((d, i) => (
              <button
                key={d.key}
                type="button"
                className="kh-card"
                ref={i === 0 ? firstRef : null}
                onClick={() => { const fn = props[d.handler]; if (fn) fn(); }}
              >
                <span className="kh-card-k">{d.kicker}</span>
                <span className="kh-card-t">{d.title}</span>
                <span className="kh-card-d">{d.desc}</span>
                <span className="kh-card-go" aria-hidden="true">{d.go} &rarr;</span>
              </button>
            ))}
          </div>

          <div className="kh-make">
            <p className="kh-make-h">Things people make with it</p>
            <ul className="kh-make-list">
              {MAKES.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </div>

          <div className="kh-foot">
            <span>Works offline. No account. Your work stays on this device.</span>
            {props.canClose && (
              <button type="button" className="kh-close" onClick={props.onClose}>
                Back to what I was doing
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  window.KodroHome = KodroHome;
})();
