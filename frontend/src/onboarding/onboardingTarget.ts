import { DEFAULT_CENTER } from '../map/projection'
import type { Flight } from '../data/types'

// The flight closest to the map's default opening view, so the plane
// onboarding highlights is likely already on screen without panning. Plain
// lat/lon distance is enough - this only needs to pick "nearby", not exact.
export function pickOnboardingTarget(flights: Flight[]): Flight | null {
  if (flights.length === 0) return null
  const distance = (f: Flight) =>
    Math.hypot(
      f.latitude - DEFAULT_CENTER.latitude,
      f.longitude - DEFAULT_CENTER.longitude,
    )
  return flights.reduce((closest, f) =>
    distance(f) < distance(closest) ? f : closest,
  )
}
