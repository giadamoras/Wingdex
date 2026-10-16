import { expect, test } from 'vitest'
import { aircraftShape, SILHOUETTES } from './aircraftSilhouette'

// The 11 ICAO codes actually used in the mock data (backend/app/mock_flights.py).
test('classifies every mock aircraft type into the expected shape', () => {
  expect(aircraftShape('A319')).toBe('narrowBody')
  expect(aircraftShape('A320')).toBe('narrowBody')
  expect(aircraftShape('A321')).toBe('narrowBody')
  expect(aircraftShape('B738')).toBe('narrowBody')
  expect(aircraftShape('E190')).toBe('regionalJet')
  expect(aircraftShape('A333')).toBe('wideBodyTwin')
  expect(aircraftShape('A359')).toBe('wideBodyTwin')
  expect(aircraftShape('B77W')).toBe('wideBodyTwin')
  expect(aircraftShape('A388')).toBe('quadOrDoubleDeck')
  expect(aircraftShape('B748')).toBe('quadOrDoubleDeck')
  expect(aircraftShape('AT76')).toBe('turboprop')
})

// The lists the catalog replaced (REGIONAL_JET and QUAD_OR_DOUBLE_DECK): every
// code in them keeps its shape. The old list's E175 is left out: it is not an
// ICAO code (the E175 is E75L or E75S).
test('the old regional-jet and quad codes keep their shape', () => {
  for (const code of ['E170', 'E190', 'E195'])
    expect(aircraftShape(code), code).toBe('regionalJet')
  for (const code of [
    'A342',
    'A343',
    'A345',
    'A346',
    'A388',
    'B742',
    'B744',
    'B748',
  ])
    expect(aircraftShape(code), code).toBe('quadOrDoubleDeck')
})

test('categories without a shape of their own use the narrow-body default', () => {
  expect(aircraftShape('GLF6')).toBe('narrowBody') // business jet
  expect(aircraftShape('C172')).toBe('narrowBody') // light aircraft
  expect(aircraftShape('R44')).toBe('narrowBody') // helicopter
})

test('an unrecognized type code falls back to the narrow-body default', () => {
  expect(aircraftShape('ZZZZ')).toBe('narrowBody')
})

test('an unknown (null) type gets the narrow-body default', () => {
  expect(aircraftShape(null)).toBe('narrowBody')
})

test('every shape has a non-empty silhouette path', () => {
  for (const shape of Object.values(SILHOUETTES)) {
    expect(shape.body.length).toBeGreaterThan(0)
  }
})
