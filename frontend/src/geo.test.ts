import { expect, test } from 'vitest'
import {
  angularDistance,
  bearing,
  interpolate,
  progressAlong,
  routePoints,
} from './geo'

const LHR = { latitude: 51.47, longitude: -0.454 }
const JFK = { latitude: 40.641, longitude: -73.778 }
const pt = (latitude: number, longitude: number) => ({ latitude, longitude })

test('London to New York is about 2,990 nm', () => {
  // 3440 nm = Earth's mean radius, the same constant as the backend.
  expect(angularDistance(LHR, JFK) * 3440.065).toBeCloseTo(2990, -2)
})

test('interpolate hits both ends and the midpoint', () => {
  expect(interpolate(LHR, JFK, 0).latitude).toBeCloseTo(LHR.latitude)
  expect(interpolate(LHR, JFK, 1).longitude).toBeCloseTo(JFK.longitude)
  const mid = interpolate(pt(0, 0), pt(0, 90), 0.5)
  expect(mid.latitude).toBeCloseTo(0)
  expect(mid.longitude).toBeCloseTo(45)
})

test('the great circle to New York bends north of both airports', () => {
  expect(interpolate(LHR, JFK, 0.5).latitude).toBeGreaterThan(LHR.latitude)
})

test('bearing: east, north, and London to New York', () => {
  expect(bearing(pt(0, 0), pt(0, 10))).toBeCloseTo(90)
  expect(bearing(pt(0, 0), pt(10, 0))).toBeCloseTo(0)
  expect(bearing(LHR, JFK)).toBeCloseTo(288, -1)
})

test('progressAlong measures how far along the route a point is', () => {
  expect(progressAlong(LHR, JFK, LHR)).toBe(0)
  expect(progressAlong(LHR, JFK, interpolate(LHR, JFK, 0.3))).toBeCloseTo(0.3)
  expect(progressAlong(LHR, JFK, JFK)).toBeCloseTo(1)
})

test('routePoints covers the requested section, ends included', () => {
  const all = routePoints(LHR, JFK)
  expect(all).toHaveLength(65)
  expect(all[0].latitude).toBeCloseTo(LHR.latitude)
  expect(all[64].longitude).toBeCloseTo(JFK.longitude)

  const second = routePoints(LHR, JFK, 0.5, 1)
  expect(second.length).toBeLessThan(all.length)
  expect(second[0].latitude).toBeCloseTo(interpolate(LHR, JFK, 0.5).latitude)
})
