import {
  airlineOf,
  altitudeBand,
  regionsOf,
  timeOfDay,
  weatherAt,
} from '../shared-lib/attributes'
import { aircraftType } from '../shared-lib/aircraftTypes'
import { dayKey } from '../shared-lib/dates'
import { hashString } from '../shared-lib/hash'
import type { Flight, Hazard, WeatherArea } from '../data/types'
import factsData from '../content/facts.json'

// One fact, tagged with the single flight attribute it is about. A flight
// gets every fact whose tag matches one of its own attributes.
export type FactKind =
  'type' | 'family' | 'airline' | 'altitude' | 'region' | 'time' | 'weather'
export interface Fact {
  kind: FactKind
  value: string
  text: string
}

// The pool lives in content/facts.json. Values: type is the ICAO aircraft
// code and family a family key, both from the catalog (aircraftTypes.ts);
// airline is the 3-letter callsign prefix; altitude/region/time are the labels
// from attributes.ts; weather is a hazard name (see Hazard in types.ts). The
// JSON is typed loosely, so facts.test.ts checks every entry.
export const FACTS = factsData as Fact[]

const FALLBACK_FACT = "Every flight has a story. This one's on you to uncover!"

// One fact for this flight, from the pool entries matching its attributes.
// The pick is seeded by flight id and local day, not random per call: the card
// re-renders on every poll and the Journal stores the fact that was shown, so
// it must stay the same. It still varies between flights and between days.
// A flight inside a weather hazard gets a fact about that hazard instead of
// the usual pool: weather is rare and worth explaining when you meet it.
export function getFact(
  flight: Flight,
  now = new Date(),
  weather: WeatherArea[] = [],
): string {
  // The same pick all day for this flight (see above).
  const pick = (facts: Fact[]) =>
    facts[hashString(flight.id + dayKey(now)) % facts.length].text
  const hazards = weatherAt(flight, weather, now)
  const weatherFacts = FACTS.filter(
    (f) => f.kind === 'weather' && hazards.includes(f.value as Hazard),
  )
  if (weatherFacts.length > 0) return pick(weatherFacts)

  // A type's family comes from the catalog, so one family fact reaches every
  // member (an A20N gets the A320 family's facts).
  const family = aircraftType(flight.aircraft_type)?.family
  const tags = new Set([
    ...(flight.aircraft_type ? [`type:${flight.aircraft_type}`] : []),
    ...(family ? [`family:${family}`] : []),
    `airline:${airlineOf(flight.callsign)}`,
    `altitude:${altitudeBand(flight.altitude_ft)}`,
    ...regionsOf(flight.latitude, flight.longitude).map((r) => `region:${r}`),
    `time:${timeOfDay(flight.longitude, now)}`,
  ])
  const matches = FACTS.filter((f) => tags.has(`${f.kind}:${f.value}`))
  if (matches.length === 0) return FALLBACK_FACT
  return pick(matches)
}
