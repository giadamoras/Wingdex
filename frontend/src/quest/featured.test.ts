import { expect, test } from 'vitest'
import { pickFeatured, pickQuestFlight } from './featured'
import type { Quest } from './quest'
import type { Flight } from '../data/types'
import { makeFlight } from '../testFlight'

const flight = (id: string, aircraft_type: string | null): Flight =>
  makeFlight({
    id,
    callsign: id.toUpperCase(),
    aircraft_type,
    latitude: 48.5,
    longitude: 2.3,
  })

const day = '2026-09-28'
const none = new Set<string>()

// Four common A320s, one B748 and one AT76: the last two are rare.
const flights = [
  flight('a1', 'A320'),
  flight('a2', 'A320'),
  flight('a3', 'A320'),
  flight('a4', 'A320'),
  flight('b1', 'B748'),
  flight('t1', 'AT76'),
]

test('picks the rarest aircraft types, one flight per type', () => {
  const ids = pickFeatured(flights, null, none, day)
  expect(ids).toHaveLength(3)
  expect(ids).toContain('b1')
  expect(ids).toContain('t1')
  const types = ids.map((id) => flights.find((f) => f.id === id)!.aircraft_type)
  expect(new Set(types).size).toBe(3)
})

test('a flight with no known type is never featured for its type', () => {
  const mixed = [flight('u1', null), flight('u2', null), flight('a1', 'A320')]
  expect(pickFeatured(mixed, null, none, day)).toEqual(['a1'])
})

const fits = (id: string): Quest => ({
  id: 'q',
  title: 'q',
  conceptFact: '',
  matches: (f) => f.id === id,
})

test('a flight that fits the quest is never featured: that would give it away', () => {
  // b1 is the rarest type, but it completes the quest.
  const ids = pickFeatured(flights, fits('b1'), none, day)
  expect(ids).not.toContain('b1')
  expect(ids).toContain('t1')
})

test('the quest flight is picked on its own, for the hint', () => {
  expect(pickQuestFlight(flights, fits('a3'), none, day)).toBe('a3')
  // A flight with no known type can fit the quest too.
  const mixed = [flight('u1', null), flight('a1', 'A320')]
  expect(pickQuestFlight(mixed, fits('u1'), none, day)).toBe('u1')
  // None fits, there is no quest, or it is already caught today.
  expect(pickQuestFlight(flights, fits('zz'), none, day)).toBeNull()
  expect(pickQuestFlight(flights, null, none, day)).toBeNull()
  expect(pickQuestFlight(flights, fits('a3'), new Set(['a3']), day)).toBeNull()
})

test('skips flights already caught today', () => {
  const ids = pickFeatured(flights, null, new Set(['b1', 't1']), day)
  expect(ids).not.toContain('b1')
  expect(ids).not.toContain('t1')
})

test('is stable for the same feed and day', () => {
  expect(pickFeatured(flights, null, none, day)).toEqual(
    pickFeatured(flights, null, none, day),
  )
})

test('returns fewer flights when the feed is small', () => {
  expect(pickFeatured([flights[0]], null, none, day)).toEqual(['a1'])
  expect(pickFeatured([], null, none, day)).toEqual([])
})

test('a flight inside weather is the quest flight for a weather quest', () => {
  const areaOverFlight = {
    id: 'w',
    hazard: 'turbulence' as const,
    region: 'Test',
    altitude_min_ft: 0,
    altitude_max_ft: 40000,
    valid_from: 0,
    valid_to: 4_000_000_000,
    polygon: [
      { latitude: 40, longitude: 0 },
      { latitude: 40, longitude: 10 },
      { latitude: 50, longitude: 10 },
      { latitude: 50, longitude: 0 },
      { latitude: 40, longitude: 0 },
    ],
    movement_dir: null,
    movement_speed_kt: null,
  }
  const inWeather = { ...flight('w1', 'A320'), latitude: 45, longitude: 5 }
  const outside = { ...flight('o1', 'A320'), latitude: 20, longitude: 5 }
  const quest: Quest = {
    id: 'weather-turbulence',
    title: 'q',
    conceptFact: 'f',
    matches: (f, _at, weather = []) =>
      weather.some(
        (a) =>
          f.latitude >= 40 && f.latitude <= 50 && a.hazard === 'turbulence',
      ),
  }
  // Only the flight inside the box completes it, so it must be picked.
  expect(
    pickQuestFlight([outside, inWeather], quest, none, day, new Date(), [
      areaOverFlight,
    ]),
  ).toBe('w1')
})
