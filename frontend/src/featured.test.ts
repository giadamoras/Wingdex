import { expect, test } from 'vitest'
import { pickFeatured } from './featured'
import type { Quest } from './quest'
import type { Flight } from './types'

const flight = (id: string, aircraft_type: string): Flight => ({
  id,
  callsign: id.toUpperCase(),
  aircraft_type,
  latitude: 48.5,
  longitude: 2.3,
  altitude_ft: 30000,
  heading: 90,
  speed_kt: 450,
  duration_min: 95,
  origin: null,
  destination: null,
})

const day = '2026-09-28'
const none = new Set<string>()

// Four common A320s, one B748 and one AT76: the last two are rare.
const flights = [
  flight('a1', 'A320'),
  flight('a2', 'A320'),
  flight('a3', 'A320'),
  flight('a4', 'A320'),
  flight('b1', 'B748'),
  flight('t1', 'AT76'),
]

test('picks the rarest aircraft types, one flight per type', () => {
  const ids = pickFeatured(flights, null, none, day)
  expect(ids).toHaveLength(3)
  expect(ids).toContain('b1')
  expect(ids).toContain('t1')
  const types = ids.map((id) => flights.find((f) => f.id === id)!.aircraft_type)
  expect(new Set(types).size).toBe(3)
})

test('includes a flight that completes the quest', () => {
  const quest: Quest = {
    id: 'q',
    title: 'q',
    conceptFact: '',
    matches: (f) => f.id === 'a3',
  }
  expect(pickFeatured(flights, quest, none, day)).toContain('a3')
})

test('skips flights already caught today', () => {
  const ids = pickFeatured(flights, null, new Set(['b1', 't1']), day)
  expect(ids).not.toContain('b1')
  expect(ids).not.toContain('t1')
})

test('is stable for the same feed and day', () => {
  expect(pickFeatured(flights, null, none, day)).toEqual(
    pickFeatured(flights, null, none, day),
  )
})

test('returns fewer flights when the feed is small', () => {
  expect(pickFeatured([flights[0]], null, none, day)).toEqual(['a1'])
  expect(pickFeatured([], null, none, day)).toEqual([])
})
