import { expect, test } from 'vitest'
import {
  airlineOf,
  altitudeBand,
  isOverLand,
  regionsOf,
  timeOfDay,
} from './attributes'

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
