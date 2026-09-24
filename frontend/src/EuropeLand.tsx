import { MAP_BOUNDS, project } from './projection'

type LonLat = [number, number]

// Very rough flat land shapes as [longitude, latitude] points. Placeholder
// art until the real illustrated map arrives.
const LAND: LonLat[][] = [
  // Mainland Europe: Iberia, France, Germany, Baltics, Turkey, Balkans, Italy
  [
    [-9, 43],
    [-2, 43.5],
    [-1.5, 46],
    [-4.5, 48.5],
    [-1.5, 49.7],
    [2, 51],
    [4, 52],
    [7, 53.5],
    [8.5, 55],
    [10, 57.5],
    [11, 54],
    [14, 54.3],
    [21, 55],
    [21, 57],
    [24, 57.5],
    [24, 59.5],
    [28, 60],
    [40, 64],
    [40, 36.5],
    [36, 36.5],
    [28, 36.8],
    [26, 38.5],
    [24, 38],
    [22, 36.5],
    [21, 39],
    [19.5, 41.5],
    [15, 44.5],
    [13.6, 45.6],
    [12.3, 44.2],
    [14, 42],
    [18.5, 40.2],
    [16, 38],
    [15.6, 40],
    [12, 42],
    [10.2, 43.8],
    [8, 44],
    [7.5, 43.8],
    [3, 43.2],
    [3, 42.4],
    [0, 40],
    [0, 38.7],
    [-2, 36.7],
    [-5.5, 36.1],
    [-9, 37],
    [-9, 39],
  ],
  // Scandinavia
  [
    [5.5, 58.5],
    [8, 58],
    [11, 59],
    [12.5, 56],
    [14.5, 56],
    [16.5, 57],
    [18.5, 60],
    [17, 61],
    [21.5, 64],
    [4, 64],
    [5, 62],
  ],
  // Great Britain
  [
    [-5.5, 50],
    [1.5, 51],
    [1.7, 52.8],
    [-0.5, 54.5],
    [-2, 56],
    [-2, 57.6],
    [-3.5, 58.6],
    [-5, 58.5],
    [-6, 56.5],
    [-5, 55],
    [-3, 54.8],
    [-3, 53.3],
    [-4.5, 53.3],
    [-5.2, 51.7],
    [-3.5, 51.2],
  ],
  // Ireland
  [
    [-10, 51.5],
    [-6, 52],
    [-6, 54.5],
    [-8, 55.3],
    [-10, 54],
  ],
  // North Africa
  [
    [-6, 35.8],
    [-2, 35.1],
    [3, 36.8],
    [10, 37.3],
    [11, 34],
    [-6, 34],
  ],
]

// Graticule every 10 degrees.
const step = 10
const lons: number[] = []
for (
  let l = Math.ceil(MAP_BOUNDS.west / step) * step;
  l < MAP_BOUNDS.east;
  l += step
)
  lons.push(l)
const lats: number[] = []
for (
  let l = Math.ceil(MAP_BOUNDS.south / step) * step;
  l < MAP_BOUNDS.north;
  l += step
)
  lats.push(l)

const points = (shape: LonLat[]) =>
  shape
    .map(([lon, lat]) => {
      const { x, y } = project(lat, lon)
      return `${x},${y}`
    })
    .join(' ')

// Same coordinate system as the flight dots: a 0-100 box stretched over the map.
export function EuropeLand() {
  return (
    <svg
      className="land"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
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
      {LAND.map((shape, i) => (
        <polygon key={i} points={points(shape)} />
      ))}
    </svg>
  )
}
