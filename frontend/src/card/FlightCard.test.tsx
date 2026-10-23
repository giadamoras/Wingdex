import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { FlightCard } from './FlightCard'
import type { Flight, FlightRoute } from '../data/types'
import { cardField } from '../testFlight'

afterEach(cleanup)

const flight: Flight = {
  id: 'RYR123',
  callsign: 'RYR123',
  aircraft_type: 'A332',
  latitude: 52,
  longitude: -3,
  altitude_ft: 36000,
  heading: 300,
  speed_kt: 450,
  duration_min: 95,
  duration_estimated: true,
  origin: {
    icao: 'EGKK',
    iata: 'LGW',
    name: 'London Gatwick Airport',
    latitude: 51.1,
    longitude: -0.19,
    city: 'London',
  },
  destination: {
    icao: 'EIDW',
    iata: 'DUB',
    name: 'Dublin Airport',
    latitude: 53.4,
    longitude: -6.3,
    city: 'Dublin',
  },
  vertical_rate_fpm: 1850,
  registered_country: 'Ireland',
}

const details: FlightRoute = {
  aircraft_type: 'A332',
  origin: flight.origin,
  destination: flight.destination,
  duration_min: 95,
  duration_estimated: true,
  airline: 'Ryanair',
  airline_country: 'Ireland',
  registration: 'EI-EJH',
  manufacturer: 'Airbus',
  model: 'A330 202',
  operator: 'Italia Trasporto Aereo',
}

function card(f: Flight, d: FlightRoute | null) {
  render(
    <FlightCard
      flight={f}
      fact="A fact."
      routeStatus={d ? 'ready' : 'idle'}
      details={d}
      lost={false}
      caught={false}
      replaying={false}
      replayed={false}
      onCatch={() => {}}
      onReplay={() => {}}
      onStopReplay={() => {}}
    />,
  )
}

test('lists the airline, aircraft, owner and registration country', () => {
  card(flight, details)
  expect(cardField('Name')).toBe('Ryanair · Ireland')
  expect(cardField('Type')).toBe('Airbus A330-200 (A332)') // the catalog name
  expect(cardField('Tail number')).toBe('EI-EJH')
  expect(cardField('Owner')).toBe('Italia Trasporto Aereo')
  expect(cardField('Registered in')).toBe('Ireland')
  expect(screen.getByText('London → Dublin')).toBeTruthy()
})

test('the airline catalog fills the Airline section without a lookup', () => {
  card({ ...flight, callsign: 'BAW117' }, null)
  expect(cardField('Name')).toBe('British Airways · United Kingdom')
  expect(cardField('Radio callsign')).toBe('Speedbird 117')
})

test('an airline the catalog lacks comes from the lookup', () => {
  card({ ...flight, callsign: 'ZZZ12' }, details)
  expect(cardField('Name')).toBe('Ryanair · Ireland') // the lookup's answer
  expect(cardField('Radio callsign')).toBeNull()
})

test('says climbing or descending with the rate', () => {
  card(flight, details)
  expect(cardField('Climb rate')).toBe('Climbing · 1,900 ft/min')
  expect(cardField('Altitude')).toBe('36,000 ft · 11.0 km') // on its own
})

test('an owner that is the airline is not repeated', () => {
  card(flight, { ...details, operator: 'ryanair' })
  expect(cardField('Owner')).toBeNull()
})

test('shows only what is known, and nothing without a lookup', () => {
  const bare: Flight = {
    ...flight,
    callsign: 'N123AB', // a private plane: no airline in the catalog
    vertical_rate_fpm: null,
    registered_country: null,
    origin: null,
    destination: null,
  }
  card(bare, null)
  expect(screen.queryByRole('link')).toBeNull()
  expect(document.querySelector('.cities')).toBeNull()
  expect(document.querySelector('.card-route')).toBeNull() // no lookup ran
  for (const label of ['Name', 'Tail number', 'Registered in', 'Owner'])
    expect(cardField(label), label).toBeNull()
  expect(cardField('Climb rate')).toBeNull() // the rate is unknown
})

test('the catalog name, else the lookup model, else the bare code', () => {
  card(flight, null)
  expect(cardField('Type')).toBe('Airbus A330-200 (A332)')
  cleanup()
  card({ ...flight, aircraft_type: 'E190' }, null)
  expect(cardField('Type')).toBe('Embraer E190') // the name says the code
  cleanup()
  card({ ...flight, aircraft_type: 'ZZZZ' }, details) // not in the catalog
  expect(cardField('Type')).toBe('Airbus A330 202')
  cleanup()
  card({ ...flight, aircraft_type: 'ZZZZ' }, null)
  expect(cardField('Type')).toBe('ZZZZ')
})

test('a model that already names the maker is not repeated', () => {
  const unknown = { ...flight, aircraft_type: null }
  card(unknown, { ...details, model: 'Boeing 737-800', manufacturer: 'Boeing' })
  expect(cardField('Type')).toBe('Boeing 737-800')
})

test('the progress line shows how far along the route the plane is', () => {
  card(flight, null)
  const line = screen.getByRole('img', { name: /% of the way there$/ })
  // Over Wales, between Gatwick and Dublin: a little under halfway (45%).
  const percent = Number(line.getAttribute('aria-label')!.split('%')[0])
  expect(percent).toBeGreaterThan(35)
  expect(percent).toBeLessThan(55)
  // The time left under it, worked out like the forecast's landing time.
  expect(document.querySelector('.journey-left')?.textContent).toMatch(
    /^About \d+m to go$/,
  )
  // Not a row of its own any more.
  expect(cardField('Time left')).toBeNull()
  cleanup()
  card({ ...flight, origin: null }, null)
  expect(screen.queryByRole('img', { name: /of the way/ })).toBeNull()
})
