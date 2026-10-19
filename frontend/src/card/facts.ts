import {
  airlineOf,
  altitudeBand,
  regionsOf,
  timeOfDay,
  weatherAt,
} from '../shared-lib/attributes'
import { aircraftType } from '../shared-lib/aircraftTypes'
import { dayKey } from '../shared-lib/dates'
import { climbDirection } from '../shared-lib/format'
import { hashString } from '../shared-lib/hash'
import type { Flight, Hazard, WeatherArea } from '../data/types'
import factsData from '../content/facts.json'

// One fact, tagged with the single flight attribute it is about. A flight
// gets every fact whose tag matches one of its own attributes.
export type FactKind =
  | 'type'
  | 'family'
  | 'category'
  | 'airline'
  | 'altitude'
  | 'phase'
  | 'region'
  | 'time'
  | 'weather'
export interface Fact {
  kind: FactKind
  value: string
  text: string
}

// The pool lives in content/facts.json. Values: type is the ICAO aircraft
// code, family a family key and category an AircraftCategory, all from the
// type catalog (aircraftTypes.ts); airline is a key of the airline catalog
// (airlines.ts); altitude/region/time are the labels from attributes.ts;
// phase is climbing, descending or level (from the climb rate, so only live
// flights have one); weather is a hazard name (see Hazard in types.ts). The
// JSON is typed loosely, so facts.test.ts checks every entry.
export const FACTS = factsData as Fact[]

// The phase label for each climb direction (none when the rate is unknown).
const PHASES = {
  up: 'climbing',
  down: 'descending',
  level: 'level',
  unknown: null,
} as const

// Facts about this aircraft or airline, not about where or when it flies.
const SPECIFIC_KINDS = new Set<FactKind>([
  'type',
  'family',
  'category',
  'airline',
])

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
  const type = aircraftType(flight.aircraft_type)
  const phase = PHASES[climbDirection(flight.vertical_rate_fpm) ?? 'unknown']
  const tags = new Set([
    ...(flight.aircraft_type ? [`type:${flight.aircraft_type}`] : []),
    ...(type?.family ? [`family:${type.family}`] : []),
    ...(type ? [`category:${type.category}`] : []),
    ...(phase ? [`phase:${phase}`] : []),
    `airline:${airlineOf(flight.callsign)}`,
    `altitude:${altitudeBand(flight.altitude_ft)}`,
    ...regionsOf(flight.latitude, flight.longitude).map((r) => `region:${r}`),
    `time:${timeOfDay(flight.longitude, now)}`,
  ])
  const matches = FACTS.filter((f) => tags.has(`${f.kind}:${f.value}`))
  if (matches.length === 0) return FALLBACK_FACT
  // Prefer what is special about this flight: with both kinds on offer, about
  // 2 flights in 3 get an aircraft or airline fact, the rest a general one
  // (still fixed per flight and day). A second hash picks the pool, so it
  // doesn't follow the pick within it.
  const specific = matches.filter((f) => SPECIFIC_KINDS.has(f.kind))
  const general = matches.filter((f) => !SPECIFIC_KINDS.has(f.kind))
  if (specific.length === 0 || general.length === 0) return pick(matches)
  const generalDay = hashString(`${flight.id}${dayKey(now)}:pool`) % 3 === 0
  return pick(generalDay ? general : specific)
}
