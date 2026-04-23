/**
 * Atmosphere — global ambient layers for Warm Paper Studio.
 *
 * Renders:
 *   - full-screen paper grain (SVG turbulence, multiplied over bg)
 *   - soft vignette for canvas mood
 *   - shared SVG <defs> (ink-wobble turbulence filter) usable by all SVG
 *     overlays (connections, selection box, NodeInputBar anchor line…).
 *
 * Mounted once at <App> root. Keep z-index below canvas chrome.
 */
export function Atmosphere() {
  return (
    <>
      {/* Shared SVG defs — zero-size host so filters are reachable globally */}
      <svg
        aria-hidden="true"
        className="pointer-events-none"
        width="0"
        height="0"
        style={{ position: 'fixed', inset: 0 }}
      >
        <defs>
          {/* Hand-drawn wobble — apply via filter="url(#ink-wobble)" */}
          <filter id="ink-wobble" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.02" numOctaves="2" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="1.6" />
          </filter>
          {/* Stronger wobble for selection frames */}
          <filter id="ink-wobble-strong" x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03 0.03" numOctaves="2" seed="4" />
            <feDisplacementMap in="SourceGraphic" scale="2.4" />
          </filter>
        </defs>
      </svg>

      {/* Paper grain — SVG turbulence tile */}
      <svg
        aria-hidden="true"
        className="paper-grain"
        preserveAspectRatio="none"
      >
        <filter id="paper-grain-filter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            seed="3"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.25
                    0 0 0 0 0.20
                    0 0 0 0 0.15
                    0 0 0 1.6 0"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#paper-grain-filter)" />
      </svg>

      {/* Vignette — keeps edges quiet, centers attention */}
      <div aria-hidden="true" className="vignette" />
    </>
  );
}
