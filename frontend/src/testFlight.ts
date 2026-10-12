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
