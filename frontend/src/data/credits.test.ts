import { expect, test } from 'vitest'
import { creditLine } from './credits'

test('mock data and unknown sources show no credit line', () => {
  expect(creditLine({ source: 'mock', weather_source: 'mock' })).toBeNull()
  expect(creditLine(null)).toBeNull()
})

test('live flights credit OpenSky, the aircraft database and adsbdb', () => {
  expect(creditLine({ source: 'opensky', weather_source: 'mock' })).toBe(
    'Live flights: OpenSky Network. Aircraft types: OpenSky aircraft database. Routes: adsbdb.',
  )
})

test('live weather alone credits only the Aviation Weather Center', () => {
  expect(creditLine({ source: 'mock', weather_source: 'awc' })).toBe(
    'Weather: Aviation Weather Center.',
  )
})

test('both live sources are credited', () => {
  const line = creditLine({ source: 'opensky', weather_source: 'awc' })
  expect(line).toContain('OpenSky Network')
  expect(line).toContain('Aviation Weather Center')
})
