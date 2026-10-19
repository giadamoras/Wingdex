import { expect, test } from 'vitest'
import { AIRLINES, airlineFor, radioCallsign } from './airlines'

const KINDS = ['fullService', 'lowCost', 'leisure', 'regional', 'cargo']

// The JSON is only cast to Airline, so check every entry here.
test('every catalog entry is well formed', () => {
  for (const [code, airline] of Object.entries(AIRLINES)) {
    expect(code, code).toMatch(/^[A-Z]{3}$/) // ICAO airline designator
    expect(airline.name.length, code).toBeGreaterThan(0)
    expect(airline.country.length, code).toBeGreaterThan(0)
    expect(KINDS, code).toContain(airline.kind)
    if (airline.radio !== undefined)
      expect(airline.radio.length, code).toBeGreaterThan(0)
  }
})

// The airlines backend/app/mock_flights.py picks from, so every mock flight
// has a name on its card.
test('knows every mock airline', () => {
  // prettier-ignore
  const mock = [
    'BAW', 'DLH', 'AFR', 'KLM', 'RYR', 'EZY', 'IBE', 'TAP', 'THY', 'SAS',
    'AUA', 'ITY', 'VLG', 'AEE', 'UAE', 'QTR', 'ETD', 'ELY', 'AAL', 'UAL',
    'DAL', 'ACA', 'AMX', 'LAN', 'AVA', 'SAA', 'ETH', 'MSR', 'RAM', 'KQA',
    'SIA', 'CPA', 'CCA', 'AIC', 'JAL', 'KAL', 'THA', 'MAS', 'GIA', 'QFA',
    'ANZ', 'FDX', 'CLX', 'BCS', 'CFG', 'NOS',
  ]
  for (const code of mock)
    expect(Object.hasOwn(AIRLINES, code), code).toBe(true)
})

test('finds the airline from a callsign, or null', () => {
  expect(airlineFor('BAW117')?.name).toBe('British Airways')
  expect(airlineFor(' baw117 ')?.name).toBe('British Airways')
  expect(airlineFor('N123AB')).toBeNull() // a private plane
  expect(airlineFor('ZZZ12')).toBeNull() // not in the catalog
  expect(airlineFor('')).toBeNull()
})

test('says the callsign the way a controller would', () => {
  expect(radioCallsign('BAW117')).toBe('Speedbird 117')
  expect(radioCallsign('RYR4KM')).toBe('Ryanair 4KM')
  expect(radioCallsign('WMT301')).toBe('Wizz Malta 301')
  expect(radioCallsign('N123AB')).toBeNull()
})
