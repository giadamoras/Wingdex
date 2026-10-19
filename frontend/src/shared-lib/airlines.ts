import catalog from '../content/airlines.json'
import { airlineOf } from './attributes'

// The airline catalog (content/airlines.json), keyed by the 3-letter ICAO code
// that starts a callsign ("BAW117" -> "BAW"). Not every airline: the mock
// data's airlines plus common ones in a live feed, European first. One source
// for the card's Airline section, the airline facts (facts.ts) and the
// airline quests (quest.ts).

// What kind of airline it is; the airline-kind quests use it.
export type AirlineKind =
  | 'fullService'
  | 'lowCost'
  | 'leisure' // holiday flights, often charter
  | 'regional'
  | 'cargo'

export interface Airline {
  name: string // "British Airways"
  country: string
  radio?: string // the radio callsign, "Speedbird"; missing when unsure
  kind: AirlineKind
}

// The JSON is typed loosely (kind is just a string); airlines.test.ts checks
// every entry against these types.
export const AIRLINES = catalog as Record<string, Airline>

// The catalog entry for a flight's callsign, or null for an airline the
// catalog lacks or a callsign that isn't an airline's (a private plane's).
export function airlineFor(callsign: string): Airline | null {
  const code = airlineOf(callsign)
  return code !== undefined && Object.hasOwn(AIRLINES, code)
    ? AIRLINES[code]
    : null
}

// How a controller says the callsign: the airline's radio name, then the rest
// of the callsign ("BAW117" -> "Speedbird 117"). null when unknown.
export function radioCallsign(callsign: string): string | null {
  const radio = airlineFor(callsign)?.radio
  return radio ? `${radio} ${callsign.trim().toUpperCase().slice(3)}` : null
}
