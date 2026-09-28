import { WORLD_LAND } from './worldLandData'

// Turns a flight's raw data into the labels ("tags") that fact pools and quest
// templates match on. Everything here works from position, altitude and
// callsign, which a live feed also provides.

export type AltitudeBand = 'low' | 'mid' | 'cruise' | 'high'
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night'

// Feet: low is climb/descent and small aircraft, cruise is where most jets
// spend their time, high is above the usual airliner levels.
export function altitudeBand(altitudeFt: number): AltitudeBand {
  if (altitudeFt < 10_000) return 'low'
  if (altitudeFt < 30_000) return 'mid'
  if (altitudeFt <= 38_000) return 'cruise'
  return 'high'
}

// Airline code from the callsign: airlines use a 3-letter ICAO code followed
// by a flight number ("BAW117" -> "BAW"). Returns undefined for anything else,
// e.g. a private registration or a missing callsign.
export function airlineOf(callsign: string): string | undefined {
  return /^([A-Z]{3})\d/.exec(callsign.trim().toUpperCase())?.[1]
}

// Ray casting: draw a line from the point and count how often it crosses the
// ring's edges. An odd count means the point is inside.
function inRing(lat: number, lon: number, ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lonI, latI] = ring[i]
    const [lonJ, latJ] = ring[j]
    if (
      latI > lat !== latJ > lat &&
      lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI
    )
      inside = !inside
  }
  return inside
}

export function isOverLand(latitude: number, longitude: number): boolean {
  return WORLD_LAND.some((ring) => inRing(latitude, longitude, ring))
}

interface Box {
  south: number
  north: number
  west: number
  east: number
}

const inBox = (b: Box, lat: number, lon: number) =>
  lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east

// Coarse boxes: rough, but good enough to say "over Europe" or "over the
// North Atlantic" in a fact.
const EUROPE: Box = { south: 35, north: 71, west: -10, east: 40 }
const NORTH_ATLANTIC: Box = { south: 35, north: 66, west: -60, east: -10 }

// Big seas that are water but not "open ocean". Backup for nearLand below:
// the Mediterranean is wide enough for a plane in the middle to be far from land.
const ENCLOSED_SEAS: Box[] = [
  { south: 30, north: 46, west: -6, east: 36 }, // Mediterranean
  { south: 40, north: 47, west: 27, east: 42 }, // Black Sea
  { south: 51, north: 66, west: -4, east: 30 }, // North Sea and Baltic
  { south: 12, north: 30, west: 32, east: 57 }, // Red Sea and Gulf
]

// Land within about 3 degrees (roughly 180 nm) in any of 8 directions. This
// keeps narrow waters like the English Channel and the Irish Sea from counting
// as open ocean.
const NEAR_LAND_DEG = 3
function nearLand(latitude: number, longitude: number): boolean {
  for (let angle = 0; angle < 360; angle += 45) {
    const dLat = NEAR_LAND_DEG * Math.sin((angle * Math.PI) / 180)
    const dLon = NEAR_LAND_DEG * Math.cos((angle * Math.PI) / 180)
    if (isOverLand(latitude + dLat, longitude + dLon)) return true
  }
  return false
}

// Region tags for a position. A position can have several, e.g.
// ["open-ocean", "north-atlantic"] or ["land", "europe"].
export function regionsOf(latitude: number, longitude: number): string[] {
  const regions: string[] = []
  if (isOverLand(latitude, longitude)) regions.push('land')
  else if (
    !nearLand(latitude, longitude) &&
    !ENCLOSED_SEAS.some((s) => inBox(s, latitude, longitude))
  )
    regions.push('open-ocean')
  if (inBox(EUROPE, latitude, longitude)) regions.push('europe')
  if (inBox(NORTH_ATLANTIC, latitude, longitude)) regions.push('north-atlantic')
  return regions
}

// Time of day where the plane is, from local solar time (UTC plus 4 minutes
// per degree of longitude), so it doesn't depend on the viewer's time zone.
export function timeOfDay(longitude: number, now = new Date()): TimeOfDay {
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60
  const solar = (((utcHours + longitude / 15) % 24) + 24) % 24
  if (solar < 5 || solar >= 20) return 'night'
  if (solar < 8) return 'dawn'
  if (solar < 17) return 'day'
  return 'dusk'
}
