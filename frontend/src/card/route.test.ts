import { expect, test } from 'vitest'
import {
  arrivalTime,
  journeyProgress,
  mergeRoute,
  needsRoute,
  timeLeftWords,
} from './route'
import type { Airport, Flight, FlightRoute } from '../data/types'
import { makeFlight } from '../testFlight'

const lhr: Airport = {
  icao: 'EGLL',
  iata: 'LHR',
  name: 'London Heathrow',
  latitude: 51.47,
  longitude: -0.45,
}
const jfk: Airport = {
  icao: 'KJFK',
  iata: 'JFK',
  name: 'New York JFK',
  latitude: 40.64,
  longitude: -73.78,
}

const live: Flight = {
  id: 'BAW117',
  callsign: 'BAW117',
  aircraft_type: null,
  latitude: 52,
  longitude: -30,
  altitude_ft: 36000,
  heading: 270,
  speed_kt: 480,
  duration_min: null,
  origin: null,
  destination: null,
}

const full: FlightRoute = {
  aircraft_type: 'B77W',
  origin: lhr,
  destination: jfk,
  duration_min: 433,
  duration_estimated: true,
}

test('a lookup fills in the type, route and estimated duration', () => {
  expect(mergeRoute(live, full)).toEqual({
    ...live,
    aircraft_type: 'B77W',
    origin: lhr,
    destination: jfk,
    duration_min: 433,
    duration_estimated: true,
  })
})

test('no lookup result leaves the flight as it is', () => {
  expect(mergeRoute(live, null)).toBe(live)
})

test('a type-only answer adds just the type', () => {
  const typeOnly: FlightRoute = {
    aircraft_type: 'B77W',
    origin: null,
    destination: null,
    duration_min: null,
    duration_estimated: false,
  }
  const merged = mergeRoute(live, typeOnly)
  expect(merged.aircraft_type).toBe('B77W')
  expect(merged.origin).toBeNull()
  expect(merged.duration_min).toBeNull()
  expect(merged.duration_estimated).toBeFalsy()
})

test("the feed's own values win over the lookup", () => {
  const known = { ...live, aircraft_type: 'A359' }
  expect(mergeRoute(known, full).aircraft_type).toBe('A359')
})

test('only a flight without a full route needs a lookup', () => {
  expect(needsRoute(live)).toBe(true)
  expect(needsRoute({ ...live, origin: lhr })).toBe(true)
  expect(needsRoute({ ...live, origin: lhr, destination: jfk })).toBe(false)
})

// 60 nm (one degree of latitude) from Heathrow at 480 kt: 7.5 minutes.
const T0 = Date.UTC(2026, 9, 22, 12) / 1000
const inbound = makeFlight({
  latitude: 50.47,
  longitude: -0.45,
  speed_kt: 480,
  destination: lhr,
})

test('arrival is the remaining distance at the current ground speed', () => {
  const now = T0 * 1000
  expect(arrivalTime(inbound, now)! - T0).toBeCloseTo(450, -1)
  expect(arrivalTime({ ...inbound, destination: null }, now)).toBeNull()
  expect(arrivalTime({ ...inbound, speed_kt: 20 }, now)).toBeNull()
})

test('time left reads like the flight time, and "Landing soon" at the end', () => {
  const now = T0 * 1000
  expect(timeLeftWords(inbound, now)).toBe('About 8m')
  expect(timeLeftWords({ ...inbound, speed_kt: 30 * 60 }, now)).toBe(
    'Landing soon',
  ) // 2 minutes out
  // From New York at 480 kt: about 3,000 nm, over 6 hours.
  expect(
    timeLeftWords({ ...inbound, latitude: 40.64, longitude: -73.78 }, now),
  ).toMatch(/^About 6h \d{2}m$/)
  expect(timeLeftWords({ ...inbound, destination: null }, now)).toBeNull()
  expect(timeLeftWords({ ...inbound, speed_kt: 20 }, now)).toBeNull()
})

test('journey progress is the share of the route flown', () => {
  const route = { origin: jfk, destination: lhr }
  // Halfway along the meridian between two points on it.
  const halfway = makeFlight({
    latitude: 51,
    longitude: 0,
    origin: { ...lhr, latitude: 50, longitude: 0 },
    destination: { ...lhr, latitude: 52, longitude: 0 },
  })
  expect(journeyProgress(halfway)).toBeCloseTo(0.5, 3)
  // At the origin: nothing flown; at the destination: all of it.
  const at = (a: Airport) =>
    makeFlight({ ...route, latitude: a.latitude, longitude: a.longitude })
  expect(journeyProgress(at(jfk))).toBe(0)
  expect(journeyProgress(at(lhr))).toBeCloseTo(1, 3)
  expect(
    journeyProgress(makeFlight({ ...route, destination: null })),
  ).toBeNull()
})
