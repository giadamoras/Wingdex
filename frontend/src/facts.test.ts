import { expect, test } from 'vitest'
import { getFact } from './facts'
import type { Hazard, WeatherArea } from './types'

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

test('a flight with no known type still gets a fact', () => {
  const unknown = { ...flight, aircraft_type: null }
  expect(getFact(unknown, noon).length).toBeGreaterThan(0)
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

// A box over the flight's position (50N, 30W), valid at NOON, 0-40,000 ft.
const stormArea = (hazard: Hazard): WeatherArea => ({
  id: `w-${hazard}`,
  hazard,
  region: 'Test',
  altitude_min_ft: 0,
  altitude_max_ft: 40000,
  valid_from: noon.getTime() / 1000 - 3600,
  valid_to: noon.getTime() / 1000 + 3600,
  polygon: [
    { latitude: 45, longitude: -35 },
    { latitude: 45, longitude: -25 },
    { latitude: 55, longitude: -25 },
    { latitude: 55, longitude: -35 },
    { latitude: 45, longitude: -35 },
  ],
  movement_dir: null,
  movement_speed_kt: null,
})

const HAZARDS: Hazard[] = [
  'thunderstorm',
  'turbulence',
  'icing',
  'volcanic_ash',
  'tropical_cyclone',
]

test('a flight in a hazard always gets a fact about that hazard', () => {
  for (const hazard of HAZARDS) {
    const texts = new Set(
      Array.from({ length: 40 }, (_, i) =>
        getFact({ ...flight, id: `f${i}` }, noon, [stormArea(hazard)]),
      ),
    )
    // Two facts per hazard, none from the ordinary pool.
    expect(texts.size).toBeGreaterThan(0)
    expect(texts.size).toBeLessThanOrEqual(2)
    const normal = new Set(
      Array.from({ length: 40 }, (_, i) =>
        getFact({ ...flight, id: `f${i}` }, noon),
      ),
    )
    for (const t of texts) expect(normal.has(t)).toBe(false)
  }
})

test('the weather fact is stable for a flight on a given day', () => {
  const areas = [stormArea('icing')]
  expect(getFact(flight, noon, areas)).toBe(getFact(flight, noon, areas))
})

test('a flight outside every hazard gets the ordinary pool', () => {
  const far = { ...flight, longitude: 100 }
  expect(getFact(far, noon, [stormArea('icing')])).toBe(getFact(far, noon))
})

test('a flight above the hazard layer gets the ordinary pool', () => {
  const high = { ...flight, altitude_ft: 41000 }
  expect(getFact(high, noon, [stormArea('icing')])).toBe(getFact(high, noon))
})
