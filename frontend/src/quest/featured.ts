import { hashString } from '../shared-lib/hash'
import type { Quest } from './quest'
import type { Flight, WeatherArea } from '../data/types'

const FEATURED_COUNT = 3

// Flights worth catching today: one that completes the quest (if any), then
// the rarest aircraft types in the current feed, one flight per type. Flights
// already caught today are skipped. Ties are broken by a hash of flight id and
// day, so the pick is stable but not always the first flight in the list.
export function pickFeatured(
  flights: Flight[],
  quest: Quest | null,
  caughtTodayIds: Set<string>,
  day: string,
  now = new Date(),
  weather: WeatherArea[] = [],
): string[] {
  const shuffle = (f: Flight) => hashString(f.id + day)
  const candidates = flights
    .filter((f) => !caughtTodayIds.has(f.id))
    .sort((a, b) => shuffle(a) - shuffle(b))

  const picked: Flight[] = []
  const questMatch =
    quest && candidates.find((f) => quest.matches(f, now, weather))
  if (questMatch) picked.push(questMatch)

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
  const types = new Set(picked.map((f) => f.aircraft_type))
  for (const f of byRarity) {
    if (picked.length >= FEATURED_COUNT) break
    if (picked.includes(f) || types.has(f.aircraft_type)) continue
    picked.push(f)
    types.add(f.aircraft_type)
  }
  return picked.map((f) => f.id)
}
