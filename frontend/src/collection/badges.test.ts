import { expect, test } from 'vitest'
import { BADGES, unlockedBadgeIds } from './badges'
import type { Flight, JournalEntry } from '../data/types'

const baseFlight: Flight = {
  id: 'f1',
  callsign: 'TST1',
  aircraft_type: 'A320',
  latitude: 50,
  longitude: 0,
  altitude_ft: 36000,
  heading: 90,
  speed_kt: 450,
  duration_min: 95,
  origin: null,
  destination: null,
}

const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  flight: baseFlight,
  fact: 'A test fact.',
  caughtAt: '2026-09-25T12:00:00.000Z',
  ...over,
})

test('no badges unlock for an empty Journal', () => {
  expect(unlockedBadgeIds([])).toEqual([])
})

test('first-catch unlocks on the first entry', () => {
  expect(unlockedBadgeIds([entry()])).toContain('first-catch')
})

test('five-types needs 5 distinct aircraft types, not 5 catches', () => {
  const sameType = [entry(), entry(), entry(), entry(), entry()]
  expect(unlockedBadgeIds(sameType)).not.toContain('five-types')

  const fiveTypes = ['A320', 'B738', 'A333', 'B744', 'E190'].map((type) =>
    entry({ flight: { ...baseFlight, aircraft_type: type } }),
  )
  expect(unlockedBadgeIds(fiveTypes)).toContain('five-types')
})

test('five-types does not count catches of a plane with no known type', () => {
  const types = ['A320', 'B738', 'A333', 'B744'].map((type) =>
    entry({ flight: { ...baseFlight, aircraft_type: type } }),
  )
  const unknown = [1, 2, 3].map((n) =>
    entry({ flight: { ...baseFlight, id: `u${n}`, aircraft_type: null } }),
  )
  expect(unlockedBadgeIds([...types, ...unknown])).not.toContain('five-types')
})

test('three-quest-days ignores catches that did not complete a quest', () => {
  const noQuest = [1, 2, 3].map((day) =>
    entry({ caughtAt: `2026-09-2${day}T12:00:00.000Z` }),
  )
  expect(unlockedBadgeIds(noQuest)).not.toContain('three-quest-days')
})

test('three-quest-days needs 3 different days, not 3 completions', () => {
  const sameDay = [
    entry({ questId: 'high', caughtAt: '2026-09-25T10:00:00.000Z' }),
    entry({ questId: 'ocean', caughtAt: '2026-09-25T14:00:00.000Z' }),
    entry({ questId: 'night', caughtAt: '2026-09-25T22:00:00.000Z' }),
  ]
  expect(unlockedBadgeIds(sameDay)).not.toContain('three-quest-days')

  const threeDays = [21, 22, 23].map((day) =>
    entry({ questId: 'high', caughtAt: `2026-09-${day}T12:00:00.000Z` }),
  )
  expect(unlockedBadgeIds(threeDays)).toContain('three-quest-days')
})

test('ocean-crossing needs a catch actually over open ocean', () => {
  const overLand = entry({
    flight: { ...baseFlight, latitude: 50, longitude: 0 },
  })
  expect(unlockedBadgeIds([overLand])).not.toContain('ocean-crossing')

  // Mid North Atlantic, far from any coast.
  const overOcean = entry({
    flight: { ...baseFlight, latitude: 45, longitude: -40 },
  })
  expect(unlockedBadgeIds([overOcean])).toContain('ocean-crossing')
})

const unlocks = (journal: JournalEntry[], id: string) =>
  unlockedBadgeIds(journal).includes(id)
const withFlight = (over: Partial<Flight>, more: Partial<JournalEntry> = {}) =>
  entry({ flight: { ...baseFlight, ...over }, ...more })

test('every badge has a unique id and an icon', () => {
  expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length)
  for (const badge of BADGES) expect(badge.icon).not.toBe('')
})

test('polar needs a catch past a polar circle, north or south', () => {
  expect(unlocks([withFlight({ latitude: 60 })], 'polar')).toBe(false)
  expect(unlocks([withFlight({ latitude: 70 })], 'polar')).toBe(true)
  expect(unlocks([withFlight({ latitude: -68 })], 'polar')).toBe(true)
})

test('night-owl judges night where the plane was at catch time', () => {
  // 12:00 UTC is midday at longitude 0 and midnight at longitude 180.
  expect(unlocks([withFlight({ longitude: 0 })], 'night-owl')).toBe(false)
  expect(unlocks([withFlight({ longitude: 180 })], 'night-owl')).toBe(true)
})

test('storm-chaser counts saved hazards and the thunderstorm quest', () => {
  expect(unlocks([entry({ hazards: ['icing'] })], 'storm-chaser')).toBe(false)
  expect(unlocks([entry({ hazards: ['thunderstorm'] })], 'storm-chaser')).toBe(
    true,
  )
  expect(
    unlocks([entry({ questId: 'weather-thunderstorm' })], 'storm-chaser'),
  ).toBe(true)
})

test('the first-of-a-kind badges read the type catalog', () => {
  expect(unlocks([withFlight({ aircraft_type: 'B744' })], 'four-engines')).toBe(
    true,
  )
  expect(unlocks([withFlight({ aircraft_type: 'B77W' })], 'four-engines')).toBe(
    false,
  )
  expect(unlocks([withFlight({ aircraft_type: 'R44' })], 'helicopter')).toBe(
    true,
  )
  expect(unlocks([entry()], 'helicopter')).toBe(false)
})

test('streak badges need days in a row, not just days', () => {
  const quest = (day: number) =>
    entry({
      questId: 'high',
      caughtAt: new Date(2026, 8, day, 12).toISOString(),
    })
  expect(unlocks([quest(20), quest(22), quest(24)], 'streak-3')).toBe(false)
  expect(unlocks([quest(20), quest(21), quest(22)], 'streak-3')).toBe(true)
})

test('globetrotter needs 10 destination countries', () => {
  const to = (icao: string) =>
    withFlight({
      destination: { icao, iata: 'XXX', name: icao, latitude: 0, longitude: 0 },
    })
  const nine = [
    'EGLL',
    'LFPG',
    'EDDF',
    'EHAM',
    'LEMD',
    'LPPT',
    'LIRF',
    'LOWW',
    'LGAV',
  ].map(to)
  expect(unlocks(nine, 'ten-countries')).toBe(false)
  expect(unlocks([...nine, to('KJFK')], 'ten-countries')).toBe(true)
})
