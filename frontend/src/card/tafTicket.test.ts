import { expect, test } from 'vitest'
import { clockRange, type Conditions } from './taf'
import {
  changeIcon,
  flightRules,
  landingPeriod,
  laterLines,
  stats,
  summaryWords,
  ticketMoment,
  weatherIcon,
} from './tafTicket'
import type { Taf, TafCloud, TafPeriod } from '../data/types'

const H = 3600
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
const cloud = (
  cover: string,
  base_ft: number,
  cumulonimbus = false,
): TafCloud => ({
  cover,
  base_ft,
  cumulonimbus,
})
const conditions = (over: Partial<Conditions>): Conditions => period(over)

test.each([
  [{ weather: 'TSRA' }, '⛈️'],
  [{ weather: '-SN' }, '🌨️'],
  [{ weather: 'FG' }, '🌫️'],
  [{ weather: '-SHRA' }, '🌦️'],
  [{ weather: 'RA' }, '🌧️'],
  [{ clouds: [cloud('OVC', 800)] }, '☁️'],
  [{ clouds: [cloud('FEW', 3000), cloud('BKN', 5000)] }, '🌥️'],
  [{ clouds: [cloud('SCT', 2000)] }, '⛅'],
  [{ clouds: [cloud('NSC', 0)] }, '☀️'],
])('conditions %o get %s', (over, icon) => {
  expect(weatherIcon(conditions(over as Partial<Conditions>))).toBe(icon)
})

test('the summary is the weather and how cloudy it is', () => {
  expect(summaryWords(conditions({ clouds: [cloud('FEW', 2000)] }))).toBe(
    'Dry, a few clouds',
  )
  expect(
    summaryWords(conditions({ weather: '-RA', clouds: [cloud('OVC', 900)] })),
  ).toBe('Light rain, overcast')
  expect(summaryWords(conditions({ clouds: [cloud('NSC', 0)] }))).toBe(
    'Dry, clear skies',
  )
})

test('three numbers: wind, visibility and the lowest cloud', () => {
  expect(
    stats(
      conditions({
        wind_dir: 225,
        wind_kt: 13,
        gust_kt: 25,
        visibility_m: 10000,
        visibility_or_more: true,
        clouds: [cloud('BKN', 4000), cloud('SCT', 1800)],
      }),
    ).map(({ value, label }) => `${value} ${label}`),
  ).toEqual([
    '13 kt wind from the SW, gusts 25',
    // Good visibility is left out; the flight rules say it's fine.
    '1,800 ft scattered clouds',
    'VFR fly by sight',
  ])
  expect(stats(conditions({ wind_kt: 0 }))[0].value).toBe('Calm')
  // Poor visibility is shown.
  expect(
    stats(conditions({ visibility_m: 3000 })).map((s) => s.value),
  ).toContain('3 km')
})

test.each([
  [
    {
      visibility_m: 10000,
      visibility_or_more: true,
      clouds: [cloud('SCT', 2000)],
    },
    'VFR',
  ],
  [{ visibility_m: 10000, clouds: [cloud('BKN', 2500)] }, 'MVFR'],
  [{ visibility_m: 6000, clouds: [cloud('FEW', 2000)] }, 'MVFR'],
  [{ visibility_m: 2000, clouds: [cloud('OVC', 1500)] }, 'IFR'],
  [{ visibility_m: 9999, clouds: [cloud('OVC', 800)] }, 'IFR'],
  [{ visibility_m: 600, clouds: [] }, 'LIFR'],
  [{ vertical_visibility_ft: 200 }, 'LIFR'],
])('flight rules for %o: %s', (over, rules) => {
  expect(flightRules(conditions(over as Partial<Conditions>))).toBe(rules)
})

test('a change of wind only gets the wind icon', () => {
  const before = conditions({
    wind_dir: 250,
    wind_kt: 10,
    clouds: [cloud('FEW', 2000)],
  })
  expect(changeIcon(before, { ...before, wind_kt: 20 })).toBe('💨')
  expect(changeIcon(before, { ...before, weather: 'RA' })).toBe('🌧️')
})

// Fair to start, a rain spell, the wind picking up, then a calmer new forecast.
const TAF: Taf = {
  icao: 'EGLL',
  name: null,
  issued: T0,
  valid_from: T0,
  valid_to: T0 + 30 * H,
  raw: 'TAF EGLL 221120Z 2212/2318 25010KT 9999 SCT035 TEMPO 2214/2217 6000 -RA BKN012 BECMG 2220/2222 13022G32KT FM231400 36006KT 9999 FEW020',
  periods: [
    period({
      end: T0 + 26 * H,
      wind_dir: 250,
      wind_kt: 10,
      visibility_m: 10000,
      visibility_or_more: true,
      clouds: [cloud('SCT', 3500)],
    }),
    period({
      start: T0 + 2 * H,
      end: T0 + 5 * H,
      change: 'TEMPO',
      visibility_m: 6000,
      weather: '-RA',
      clouds: [cloud('BKN', 1200)],
    }),
    period({
      start: T0 + 8 * H,
      end: T0 + 26 * H,
      change: 'BECMG',
      becoming_by: T0 + 10 * H,
      wind_dir: 130,
      wind_kt: 22,
      gust_kt: 32,
    }),
    period({
      start: T0 + 26 * H,
      change: 'FM',
      wind_dir: 360,
      wind_kt: 6,
      visibility_m: 10000,
      visibility_or_more: true,
      clouds: [cloud('FEW', 2000)],
    }),
  ],
}

test('later lines say briefly what changes, in time order', () => {
  const now = T0 * 1000
  expect(laterLines(TAF, T0 + H, 'UTC', now).map((l) => l.what)).toEqual([
    'At times: light rain',
    'Wind picks up: 22 kt from the southeast, gusts 32',
    'Calmer: 6 kt from the north',
  ])
  // Every time starts with a capital, like "Until …".
  expect(
    laterLines(TAF, T0 + H, 'UTC', now).every((l) => /^[A-Z0-9]/.test(l.when)),
  ).toBe(true)
  // A spell already running at that moment reads "Until …".
  expect(laterLines(TAF, T0 + 3 * H, 'UTC', now)[0].when).toMatch(/^Until /)
})

test("later lines are on the destination's clock", () => {
  const now = T0 * 1000
  // The rain spell, 14:00–17:00 UTC, is 15:00–18:00 in London (summer time).
  const utc = laterLines(TAF, T0 + H, 'UTC', now)[0].when
  const london = laterLines(TAF, T0 + H, 'Europe/London', now)[0].when
  expect(utc).toBe('14:00–17:00')
  expect(london).toBe('15:00–18:00')
})

test('the landing falls in the main period in force then', () => {
  expect(landingPeriod(TAF, T0 + H)).toBe(0) // the opening forecast; spells don't count
  expect(landingPeriod(TAF, T0 + 12 * H)).toBe(2) // after the wind change
  expect(landingPeriod(TAF, T0 + 27 * H)).toBe(3)
  expect(landingPeriod(TAF, null)).toBeNull()
})

test('the ticket shows the landing, or now when it lands after the forecast', () => {
  expect(ticketMoment(TAF, T0 + 5 * H)).toEqual({
    t: T0 + 5 * H,
    isArrival: true,
  })
  expect(ticketMoment(TAF, T0 + 40 * H, (T0 + H) * 1000)).toEqual({
    t: T0 + H,
    isArrival: false,
  })
})

test('a range names the day once', () => {
  const now = Date.UTC(2026, 9, 22, 9)
  const at = (d: number, h: number) => Date.UTC(2026, 9, d, h) / 1000
  expect(clockRange(at(22, 21), at(22, 23), 'UTC', now)).toBe('21:00–23:00')
  expect(clockRange(at(23, 5), at(23, 9), 'UTC', now)).toBe(
    'tomorrow 05:00–09:00',
  )
  expect(clockRange(at(22, 21), at(23, 21), 'UTC', now)).toBe(
    '21:00–tomorrow 21:00',
  )
  // 21:00–23:00 UTC runs past midnight in Tokyo (UTC+9).
  expect(clockRange(at(22, 21), at(22, 23), 'Asia/Tokyo', now)).toBe(
    'tomorrow 06:00–08:00',
  )
})
