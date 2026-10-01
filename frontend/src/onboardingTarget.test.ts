import { expect, test } from 'vitest'
import { pickOnboardingTarget } from './onboardingTarget'
import type { Flight } from './types'

const flight = (id: string, latitude: number, longitude: number): Flight => ({
  id,
  callsign: `CS${id}`,
  aircraft_type: 'A320',
  latitude,
  longitude,
  altitude_ft: 30000,
  heading: 90,
  speed_kt: 450,
  duration_min: 60,
  origin: null,
  destination: null,
})

test('picks the flight closest to the default view centre (50, 10)', () => {
  const near = flight('near', 49, 9)
  const far = flight('far', -30, 150)
  expect(pickOnboardingTarget([far, near])).toBe(near)
})

test('returns null for an empty feed', () => {
  expect(pickOnboardingTarget([])).toBe(null)
})
