import { useState } from 'react'
import { getFact } from './facts'
import type { RouteStatus } from './useFlightRoute'
import type { Flight, WeatherArea } from '../data/types'

type Held = { id: string; settled: boolean; fact: string }

// The fact for the open card. It is picked when a flight is selected and kept
// until the card closes or another flight is selected, so it doesn't change
// under the reader as the flight moves between polls, and the Journal saves
// the very fact that was shown. One exception: a live flight's type arrives
// from the route lookup a moment after the tap, so the fact is picked once
// more when that lookup finishes (found or not).
export function useCardFact(
  flight: Flight | null,
  routeStatus: RouteStatus,
  weather: WeatherArea[],
): string | null {
  const [held, setHeld] = useState<Held | null>(null)
  const settled = routeStatus !== 'loading'

  let next: Held | null = null
  if (flight) {
    const keep =
      held !== null && held.id === flight.id && (held.settled || !settled) // not the lookup finishing
    next = keep
      ? held
      : {
          id: flight.id,
          settled,
          fact: getFact(flight, new Date(), weather),
        }
  }
  // Updating state while rendering (React re-renders at once) keeps the value
  // from lagging a render behind the flight.
  if (next !== held) setHeld(next)
  return next?.fact ?? null
}
