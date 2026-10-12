import { expect, test } from 'vitest'
import { pickOnboardingTarget } from './onboardingTarget'
import type { Flight } from '../data/types'
import { makeFlight } from '../testFlight'

const flight = (id: string, latitude: number, longitude: number): Flight =>
  makeFlight({
    id,
    callsign: `CS${id}`,
    latitude,
    longitude,
    duration_min: 60,
  })

test('picks the flight closest to the default view centre (50, 10)', () => {
  const near = flight('near', 49, 9)
  const far = flight('far', -30, 150)
  expect(pickOnboardingTarget([far, near])).toBe(near)
})

test('returns null for an empty feed', () => {
  expect(pickOnboardingTarget([])).toBe(null)
})
