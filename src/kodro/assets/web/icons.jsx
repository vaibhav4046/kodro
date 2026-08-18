/* Kodro icon family.
 *
 * Every glyph uses the same 24 by 24 grid, 1.75 px rounded stroke, 2 px
 * optical margin and 2 px rectangular corner radius. Small solid circles are
 * route or sensor nodes, borrowed from the Kodro mark. The icons are
 * currentColor, dependency-free and remain legible at the 16 px UI size.
 */
(function () {
  const S = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  const PATHS = {
    lab: () => (
      <g>
        <path d="M20.2 5.2a4.7 4.7 0 0 1-6.1 5.9l-7.5 7.5a2 2 0 1 1-2.8-2.8l7.5-7.5a4.7 4.7 0 0 1 5.9-6.1l-2.8 2.8.7 2.8 2.8.7 2.3-3.3z" />
        <circle cx="5.3" cy="17.1" r="1" fill="currentColor" stroke="none" />
      </g>
    ),
    memory: () => (
      <g>
        <path d="m12 3 9 4.8-9 4.8-9-4.8L12 3z" />
        <path d="m3 12 9 4.8 9-4.8M3 16.2 12 21l9-4.8" />
      </g>
    ),
    build: () => (
      <g>
        <path d="m12 2.8 8 4.5v9.4l-8 4.5-8-4.5V7.3l8-4.5z" />
        <path d="m4 7.3 8 4.5 8-4.5M12 11.8v9.4" />
        <circle cx="12" cy="11.8" r="1.3" fill="currentColor" stroke="none" />
      </g>
    ),
    gear: () => (
      <g>
        <circle cx="12" cy="12" r="3.4" />
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6" />
      </g>
    ),
    vibe: () => (
      <g>
        <path d="m10.5 2.8 1.8 5.1 5.1 1.8-5.1 1.8-1.8 5.1-1.8-5.1-5.1-1.8 5.1-1.8 1.8-5.1z" />
        <path d="m18.2 15.1.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />
      </g>
    ),
    blocks: () => (
      <g>
        <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
        <path d="M17.25 13.5V21M13.5 17.25H21" />
      </g>
    ),
    review: () => (
      <g>
        <path d="M6 3h9l3 3v15H6V3zM15 3v3h3" />
        <path d="m9 13 2 2 4-4" />
      </g>
    ),
    target: () => (
      <g>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </g>
    ),
    gauge: () => (
      <g>
        <path d="M3.5 17a9 9 0 1 1 17 0" />
        <path d="m12 16.5 4-6" />
        <circle cx="12" cy="16.5" r="1.5" fill="currentColor" stroke="none" />
      </g>
    ),
    demo: () => (
      <g>
        <rect x="2.8" y="4" width="18.4" height="16" rx="2" />
        <path d="m10 8 6 4-6 4V8z" fill="currentColor" stroke="none" />
      </g>
    ),
    ask: () => (
      <g>
        <path d="M4 4h16v12H9l-5 4V4z" />
        <path d="M9.5 8.4a2.6 2.6 0 1 1 3.5 2.4c-.7.3-1 .8-1 1.5" />
        <circle cx="12" cy="14.5" r="1" fill="currentColor" stroke="none" />
      </g>
    ),
    swarm: () => (
      <g>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="12" cy="18" r="2.5" />
        <path d="M8.5 6h7M7.2 8.2l3.6 7.6M16.8 8.2l-3.6 7.6" />
      </g>
    ),
    eye: () => (
      <g>
        <path d="M2.5 12S6.2 6 12 6s9.5 6 9.5 6-3.7 6-9.5 6-9.5-6-9.5-6z" />
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      </g>
    ),
    orbit: () => (
      <g>
        <path d="M6 3v18M6 12l12-9M6 12c5 0 6.5 6 12 9" />
        <circle cx="6" cy="12" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="18" cy="3" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="18" cy="21" r="1.2" fill="currentColor" stroke="none" />
      </g>
    ),
    camera: () => (
      <g>
        <rect x="2.8" y="6.5" width="18.4" height="14" rx="2" />
        <circle cx="12" cy="13.5" r="3.8" />
        <path d="m8 6.5 1.5-3h5l1.5 3" />
        <circle cx="18" cy="9.5" r="1" fill="currentColor" stroke="none" />
      </g>
    ),
    report: () => (
      <g>
        <path d="M6 3h9l3 3v15H6V3zM15 3v3h3" />
        <path d="M9 11h6M9 15h6M9 19h4" />
      </g>
    ),
    save: () => (
      <g>
        <path d="M12 3v11M8 10l4 4 4-4" />
        <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </g>
    ),
    open: () => (
      <g>
        <path d="M3 9V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1" />
        <path d="M3 9h18l-2 10a2 2 0 0 1-2 1.5H7A2 2 0 0 1 5 19L3 9z" />
      </g>
    ),
    bulb: () => (
      <g>
        <path d="M12 3a6.5 6.5 0 0 1 4 11.6c-.8.6-1.2 1.4-1.2 2.4H9.2c0-1-.4-1.8-1.2-2.4A6.5 6.5 0 0 1 12 3z" />
        <path d="M9.5 20h5M10.5 22h3" />
      </g>
    ),
    rover: () => (
      <g>
        <rect x="3" y="9" width="18" height="7" rx="2" />
        <circle cx="7.5" cy="18.5" r="2.5" />
        <circle cx="16.5" cy="18.5" r="2.5" />
        <path d="M8 9V6h4v3M10 6V3" />
        <circle cx="10" cy="3" r="1.2" fill="currentColor" stroke="none" />
      </g>
    ),
    car: () => (
      <g>
        <path d="M3 16v-3l2-5h14l2 5v3M3 13h18" />
        <circle cx="7" cy="18" r="2.5" />
        <circle cx="17" cy="18" r="2.5" />
        <path d="m7 8 1.5-3h7L17 8" />
      </g>
    ),
    home: () => (
      <g>
        <rect x="4" y="7" width="16" height="12" rx="2" />
        <path d="M12 7V3" />
        <circle cx="12" cy="3" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <path d="M9.5 16h5" />
      </g>
    ),
    arm: () => (
      <g>
        <path d="M3 21h10M8 21v-4l4-8" />
        <circle cx="12.5" cy="8" r="2" />
        <path d="m14.2 9 5 2.5M19.2 11.5 22 10M19.2 11.5l1 3" />
      </g>
    ),
    custom: () => (
      <g>
        <path d="M3 6h18M3 12h18M3 18h18" />
        <circle cx="8" cy="6" r="2" fill="var(--void,#09111d)" />
        <circle cx="16" cy="12" r="2" fill="var(--void,#09111d)" />
        <circle cx="10" cy="18" r="2" fill="var(--void,#09111d)" />
      </g>
    ),
    shield: () => (
      <g>
        <path d="m12 3 7 2.7v5.6c0 4.3-2.9 7.6-7 9.7-4.1-2.1-7-5.4-7-9.7V5.7L12 3z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </g>
    ),
  };

  function el(name, cls) {
    const body = PATHS[name];
    if (!body) return null;
    return (
      <svg
        className={'ki' + (cls ? ' ' + cls : '')}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        {...S}
      >
        {body()}
      </svg>
    );
  }

  window.KodroIcons = {
    el: el,
    has: function (name) { return !!PATHS[name]; },
    NAMES: Object.keys(PATHS),
  };
})();
