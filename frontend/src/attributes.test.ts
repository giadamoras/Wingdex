import { expect, test } from 'vitest'
import {
  airlineOf,
  altitudeBand,
  isOverLand,
  regionsOf,
  timeOfDay,
  weatherAt,
} from './attributes'
import type { WeatherArea } from './types'

test('altitude bands change at 10,000, 30,000 and above 38,000 ft', () => {
  expect(altitudeBand(9_999)).toBe('low')
  expect(altitudeBand(10_000)).toBe('mid')
  expect(altitudeBand(29_999)).toBe('mid')
  expect(altitudeBand(30_000)).toBe('cruise')
  expect(altitudeBand(38_000)).toBe('cruise')
  expect(altitudeBand(38_001)).toBe('high')
})

test('reads the airline code from an airline callsign', () => {
  expect(airlineOf('BAW117')).toBe('BAW')
  expect(airlineOf('ryr8821 ')).toBe('RYR')
})

test('has no airline for private or missing callsigns', () => {
  expect(airlineOf('')).toBeUndefined()
  expect(airlineOf('GABCD')).toBeUndefined()
  expect(airlineOf('N123AB')).toBeUndefined()
})

test('tells land from water', () => {
  expect(isOverLand(48.5, 2.3)).toBe(true) // near Paris
  expect(isOverLand(50, -30)).toBe(false) // mid-Atlantic
  expect(isOverLand(0, -150)).toBe(false) // Pacific
})

test('mid-Atlantic is open ocean and North Atlantic', () => {
  expect(regionsOf(50, -30)).toEqual(['open-ocean', 'north-atlantic'])
})

test('Europe is land, not open ocean', () => {
  expect(regionsOf(48.5, 2.3)).toEqual(['land', 'europe'])
})

test('narrow waters near land are not open ocean', () => {
  expect(regionsOf(50, 0)).not.toContain('open-ocean') // English Channel
  expect(regionsOf(53.5, -5)).not.toContain('open-ocean') // Irish Sea
})

test('the Mediterranean is water but not open ocean', () => {
  expect(regionsOf(36, 15)).not.toContain('open-ocean')
  expect(regionsOf(36, 15)).not.toContain('land')
})

test('time of day follows the sun at the plane, not the viewer', () => {
  const noonUtc = new Date(Date.UTC(2026, 8, 28, 12, 0))
  expect(timeOfDay(0, noonUtc)).toBe('day')
  expect(timeOfDay(180, noonUtc)).toBe('night') // midnight on the date line
  expect(timeOfDay(-90, noonUtc)).toBe('dawn') // 06:00 local
  expect(timeOfDay(90, noonUtc)).toBe('dusk') // 18:00 local
})

test('time of day wraps across midnight', () => {
  const lateUtc = new Date(Date.UTC(2026, 8, 28, 23, 0))
  expect(timeOfDay(30, lateUtc)).toBe('night') // 01:00 local
})

// A box over 40-50N, 0-10E, valid for an hour either side of NOW.
const NOW = new Date(Date.UTC(2026, 8, 28, 12, 0))
const seconds = NOW.getTime() / 1000
const area = (overrides: Partial<WeatherArea> = {}): WeatherArea => ({
  id: 'w',
  hazard: 'thunderstorm',
  region: 'Test',
  altitude_min_ft: 10000,
  altitude_max_ft: 40000,
  valid_from: seconds - 3600,
  valid_to: seconds + 3600,
  polygon: [
    { latitude: 40, longitude: 0 },
    { latitude: 40, longitude: 10 },
    { latitude: 50, longitude: 10 },
    { latitude: 50, longitude: 0 },
    { latitude: 40, longitude: 0 },
  ],
  movement_dir: null,
  movement_speed_kt: null,
  ...overrides,
})
const flyer = { latitude: 45, longitude: 5, altitude_ft: 30000 }

test('a flight inside an area, within its altitude band, is in that hazard', () => {
  expect(weatherAt(flyer, [area()], NOW)).toEqual(['thunderstorm'])
})

test('a flight outside the polygon is not in the hazard', () => {
  expect(weatherAt({ ...flyer, longitude: 20 }, [area()], NOW)).toEqual([])
})

test('the altitude band decides, and its bounds are included', () => {
  const a = area()
  expect(weatherAt({ ...flyer, altitude_ft: 9999 }, [a], NOW)).toEqual([])
  expect(weatherAt({ ...flyer, altitude_ft: 10000 }, [a], NOW)).toHaveLength(1)
  expect(weatherAt({ ...flyer, altitude_ft: 40000 }, [a], NOW)).toHaveLength(1)
  expect(weatherAt({ ...flyer, altitude_ft: 40001 }, [a], NOW)).toEqual([])
})

test('an advisory only counts while it is valid', () => {
  const a = area()
  expect(weatherAt(flyer, [a], new Date((a.valid_from - 1) * 1000))).toEqual([])
  expect(weatherAt(flyer, [a], new Date((a.valid_to + 1) * 1000))).toEqual([])
})

test('overlapping areas give each hazard once', () => {
  const areas = [
    area({ id: 'a', hazard: 'thunderstorm' }),
    area({ id: 'b', hazard: 'icing' }),
    area({ id: 'c', hazard: 'thunderstorm' }),
  ]
  expect(weatherAt(flyer, areas, NOW).sort()).toEqual(['icing', 'thunderstorm'])
})

test('no weather means no hazards', () => {
  expect(weatherAt(flyer, [], NOW)).toEqual([])
})
