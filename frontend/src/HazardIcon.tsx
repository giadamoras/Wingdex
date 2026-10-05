import type { ReactNode } from 'react'
import type { Hazard } from './types'

// One small glyph per hazard, drawn in a 24 x 24 box inside a round sticker
// (see .weather-icon in index.css, which colours the sticker per hazard).
// Chunky strokes and fills, like the plane silhouettes.
const GLYPHS: Record<Hazard, ReactNode> = {
  // Cloud with a bolt.
  thunderstorm: (
    <>
      <path d="M7 14.5a3.2 3.2 0 0 1-.3-6.4 4.6 4.6 0 0 1 8.8-.9 3.6 3.6 0 0 1-.5 7.3z" />
      <path
        className="accent"
        d="M12.8 12.5 9.5 17.5h2.6l-1 4.5 4.2-6h-2.6l1.2-3.5z"
      />
    </>
  ),
  // Three wavy lines: bumpy air.
  turbulence: (
    <>
      <path className="line" d="M3 8q2.25-3 4.5 0t4.5 0 4.5 0 4.5 0" />
      <path className="line" d="M3 12q2.25-3 4.5 0t4.5 0 4.5 0 4.5 0" />
      <path className="line" d="M3 16q2.25-3 4.5 0t4.5 0 4.5 0 4.5 0" />
    </>
  ),
  // A mountain with a wave of air rippling over it.
  mountain_wave: (
    <>
      <path d="M3 20 9.5 11l4 5.5 2.5-3L21 20z" />
      <path className="line" d="M3 7q2.25-3 4.5 0t4.5 0 4.5 0 4.5 0" />
    </>
  ),
  // Snowflake.
  icing: (
    <>
      <path className="line" d="M12 4v16M5.1 8l13.8 8M5.1 16l13.8-8" />
    </>
  ),
  // Volcano with an ash cloud.
  volcanic_ash: (
    <>
      <path d="M4 20 9.5 10h5L20 20z" />
      <circle cx="12" cy="6.5" r="2.2" />
      <circle cx="15.2" cy="5" r="1.8" />
      <circle cx="8.8" cy="5.2" r="1.6" />
    </>
  ),
  // Pinwheel: two curved arms around an eye.
  tropical_cyclone: (
    <>
      <path className="line" d="M12 10C12 6 16 4 19 6" />
      <path className="line" d="M12 14c0 4-4 6-7 4" />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
}

export function HazardIcon({ hazard }: { hazard: Hazard }) {
  return (
    <svg className="hazard-icon" viewBox="0 0 24 24" aria-hidden="true">
      {GLYPHS[hazard]}
    </svg>
  )
}
