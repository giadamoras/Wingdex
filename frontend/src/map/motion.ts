import type { Flight } from '../data/types'

// Rough distance in nautical miles (flat approximation: 1 degree of latitude
// = 60 nm). Accurate enough for the short hops between two polls.
export function approxDistanceNm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = b.latitude - a.latitude
  const dLon =
    (b.longitude - a.longitude) * Math.cos((a.latitude * Math.PI) / 180)
  return Math.hypot(dLat, dLon) * 60
}

// Ids of flights that moved further than they could have flown in `seconds`
// (a mock flight restarting its route, or a real one reappearing after a
// coverage gap). The map snaps these instead of sliding them across it.
export function jumpedFlightIds(
  prev: Flight[],
  next: Flight[],
  seconds: number,
): Set<string> {
  const before = new Map(prev.map((f) => [f.id, f]))
  const jumped = new Set<string>()
  for (const f of next) {
    const old = before.get(f.id)
    if (!old) continue // new flights just appear
    // Twice the distance flyable at its speed, plus 1 nm for rounding.
    const allowedNm = ((f.speed_kt * seconds) / 3600) * 2 + 1
    if (approxDistanceNm(old, f) > allowedNm) jumped.add(f.id)
  }
  return jumped
}
