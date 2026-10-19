import { expect, test } from 'vitest'
import {
  COUNTRY_CODES,
  COUNTRY_NAMES,
  countryOfAirport,
  ICAO_PREFIXES,
} from './countries'

test('every prefix is 1 to 3 capital letters with a country name', () => {
  for (const [prefix, country] of Object.entries(ICAO_PREFIXES)) {
    expect(prefix).toMatch(/^[A-Z]{1,3}$/)
    expect(country.trim()).not.toBe('')
  }
})

test("the mock routes' airports all have a country", () => {
  // The airports in backend/app/mock_flights.py.
  const airports: Record<string, string> = {
    EGLL: 'United Kingdom',
    EGPH: 'United Kingdom',
    LFPG: 'France',
    EDDF: 'Germany',
    EDDM: 'Germany',
    EHAM: 'Netherlands',
    LEMD: 'Spain',
    LEBL: 'Spain',
    LPPT: 'Portugal',
    LIRF: 'Italy',
    LIMC: 'Italy',
    LOWW: 'Austria',
    LGAV: 'Greece',
    LTFM: 'Turkey',
    EKCH: 'Denmark',
    ESSA: 'Sweden',
    ENGM: 'Norway',
    EIDW: 'Ireland',
    BIKF: 'Iceland',
    KJFK: 'United States',
    KBOS: 'United States',
    OMDB: 'United Arab Emirates',
    WSSS: 'Singapore',
  }
  for (const [icao, country] of Object.entries(airports))
    expect(countryOfAirport(icao)).toBe(country)
})

test('the longest matching prefix wins', () => {
  expect(countryOfAirport('UUEE')).toBe('Russia') // only "U" matches
  expect(countryOfAirport('UKBB')).toBe('Ukraine') // "UK" beats "U"
  expect(countryOfAirport('UTDD')).toBe('Tajikistan') // "UTD" beats "UT"
  expect(countryOfAirport('UTTT')).toBe('Uzbekistan')
  expect(countryOfAirport('UMKK')).toBe('Russia') // Kaliningrad, not Belarus
})

test('a code that is not an ICAO airport code, or unknown, has none', () => {
  expect(countryOfAirport('LHR')).toBeNull()
  expect(countryOfAirport('')).toBeNull()
  expect(countryOfAirport('XXXX')).toBeNull()
  expect(countryOfAirport(' egll ')).toBe('United Kingdom')
})

test('each country is counted once, however many prefixes it has', () => {
  expect(COUNTRY_NAMES.filter((c) => c === 'United States')).toHaveLength(1)
})

test('every country has a two-letter flag code', () => {
  for (const country of COUNTRY_NAMES)
    expect(COUNTRY_CODES[country], country).toMatch(/^[a-z]{2}$/)
})
