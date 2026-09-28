// Small great-circle helpers, the same maths as backend/app/geo.py (kept in
// sync by hand: it's a few lines, not worth a shared package).
export interface Point {
  latitude: number // degrees
  longitude: number // degrees
}

const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

// Central angle between two points, in radians (haversine formula).
export function angularDistance(a: Point, b: Point): number {
  const lat1 = rad(a.latitude)
  const lat2 = rad(b.latitude)
  const h =
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Point `fraction` (0..1) of the way from a to b along the great circle.
export function interpolate(a: Point, b: Point, fraction: number): Point {
  const d = angularDistance(a, b)
  if (d === 0) return a
  const [lat1, lon1, lat2, lon2] = [
    rad(a.latitude),
    rad(a.longitude),
    rad(b.latitude),
    rad(b.longitude),
  ]
  // Weights of the two endpoints (spherical linear interpolation).
  const wa = Math.sin((1 - fraction) * d) / Math.sin(d)
  const wb = Math.sin(fraction * d) / Math.sin(d)
  const x =
    wa * Math.cos(lat1) * Math.cos(lon1) + wb * Math.cos(lat2) * Math.cos(lon2)
  const y =
    wa * Math.cos(lat1) * Math.sin(lon1) + wb * Math.cos(lat2) * Math.sin(lon2)
  const z = wa * Math.sin(lat1) + wb * Math.sin(lat2)
  return {
    latitude: deg(Math.atan2(z, Math.hypot(x, y))),
    longitude: deg(Math.atan2(y, x)),
  }
}

// Direction to fly from a toward b, in degrees clockwise from north (0..360).
export function bearing(a: Point, b: Point): number {
  const lat1 = rad(a.latitude)
  const lat2 = rad(b.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (deg(Math.atan2(y, x)) + 360) % 360
}

// How far along the route from a to b the point p is (0..1), by distance.
export function progressAlong(a: Point, b: Point, p: Point): number {
  const total = angularDistance(a, b)
  if (total === 0) return 1
  return Math.min(1, Math.max(0, angularDistance(a, p) / total))
}

// Points along the great circle from fraction `from` to `to` (0..1), so the
// curve looks smooth on the flat map. Always includes both ends.
export function routePoints(
  a: Point,
  b: Point,
  from = 0,
  to = 1,
  segments = 64,
): Point[] {
  // Fewer segments for a short section, but at least one.
  const n = Math.max(1, Math.ceil(segments * (to - from)))
  return Array.from({ length: n + 1 }, (_, i) =>
    interpolate(a, b, from + ((to - from) * i) / n),
  )
}
