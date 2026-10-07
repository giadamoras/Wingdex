import { afterEach, expect, test, vi } from 'vitest'
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
    speed_kt: 450,
    duration_min: 95,
    origin: null,
    destination: null,
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

test('keeps an old entry that lacks later details', () => {
  // As saved before speed, route and quests existed: only the basics.
  const old = {
    flight: { id: 'f9', callsign: 'OLD9', latitude: 48, longitude: 2 },
    fact: 'An old fact.',
    caughtAt: '2026-09-20T09:00:00.000Z',
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([old, entry]))
  expect(loadJournal()).toEqual([old, entry])
})

test('drops entries that are missing what every entry has, and says how many', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const noFlightId = { ...entry, flight: { ...entry.flight, id: undefined } }
  const badTime = { ...entry, caughtAt: 'not a date' }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([entry, null, {}, noFlightId, badTime, 'text']),
  )
  expect(loadJournal()).toEqual([entry])
  expect(warn).toHaveBeenCalledWith(
    'Dropped 5 of 6 Journal entries with an unexpected shape',
  )
  warn.mockRestore()
})
