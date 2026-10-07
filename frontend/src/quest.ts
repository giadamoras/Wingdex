import { airlineOf, regionsOf, timeOfDay, weatherAt } from './attributes'
import { hashString } from './hash'
import type { Flight, Hazard, JournalEntry, WeatherArea } from './types'

// A quest template: a title, a concept fact for the completion moment, and a
// test for whether a caught flight completes it. `at` is when the flight was
// caught, so time-of-day quests judge the catch moment, not the current time.
// `weather` is the hazard areas at that moment; only weather quests read it.
export interface Quest {
  id: string
  title: string
  conceptFact: string
  matches(flight: Flight, at?: Date, weather?: WeatherArea[]): boolean
}

// Thresholds in one place so they are easy to tune.
const HIGH_FT = 36_000 // "cruising high"
const LOW_FT = 20_000 // "flying low"
const LONG_HAUL_MIN = 360 // 6 hours, gate to gate
const STEEP_FPM = 1000 // "climbing" / "descending", feet per minute
const FAST_KT = 550 // ground speed; airliners cruise ~450 kt through the air

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

// One quest per weather hazard: catch a flight that is inside such an area, at
// a height the hazard reaches (see weatherAt). Built from this table so adding
// a hazard is one entry.
const WEATHER_QUESTS: { hazard: Hazard; title: string; conceptFact: string }[] =
  [
    {
      hazard: 'thunderstorm',
      title: 'Catch a flight inside a thunderstorm area',
      conceptFact:
        'You found one! A thunderstorm cell is a giant engine of rising and sinking air, and its top can pass 50,000 ft. Crews read the nose radar to pick a path between cells, and air traffic control clears them to leave their planned route. Advisories like the one on this map tell them early where storms are growing.',
    },
    {
      hazard: 'turbulence',
      title: 'Catch a flight in a turbulence area',
      conceptFact:
        'Turbulence is graded from light (drinks slosh) to severe (loose objects fly). A forecast area gives the heights it covers, and crews who feel a bump report it so the next plane can change level. Planes are built to handle far stronger forces than normal turbulence brings, so the real risk is people who are not belted in.',
    },
    {
      hazard: 'mountain_wave',
      title: 'Catch a flight in a mountain wave area',
      conceptFact:
        'Wind pushed over a ridge keeps rippling downwind, like water over a rock in a stream. A plane crossing the ripples feels rolling bumps, sometimes high above the peaks. The warning marks where the wave can reach and how high, so crews can plan a different height.',
    },
    {
      hazard: 'icing',
      title: 'Catch a flight in an icing area',
      conceptFact:
        'Ice is a problem because it spoils the smooth shape of the wing (which cuts lift) and it adds weight. Many planes have heated or inflatable wing edges to shed ice, and on the ground they are sprayed with de-icing fluid. An icing warning lists a layer of heights, so the simplest fix is often a new level.',
    },
    {
      hazard: 'volcanic_ash',
      title: 'Catch a flight in a volcanic ash area',
      conceptFact:
        'Nine volcanic ash advisory centres around the world watch eruptions by satellite, and their advisories become warnings like this one. Ash is gritty enough to scratch windscreens, and it can melt inside a hot engine and make it stop. A cloud can spread over a whole region in a day, so airlines reroute long before it arrives.',
    },
    {
      hazard: 'tropical_cyclone',
      title: 'Catch a flight in a tropical cyclone area',
      conceptFact:
        'A cyclone warning marks a storm that grows over warm sea water and is named by forecasters. Its outer bands can sit hundreds of kilometres from the eye, so routes bend wide around the whole area. Each advisory also says where the storm is heading, which is why routes change from day to day.',
    },
  ]

// Airline quests, matched on the callsign prefix (see airlineOf). These fly busy
// routes, so one is usually in a world-wide feed; pickQuest skips an airline
// with no flight in the feed.
const AIRLINE_QUESTS: { code: string; name: string; conceptFact: string }[] = [
  {
    code: 'RYR',
    name: 'Ryanair',
    conceptFact:
      'Low-cost airlines like Ryanair fly point to point, often from smaller airports with cheaper fees, and aim to turn a plane around in about 25 minutes. A plane only earns money in the air, so every minute on the ground is a cost to cut.',
  },
  {
    code: 'UAE',
    name: 'Emirates',
    conceptFact:
      'Emirates runs a hub-and-spoke network: passengers from many cities fly into Dubai and leave on a connecting flight. One hub can link hundreds of city pairs with far fewer routes than flying everyone directly.',
  },
  {
    code: 'DLH',
    name: 'Lufthansa',
    conceptFact:
      'Every airline has a three-letter ICAO code (DLH), which starts the callsigns on this map, and a two-letter IATA code (LH) printed on your ticket. On the radio, pilots may use a spoken name instead, and it is not always the airline name: British Airways says "Speedbird".',
  },
  {
    code: 'KLM',
    name: 'KLM',
    conceptFact:
      "Airlines often sell seats on each other's flights, called codeshare, so one plane can carry passengers booked under several airlines and flight numbers. The callsign shown on this map is the airline that operates the plane.",
  },
]

export const QUEST_TEMPLATES: Quest[] = [
  {
    id: 'high',
    title: `Catch a flight above ${HIGH_FT.toLocaleString('en-US')} ft`,
    conceptFact:
      'Thin air means less drag, so engines burn less fuel for the same speed. But wings and engines also need air to work with, so every plane has a best height. It rises through the flight, because the plane gets lighter as fuel burns off. Air traffic control then gives planes on crossing routes different levels, so they stay apart vertically.',
    matches: (f) => f.altitude_ft > HIGH_FT,
  },
  {
    id: 'low',
    title: `Catch a flight below ${LOW_FT.toLocaleString('en-US')} ft`,
    conceptFact:
      'On a short trip a plane spends most of its time climbing and descending, so it never reaches the high levels where jets are most efficient. Small and slow planes stay low on purpose, because their engines and wings work best in thicker air. Low levels are also where the airspace is shared between airliners, small planes and helicopters.',
    matches: (f) => f.altitude_ft < LOW_FT,
  },
  {
    id: 'wide-body',
    title: 'Catch a wide-body jet',
    conceptFact:
      'A wide-body has two aisles and a fuselage over 5 m across. The extra room is for more than seats: the cargo hold under the floor carries freight on most long flights, so these jets earn money from parcels as well as passengers. Their size also needs bigger gates, wider taxiways and longer runways, so only some airports can handle them.',
    matches: (f) => f.aircraft_type !== null && WIDE_BODY.has(f.aircraft_type),
  },
  {
    id: 'turboprop',
    title: 'Catch a propeller plane',
    conceptFact:
      'A turboprop is a jet engine that turns a propeller through a gearbox. A big propeller moves a lot of air slowly, which is more efficient than a fast jet exhaust at lower speeds and heights. That makes turboprops cheap to run on short routes, and many can use shorter runways than jets.',
    matches: (f) => f.aircraft_type !== null && TURBOPROP.has(f.aircraft_type),
  },
  {
    id: 'ocean',
    title: 'Catch a flight over the open ocean',
    conceptFact:
      'Far from land, radar cannot see planes, so on busy routes like the North Atlantic they follow set tracks with fixed spacing and report their position. Twin-engine airliners are certified (ETOPS) to stay within a set flying time of an airport, in case they must divert. Over the North Atlantic the tracks change twice a day to follow the winds.',
    matches: (f) => regionsOf(f.latitude, f.longitude).includes('open-ocean'),
  },
  {
    id: 'night',
    title: 'Catch a flight in the dark',
    conceptFact:
      "Airliners are flown mostly by instruments, so darkness changes little in the cockpit. Night does change the cabin and the airport: lights dim for sleep, and many cities allow fewer take-offs and landings to keep the noise down. Long flights heading east often run into night sooner, because they fly against the Sun's westward path.",
    matches: (f, at = new Date()) => timeOfDay(f.longitude, at) === 'night',
  },
  {
    id: 'long-haul',
    title: `Catch a long-haul flight (over ${LONG_HAUL_MIN / 60} hours)`,
    conceptFact:
      'Long flights look curved on a flat map because the shortest route between two cities on a globe is a great circle, which bends toward the poles. That is why flights from Europe to North America often pass near Iceland and Greenland, though winds shift the real route from day to day. On the longest routes extra pilots are carried, so the crew can rest in turns.',
    matches: (f) => f.duration_min !== null && f.duration_min > LONG_HAUL_MIN,
  },
  {
    id: 'climbing',
    title: 'Catch a flight that is climbing',
    conceptFact:
      'A climbing plane burns more fuel per minute than at cruise, but it has to get above the weather and into thin air. Air traffic control gives each climb a level to stop at, so planes at different heights stay apart.',
    // Live feed only; a mock flight has no vertical rate.
    matches: (f) => (f.vertical_rate_fpm ?? 0) > STEEP_FPM,
  },
  {
    id: 'descending',
    title: 'Catch a flight that is descending',
    conceptFact:
      'Pilots plan the descent a long way out: a common rule is about 3 nautical miles of ground for every 1,000 ft to lose. Engines idle and the plane glides down, which saves fuel and keeps the ride gentle for the cabin.',
    matches: (f) => (f.vertical_rate_fpm ?? 0) < -STEEP_FPM,
  },
  {
    id: 'fast',
    title: `Catch a flight faster than ${FAST_KT} kt over the ground`,
    conceptFact:
      'Airliners cruise at about 450 knots through the air, so a ground speed this high usually means a strong tailwind, often a jet stream. Flights heading east across the Atlantic often ride the jet stream and take 1h+ less than the westbound flight.',
    matches: (f) => f.speed_kt > FAST_KT,
  },
  ...AIRLINE_QUESTS.map(({ code, name, conceptFact }): Quest => ({
    id: `airline-${code}`,
    title: `Catch a ${name} flight`,
    conceptFact,
    matches: (f) => airlineOf(f.callsign) === code,
  })),
  ...WEATHER_QUESTS.map(({ hazard, title, conceptFact }): Quest => ({
    id: `weather-${hazard}`,
    title,
    conceptFact,
    matches: (f, at = new Date(), weather = []) =>
      weatherAt(f, weather, at).includes(hazard),
  })),
]

// Today's quest for the given local day (see dayKey): the day picks a starting
// point in the list, and the first template that some current flight can
// satisfy wins. Null if none can (e.g. an empty feed).
export function pickQuest(
  templates: Quest[],
  flights: Flight[],
  day: string,
  now = new Date(),
  weather: WeatherArea[] = [],
): Quest | null {
  const start = hashString(day) % templates.length
  for (let i = 0; i < templates.length; i++) {
    const quest = templates[(start + i) % templates.length]
    if (flights.some((f) => quest.matches(f, now, weather))) return quest
  }
  return null
}

// Is the quest done? Each of today's catches is judged at its own catch time
// (matters for night quests). The entry that completed the quest also carries
// its id, which keeps a weather quest done after its weather has moved on.
export function isQuestDone(
  quest: Quest,
  todaysCatches: JournalEntry[],
  weather: WeatherArea[],
): boolean {
  return todaysCatches.some(
    (e) =>
      e.questId === quest.id ||
      quest.matches(e.flight, new Date(e.caughtAt), weather),
  )
}
