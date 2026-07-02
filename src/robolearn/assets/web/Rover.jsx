/* ============================================================================
   KODRO — Rover render
   Top-down 4-wheel rover drawn in SVG. Points "up" (north) at heading 0.
   Wheels animate when moving; a headlight cone and status LED respond to state.
   Exposes window.Rover
   ========================================================================== */
(function () {
  function Wheel({ x, y, moving }) {
    return (
      <g transform={`translate(${x},${y})`}>
        <rect x="-7" y="-12" width="14" height="24" rx="4" fill="#1a1d2a" stroke="#000" strokeWidth="0.5" />
        <rect x="-7" y="-12" width="14" height="24" rx="4" fill="url(#tread)" opacity="0.9" />
        {moving && (
          <g opacity="0.5">
            <rect x="-4.5" y="-9" width="9" height="2" rx="1" fill="#5ce0d8" />
            <rect x="-4.5" y="0" width="9" height="2" rx="1" fill="#5ce0d8" />
            <rect x="-4.5" y="7" width="9" height="2" rx="1" fill="#5ce0d8" />
          </g>
        )}
      </g>
    );
  }

  function Rover({ moving, accent, led, scanning }) {
    const ledColor = led || accent || '#5ce0d8';
    return (
      <svg width="92" height="108" viewBox="-46 -54 92 108" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="tread" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2a2e3d" />
            <stop offset="0.5" stopColor="#0c0e16" />
            <stop offset="1" stopColor="#2a2e3d" />
          </linearGradient>
          <linearGradient id="chassis" x1="0" y1="-1" x2="0" y2="1">
            <stop offset="0" stopColor="#e8e2d2" />
            <stop offset="0.5" stopColor="#c7c0ad" />
            <stop offset="1" stopColor="#9d9684" />
          </linearGradient>
          <radialGradient id="beam" cx="0.5" cy="1" r="0.9">
            <stop offset="0" stopColor={ledColor} stopOpacity="0.55" />
            <stop offset="1" stopColor={ledColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* headlight beam (points up / forward) */}
        <path d="M-16 -22 L-30 -78 L30 -78 L16 -22 Z" fill="url(#beam)" opacity={scanning ? 0.95 : 0.7} />

        {/* shadow */}
        <ellipse cx="2" cy="6" rx="34" ry="40" fill="#000" opacity="0.32" />

        {/* wheels */}
        <Wheel x={-26} y={-22} moving={moving} />
        <Wheel x={26} y={-22} moving={moving} />
        <Wheel x={-26} y={22} moving={moving} />
        <Wheel x={26} y={22} moving={moving} />

        {/* chassis */}
        <rect x="-24" y="-34" width="48" height="68" rx="11" fill="url(#chassis)" stroke="#3a3528" strokeWidth="1.2" />
        {/* deck panel */}
        <rect x="-18" y="-26" width="36" height="52" rx="7" fill="#15171f" stroke="#3a3e4d" strokeWidth="0.8" />
        {/* solar grid lines */}
        <g stroke="#2b3550" strokeWidth="0.8" opacity="0.9">
          <line x1="-18" y1="-13" x2="18" y2="-13" />
          <line x1="-18" y1="0" x2="18" y2="0" />
          <line x1="-18" y1="13" x2="18" y2="13" />
          <line x1="-6" y1="-26" x2="-6" y2="26" />
          <line x1="6" y1="-26" x2="6" y2="26" />
        </g>
        {/* accent stripe */}
        <rect x="-24" y="-2.5" width="48" height="5" fill={accent} opacity="0.85" />

        {/* front sensor mast */}
        <circle cx="0" cy="-26" r="6.5" fill="#0c0e16" stroke={ledColor} strokeWidth="1.4" />
        <circle cx="0" cy="-26" r="2.6" fill={ledColor}>
          {scanning && <animate attributeName="opacity" values="1;0.3;1" dur="0.6s" repeatCount="indefinite" />}
        </circle>

        {/* rear status LED */}
        <circle cx="0" cy="28" r="3" fill={ledColor} opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* antenna */}
        <line x1="16" y1="-30" x2="24" y2="-42" stroke="#9d9684" strokeWidth="1.4" />
        <circle cx="24" cy="-42" r="2.4" fill={accent} />
      </svg>
    );
  }

  window.Rover = Rover;
})();
