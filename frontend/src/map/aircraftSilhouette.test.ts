import { expect, test } from 'vitest'
import { aircraftFamily, SILHOUETTES } from './aircraftSilhouette'

// The 11 ICAO codes actually used in the mock data (backend/app/mock_flights.py).
test('classifies every mock aircraft type into the expected family', () => {
  expect(aircraftFamily('A319')).toBe('narrowBody')
  expect(aircraftFamily('A320')).toBe('narrowBody')
  expect(aircraftFamily('A321')).toBe('narrowBody')
  expect(aircraftFamily('B738')).toBe('narrowBody')
  expect(aircraftFamily('E190')).toBe('regionalJet')
  expect(aircraftFamily('A333')).toBe('wideBodyTwin')
  expect(aircraftFamily('A359')).toBe('wideBodyTwin')
  expect(aircraftFamily('B77W')).toBe('wideBodyTwin')
  expect(aircraftFamily('A388')).toBe('quadOrDoubleDeck')
  expect(aircraftFamily('B748')).toBe('quadOrDoubleDeck')
  expect(aircraftFamily('AT76')).toBe('turboprop')
})

test('an unrecognized type code falls back to the narrow-body default', () => {
  expect(aircraftFamily('ZZZZ')).toBe('narrowBody')
})

test('an unknown (null) type gets the narrow-body default', () => {
  expect(aircraftFamily(null)).toBe('narrowBody')
})

test('every family has a non-empty silhouette path', () => {
  for (const family of Object.values(SILHOUETTES)) {
    expect(family.body.length).toBeGreaterThan(0)
  }
})
