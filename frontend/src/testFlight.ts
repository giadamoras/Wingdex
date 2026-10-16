import { screen } from '@testing-library/react'
import type { Flight } from './data/types'

// A valid flight for tests: pass only the fields a test cares about.
export const makeFlight = (overrides: Partial<Flight> = {}): Flight => ({
  id: 'f1',
  callsign: 'TST1',
  aircraft_type: 'A320',
  latitude: 50,
  longitude: 0,
  altitude_ft: 30000,
  heading: 90,
  speed_kt: 450,
  duration_min: 95,
  origin: null,
  destination: null,
  ...overrides,
})

// The value of the flight card's field with this label ("Altitude"), as one
// string, or null when the card has no such field.
export function cardField(label: string): string | null {
  const term = screen
    .queryAllByText(label, { selector: 'dt' })
    .find((dt) => dt.closest('.card'))
  // No-break spaces (between a number and its unit) read as plain spaces.
  const text = term?.nextElementSibling?.textContent
  return text === undefined || text === null ? null : text.replace(/\s/g, ' ')
}
