import { expect, test } from 'vitest'
import { pickFeatured } from './featured'
import type { Quest } from './quest'
import type { Flight } from './types'

const flight = (id: string, aircraft_type: string): Flight => ({
  id,
  callsign: id.toUpperCase(),
  aircraft_type,
  latitude: 48.5,
  longitude: 2.3,
  altitude_ft: 30000,
  heading: 90,
  speed_kt: 450,
  duration_min: 95,
  origin: null,
  destination: null,
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

test('includes a flight that completes the quest', () => {
  const quest: Quest = {
    id: 'q',
    title: 'q',
    conceptFact: '',
    matches: (f) => f.id === 'a3',
  }
  expect(pickFeatured(flights, quest, none, day)).toContain('a3')
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

test('a flight inside weather can be featured for a weather quest', () => {
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
  const ids = pickFeatured([outside, inWeather], quest, none, day, new Date(), [
    areaOverFlight,
  ])
  expect(ids[0]).toBe('w1')
})
