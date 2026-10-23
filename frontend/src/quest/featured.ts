import { hashString } from '../shared-lib/hash'
import type { Quest } from './quest'
import type { Flight, WeatherArea } from '../data/types'

export const FEATURED_COUNT = 3

// The flights not caught today, in an order shuffled by a hash of flight id
// and day: stable for the day, but not always the first flight in the list.
function candidatesFor(
  flights: Flight[],
  caughtTodayIds: Set<string>,
  day: string,
): Flight[] {
  const shuffle = (f: Flight) => hashString(f.id + day)
  return flights
    .filter((f) => !caughtTodayIds.has(f.id))
    .sort((a, b) => shuffle(a) - shuffle(b))
}

// Flights worth catching today: the rarest aircraft types in the current
// feed, one flight per type. Flights already caught today are skipped, and
// so are flights that fit the quest: a ring on them would give the quest
// away (the mascot's hint points at one later, see pickQuestFlight).
export function pickFeatured(
  flights: Flight[],
  quest: Quest | null,
  caughtTodayIds: Set<string>,
  day: string,
  now = new Date(),
  weather: WeatherArea[] = [],
): string[] {
  const candidates = candidatesFor(flights, caughtTodayIds, day).filter(
    (f) => !quest?.matches(f, now, weather),
  )

  // How many flights of each type are flying (fewer means rarer). A flight with
  // no known type has no rarity, so it is never picked for its type.
  const typeCount = new Map<string, number>()
  for (const f of flights)
    if (f.aircraft_type !== null)
      typeCount.set(f.aircraft_type, (typeCount.get(f.aircraft_type) ?? 0) + 1)
  const typed = candidates.filter(
    (f): f is Flight & { aircraft_type: string } => f.aircraft_type !== null,
  )
  // Stable sort: equal counts keep their shuffled order.
  const byRarity = [...typed].sort(
    (a, b) => typeCount.get(a.aircraft_type)! - typeCount.get(b.aircraft_type)!,
  )
  const picked: Flight[] = []
  const types = new Set<string>()
  for (const f of byRarity) {
    if (picked.length >= FEATURED_COUNT) break
    if (types.has(f.aircraft_type)) continue
    picked.push(f)
    types.add(f.aircraft_type)
  }
  return picked.map((f) => f.id)
}

// A flight that completes the quest, for the mascot's hint, or null if none
// does. Not caught today, and picked in the same stable shuffled order.
export function pickQuestFlight(
  flights: Flight[],
  quest: Quest | null,
  caughtTodayIds: Set<string>,
  day: string,
  now = new Date(),
  weather: WeatherArea[] = [],
): string | null {
  if (!quest) return null
  return (
    candidatesFor(flights, caughtTodayIds, day).find((f) =>
      quest.matches(f, now, weather),
    )?.id ?? null
  )
}
