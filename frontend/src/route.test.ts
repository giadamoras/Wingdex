import { expect, test } from 'vitest'
import { mergeRoute, needsRoute } from './route'
import type { Airport, Flight, FlightRoute } from './types'

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
