import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { FlightMap } from './FlightMap'
import { MAP_BOUNDS } from './projection'
import type { Flight } from './types'

const flight = (id: string, latitude: number, longitude: number): Flight => ({
  id,
  callsign: `CS${id}`,
  aircraft_type: 'A320',
  latitude,
  longitude,
  altitude_ft: 30000,
  heading: 90,
  duration_min: 60,
})

test('renders one dot per flight at its projected position', () => {
  const { west, north } = MAP_BOUNDS
  render(<FlightMap flights={[flight('1', north, west), flight('2', 49, 5)]} />)

  const first = screen.getByTitle('CS1')
  expect(first.style.left).toBe('0%')
  expect(first.style.top).toBe('0%')
  expect(screen.getByTitle('CS2')).toBeTruthy()
})
