import { afterEach, expect, test, vi } from 'vitest'
import {
  isDataSources,
  isFlight,
  isFlightRoute,
  isJournalEntry,
  isWeatherArea,
  keepValid,
} from './validate'

afterEach(() => vi.restoreAllMocks())

// A row like the live feed sends: no route, and a few optional extras.
const flight = {
  id: 'abc123',
  callsign: 'TST1',
  aircraft_type: 'A320',
  latitude: 50,
  longitude: 0,
  altitude_ft: 36000,
  heading: 90,
  speed_kt: 450,
  duration_min: null,
  origin: null,
  destination: null,
  vertical_rate_fpm: 0,
}

test('a normal flight passes, with or without a route and extra fields', () => {
  expect(isFlight(flight)).toBe(true)
  const airport = { icao: 'EGLL', iata: 'LHR', latitude: 51.5, longitude: -0.5 }
  expect(isFlight({ ...flight, origin: airport, destination: airport })).toBe(
    true,
  )
  expect(isFlight({ ...flight, aircraft_type: null, duration_min: 95 })).toBe(
    true,
  )
  expect(isFlight({ ...flight, something_new: [1, 2] })).toBe(true)
})

test.each([
  ['not an object', null],
  ['an array', []],
  ['no id', { ...flight, id: undefined }],
  ['a numeric id', { ...flight, id: 7 }],
  ['no callsign', { ...flight, callsign: undefined }],
  ['a null latitude', { ...flight, latitude: null }],
  ['a text longitude', { ...flight, longitude: '10' }],
  ['a NaN altitude', { ...flight, altitude_ft: NaN }],
  ['an infinite speed', { ...flight, speed_kt: Infinity }],
  ['a missing heading', { ...flight, heading: undefined }],
  ['a numeric aircraft type', { ...flight, aircraft_type: 320 }],
  ['a text duration', { ...flight, duration_min: '95' }],
  ['an origin with no position', { ...flight, origin: { iata: 'LHR' } }],
])('a flight with %s is rejected', (_name, row) => {
  expect(isFlight(row)).toBe(false)
})

const area = {
  id: 'w1',
  hazard: 'icing',
  region: 'North Atlantic',
  altitude_min_ft: 0,
  altitude_max_ft: 30000,
  valid_from: 1,
  valid_to: 2,
  polygon: [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
    { latitude: 1, longitude: 1 },
    { latitude: 0, longitude: 0 },
  ],
  movement_dir: null,
  movement_speed_kt: null,
}

test('a weather area passes, and the display-only fields are optional', () => {
  expect(isWeatherArea(area)).toBe(true)
  expect(isWeatherArea({ ...area, severity: 'Severe', name: 'Koguma' })).toBe(
    true,
  )
  const { movement_dir: _d, movement_speed_kt: _s, ...older } = area
  expect(isWeatherArea(older)).toBe(true)
})

test.each([
  ['an unknown hazard', { ...area, hazard: 'fog' }],
  ['no region', { ...area, region: undefined }],
  ['a text altitude', { ...area, altitude_max_ft: 'high' }],
  ['no end time', { ...area, valid_to: undefined }],
  ['no polygon', { ...area, polygon: undefined }],
  [
    'a polygon too short to be a ring',
    { ...area, polygon: area.polygon.slice(0, 3) },
  ],
  [
    'a polygon point with no position',
    { ...area, polygon: [...area.polygon.slice(0, 3), { latitude: 0 }] },
  ],
])('a weather area with %s is rejected', (_name, row) => {
  expect(isWeatherArea(row)).toBe(false)
})

const entry = {
  flight: { id: 'f1', callsign: 'TST1', latitude: 50, longitude: 0 },
  fact: 'A fact.',
  caughtAt: '2026-09-25T12:00:00.000Z',
}

test('a Journal entry with only what every entry has is kept', () => {
  // Older entries lack speed, route, heading, altitude and questId.
  expect(isJournalEntry(entry)).toBe(true)
  expect(isJournalEntry({ ...entry, questId: 'ocean' })).toBe(true)
  expect(isJournalEntry({ ...entry, hazards: ['icing'] })).toBe(true)
  expect(
    isJournalEntry({
      ...entry,
      flight: { ...entry.flight, aircraft_type: null, origin: null },
    }),
  ).toBe(true)
})

test.each([
  ['no flight', { ...entry, flight: undefined }],
  ['a flight that is not an object', { ...entry, flight: 'f1' }],
  ['no flight id', { ...entry, flight: { ...entry.flight, id: undefined } }],
  ['no callsign', { ...entry, flight: { ...entry.flight, callsign: 5 } }],
  ['no latitude', { ...entry, flight: { ...entry.flight, latitude: null } }],
  [
    'a text longitude',
    { ...entry, flight: { ...entry.flight, longitude: '0' } },
  ],
  ['no fact', { ...entry, fact: undefined }],
  ['no catch time', { ...entry, caughtAt: undefined }],
  ['a catch time that is not a date', { ...entry, caughtAt: 'yesterday-ish' }],
  ['a numeric quest id', { ...entry, questId: 3 }],
  ['hazards that are not a list', { ...entry, hazards: 'icing' }],
  ['not an object', 'entry'],
])('a Journal entry with %s is rejected', (_name, row) => {
  expect(isJournalEntry(row)).toBe(false)
})

test('a route lookup only has to be an object', () => {
  expect(isFlightRoute({})).toBe(true)
  expect(isFlightRoute({ aircraft_type: 'A320', origin: null })).toBe(true)
  expect(isFlightRoute(null)).toBe(false)
  expect(isFlightRoute([])).toBe(false)
  expect(isFlightRoute('route')).toBe(false)
})

const isEven = (v: unknown): v is number => typeof v === 'number' && v % 2 === 0

test('keepValid returns the very same list when nothing is wrong', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const items = [2, 4, 6]
  expect(keepValid(items, isEven, 'clean items')).toBe(items)
  expect(warn).not.toHaveBeenCalled()
})

test('keepValid drops the bad items and says how many', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  expect(keepValid([2, 3, 4, 'x', 6], isEven, 'counted items')).toEqual([
    2, 4, 6,
  ])
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn).toHaveBeenCalledWith(
    'Dropped 2 of 5 counted items with an unexpected shape',
  )
})

test('keepValid does not repeat a warning for the same count, but says when it changes', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const poll = (items: unknown[]) => keepValid(items, isEven, 'polled items')

  poll([2, 3]) // 1 dropped: warns
  poll([4, 5]) // still 1 dropped: quiet
  expect(warn).toHaveBeenCalledTimes(1)
  poll([3, 5]) // 2 dropped: warns again
  expect(warn).toHaveBeenCalledTimes(2)
  poll([2, 4]) // all fine again
  poll([3, 4]) // 1 dropped, after a clean pass: warns
  expect(warn).toHaveBeenCalledTimes(3)
})

test('the source names from /health must both be text', () => {
  expect(
    isDataSources({ status: 'ok', source: 'mock', weather_source: 'awc' }),
  ).toBe(true)
  expect(isDataSources({ source: 'mock' })).toBe(false)
  expect(isDataSources({ source: 1, weather_source: 'mock' })).toBe(false)
  expect(isDataSources(null)).toBe(false)
})
