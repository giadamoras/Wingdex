import { expect, test } from 'vitest'
import { approxDistanceNm, jumpedFlightIds } from './motion'
import type { Flight } from './types'

const flight = (id: string, latitude: number, longitude: number): Flight => ({
  id,
  callsign: `CS${id}`,
  aircraft_type: 'A320',
  latitude,
  longitude,
  altitude_ft: 30000,
  heading: 90,
  speed_kt: 450,
  duration_min: 60,
  origin: null,
  destination: null,
})

test('one degree of latitude is 60 nm', () => {
  expect(approxDistanceNm(flight('a', 50, 0), flight('a', 51, 0))).toBeCloseTo(
    60,
  )
})

test('a degree of longitude shrinks away from the equator', () => {
  const nm = approxDistanceNm(flight('a', 60, 0), flight('a', 60, 1))
  expect(nm).toBeCloseTo(30) // cos(60°) = 0.5
})

test('a normal move between polls is not a jump', () => {
  // 450 kt for 5 s is about 0.6 nm, i.e. 0.01 degrees of latitude.
  const prev = [flight('1', 50, 0)]
  const next = [flight('1', 50.01, 0)]
  expect(jumpedFlightIds(prev, next, 5).size).toBe(0)
})

test('a move further than the flight could fly is a jump', () => {
  const prev = [flight('1', 50, 0), flight('2', 45, 5)]
  const next = [flight('1', 40, -10), flight('2', 45.01, 5)]
  expect(jumpedFlightIds(prev, next, 5)).toEqual(new Set(['1']))
})

test('the allowance grows with the time between responses', () => {
  // About 12 nm: too far for 5 s, fine after a 1-minute gap of failed polls.
  const prev = [flight('1', 50, 0)]
  const next = [flight('1', 50.2, 0)]
  expect(jumpedFlightIds(prev, next, 5).size).toBe(1)
  expect(jumpedFlightIds(prev, next, 60).size).toBe(0)
})

test('flights new to the feed are not jumps', () => {
  expect(jumpedFlightIds([], [flight('1', 50, 0)], 5).size).toBe(0)
})
