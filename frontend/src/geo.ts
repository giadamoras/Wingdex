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

// 0 at both ends of the route and 1 at `peak` (the plane's fraction of the way),
// easing in and out so the bend is smooth, with no kink at the plane.
function bump(t: number, peak: number): number {
  if (t <= peak) return peak <= 0 ? 1 : Math.sin((Math.PI / 2) * (t / peak))
  return peak >= 1 ? 1 : Math.cos((Math.PI / 2) * ((t - peak) / (1 - peak)))
}

// A point `t` (0..1) of the way along a route from a to b that passes through
// `via` (the plane). A real plane is rarely on the great circle (airways, ocean
// tracks, winds), so the arc is shifted sideways, by nothing at the airports and
// by exactly the plane's offset where the plane is. A plane on the arc leaves
// the arc unchanged.
export function curvePoint(a: Point, b: Point, via: Point, t: number): Point {
  const peak = progressAlong(a, b, via)
  const here = interpolate(a, b, peak)
  const dLat = via.latitude - here.latitude
  // Take the short way round if the offset crosses the date line.
  const dLon = ((via.longitude - here.longitude + 540) % 360) - 180
  const p = interpolate(a, b, t)
  const w = bump(t, peak)
  return { latitude: p.latitude + dLat * w, longitude: p.longitude + dLon * w }
}

// Points along that curve from fraction `from` to `to`, ends included, so a
// section that starts or ends at the plane's own fraction touches the plane.
export function curveThrough(
  a: Point,
  b: Point,
  via: Point,
  from = 0,
  to = 1,
  segments = 64,
): Point[] {
  const n = Math.max(1, Math.ceil(segments * (to - from)))
  return Array.from({ length: n + 1 }, (_, i) =>
    curvePoint(a, b, via, from + ((to - from) * i) / n),
  )
}

// Splits a path where it crosses the date line (longitude 180 / -180). The map
// ends there, so drawing the jump from one side to the other would put a line
// straight across the whole world. Each part ends exactly on its edge, and the
// next one starts on the other edge at the same latitude. A path that does not
// cross comes back as one part. Longitudes are wrapped into -180..180 first (a
// bent curve can run a little past it, which is the other side of the line).
export function splitAtDateLine(points: Point[]): Point[][] {
  // Only a longitude outside -180..180 is changed, so the others stay exactly as given.
  const wrap = (lon: number) =>
    lon >= -180 && lon <= 180 ? lon : ((((lon + 180) % 360) + 360) % 360) - 180
  const parts: Point[][] = []
  let current: Point[] = []
  let prev: Point | null = null
  for (const raw of points) {
    const p = { latitude: raw.latitude, longitude: wrap(raw.longitude) }
    if (prev && Math.abs(p.longitude - prev.longitude) > 180) {
      // Eastbound crosses from +180 to -180, westbound the other way.
      const edge = prev.longitude > 0 ? 180 : -180
      const beyond = p.longitude + (edge > 0 ? 360 : -360) // p, past the edge
      const f = (edge - prev.longitude) / (beyond - prev.longitude)
      const latitude = prev.latitude + f * (p.latitude - prev.latitude)
      current.push({ latitude, longitude: edge })
      parts.push(current)
      current = [{ latitude, longitude: -edge }]
    }
    current.push(p)
    prev = p
  }
  parts.push(current)
  return parts
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
