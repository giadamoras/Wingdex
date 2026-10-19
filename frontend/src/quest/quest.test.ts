import { expect, test } from 'vitest'
import {
  isQuestDone,
  pickQuest,
  QUEST_TEMPLATES,
  questIdForCatch,
  type Quest,
} from './quest'
import type { Hazard, WeatherArea } from '../data/types'

const flight = {
  id: 'f1',
  callsign: 'TST1',
  aircraft_type: 'A320',
  latitude: 48.5, // over land (near Paris)
  longitude: 2.3,
  altitude_ft: 30000,
  heading: 90,
  speed_kt: 450,
  duration_min: 95,
  origin: null,
  destination: null,
}

const quest = (id: string) => QUEST_TEMPLATES.find((q) => q.id === id)!

test('long-haul does not match exactly 6 hours, but matches just over', () => {
  expect(quest('long-haul').matches({ ...flight, duration_min: 360 })).toBe(
    false,
  )
  expect(quest('long-haul').matches({ ...flight, duration_min: 361 })).toBe(
    true,
  )
})

test('a flight with no known type or duration never matches those quests', () => {
  const unknown = { ...flight, aircraft_type: null, duration_min: null }
  expect(quest('wide-body').matches(unknown)).toBe(false)
  expect(quest('turboprop').matches(unknown)).toBe(false)
  expect(quest('long-haul').matches(unknown)).toBe(false)
})

test('long-haul is never picked from a live feed, which has no durations', () => {
  const live = [
    { ...flight, aircraft_type: null, duration_min: null },
    { ...flight, id: 'f2', aircraft_type: 'B77W', duration_min: null },
  ]
  // pickQuest skips a template no flight can satisfy, whatever day it starts on.
  for (let day = 1; day <= 28; day++) {
    const picked = pickQuest(
      QUEST_TEMPLATES,
      live,
      `2026-09-${String(day).padStart(2, '0')}`,
    )
    expect(picked?.id).not.toBe('long-haul')
    expect(picked).not.toBeNull() // other quests can still be picked
  }
})

test('high and low altitude quests exclude their thresholds', () => {
  expect(quest('high').matches({ ...flight, altitude_ft: 36000 })).toBe(false)
  expect(quest('high').matches({ ...flight, altitude_ft: 36001 })).toBe(true)
  expect(quest('low').matches({ ...flight, altitude_ft: 20000 })).toBe(false)
  expect(quest('low').matches({ ...flight, altitude_ft: 19999 })).toBe(true)
})

test('aircraft category quests match by type', () => {
  expect(quest('wide-body').matches({ ...flight, aircraft_type: 'B77W' })).toBe(
    true,
  )
  expect(quest('wide-body').matches(flight)).toBe(false)
  expect(quest('turboprop').matches({ ...flight, aircraft_type: 'AT76' })).toBe(
    true,
  )
  expect(quest('turboprop').matches(flight)).toBe(false)
})

test('the ocean quest needs a position over open water', () => {
  expect(
    quest('ocean').matches({ ...flight, latitude: 50, longitude: -30 }),
  ).toBe(true)
  expect(quest('ocean').matches(flight)).toBe(false)
})

test('the night quest judges the given time at the flight, not the clock', () => {
  const noonUtc = new Date(Date.UTC(2026, 8, 28, 12, 0))
  expect(quest('night').matches({ ...flight, longitude: 0 }, noonUtc)).toBe(
    false,
  )
  expect(quest('night').matches({ ...flight, longitude: 180 }, noonUtc)).toBe(
    true,
  )
})

const always = (id: string): Quest => ({
  id,
  title: id,
  conceptFact: '',
  matches: () => true,
})
const never = (id: string): Quest => ({ ...always(id), matches: () => false })

test('the same day always picks the same quest', () => {
  const templates = [always('a'), always('b'), always('c')]
  expect(pickQuest(templates, [flight], '2026-09-28')?.id).toBe(
    pickQuest(templates, [flight], '2026-09-28')?.id,
  )
})

test('different days pick different quests', () => {
  const templates = [always('a'), always('b'), always('c')]
  const ids = new Set(
    Array.from(
      { length: 30 },
      (_, i) => pickQuest(templates, [flight], `2026-09-${i + 1}`)?.id,
    ),
  )
  expect(ids.size).toBeGreaterThan(1)
})

test('skips quests that no current flight can satisfy', () => {
  const templates = [never('a'), never('b'), always('c')]
  for (let i = 1; i <= 10; i++)
    expect(pickQuest(templates, [flight], `2026-09-${i}`)?.id).toBe('c')
})

test('returns null when nothing can be satisfied', () => {
  expect(pickQuest([never('a')], [flight], '2026-09-28')).toBeNull()
  expect(pickQuest(QUEST_TEMPLATES, [], '2026-09-28')).toBeNull()
})

// A box over Paris (flight above is at 48.5N, 2.3E, 30,000 ft), valid around NOW.
const NOW = new Date(Date.UTC(2026, 8, 28, 12, 0))
const hazardArea = (hazard: Hazard): WeatherArea => ({
  id: `w-${hazard}`,
  hazard,
  region: 'Test',
  altitude_min_ft: 10000,
  altitude_max_ft: 40000,
  valid_from: NOW.getTime() / 1000 - 3600,
  valid_to: NOW.getTime() / 1000 + 3600,
  polygon: [
    { latitude: 45, longitude: 0 },
    { latitude: 45, longitude: 5 },
    { latitude: 50, longitude: 5 },
    { latitude: 50, longitude: 0 },
    { latitude: 45, longitude: 0 },
  ],
  movement_dir: null,
  movement_speed_kt: null,
})

const HAZARDS: Hazard[] = [
  'thunderstorm',
  'turbulence',
  'mountain_wave',
  'icing',
  'volcanic_ash',
  'tropical_cyclone',
]

test('every weather hazard has a quest that matches only inside that hazard', () => {
  for (const hazard of HAZARDS) {
    const q = quest(`weather-${hazard}`)
    expect(q.matches(flight, NOW, [hazardArea(hazard)])).toBe(true)
    // A different hazard over the flight doesn't complete this quest.
    const other = HAZARDS.find((h) => h !== hazard)!
    expect(q.matches(flight, NOW, [hazardArea(other)])).toBe(false)
  }
})

test('weather quests never match without weather', () => {
  for (const hazard of HAZARDS)
    expect(quest(`weather-${hazard}`).matches(flight, NOW)).toBe(false)
})

test('a weather quest needs the right height and moment', () => {
  const q = quest('weather-thunderstorm')
  const areas = [hazardArea('thunderstorm')]
  expect(q.matches({ ...flight, altitude_ft: 5000 }, NOW, areas)).toBe(false)
  expect(q.matches(flight, new Date(NOW.getTime() + 7200_000), areas)).toBe(
    false,
  )
})

test('quest ids are unique', () => {
  const ids = QUEST_TEMPLATES.map((q) => q.id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('a weather quest can be picked only when a flight is in that weather', () => {
  const only = [quest('weather-icing')]
  expect(pickQuest(only, [flight], '2026-09-28', NOW, [])).toBeNull()
  expect(
    pickQuest(only, [flight], '2026-09-28', NOW, [hazardArea('icing')]),
  ).toBe(only[0])
})

test('climbing and descending quests need a live vertical rate', () => {
  expect(
    quest('climbing').matches({ ...flight, vertical_rate_fpm: 1500 }),
  ).toBe(true)
  expect(
    quest('climbing').matches({ ...flight, vertical_rate_fpm: 1000 }),
  ).toBe(false)
  expect(quest('climbing').matches(flight)).toBe(false)
  expect(
    quest('descending').matches({ ...flight, vertical_rate_fpm: -1500 }),
  ).toBe(true)
  expect(
    quest('descending').matches({ ...flight, vertical_rate_fpm: null }),
  ).toBe(false)
})

test('the fast quest excludes its threshold', () => {
  expect(quest('fast').matches({ ...flight, speed_kt: 550 })).toBe(false)
  expect(quest('fast').matches({ ...flight, speed_kt: 551 })).toBe(true)
})

test('an airline quest matches the callsign prefix only', () => {
  expect(quest('airline-RYR').matches({ ...flight, callsign: 'RYR12AB' })).toBe(
    true,
  )
  expect(quest('airline-RYR').matches({ ...flight, callsign: 'DLH123' })).toBe(
    false,
  )
  expect(quest('airline-RYR').matches({ ...flight, callsign: 'N123AB' })).toBe(
    false,
  )
})

test('isQuestDone uses the saved quest id or a matching catch', () => {
  const entry = (questId?: string) => ({
    flight,
    fact: '',
    caughtAt: NOW.toISOString(),
    questId,
  })
  const q = quest('weather-icing')
  expect(isQuestDone(q, [], [])).toBe(false)
  expect(isQuestDone(q, [entry()], [])).toBe(false)
  expect(isQuestDone(q, [entry('weather-icing')], [])).toBe(true)
  expect(isQuestDone(q, [entry()], [hazardArea('icing')])).toBe(true)
})

test('questIdForCatch gives the id only when the catch finishes the quest', () => {
  const at = (q: Quest | null, done: boolean) =>
    questIdForCatch(q, done, flight, NOW, [])
  expect(at(always('q1'), false)).toBe('q1')
  expect(at(never('q1'), false)).toBeUndefined() // the flight does not match
  expect(at(always('q1'), true)).toBeUndefined() // already done today
  expect(at(null, false)).toBeUndefined() // no quest yet
})

test('airline quest titles use "an" before a vowel', () => {
  expect(quest('airline-UAE').title).toBe('Catch an Emirates flight')
  expect(quest('airline-RYR').title).toBe('Catch a Ryanair flight')
  expect(quest('airline-KLM').title).toBe('Catch a KLM flight')
})

test('an airline-kind quest matches any airline of that kind', () => {
  const cargo = quest('airline-kind-cargo')
  expect(cargo.title).toBe('Catch a cargo flight')
  expect(cargo.matches({ ...flight, callsign: 'FDX1203' })).toBe(true)
  expect(cargo.matches({ ...flight, callsign: 'CLX7741' })).toBe(true)
  expect(cargo.matches({ ...flight, callsign: 'BAW117' })).toBe(false)
  expect(cargo.matches({ ...flight, callsign: 'N123AB' })).toBe(false)
  expect(
    quest('airline-kind-lowCost').matches({ ...flight, callsign: 'RYR4KM' }),
  ).toBe(true)
  expect(
    quest('airline-kind-leisure').matches({ ...flight, callsign: 'NOS102' }),
  ).toBe(true)
})
