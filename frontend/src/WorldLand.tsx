import { MAP_BOUNDS, project } from './projection'
import { WORLD_LAND } from './worldLandData'

// Graticule every 30 degrees (denser lines clutter the world view).
const step = 30
const lons: number[] = []
for (
  let l = Math.ceil(MAP_BOUNDS.west / step) * step + step;
  l < MAP_BOUNDS.east;
  l += step
)
  lons.push(l)
const lats: number[] = []
for (
  let l = Math.ceil(MAP_BOUNDS.south / step) * step + step;
  l < MAP_BOUNDS.north;
  l += step
)
  lats.push(l)

// Polygon points are computed once: the coastlines never change.
const shapes = WORLD_LAND.map((ring) =>
  ring
    .map(([lon, lat]) => {
      const { x, y } = project(lat, lon)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' '),
)

// The real geography (Natural Earth coastlines), rendered with a poster-style
// illustrated fill instead of a flat colour. Same coordinate system as the
// planes: a 0-100 box stretched over the map.
export function WorldLand() {
  return (
    <svg
      className="land"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {/* One light-to-dark gradient across the whole map (userSpaceOnUse,
            not each polygon's own box), like a poster print lit from the
            north. Stops are colour-mixed from --land, so a time-of-day
            palette swap (see [data-map-time] in index.css) carries through
            automatically. */}
        <linearGradient
          id="landFill"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="0"
          y2="100"
        >
          <stop
            offset="0%"
            style={{ stopColor: 'color-mix(in srgb, var(--land), white 25%)' }}
          />
          <stop offset="55%" style={{ stopColor: 'var(--land)' }} />
          <stop
            offset="100%"
            style={{ stopColor: 'color-mix(in srgb, var(--land), black 12%)' }}
          />
        </linearGradient>
      </defs>
      {lons.map((lon) => (
        <line
          key={`lon${lon}`}
          className="grid"
          x1={project(0, lon).x}
          x2={project(0, lon).x}
          y1="0"
          y2="100"
        />
      ))}
      {lats.map((lat) => (
        <line
          key={`lat${lat}`}
          className="grid"
          x1="0"
          x2="100"
          y1={project(lat, 0).y}
          y2={project(lat, 0).y}
        />
      ))}
      {shapes.map((points, i) => (
        <polygon key={i} points={points} />
      ))}
    </svg>
  )
}
