import { expect, test } from 'vitest'
import { decodeTaf } from './tafDecode'
import type { Taf, TafPeriod } from '../data/types'

const T0 = Date.UTC(2026, 9, 22, 12) / 1000
const period = (change: TafPeriod['change']): TafPeriod => ({
  start: T0,
  end: T0 + 3600,
  change,
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
})

const taf = (raw: string, periods: TafPeriod['change'][]): Taf => ({
  icao: 'EGLL',
  name: 'London Heathrow',
  issued: T0,
  valid_from: T0,
  valid_to: T0 + 30 * 3600,
  raw,
  periods: periods.map(period),
})

const meanings = (words: { code: string; meaning: string }[]) =>
  Object.fromEntries(words.map((w) => [w.code, w.meaning]))

test('the opening says what, where, when issued and how long it is valid', () => {
  const { opening } = decodeTaf(
    taf('TAF AMD EGLL 221120Z 2212/2318 25010KT', ['base']),
    null,
  )
  const m = meanings(opening)
  expect(m.TAF).toMatch(/^An airport forecast/)
  expect(m.AMD).toMatch(/^Amended/)
  expect(m.EGLL).toBe('The airport: London Heathrow')
  // Times in UTC, read straight from the code.
  expect(m['221120Z']).toBe('Issued 22nd 11:20 UTC')
  expect(m['2212/2318']).toBe('Valid 22nd 12:00–23rd 18:00 UTC')
})

test('each group is a block, its keyword and times read together', () => {
  const { blocks } = decodeTaf(
    taf(
      'TAF EGLL 221120Z 2212/2318 25010KT 9999 SCT035 PROB40 TEMPO 2214/2217 3000 +SHRA BKN009CB BECMG 2220/2222 13022G32KT FM231400 VRB03KT CAVOK',
      ['base', 'TEMPO', 'BECMG', 'FM'],
    ),
    2,
  )
  expect(blocks).toHaveLength(4)
  const [base, spell, change, fm] = blocks.map((b) => meanings(b.words))
  expect(base['25010KT']).toBe('Wind from 250° (the west) at 10 kt')
  expect(base['9999']).toBe('Visibility 10 km or more')
  expect(base.SCT035).toBe('Scattered cloud at 3,500 ft')
  expect(spell['PROB40 TEMPO 2214/2217']).toBe(
    'A 40% chance, at times, 22nd 14:00–17:00 UTC',
  )
  expect(spell['3000']).toBe('Visibility 3 km')
  expect(spell['+SHRA']).toBe('Heavy rain showers')
  expect(spell.BKN009CB).toBe('Broken cloud at 900 ft, thunderclouds')
  expect(change['BECMG 2220/2222']).toBe(
    'Becoming, gradually, 22nd 20:00–22:00 UTC',
  )
  expect(change['13022G32KT']).toBe(
    'Wind from 130° (the southeast) at 22 kt, gusts to 32 kt',
  )
  expect(fm.FM231400).toBe('New forecast from 23rd 14:00 UTC')
  expect(fm.VRB03KT).toBe('Wind from a changing direction at 3 kt')
  expect(fm.CAVOK).toMatch(/^Ceiling and visibility OK/)
  expect(blocks.map((b) => b.atLanding)).toEqual([false, false, true, false])
})

test('US units, temperatures and unknown words', () => {
  const { blocks } = decodeTaf(
    taf(
      'TAF KDEN 221501Z 2215/2318 28008KT P6SM VV002 TX19/2315Z TNM01/2306Z WS020',
      ['base'],
    ),
    null,
  )
  const m = meanings(blocks[0].words)
  expect(m.P6SM).toBe('Visibility more than 6 miles (10 km)')
  expect(m.VV002).toBe('Sky hidden (fog): seen up to 200 ft')
  expect(m['TX19/2315Z']).toBe('Highest temperature 19°C, 23rd 15:00 UTC')
  expect(m['TNM01/2306Z']).toMatch(/^Lowest temperature -1°C/)
  expect(m.WS020).toBe('Not explained here')
})

test('no block is marked when the code does not line up with the periods', () => {
  const { blocks } = decodeTaf(
    taf('TAF EGLL 221120Z 2212/2318 25010KT TEMPO 2214/2217 RA', ['base']),
    0,
  )
  expect(blocks.some((b) => b.atLanding)).toBe(false)
})
