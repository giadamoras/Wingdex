import { expect, test } from 'vitest'
import {
  arrivalTime,
  cloudWords,
  codeTimeExample,
  conditionsWords,
  utcTime,
  prevailingAt,
  visibilityWords,
  weatherGroupWords,
  weatherWords,
  windWords,
  type Conditions,
} from './taf'
import type { Taf, TafPeriod } from '../data/types'
import { makeFlight } from '../testFlight'

const H = 3600
// 2026-10-22 12:00 UTC, the forecast's start.
const T0 = Date.UTC(2026, 9, 22, 12) / 1000

const period = (over: Partial<TafPeriod>): TafPeriod => ({
  start: T0,
  end: T0 + 30 * H,
  change: 'base',
  becoming_by: null,
  probability: null,
  wind_dir: null,
  wind_variable: false,
  wind_kt: null,
  gust_kt: null,
  visibility_m: null,
  visibility_or_more: false,
  weather: null,
  clouds: [],
  vertical_visibility_ft: null,
  ...over,
})

// Like EGLL's: fair to start, a rain spell, a wind change, a chance of
// thunderstorms, then a new forecast from hour 26.
const TAF: Taf = {
  icao: 'EGLL',
  name: 'London Heathrow',
  issued: T0 - 1800,
  valid_from: T0,
  valid_to: T0 + 30 * H,
  raw: 'TAF EGLL 221120Z 2212/2318 25010KT 9999 SCT035 ...',
  periods: [
    period({
      end: T0 + 26 * H,
      wind_dir: 250,
      wind_kt: 10,
      visibility_m: 10000,
      visibility_or_more: true,
      clouds: [{ cover: 'SCT', base_ft: 3500, cumulonimbus: false }],
    }),
    period({
      start: T0 + 2 * H,
      end: T0 + 5 * H,
      change: 'TEMPO',
      visibility_m: 6000,
      weather: '-RA',
      clouds: [{ cover: 'BKN', base_ft: 1200, cumulonimbus: false }],
    }),
    period({
      start: T0 + 8 * H,
      end: T0 + 26 * H,
      change: 'BECMG',
      becoming_by: T0 + 10 * H,
      wind_dir: 130,
      wind_kt: 18,
      gust_kt: 28,
    }),
    period({
      start: T0 + 14 * H,
      end: T0 + 17 * H,
      change: 'TEMPO',
      probability: 30,
      weather: 'TSRA',
      clouds: [{ cover: 'BKN', base_ft: 1500, cumulonimbus: true }],
    }),
    period({
      start: T0 + 26 * H,
      change: 'FM',
      wind_dir: 360,
      wind_kt: 6,
      visibility_m: 10000,
      visibility_or_more: true,
      clouds: [{ cover: 'FEW', base_ft: 2000, cumulonimbus: false }],
    }),
  ],
}

test('the main forecast follows FM and completed BECMG changes, not spells', () => {
  expect(prevailingAt(TAF, T0 + 3 * H)?.weather).toBeNull() // the rain is a spell
  // The wind change counts only once it is complete.
  expect(prevailingAt(TAF, T0 + 9 * H)?.wind_kt).toBe(10)
  const changed = prevailingAt(TAF, T0 + 11 * H)!
  expect([changed.wind_dir, changed.wind_kt, changed.gust_kt]).toEqual([
    130, 18, 28,
  ])
  expect(changed.clouds[0].base_ft).toBe(3500) // kept from the base
  // FM replaces everything.
  expect(prevailingAt(TAF, T0 + 27 * H)?.wind_kt).toBe(6)
  expect(prevailingAt(TAF, T0 - H)).toBeNull()
})

test.each([
  ['-SHRA', 'light rain showers'],
  ['+RA', 'heavy rain'],
  ['TSRA', 'thunderstorm with rain'],
  ['TS', 'thunderstorm'],
  ['VCSH', 'showers nearby'],
  ['RADZ', 'rain and drizzle'],
  ['FZRA', 'freezing rain'],
  ['BR', 'mist'],
  ['BCFG', 'patches of fog'],
  ['NSW', 'no significant weather'],
  ['XYZ', 'XYZ'],
])('weather code %s reads "%s"', (code, words) => {
  expect(weatherGroupWords(code)).toBe(words)
})

test('several weather groups are listed', () => {
  expect(weatherWords('+SHRA +RA')).toBe('heavy rain showers, heavy rain')
})

const conditions = (over: Partial<Conditions>): Conditions => ({
  ...period({}),
  ...over,
})

test('wind in words, from where it blows', () => {
  expect(windWords(conditions({ wind_dir: 225, wind_kt: 15 }))).toBe(
    'wind 15 kt from the southwest',
  )
  expect(
    windWords(conditions({ wind_dir: 360, wind_kt: 8, gust_kt: 20 })),
  ).toBe('wind 8 kt from the north, gusting 20')
  expect(windWords(conditions({ wind_variable: true, wind_kt: 3 }))).toBe(
    'variable wind 3 kt',
  )
  expect(windWords(conditions({ wind_dir: 0, wind_kt: 0 }))).toBe('calm')
  expect(windWords(conditions({}))).toBeNull()
})

test('visibility and cloud in words', () => {
  expect(
    visibilityWords(
      conditions({ visibility_m: 10000, visibility_or_more: true }),
    ),
  ).toBe('good visibility')
  expect(visibilityWords(conditions({ visibility_m: 7000 }))).toBe(
    'visibility 7 km',
  )
  expect(visibilityWords(conditions({ visibility_m: 800 }))).toBe(
    'visibility 800 m',
  )
  expect(
    cloudWords([
      { cover: 'BKN', base_ft: 4000, cumulonimbus: false },
      { cover: 'SCT', base_ft: 1200, cumulonimbus: true },
    ]),
  ).toBe('scattered cloud at 1,200 ft, with thunderclouds')
  expect(
    cloudWords([{ cover: 'NSC', base_ft: null, cumulonimbus: false }]),
  ).toBe('no significant cloud')
})

test('the main forecast says "dry" when it has no weather, a spell does not', () => {
  const fair = TAF.periods[0]
  expect(conditionsWords(fair)).toBe(
    'Dry, wind 10 kt from the west, good visibility, scattered cloud at 3,500 ft',
  )
  expect(conditionsWords(TAF.periods[1], true)).toBe(
    'Light rain, visibility 6 km, broken cloud at 1,200 ft',
  )
})

test('arrival is the remaining distance at the current ground speed', () => {
  // 60 nm (one degree of latitude) at 480 kt: 7.5 minutes.
  const flight = makeFlight({
    latitude: 50,
    longitude: 0,
    speed_kt: 480,
    destination: {
      icao: 'EGLL',
      iata: 'LHR',
      name: 'Heathrow',
      latitude: 51,
      longitude: 0,
    },
  })
  const now = T0 * 1000
  expect(arrivalTime(flight, now)! - T0).toBeCloseTo(450, -1)
  expect(arrivalTime({ ...flight, destination: null }, now)).toBeNull()
  expect(arrivalTime({ ...flight, speed_kt: 20 }, now)).toBeNull()
})

test('UTC times name the day when it is not today (in UTC)', () => {
  const now = Date.UTC(2026, 9, 22, 23, 30) // still the 22nd in UTC
  const at = (d: number, h: number, m = 0) => Date.UTC(2026, 9, d, h, m) / 1000
  expect(utcTime(at(22, 16, 40), now)).toBe('16:40')
  expect(utcTime(at(23, 3), now)).toBe('tomorrow 03:00')
  expect(utcTime(at(24, 9), now)).toBe('Sat 09:00')
})

test('the code-time example reads the forecast start', () => {
  expect(codeTimeExample(TAF)).toBe('2212 is the 22nd at 12:00 UTC')
})
