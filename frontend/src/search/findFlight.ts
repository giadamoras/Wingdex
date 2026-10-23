import type { Flight } from '../data/types'

// Finding one flight by what a player knows of it: the flight number on a
// ticket ("MU640") or the callsign the plane broadcasts ("CES640"). The feed
// only has callsigns, so the search first looks for the text itself, then
// asks the backend (adsbdb) which callsigns it can stand for (FlightSearch).

// A search as a callsign would be written ("mu 640" -> "MU640"), or null when
// it can't be one: 3 to 8 letters and digits, like the backend's check.
export function normaliseSearch(text: string): string | null {
  const cleaned = text.replace(/[\s-]/g, '').toUpperCase()
  return /^[A-Z0-9]{3,8}$/.test(cleaned) ? cleaned : null
}

// The first flight in the whole feed (drawn or not) flying under one of these
// callsigns, in their order, or null.
export function findByCallsign(
  flights: Flight[],
  callsigns: string[],
): Flight | null {
  for (const callsign of callsigns) {
    const found = flights.find(
      (f) => f.callsign.trim().toUpperCase() === callsign,
    )
    if (found) return found
  }
  return null
}

// What the search says when it finds nothing, in plain words. `callsigns` is
// what the backend said the flight flies as (its likeliest first): when that
// is known, the flight is real but not in the feed, which is worth saying.
export function notFoundWords(query: string, callsigns: string[] = []): string {
  const as = callsigns[0]
  if (as && as !== query)
    return `${query} flies as ${as}, but it isn't in the live feed right now. It may not have taken off yet, or be somewhere the feed doesn't cover.`
  return `No ${query} in the sky right now. It may not have taken off yet, be outside the feed's coverage, or fly under a callsign that isn't its flight number.`
}
export const INVALID_WORDS =
  'That doesn’t look like a flight. Try a flight number like MU640 or a callsign like CES640.'
export const DOWN_WORDS =
  'Flight numbers can’t be looked up right now. A callsign (like CES640) still works.'
