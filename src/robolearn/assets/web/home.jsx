/* Kodro home.
 *
 * The front door answers what Kodro is, what to do first and what stays on the
 * device. It remains re-openable from the brand control in the studio.
 *
 * Exposes:
 * window.KodroHome({ onLessons, onDesign, onFreePlay, onAuthor, onClose, canClose })
 */
(function () {
  const { useEffect, useRef } = React;

  const CSS = `
.kh-back{
  position:fixed; inset:0; z-index:4300; overflow:auto;
  color:var(--fg-1); background:
    radial-gradient(circle at 84% 8%,color-mix(in srgb,var(--cyan) 13%,transparent),transparent 32%),
    radial-gradient(circle at 10% 88%,color-mix(in srgb,var(--brass) 8%,transparent),transparent 34%),
    var(--void);
}
.kh-back::before{
  content:''; position:fixed; inset:0; pointer-events:none; opacity:.34;
  background-image:
    linear-gradient(color-mix(in srgb,var(--fg-1) 5%,transparent) 1px,transparent 1px),
    linear-gradient(90deg,color-mix(in srgb,var(--fg-1) 5%,transparent) 1px,transparent 1px);
  background-size:48px 48px;
  mask-image:linear-gradient(120deg,#000,transparent 68%);
}
.kh-wrap{
  position:relative; width:min(1120px,100%); min-height:100%;
  margin:auto; padding:clamp(22px,4vw,48px);
  display:flex; flex-direction:column; justify-content:center;
}
.kh-top{
  display:flex; align-items:center; justify-content:space-between; gap:20px;
  margin-bottom:clamp(34px,6vh,68px);
}
.kh-brand{display:flex;align-items:center;gap:13px}
.kh-brand-mark{width:42px;height:42px;color:var(--cyan);flex:none}
.kh-brand-mark svg{display:block;width:100%;height:100%}
.kh-brand-mark .kh-mark-node{fill:var(--brass);stroke:var(--void);stroke-width:2}
.kh-brand-name{font:650 27px/1 var(--font-display);letter-spacing:-.02em;color:var(--fg-1)}
.kh-brand-tag{margin-top:3px;color:var(--fg-3);font:600 var(--text-xs)/1.2 var(--font-mono);letter-spacing:.12em;text-transform:uppercase}
.kh-promises{display:flex;align-items:center;gap:8px 18px;list-style:none;margin:0;padding:0;flex-wrap:wrap;justify-content:flex-end}
.kh-promises li{
  position:relative;padding-left:14px;color:var(--fg-2);
  font:600 var(--text-sm)/1.35 var(--font-mono);letter-spacing:.03em;
}
.kh-promises li::before{
  content:'';position:absolute;left:0;top:.42em;width:6px;height:6px;border-radius:50%;background:var(--cyan);
}
.kh-hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(260px,.85fr);gap:clamp(34px,7vw,86px);align-items:center}
.kh-copy{min-width:0}
.kh-eyebrow{
  display:flex;align-items:center;gap:10px;margin:0 0 15px;
  color:var(--cyan);font:700 var(--text-sm)/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;
}
.kh-eyebrow::before{content:'';width:30px;height:2px;background:currentColor}
.kh-lede{
  max-width:15ch;margin:0;color:var(--fg-1);
  font:650 clamp(44px,7.2vw,82px)/.97 var(--font-display);letter-spacing:-.035em;overflow-wrap:break-word;
}
.kh-lede em{font-style:normal;color:var(--cyan)}
.kh-sub{max-width:54ch;margin:22px 0 0;color:var(--fg-2);font-size:clamp(15px,1.7vw,18px);line-height:1.6}
.kh-sub strong{color:var(--fg-1)}
.kh-route{
  position:relative;aspect-ratio:1;border:1px solid var(--border);
  border-radius:38% 62% 58% 42% / 45% 36% 64% 55%;
  display:grid;place-items:center;background:
    radial-gradient(circle at 36% 32%,color-mix(in srgb,var(--cyan) 13%,var(--navy-2)),var(--navy) 64%);
  box-shadow:var(--shadow-modal);overflow:hidden;
}
.kh-route::before,.kh-route::after{content:'';position:absolute;border:1px solid var(--border);border-radius:50%}
.kh-route::before{inset:12%}
.kh-route::after{inset:27%;border-style:dashed}
.kh-route-mark{position:relative;z-index:1;width:54%;height:54%;color:var(--cyan)}
.kh-route-mark .kh-mark-node{fill:var(--brass);stroke:var(--navy);stroke-width:2}
.kh-route-note{
  position:absolute;left:12%;right:12%;bottom:9%;z-index:2;text-align:center;
  color:var(--fg-2);font:600 var(--text-xs)/1.4 var(--font-mono);letter-spacing:.05em;text-transform:uppercase;
}
.kh-choice-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:clamp(40px,7vh,72px) 0 14px}
.kh-choice-head h2{margin:0;color:var(--fg-1);font:650 clamp(22px,3vw,30px)/1.1 var(--font-display)}
.kh-choice-head p{margin:0;color:var(--fg-3);font-size:var(--text-md)}
.kh-cards{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
.kh-card{
  --door:var(--cyan);appearance:none;position:relative;grid-column:span 3;
  min-width:0;min-height:220px;padding:20px;overflow:hidden;
  display:flex;flex-direction:column;align-items:flex-start;gap:10px;text-align:left;
  border:1px solid var(--border);border-radius:var(--radius-xl);
  color:var(--fg-1);background:linear-gradient(155deg,color-mix(in srgb,var(--door) 7%,var(--navy-2)),var(--navy));
  box-shadow:var(--shadow-card);cursor:pointer;
  transition:transform 160ms var(--ease),border-color 160ms var(--ease),box-shadow 160ms var(--ease);
}
.kh-card::after{
  content:'';position:absolute;width:110px;height:110px;right:-42px;top:-46px;border-radius:50%;
  border:18px solid color-mix(in srgb,var(--door) 10%,transparent);pointer-events:none;
}
.kh-card:hover,.kh-card:focus-visible{transform:translateY(-3px);border-color:var(--door);box-shadow:var(--shadow-menu)}
.kh-card:focus-visible{outline:3px solid var(--cyan);outline-offset:3px}
.kh-card-primary{grid-column:span 3;--door:var(--cyan)}
.kh-card-design{--door:var(--brass)}
.kh-card-play{--door:var(--mars)}
.kh-card-author{grid-column:span 3;--door:var(--success)}
.kh-card-top{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px}
.kh-card-icon{
  width:42px;height:42px;display:grid;place-items:center;border-radius:50%;
  color:var(--door);background:color-mix(in srgb,var(--door) 10%,var(--void));border:1px solid color-mix(in srgb,var(--door) 34%,var(--border));
}
.kh-card-icon .ki{width:21px;height:21px;vertical-align:0}
.kh-card-k{color:var(--fg-3);font:700 var(--text-xs)/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase}
.kh-card-t{font:650 23px/1.1 var(--font-display);color:var(--fg-1)}
.kh-card-d{color:var(--fg-2);font-size:var(--text-lg);line-height:1.5}
.kh-card-go{margin-top:auto;color:var(--door);font:700 var(--text-sm)/1.3 var(--font-mono)}
.kh-foot{
  display:flex;align-items:center;justify-content:space-between;gap:18px;
  margin-top:20px;color:var(--fg-3);font-size:var(--text-md);
}
.kh-close{
  appearance:none;min-height:38px;padding:7px 13px;border:1px solid var(--border);border-radius:var(--radius-md);
  color:var(--fg-2);background:var(--navy);font:600 var(--text-md)/1.2 var(--font-body);cursor:pointer;
}
.kh-close:hover{color:var(--fg-1);border-color:var(--fg-3)}
@media (max-width:900px){
  .kh-hero{grid-template-columns:1fr}.kh-route{display:none}
  .kh-card,.kh-card-primary{grid-column:span 6}.kh-card-author{grid-column:span 12;min-height:170px}
}
@media (max-width:600px){
  .kh-wrap{justify-content:flex-start}.kh-top{align-items:flex-start;margin-bottom:34px}
  .kh-promises{display:none}.kh-lede{max-width:100%;font-size:clamp(38px,11vw,52px)}
  .kh-choice-head{align-items:flex-start;flex-direction:column;margin-top:38px}
  .kh-card,.kh-card-primary,.kh-card-author{grid-column:1 / -1;min-height:190px}
  .kh-foot{align-items:flex-start;flex-direction:column}
  .kh-close{width:100%}
}
@media (max-width:360px){
  .kh-wrap{padding:18px}.kh-brand-tag{display:none}.kh-card{padding:17px}
}
@media (prefers-reduced-motion:reduce){
  .kh-card{transition:none}.kh-card:hover,.kh-card:focus-visible{transform:none}
}
`;

  const DOORS = [
    {
      key: 'lessons',
      kicker: 'Start here',
      title: 'Learn to code',
      desc: 'Follow 24 guided lessons with a working program, a clear goal and feedback after every run.',
      go: 'Open the lessons',
      icon: 'report',
      className: 'kh-card-primary',
      handler: 'onLessons',
    },
    {
      key: 'design',
      kicker: 'Build',
      title: 'Design a robot',
      desc: 'Choose real hobby parts and compare the speed, range and stopping distance of your design.',
      go: 'Open Robot Lab',
      icon: 'rover',
      className: 'kh-card-design',
      handler: 'onDesign',
    },
    {
      key: 'play',
      kicker: 'Explore',
      title: 'Free play',
      desc: 'Write Python and drive through a city, a room, Mars, deep water or space with nothing to pass.',
      go: 'Open the studio',
      icon: 'orbit',
      className: 'kh-card-play',
      handler: 'onFreePlay',
    },
    {
      key: 'author',
      kicker: 'Teach',
      title: 'Make a lesson',
      desc: 'Draw an arena, set the goal and save one lesson file to share.',
      go: 'Open Lesson Studio',
      icon: 'blocks',
      className: 'kh-card-author',
      handler: 'onAuthor',
    },
  ];

  function BrandMark({ className }) {
    return (
      <svg className={className || ''} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
        <path d="M18 8v48M19 32 49 9M20 32c11 0 15 17 31 24" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <circle className="kh-mark-node" cx="20" cy="32" r="4.8" />
        <circle cx="49" cy="9" r="2.4" fill="currentColor" />
        <circle cx="51" cy="56" r="2.4" fill="currentColor" />
      </svg>
    );
  }

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
      if (firstRef.current) firstRef.current.focus();
    }, []);

    useEffect(() => {
      function onKey(e) {
        if (e.key === 'Escape' && props.canClose && props.onClose) props.onClose();
        if (e.key !== 'Tab') return;
        const root = backRef.current;
        if (!root) return;
        const items = [...root.querySelectorAll('button')].filter((b) => !b.disabled);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [props.canClose, props.onClose]);

    const icon = (name) => (window.KodroIcons ? window.KodroIcons.el(name) : null);

    return (
      <div className="kh-back" ref={backRef} role="dialog" aria-modal="true" aria-label="Kodro home">
        <div className="kh-wrap">
          <header className="kh-top">
            <div className="kh-brand" aria-label="Kodro">
              <BrandMark className="kh-brand-mark" />
              <div>
                <div className="kh-brand-name">Kodro</div>
                <div className="kh-brand-tag">Robot design and coding</div>
              </div>
            </div>
            <ul className="kh-promises" aria-label="Privacy and access">
              <li>Works offline</li>
              <li>No account</li>
              <li>Work stays here</li>
            </ul>
          </header>

          <main>
            <section className="kh-hero" aria-labelledby="kh-title">
              <div className="kh-copy">
                <p className="kh-eyebrow">Make code move</p>
                <h1 className="kh-lede" id="kh-title">
                  Design a robot. <em>Program it.</em> Watch it work.
                </h1>
                <p className="kh-sub">
                  Build from real hobby parts, write Python and test the result in a simulated world.
                  <strong> Everything runs on this machine, for free.</strong>
                </p>
              </div>
              <div className="kh-route" aria-hidden="true">
                <BrandMark className="kh-route-mark" />
                <span className="kh-route-note">Your idea becomes a route</span>
              </div>
            </section>

            <div className="kh-choice-head">
              <h2>What would you like to do?</h2>
              <p>New to Kodro? Choose Learn to code.</p>
            </div>

            <div className="kh-cards">
              {DOORS.map((door, index) => (
                <button
                  key={door.key}
                  type="button"
                  className={'kh-card ' + door.className}
                  ref={index === 0 ? firstRef : null}
                  onClick={() => {
                    const fn = props[door.handler];
                    if (fn) fn();
                  }}
                >
                  <span className="kh-card-top">
                    <span className="kh-card-icon" aria-hidden="true">{icon(door.icon)}</span>
                    <span className="kh-card-k">{door.kicker}</span>
                  </span>
                  <span className="kh-card-t">{door.title}</span>
                  <span className="kh-card-d">{door.desc}</span>
                  <span className="kh-card-go" aria-hidden="true">{door.go} &rarr;</span>
                </button>
              ))}
            </div>
          </main>

          <footer className="kh-foot">
            <span>Kodro supports learning and early design comparison. It does not certify a physical robot.</span>
            {props.canClose && (
              <button type="button" className="kh-close" onClick={props.onClose}>
                Back to what I was doing
              </button>
            )}
          </footer>
        </div>
      </div>
    );
  }

  window.KodroHome = KodroHome;
})();
