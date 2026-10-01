import { regionsOf, timeOfDay } from './attributes'
import { hashString } from './hash'
import type { Flight } from './types'

// A quest template: a title, a concept fact for the completion moment, and a
// test for whether a caught flight completes it. `at` is when the flight was
// caught, so time-of-day quests judge the catch moment, not the current time.
export interface Quest {
  id: string
  title: string
  conceptFact: string
  matches(flight: Flight, at?: Date): boolean
}

// Thresholds in one place so they are easy to tune.
const HIGH_FT = 36_000 // "cruising high"
const LOW_FT = 20_000 // "flying low"
const LONG_HAUL_MIN = 360 // 6 hours, gate to gate

// Aircraft categories by ICAO type code. Not every type: enough for the mock
// data and the common types a live feed would show. Exported for reuse by
// aircraftSilhouette.ts, so the "wide-body"/"turboprop" quests and the plane
// silhouettes agree on the same categories.
export const WIDE_BODY = new Set([
  'A306',
  'A310',
  'A332',
  'A333',
  'A338',
  'A339',
  'A342',
  'A343',
  'A345',
  'A346',
  'A359',
  'A35K',
  'A388',
  'B742',
  'B744',
  'B748',
  'B762',
  'B763',
  'B764',
  'B772',
  'B773',
  'B77L',
  'B77W',
  'B788',
  'B789',
  'B78X',
])
export const TURBOPROP = new Set([
  'AT43',
  'AT45',
  'AT72',
  'AT73',
  'AT75',
  'AT76',
  'DH8A',
  'DH8B',
  'DH8C',
  'DH8D',
  'SF34',
  'B190',
  'E120',
  'C208',
])

export const QUEST_TEMPLATES: Quest[] = [
  {
    id: 'high',
    title: `Catch a flight above ${HIGH_FT.toLocaleString('en-US')} ft`,
    conceptFact:
      'The higher you fly, the thinner the air, so there is less drag and engines burn less fuel for the same speed. Wings and engines still need some air to work with, so every plane has a best height, and it rises as fuel burns off and the plane gets lighter.',
    matches: (f) => f.altitude_ft > HIGH_FT,
  },
  {
    id: 'low',
    title: `Catch a flight below ${LOW_FT.toLocaleString('en-US')} ft`,
    conceptFact:
      'On short trips a plane spends a big share of the time climbing and descending, so it never reaches the high levels where jets are most efficient. Short hops and slower planes often stay lower for this reason.',
    matches: (f) => f.altitude_ft < LOW_FT,
  },
  {
    id: 'wide-body',
    title: 'Catch a wide-body jet',
    conceptFact:
      'Wide-body jets have two aisles and a fuselage over 5 m wide. They are built for long routes and big crowds: room for lots of seats, cargo and the extra fuel a long flight needs.',
    matches: (f) => WIDE_BODY.has(f.aircraft_type),
  },
  {
    id: 'turboprop',
    title: 'Catch a propeller plane',
    conceptFact:
      'A turboprop is a jet engine that spins a propeller. At lower speeds and heights, a propeller pushes more air more efficiently than a jet exhaust, which makes turboprops a great fit for short routes.',
    matches: (f) => TURBOPROP.has(f.aircraft_type),
  },
  {
    id: 'ocean',
    title: 'Catch a flight over the open ocean',
    conceptFact:
      'Far from land there is no radar and no runway to divert to. Twin-engine airliners are certified to stay within a set flying time of an airport (called ETOPS), and flights follow set tracks with fixed spacing between them.',
    matches: (f) => regionsOf(f.latitude, f.longitude).includes('open-ocean'),
  },
  {
    id: 'night',
    title: 'Catch a flight in the dark',
    conceptFact:
      "Pilots fly by instruments, not by what they can see outside, so darkness doesn't change how an airliner is flown. That is why night flights are as routine as day flights.",
    matches: (f, at = new Date()) => timeOfDay(f.longitude, at) === 'night',
  },
  {
    id: 'long-haul',
    title: `Catch a long-haul flight (over ${LONG_HAUL_MIN / 60} hours)`,
    conceptFact:
      "Long flights often look curved on a flat map, but they're taking the shortest path. On a globe, the shortest route between two cities is a 'great circle', which bends toward the poles. That's why flights from Europe to North America pass near Iceland and Greenland.",
    matches: (f) => f.duration_min > LONG_HAUL_MIN,
  },
]

// Today's quest for the given local day (see dayKey): the day picks a starting
// point in the list, and the first template that some current flight can
// satisfy wins. Null if none can (e.g. an empty feed).
export function pickQuest(
  templates: Quest[],
  flights: Flight[],
  day: string,
  now = new Date(),
): Quest | null {
  const start = hashString(day) % templates.length
  for (let i = 0; i < templates.length; i++) {
    const quest = templates[(start + i) % templates.length]
    if (flights.some((f) => quest.matches(f, now))) return quest
  }
  return null
}
