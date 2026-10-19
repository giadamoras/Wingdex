import catalog from '../content/aircraft-types.json'

// The aircraft type catalog (content/aircraft-types.json), keyed by ICAO type
// code. Not every type: the mock data's types plus the common airliners, light
// aircraft, business jets and helicopters a live feed shows. One source for
// the quests (quest.ts), the plane silhouettes (aircraftSilhouette.ts), the
// card's aircraft name and the facts keyed by family (facts.ts).

// What kind of aircraft it is, not how it is drawn: aircraftSilhouette.ts maps
// each category to a shape.
export type AircraftCategory =
  | 'narrowBody'
  | 'regionalJet'
  | 'wideBody'
  | 'turboprop'
  | 'bizJet'
  | 'light' // piston aeroplanes and ultralights
  | 'glider'
  | 'helicopter'

export interface AircraftType {
  name: string // "Boeing 737-800"
  family?: string // a key of `families`, when several codes share one
  category: AircraftCategory
  engines?: number // only where it matters, e.g. 4 for the four-engine jets
}

// The JSON is typed loosely (category is just a string); aircraftTypes.test.ts
// checks every entry against these types.
export const AIRCRAFT_TYPES = catalog.types as Record<string, AircraftType>
export const AIRCRAFT_FAMILIES = catalog.families as Record<
  string,
  { name: string }
>

// The catalog entry for a code, or null for an unknown or missing type.
export function aircraftType(code: string | null): AircraftType | null {
  return code !== null && Object.hasOwn(AIRCRAFT_TYPES, code)
    ? AIRCRAFT_TYPES[code]
    : null
}

export const isWideBody = (code: string | null) =>
  aircraftType(code)?.category === 'wideBody'
export const isTurboprop = (code: string | null) =>
  aircraftType(code)?.category === 'turboprop'
