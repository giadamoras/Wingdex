import { useState } from 'react'
import { dayKey } from '../shared-lib/dates'
import { FEATURED_COUNT, pickFeatured, pickQuestFlight } from './featured'
import type { Quest } from './quest'
import type { Flight, JournalEntry, WeatherArea } from '../data/types'

interface Picks {
  featured: string[]
  questFlight: string | null
}

// Featured flights and the quest's flight: picked when the feed, weather and
// quest are ready (a weather quest needs the weather to find its flight), then
// kept, so the rings don't hop around. A featured plane caught today loses its
// ring and is not replaced. One that leaves the feed (landed, or out of live
// coverage) is replaced by a new pick, so a long session keeps its rings; the
// quest's flight is picked again when it leaves the feed or no longer fits the
// quest (a weather quest's plane flown out of the weather). Returns the ids
// to ring, and the id of a flight that fits the quest for the mascot's hint
// (null once caught, or when none fits).
export function useFeatured(
  flights: Flight[] | null,
  weather: WeatherArea[] | null,
  quest: Quest | null,
  todaysCatches: JournalEntry[],
): { featuredIds: Set<string>; questFlightId: string | null } {
  const [picks, setPicks] = useState<Picks | null>(null)
  const caught = new Set(todaysCatches.map((e) => e.flight.id))

  // Set state during render (React's documented way to derive state from
  // props). Each branch only runs when something changed, and its new picks
  // are in the feed, so it settles at once.
  if (flights && weather && quest) {
    const now = new Date()
    const day = dayKey()
    const inFeed = new Map(flights.map((f) => [f.id, f]))
    if (picks === null) {
      setPicks({
        featured: pickFeatured(flights, quest, caught, day, now, weather),
        questFlight: pickQuestFlight(flights, quest, caught, day, now, weather),
      })
    } else {
      const kept = picks.featured.filter((id) => inFeed.has(id))
      const gone = kept.length < picks.featured.length
      const quester = picks.questFlight && inFeed.get(picks.questFlight)
      const questGone =
        picks.questFlight !== null &&
        !caught.has(picks.questFlight) &&
        !(quester && quest.matches(quester, now, weather))
      if (gone || questGone) {
        // Fill the gaps with fresh picks, never one already ringed or caught.
        // One plane per type, like the first pick.
        const skip = new Set([...caught, ...kept])
        const keptTypes = new Set(
          kept.map((id) => inFeed.get(id)?.aircraft_type),
        )
        const fresh = gone
          ? pickFeatured(flights, quest, skip, day, now, weather).filter(
              (id) => !keptTypes.has(inFeed.get(id)?.aircraft_type),
            )
          : []
        setPicks({
          featured: [...kept, ...fresh].slice(
            0,
            Math.max(kept.length, picks.featured.length, FEATURED_COUNT),
          ),
          questFlight: questGone
            ? pickQuestFlight(flights, quest, caught, day, now, weather)
            : picks.questFlight,
        })
      }
    }
  }

  const questFlight = picks?.questFlight ?? null
  return {
    featuredIds: new Set(
      (picks?.featured ?? []).filter((id) => !caught.has(id)),
    ),
    questFlightId: questFlight && !caught.has(questFlight) ? questFlight : null,
  }
}
