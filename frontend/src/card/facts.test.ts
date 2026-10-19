import { expect, test } from 'vitest'
import { FACTS, getFact } from './facts'
import { HAZARDS as ALL_HAZARDS } from '../data/types'
import type { Hazard, WeatherArea } from '../data/types'
import { AIRCRAFT_FAMILIES, AIRCRAFT_TYPES } from '../shared-lib/aircraftTypes'
import { AIRLINES } from '../shared-lib/airlines'

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

// Texts a flight with this type is shown, over 60 flight ids (the pick is a
// fixed hash, so a passing sample keeps passing; more would be slow).
const textsFor = (aircraft_type: string) =>
  new Set(
    Array.from({ length: 60 }, (_, i) =>
      getFact({ ...flight, id: `f${i}`, aircraft_type }, noon),
    ),
  )

test('an aircraft type with facts can show one of its own', () => {
  expect(
    textsFor('A321').has(
      'The A321 is an A320 stretched by about 7 metres to fit more passengers.',
    ),
  ).toBe(true)
})

test('a family fact reaches every type in that family', () => {
  const eJets =
    'Embraer E-Jets seat passengers 2+2, so there is no middle seat.'
  expect(textsFor('E190').has(eJets)).toBe(true)
  expect(textsFor('E75L').has(eJets)).toBe(true) // an E175, no fact of its own
  expect(textsFor('A320').has(eJets)).toBe(false)
})

test('a category fact reaches types with no fact of their own', () => {
  const values = new Map(FACTS.map((f) => [f.text, f.value]))
  // A Robinson R44 has no type or family fact, only helicopter ones.
  const r44 = [...textsFor('R44')].map((t) => values.get(t))
  expect(r44).toContain('helicopter')
})

test('about 2 flights in 3 get an aircraft or airline fact', () => {
  const specific = new Set(
    FACTS.filter((f) =>
      ['type', 'family', 'category', 'airline'].includes(f.kind),
    ).map((f) => f.text),
  )
  const n = 150
  let hits = 0
  for (let i = 0; i < n; i++)
    if (specific.has(getFact({ ...flight, id: `f${i}` }, noon))) hits++
  // 2/3 is 100 of 150; the hash makes it close, not exact.
  expect(hits / n).toBeGreaterThan(0.55)
  expect(hits / n).toBeLessThan(0.78)
})

// The JSON is only cast to Fact, so check every entry against what it can
// match: a tag that matches nothing would never be shown.
test('every fact is well formed and can match a flight', () => {
  const valid: Record<string, string[]> = {
    type: Object.keys(AIRCRAFT_TYPES),
    family: Object.keys(AIRCRAFT_FAMILIES),
    altitude: ['low', 'mid', 'cruise', 'high'],
    region: ['land', 'open-ocean', 'europe', 'north-atlantic'],
    time: ['dawn', 'day', 'dusk', 'night'],
    weather: [...ALL_HAZARDS],
    airline: Object.keys(AIRLINES),
    category: [
      ...new Set(Object.values(AIRCRAFT_TYPES).map((t) => t.category)),
    ],
    phase: ['climbing', 'descending', 'level'],
  }
  for (const fact of FACTS) {
    expect(fact.text.trim().length, fact.value).toBeGreaterThan(0)
    expect(valid[fact.kind], fact.text).toContain(fact.value)
  }
  // No fact twice: the Journal's Facts tab lists them by text.
  expect(new Set(FACTS.map((f) => f.text)).size).toBe(FACTS.length)
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
  'mountain_wave',
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
