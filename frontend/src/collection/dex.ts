import { aircraftShape } from '../map/aircraftSilhouette'
import { airlineOf } from '../shared-lib/attributes'
import { AIRCRAFT_TYPES } from '../shared-lib/aircraftTypes'
import { AIRLINES } from '../shared-lib/airlines'
import { countryOfAirport } from '../shared-lib/countries'
import { dayKey } from '../shared-lib/dates'
import type { JournalEntry } from '../data/types'

// What the Journal has collected, for the Dex tab and the badges. Everything
// is derived from the Journal on each call, never stored.

// Distinct aircraft type codes caught, known to the catalog or not.
export function seenTypes(journal: JournalEntry[]): Set<string> {
  return new Set(journal.flatMap((e) => e.flight.aircraft_type ?? []))
}

// Seen type codes the catalog lacks: the Dex lists them as "other types".
export function otherTypes(journal: JournalEntry[]): string[] {
  return [...seenTypes(journal)].filter(
    (c) => !Object.hasOwn(AIRCRAFT_TYPES, c),
  )
}

// Distinct airline codes caught that the airline catalog knows.
export function seenAirlines(journal: JournalEntry[]): Set<string> {
  return new Set(
    journal.flatMap((e) => {
      const code = airlineOf(e.flight.callsign)
      return code !== undefined && Object.hasOwn(AIRLINES, code) ? code : []
    }),
  )
}

// The destination countries caught, like stamps in a passport, in the order
// first caught. A catch with no known destination stamps nothing.
export function seenCountries(journal: JournalEntry[]): Set<string> {
  return new Set(
    journal.flatMap((e) => {
      const icao = e.flight.destination?.icao
      return (icao && countryOfAirport(icao)) || []
    }),
  )
}

export interface Streak {
  current: number // days in a row up to today, or up to yesterday if today's quest isn't done yet
  best: number
}

// The day before a local dayKey, as a dayKey. Built from the calendar date,
// not by subtracting 24 h, so a daylight-saving change can't skip a day.
function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d - 1))
}

// Daily quest streak. Only the catch that completed a quest has questId (see
// JournalContext), so each such entry's day is one quest day.
export function questStreak(journal: JournalEntry[], now = new Date()): Streak {
  const days = new Set(
    journal
      .filter((e) => e.questId !== undefined)
      .map((e) => dayKey(new Date(e.caughtAt))),
  )

  // A run's length, counting back from `day`.
  const runEndingOn = (day: string) => {
    let length = 0
    while (days.has(day)) {
      length++
      day = previousDay(day)
    }
    return length
  }

  const today = dayKey(now)
  const current = runEndingOn(days.has(today) ? today : previousDay(today))
  // Measured back from every quest day: simple, and cheap for a set of at
  // most one day per day played.
  const best = Math.max(0, ...[...days].map(runEndingOn))
  return { current, best }
}

// The type whose silhouette a tile shows. Once caught, the latest catch in
// it, so the tile shows the player's own sighting (a light twin in "Other
// light aircraft"). Before that, a type of the group's most common shape,
// not simply its first type, which in a mixed group can be the odd one out.
// `recent` is the Journal's type codes, newest first.
export function tileType(codes: string[], recent: (string | null)[]): string {
  const caught = recent.find((c) => c !== null && codes.includes(c))
  if (caught) return caught
  const byShape = new Map<string, string[]>()
  for (const code of codes) {
    const shape = aircraftShape(code)
    byShape.set(shape, [...(byShape.get(shape) ?? []), code])
  }
  // Ties go to the shape met first, so the pick is stable.
  return [...byShape.values()].reduce((a, b) =>
    b.length > a.length ? b : a,
  )[0]
}
