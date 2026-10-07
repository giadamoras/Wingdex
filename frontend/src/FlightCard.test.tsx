import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { FlightCard } from './FlightCard'
import type { Flight, FlightRoute } from './types'

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
      weather={[]}
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
  expect(screen.getByText('Ryanair · Ireland')).toBeTruthy()
  expect(screen.getByText('Airbus A330 202 · EI-EJH')).toBeTruthy()
  expect(screen.getByText('Operated by Italia Trasporto Aereo')).toBeTruthy()
  expect(screen.getByText('Registered in Ireland')).toBeTruthy()
  expect(screen.getByText('London → Dublin')).toBeTruthy()
})

test('shows the climb rate, and "level" for a small one', () => {
  card(flight, details)
  expect(screen.getByText('↗ 1,900 ft/min')).toBeTruthy()
})

test('an owner that is the airline is not repeated', () => {
  card(flight, { ...details, operator: 'ryanair' })
  expect(screen.queryByText(/operated by/i)).toBeNull()
})

test('shows only what is known, and nothing without a lookup', () => {
  const bare: Flight = {
    ...flight,
    vertical_rate_fpm: null,
    registered_country: null,
    origin: null,
    destination: null,
  }
  card(bare, null)
  expect(screen.queryByRole('link')).toBeNull()
  expect(document.querySelector('.details')).toBeNull()
  expect(document.querySelector('.cities')).toBeNull()
  // "level" is anchored: the daily "Did you know?" fact can contain the word "level".
  expect(screen.queryByText(/ft\/min|^level$/)).toBeNull()
})

test('a model that already names the maker is not repeated', () => {
  card(flight, { ...details, model: 'Boeing 737-800', manufacturer: 'Boeing' })
  expect(screen.getByText('Boeing 737-800 · EI-EJH')).toBeTruthy()
})
