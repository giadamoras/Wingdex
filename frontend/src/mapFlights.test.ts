import { expect, test } from 'vitest'
import { flightsForMap } from './mapFlights'
import type { Flight } from './types'

const flight = (id: string, altitude_ft = 30000): Flight => ({
  id,
  callsign: id.toUpperCase(),
  aircraft_type: 'A320',
  latitude: 48.5,
  longitude: 2.3,
  altitude_ft,
  heading: 90,
  speed_kt: 450,
  duration_min: 95,
  origin: null,
  destination: null,
})

const feed = [flight('a'), flight('b')]

test('with nothing selected the feed is drawn as it is', () => {
  expect(flightsForMap(feed, null, false)).toBe(feed)
})

test('before the first response there is nothing to draw', () => {
  expect(flightsForMap(null, null, false)).toEqual([])
})

test('the selected flight replaces its feed copy, in place', () => {
  const current = flight('b', 11000) // the same flight, with its route merged in
  const drawn = flightsForMap(feed, current, false)
  expect(drawn).toHaveLength(2)
  expect(drawn[0]).toBe(feed[0])
  expect(drawn[1]).toBe(current)
})

test('a lost flight is added at the end, at its last position', () => {
  const lostFlight = flight('gone')
  expect(flightsForMap(feed, lostFlight, true)).toEqual([...feed, lostFlight])
})
