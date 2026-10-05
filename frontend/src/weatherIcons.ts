import { inRing } from './attributes'
import { project } from './projection'
import type { Hazard, LatLon, WeatherArea } from './types'

export const HAZARD_NAMES: Record<Hazard, string> = {
  thunderstorm: 'Thunderstorm',
  turbulence: 'Turbulence',
  mountain_wave: 'Mountain wave',
  icing: 'Icing',
  volcanic_ash: 'Volcanic ash',
  tropical_cyclone: 'Tropical cyclone',
}

// What an area is called in its label, e.g. "Severe thunderstorm" or
// "Tropical cyclone (Koguma)". Severity and name exist for live data only.
export function hazardTitle(area: WeatherArea): string {
  const hazard = HAZARD_NAMES[area.hazard]
  const base = area.severity
    ? `${area.severity} ${hazard.toLowerCase()}`
    : hazard
  return area.name ? `${base} (${area.name})` : base
}

// Most icons one area gets, however big it looks.
export const MAX_ICONS = 4
// Roughly one icon per this many screen pixels of the area's longest side.
const ICON_SPACING_PX = 50
// Screen pixels per percent of the world box's width at zoom 1. The map is at
// most about 1000 px wide (see `main` in index.css), so this is an estimate;
// the exact width only shifts when icons are added, never where they sit.
const PX_PER_WORLD_PCT = 10
// The box is 360 x 140 degrees, so 1% of its height is shorter on screen than
// 1% of its width.
const HEIGHT_PER_WIDTH = 140 / 360
// Candidate positions are a GRID x GRID lattice over the polygon's bounds.
const GRID = 9

interface Spot {
  point: LatLon
  x: number // projected, percent of the world box
  y: number
}

const spotOf = (point: LatLon): Spot => ({
  point,
  ...project(point.latitude, point.longitude),
})

// Lattice points that lie inside the polygon. Checking each one (instead of
// using the polygon's centre) keeps icons inside concave shapes, where the
// centre can fall outside the hazard.
function interiorSpots(polygon: LatLon[]): Spot[] {
  const ring = polygon.map((p): [number, number] => [p.longitude, p.latitude])
  const lats = polygon.map((p) => p.latitude)
  const lons = polygon.map((p) => p.longitude)
  const south = Math.min(...lats)
  const west = Math.min(...lons)
  const dLat = Math.max(...lats) - south
  const dLon = Math.max(...lons) - west

  const spots: Spot[] = []
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const latitude = south + ((i + 0.5) / GRID) * dLat
      const longitude = west + ((j + 0.5) / GRID) * dLon
      if (inRing(latitude, longitude, ring))
        spots.push(spotOf({ latitude, longitude }))
    }
  }
  // A sliver too thin for the lattice: fall back to the corners' average.
  if (spots.length === 0)
    spots.push(
      spotOf({
        latitude: lats.reduce((a, b) => a + b) / lats.length,
        longitude: lons.reduce((a, b) => a + b) / lons.length,
      }),
    )
  return spots
}

const gap = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y)

// Up to MAX_ICONS positions inside the area, best first: the most central
// spot, then each next one as far as possible from those already chosen. The
// order never depends on zoom, so zooming in only adds icons and never moves
// the ones already there.
export function iconOrder(area: WeatherArea): LatLon[] {
  const spots = interiorSpots(area.polygon)
  const mean = {
    point: spots[0].point,
    x: spots.reduce((s, p) => s + p.x, 0) / spots.length,
    y: spots.reduce((s, p) => s + p.y, 0) / spots.length,
  }

  let first = spots[0]
  for (const s of spots) if (gap(s, mean) < gap(first, mean)) first = s
  const chosen = [first]

  while (chosen.length < Math.min(MAX_ICONS, spots.length)) {
    let best = spots[0]
    let bestGap = -1
    for (const s of spots) {
      const nearest = Math.min(...chosen.map((c) => gap(s, c)))
      if (nearest > bestGap) {
        best = s
        bestGap = nearest
      }
    }
    chosen.push(best)
  }
  return chosen.map((s) => s.point)
}

// How many icons to show at this zoom: one when the area is small on screen,
// more as it grows, never more than MAX_ICONS.
export function iconCount(area: WeatherArea, zoom: number): number {
  const xs = area.polygon.map((p) => project(p.latitude, p.longitude).x)
  const ys = area.polygon.map((p) => project(p.latitude, p.longitude).y)
  const widthPx = (Math.max(...xs) - Math.min(...xs)) * PX_PER_WORLD_PCT
  const heightPx =
    (Math.max(...ys) - Math.min(...ys)) * PX_PER_WORLD_PCT * HEIGHT_PER_WIDTH
  const sizePx = Math.max(widthPx, heightPx) * zoom
  return Math.min(MAX_ICONS, Math.max(1, Math.round(sizePx / ICON_SPACING_PX)))
}
