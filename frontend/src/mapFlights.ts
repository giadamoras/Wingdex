import type { Flight } from './types'

// The planes the map draws. The selected flight (`current`) is drawn with its
// looked-up route, so its route line shows; a lost flight is not in the feed
// any more, so it is added at its last position until dismissed.
export function flightsForMap(
  flights: Flight[] | null,
  current: Flight | null,
  lost: boolean,
): Flight[] {
  const list = flights ?? []
  if (!current) return list
  return lost
    ? [...list, current]
    : list.map((f) => (f.id === current.id ? current : f))
}
