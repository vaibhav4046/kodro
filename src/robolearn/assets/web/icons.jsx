/* Kodro procedural icon set (PERFECTION_PLAN P7/A2).
 *
 * One sprite module of monochrome, currentColor SVG icons in the same visual
 * language as the brand mark (ORBIT_SVG) and the run-control glyphs in
 * app.jsx: 24x24 viewBox, 1.7px rounded strokes, no fills except small solid
 * nodes. These replace every emoji-as-icon in the chrome (mission bar, editor
 * toolbar, modal titles, robot tiles, view toggle), because an emoji icon
 * system reads as a toy and renders differently on every OS. Zero assets,
 * zero fonts: each icon is a handful of primitives, built offline.
 *
 *   window.KodroIcons.el('lab')            -> React <svg> element
 *   window.KodroIcons.el('lab', 'my-cls')  -> with an extra class
 *   window.KodroIcons.has('lab')           -> registry check
 *
 * Icons render at text size via the .ki class (styles.css); surfaces that
 * need a larger mark (robot tiles, the onboarding badge) size .ki locally.
 */
(function () {
  const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };

  // Each entry is a function returning the icon's inner primitives, so the
  // shared <svg> wrapper below stays in one place.
  const PATHS = {
    // -- tools / chrome -------------------------------------------------------
    lab: () => (
      <path d="M20.7 6.8a5 5 0 0 1-6.4 4.6L7 18.7a2.05 2.05 0 0 1-2.9-2.9l7.3-7.3a5 5 0 0 1 5.8-6.2L14.6 4.9l.6 2.6 2.6.6 2.6-2.6a5 5 0 0 1 .3 1.3z" />
    ),
    memory: () => (
      <g>
        <path d="M12 3 3.5 7.8 12 12.6l8.5-4.8L12 3z" />
        <path d="M3.5 12.2 12 17l8.5-4.8" />
        <path d="M3.5 16.4 12 21.2l8.5-4.8" />
      </g>
    ),
    build: () => (
      <g>
        <path d="M12 2.8 4.2 7.2v9.6l7.8 4.4 7.8-4.4V7.2L12 2.8z" />
        <path d="M4.2 7.2 12 11.6l7.8-4.4" />
        <path d="M12 11.6v9.6" />
      </g>
    ),
    gear: () => (
      <g>
        <circle cx="12" cy="12" r="3.1" />
        <path d="M12 2.6v2.9M12 18.5v2.9M2.6 12h2.9M18.5 12h2.9M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
      </g>
    ),
    vibe: () => (
      <g>
        <path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7L11 3.5z" />
        <path d="M18.3 14.6l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4z" />
      </g>
    ),
    blocks: () => (
      <g>
        <rect x="3.6" y="3.6" width="7" height="7" rx="1.2" />
        <rect x="13.4" y="3.6" width="7" height="7" rx="1.2" />
        <rect x="3.6" y="13.4" width="7" height="7" rx="1.2" />
        <path d="M16.9 13.6v6.6M13.6 16.9h6.6" />
      </g>
    ),
    review: () => (
      <g>
        <circle cx="10.5" cy="10.5" r="5.8" />
        <path d="M15 15l6 6" />
      </g>
    ),
    target: () => (
      <g>
        <circle cx="12" cy="12" r="8.4" />
        <circle cx="12" cy="12" r="4.4" />
        <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      </g>
    ),
    gauge: () => (
      <g>
        <path d="M4.2 16.8a8.6 8.6 0 1 1 15.6 0" />
        <path d="M12 16.2l3.6-5.2" />
        <circle cx="12" cy="16.6" r="1.2" fill="currentColor" stroke="none" />
      </g>
    ),
    demo: () => (
      <g>
        <circle cx="12" cy="12" r="8.8" />
        <path d="M10.2 8.6v6.8l5.6-3.4z" fill="currentColor" stroke="none" />
      </g>
    ),
    ask: () => (
      <g>
        <path d="M4 6a2.4 2.4 0 0 1 2.4-2.4h11.2A2.4 2.4 0 0 1 20 6v7.4a2.4 2.4 0 0 1-2.4 2.4h-5.8L7.5 19.9v-4.1H6.4A2.4 2.4 0 0 1 4 13.4V6z" />
        <path d="M10.3 7.9a1.9 1.9 0 1 1 2.6 2.3c-.7.4-.9.8-.9 1.6" />
        <circle cx="12" cy="13.6" r="0.9" fill="currentColor" stroke="none" />
      </g>
    ),
    swarm: () => (
      <g>
        <circle cx="6.4" cy="7" r="2.1" />
        <circle cx="17.6" cy="7" r="2.1" />
        <circle cx="12" cy="16.8" r="2.1" />
        <path d="M8.5 7h7M7.4 8.9l3.5 6M16.6 8.9l-3.5 6" />
      </g>
    ),
    eye: () => (
      <g>
        <path d="M2.6 12S6.2 5.8 12 5.8 21.4 12 21.4 12 17.8 18.2 12 18.2 2.6 12 2.6 12z" />
        <circle cx="12" cy="12" r="2.7" />
      </g>
    ),
    orbit: () => (
      <g>
        <circle cx="12" cy="12" r="8.4" opacity="0.5" />
        <circle cx="12" cy="12" r="4.4" opacity="0.85" />
        <circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />
        <circle cx="12" cy="3.6" r="1.7" fill="currentColor" stroke="none" />
      </g>
    ),
    camera: () => (
      <g>
        <rect x="3.2" y="7" width="17.6" height="12.6" rx="2" />
        <circle cx="12" cy="13.2" r="3.4" />
        <path d="M8.4 7l1.5-2.6h4.2L15.6 7" />
      </g>
    ),
    report: () => (
      <g>
        <path d="M6.2 3h7.6l4 4v14H6.2V3z" />
        <path d="M13.8 3v4h4" />
        <path d="M9 12.4h6M9 16.2h6" />
      </g>
    ),
    // save / open: the project-file download and load-from-disk glyphs. The
    // Save/Open buttons that consume these live in app.jsx (saveProjectClick /
    // openProjectClick); they currently render without an icon. Kept registered
    // so that wiring is a one-line KI('save')/KI('open') on the app.jsx side.
    save: () => (
      <g>
        <path d="M12 3.2v10.2M8.2 9.6l3.8 3.8 3.8-3.8" />
        <path d="M4.2 15v3.6a2.2 2.2 0 0 0 2.2 2.2h11.2a2.2 2.2 0 0 0 2.2-2.2V15" />
      </g>
    ),
    open: () => (
      <g>
        <path d="M3.4 8.4V6.2A1.8 1.8 0 0 1 5.2 4.4h4l2 2.2h7.6a1.8 1.8 0 0 1 1.8 1.8v1.4" />
        <path d="M2.8 9.8h18.4l-1.8 8.4a1.8 1.8 0 0 1-1.8 1.4H6.4a1.8 1.8 0 0 1-1.8-1.4L2.8 9.8z" />
      </g>
    ),
    bulb: () => (
      <g>
        <path d="M12 3a6 6 0 0 1 3.6 10.8c-.7.6-1.1 1.3-1.1 2.2h-5c0-.9-.4-1.6-1.1-2.2A6 6 0 0 1 12 3z" />
        <path d="M9.6 19h4.8M10.4 21.4h3.2" />
      </g>
    ),
    // -- robot archetypes -----------------------------------------------------
    rover: () => (
      <g>
        <rect x="3.4" y="9.6" width="17.2" height="5.6" rx="1.4" />
        <circle cx="7.6" cy="17.6" r="2.2" />
        <circle cx="16.4" cy="17.6" r="2.2" />
        <path d="M8.4 9.6V6.4h3.2v3.2" />
        <circle cx="10" cy="4.8" r="1" fill="currentColor" stroke="none" />
      </g>
    ),
    car: () => (
      <g>
        <path d="M4 16.2v-2.6l1.3-4A2 2 0 0 1 7.2 8.2h9.6a2 2 0 0 1 1.9 1.4l1.3 4v2.6" />
        <path d="M4 13.6h16" />
        <circle cx="7.6" cy="17.4" r="1.9" />
        <circle cx="16.4" cy="17.4" r="1.9" />
      </g>
    ),
    home: () => (
      <g>
        <rect x="5" y="7.2" width="14" height="11" rx="2.4" />
        <circle cx="9.6" cy="12.4" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="14.4" cy="12.4" r="1.2" fill="currentColor" stroke="none" />
        <path d="M12 7.2V4.2M9.8 15.4h4.4" />
        <circle cx="12" cy="3.2" r="1" fill="currentColor" stroke="none" />
      </g>
    ),
    arm: () => (
      <g>
        <path d="M4.6 20.4h8.8M9 20.4v-3.6" />
        <path d="M9 16.8l3.4-7.2" />
        <circle cx="12.6" cy="9.2" r="1.5" />
        <path d="M14 9.7l4.4 2.1" />
        <path d="M18.4 11.8l2.4-1.4M18.4 11.8l1 2.6" />
      </g>
    ),
    custom: () => (
      <g>
        <path d="M4.6 6.4h14.8M4.6 12h14.8M4.6 17.6h14.8" />
        <circle cx="9.4" cy="6.4" r="1.9" fill="var(--void,#08090f)" />
        <circle cx="15" cy="12" r="1.9" fill="var(--void,#08090f)" />
        <circle cx="7.4" cy="17.6" r="1.9" fill="var(--void,#08090f)" />
      </g>
    ),
  };

  function el(name, cls) {
    const body = PATHS[name];
    if (!body) return null;
    return (
      <svg className={'ki' + (cls ? ' ' + cls : '')} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...S}>
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
