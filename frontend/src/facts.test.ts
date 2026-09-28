import { expect, test } from 'vitest'
import { getFact } from './facts'

const flight = {
  id: 'f1',
  callsign: 'BAW117',
  aircraft_type: 'A320',
  latitude: 50,
  longitude: -30, // over the North Atlantic
  altitude_ft: 36000,
  heading: 270,
  speed_kt: 450,
  duration_min: 95,
  origin: null,
  destination: null,
}

const noon = new Date(Date.UTC(2026, 8, 28, 12, 0))

test('the same flight gets the same fact all day', () => {
  const morning = new Date(2026, 8, 28, 8, 0)
  const evening = new Date(2026, 8, 28, 20, 0)
  // Time of day at the plane changes the pool, so compare at one instant.
  expect(getFact(flight, morning)).toBe(getFact(flight, morning))
  expect(getFact(flight, evening)).toBe(getFact(flight, evening))
})

test('different flights can get different facts', () => {
  const facts = new Set(
    Array.from({ length: 30 }, (_, i) =>
      getFact({ ...flight, id: `f${i}` }, noon),
    ),
  )
  expect(facts.size).toBeGreaterThan(1)
})

test('the fact changes from day to day', () => {
  const facts = new Set(
    Array.from({ length: 30 }, (_, i) =>
      getFact(flight, new Date(2026, 8, 1 + i, 12, 0)),
    ),
  )
  expect(facts.size).toBeGreaterThan(1)
})

test('an unknown type and callsign still get a fact from other attributes', () => {
  const fact = getFact({ ...flight, aircraft_type: 'ZZZZ', callsign: '' }, noon)
  expect(fact.length).toBeGreaterThan(0)
})

test('an aircraft type with facts can show one of its own', () => {
  const texts = new Set(
    Array.from({ length: 200 }, (_, i) =>
      getFact({ ...flight, id: `f${i}`, aircraft_type: 'E190' }, noon),
    ),
  )
  expect(
    texts.has(
      'The Embraer E190 seats passengers 2+2, so there is no middle seat.',
    ),
  ).toBe(true)
})
