import { useState } from 'react'
import { dayKey } from '../shared-lib/dates'
import { pickFeatured } from './featured'
import type { Quest } from './quest'
import type { Flight, JournalEntry, WeatherArea } from '../data/types'

// Featured flights: picked once per session, when the feed, weather and quest
// are ready (a weather quest needs the weather to find its flight). The ring
// goes away once the flight is caught today. Returns the ids to ring.
export function useFeatured(
  flights: Flight[] | null,
  weather: WeatherArea[] | null,
  quest: Quest | null,
  todaysCatches: JournalEntry[],
): Set<string> {
  const [featured, setFeatured] = useState<string[] | null>(null)
  // Set state during render (React's documented way to derive state from
  // props), guarded by `featured === null` so it runs once.
  if (featured === null && flights && weather && quest)
    setFeatured(
      pickFeatured(
        flights,
        quest,
        new Set(todaysCatches.map((e) => e.flight.id)),
        dayKey(),
        new Date(),
        weather,
      ),
    )
  return new Set(
    (featured ?? []).filter(
      (id) => !todaysCatches.some((e) => e.flight.id === id),
    ),
  )
}
