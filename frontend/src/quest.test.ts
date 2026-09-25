import { expect, test } from 'vitest'
import { QUEST } from './quest'

const flight = {
  id: 'f1',
  callsign: 'TST1',
  aircraft_type: 'A320',
  latitude: 50,
  longitude: 0,
  altitude_ft: 36000,
  heading: 90,
  duration_min: 95,
}

test('does not match a flight of exactly 6 hours', () => {
  expect(QUEST.matches({ ...flight, duration_min: 360 })).toBe(false)
})

test('matches a flight just over 6 hours', () => {
  expect(QUEST.matches({ ...flight, duration_min: 361 })).toBe(true)
})
