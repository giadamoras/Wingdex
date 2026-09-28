import { afterEach, expect, test } from 'vitest'
import { loadJournal, saveJournal, STORAGE_KEY } from './journal'
import type { JournalEntry } from './types'

// Each test starts with empty storage, so tests can't affect each other.
afterEach(() => localStorage.clear())

const entry: JournalEntry = {
  flight: {
    id: 'f1',
    callsign: 'TST1',
    aircraft_type: 'A320',
    latitude: 50,
    longitude: 0,
    altitude_ft: 36000,
    heading: 90,
    duration_min: 95,
  },
  fact: 'A test fact.',
  caughtAt: '2026-09-25T12:00:00.000Z',
}

test('loads back what was saved', () => {
  saveJournal([entry])
  // toEqual compares contents; the loaded list is a new object, so toBe would fail.
  expect(loadJournal()).toEqual([entry])
})

test('returns an empty list when nothing is saved', () => {
  expect(loadJournal()).toEqual([])
})

test('returns an empty list for corrupt JSON', () => {
  localStorage.setItem(STORAGE_KEY, 'not json')
  expect(loadJournal()).toEqual([])
})

test('returns an empty list when the saved value is not a list', () => {
  localStorage.setItem(STORAGE_KEY, '{"a":1}')
  expect(loadJournal()).toEqual([])
})
