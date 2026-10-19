import { expect, test } from 'vitest'
import {
  otherTypes,
  questStreak,
  seenAirlines,
  seenCountries,
  seenTypes,
  tileType,
} from './dex'
import type { Airport, JournalEntry } from '../data/types'
import { makeFlight } from '../testFlight'

const airport = (icao: string): Airport => ({
  icao,
  iata: icao.slice(1),
  name: icao,
  latitude: 0,
  longitude: 0,
})

const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  flight: makeFlight(),
  fact: 'A fact.',
  caughtAt: '2026-09-25T12:00:00.000Z',
  ...over,
})

test('types are counted once each, and unknown types are left out', () => {
  const journal = [
    entry(),
    entry(),
    entry({ flight: makeFlight({ aircraft_type: 'B738' }) }),
    entry({ flight: makeFlight({ aircraft_type: null }) }),
    entry({ flight: makeFlight({ aircraft_type: 'ZZZZ' }) }),
  ]
  expect([...seenTypes(journal)]).toEqual(['A320', 'B738', 'ZZZZ'])
  expect(otherTypes(journal)).toEqual(['ZZZZ'])
})

test('only airlines in the catalog count', () => {
  const journal = ['BAW117', 'BAW9', 'DLH4', 'GABCD', 'XYZ123'].map((cs) =>
    entry({ flight: makeFlight({ callsign: cs }) }),
  )
  expect([...seenAirlines(journal)]).toEqual(['BAW', 'DLH'])
})

test('one passport stamp per destination country, however many airports', () => {
  const to = (icao: string) =>
    entry({ flight: makeFlight({ destination: airport(icao) }) })
  const stamps = seenCountries([to('EGLL'), to('EGPH'), to('KJFK'), entry()])
  expect([...stamps]).toEqual(['United Kingdom', 'United States'])
})

// A quest completed at noon local time on the given day of the month.
const questOn = (day: number, month = 8) =>
  entry({
    questId: 'high',
    caughtAt: new Date(2026, month, day, 12).toISOString(),
  })

test('the streak counts days in a row with a completed quest', () => {
  const journal = [questOn(20), questOn(21), questOn(23), questOn(24)]
  // Today is the 24th, done: 23-24 is the current run, 20-21 is as long.
  expect(questStreak(journal, new Date(2026, 8, 24, 18))).toEqual({
    current: 2,
    best: 2,
  })
})

test("the streak survives today until today's quest is done", () => {
  const journal = [questOn(22), questOn(23)]
  expect(questStreak(journal, new Date(2026, 8, 24, 9)).current).toBe(2)
  // A whole day missed breaks it, but the best is kept.
  expect(questStreak(journal, new Date(2026, 8, 25, 9))).toEqual({
    current: 0,
    best: 2,
  })
})

test('catches that did not complete a quest, or two in a day, count once', () => {
  const journal = [
    questOn(23),
    entry({ caughtAt: new Date(2026, 8, 24, 12).toISOString() }),
    questOn(24),
    questOn(24),
  ]
  expect(questStreak(journal, new Date(2026, 8, 24, 18))).toEqual({
    current: 2,
    best: 2,
  })
  expect(questStreak([], new Date())).toEqual({ current: 0, best: 0 })
})

test('the streak runs across a month end', () => {
  const journal = [questOn(30, 8), questOn(1, 9)]
  expect(questStreak(journal, new Date(2026, 9, 1, 18)).current).toBe(2)
})

test("a tile's silhouette is the latest catch in it, else its usual shape", () => {
  // Caravan (a single-engine turboprop, drawn as a light aircraft) is the odd
  // one out among the twin turboprops, so it never stands for the group.
  const turboprops = ['C208', 'AT76', 'DH8D', 'B350']
  expect(tileType(turboprops, [])).toBe('AT76')
  // Caught: the latest catch in the group wins, even the odd one out.
  expect(tileType(turboprops, ['A320', 'C208', 'DH8D'])).toBe('C208')
  expect(tileType(turboprops, [null, 'B738'])).toBe('AT76')
})
