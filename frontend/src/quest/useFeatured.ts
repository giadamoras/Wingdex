import { useState } from 'react'
import { dayKey } from '../shared-lib/dates'
import { pickFeatured, pickQuestFlight } from './featured'
import type { Quest } from './quest'
import type { Flight, JournalEntry, WeatherArea } from '../data/types'

// Featured flights and the quest's flight: picked once per session, when the
// feed, weather and quest are ready (a weather quest needs the weather to
// find its flight). The featured ring goes away once the flight is caught
// today. Returns the ids to ring, and the id of a flight that fits the quest
// for the mascot's hint (null once caught, or when none fits).
export function useFeatured(
  flights: Flight[] | null,
  weather: WeatherArea[] | null,
  quest: Quest | null,
  todaysCatches: JournalEntry[],
): { featuredIds: Set<string>; questFlightId: string | null } {
  const [picks, setPicks] = useState<{
    featured: string[]
    questFlight: string | null
  } | null>(null)
  // Set state during render (React's documented way to derive state from
  // props), guarded by `picks === null` so it runs once.
  if (picks === null && flights && weather && quest) {
    const caught = new Set(todaysCatches.map((e) => e.flight.id))
    const now = new Date()
    setPicks({
      featured: pickFeatured(flights, quest, caught, dayKey(), now, weather),
      questFlight: pickQuestFlight(
        flights,
        quest,
        caught,
        dayKey(),
        now,
        weather,
      ),
    })
  }
  const caughtToday = (id: string) =>
    todaysCatches.some((e) => e.flight.id === id)
  const questFlight = picks?.questFlight ?? null
  return {
    featuredIds: new Set(
      (picks?.featured ?? []).filter((id) => !caughtToday(id)),
    ),
    questFlightId:
      questFlight && !caughtToday(questFlight) ? questFlight : null,
  }
}
